import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getServiceClient, isServiceConfigured } from '@/lib/supabase-server';
import { originAllowed, requestId } from '@/lib/api-guard';
import { writeAudit } from '@/lib/audit';
import { securityLog } from '@/lib/security-log';
import { log } from '@/lib/log';

const UpdateStatusSchema = z.object({
  status: z
    .enum(['new', 'confirmed', 'shipped', 'dispatched', 'delivered', 'cancelled'])
    .optional(),
  payment_status: z.enum(['unpaid', 'paid', 'refunded']).optional(),
  note: z.string().max(300).optional(),
  // Audit F-79: dispatch details can be saved on their own or alongside a
  // status change.
  tracking_number: z.string().max(80).optional(),
  courier: z.string().max(60).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const rid = requestId();
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Phase 4: state-changing routes reject cross-origin browser calls.
    if (!originAllowed(req)) {
      securityLog('admin.origin_blocked', { route: 'orders.status' });
      return NextResponse.json({ error: 'Request blocked.' }, { status: 403 });
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

    const { status: rawStatus, payment_status, note, tracking_number, courier } = parsed.data;

    // Normalize 'dispatched' to 'shipped' for database enum compatibility
    const status = rawStatus === 'dispatched' ? 'shipped' : rawStatus;

    if (
      !status &&
      !payment_status &&
      tracking_number === undefined &&
      courier === undefined
    ) {
      return NextResponse.json(
        { error: 'Provide a status, a payment_status, or dispatch details to update.' },
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

    // 1. Fetch current order (also the 404 gate)
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, payment_status')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (fetchError || !currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Order status change. All transition rules, stock effects and the
    //    order_events row live inside update_order_status() (audit F-04/F-12),
    //    so this route can never write stock or an invalid transition again.
    if (status && status !== currentOrder.status) {
      const { error: rpcError } = await supabase.rpc('update_order_status', {
        p_order_number: orderNumber,
        p_new_status: status,
        p_note: note ?? null,
        p_actor: auth.user?.id ?? null,
      });

      if (rpcError) {
        if (rpcError.code === 'P0002') {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        if (rpcError.code === 'P0001') {
          // Transition guard raised by our own RPC — message is curated.
          return NextResponse.json({ error: rpcError.message }, { status: 409 });
        }
        log.error('[/api/admin/orders/.../status] update_order_status failed:', rpcError);
        return NextResponse.json(
          { error: 'Status update failed', request_id: rid },
          { status: 500 }
        );
      }

      securityLog('admin.order.status', {
        adminId: auth.user?.id,
        orderNumber,
        from: currentOrder.status,
        to: status,
      });

      await writeAudit({
        actorId: auth.user?.id ?? null,
        action: 'order.status',
        entity: 'orders',
        entityId: currentOrder.id,
        before: { status: currentOrder.status },
        after: { status },
      });
    }

    // 3. Payment status is independent of fulfillment state.
    if (payment_status && payment_status !== currentOrder.payment_status) {
      const { error: payError } = await supabase
        .from('orders')
        .update({ payment_status })
        .eq('id', currentOrder.id);

      if (payError) {
        log.error('[/api/admin/orders/.../status] Payment update failed:', payError);
        return NextResponse.json(
          { error: 'Payment update failed', request_id: rid },
          { status: 500 }
        );
      }

      securityLog('admin.order.payment', {
        adminId: auth.user?.id,
        orderNumber,
        from: currentOrder.payment_status,
        to: payment_status,
      });

      await writeAudit({
        actorId: auth.user?.id ?? null,
        action: 'order.payment_status',
        entity: 'orders',
        entityId: currentOrder.id,
        before: { payment_status: currentOrder.payment_status },
        after: { payment_status },
      });
    }

    // 4. Dispatch details (audit F-79): courier + tracking number are stored
    //    independently of the fulfillment state so they can be corrected.
    const dispatchUpdates: Record<string, unknown> = {};
    if (tracking_number !== undefined) {
      dispatchUpdates.tracking_number = tracking_number.trim() || null;
    }
    if (courier !== undefined) {
      dispatchUpdates.courier = courier.trim() || null;
    }
    if (Object.keys(dispatchUpdates).length > 0) {
      const { error: dispatchError } = await supabase
        .from('orders')
        .update(dispatchUpdates)
        .eq('id', currentOrder.id);

      if (dispatchError) {
        log.error('[/api/admin/orders/.../status] Dispatch update failed:', dispatchError);
        return NextResponse.json(
          { error: 'Dispatch update failed', request_id: rid },
          { status: 500 }
        );
      }

      securityLog('admin.order.dispatch', {
        adminId: auth.user?.id,
        orderNumber,
        fields: Object.keys(dispatchUpdates),
      });

      await writeAudit({
        actorId: auth.user?.id ?? null,
        action: 'order.dispatch',
        entity: 'orders',
        entityId: currentOrder.id,
        before: null,
        after: dispatchUpdates,
      });
    }

    return NextResponse.json({
      success: true,
      order_number: orderNumber,
      status: status || currentOrder.status,
      payment_status: payment_status || currentOrder.payment_status,
      ...(tracking_number !== undefined
        ? { tracking_number: dispatchUpdates.tracking_number }
        : {}),
      ...(courier !== undefined ? { courier: dispatchUpdates.courier } : {}),
    });
  } catch (err) {
    log.error('[/api/admin/orders/.../status] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', request_id: rid },
      { status: 500 }
    );
  }
}
