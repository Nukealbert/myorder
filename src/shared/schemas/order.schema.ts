import { z } from 'zod';

export const OrderSchema = z.object({
  external_order_id: z.string().regex(/^\d{3}-\d{7}-\d{7}$/, 'Order ID must be in format 000-0000000-0000000'),
  customer_name: z.string().min(1, 'Customer name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  pin_code: z.string().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
  address: z.string().min(5, 'Address is too short'),
  order_date: z.string().min(1, 'Order date is required'),
  page_number: z.number().int().positive()
});

export type OrderInput = z.infer<typeof OrderSchema>;
