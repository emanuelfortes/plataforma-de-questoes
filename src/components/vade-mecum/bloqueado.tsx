import { RecursoBloqueado } from "@/components/recurso-bloqueado";
import { carregarLei, secaoDoArtigo } from "@/server/vade-mecum";
import { LeituraLei } from "./leitura-lei";

/** Aluno grátis: o art. 121 do Código Penal de verdade (texto público), desfocado atrás do cadeado. */
export async function VadeMecumBloqueado() {
  const cp = await carregarLei("cp");
  const achado = cp ? secaoDoArtigo(cp, "121") : null;
  const nos = cp && achado ? cp.secoes[achado.secao]!.nos : [];
  const inicio = nos.findIndex((n) => n.tipo === "artigo" && n.id === achado?.id);
  const trecho = inicio >= 0 ? nos.slice(Math.max(0, inicio - 1), inicio + 9) : [];
  return (
    <RecursoBloqueado
      titulo="Vade Mecum"
      descricao="A lei atualizada do jeito certo de ler: cada artigo desmontado, com as pegadinhas da banca em destaque."
      beneficios={[
        "Constituição, Códigos e as leis especiais dos concursos policiais, no texto vigente",
        "Caput, parágrafos, incisos e pena separados e etiquetados",
        "Palavras que a banca troca em destaque e aviso de cada mudança recente",
      ]}
      previa={<div className="bg-fundo p-3">{trecho.length ? <LeituraLei nos={trecho} /> : null}</div>}
    />
  );
}
