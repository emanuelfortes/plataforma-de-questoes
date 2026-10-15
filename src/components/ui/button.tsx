import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const variantesBotao = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca",
  {
    variants: {
      variante: {
        padrao: "bg-marca text-white hover:bg-marca-forte",
        contorno: "border border-borda bg-superficie hover:bg-fundo",
        fantasma: "hover:bg-borda/50",
      },
      tamanho: {
        padrao: "h-10 px-4",
        pequeno: "h-8 px-3 text-xs",
        grande: "h-11 px-6",
      },
    },
    defaultVariants: { variante: "padrao", tamanho: "padrao" },
  },
);

export function Button({
  className,
  variante,
  tamanho,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof variantesBotao>) {
  return <button className={cn(variantesBotao({ variante, tamanho }), className)} {...props} />;
}
