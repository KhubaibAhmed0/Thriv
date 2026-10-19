import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { UpdateProductSchema } from '@/lib/admin-product-schema';
import { originAllowed, requestId } from '@/lib/api-guard';
import { writeAudit } from '@/lib/audit';
import { revalidateCatalog } from '@/lib/revalidate';
import { securityLog } from '@/lib/security-log';
import { log } from '@/lib/log';

/** Public URL prefix for the `products` bucket. */
const PUBLIC_MARKER = '/storage/v1/object/public/products/';

/**
 * Extract storage object paths from the product's `images` array so the
 * DELETE handler can remove the files alongside the row (audit F-52).
 * Non-matching URLs are ignored; `..` is rejected (defence in depth).
 */
function storageObjectPaths(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((u): u is string => typeof u === 'string')
    .map((url) => {
      const i = url.indexOf(PUBLIC_MARKER);
      if (i === -1) return null;
      const path = url.slice(i + PUBLIC_MARKER.length).split('?')[0];
      try {
        return decodeURIComponent(path);
      } catch {
        return path;
      }
    })
    .filter((p): p is string => p !== null && !p.includes('..'));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rid = requestId();
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Phase 4: state-changing route — reject cross-origin browser calls.
  if (!originAllowed(req)) {
    securityLog('admin.origin_blocked', { route: 'products.update' });
    return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Audit F-49: Zod-validated whitelist (the edit modal + toggle buttons
    // send exactly these keys; anything else is ignored).
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const updates = parsed.data;
    const serviceClient = getServiceClient();

    const allowedUpdates: Record<string, unknown> = {};
    if (updates.is_active !== undefined) allowedUpdates.is_active = updates.is_active;
    if (updates.is_featured !== undefined) allowedUpdates.is_featured = updates.is_featured;
    if (updates.stock !== undefined) allowedUpdates.stock = updates.stock;
    if (updates.price_pkr !== undefined) allowedUpdates.price_pkr = updates.price_pkr;
    // Audit F-10: subcategory / is_featured are real columns and editable.
    if (updates.subcategory !== undefined) {
      allowedUpdates.subcategory = updates.subcategory?.trim() || null;
    }
    // Audit F-39: typo fixes (name/brand/grade) no longer require delete +
    // recreate, which used to break every existing link to the piece.
    if (updates.name !== undefined) allowedUpdates.name = updates.name;
    if (updates.brand !== undefined) allowedUpdates.brand = updates.brand;
    if (updates.condition !== undefined) allowedUpdates.condition = updates.condition;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // 1-of-1 invariant (audit F-11): thrift pieces can only be in stock (1)
    // or sold out (0). The DB backstops this with a CHECK constraint
    // (products_thrift_one_of_one); validate here first for a clean message.
    if (typeof allowedUpdates.stock === 'number') {
      const stock = allowedUpdates.stock as number;

      const { data: product, error: productError } = await serviceClient
        .from('products')
        .select('id, is_merch')
        .eq('id', id)
        .maybeSingle();

      if (productError) {
        log.error('[/api/admin/products/[id]] lookup failed:', productError.message);
        return NextResponse.json(
          { error: 'Failed to update product', request_id: rid },
          { status: 500 }
        );
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
      // F-41: raw detail to the server log only.
      log.error('[/api/admin/products/[id]] DB update error:', error.message);
      return NextResponse.json(
        { error: 'Failed to update product', request_id: rid },
        { status: 500 }
      );
    }

    securityLog('admin.product.update', {
      adminId: auth.user?.id,
      id,
      fields: Object.keys(allowedUpdates),
    });

    await writeAudit({
      actorId: auth.user?.id ?? null,
      action: 'product.update',
      entity: 'products',
      entityId: id,
      before: null,
      after: allowedUpdates,
    });

    // Price/stock/visibility changes must reach the ISR-cached catalogue
    // surfaces (home, shop, product pages, public API, sitemap) now.
    revalidateCatalog();

    return NextResponse.json({ success: true, product: updated });
  } catch (err) {
    log.error('[/api/admin/products/[id]] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to update product', request_id: rid },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rid = requestId();
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Phase 4: state-changing route — reject cross-origin browser calls.
  if (!originAllowed(req)) {
    securityLog('admin.origin_blocked', { route: 'products.delete' });
    return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
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

    // Fetch first so we know which storage objects to remove (audit F-52:
    // deleting the row used to leave its photos orphaned in the bucket).
    const { data: product, error: fetchError } = await serviceClient
      .from('products')
      .select('id, slug, images')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      log.error('[/api/admin/products/[id]] lookup failed:', fetchError.message);
      return NextResponse.json(
        { error: 'Failed to delete product', request_id: rid },
        { status: 500 }
      );
    }
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const { error } = await serviceClient.from('products').delete().eq('id', id);

    if (error) {
      log.error('[/api/admin/products/[id]] DB delete error:', error.message);
      return NextResponse.json(
        { error: 'Failed to delete product', request_id: rid },
        { status: 500 }
      );
    }

    // Storage cleanup — best effort, reported in the response. A leftover
    // object is recoverable; failing the request after the row is gone is not.
    const paths = storageObjectPaths(product.images);
    let removed = 0;
    let failed = 0;
    if (paths.length > 0) {
      const { data: removedData, error: removeError } = await serviceClient.storage
        .from('products')
        .remove(paths);
      if (removeError) {
        log.error('[/api/admin/products/[id]] storage cleanup failed:', removeError.message);
        failed = paths.length;
      } else {
        removed = removedData?.length ?? paths.length;
        failed = paths.length - removed;
      }
    }

    securityLog('admin.product.delete', {
      adminId: auth.user?.id,
      id,
      slug: product.slug,
      objectsRemoved: removed,
      objectsFailed: failed,
    });

    await writeAudit({
      actorId: auth.user?.id ?? null,
      action: 'product.delete',
      entity: 'products',
      entityId: id,
      before: { slug: product.slug, objects: paths.length },
      after: null,
    });

    // Drop the deleted piece from the ISR-cached catalogue surfaces (its
    // product page re-renders to a 404 on the next request).
    revalidateCatalog();

    return NextResponse.json({
      success: true,
      deletedId: id,
      storage: { removed, failed },
    });
  } catch (err) {
    log.error('[/api/admin/products/[id]] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to delete product', request_id: rid },
      { status: 500 }
    );
  }
}
