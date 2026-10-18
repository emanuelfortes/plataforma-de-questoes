"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const classeCampo =
  "h-12 w-full rounded-lg border border-borda bg-camada px-3.5 text-[15px] text-texto placeholder:text-suave focus-visible:outline-2 focus-visible:outline-marca";

export function CampoSenha({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <input type={visivel ? "text" : "password"} minLength={8} maxLength={128} className={cn(classeCampo, "pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-suave hover:text-texto"
      >
        {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
