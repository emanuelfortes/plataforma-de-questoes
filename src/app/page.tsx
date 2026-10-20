import { BarChart3, BookOpenCheck, Check, Filter, Layers, MessageSquareText, Smartphone, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotaoTema } from "@/components/botao-tema";
import { Logo } from "@/components/logo";
import { variantesBotao } from "@/components/ui/button";
import { NOME_PLATAFORMA } from "@/lib/marca";
import { ASSINATURA, formatarReais, LIMITE_GRATIS_DIA } from "@/lib/planos";
import { obterSessao } from "@/lib/sessao";
import { cn, formatarNumero } from "@/lib/utils";
import { resumoVitrine } from "@/server/vitrine";

export const metadata: Metadata = {
  title: { absolute: `${NOME_PLATAFORMA}: questões comentadas e flashcards para concursos policiais do Ceará` },
  description:
    "Questões inéditas comentadas pelo Professor Riccardo Nóbrega no estilo IDECAN e Vunesp, flashcards com revisão inteligente e acompanhamento do seu desempenho. Comece grátis.",
};

// Página de vendas para quem chega pelo domínio. Quem já está logado vai direto estudar.
export default async function Inicio() {
  if (await obterSessao()) redirect("/estudar");
  const { questoes, flashcards, materias } = await resumoVitrine();

  return (
    <div className="min-h-dvh bg-fundo text-texto">
      <Topo />
      <main>
        <Hero questoes={questoes} flashcards={flashcards} materias={materias.length} />
        <Recursos />
        <Professor />
        <Concursos />
        <Materias materias={materias} />
        <Preco />
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Rodape />
    </div>
  );
}

const botaoPrincipal = cn(variantesBotao({ tamanho: "grande" }), "w-full sm:w-auto");
const botaoContorno = cn(variantesBotao({ variante: "contorno", tamanho: "grande" }), "w-full sm:w-auto");

