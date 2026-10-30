import { storage } from "@/server/storage/storage";

// Serves uploaded product images. Keys contain a random UUID and are never
// reused, so browsers and CDNs may cache them forever.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/media/[...key]">,
) {
  const key = (await params).key.join("/");

  // Only processed product images are ever served from here.
  if (!/^stores\/[a-z0-9]+\/products\/[a-f0-9-]+\.webp$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  const file = await storage.get(key);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      // Stops browsers from guessing a different type (e.g. treating it as HTML).
      "X-Content-Type-Options": "nosniff",
    },
  });
}
