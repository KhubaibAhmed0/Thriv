import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/products-db';
import { errorMessage } from '@/lib/errors';

// Static GET cached with ISR. Catalogue mutations invalidate it on demand
// (lib/revalidate.ts); direct DB edits heal within the 60s window.
export const revalidate = 60;

export async function GET() {
  try {
    const products = await getAllProducts();
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, 'Failed to load products') }, { status: 500 });
  }
}
