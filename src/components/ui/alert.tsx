import type { ReactNode } from "react";

type AlertTone = "error" | "success" | "info";

const toneClasses: Record<AlertTone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-stone-200 bg-white text-stone-700",
};

export function Alert({
  tone,
  children,
}: {
  tone: AlertTone;
  children: ReactNode;
}) {
  // role="alert" makes screen readers announce errors as soon as they appear.
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}
