import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-stone-900 text-white hover:bg-stone-700",
  secondary:
    "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
};

export function buttonClasses(variant: ButtonVariant = "primary"): string {
  return `inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  pending?: boolean;
  pendingLabel?: string;
};

export function Button({
  variant = "primary",
  pending = false,
  pendingLabel,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${buttonClasses(variant)} ${className}`}
      disabled={pending || props.disabled}
      aria-busy={pending}
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
