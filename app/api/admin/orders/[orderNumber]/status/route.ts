import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';

const UpdateStatusSchema = z.object({
  status: z
    .enum(['new', 'confirmed', 'shipped', 'delivered', 'cancelled'])
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

    const { status, payment_status, note } = parsed.data;

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

      // If status changed, record order_event
      if (status && status !== currentOrder.status) {
        await supabase.from('order_events').insert({
          order_id: currentOrder.id,
          from_status: currentOrder.status,
          to_status: status,
          note: note || `Status updated to ${status}`,
          created_by: auth.user?.id !== 'dev-admin' ? auth.user?.id : null,
        });
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
