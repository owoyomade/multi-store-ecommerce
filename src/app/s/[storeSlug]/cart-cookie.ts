import "server-only";
import { cookies } from "next/headers";

// One cart cookie per store, so carts in different stores never mix.
function cookieName(storeId: string): string {
  return `cart_${storeId}`;
}

export async function readCartToken(storeId: string): Promise<string | null> {
  return (await cookies()).get(cookieName(storeId))?.value ?? null;
}

export async function writeCartToken(
  storeId: string,
  token: string,
): Promise<void> {
  (await cookies()).set(cookieName(storeId), token, {
    // httpOnly keeps the token away from JavaScript (and so from XSS); the
    // cart is only ever read on the server.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
