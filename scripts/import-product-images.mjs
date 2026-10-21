#!/usr/bin/env node
/**
 * scripts/import-product-images.mjs
 *
 * Bulk-import product listings from a local folder of photos.
 *
 * Every manifest entry becomes one product row; the photo is re-encoded with
 * the exact same sharp pipeline as the admin upload endpoint (rotate -> cap at
 * 1600x2000 -> WebP q82) and uploaded to the `products` bucket under an
 * immutable UUID path. This is the supported path for adding photos to the
 * catalogue from outside the admin UI, which can only attach images at
 * creation time.
 *
 * Usage (from the repo root):
 *   node scripts/import-product-images.mjs \
 *     --source "C:\path\to\images" \
 *     --manifest scripts/imports/website-images-2026-10-21.json
 *
 * Add --dry-run to validate files and print the plan without writing.
 *
 * Notes:
 * - Slugs are derived from names; duplicates get -2, -3, ... so two files
 *   with the same name can coexist.
 * - Inserted rows are live (is_active = true). The ISR cache picks them up
 *   within 60 s (this script runs outside Next, so it cannot call
 *   revalidateCatalog()).
 * - A results file is written next to the manifest
 *   (`<manifest>.result-<timestamp>.json`) listing every created product id
 *   and uploaded object path, so the batch can be rolled back.
 * - Never prints secret values.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const REPO = process.cwd();
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 2000;
const WEBP_QUALITY = 82;

function readArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--source') out.source = argv[++i];
    else if (a === '--manifest') out.manifest = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueSlug(base, taken) {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  const slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (args.help) {
    console.log('node scripts/import-product-images.mjs --source <dir> --manifest <file> [--dry-run]');
    return;
  }
  if (!args.source || !args.manifest) {
    console.error('Missing --source or --manifest. Use --help for usage.');
    process.exitCode = 1;
    return;
  }

  const manifestPath = path.resolve(REPO, args.manifest);
  const sourceRoot = path.resolve(args.source);
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
  if (!fs.existsSync(sourceRoot)) throw new Error(`Source folder not found: ${sourceRoot}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  if (items.length === 0) throw new Error('Manifest has no items.');

  const env = loadEnv(path.join(REPO, '.env.local'));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!args.dryRun && (!supabaseUrl || !serviceKey)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  }

  const supabase = args.dryRun ? null : createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Collect existing slugs so the import never collides with the catalogue
  // or with itself (two files can share a file name).
  const taken = new Set();
  if (supabase) {
    const { data, error } = await supabase.from('products').select('slug');
    if (error) throw new Error(`Could not read existing slugs: ${error.message}`);
    for (const row of data) taken.add(row.slug);
  }

  const batch = manifest.batch || `import-${new Date().toISOString().slice(0, 10)}`;
  const results = [];
  const failures = [];
  let totalBytesIn = 0;
  let totalBytesOut = 0;

  console.log(`Batch:    ${batch}`);
  console.log(`Source:   ${sourceRoot}`);
  console.log(`Manifest: ${path.relative(REPO, manifestPath)} (${items.length} items)`);
  console.log(`Mode:     ${args.dryRun ? 'DRY RUN (no writes)' : 'LIVE (uploading + inserting)'}`);
  console.log('');

  for (const item of items) {
    const rel = item.file;
    const abs = path.join(sourceRoot, rel);
    if (!fs.existsSync(abs)) {
      failures.push({ file: rel, error: 'file not found' });
      console.log(`FAIL  ${rel}  (file not found)`);
      continue;
    }
    if (!item.name || !item.category || !item.price) {
      failures.push({ file: rel, error: 'manifest entry missing name/category/price' });
      console.log(`FAIL  ${rel}  (manifest entry incomplete)`);
      continue;
    }

    try {
      const input = fs.readFileSync(abs);
      totalBytesIn += input.length;
      const encoded = await sharp(input)
        .rotate()
        .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      totalBytesOut += encoded.length;
      const meta = await sharp(encoded).metadata();

      const slug = uniqueSlug(slugify(item.name), taken);

      if (args.dryRun) {
        console.log(
          `ok    ${slug.padEnd(46)} ${String(meta.width).padStart(4)}x${String(meta.height).padEnd(4)} ` +
            `${(encoded.length / 1024).toFixed(0).padStart(4)} KB  Rs ${item.price}`
        );
        results.push({ slug, name: item.name, file: rel, dryRun: true });
        continue;
      }

      const objectPath = `imports/${batch}/${randomUUID()}.webp`;
      const upload = await supabase.storage
        .from('products')
        .upload(objectPath, encoded, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: false,
        });
      if (upload.error) throw new Error(`upload failed: ${upload.error.message}`);

      const imageUrl = supabase.storage.from('products').getPublicUrl(objectPath).data.publicUrl;
      const row = {
        slug,
        name: item.name,
        brand: item.brand || manifest.brand || 'Thriv',
        category: item.category,
        subcategory: item.subcategory || null,
        is_featured: false,
        price_pkr: item.price,
        condition: null,
        is_merch: true,
        size: null,
        sizes: item.sizes || ['S', 'M', 'L', 'XL'],
        stock: item.stock ?? 10,
        images: [imageUrl],
        description: item.description || manifest.description || 'Description coming soon.',
        measurements: null,
        is_active: true,
      };

      const insert = await supabase.from('products').insert(row).select('id, slug, name').single();
      if (insert.error) {
        // Do not leave an orphaned object behind if the row was rejected.
        await supabase.storage.from('products').remove([objectPath]);
        throw new Error(`insert failed: ${insert.error.message}`);
      }

      results.push({
        id: insert.data.id,
        slug,
        name: item.name,
        file: rel,
        objectPath,
        imageUrl,
        bytes: encoded.length,
        width: meta.width,
        height: meta.height,
        price: item.price,
      });
      console.log(
        `ok    ${slug.padEnd(46)} ${String(meta.width).padStart(4)}x${String(meta.height).padEnd(4)} ` +
          `${(encoded.length / 1024).toFixed(0).padStart(4)} KB  Rs ${item.price}`
      );
    } catch (err) {
      failures.push({ file: rel, error: err instanceof Error ? err.message : String(err) });
      console.log(`FAIL  ${rel}  (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  console.log('');
  console.log(`Done: ${results.length} ok, ${failures.length} failed.`);
  console.log(
    `Photo bytes: ${(totalBytesIn / 1024 / 1024).toFixed(1)} MB in -> ` +
      `${(totalBytesOut / 1024 / 1024).toFixed(2)} MB served (${items.length} images).`
  );

  if (!args.dryRun && results.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(path.dirname(manifestPath), `result-${batch}-${stamp}.json`);
    fs.writeFileSync(
      outFile,
      JSON.stringify({ batch, createdAt: new Date().toISOString(), results, failures }, null, 2),
      'utf8'
    );
    console.log(`Rollback record: ${path.relative(REPO, outFile)}`);
    console.log('ISR surfaces pick these up within 60 s (this script runs outside Next).');
  }

  if (failures.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
