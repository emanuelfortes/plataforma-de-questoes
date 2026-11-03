import { cn } from "@/lib/utils";

/** Crédito do desenvolvedor no pé de todas as páginas. */
export function CreditoDev({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-xs text-suave", className)}>
      Desenvolvido por{" "}
      <a href="https://fortesdev.com" target="_blank" rel="noopener" className="font-bold text-marca-clara hover:underline">
        FortesDev
      </a>
    </p>
  );
}
