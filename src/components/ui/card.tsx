import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-borda bg-superficie p-5 shadow-xs", className)}
      {...props}
    />
  );
}

export function CardTitulo({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-base font-semibold", className)} {...props} />;
}

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-fundo px-2 py-0.5 text-xs font-medium text-suave",
        className,
      )}
      {...props}
    />
  );
}
