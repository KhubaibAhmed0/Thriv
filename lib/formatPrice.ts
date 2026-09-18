/**
 * formatPrice — converts a numeric PKR amount to "Rs 1,299" display format.
 * Used everywhere a price is rendered. Do not format prices inline.
 */
export function formatPrice(amount: number): string {
  return `Rs ${amount.toLocaleString('en-PK')}`;
}
