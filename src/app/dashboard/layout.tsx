import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/server/auth/session";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Storefront Studio
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-stone-600 sm:inline">
            {user.name}
          </span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
