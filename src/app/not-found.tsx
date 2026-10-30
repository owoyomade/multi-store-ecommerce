import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-stone-600">
        It may have moved, or you may not have access to it.
      </p>
      <Link href="/dashboard" className="mt-6 text-sm font-medium underline">
        Go to your stores
      </Link>
    </main>
  );
}
