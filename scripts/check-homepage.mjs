/* Run: node scripts/check-homepage.mjs. Uses the project's existing TypeScript. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

function readModule(relativePath) {
  const filename = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports }, { filename });
  return exports;
}

const { products } = readModule('data/products.ts');
const { selectHomeProducts, homeProductSlugs, productAsset, homeAssets } = readModule('data/homepage.ts');
assert.equal(selectHomeProducts([]).length, 0, 'An empty catalogue must remain empty');
assert.equal(selectHomeProducts(products).map((product) => product.slug).join(','), homeProductSlugs.join(','));
const subset = products.slice(5, 8);
const fallback = selectHomeProducts(subset);
assert.equal(fallback.length, 3, 'A small catalogue must not fabricate missing products');
assert.ok(fallback.every((product) => subset.includes(product)), 'Backfill must come from the supplied catalogue');
assert.equal(new Set(selectHomeProducts(products).map((product) => product.id)).size, 5);
const sold = { ...products[0], stock: 0 };
assert.equal(selectHomeProducts([sold])[0], sold, 'Preserve sold-out state from the catalogue');
assert.equal(productAsset(products[0]).src, null, 'No invented photo paths');
const photo = { ...products[0], images: ['/supplied-denim.jpg'] };
assert.equal(productAsset(photo).src, '/supplied-denim.jpg');
homeAssets.products[photo.slug] = { src: '/supplied-override.jpg', alt: 'Denim', fit: 'cover', position: 'top' };
assert.equal(productAsset(photo).src, '/supplied-override.jpg', 'Central media mapping takes precedence');
console.log('Homepage catalogue selection and media mapping checks passed.');
