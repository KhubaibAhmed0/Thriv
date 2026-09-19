import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project')
  );
};

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return supabaseInstance;
}

export interface DbOrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  product_name: string;
  brand: string;
  price: number;
  quantity: number;
  selected_size?: string | null;
  is_merch?: boolean;
  image_url?: string | null;
}

export interface DbOrder {
  id: string;
  order_number: string;
  customer_name: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  province: string;
  notes?: string | null;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at?: string;
  items?: DbOrderItem[];
}

/**
 * Persists an order and its line items to Supabase PostgreSQL.
 * If Supabase is not configured, returns success: false with a note (checkout still proceeds).
 */
export async function createOrderInSupabase(orderData: {
  orderNumber: string;
  customerName: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  province: string;
  notes?: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: Array<{
    product: {
      id: string;
      name: string;
      brand: string;
      price: number;
      isMerch: boolean;
      images: string[];
    };
    quantity: number;
    selectedSize?: string;
  }>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn(
      '[Supabase] Environment variables not configured. Order was processed locally without database persistence.'
    );
    return { success: false, error: 'Supabase credentials not configured' };
  }

  try {
    // 1. Insert order
    const { data: orderRecord, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderData.orderNumber,
        customer_name: orderData.customerName,
        whatsapp: orderData.whatsapp,
        email: orderData.email,
        address: orderData.address,
        city: orderData.city,
        province: orderData.province,
        notes: orderData.notes || null,
        payment_method: orderData.paymentMethod,
        subtotal: orderData.subtotal,
        delivery_fee: orderData.deliveryFee,
        total: orderData.total,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderError || !orderRecord) {
      console.error('[Supabase] Failed to insert order:', orderError);
      return { success: false, error: orderError?.message || 'Failed to insert order' };
    }

    const orderId = orderRecord.id;

    // 2. Insert line items
    const lineItems = orderData.items.map((item) => ({
      order_id: orderId,
      product_id: item.product.id,
      product_name: item.product.name,
      brand: item.product.brand,
      price: item.product.price,
      quantity: item.quantity,
      selected_size: item.selectedSize || null,
      is_merch: item.product.isMerch || false,
      image_url: item.product.images?.[0] || null,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(lineItems);

    if (itemsError) {
      console.error('[Supabase] Failed to insert order items:', itemsError);
      // Order is already created, so return id but log warning
      return { success: true, id: orderId, error: itemsError.message };
    }

    return { success: true, id: orderId };
  } catch (err: any) {
    console.error('[Supabase] Unexpected error saving order:', err);
    return { success: false, error: err?.message || 'Unexpected database error' };
  }
}

/**
 * Fetches all orders with their line items, ordered by newest first.
 */
export async function getOrdersFromSupabase(): Promise<DbOrder[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Error fetching orders:', error);
    throw new Error(error.message);
  }

  return (data as DbOrder[]) || [];
}

/**
 * Updates the status of an order.
 */
export async function updateOrderStatusInSupabase(
  orderId: string,
  status: 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    console.error('[Supabase] Error updating order status:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
