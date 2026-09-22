import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';

const UpdateStatusSchema = z.object({
  status: z
    .enum(['new', 'confirmed', 'shipped', 'dispatched', 'delivered', 'cancelled'])
    .optional(),
  payment_status: z.enum(['unpaid', 'paid', 'refunded']).optional(),
  note: z.string().max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderNumber } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status: rawStatus, payment_status, note } = parsed.data;

    // Normalize 'dispatched' to 'shipped' for database enum compatibility
    const status = rawStatus === 'dispatched' ? 'shipped' : rawStatus;

    if (!status && !payment_status) {
      return NextResponse.json(
        { error: 'Provide either status or payment_status to update.' },
        { status: 400 }
      );
    }

    if (!isServiceConfigured()) {
      return NextResponse.json(
        { error: 'Supabase service client not configured.' },
        { status: 503 }
      );
    }

    const supabase = getServiceClient();

    // 1. Fetch current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, payment_status')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (fetchError || !currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updatePayload: Record<string, any> = {};

    // 2. Handle order status change
    if (status && status !== currentOrder.status) {
      updatePayload.status = status;
      if (status === 'delivered') {
        updatePayload.delivered_at = new Date().toISOString();
      }
    }

    // 3. Handle payment status change
    if (payment_status && payment_status !== currentOrder.payment_status) {
      updatePayload.payment_status = payment_status;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', currentOrder.id);

      if (updateError) {
        console.error('[/api/admin/orders/.../status] Update failed:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // If status changed, record order_event and sync product stock
      if (status && status !== currentOrder.status) {
        await supabase.from('order_events').insert({
          order_id: currentOrder.id,
          from_status: currentOrder.status,
          to_status: status,
          note: note || `Status updated to ${status}`,
          created_by: auth.user?.id !== 'dev-admin' ? auth.user?.id : null,
        });

        // 4. Update product stock on dispatch ('shipped' | 'delivered') or cancellation
        try {
          const { data: items } = await supabase
            .from('order_items')
            .select('product_id, product_slug, quantity')
            .eq('order_id', currentOrder.id);

          if (items && items.length > 0) {
            if (status === 'shipped' || status === 'delivered') {
              // Mark product as sold out (stock = 0)
              for (const item of items) {
                if (item.product_id) {
                  await supabase
                    .from('products')
                    .update({ stock: 0 })
                    .eq('id', item.product_id);
                } else if (item.product_slug) {
                  await supabase
                    .from('products')
                    .update({ stock: 0 })
                    .eq('slug', item.product_slug);
                }
              }
            } else if (status === 'cancelled') {
              // If order is cancelled, restore stock
              for (const item of items) {
                const filterCol = item.product_id ? 'id' : 'slug';
                const filterVal = item.product_id || item.product_slug;
                if (filterVal) {
                  const { data: prod } = await supabase
                    .from('products')
                    .select('id, stock, is_merch')
                    .eq(filterCol, filterVal)
                    .maybeSingle();

                  if (prod) {
                    const restoredStock = prod.is_merch ? prod.stock + (item.quantity || 1) : 1;
                    await supabase
                      .from('products')
                      .update({ stock: restoredStock })
                      .eq('id', prod.id);
                  }
                }
              }
            }
          }
        } catch (stockErr) {
          console.error('[/api/admin/orders/.../status] Product stock sync failed:', stockErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      order_number: orderNumber,
      status: status || currentOrder.status,
      payment_status: payment_status || currentOrder.payment_status,
    });
  } catch (err: any) {
    console.error('[/api/admin/orders/.../status] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
