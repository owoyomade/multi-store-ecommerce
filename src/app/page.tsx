import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-amber-700">Storefront Studio</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        Run every store you own from one dashboard.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-stone-600">
        Create a branded storefront, invite your team with the right
        permissions, and keep each store&apos;s products, orders and customers
        completely separate.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/sign-up" className={buttonClasses()}>
          Create an account
        </Link>
        <Link href="/sign-in" className={buttonClasses("secondary")}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
