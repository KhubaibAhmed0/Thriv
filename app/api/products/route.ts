import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/products-db';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getAllProducts();
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, 'Failed to load products') }, { status: 500 });
  }
}
