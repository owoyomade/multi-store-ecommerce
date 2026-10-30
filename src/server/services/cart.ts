import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { NotFoundError, RuleViolationError } from "../errors";
import { availableToSell } from "./inventory";

// Carts are anonymous: the browser keeps a random token in a cookie and we
// store only its SHA-256 hash. All functions take the storeId of the
// storefront being viewed, so a token from one store can never open or add
// to a cart in another store.

export const MAX_QUANTITY_PER_LINE = 20;

const quantitySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_QUANTITY_PER_LINE);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function findCart(storeId: string, token: string | null) {
  if (!token) return null;
  return db.cart.findFirst({
    where: { storeId, tokenHash: hashToken(token) },
    select: { id: true },
  });
}

/**
 * Loads a variant a shopper may buy: it must belong to this store, be active,
 * and its product must be published. Returns how many units can be sold.
 */
async function findPurchasableVariant(storeId: string, variantId: string) {
  const variant = await db.productVariant.findFirst({
    where: {
      id: variantId,
      storeId,
      archivedAt: null,
      product: { status: "PUBLISHED", deletedAt: null },
    },
    select: {
      id: true,
      trackInventory: true,
      inventoryLevels: { select: { onHand: true, reserved: true } },
    },
  });
  if (!variant) throw new NotFoundError("Product");
  return {
    id: variant.id,
    available: availableToSell(variant, variant.inventoryLevels),
  };
}

function assertQuantityAvailable(quantity: number, available: number): void {
  if (available <= 0)
    throw new RuleViolationError("Sorry, this item is sold out.");
  if (quantity > available) {
    throw new RuleViolationError(`Only ${available} left in stock.`);
  }
}

/**
 * Adds a variant to the cart, creating the cart if the shopper doesn't have one.
 * Returns the cart token when a new cart was created, so the caller can set the cookie.
 */
export async function addToCart(
  storeId: string,
  token: string | null,
  variantId: string,
  quantityInput: number,
): Promise<{ newToken: string | null }> {
  const quantity = quantitySchema.parse(quantityInput);
  const variant = await findPurchasableVariant(storeId, variantId);

  let cart = await findCart(storeId, token);
  let newToken: string | null = null;
  if (!cart) {
    newToken = randomBytes(32).toString("base64url");
    cart = await db.cart.create({
      data: { storeId, tokenHash: hashToken(newToken) },
      select: { id: true },
    });
  }

  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    select: { quantity: true },
  });
  const nextQuantity = Math.min(
    (existing?.quantity ?? 0) + quantity,
    MAX_QUANTITY_PER_LINE,
  );
  assertQuantityAvailable(nextQuantity, variant.available);

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    update: { quantity: nextQuantity },
    create: { cartId: cart.id, variantId: variant.id, quantity: nextQuantity },
  });
  return { newToken };
}

export async function updateCartItemQuantity(
  storeId: string,
  token: string | null,
  itemId: string,
  quantityInput: number,
): Promise<void> {
  const quantity = quantitySchema.parse(quantityInput);
  const cart = await findCart(storeId, token);
  if (!cart) throw new NotFoundError("Cart");

  const item = await db.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    select: { variantId: true },
  });
  if (!item) throw new NotFoundError("Cart item");

  const variant = await findPurchasableVariant(storeId, item.variantId);
  assertQuantityAvailable(quantity, variant.available);
  await db.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

export async function removeCartItem(
  storeId: string,
  token: string | null,
  itemId: string,
): Promise<void> {
  const cart = await findCart(storeId, token);
  if (!cart) return;
  // deleteMany scoped to this cart: an item ID from someone else's cart deletes nothing.
  await db.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
}

export type CartLine = {
  id: string;
  quantity: number;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  unitPriceCents: number;
  lineTotalCents: number;
  image: { storageKey: string; altText: string } | null;
  // Set when the item can no longer be bought as-is (unpublished, sold out, or fewer left).
  problem: string | null;
};

/**
 * The cart with *current* catalog prices. Prices are never stored in the cart,
 * so this is always what the shopper would pay right now.
 */
export async function getCart(storeId: string, token: string | null) {
  const cart = await findCart(storeId, token);
  if (!cart) return { lines: [] as CartLine[], itemCount: 0, subtotalCents: 0 };

  const items = await db.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      quantity: true,
      variant: {
        select: {
          title: true,
          priceCents: true,
          trackInventory: true,
          archivedAt: true,
          inventoryLevels: { select: { onHand: true, reserved: true } },
          product: {
            select: {
              title: true,
              slug: true,
              status: true,
              deletedAt: true,
              images: {
                orderBy: { position: "asc" },
                take: 1,
                select: { storageKey: true, altText: true },
              },
            },
          },
        },
      },
    },
  });

  const lines: CartLine[] = items.map(({ id, quantity, variant }) => {
    const { product } = variant;
    const purchasable =
      product.status === "PUBLISHED" &&
      !product.deletedAt &&
      !variant.archivedAt;
    const available = availableToSell(variant, variant.inventoryLevels);

    let problem: string | null = null;
    if (!purchasable) problem = "No longer available";
    else if (available <= 0) problem = "Sold out";
    else if (quantity > available) problem = `Only ${available} left`;

    return {
      id,
      quantity,
      productTitle: product.title,
      productSlug: product.slug,
      variantTitle: variant.title,
      unitPriceCents: variant.priceCents,
      lineTotalCents: variant.priceCents * quantity,
      image: product.images[0] ?? null,
      problem,
    };
  });

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents: lines
      .filter((line) => !line.problem)
      .reduce((sum, line) => sum + line.lineTotalCents, 0),
  };
}
