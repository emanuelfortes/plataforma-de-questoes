// Produção automática de questões e flashcards (a mesma linha do piloto, sem roteiro fixo).
// Máquina de estados retomável: o estado fica em data/geradas/producao.json e os arquivos de cada
// lote em data/geradas/producao/<lote>/. Usa SEMPRE o local.db (nunca a produção).
//
//   npx tsx scripts/questoes/producao.ts iniciar [--teto 6] [--paralelo 3]   abre uma execução
//   npx tsx scripts/questoes/producao.ts proximo        avança o que ficou pronto e diz o que fazer agora (JSON)
//   npx tsx scripts/questoes/producao.ts conferir <lote> <arquivo>   só confere um arquivo (para o subagente)
//   npx tsx scripts/questoes/producao.ts status
//   npx tsx scripts/questoes/producao.ts reabrir <lote>   reprocessa um lote concluído com as regras atuais
//   npx tsx scripts/questoes/producao.ts relatorio [--data AAAA-MM-DD]   gera data/relatorios/AAAA-MM-DD.md
//   npx tsx scripts/questoes/producao.ts notificar [--data AAAA-MM-DD] [--teste]   resumo curto no celular (ntfy)
//
// Ciclo de um lote (10 questões + ~3 flashcards de um tópico):
//   pendente  -> o gerador escreve gerado.json
//   gerado    -> dois auditores independentes escrevem auditoria-1.json e auditoria-2.json
//   (reprovado por qualquer auditor) regen_pendente -> regen-gerado.json -> regen_gerado -> regen-auditoria-1/2.json
//   importa em questoes_revisao / flashcards_revisao; aprova sozinho o que passou em tudo -> concluido
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { and, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { aprovarFlashcards, aprovarQuestoes } from "../../src/db/aprovacao";
import type { Db } from "../../src/db";
import * as schema from "../../src/db/schema";
import type { AuditoriaFlashcard, ResultadoAuditoria } from "../../src/db/schema/revisao";
import { normalizar, semelhanca } from "../../src/lib/catalogo";
import { acharTopico, lerJurisprudencia, lerTaxonomia, sensiveisDoTopico, textoLegal, type Taxonomia, type Topico } from "./contexto";
import {
  absolutoSoNasErradas,
  cobraPena,
  artigosSensiveisCitados,
  PADRAO_ABSOLUTO,
  tamanhoDaCorreta,
  citacoesFlashcardForaDaLista,
  citacoesForaDaLista,
  conferirFlashcard,
  conferirLote,
  conferirQuestao,
  dispositivosSemNota,
  esquemaLoteAuditadoProducao,
  esquemaLoteProducao,
  sensiveisCitadosQuestao,
  trechosAConfirmar,
  type Auditoria,
  type AuditoriaFlashcardGerada,
  type FlashcardGerado,
  type QuestaoGerada,
} from "./esquema";
import { DATA_CORTE, DISTRIBUICAO, EDITAL, listaJurisprudencia, secaoSensiveis } from "./piloto";

const PASTA = "data/geradas/producao";
const ARQUIVO_ESTADO = "data/geradas/producao.json";
const PASTA_RELATORIOS = "data/relatorios";
const QUESTOES_POR_LOTE = 10;
const FLASHCARDS_POR_LOTE = 3;
const MAX_TENTATIVAS = 3; // arquivo inválido 3 vezes: o lote é abandonado com erro
const LIMITE_DUPLICATA_QUESTAO = 0.775; // calibrado no piloto
const LIMITE_DUPLICATA_FLASHCARD = 0.8;
// Disciplinas que não dependem de lei: podem ser aprovadas sozinhas sem texto legal no pedido.
// Nas demais (jurídicas), tópico sem lei vai sempre para a fila manual.
const DISCIPLINAS_SEM_LEI = ["Língua Portuguesa", "Raciocínio Lógico", "Informática", "História e Geografia do Ceará"];

// ---------- estado ----------

type Contagem = { geradas: number; aprovadas: number; fila: number; descartadas: number; duplicadas: number };
type Resultado = { questoes: Contagem; flashcards: Contagem; descartes: { id: string; motivo: string }[] };
type Etapa = "pendente" | "gerado" | "regen_pendente" | "regen_gerado" | "concluido" | "falhou";
type Lote = {
  id: string;
  topico: string;
  banca: string;
  alternativas: number;
  concurso: string;
  foco: string;
  execucao: string;
  etapa: Etapa;
  tentativas: Record<string, number>;
  reprovadas: { questoes: string[]; flashcards: string[] };
  resultado?: Resultado;
  erro?: string;
  criadoEm: string;
  concluidoEm?: string;
  /** Quantas vezes o lote foi reaberto para reescrita (os arquivos anteriores ficam como *.vN.json). */
  reaberto?: number;
};
type Execucao = { id: string; inicio: string; fim?: string; motivoFim?: string; teto: number; paralelo: number; lotesIniciados: number };
type Estado = { lotes: Lote[]; execucoes: Execucao[]; erros: { quando: string; lote?: string; msg: string }[] };

const lerJson = (c: string) => JSON.parse(readFileSync(c, "utf8").replace(/^﻿/, ""));
const lerEstado = (): Estado => (existsSync(ARQUIVO_ESTADO) ? lerJson(ARQUIVO_ESTADO) : { lotes: [], execucoes: [], erros: [] });
const salvarEstado = (e: Estado) => writeFileSync(ARQUIVO_ESTADO, JSON.stringify(e, null, 2) + "\n");
const pasta = (id: string) => `${PASTA}/${id}`;
const agoraIso = () => new Date().toISOString();
const vazio = (): Contagem => ({ geradas: 0, aprovadas: 0, fila: 0, descartadas: 0, duplicadas: 0 });

// Banco: sempre o arquivo local. A produção (Turso) só recebe depois, por outro caminho, com aprovação do dono.
const banco = drizzle(createClient({ url: "file:local.db" }), { schema }) as unknown as Db;

// ---------- planejamento: próximo tópico por meta restante ----------

/** Tópico pode entrar na produção se o texto legal dele existe (as 6 leis estaduais/municipais ainda não). */
function topicoDisponivel(tax: Taxonomia, topico: Topico) {
  try {
    textoLegal(tax, topico);
    return true;
  } catch {
    return false;
  }
}

async function produzidoPorTopico() {
  const linhas = await banco
    .select({ topico: schema.questoesRevisao.topicoTaxonomia, banca: schema.questoesRevisao.banca, n: sql<number>`count(*)` })
    .from(schema.questoesRevisao)
    .groupBy(schema.questoesRevisao.topicoTaxonomia, schema.questoesRevisao.banca);
  return new Map(linhas.map((l) => [`${l.topico}|${l.banca}`, Number(l.n)]));
}

async function planejarLote(estado: Estado, exec: Execucao): Promise<Lote | null> {
  const tax = lerTaxonomia();
  const feitos = await produzidoPorTopico();
  const ativos = estado.lotes.filter((l) => !["concluido", "falhou"].includes(l.etapa));
  const disciplinaDe = new Map(tax.disciplinas.flatMap((d) => d.topicos.map((t) => [t.id, d.nome] as const)));
  // Revezamento: os lotes recentes dizem quais tópicos e disciplinas acabaram de ser usados.
  const recentes = [...estado.lotes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const topicosEvitar = new Set([...ativos, ...recentes.slice(0, 3)].map((l) => l.topico));
  const disciplinasEvitar = new Set([...ativos, ...recentes.slice(0, 1)].map((l) => disciplinaDe.get(l.topico)));
  const usoDisciplina = new Map<string, number>();
  for (const l of recentes.slice(0, 2 * tax.disciplinas.length)) {
    const d = disciplinaDe.get(l.topico) ?? "";
    usoDisciplina.set(d, (usoDisciplina.get(d) ?? 0) + 1);
  }
  const candidatos: { topico: Topico; disciplina: string; formato: Topico["formatos"][number]; restante: number }[] = [];
  for (const d of tax.disciplinas)
    for (const t of d.topicos) {
      if (!topicoDisponivel(tax, t)) continue;
      for (const f of t.formatos) {
        const emAndamento = ativos.filter((l) => l.topico === t.id && l.banca === f.banca).length * QUESTOES_POR_LOTE;
        const restante = f.meta - (feitos.get(`${t.id}|${f.banca}`) ?? 0) - emAndamento;
        if (restante > 0) candidatos.push({ topico: t, disciplina: d.nome, formato: f, restante });
      }
    }
  if (!candidatos.length) return null;
  // Ordem: (1) tópico fora dos lotes em andamento e dos 3 últimos (nunca o mesmo tópico em lotes seguidos);
  // (2) disciplina diferente das em andamento e da última; (3) disciplina menos usada recentemente;
  // (4) maior meta restante dentro desse revezamento.
  candidatos.sort(
    (a, b) =>
      Number(topicosEvitar.has(a.topico.id)) - Number(topicosEvitar.has(b.topico.id)) ||
      Number(disciplinasEvitar.has(a.disciplina)) - Number(disciplinasEvitar.has(b.disciplina)) ||
      (usoDisciplina.get(a.disciplina) ?? 0) - (usoDisciplina.get(b.disciplina) ?? 0) ||
      b.restante - a.restante,
  );

  const { topico, formato } = candidatos[0]!;
  const anteriores = estado.lotes.filter((l) => l.topico === topico.id);
  const numero = anteriores.length + 1;
  const concurso = formato.concursos[anteriores.filter((l) => l.banca === formato.banca).length % formato.concursos.length]!;
  const foco = topico.subtopicos.length ? topico.subtopicos[(numero - 1) % topico.subtopicos.length]! : "todo o tema, variando os pontos cobrados";
  return {
    id: `${topico.id}-${String(numero).padStart(3, "0")}`,
    topico: topico.id,
    banca: formato.banca,
    alternativas: formato.alternativas,
    concurso,
    foco,
    execucao: exec.id,
    etapa: "pendente",
    tentativas: {},
    reprovadas: { questoes: [], flashcards: [] },
    criadoEm: agoraIso(),
  };
}

/** O que já foi cobrado no tópico, para o gerador não repetir. */
async function jaCobertos(topicoId: string) {
  const qs = await banco
    .select({ subtopico: schema.questoesRevisao.subtopico, palavras: schema.questoesRevisao.palavrasChave })
    .from(schema.questoesRevisao)
    .where(eq(schema.questoesRevisao.topicoTaxonomia, topicoId))
    .orderBy(sql`${schema.questoesRevisao.id} desc`)
    .limit(60);
  const fs = await banco
    .select({ frente: schema.flashcardsRevisao.frente })
    .from(schema.flashcardsRevisao)
    .where(eq(schema.flashcardsRevisao.topicoTaxonomia, topicoId))
    .orderBy(sql`${schema.flashcardsRevisao.id} desc`)
    .limit(20);
  const subtemas = [...new Set(qs.map((q) => q.subtopico).filter(Boolean))].slice(0, 30);
  const palavras = [...new Set(qs.flatMap((q) => q.palavras ?? []))].slice(0, 40);
  return { subtemas, palavras, frentes: fs.map((f) => f.frente) };
}

// ---------- pedidos aos subagentes ----------

async function entrada(tax: Taxonomia, lote: Lote, extra?: string) {
  const { disciplina, topico } = acharTopico(tax, lote.topico);
  const concurso = tax.concursos.find((c) => c.id === lote.concurso)!;
  const lei = textoLegal(tax, topico);
  const letras = "ABCDE".slice(0, lote.alternativas).split("").join(", ");
  const cobertos = await jaCobertos(lote.topico);
  const edital = EDITAL[lote.topico]?.[lote.concurso] ?? `Tópico do edital: ${topico.nome}. Subtemas: ${topico.subtopicos.join("; ") || "não especificados"}.`;
  return `# Pedido de geração: lote ${lote.id}

## Parâmetros da produção
- Disciplina: ${disciplina}
- Tema: ${topico.nome}
- Subtemas do tema: ${topico.subtopicos.join("; ") || "não especificados"}
- Foco deste lote: ${lote.foco}
- Cargo: ${concurso.cargo}
- Órgão: ${concurso.orgao}
- Banca examinadora: ${concurso.banca}${concurso.edicao ? ` (${concurso.edicao})` : ""}
- Número de alternativas por questão: ${lote.alternativas} (as letras ${letras} serão atribuídas pelo sistema depois; use ids a1 a a${lote.alternativas})
- Quantidade: ${QUESTOES_POR_LOTE} questões (ids q01 a q10) e ${FLASHCARDS_POR_LOTE} flashcards (ids f01 a f0${FLASHCARDS_POR_LOTE})
- Dificuldade das questões: ${DISTRIBUICAO}
- Objetivo: PLATAFORMA
- Data de corte legislativo: ${DATA_CORTE}
- Data de corte jurisprudencial: ${DATA_CORTE}
- Lista de jurisprudência fornecida (só estes podem ser citados pelo número): ${listaJurisprudencia()}
- Perfil da banca: sem questões anteriores fornecidas; use apenas características gerais conhecidas da banca.
- Tamanho e tom das alternativas (verificado em código): a correta tem entre 80% e 125% da média de caracteres das erradas; no lote, é a mais longa em no máximo 3 questões e a mais curta em no máximo 3; termos absolutos ("sempre", "jamais", "automaticamente"...) só nas erradas em no máximo 2 questões. As erradas erram por conteúdo, não por exagero.
- Pena é exceção: no máximo 1 questão do lote pode girar em torno de quantidade de pena; nas outras, cobre o crime (tipificação, elementares, consumação, hipóteses de aumento sem a fração, exceções, ação penal), sem pena nas alternativas.
${topico.nota ? `- Observação: ${topico.nota}\n` : ""}
## Já cobertos neste tema (não repita o mesmo ponto do mesmo jeito)
- Subtemas recentes: ${cobertos.subtemas.join("; ") || "nenhum ainda"}
- Palavras-chave recentes: ${cobertos.palavras.join(", ") || "nenhuma ainda"}
- Flashcards recentes (frentes): ${cobertos.frentes.map((f) => `"${f}"`).join("; ") || "nenhum ainda"}

## Trecho do edital (${concurso.nome})
${edital}
${secaoSensiveis(sensiveisDoTopico(topico), tax.leis)}${extra ? `\n${extra}\n` : ""}
## Texto legal fornecido
${lei || (disciplina === "Língua Portuguesa" ? "Não há texto legal para este tema. Siga a norma-padrão, com regras consolidadas nas gramáticas de referência; evite pontos em que os gramáticos divergem." : "Não há texto legal fornecido para este tema. Use só conhecimento consolidado e incontroverso (conceitos pacíficos e doutrina majoritária); evite pontos controvertidos e não cite artigos de lei que não estejam neste pedido.")}
`;
}

type Acao = { tipo: "gerar" | "auditar" | "corrigir"; lote: string; arquivo: string; tarefa: string };

const TAREFA_GERAR = "prompts/producao/tarefa-gerar.md";
const TAREFA_AUDITAR = "prompts/producao/tarefa-auditar.md";

function acaoGerar(lote: Lote, regen: boolean): Acao {
  const dir = pasta(lote.id);
  const ent = `${dir}/${regen ? "regen-entrada.md" : "entrada.md"}`;
  const saida = `${dir}/${regen ? "regen-gerado.json" : "gerado.json"}`;
  return {
    tipo: "gerar",
    lote: lote.id,
    arquivo: saida,
    tarefa: `Você é o GERADOR. Leia e cumpra a tarefa em ${TAREFA_GERAR} com: LOTE=${lote.id}; ENTRADA=${ent}; SAIDA=${saida}.${regen ? " É uma REGENERAÇÃO: gere só os itens listados na seção \"Regeneração\" da entrada." : ""}`,
  };
}

function acaoAuditar(lote: Lote, regen: boolean, auditor: 1 | 2): Acao {
  const dir = pasta(lote.id);
  const questoes = `${dir}/${regen ? "regen-auditoria-entrada.json" : "auditoria-entrada.json"}`;
  const saida = `${dir}/${regen ? `regen-auditoria-${auditor}.json` : `auditoria-${auditor}.json`}`;
  return {
    tipo: "auditar",
    lote: lote.id,
    arquivo: saida,
    tarefa: `Você é o AUDITOR INDEPENDENTE nº ${auditor}. Leia e cumpra a tarefa em ${TAREFA_AUDITAR} com: LOTE=${lote.id}; ENTRADA=${dir}/entrada.md; ITENS=${questoes}; SAIDA=${saida}. Não abra nenhuma outra auditoria da pasta.`,
  };
}

function acaoCorrigir(lote: Lote, arquivo: string, erros: string[]): Acao {
  const auditoria = arquivo.includes("auditoria-");
  return {
    tipo: "corrigir",
    lote: lote.id,
    arquivo,
    tarefa: `O arquivo ${arquivo} (lote ${lote.id}) não passou na conferência. Erros:\n- ${erros.slice(0, 12).join("\n- ")}\n\nLeia ${auditoria ? TAREFA_AUDITAR : TAREFA_GERAR} (as regras do papel), ${auditoria ? "e audite de novo só o que for preciso" : "a entrada do lote"} e corrija SOMENTE o necessário nesse arquivo. Confira com: npx tsx scripts/questoes/producao.ts conferir ${lote.id} ${arquivo}  até dar OK. Não abra outras auditorias da pasta.`,
  };
}

// ---------- validação ----------

type Gerado = ReturnType<typeof esquemaLoteProducao.parse>;
type Auditado = ReturnType<typeof esquemaLoteAuditadoProducao.parse>;

function validarGerado(lote: Lote, arquivo: string, esperados?: { questoes: string[]; flashcards: string[] }): { erros: string[]; dados?: Gerado } {
  let bruto: unknown;
  try {
    bruto = lerJson(arquivo);
  } catch (e) {
    return { erros: [`JSON inválido: ${(e as Error).message}`] };
  }
  const r = esquemaLoteProducao.safeParse(bruto);
  if (!r.success) return { erros: r.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const tax = lerTaxonomia();
  const { topico } = acharTopico(tax, lote.topico);
  const sensiveis = sensiveisDoTopico(topico);
  const temLei = Boolean(textoLegal(tax, topico));
  const erros = r.data.questoes.flatMap((q) => conferirQuestao(q, lote.alternativas, sensiveis));
  const enunciados = r.data.questoes.map((q) => q.enunciado);
  erros.push(...r.data.flashcards.flatMap((f) => conferirFlashcard(f, { temLei, sensiveis, enunciados })));
  const idsQ = r.data.questoes.map((q) => q.id);
  const idsF = r.data.flashcards.map((f) => f.id);
  if (new Set(idsQ).size !== idsQ.length || new Set(idsF).size !== idsF.length) erros.push("ids repetidos");
  if (esperados) {
    const iguais = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    if (!iguais(idsQ, esperados.questoes)) erros.push(`questões devem ser exatamente: ${esperados.questoes.join(", ") || "nenhuma"} (vieram ${idsQ.join(", ") || "nenhuma"})`);
    if (!iguais(idsF, esperados.flashcards)) erros.push(`flashcards devem ser exatamente: ${esperados.flashcards.join(", ") || "nenhum"} (vieram ${idsF.join(", ") || "nenhum"})`);
  } else {
    if (idsQ.length !== QUESTOES_POR_LOTE) erros.push(`são ${QUESTOES_POR_LOTE} questões (q01 a q10); vieram ${idsQ.length}`);
    if (idsF.length < 2 || idsF.length > 4) erros.push(`são ~${FLASHCARDS_POR_LOTE} flashcards (2 a 4); vieram ${idsF.length}`);
    erros.push(...conferirLote(r.data.questoes));
  }
  return { erros, dados: r.data };
}

function validarAuditoria(arquivo: string, itens: Gerado): { erros: string[]; dados?: Auditado } {
  let bruto: unknown;
  try {
    bruto = lerJson(arquivo);
  } catch (e) {
    return { erros: [`JSON inválido: ${(e as Error).message}`] };
  }
  const r = esquemaLoteAuditadoProducao.safeParse(bruto);
  if (!r.success) return { erros: r.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const erros: string[] = [];
  const faltaQ = itens.questoes.filter((q) => !r.data.auditorias.some((a) => a.id === q.id)).map((q) => q.id);
  const faltaF = itens.flashcards.filter((f) => !r.data.auditorias_flashcards.some((a) => a.id === f.id)).map((f) => f.id);
  if (faltaQ.length) erros.push(`sem auditoria para as questões ${faltaQ.join(", ")}`);
  if (faltaF.length) erros.push(`sem auditoria para os flashcards ${faltaF.join(", ")}`);
  return { erros, dados: r.data };
}

/** Itens como o auditor vê: sem o status e as ressalvas do gerador. */
function paraAuditoria(g: Gerado) {
  return { questoes: g.questoes.map(({ status_gerador: _, ressalvas: __, ...q }) => q), flashcards: g.flashcards };
}

// ---------- importação e aprovação automática ----------

function sorteio(semente: string) {
  let s = createHash("sha256").update(semente).digest().readUInt32LE(0);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const LETRAS = "ABCDE";
const trocarIds = (t: string | null, letraDe: Map<string, string>) =>
  t === null ? null : t.replace(/\b(?:alternativa\s+)?(a[1-5])\b/gi, (m, id: string) => (letraDe.has(id.toLowerCase()) ? `alternativa ${letraDe.get(id.toLowerCase())}` : m));
const naoSeAplica = (t: string | null) => (t === null || /^n[ãa]o se aplica\b/i.test(t.trim()) ? null : t);
const hash = (prefixo: string, partes: string[]) => `${prefixo}${createHash("sha256").update(partes.map(normalizar).join("\u0000")).digest("hex").slice(0, 24)}`;
const conteudoQuestao = (enunciado: string, alternativas: { texto: string }[]) => [enunciado, ...alternativas.map((a) => a.texto).sort()].join(" ");

type ItemQ = { q: QuestaoGerada; a1: Auditoria; a2: Auditoria; regenerada: boolean };
type ItemF = { f: FlashcardGerado; a1: AuditoriaFlashcardGerada; a2: AuditoriaFlashcardGerada; regenerada: boolean };

/** Status combinado dos dois auditores e das checagens, e por que não pode ser aprovado sozinho. */
function veredito(s1: string, s2: string, alertas: string[], outrosMotivos: string[]) {
  const status = alertas.length || [s1, s2].includes("NECESSITA_DE_CONFERENCIA") ? "NECESSITA_DE_CONFERENCIA" : [s1, s2].includes("VALIDADA_COM_RESSALVA") ? "VALIDADA_COM_RESSALVA" : "VALIDADA";
  const motivos = [
    ...(s1 !== "VALIDADA" ? [`auditor 1: ${s1}`] : []),
    ...(s2 !== "VALIDADA" ? [`auditor 2: ${s2}`] : []),
    ...alertas,
    ...outrosMotivos,
  ];
  return { status, motivos };
}

async function importarLote(lote: Lote, itensQ: ItemQ[], itensF: ItemF[], descartes: { id: string; motivo: string }[]): Promise<Resultado> {
  const tax = lerTaxonomia();
  const { disciplina, topico } = acharTopico(tax, lote.topico);
  const sensiveis = sensiveisDoTopico(topico);
  const julgados = lerJurisprudencia();
  // Tema jurídico sem nenhum texto legal no pedido: nada é aprovado sozinho (vai para a fila manual).
  const juridicoSemLei = !textoLegal(tax, topico) && !DISCIPLINAS_SEM_LEI.includes(disciplina);
  const res: Resultado = { questoes: vazio(), flashcards: vazio(), descartes };
  res.questoes.geradas = itensQ.length + descartes.filter((d) => d.id.startsWith("q")).length;
  res.flashcards.geradas = itensF.length + descartes.filter((d) => d.id.startsWith("f")).length;
  res.questoes.descartadas = descartes.filter((d) => d.id.startsWith("q")).length;
  res.flashcards.descartadas = descartes.filter((d) => d.id.startsWith("f")).length;

  // Existentes do mesmo tópico (deduplicação entre lotes) e equilíbrio de letras do formato.
  const existentesQ = await banco
    .select({ codigo: schema.questoesRevisao.codigo, enunciado: schema.questoesRevisao.enunciado, alternativas: schema.questoesRevisao.alternativas })
    .from(schema.questoesRevisao)
    .where(eq(schema.questoesRevisao.topicoTaxonomia, lote.topico));
  const textosQ = existentesQ.map((e) => conteudoQuestao(e.enunciado, e.alternativas));
  const codigosQ = new Set(existentesQ.map((e) => e.codigo));
  const letras = await banco
    .select({ g: schema.questoesRevisao.gabarito, n: sql<number>`count(*)` })
    .from(schema.questoesRevisao)
    .where(eq(schema.questoesRevisao.banca, lote.banca))
    .groupBy(schema.questoesRevisao.gabarito);
  const usoLetra = new Map(LETRAS.slice(0, lote.alternativas).split("").map((l) => [l, Number(letras.find((x) => x.g === l)?.n ?? 0)]));
  const concurso = tax.concursos.find((c) => c.id === lote.concurso)!;
  const formato = topico.formatos.find((f) => f.banca === lote.banca);
  const NIVEL = { facil: 1, media: 2, dificil: 3 } as const;

  const linhasQ: (typeof schema.questoesRevisao.$inferInsert & { auto: boolean })[] = [];
  for (const it of itensQ) {
    const { q } = it;
    const codigo = hash("h_", [disciplina, q.enunciado, ...q.alternativas.map((a) => a.texto)]);
    const texto = conteudoQuestao(q.enunciado, q.alternativas);
    const existente = await banco.select({ id: schema.questoes.id }).from(schema.questoes).where(eq(schema.questoes.codigo, codigo));
    if (codigosQ.has(codigo) || existente.length || textosQ.some((t) => semelhanca(t, texto) >= LIMITE_DUPLICATA_QUESTAO)) {
      res.questoes.duplicadas++;
      continue;
    }
    textosQ.push(texto);
    codigosQ.add(codigo);
    // Letra da correta: a menos usada até agora no formato (empate sorteado); erradas em ordem sorteada.
    const sorte = sorteio(`${lote.id}/${q.id}`);
    const menor = Math.min(...usoLetra.values());
    const opcoes = [...usoLetra].filter(([, n]) => n === menor).map(([l]) => l);
    const gabarito = opcoes[Math.floor(sorte() * opcoes.length)]!;
    usoLetra.set(gabarito, (usoLetra.get(gabarito) ?? 0) + 1);
    const erradas = q.alternativas.filter((a) => a.id !== q.id_correta).sort(() => sorte() - 0.5);
    const ordem = [...erradas];
    ordem.splice(LETRAS.indexOf(gabarito), 0, q.alternativas.find((a) => a.id === q.id_correta)!);
    const letraDe = new Map(ordem.map((a, k) => [a.id, LETRAS[k]!]));

    const citacoes = citacoesForaDaLista(q, julgados);
    const alertas = [
      ...citacoes.map((c) => `cita julgado fora da lista: ${c}`),
      ...dispositivosSemNota(q, sensiveis).map((d) => `${d} sem nota`),
      ...trechosAConfirmar(q, sensiveis).map((t) => `a confirmar: ${t}`),
    ];
    const outros = [
      ...sensiveisCitadosQuestao(q, sensiveis).map((d) => `cobra dispositivo sensível: ${d}`),
      ...(q.cita_jurisprudencia ? ["cita jurisprudência"] : []),
      ...(juridicoSemLei ? ["tema jurídico sem texto legal fornecido"] : []),
    ];
    const v = veredito(it.a1.status, it.a2.status, alertas, outros);
    const troca = (t: string | null) => trocarIds(t, letraDe);
    const destaques = (
      [
        ["macete_do_riccardo", q.macete_do_riccardo],
        ["fique_ligado", q.fique_ligado],
        ["cuidado_na_prova", q.cuidado_na_prova],
      ] as const
    ).flatMap(([tipo, t]) => (t ? [{ tipo, texto: troca(t)! }] : []));
    const auditoria: ResultadoAuditoria = {
      justificativa: troca(it.a1.justificativa)!,
      problemas: it.a1.problemas.map((p) => ({ ...p, descricao: troca(p.descricao)! })),
      correcao_sugerida: troca(it.a1.correcao_sugerida),
      gabarito_confere: it.a1.gabarito_confere,
      mais_de_uma_correta: it.a1.mais_de_uma_correta,
      ambiguidade: it.a1.ambiguidade,
      fundamento_confere: it.a1.fundamento_confere,
      citacoes_jurisprudencia: citacoes,
      regenerada: it.regenerada,
      ...(alertas.length ? { alertas } : {}),
      segundo: {
        status: it.a2.status,
        justificativa: troca(it.a2.justificativa)!,
        problemas: it.a2.problemas.map((p) => ({ ...p, descricao: troca(p.descricao)! })),
        correcao_sugerida: troca(it.a2.correcao_sugerida),
      },
      motivos_fila: v.motivos,
    };
    linhasQ.push({
      codigo,
      status: "pendente_revisao",
      origem: "ia",
      statusAuditoria: v.status,
      disciplina,
      assunto: topico.nome,
      subtopico: q.subtema,
      topicoTaxonomia: topico.id,
      concursos: formato?.concursos ?? [lote.concurso],
      banca: lote.banca,
      cargo: concurso.cargo,
      dificuldade: NIVEL[q.dificuldade],
      enunciado: q.enunciado,
      alternativas: ordem.map((a, k) => ({ letra: LETRAS[k]!, texto: a.texto })),
      gabarito,
      comentario: troca(q.comentario_geral)!,
      analiseAlternativas: q.analise_alternativas.map((x) => ({ letra: letraDe.get(x.id)!, correta: x.correta, justificativa: troca(x.justificativa)! })).sort((x, y) => x.letra.localeCompare(y.letra)),
      fundamentoLegal: naoSeAplica(q.fundamento_legal),
      fundamentoJurisprudencial: naoSeAplica(q.fundamento_jurisprudencial),
      observacaoTemporal: naoSeAplica(q.observacao_temporal),
      pegadinha: naoSeAplica(troca(q.pegadinha)),
      destaques: destaques.length ? destaques : null,
      tipoCobranca: q.tipo_cobranca,
      exigenciaCognitiva: q.exigencia_cognitiva,
      palavrasChave: q.palavras_chave,
      leiReferencia: naoSeAplica(q.lei_referencia),
      dataCorteLegislativo: DATA_CORTE,
      auditoria,
      lote: `producao/${lote.id}/${q.id}`,
      criadoEm: new Date(),
      auto: v.motivos.length === 0,
    });
  }

  const existentesF = await banco
    .select({ codigo: schema.flashcardsRevisao.codigo, frente: schema.flashcardsRevisao.frente, verso: schema.flashcardsRevisao.verso })
    .from(schema.flashcardsRevisao)
    .where(eq(schema.flashcardsRevisao.topicoTaxonomia, lote.topico));
  const textosF = existentesF.map((e) => `${e.frente} ${e.verso}`);
  const codigosF = new Set(existentesF.map((e) => e.codigo));
  const linhasF: (typeof schema.flashcardsRevisao.$inferInsert & { auto: boolean })[] = [];
  for (const it of itensF) {
    const { f } = it;
    const codigo = hash("hf_", [disciplina, f.frente]);
    const texto = `${f.frente} ${f.verso}`;
    const existente = await banco.select({ id: schema.flashcards.id }).from(schema.flashcards).where(eq(schema.flashcards.codigo, codigo));
    if (codigosF.has(codigo) || existente.length || textosF.some((t) => semelhanca(t, texto) >= LIMITE_DUPLICATA_FLASHCARD)) {
      res.flashcards.duplicadas++;
      continue;
    }
    textosF.push(texto);
    codigosF.add(codigo);
    const citacoes = citacoesFlashcardForaDaLista(f, julgados);
    const alertas = citacoes.map((c) => `cita julgado fora da lista: ${c}`);
    const outros = [
      ...artigosSensiveisCitados([f.frente, f.verso, f.fundamento_legal], sensiveis).map((d) => `cobra dispositivo sensível: ${d}`),
      ...(f.cita_jurisprudencia ? ["cita jurisprudência"] : []),
      ...(juridicoSemLei ? ["tema jurídico sem texto legal fornecido"] : []),
    ];
    const v = veredito(it.a1.status, it.a2.status, alertas, outros);
    const auditoria: AuditoriaFlashcard = {
      justificativa: it.a1.justificativa,
      problemas: it.a1.problemas,
      correcao_sugerida: it.a1.correcao_sugerida,
      citacoes_jurisprudencia: citacoes,
      regenerado: it.regenerada,
      ...(alertas.length ? { alertas } : {}),
      segundo: { status: it.a2.status, justificativa: it.a2.justificativa, problemas: it.a2.problemas, correcao_sugerida: it.a2.correcao_sugerida },
      motivos_fila: v.motivos,
    };
    linhasF.push({
      codigo,
      status: "pendente_revisao",
      origem: "ia",
      statusAuditoria: v.status,
      disciplina,
      assunto: topico.nome,
      subtopico: f.subtema,
      topicoTaxonomia: topico.id,
      frente: f.frente,
      verso: f.verso,
      leiReferencia: naoSeAplica(f.lei_referencia),
      dataCorteLegislativo: DATA_CORTE,
      auditoria,
      lote: `producao/${lote.id}/${f.id}`,
      criadoEm: new Date(),
      auto: v.motivos.length === 0,
    });
  }

  if (linhasQ.length) await banco.insert(schema.questoesRevisao).values(linhasQ.map(({ auto: _, ...l }) => l)).onConflictDoNothing({ target: schema.questoesRevisao.codigo });
  if (linhasF.length) await banco.insert(schema.flashcardsRevisao).values(linhasF.map(({ auto: _, ...l }) => l)).onConflictDoNothing({ target: schema.flashcardsRevisao.codigo });

  // Aprovação automática: auditor 1 e auditor 2 VALIDADA e nenhuma checagem pendente.
  const autoQ = linhasQ.filter((l) => l.auto).map((l) => l.codigo);
  const autoF = linhasF.filter((l) => l.auto).map((l) => l.codigo);
  if (autoQ.length) {
    const ids = (await banco.select({ id: schema.questoesRevisao.id }).from(schema.questoesRevisao).where(inArray(schema.questoesRevisao.codigo, autoQ))).map((r) => r.id);
    res.questoes.aprovadas = await aprovarQuestoes(banco, ids, "automatico");
  }
  if (autoF.length) {
    const ids = (await banco.select({ id: schema.flashcardsRevisao.id }).from(schema.flashcardsRevisao).where(inArray(schema.flashcardsRevisao.codigo, autoF))).map((r) => r.id);
    res.flashcards.aprovadas = await aprovarFlashcards(banco, ids, "automatico");
  }
  res.questoes.fila = linhasQ.length - res.questoes.aprovadas;
  res.flashcards.fila = linhasF.length - res.flashcards.aprovadas;
  return res;
}

// ---------- avanço do lote ----------

function reprovados<T extends { id: string }>(itens: T[], a1: { id: string; status: string; justificativa: string }[], a2: { id: string; status: string; justificativa: string }[]) {
  return itens
    .filter((x) => a1.find((a) => a.id === x.id)?.status === "REPROVADA" || a2.find((a) => a.id === x.id)?.status === "REPROVADA")
    .map((x) => {
      const m = [a1, a2].flatMap((lista, k) => lista.filter((a) => a.id === x.id && a.status === "REPROVADA").map((a) => `auditor ${k + 1}: ${a.justificativa}`));
      return { id: x.id, motivo: m.join(" | ") };
    });
}

function erroLote(estado: Estado, lote: Lote, arquivo: string, erros: string[]): Acao | null {
  lote.tentativas[arquivo] = (lote.tentativas[arquivo] ?? 0) + 1;
  estado.erros.push({ quando: agoraIso(), lote: lote.id, msg: `${arquivo}: ${erros.slice(0, 3).join("; ")}` });
  if (lote.tentativas[arquivo]! >= MAX_TENTATIVAS) {
    lote.etapa = "falhou";
    lote.erro = `${arquivo} inválido ${MAX_TENTATIVAS} vezes: ${erros.slice(0, 3).join("; ")}`;
    return null;
  }
  return acaoCorrigir(lote, arquivo, erros);
}

/** Avança um lote o máximo possível com os arquivos que já existem e devolve o que falta fazer. */
async function avancar(estado: Estado, lote: Lote): Promise<Acao[]> {
  const dir = pasta(lote.id);
  const tax = lerTaxonomia();
  for (;;) {
    const regen = lote.etapa === "regen_pendente" || lote.etapa === "regen_gerado";
    if (lote.etapa === "pendente" || lote.etapa === "regen_pendente") {
      const arquivo = `${dir}/${regen ? "regen-gerado.json" : "gerado.json"}`;
      if (!existsSync(arquivo)) return [acaoGerar(lote, regen)];
      const { erros, dados } = validarGerado(lote, arquivo, regen ? lote.reprovadas : undefined);
      if (erros.length || !dados) {
        const a = erroLote(estado, lote, arquivo, erros);
        return a ? [a] : [];
      }
      writeFileSync(`${dir}/${regen ? "regen-auditoria-entrada.json" : "auditoria-entrada.json"}`, JSON.stringify(paraAuditoria(dados), null, 2));
      lote.etapa = regen ? "regen_gerado" : "gerado";
      continue;
    }
    if (lote.etapa === "gerado" || lote.etapa === "regen_gerado") {
      const gerado = validarGerado(lote, `${dir}/${regen ? "regen-gerado.json" : "gerado.json"}`, regen ? lote.reprovadas : undefined).dados!;
      const acoes: Acao[] = [];
      const auds: Auditado[] = [];
      for (const n of [1, 2] as const) {
        const arquivo = `${dir}/${regen ? `regen-auditoria-${n}.json` : `auditoria-${n}.json`}`;
        if (!existsSync(arquivo)) {
          acoes.push(acaoAuditar(lote, regen, n));
          continue;
        }
        const { erros, dados } = validarAuditoria(arquivo, gerado);
        if (erros.length || !dados) {
          const a = erroLote(estado, lote, arquivo, erros);
          if (a) acoes.push(a);
          else return [];
        } else auds.push(dados);
      }
      if (acoes.length) return acoes;
      const [a1, a2] = auds as [Auditado, Auditado];
      const rq = reprovados(gerado.questoes, a1.auditorias, a2.auditorias);
      const rf = reprovados(gerado.flashcards, a1.auditorias_flashcards, a2.auditorias_flashcards);
      if (!regen && (rq.length || rf.length)) {
        lote.reprovadas = { questoes: rq.map((x) => x.id), flashcards: rf.map((x) => x.id) };
        const pedido = [...rq, ...rf].map((x) => `- ${x.id}: ${x.motivo}`).join("\n");
        const extra = `## Regeneração
Este pedido substitui itens reprovados na auditoria. Gere SOMENTE: questões ${lote.reprovadas.questoes.join(", ") || "nenhuma"}; flashcards ${lote.reprovadas.flashcards.join(", ") || "nenhum"}, com os mesmos ids (e a mesma dificuldade, nas questões), sobre outros pontos do foco (não reaproveite o caso, o dispositivo e a pegadinha do item reprovado), evitando os problemas apontados:
${pedido}
Na saída, "questoes" e "flashcards" trazem só esses itens (lista vazia quando não houver).`;
        writeFileSync(`${dir}/regen-entrada.md`, await entrada(tax, lote, extra));
        lote.etapa = "regen_pendente";
        continue;
      }
      // Monta a versão final: originais aprovadas + regeneradas que passaram; reprovadas 2x são descartadas.
      const original = validarGerado(lote, `${dir}/gerado.json`).dados!;
      const auditOrig = regen ? [esquemaLoteAuditadoProducao.parse(lerJson(`${dir}/auditoria-1.json`)), esquemaLoteAuditadoProducao.parse(lerJson(`${dir}/auditoria-2.json`))] : [a1, a2];
      const itensQ: ItemQ[] = [];
      const itensF: ItemF[] = [];
      const descartes: { id: string; motivo: string }[] = [];
      for (const q of original.questoes) {
        if (lote.reprovadas.questoes.includes(q.id)) continue;
        itensQ.push({ q, a1: auditOrig[0]!.auditorias.find((a) => a.id === q.id)!, a2: auditOrig[1]!.auditorias.find((a) => a.id === q.id)!, regenerada: false });
      }
      for (const f of original.flashcards) {
        if (lote.reprovadas.flashcards.includes(f.id)) continue;
        itensF.push({ f, a1: auditOrig[0]!.auditorias_flashcards.find((a) => a.id === f.id)!, a2: auditOrig[1]!.auditorias_flashcards.find((a) => a.id === f.id)!, regenerada: false });
      }
      if (regen) {
        for (const q of gerado.questoes) {
          const motivo = rq.find((x) => x.id === q.id)?.motivo;
          if (motivo) descartes.push({ id: q.id, motivo });
          else itensQ.push({ q, a1: a1.auditorias.find((a) => a.id === q.id)!, a2: a2.auditorias.find((a) => a.id === q.id)!, regenerada: true });
        }
        for (const f of gerado.flashcards) {
          const motivo = rf.find((x) => x.id === f.id)?.motivo;
          if (motivo) descartes.push({ id: f.id, motivo });
          else itensF.push({ f, a1: a1.auditorias_flashcards.find((a) => a.id === f.id)!, a2: a2.auditorias_flashcards.find((a) => a.id === f.id)!, regenerada: true });
        }
      }
      lote.resultado = await importarLote(lote, itensQ, itensF, descartes);
      lote.etapa = "concluido";
      lote.concluidoEm = agoraIso();
      return [];
    }
    return [];
  }
}

// ---------- comandos ----------

const argumentos = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = argumentos.indexOf(`--${nome}`);
  return i >= 0 ? argumentos[i + 1] : undefined;
};

function iniciar() {
  const estado = lerEstado();
  for (const e of estado.execucoes.filter((x) => !x.fim)) {
    e.fim = agoraIso();
    e.motivoFim = "substituída por nova execução";
  }
  const exec: Execucao = {
    id: `exec-${agoraIso().replace(/[:.]/g, "-")}`,
    inicio: agoraIso(),
    teto: Number(opcao("teto") ?? 6),
    paralelo: Number(opcao("paralelo") ?? 3),
    lotesIniciados: 0,
  };
  estado.execucoes.push(exec);
  salvarEstado(estado);
  console.log(`Execução ${exec.id}: teto de ${exec.teto} lotes novos, ${exec.paralelo} em paralelo.`);
}

async function proximo() {
  const estado = lerEstado();
  const exec = estado.execucoes.find((e) => !e.fim);
  if (!exec) return console.log(JSON.stringify({ parar: true, motivo: "nenhuma execução aberta: rode 'iniciar' antes" }));
  mkdirSync(PASTA, { recursive: true });
  const tax = lerTaxonomia();
  const acoes: Acao[] = [];
  // 1. Avança os lotes em andamento (inclusive de execuções anteriores que pararam no meio).
  for (const lote of estado.lotes.filter((l) => !["concluido", "falhou"].includes(l.etapa))) {
    try {
      acoes.push(...(await avancar(estado, lote)));
    } catch (e) {
      lote.etapa = "falhou";
      lote.erro = (e as Error).message;
      estado.erros.push({ quando: agoraIso(), lote: lote.id, msg: (e as Error).message });
    }
    salvarEstado(estado);
  }
  // 2. Abre lotes novos enquanto houver vaga no paralelo e no teto da execução.
  let semTopico = false;
  while (estado.lotes.filter((l) => !["concluido", "falhou"].includes(l.etapa)).length < exec.paralelo && exec.lotesIniciados < exec.teto) {
    const lote = await planejarLote(estado, exec);
    if (!lote) {
      semTopico = true;
      break;
    }
    mkdirSync(pasta(lote.id), { recursive: true });
    writeFileSync(`${pasta(lote.id)}/entrada.md`, await entrada(tax, lote));
    estado.lotes.push(lote);
    exec.lotesIniciados++;
    acoes.push(acaoGerar(lote, false));
    salvarEstado(estado);
  }
  const ativos = estado.lotes.filter((l) => !["concluido", "falhou"].includes(l.etapa));
  if (!acoes.length && !ativos.length) {
    exec.fim = agoraIso();
    exec.motivoFim = semTopico ? "nada pendente" : "teto atingido";
    salvarEstado(estado);
    return console.log(JSON.stringify({ parar: true, motivo: exec.motivoFim, resumo: resumoExecucao(estado, exec) }, null, 2));
  }
  console.log(JSON.stringify({ parar: false, acoes }, null, 2));
}

function resumoExecucao(estado: Estado, exec: Execucao) {
  const lotes = estado.lotes.filter((l) => l.execucao === exec.id);
  return somar(lotes);
}

function somar(lotes: Lote[]) {
  const t = { lotes: lotes.length, concluidos: 0, falharam: 0, questoes: vazio(), flashcards: vazio() };
  for (const l of lotes) {
    if (l.etapa === "concluido") t.concluidos++;
    if (l.etapa === "falhou") t.falharam++;
    for (const k of ["questoes", "flashcards"] as const) for (const c of Object.keys(t[k]) as (keyof Contagem)[]) t[k][c] += l.resultado?.[k][c] ?? 0;
  }
  return t;
}

function conferir(id: string, arquivo: string) {
  const lote = lerEstado().lotes.find((l) => l.id === id);
  if (!lote) throw new Error(`lote ${id} não existe`);
  const regen = arquivo.includes("regen-");
  const ehAuditoria = /auditoria-\d\.json$/.test(arquivo);
  const r = ehAuditoria
    ? validarAuditoria(arquivo, esquemaLoteProducao.parse(lerJson(`${pasta(id)}/${regen ? "regen-gerado.json" : "gerado.json"}`)))
    : validarGerado(lote, arquivo, regen ? lote.reprovadas : undefined);
  if (r.erros.length) {
    console.log(`INVALIDO:\n  ${r.erros.join("\n  ")}`);
    process.exitCode = 1;
  } else console.log("OK");
}

function status() {
  const estado = lerEstado();
  const exec = estado.execucoes.at(-1);
  for (const l of estado.lotes.slice(-20)) console.log(`${l.id.padEnd(70)} ${l.etapa.padEnd(15)} ${l.resultado ? `q ${l.resultado.questoes.aprovadas}/${l.resultado.questoes.geradas} aprovadas, f ${l.resultado.flashcards.aprovadas}/${l.resultado.flashcards.geradas}` : (l.erro ?? "")}`);
  if (exec) console.log(`Última execução: ${exec.id} (${exec.fim ? `encerrada: ${exec.motivoFim}` : "aberta"}), ${exec.lotesIniciados}/${exec.teto} lotes.`);
}

// ---------- fila prevista e cancelamento ----------

/** Mostra os próximos tópicos que o planejador escolheria (sem criar nada). */
async function fila(n: number) {
  const estado = lerEstado();
  const ativos = estado.lotes.filter((l) => !["concluido", "falhou"].includes(l.etapa));
  const simulado: Estado = JSON.parse(JSON.stringify(estado));
  const exec: Execucao = { id: "simulacao", inicio: agoraIso(), teto: n, paralelo: n, lotesIniciados: 0 };
  const previstos: Lote[] = [];
  for (let i = 0; i < n; i++) {
    const lote = await planejarLote(simulado, exec);
    if (!lote) break;
    lote.criadoEm = new Date(Date.now() + (i + 1) * 1000).toISOString();
    simulado.lotes.push(lote);
    previstos.push(lote);
  }
  const tax = lerTaxonomia();
  const nome = (id: string) => {
    const { disciplina, topico } = acharTopico(tax, id);
    return `${disciplina} > ${topico.nome}`;
  };
  if (ativos.length) console.log(`Em andamento (seguem primeiro):\n${ativos.map((l) => `  ${l.id} (${l.etapa}): ${nome(l.topico)}`).join("\n")}`);
  console.log(`Próximos lotes novos:\n${previstos.map((l, i) => `  ${i + 1}. ${nome(l.topico)} (${l.banca}, foco: ${l.foco})`).join("\n")}`);
}

/** Cancela um lote que ainda não produziu nada (só o pedido existe). */
function cancelar(id: string) {
  const estado = lerEstado();
  const lote = estado.lotes.find((l) => l.id === id);
  if (!lote) throw new Error(`lote ${id} não existe`);
  if (lote.etapa !== "pendente" || existsSync(`${pasta(id)}/gerado.json`) || lote.reaberto)
    throw new Error(`lote ${id} já produziu arquivos (ou foi reaberto); não dá para cancelar`);
  estado.lotes = estado.lotes.filter((l) => l.id !== id);
  salvarEstado(estado);
  rmSync(pasta(id), { recursive: true, force: true });
  console.log(`${id}: cancelado`);
}

// ---------- reabrir um lote concluído (reprocessar com regras novas) ----------

/**
 * Tira do local.db o que o lote importou (fila e, se aprovado, questoes/flashcards), guarda os arquivos
 * como *.vN e devolve o lote para "pendente" com um pedido de reescrita das questões atuais.
 * Recusa se algum aluno já respondeu ou revisou um item do lote.
 */
async function reabrir(id: string) {
  const estado = lerEstado();
  const lote = estado.lotes.find((l) => l.id === id);
  if (!lote) throw new Error(`lote ${id} não existe`);
  if (lote.etapa !== "concluido") throw new Error(`lote ${id} está em "${lote.etapa}"; só lote concluído pode ser reaberto`);
  const dir = pasta(id);
  const filtroQ = like(schema.questoesRevisao.lote, `producao/${id}/%`);
  const filtroF = like(schema.flashcardsRevisao.lote, `producao/${id}/%`);
  const codigosQ = (await banco.select({ c: schema.questoesRevisao.codigo }).from(schema.questoesRevisao).where(filtroQ)).map((r) => r.c);
  const codigosF = (await banco.select({ c: schema.flashcardsRevisao.codigo }).from(schema.flashcardsRevisao).where(filtroF)).map((r) => r.c);
  const idsQ = codigosQ.length ? (await banco.select({ id: schema.questoes.id }).from(schema.questoes).where(inArray(schema.questoes.codigo, codigosQ))).map((r) => r.id) : [];
  const idsF = codigosF.length ? (await banco.select({ id: schema.flashcards.id }).from(schema.flashcards).where(inArray(schema.flashcards.codigo, codigosF))).map((r) => r.id) : [];
  const usadas = idsQ.length ? await banco.select({ id: schema.respostas.id }).from(schema.respostas).where(inArray(schema.respostas.questaoId, idsQ)).limit(1) : [];
  const revistos = idsF.length ? await banco.select({ id: schema.revisoesFlashcard.flashcardId }).from(schema.revisoesFlashcard).where(inArray(schema.revisoesFlashcard.flashcardId, idsF)).limit(1) : [];
  if (usadas.length || revistos.length) throw new Error(`lote ${id} já tem respostas ou revisões de alunos; não dá para reabrir`);

  // Versão atual dos itens (originais + regenerados que passaram), para o gerador reescrever.
  const original = validarGerado(lote, `${dir}/gerado.json`).dados!;
  const regen = existsSync(`${dir}/regen-gerado.json`) ? esquemaLoteProducao.parse(lerJson(`${dir}/regen-gerado.json`)) : null;
  const descartados = new Set((lote.resultado?.descartes ?? []).map((d) => d.id));
  const questoes = original.questoes.map((q) => regen?.questoes.find((r) => r.id === q.id) ?? q).filter((q) => !descartados.has(q.id));
  const flashcards = original.flashcards.map((f) => regen?.flashcards.find((r) => r.id === f.id) ?? f).filter((f) => !descartados.has(f.id));
  const problemas = [...questoes.flatMap((q) => conferirQuestao(q, lote.alternativas)), ...conferirLote(questoes)];

  if (idsQ.length) await banco.delete(schema.questoes).where(inArray(schema.questoes.id, idsQ));
  if (idsF.length) await banco.delete(schema.flashcards).where(inArray(schema.flashcards.id, idsF));
  await banco.delete(schema.questoesRevisao).where(filtroQ);
  await banco.delete(schema.flashcardsRevisao).where(filtroF);
  const { recontar } = await import("../lib/recontar");
  await recontar(banco);

  const versao = (lote.reaberto ?? 0) + 1;
  for (const nome of ["gerado.json", "auditoria-entrada.json", "auditoria-1.json", "auditoria-2.json", "regen-entrada.md", "regen-gerado.json", "regen-auditoria-entrada.json", "regen-auditoria-1.json", "regen-auditoria-2.json", "entrada.md"]) {
    const caminho = `${dir}/${nome}`;
    if (existsSync(caminho)) renameSync(caminho, caminho.replace(/\.(json|md)$/, `.v${versao}.$1`));
  }
  const tax = lerTaxonomia();
  const extra = `## Reescrita do lote
Este lote já foi gerado e auditado, mas não passa nas regras novas de tamanho e tom das alternativas. Reescreva as ${questoes.length} questões abaixo${questoes.length < QUESTOES_POR_LOTE ? ` e crie ${QUESTOES_POR_LOTE - questoes.length} novas até completar q01 a q10` : ""}, mantendo em cada uma: id, tema, subtema, dificuldade, o ponto cobrado e a alternativa correta (mesmo conteúdo). Mude principalmente as alternativas, para que nenhuma pista denuncie a resposta, e atualize a análise das alternativas e o comentário. Mantenha os flashcards (ajuste só se alguma regra pedir).
Problemas encontrados na versão atual:
${problemas.map((p) => `- ${p}`).join("\n") || "- nenhum apontado em código; equilibre mesmo assim"}

## Versão atual (JSON)
${JSON.stringify({ questoes, flashcards }, null, 2)}`;
  writeFileSync(`${dir}/entrada.md`, await entrada(tax, lote, extra));
  lote.etapa = "pendente";
  lote.tentativas = {};
  lote.reprovadas = { questoes: [], flashcards: [] };
  lote.reaberto = versao;
  delete lote.resultado;
  delete lote.concluidoEm;
  salvarEstado(estado);
  console.log(`${id}: reaberto (versão ${versao}); ${idsQ.length} questões e ${idsF.length} flashcards tirados do banco; ${problemas.length} problemas para corrigir.`);
}

// ---------- relatório da noite e notificação ----------

/** Noite D vai de D 12h até D+1 12h (horário do computador). Sem data: a noite que acabou de terminar. */
function janela(data?: string) {
  const base = data ? new Date(`${data}T12:00:00`) : new Date();
  if (!data) {
    base.setHours(12, 0, 0, 0);
    if (new Date().getHours() < 12) base.setDate(base.getDate() - 1);
  }
  const fim = new Date(base);
  fim.setDate(fim.getDate() + 1);
  const rotulo = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
  return { inicio: base, fim, rotulo };
}

/** Pistas involuntárias nas questões importadas dos lotes: correta mais curta, mais longa, termos absolutos. */
async function metricasPistas(lotes: string[]) {
  if (!lotes.length) return null;
  const linhas = await banco
    .select({ alternativas: schema.questoesRevisao.alternativas, gabarito: schema.questoesRevisao.gabarito })
    .from(schema.questoesRevisao)
    .where(or(...lotes.map((id) => like(schema.questoesRevisao.lote, `producao/${id}/%`))));
  if (!linhas.length) return null;
  let curta = 0;
  let longa = 0;
  let soErradas = 0;
  let absErradas = 0;
  let totalErradas = 0;
  let absCorreta = 0;
  let pena = 0;
  for (const l of linhas) {
    const q = { alternativas: l.alternativas.map((a) => ({ id: a.letra, texto: a.texto })), id_correta: l.gabarito } as QuestaoGerada;
    const t = tamanhoDaCorreta(q);
    if (t.maisCurta) curta++;
    if (t.maisLonga) longa++;
    if (absolutoSoNasErradas(q)) soErradas++;
    if (cobraPena(l.alternativas)) pena++;
    const erradas = l.alternativas.filter((a) => a.letra !== l.gabarito);
    totalErradas += erradas.length;
    absErradas += erradas.filter((a) => PADRAO_ABSOLUTO.test(a.texto)).length;
    if (PADRAO_ABSOLUTO.test(l.alternativas.find((a) => a.letra === l.gabarito)?.texto ?? "")) absCorreta++;
  }
  const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(d, 1))}%`;
  const n = linhas.length;
  return {
    n,
    maisCurta: pct(curta, n),
    maisLonga: pct(longa, n),
    absolutosErradas: pct(absErradas, totalErradas),
    absolutosCorreta: pct(absCorreta, n),
    absolutoSoNasErradas: pct(soErradas, n),
    cobraPena: pct(pena, n),
  };
}

async function relatorio(data?: string) {
  const { inicio, fim, rotulo } = janela(data);
  const estado = lerEstado();
  const dentro = (iso?: string) => Boolean(iso) && new Date(iso!) >= inicio && new Date(iso!) < fim;
  const lotes = estado.lotes.filter((l) => dentro(l.concluidoEm) || (l.etapa === "falhou" && dentro(l.criadoEm)));
  const erros = estado.erros.filter((e) => dentro(e.quando));
  const log = `${PASTA_RELATORIOS}/${rotulo}.log`;
  const limites = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter((l) => /LIMITE/.test(l)).length : 0;
  const t = somar(lotes);
  const pendentes = estado.lotes.filter((l) => !["concluido", "falhou"].includes(l.etapa)).length;
  const linha = (c: Contagem) =>
    `${c.geradas} geradas, ${c.aprovadas} aprovadas, ${c.fila} retidas${c.descartadas ? `, ${c.descartadas} descartadas` : ""}${c.duplicadas ? `, ${c.duplicadas} duplicadas` : ""}`;
  const porTopico = new Map<string, Lote[]>();
  for (const l of lotes) porTopico.set(l.topico, [...(porTopico.get(l.topico) ?? []), l]);
  const m = await metricasPistas(lotes.filter((l) => l.etapa === "concluido").map((l) => l.id));
  const pistas = m
    ? `## Pistas involuntárias (${m.n} questões importadas)
| Correta é a mais curta | Correta é a mais longa | Termo absoluto nas erradas | Termo absoluto na correta | Questões com absoluto só nas erradas | Questões sobre quantidade de pena |
|---|---|---|---|---|---|
| ${m.maisCurta} | ${m.maisLonga} | ${m.absolutosErradas} das alternativas | ${m.absolutosCorreta} | ${m.absolutoSoNasErradas} | ${m.cobraPena} (meta: até 10%) |

Referência sem pista: mais curta e mais longa perto de 25% (4 alternativas) ou 20% (5); absolutos parecidos entre erradas e correta.
`
    : "";
  const md = `# Produção da noite ${rotulo.split("-").reverse().join("/")}

| | Geradas | Aprovadas sozinhas | Retidas na fila | Descartadas | Duplicadas |
|---|---|---|---|---|---|
| Questões | ${t.questoes.geradas} | ${t.questoes.aprovadas} | ${t.questoes.fila} | ${t.questoes.descartadas} | ${t.questoes.duplicadas} |
| Flashcards | ${t.flashcards.geradas} | ${t.flashcards.aprovadas} | ${t.flashcards.fila} | ${t.flashcards.descartadas} | ${t.flashcards.duplicadas} |

- Lotes concluídos: ${t.concluidos}; com falha: ${t.falharam}; ainda em andamento: ${pendentes}
- Erros de formato corrigidos ou não: ${erros.length}; pausas por limite de uso: ${limites}
- Revisar na fila: /admin/revisao (aba Questões e aba Flashcards)

${pistas}
## Por tópico
${[...porTopico].map(([topico, ls]) => `- ${topico}: ${ls.map((l) => (l.resultado ? `${l.id.split("-").at(-1)} (q ${l.resultado.questoes.aprovadas}/${l.resultado.questoes.geradas}, f ${l.resultado.flashcards.aprovadas}/${l.resultado.flashcards.geradas})` : `${l.id.split("-").at(-1)} falhou`)).join(", ")}`).join("\n") || "- nenhum lote concluído"}

## Descartes (reprovados 2 vezes)
${lotes.flatMap((l) => (l.resultado?.descartes ?? []).map((d) => `- ${l.id}/${d.id}: ${d.motivo}`)).join("\n") || "- nenhum"}

## Erros
${[...erros.map((e) => `- ${e.quando.slice(11, 16)} ${e.lote ?? ""}: ${e.msg}`), ...lotes.filter((l) => l.erro).map((l) => `- ${l.id}: ${l.erro}`)].join("\n") || "- nenhum"}
`;
  mkdirSync(PASTA_RELATORIOS, { recursive: true });
  writeFileSync(`${PASTA_RELATORIOS}/${rotulo}.md`, md);
  const curto = `Questões: ${linha(t.questoes)}. Flashcards: ${linha(t.flashcards)}. Erros: ${erros.length + t.falharam}.${m ? ` Pistas: correta mais curta ${m.maisCurta}, mais longa ${m.maisLonga}, absoluto só nas erradas ${m.absolutoSoNasErradas}.` : ""}`;
  return { rotulo, arquivo: `${PASTA_RELATORIOS}/${rotulo}.md`, curto };
}

async function notificar(data?: string, teste = false) {
  // Só o tópico do ntfy vem do .env.local (NTFY_TOPICO); nada de banco.
  const { config } = await import("dotenv");
  const env: Record<string, string> = {};
  config({ path: ".env.local", processEnv: env, quiet: true });
  const topico = env.NTFY_TOPICO ?? process.env.NTFY_TOPICO;
  const r = await relatorio(data);
  const titulo = teste ? `Teste: produção ${r.rotulo.split("-").reverse().join("/")}` : `Produção da noite ${r.rotulo.split("-").reverse().join("/")}`;
  if (!topico) {
    console.log(`Sem NTFY_TOPICO no .env.local; notificação não enviada.\n${titulo}: ${r.curto}`);
    return;
  }
  // Publicação em JSON: o título vai no corpo (cabeçalho HTTP não leva acento).
  const resp = await fetch("https://ntfy.sh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: topico, title: titulo, message: r.curto, tags: ["books"] }),
  });
  const corpo = (await resp.json().catch(() => ({}))) as { id?: string };
  console.log(`Notificação ${resp.ok ? "enviada" : `falhou (${resp.status})`}${corpo.id ? ` (id ${corpo.id})` : ""}: ${titulo}: ${r.curto}`);
}

const direto = /questoes[\\/]producao\.ts$/.test(process.argv[1] ?? "");
const [comando, a1, a2] = direto ? argumentos : [];
if (comando === "iniciar") iniciar();
else if (comando === "proximo") await proximo();
else if (comando === "conferir" && a1 && a2) conferir(a1, a2);
else if (comando === "status") status();
else if (comando === "reabrir" && a1) await reabrir(a1);
else if (comando === "cancelar" && a1) cancelar(a1);
else if (comando === "fila") await fila(Number(opcao("n") ?? 6));
else if (comando === "relatorio") {
  const r = await relatorio(opcao("data"));
  console.log(`${r.arquivo}\n${r.curto}`);
} else if (comando === "notificar") await notificar(opcao("data"), argumentos.includes("--teste"));
else if (comando === "log" && a1) {
  // Usado pelo rodar-noite.ps1: anota uma linha no log da noite.
  mkdirSync(PASTA_RELATORIOS, { recursive: true });
  appendFileSync(`${PASTA_RELATORIOS}/${janela().rotulo}.log`, `${new Date().toLocaleString("pt-BR")} ${argumentos.slice(1).join(" ")}\n`);
} else if (comando) {
  console.log("Comandos: iniciar [--teto N] [--paralelo N] | proximo | conferir <lote> <arquivo> | status | reabrir <lote> | relatorio [--data D] | notificar [--data D] [--teste] | log <texto>");
  process.exitCode = 1;
}
// Evita aviso de importação sem uso quando o filtro "ne" não é usado em alguma versão.
void ne;
