import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { errorMessage } from '@/lib/errors';

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  try {
    const serviceClient = getServiceClient();
    const { data: products, error } = await serviceClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: products || [] });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, 'Server error') }, { status: 500 });
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

    const name = formData.get('name')?.toString().trim();
    const brand = formData.get('brand')?.toString().trim();
    const category = formData.get('category')?.toString().trim() || 'jeans';
    const subcategory = formData.get('subcategory')?.toString().trim() || '';
    const isFeatured = formData.get('isFeatured') === 'true';
    const isMerch = formData.get('isMerch') === 'true';
    // Audit F-22: no fabricated defaults — grade, sizes and stock are exactly
    // what the operator entered, or the request is rejected.
    const condition = formData.get('condition')?.toString().trim() || '';
    const priceStr = formData.get('price')?.toString().trim();
    const size = formData.get('size')?.toString().trim() || null;
    const sizesRaw = formData.get('sizes')?.toString().trim();
    const stockStr = formData.get('stock')?.toString().trim();
    const description = formData.get('description')?.toString().trim() || '';
    const measurementsRaw = formData.get('measurements')?.toString().trim();

    if (!name || !brand || !priceStr) {
      return NextResponse.json(
        { error: 'Name, brand, and price are required.' },
        { status: 400 }
      );
    }

    if (!isMerch && !condition) {
      return NextResponse.json(
        { error: 'Select a condition grade for this thrift piece.' },
        { status: 400 }
      );
    }

    const price = parseInt(priceStr, 10);
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: 'Price must be a valid positive number.' },
        { status: 400 }
      );
    }

    const stock = stockStr ? parseInt(stockStr, 10) : NaN;
    if (isNaN(stock) || stock < 0) {
      return NextResponse.json(
        { error: 'Stock must be a non-negative integer.' },
        { status: 400 }
      );
    }
    // 1-of-1 invariant (audit F-11): thrift pieces can only be 0 or 1. The DB
    // backstops this with the products_thrift_one_of_one CHECK constraint.
    if (!isMerch && stock > 1) {
      return NextResponse.json(
        { error: 'One-of-one thrift pieces can only have stock 0 or 1.' },
        { status: 400 }
      );
    }

    // Strip blank values so the storefront never shows an empty measurement
    // row; an all-blank object becomes null (audit F-22).
    let measurements: Record<string, unknown> | null = null;
    if (measurementsRaw) {
      try {
        const parsed = JSON.parse(measurementsRaw) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          const cleaned = Object.fromEntries(
            Object.entries(parsed).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
          );
          measurements = Object.keys(cleaned).length > 0 ? cleaned : null;
        }
      } catch {
        measurements = null;
      }
    }

    let sizes: string[] | null = null;
    if (sizesRaw) {
      try {
        sizes = JSON.parse(sizesRaw);
      } catch {
        sizes = sizesRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    if (isMerch && (!sizes || sizes.length === 0)) {
      return NextResponse.json(
        { error: 'Select at least one available size for this merch item.' },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const slug = generateSlug(name);

    // Handle image file uploads to Supabase Storage
    const imageUrls: string[] = [];
    const imageFiles = formData.getAll('images') as File[];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const originalExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(originalExt) ? originalExt : 'jpg';
        const fileName = `${slug}-${i + 1}-${Date.now()}.${ext}`;

        const { error: uploadError } = await serviceClient.storage
          .from('products')
          .upload(fileName, buffer, {
            contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            upsert: true,
          });

        if (uploadError) {
          console.error(`[uploadError] Failed uploading ${fileName}:`, uploadError);
        } else {
          const { data: { publicUrl } } = serviceClient.storage
            .from('products')
            .getPublicUrl(fileName);
          imageUrls.push(publicUrl);
        }
      }
    }

    // Insert new product row
    const { data: newProduct, error: insertError } = await serviceClient
      .from('products')
      .insert({
        slug,
        name,
        brand,
        category,
        subcategory: subcategory || null,
        is_featured: isFeatured,
        price_pkr: price,
        condition: isMerch ? null : condition,
        is_merch: isMerch,
        size: isMerch ? null : size,
        stock,
        images: imageUrls,
        description,
        measurements,
        sizes: isMerch ? sizes : null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[/api/admin/products] DB insert error:', insertError);
      return NextResponse.json(
        { error: `Failed to save product: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, product: newProduct });
  } catch (err) {
    console.error('[/api/admin/products] Unexpected error:', err);
    return NextResponse.json(
      { error: errorMessage(err, 'Failed to create product') },
      { status: 500 }
    );
  }
}
