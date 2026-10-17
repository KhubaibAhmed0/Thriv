import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import {
  ALLOWED_IMAGE_TYPES,
  CreateProductSchema,
  MAX_PRODUCT_PHOTOS,
  MAX_UPLOAD_BYTES,
  isRealImageFile,
} from '@/lib/admin-product-schema';
import { securityLog } from '@/lib/security-log';

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
}

const DEFAULT_PAGE_LIMIT = 200;
const MAX_PAGE_LIMIT = 500;

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  try {
    // Audit F-83: bounded pagination (defaults keep the current UI intact).
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(
        parseInt(url.searchParams.get('limit') ?? String(DEFAULT_PAGE_LIMIT), 10) ||
          DEFAULT_PAGE_LIMIT,
        1
      ),
      MAX_PAGE_LIMIT
    );
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);

    const serviceClient = getServiceClient();
    const { data: products, error, count } = await serviceClient
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // F-41: raw detail goes to the server log only.
      console.error('[/api/admin/products] DB error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const rows = products ?? [];
    const total = count ?? rows.length;
    return NextResponse.json({
      products: rows,
      total,
      limit,
      offset,
      has_more: total > offset + rows.length,
    });
  } catch (err) {
    console.error('[/api/admin/products] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  try {
    const formData = await req.formData();

    // ── Normalise FormData → schema shape (audit F-49) ────────────────
    const priceRaw = formData.get('price')?.toString().trim() ?? '';
    const stockRaw = formData.get('stock')?.toString().trim() ?? '';
    const measurementsRaw = formData.get('measurements')?.toString().trim();
    const sizesRaw = formData.get('sizes')?.toString().trim();

    // Strip blank measurement rows; an all-blank object becomes null (F-22).
    let measurements: Record<string, string> | null = null;
    if (measurementsRaw) {
      try {
        const parsedJson = JSON.parse(measurementsRaw) as Record<string, unknown>;
        if (parsedJson && typeof parsedJson === 'object') {
          const cleaned = Object.fromEntries(
            Object.entries(parsedJson).filter(
              ([, v]) => typeof v === 'string' && v.trim() !== ''
            )
          ) as Record<string, string>;
          measurements = Object.keys(cleaned).length > 0 ? cleaned : null;
        }
      } catch {
        measurements = null;
      }
    }

    let sizes: unknown = null;
    if (sizesRaw) {
      try {
        sizes = JSON.parse(sizesRaw);
      } catch {
        sizes = sizesRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(sizes)) sizes = null;
    }

    const raw = {
      name: formData.get('name')?.toString().trim() ?? '',
      brand: formData.get('brand')?.toString().trim() ?? '',
      category: formData.get('category')?.toString().trim() ?? '',
      subcategory: formData.get('subcategory')?.toString().trim() ?? '',
      isMerch: formData.get('isMerch') === 'true',
      isFeatured: formData.get('isFeatured') === 'true',
      condition: formData.get('condition')?.toString().trim() ?? '',
      price: priceRaw === '' ? NaN : Number(priceRaw),
      stock: stockRaw === '' ? NaN : Number(stockRaw),
      size: formData.get('size')?.toString().trim() ?? '',
      sizes,
      description: formData.get('description')?.toString().trim() ?? '',
      measurements,
    };

    const parsed = CreateProductSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // ── Upload gate (audit F-53): size + MIME + magic bytes ──────────
    const imageFiles = formData
      .getAll('images')
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (imageFiles.length > MAX_PRODUCT_PHOTOS) {
      return NextResponse.json(
        { error: `Up to ${MAX_PRODUCT_PHOTOS} photos per product.`, code: 'TOO_MANY_PHOTOS' },
        { status: 400 }
      );
    }

    const rejected: string[] = [];
    const validatedFiles: File[] = [];
    for (const file of imageFiles) {
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push(`${file.name} (over 4 MB)`);
        continue;
      }
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        rejected.push(`${file.name} (not JPG/PNG/WebP)`);
        continue;
      }
      const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (!isRealImageFile(head)) {
        rejected.push(`${file.name} (not a real image file)`);
        continue;
      }
      validatedFiles.push(file);
    }

    if (rejected.length > 0) {
      securityLog('admin.product.upload_rejected', {
        adminId: auth.user?.id,
        rejected,
      });
      return NextResponse.json(
        {
          error: `Some photos were rejected: ${rejected.join(', ')}. Use JPG/PNG/WebP files up to 4 MB.`,
          code: 'INVALID_UPLOADS',
        },
        { status: 400 }
      );
    }

    // Combined size gate: Vercel caps a serverless request body at 4.5 MB,
    // so the route enforces a 4 MB total itself rather than letting the
    // platform 413 the upload with an unhelpful message.
    const totalBytes = validatedFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
      securityLog('admin.product.upload_rejected', {
        adminId: auth.user?.id,
        reason: 'combined-size',
        files: validatedFiles.length,
      });
      return NextResponse.json(
        {
          error:
            'Combined photo size must be 4 MB or less. Please compress the photos and try again.',
          code: 'PAYLOAD_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const slug = generateSlug(input.name);

    // ── Upload to storage; abort + clean up on any failure (F-53) ────
    const uploadedPaths: string[] = [];
    let uploadFailedFor: string | null = null;

    for (let i = 0; i < validatedFiles.length; i++) {
      const file = validatedFiles[i];
      const ext =
        file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `${slug}-${i + 1}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await serviceClient.storage
        .from('products')
        .upload(fileName, buffer, { contentType: file.type, upsert: true });

      if (uploadError) {
        console.error(`[uploadError] Failed uploading ${fileName}:`, uploadError.message);
        uploadFailedFor = file.name;
        break;
      }
      uploadedPaths.push(fileName);
    }

    if (uploadFailedFor) {
      // Remove anything that did make it — no half-uploaded products.
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await serviceClient.storage
          .from('products')
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error('[uploadError] cleanup remove failed:', cleanupError.message);
        }
      }
      securityLog('admin.product.upload_failed', {
        adminId: auth.user?.id,
        slug,
        failed: uploadFailedFor,
        cleaned: uploadedPaths.length,
      });
      return NextResponse.json(
        { error: 'Photo upload failed. Nothing was saved — please retry.', code: 'UPLOAD_FAILED' },
        { status: 502 }
      );
    }

    const imageUrls = uploadedPaths.map(
      (path) => serviceClient.storage.from('products').getPublicUrl(path).data.publicUrl
    );

    // ── Insert new product row ────────────────────────────────────────
    const { data: newProduct, error: insertError } = await serviceClient
      .from('products')
      .insert({
        slug,
        name: input.name,
        brand: input.brand,
        category: input.category,
        subcategory: input.subcategory || null,
        is_featured: input.isFeatured,
        price_pkr: input.price,
        condition: input.isMerch ? null : input.condition,
        is_merch: input.isMerch,
        size: input.isMerch ? null : input.size,
        stock: input.stock,
        images: imageUrls,
        description: input.description,
        measurements: input.measurements,
        sizes: input.isMerch ? input.sizes : null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      // F-41: log the raw detail; the client gets a fixed message.
      console.error('[/api/admin/products] DB insert error:', insertError.message);
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await serviceClient.storage
          .from('products')
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error('[products] insert-failure cleanup failed:', cleanupError.message);
        }
      }
      return NextResponse.json(
        { error: 'Failed to save the product. Nothing was changed — please retry.', code: 'INSERT_FAILED' },
        { status: 500 }
      );
    }

    securityLog('admin.product.create', {
      adminId: auth.user?.id,
      slug,
      photos: uploadedPaths.length,
      isMerch: input.isMerch,
    });

    return NextResponse.json({ success: true, product: newProduct });
  } catch (err) {
    console.error('[/api/admin/products] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
