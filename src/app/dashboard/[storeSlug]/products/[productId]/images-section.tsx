import Image from "next/image";
import { deleteProductImageAction } from "../actions";
import { ImageUploadForm } from "./image-upload-form";

type ProductImage = {
  id: string;
  storageKey: string;
  altText: string;
  width: number;
  height: number;
};

type ImagesSectionProps = {
  storeSlug: string;
  productId: string;
  images: ProductImage[];
  canAddMore: boolean;
};

export function ImagesSection({
  storeSlug,
  productId,
  images,
  canAddMore,
}: ImagesSectionProps) {
  return (
    <section
      aria-labelledby="images-heading"
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
    >
      <h2 id="images-heading" className="font-semibold">
        Images
      </h2>
      {images.length === 0 ? (
        <p className="text-sm text-stone-600">
          No images yet. Products with photos sell much better.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="space-y-2">
              <Image
                src={`/media/${image.storageKey}`}
                alt={image.altText}
                width={image.width}
                height={image.height}
                sizes="(min-width: 640px) 25vw, 50vw"
                className="aspect-square w-full rounded-lg border border-stone-200 object-cover"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">
                  {index === 0 ? "Main image" : `Image ${index + 1}`}
                </span>
                <form
                  action={deleteProductImageAction.bind(
                    null,
                    storeSlug,
                    productId,
                    image.id,
                  )}
                >
                  <button type="submit" className="text-red-700 underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canAddMore ? (
        <ImageUploadForm storeSlug={storeSlug} productId={productId} />
      ) : (
        <p className="text-sm text-stone-600">
          This product has the maximum number of images.
        </p>
      )}
    </section>
  );
}
