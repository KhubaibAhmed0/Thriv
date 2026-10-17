/**
 * lib/admin-product-schema.ts
 *
 * Audit F-49: Zod schemas for the admin product endpoints. Unions mirror
 * types/index.ts and the AddProductForm options — free text can no longer
 * reach the enum/union columns (a bad `condition` used to be a raw
 * Postgres 22P02 → 500; a bad `category` was unconstrained).
 *
 * The FormData → object normalization lives in the POST route; these
 * schemas validate the normalized shape and produce field errors.
 */
import { z } from 'zod';

export const CATEGORY_VALUES = ['jeans', 'graphic-tees'] as const;
export const CONDITION_VALUES = ['Premium', 'Excellent', 'Very Good'] as const;
export const MERCH_SIZE_VALUES = ['S', 'M', 'L', 'XL'] as const;

/** Max photo size — Vercel rejects request bodies over 4.5 MB, so the app's
 *  own gate (4 MB combined, see the POST route) is set below that on
 *  purpose: the admin gets a clear 400 message instead of a platform 413.
 *  Also stays under the bucket's 5 MB per-file cap. (Audit F-53.) */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Defensive cap; the form UI offers 4. */
export const MAX_PRODUCT_PHOTOS = 8;

const PriceSchema = z
  .number({ message: 'Price must be a number of PKR' })
  .int('Price must be a whole number of PKR')
  .positive('Price must be greater than zero')
  .max(10_000_000, 'Price looks too large');

const StockSchema = z
  .number({ message: 'Stock must be a number' })
  .int('Stock must be a whole number')
  .min(0, 'Stock cannot be negative')
  .max(100_000, 'Stock looks too large');

const MeasurementsSchema = z
  .record(z.string().max(30), z.string().max(60))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** Normalized create payload (already parsed out of FormData). */
export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
    brand: z.string().trim().min(1, 'Brand is required').max(60, 'Brand is too long'),
    category: z.enum(CATEGORY_VALUES, { message: 'Pick a valid category' }),
    subcategory: z.string().trim().max(60, 'Subcategory is too long'),
    isMerch: z.boolean(),
    isFeatured: z.boolean(),
    condition: z.string().trim().max(40),
    price: PriceSchema,
    stock: StockSchema,
    size: z.string().trim().max(40, 'Size is too long'),
    sizes: z
      .array(z.enum(MERCH_SIZE_VALUES, { message: 'Sizes must be S, M, L or XL' }))
      .max(10)
      .nullable(),
    description: z.string().trim().max(3000, 'Description is too long'),
    measurements: MeasurementsSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.isMerch) {
      if (!value.condition) {
        ctx.addIssue({
          code: 'custom',
          path: ['condition'],
          message: 'Select a condition grade for this thrift piece.',
        });
      } else if (!(CONDITION_VALUES as readonly string[]).includes(value.condition)) {
        ctx.addIssue({
          code: 'custom',
          path: ['condition'],
          message: `Condition must be one of: ${CONDITION_VALUES.join(', ')}`,
        });
      }
      if (value.stock > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['stock'],
          message: 'One-of-one thrift pieces can only have stock 0 or 1.',
        });
      }
      if (!value.size) {
        ctx.addIssue({
          code: 'custom',
          path: ['size'],
          message: 'Enter the waist size.',
        });
      }
    } else if (!value.sizes || value.sizes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sizes'],
        message: 'Select at least one available size for this merch item.',
      });
    }
  });

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

/**
 * PATCH payload (JSON body from the edit modal / toggle buttons). Only
 * whitelisted keys are ever applied — unknown keys are ignored by the
 * route after parsing.
 */
export const UpdateProductSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(120, 'Name is too long').optional(),
  brand: z.string().trim().min(1, 'Brand cannot be empty').max(60, 'Brand is too long').optional(),
  condition: z.enum(CONDITION_VALUES, { message: 'Pick a valid condition grade' }).nullable().optional(),
  price_pkr: PriceSchema.optional(),
  stock: StockSchema.optional(),
  subcategory: z.string().trim().max(60, 'Subcategory is too long').nullable().optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

/**
 * Magic-byte sniff (F-53): JPEG (FF D8 FF), PNG (89 50 4E 47), WebP
 * (RIFF….WEBP). Client-supplied MIME types and extensions are not trusted.
 */
export function isRealImageFile(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png =
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const webp =
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50;
  return jpeg || png || webp;
}
