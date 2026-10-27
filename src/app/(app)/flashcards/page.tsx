import type { Metadata } from "next";
import { SessaoFlashcards } from "@/components/flashcards/sessao-flashcards";
import { SelecaoAtual } from "@/components/selecao-atual";
import { lerId, lerIds } from "@/lib/filtros";
import { exigirUsuario } from "@/lib/sessao";
import { nomesSelecao } from "@/server/estudar";
import { RecursoBloqueado } from "@/components/recurso-bloqueado";
import { temAcessoCompleto } from "@/server/assinatura";
import { montarSessao } from "@/server/flashcards";

export const metadata: Metadata = { title: "Flashcards" };

type Params = Promise<{ [chave: string]: string | string[] | undefined }>;

export default async function PaginaFlashcards({ searchParams }: { searchParams: Params }) {
  const usuario = await exigirUsuario();
  if (!(await temAcessoCompleto(usuario))) return <FlashcardsBloqueados />;
  const sp = await searchParams;
  const texto = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const disciplinaId = lerId(texto("disciplina"));
  const assuntoIds = disciplinaId ? lerIds(sp.assunto) : [];

  const [nomes, cards] = await Promise.all([
    nomesSelecao(disciplinaId, assuntoIds),
    montarSessao(usuario.id, disciplinaId, assuntoIds),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[.06em] text-destaque">Flashcards</p>
        <h1 className="mt-1 text-[28px] sm:text-[34px] font-extrabold leading-[1.1] tracking-[-.03em]">Revisão do dia</h1>
        <p className="mt-2 text-sm text-suave">
          Revisões vencidas primeiro, depois cards novos. O intervalo de cada card se ajusta à sua resposta.
        </p>
      </div>

      <SelecaoAtual tipo="flashcards" disciplinaId={disciplinaId} partes={[nomes.disciplina, nomes.assunto]} />

      {/* key força reiniciar a sessão ao trocar a seleção */}
      <SessaoFlashcards key={`${disciplinaId ?? "todas"}-${assuntoIds.join(".") || "todas"}`} cards={cards} />
    </div>
  );
}

/** Aluno grátis: vê um card de exemplo (fixo, não sai do banco) atrás do cadeado. */
function FlashcardsBloqueados() {
  return (
    <RecursoBloqueado
      titulo="Flashcards"
      descricao="Revisão com repetição espaçada: cada card volta na hora certa, antes de você esquecer."
      beneficios={[
        "Cards de todas as matérias, com a lei e os pontos que mais caem",
        "O intervalo de cada card se ajusta ao quanto você lembrou",
        "Revisões do dia prontas, sem precisar montar nada",
      ]}
      previa={
        <div className="space-y-4 bg-superficie p-5">
          <div className="rounded-[20px] bg-camada-forte p-6 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.08em] text-suave">Frente · Direito Penal</p>
            <p className="mt-6 text-xl font-bold leading-snug">Qual a diferença entre furto e roubo?</p>
            <p className="mt-8 text-[13px] font-bold text-suave">Toque para ver a resposta</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["Errei", "Difícil", "Bom", "Fácil"].map((n) => (
              <span key={n} className="grid h-11 place-items-center rounded-xl border border-borda text-sm font-extrabold">
                {n}
              </span>
            ))}
          </div>
        </div>
      }
    />
  );
}
