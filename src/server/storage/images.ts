import "server-only";
import sharp from "sharp";
import { RuleViolationError } from "../errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);
const MAX_DIMENSION = 2000;

export type ProcessedImage = { data: Buffer; width: number; height: number };

/**
 * Turns an uploaded file (a product photo or a storefront picture) into a
 * safe, web-ready WebP image.
 *
 * We never trust the file name or the browser's content type. Instead sharp
 * decodes the actual bytes: anything that isn't a real JPEG/PNG/WebP/AVIF is
 * rejected. Re-encoding also strips metadata (such as GPS location in phone
 * photos) and destroys any hidden payload in a file pretending to be an image.
 */
export async function processUploadedImage(
  upload: Buffer,
): Promise<ProcessedImage> {
  if (upload.byteLength === 0) {
    throw new RuleViolationError("The file is empty.");
  }
  if (upload.byteLength > MAX_UPLOAD_BYTES) {
    throw new RuleViolationError("Images must be 5 MB or smaller.");
  }

  // limitInputPixels stops "decompression bombs": tiny files that expand to
  // enormous images and exhaust server memory.
  const image = sharp(upload, {
    limitInputPixels: 40_000_000,
    failOn: "error",
  });

  let format: string | undefined;
  try {
    format = (await image.metadata()).format;
  } catch {
    throw new RuleViolationError("That file isn't a valid image.");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new RuleViolationError("Upload a JPEG, PNG, WebP or AVIF image.");
  }

  const { data, info } = await image
    .rotate() // apply the camera's orientation before metadata is stripped
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}
