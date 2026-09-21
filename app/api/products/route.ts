import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/products-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getAllProducts();
    return NextResponse.json({ products });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load products' }, { status: 500 });
  }
}
