import {
  CreateBucketCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "vitest";
import { S3Storage } from "@/server/storage/storage";

// Runs against any S3-compatible server. Locally and in CI that's Adobe's
// S3Mock, a small S3 emulator:
//   docker run --rm -p 127.0.0.1:9010:9090 adobe/s3mock:4.4.0
//   S3_TEST_ENDPOINT=http://127.0.0.1:9010 npx vitest run tests/integration/s3-storage.test.ts
// Skipped when S3_TEST_ENDPOINT isn't set.
const endpoint = process.env.S3_TEST_ENDPOINT;
const bucket = "storage-driver-test";

describe.skipIf(!endpoint)("S3Storage", () => {
  const client = new S3Client({
    endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? "test",
    },
  });
  const storage = new S3Storage(client, bucket);

  beforeAll(async () => {
    await client
      .send(new CreateBucketCommand({ Bucket: bucket }))
      .catch((error: { name?: string }) => {
        if (error.name !== "BucketAlreadyOwnedByYou") throw error;
      });
  });

  it("stores, reads back and deletes a file", async () => {
    const key = `stores/abc/products/${crypto.randomUUID()}.webp`;
    await storage.put(key, Buffer.from("image bytes"));

    expect((await storage.get(key))?.toString()).toBe("image bytes");
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    expect(head.ContentType).toBe("image/webp");

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it("returns null for a missing file", async () => {
    expect(await storage.get("stores/abc/products/missing.webp")).toBeNull();
  });

  it("refuses keys that could escape their folder", async () => {
    await expect(
      storage.put("../secrets.webp", Buffer.from("x")),
    ).rejects.toThrow("Unsafe storage key");
  });
});
