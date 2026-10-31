import { z } from "zod";

const requiredText = (max: number) =>
  z.string().trim().min(1, "Required").max(max);

export const shippingAddressSchema = z.object({
  name: requiredText(100),
  line1: requiredText(200),
  line2: z.string().trim().max(200).default(""),
  city: requiredText(100),
  region: z.string().trim().max(100).default(""),
  postalCode: requiredText(20),
  country: z.string().trim().toUpperCase().length(2, "Choose a country"),
  phone: z.string().trim().max(30).default(""),
});

export type ShippingAddress = z.output<typeof shippingAddressSchema>;

export const checkoutSchema = z.object({
  email: z.email("Enter a valid email").max(200),
  address: shippingAddressSchema,
  saveAddress: z.boolean().default(false),
  // Checked against the store's discounts on the server; empty means none.
  discountCode: z.string().trim().max(30).default(""),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
