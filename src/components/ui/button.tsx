import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const variantesBotao = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca",
  {
    variants: {
      variante: {
        padrao: "bg-marca text-white hover:bg-marca-forte",
        contorno: "border-[1.5px] border-white/25 bg-transparent text-texto hover:bg-white/10",
        fantasma: "text-suave hover:text-texto",
      },
      tamanho: {
        padrao: "h-11 px-5",
        pequeno: "h-9 px-3.5 text-xs",
        grande: "h-[50px] px-7 text-[15px]",
      },
    },
    defaultVariants: { variante: "padrao", tamanho: "padrao" },
  },
);

export function Button({ className, variante, tamanho, ...props }: ComponentProps<"button"> & VariantProps<typeof variantesBotao>) {
  return <button className={cn(variantesBotao({ variante, tamanho }), className)} {...props} />;
}
