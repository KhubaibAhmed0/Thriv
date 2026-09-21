import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';

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
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
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
    const condition = formData.get('condition')?.toString().trim() || 'Premium';
    const priceStr = formData.get('price')?.toString().trim();
    const isMerch = formData.get('isMerch') === 'true';
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

    const price = parseInt(priceStr, 10);
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: 'Price must be a valid positive number.' },
        { status: 400 }
      );
    }

    const stock = stockStr ? parseInt(stockStr, 10) : 1;

    let measurements: any = null;
    if (measurementsRaw) {
      try {
        measurements = JSON.parse(measurementsRaw);
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
        price_pkr: price,
        condition: isMerch ? null : condition,
        is_merch: isMerch,
        size: isMerch ? null : size,
        sizes: isMerch ? (sizes && sizes.length > 0 ? sizes : ['S', 'M', 'L', 'XL']) : null,
        stock: isNaN(stock) ? 1 : stock,
        images: imageUrls,
        description,
        measurements,
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
  } catch (err: any) {
    console.error('[/api/admin/products] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
