import type { Metadata } from "next";
import { CreateStoreForm } from "./create-store-form";

export const metadata: Metadata = { title: "Create a store" };

export default function NewStorePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">Create a store</h1>
      <p className="mt-1 mb-8 text-sm text-stone-600">
        You can change everything except the store address later.
      </p>
      <CreateStoreForm />
    </main>
  );
}
