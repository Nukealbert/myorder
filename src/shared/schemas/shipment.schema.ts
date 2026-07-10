import { z } from 'zod';

export const ShipmentSchema = z.object({
  batch_id: z.number().int().positive(),
  order_id: z.number().int().positive(),
  post_id: z.string().regex(/^[A-Z]{2}\d{9}IN$/i, 'Post ID must be a valid India Post ID (e.g. CB138381160IN)'),
  weight_grams: z.number().int().positive('Weight must be a positive integer in grams'),
  post_office: z.string().min(1, 'Post office is required'),
  district: z.string().min(1, 'District is required'),
  state: z.string().min(1, 'State is required')
});

export type ShipmentInput = z.infer<typeof ShipmentSchema>;
