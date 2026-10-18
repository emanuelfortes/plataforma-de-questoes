import { redirect } from "next/navigation";

// Endereço antigo do faturamento.
export default function Faturamento() {
  redirect("/admin/financeiro");
}