function Topo() {
  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold">
          <Logo tamanho={34} />
          <span className="hidden sm:inline">{NOME_PLATAFORMA}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <BotaoTema />
          <Link href="/entrar" className={variantesBotao({ variante: "fantasma", tamanho: "pequeno" })}>
            Entrar
          </Link>
          <Link href="/cadastrar" className={variantesBotao({ tamanho: "pequeno" })}>
            Começar grátis
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ questoes, flashcards, materias }: { questoes: number; flashcards: number; materias: number }) {
  return (
    <section className="relative overflow-hidden">
      {/* Foto tática do site do professor, escurecida para o texto ficar legível. Sempre na visão escura. */}
      <div className="visao-escura absolute inset-0 z-0">
        <Image src="/marca/vitrine/fundo-tatico.webp" alt="" fill priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-linear-to-r from-fundo via-fundo/75 to-fundo/35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-fundo" />
      </div>
      <div className="visao-escura relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-28">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-borda bg-camada px-3 py-1 text-xs font-bold text-marca-clara">
            <Sparkles className="size-3.5" aria-hidden /> Professor Riccardo Nóbrega
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-.03em] sm:text-5xl">
            Treine do jeito que a <span className="text-marca">banca cobra</span>.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-suave">
            Questões inéditas no estilo IDECAN e Vunesp, com comentário de cada alternativa, flashcards que voltam na hora certa e o seu
            desempenho dia a dia. Feito para PCCE, Guarda Municipal de Fortaleza e CFO PMCE.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastrar" className={botaoPrincipal}>
              Começar grátis
            </Link>
            <Link href="#preco" className={botaoContorno}>
              Ver o plano
            </Link>
          </div>
          <p className="text-sm text-suave">Sem cartão. {LIMITE_GRATIS_DIA} questões por dia no plano grátis.</p>
        </div>
        <ExemploQuestao />
      </div>
      <div className="relative mx-auto grid max-w-6xl grid-cols-3 gap-3 px-4 pt-4 pb-16 sm:px-6">
        {[
          { valor: formatarNumero(questoes), rotulo: "questões comentadas" },
          { valor: formatarNumero(flashcards), rotulo: "flashcards" },
          { valor: formatarNumero(materias), rotulo: "matérias" },
        ].map((n) => (
          <div key={n.rotulo} className="rounded-2xl border border-borda bg-superficie p-4 text-center sm:p-6">
            <p className="text-2xl font-extrabold tracking-tight tabular-nums sm:text-4xl">{n.valor}</p>
            <p className="mt-1 text-xs text-suave sm:text-sm">{n.rotulo}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Ilustração: uma questão já respondida, como o aluno vê na plataforma. */
function ExemploQuestao() {
  const alternativas = [
    { letra: "A", texto: "pode ser instaurado pela autoridade policial de ofício, mesmo sem representação.", certa: false },
    { letra: "B", texto: "depende da representação da vítima ou de seu representante legal.", certa: true },
    { letra: "C", texto: "só pode ser instaurado por requisição do Ministério Público.", certa: false },
    { letra: "D", texto: "é dispensado, devendo a vítima oferecer queixa-crime diretamente.", certa: false },
  ];
  return (
    <div className="rotate-1 rounded-3xl border border-borda bg-superficie p-5 shadow-2xl shadow-marca-suave sm:p-6">
      <div className="mb-3 flex items-center justify-between text-xs text-suave">
        <span className="font-bold text-marca-clara">Processo Penal · Inquérito Policial</span>
        <span>Inédita (estilo IDECAN)</span>
      </div>
      <p className="text-[15px] font-semibold leading-relaxed">Nos crimes de ação penal pública condicionada, o inquérito policial:</p>
      <ol className="mt-4 space-y-2">
        {alternativas.map((a) => (
          <li
            key={a.letra}
            className={cn(
              "flex gap-3 rounded-xl border px-3 py-2.5 text-sm",
              a.certa ? "border-acerto bg-acerto-suave" : "border-borda text-texto/80",
            )}
          >
            <span className={cn("font-extrabold", a.certa && "text-acerto")}>{a.letra}</span>
            {a.texto}
          </li>
        ))}
      </ol>
      <div className="mt-4 border-l-2 border-marca pl-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-marca-clara">Comentário</p>
        <p className="mt-1 text-sm text-suave">
          Art. 5º, § 4º, do CPP: sem representação, o inquérito não pode ser iniciado. A alternativa A troca a regra pela da ação
          incondicionada.
        </p>
      </div>
    </div>
  );
}

const RECURSOS = [
  { Icone: MessageSquareText, titulo: "Comentário em cada alternativa", texto: "Você entende por que a certa está certa e onde cada errada erra, com o artigo de lei que sustenta a resposta." },
  { Icone: Layers, titulo: "Flashcards que lembram por você", texto: "Revisão espaçada: cada card volta no momento em que você está para esquecer. Menos tempo, mais retenção." },
  { Icone: BarChart3, titulo: "Seu desempenho à vista", texto: "Acertos de hoje, de ontem e dos últimos 7, 15 e 30 dias, por matéria. Saiba exatamente onde reforçar." },
  { Icone: Filter, titulo: "Filtros que fazem sentido", texto: "Escolha matéria e assunto e treine só o que não resolveu, só o que errou ou revise o que acertou." },
  { Icone: BookOpenCheck, titulo: "Lei seca atualizada", texto: "Questões feitas a partir do texto legal vigente, com aviso nos pontos em que o STF mudou a leitura da lei." },
  { Icone: Smartphone, titulo: "No celular, como app", texto: "Instale na tela inicial e estude no ônibus, na fila ou no intervalo. Funciona em qualquer aparelho." },
];

function Recursos() {
  return (
    <section className="border-y border-borda bg-superficie/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <Titulo selo="O que tem dentro" titulo="Tudo o que você precisa para treinar, num lugar só" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ Icone, titulo, texto }) => (
            <div key={titulo} className="rounded-2xl border border-borda bg-superficie p-6 transition-colors hover:border-borda-forte">
              <span className="grid size-11 place-items-center rounded-xl bg-marca-suave text-marca-clara">
                <Icone className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-extrabold">{titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-suave">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Quem está por trás: foto e textura do site do professor. */
function Professor() {
  return (
    <section className="visao-escura relative overflow-hidden bg-fundo">
      <Image src="/marca/vitrine/textura.webp" alt="" fill sizes="100vw" className="object-cover opacity-90" />
      <div className="absolute inset-0 bg-linear-to-r from-fundo/30 via-transparent to-fundo/40" />
      <div className="relative mx-auto grid max-w-6xl items-end gap-8 px-4 pt-14 sm:px-6 md:grid-cols-[1.2fr_1fr] md:pt-16">
        <div className="space-y-5 pb-14 md:pb-20">
          <p className="text-xs font-extrabold uppercase tracking-[.12em] text-marca-clara">Quem prepara você</p>
          <h2 className="text-3xl font-extrabold tracking-[-.02em] sm:text-4xl">Professor Riccardo Nóbrega</h2>
          <p className="text-2xl font-extrabold text-marca-clara">O propósito é simples: aprovação.</p>
          <p className="max-w-xl leading-relaxed text-texto/85">
            Não é sobre acumular horas de aula. É sobre se preparar de forma estratégica para conquistar a sua vaga. Aqui você treina
            os conteúdos essenciais exigidos em prova, do jeito que a banca cobra.
          </p>
          <ul className="flex flex-wrap gap-2">
            {["Disciplina", "Foco", "Conteúdo direto ao ponto"].map((p) => (
              <li key={p} className="rounded-full border border-borda-forte bg-camada px-3.5 py-1.5 text-sm font-bold">
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-sm md:max-w-md">
          <div aria-hidden className="absolute inset-x-6 bottom-0 top-16 rounded-t-full bg-marca-suave blur-2xl" />
          <Image src="/marca/vitrine/riccardo.webp" alt="Professor Riccardo Nóbrega" width={900} height={1199} sizes="(min-width: 768px) 448px, 384px" className="relative h-auto w-full" />
        </div>
      </div>
    </section>
  );
}

const CONCURSOS = [
  { sigla: "PCCE", nome: "Polícia Civil do Ceará", detalhe: "Inspetor e Escrivão · estilo IDECAN" },
  { sigla: "GMF", nome: "Guarda Municipal de Fortaleza", detalhe: "Guarda Municipal · estilo IDECAN" },
  { sigla: "CFO", nome: "Polícia Militar do Ceará", detalhe: "Cadete do CFO · estilo Vunesp" },
];

function Concursos() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <Titulo selo="Para quem é" titulo="Montado em cima dos editais" texto="Os assuntos e o peso de cada um seguem os editais verticalizados. A banca de cada questão define o formato: quatro alternativas na IDECAN, cinco na Vunesp." />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {CONCURSOS.map((c) => (
          <div key={c.sigla} className="rounded-2xl border border-borda bg-superficie p-6">
            <p className="text-3xl font-extrabold tracking-tight text-marca">{c.sigla}</p>
            <p className="mt-2 font-bold">{c.nome}</p>
            <p className="text-sm text-suave">{c.detalhe}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Materias({ materias }: { materias: string[] }) {
  if (!materias.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-20">
      <div className="rounded-3xl border border-borda bg-superficie p-6 sm:p-8">
        <h2 className="text-lg font-extrabold">Matérias disponíveis</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {materias.map((m) => (
            <li key={m} className="rounded-full border border-borda bg-camada px-3 py-1.5 text-sm font-semibold">
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-suave">Novas questões entram toda semana.</p>
      </div>
    </section>
  );
}

function Preco() {
  const gratis = [`${LIMITE_GRATIS_DIA} questões por dia`, "Comentário de cada alternativa", "Flashcards e desempenho"];
  const completo = ["Questões ilimitadas", "Todas as matérias e assuntos", "Flashcards com revisão espaçada", "Desempenho completo por matéria", "Novas questões toda semana"];
  return (
    <section id="preco" className="scroll-mt-20 border-y border-borda bg-superficie/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <Titulo selo="Plano" titulo="Comece grátis. Assine quando quiser ir além." />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-3xl border border-borda bg-superficie p-6 sm:p-8">
            <p className="font-extrabold">Grátis</p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">R$ 0</p>
            <p className="text-sm text-suave">para sempre</p>
            <Lista itens={gratis} />
            <Link href="/cadastrar" className={cn(variantesBotao({ variante: "contorno" }), "mt-auto w-full")}>
              Criar conta grátis
            </Link>
          </div>
          <div className="relative flex flex-col rounded-3xl border-2 border-marca bg-superficie p-6 shadow-xl shadow-marca-suave sm:p-8">
            <span className="absolute -top-3 left-6 rounded-full bg-marca px-3 py-0.5 text-xs font-extrabold text-sobre-marca">Mais completo</span>
            <p className="font-extrabold">{ASSINATURA.nome}</p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">
              {formatarReais(ASSINATURA.valor)}
              <span className="text-base font-bold text-suave">/mês</span>
            </p>
            <p className="text-sm text-suave">cancele quando quiser</p>
            <Lista itens={completo} />
            <Link href="/cadastrar" className={cn(variantesBotao(), "mt-auto w-full")}>
              Começar agora
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="my-6 space-y-2.5">
      {itens.map((i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-acerto" aria-hidden />
          {i}
        </li>
      ))}
    </ul>
  );
}

const PERGUNTAS = [
  { p: "As questões são de provas anteriores?", r: "São inéditas, escritas no estilo da banca de cada concurso (IDECAN ou Vunesp) a partir da lei vigente, e revisadas antes de entrar na plataforma." },
  { p: "Preciso de cartão para começar?", r: `Não. O plano grátis libera ${LIMITE_GRATIS_DIA} questões por dia, com comentário. Você assina só se quiser estudar sem limite.` },
  { p: "Posso cancelar a assinatura?", r: "Sim, a qualquer momento, pela própria plataforma. Você continua com acesso até o fim do mês já pago." },
  { p: "Funciona no celular?", r: "Sim. Abra pelo navegador e adicione à tela inicial: ele vira um app, com a mesma conta em todos os aparelhos." },
  { p: "E se eu achar um erro numa questão?", r: "Toque em \"Reportar erro\" depois de responder. A questão sai do ar na hora e volta só depois de revisada." },
];

function Perguntas() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
      <Titulo selo="Dúvidas" titulo="Perguntas frequentes" />
      <div className="mt-8 divide-y divide-borda rounded-2xl border border-borda bg-superficie">
        {PERGUNTAS.map((q) => (
          <details key={q.p} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
              {q.p}
              <span className="text-xl text-suave transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-suave">{q.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="visao-escura relative overflow-hidden rounded-3xl border border-borda px-6 py-14 text-center sm:px-12">
        <Image src="/marca/vitrine/fundo-tatico.webp" alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover object-top" />
        <div className="absolute inset-0 bg-fundo/80" />
        <div className="relative">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Sua aprovação começa na próxima questão.</h2>
          <p className="mx-auto mt-3 max-w-xl text-texto/85">Crie sua conta em menos de um minuto e resolva as primeiras questões hoje.</p>
          <Link href="/cadastrar" className={cn(variantesBotao({ tamanho: "grande" }), "mt-8")}>
            Começar grátis
          </Link>
        </div>
      </div>
    </section>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-borda">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-suave sm:flex-row sm:px-6">
        <p>
          © {new Date().getFullYear()} {NOME_PLATAFORMA} · Professor Riccardo Nóbrega
        </p>
        <nav className="flex gap-4">
          <Link href="/termos" className="hover:text-texto">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="hover:text-texto">
            Privacidade
          </Link>
          <Link href="/entrar" className="hover:text-texto">
            Entrar
          </Link>
        </nav>
      </div>
    </footer>
  );
}

function Titulo({ selo, titulo, texto }: { selo: string; titulo: string; texto?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-extrabold uppercase tracking-[.12em] text-marca-clara">{selo}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-[-.02em] sm:text-4xl">{titulo}</h2>
      {texto && <p className="mt-3 text-suave">{texto}</p>}
    </div>
  );
}
