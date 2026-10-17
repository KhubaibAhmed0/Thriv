import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { errorMessage } from '@/lib/errors';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const serviceClient = getServiceClient();

    const allowedUpdates: Record<string, unknown> = {};
    if (typeof body.is_active === 'boolean') allowedUpdates.is_active = body.is_active;
    if (typeof body.stock === 'number') allowedUpdates.stock = body.stock;
    if (typeof body.price_pkr === 'number') allowedUpdates.price_pkr = body.price_pkr;
    // Audit F-10: subcategory / is_featured are now real columns and editable.
    if (typeof body.subcategory === 'string') allowedUpdates.subcategory = body.subcategory.trim() || null;
    if (typeof body.is_featured === 'boolean') allowedUpdates.is_featured = body.is_featured;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // 1-of-1 invariant (audit F-11): thrift pieces can only be in stock (1)
    // or sold out (0). The DB backstops this with a CHECK constraint
    // (products_thrift_one_of_one); validate here first for a clean message.
    if (typeof allowedUpdates.stock === 'number') {
      const stock = allowedUpdates.stock as number;
      if (!Number.isInteger(stock) || stock < 0) {
        return NextResponse.json(
          { error: 'Stock must be a non-negative integer' },
          { status: 400 }
        );
      }

      const { data: product, error: productError } = await serviceClient
        .from('products')
        .select('id, is_merch')
        .eq('id', id)
        .maybeSingle();

      if (productError) {
        return NextResponse.json({ error: productError.message }, { status: 500 });
      }
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      if (!product.is_merch && stock > 1) {
        return NextResponse.json(
          { error: 'One-of-one thrift pieces can only have stock 0 or 1.' },
          { status: 400 }
        );
      }
    }

    const { data: updated, error } = await serviceClient
      .from('products')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, 'Server error') }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  try {
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, 'Server error') }, { status: 500 });
  }
}
