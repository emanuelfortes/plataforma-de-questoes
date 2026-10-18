import Image from "next/image";
import { cn } from "@/lib/utils";

/** Brasão do Professor Riccardo Nóbrega (public/marca/logo-riccardo.png, 512 px). */
export function Logo({ tamanho = 32, className }: { tamanho?: number; className?: string }) {
  return (
    <Image
      src="/marca/logo-riccardo.png"
      alt="Professor Riccardo Nóbrega"
      width={tamanho}
      height={tamanho}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
