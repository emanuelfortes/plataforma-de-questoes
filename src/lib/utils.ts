import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

export function formatarNumero(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function percentual(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}
