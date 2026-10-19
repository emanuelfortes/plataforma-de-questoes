// Fecha o piloto: junta os lotes concluídos, troca as reprovadas pelas regeneradas, aplica a
// checagem de jurisprudência, embaralha as alternativas equilibrando as letras do gabarito,
// deduplica, importa em questoes_revisao e gera data/piloto/revisao.html.
//
//   npx tsx scripts/questoes/finalizar.ts               importa no local.db
//   npx tsx scripts/questoes/finalizar.ts --producao    importa no banco do .env.local (Turso)
//   npx tsx scripts/questoes/finalizar.ts --sem-importar só gera o relatório
//
// Pode rodar de novo: o embaralhamento é determinístico e a importação ignora códigos já gravados.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { and, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { questoesRevisao, type ResultadoAuditoria } from "../../src/db/schema/revisao";
import { normalizar, semelhanca } from "../../src/lib/catalogo";
import { acharTopico, lerTaxonomia } from "./contexto";
import { esquemaLoteAuditado, esquemaLoteGerado, type Auditoria, type QuestaoGerada } from "./esquema";
import { DATA_CORTE, lerProgresso, pastaLote, statusFinal, type Lote } from "./piloto";
import { ajusteAprovado } from "./ajustes";
import { tamanhoDaCorreta } from "./esquema";

const argumentos = process.argv.slice(2);
const PRODUCAO = argumentos.includes("--producao");
const SEM_IMPORTAR = argumentos.includes("--sem-importar");
const LETRAS = "ABCDE";
const NIVEL = { facil: 1, media: 2, dificil: 3 } as const;

type Item = {
  lote: Lote;
  q: QuestaoGerada;
  a: Auditoria;
  status: string; // status final (auditor + checagem de jurisprudência), ou DESCARTADA / SUBSTITUIDA
  citacoes: string[];
  semNota?: string[];
  regenerada: boolean;
  ajuste?: { motivos: string[]; reprovado: string | null };
};

// Sorteio determinístico (mesma entrada, mesmo resultado).
function sorteador(semente: string) {
  let s = createHash("sha256").update(semente).digest().readUInt32LE(0);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar<T>(lista: T[], sorte: () => number) {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

const lerJson = (c: string) => JSON.parse(readFileSync(c, "utf8"));

// 1. Junta os lotes.
const progresso = lerProgresso();
const tax = lerTaxonomia();
const itens: Item[] = [];
const pendentes = progresso.lotes.filter((l) => l.etapa !== "concluido").map((l) => `${l.id} (${l.etapa})`);
if (pendentes.length) console.log(`Atenção: lotes ainda não concluídos ficam de fora: ${pendentes.join(", ")}`);

for (const lote of progresso.lotes.filter((l) => l.etapa === "concluido")) {
  const dir = pastaLote(lote.id);
  const gerado = esquemaLoteGerado.parse(lerJson(`${dir}/gerado.json`)).questoes;
  const auditoria = new Map(esquemaLoteAuditado.parse(lerJson(`${dir}/auditoria.json`)).auditorias.map((a) => [a.id, a]));
  const regen = lote.reprovadas.length && existsSync(`${dir}/regen-gerado.json`)
    ? {
        q: new Map(esquemaLoteGerado.parse(lerJson(`${dir}/regen-gerado.json`)).questoes.map((q) => [q.id, q])),
        a: new Map(esquemaLoteAuditado.parse(lerJson(`${dir}/regen-auditoria.json`)).auditorias.map((a) => [a.id, a])),
      }
    : null;
  for (const q of gerado) {
    const a = auditoria.get(q.id)!;
    if (lote.reprovadas.includes(q.id)) {
      // A versão original reprovada entra no relatório (conta na taxa de reprovação), não no banco.
      itens.push({ lote, q, a, status: "SUBSTITUIDA", citacoes: [], regenerada: false });
      const nq = regen?.q.get(q.id);
      const na = regen?.a.get(q.id);
      if (!nq || !na) continue;
      const descartada = lote.descartadas.some((d) => d.id === q.id);
      itens.push(descartada ? { lote, q: nq, a: na, regenerada: true, status: "DESCARTADA", citacoes: [] } : comAjuste({ lote, q: nq, a: na, regenerada: true }));
    } else itens.push(comAjuste({ lote, q, a, regenerada: false }));
  }
}

/** Troca pela versão ajustada (ajustes.ts) quando o auditor do ajuste aprovou; se reprovou, mantém a anterior para conferência. */
function comAjuste(base: Omit<Item, "status" | "citacoes">): Item {
  const aj = ajusteAprovado(base.lote.id, base.q.id);
  if (aj && "q" in aj) return { ...base, q: aj.q, a: aj.a, ajuste: { motivos: aj.motivos, reprovado: null }, ...statusFinal(aj.q, aj.a, base.lote.topico) };
  const final = statusFinal(base.q, base.a, base.lote.topico);
  if (aj && "reprovado" in aj)
    return {
      ...base,
      ...final,
      status: final.status === "REPROVADA" ? final.status : "NECESSITA_DE_CONFERENCIA",
      a: { ...base.a, justificativa: `O ajuste desta questão foi reprovado (${aj.reprovado}); ficou a versão anterior. ${base.a.justificativa}` },
      ajuste: { motivos: [], reprovado: aj.reprovado },
    };
  return { ...base, ...final };
}

// 2. Deduplica entre as que vão para o banco: mesmo conteúdo ou enunciado muito parecido no mesmo tópico.
const ORDEM_STATUS = ["VALIDADA", "VALIDADA_COM_RESSALVA", "NECESSITA_DE_CONFERENCIA"];
const aproveitaveis = itens.filter((i) => ORDEM_STATUS.includes(i.status)).sort((x, y) => ORDEM_STATUS.indexOf(x.status) - ORDEM_STATUS.indexOf(y.status));
const mantidas: Item[] = [];
// Compara enunciado e alternativas juntos: em Português o comando costuma ser igual ("Assinale a frase...")
// e o conteúdo está nas alternativas.
// Calibrado no piloto: acima de 0,775 os pares eram o mesmo dispositivo cobrado com o mesmo tipo de caso.
const LIMITE_DUPLICATA = 0.775;
const conteudo = (q: QuestaoGerada) => [q.enunciado, ...q.alternativas.map((a) => a.texto).sort()].join(" ");
for (const item of aproveitaveis) {
  const igual = mantidas.find((m) => m.lote.topico === item.lote.topico && semelhanca(conteudo(m.q), conteudo(item.q)) >= LIMITE_DUPLICATA);
  if (igual) {
    item.status = "DUPLICADA";
    item.a = { ...item.a, justificativa: `Duplicada de ${igual.lote.id}/${igual.q.id}. ${item.a.justificativa}` };
  } else mantidas.push(item);
}

// 3. Embaralha e equilibra: por formato (4 ou 5 alternativas), as letras do gabarito saem de um
// baralho com o mesmo número de cada letra, e as erradas ficam em ordem sorteada.
type Pronta = Item & { alternativas: { letra: string; texto: string }[]; gabarito: string; letraDe: Map<string, string> };
const prontas: Pronta[] = [];
const prontaDe = new Map<Item, Pronta>();
for (const n of [...new Set(mantidas.map((m) => m.lote.alternativas))]) {
  const grupo = mantidas.filter((m) => m.lote.alternativas === n);
  const sorte = sorteador(`gabaritos-${n}`);
  const baralho = embaralhar(Array.from({ length: grupo.length }, (_, i) => LETRAS[i % n]!), sorte);
  grupo.forEach((item, i) => {
    const alvo = LETRAS.indexOf(baralho[i]!);
    const erradas = embaralhar(item.q.alternativas.filter((a) => a.id !== item.q.id_correta), sorteador(`${item.lote.id}-${item.q.id}`));
    const ordem = [...erradas];
    ordem.splice(alvo, 0, item.q.alternativas.find((a) => a.id === item.q.id_correta)!);
    const letraDe = new Map(ordem.map((a, k) => [a.id, LETRAS[k]!]));
    const pronta = { ...item, letraDe, gabarito: baralho[i]!, alternativas: ordem.map((a, k) => ({ letra: LETRAS[k]!, texto: a.texto })) };
    prontas.push(pronta);
    prontaDe.set(item, pronta);
  });
}
// Textos que citem os ids internos (a1, a2...) passam a citar a letra final.
const trocarIds = (t: string | null, letraDe: Map<string, string>) =>
  t === null ? null : t.replace(/\b(?:alternativa\s+)?(a[1-5])\b/gi, (m, id: string) => (letraDe.has(id.toLowerCase()) ? `alternativa ${letraDe.get(id.toLowerCase())}` : m));
// "Não se aplica" (às vezes com explicação: "Não se aplica: disciplina sem lei...") vira vazio.
const naoSeAplica = (t: string) => (/^n[ãa]o se aplica\b/i.test(t.trim()) ? null : t);

function codigo(disciplina: string, q: QuestaoGerada) {
  const partes = [disciplina, q.enunciado, ...q.alternativas.map((a) => a.texto)];
  return `h_${createHash("sha256").update(partes.map(normalizar).join("\u0000")).digest("hex").slice(0, 24)}`;
}

const linhas = prontas.map((p) => {
  const { disciplina, topico } = acharTopico(tax, p.lote.topico);
  const concurso = tax.concursos.find((c) => c.id === p.lote.concurso)!;
  const formato = topico.formatos.find((f) => f.banca === p.lote.banca);
  const destaques = (
    [
      ["macete_do_riccardo", p.q.macete_do_riccardo],
      ["fique_ligado", p.q.fique_ligado],
      ["cuidado_na_prova", p.q.cuidado_na_prova],
    ] as const
  ).flatMap(([tipo, texto]) => (texto ? [{ tipo, texto: trocarIds(texto, p.letraDe)! }] : []));
  const auditoria: ResultadoAuditoria = {
    // O auditor escreve com os ids internos (a1, a2...); aqui viram as letras embaralhadas que o revisor vê.
    justificativa: trocarIds(p.a.justificativa, p.letraDe)!,
    problemas: p.a.problemas.map((x) => ({ ...x, descricao: trocarIds(x.descricao, p.letraDe)! })),
    correcao_sugerida: trocarIds(p.a.correcao_sugerida, p.letraDe),
    gabarito_confere: p.a.gabarito_confere,
    mais_de_uma_correta: p.a.mais_de_uma_correta,
    ambiguidade: p.a.ambiguidade,
    fundamento_confere: p.a.fundamento_confere,
    citacoes_jurisprudencia: p.citacoes,
    regenerada: p.regenerada,
    ...(p.ajuste ? { ajuste: { ...p.ajuste, motivos: p.ajuste.motivos.map((m) => trocarIds(m, p.letraDe)!) } } : {}),
    ...(p.semNota?.length ? { alertas: p.semNota } : {}),
  };
  return {
    codigo: codigo(disciplina, p.q),
    status: "pendente_revisao",
    origem: "ia",
    statusAuditoria: p.status,
    disciplina,
    assunto: topico.nome,
    subtopico: p.q.subtema,
    topicoTaxonomia: topico.id,
    concursos: formato?.concursos ?? [p.lote.concurso],
    banca: p.lote.banca,
    cargo: concurso.cargo,
    dificuldade: NIVEL[p.q.dificuldade],
    enunciado: p.q.enunciado,
    alternativas: p.alternativas,
    gabarito: p.gabarito,
    comentario: trocarIds(p.q.comentario_geral, p.letraDe)!,
    analiseAlternativas: p.q.analise_alternativas
      .map((x) => ({ letra: p.letraDe.get(x.id)!, correta: x.correta, justificativa: trocarIds(x.justificativa, p.letraDe)! }))
      .sort((x, y) => x.letra.localeCompare(y.letra)),
    fundamentoLegal: naoSeAplica(p.q.fundamento_legal),
    fundamentoJurisprudencial: naoSeAplica(p.q.fundamento_jurisprudencial),
    observacaoTemporal: naoSeAplica(p.q.observacao_temporal),
    pegadinha: naoSeAplica(trocarIds(p.q.pegadinha, p.letraDe)!),
    destaques: destaques.length ? destaques : null,
    tipoCobranca: p.q.tipo_cobranca,
    exigenciaCognitiva: p.q.exigencia_cognitiva,
    palavrasChave: p.q.palavras_chave,
    leiReferencia: naoSeAplica(p.q.lei_referencia),
    dataCorteLegislativo: DATA_CORTE,
    auditoria,
    lote: `piloto/${p.lote.id}/${p.q.id}`,
    criadoEm: new Date(),
  };
});
// Mesmo conteúdo exato (impressão digital) dentro do próprio piloto.
const unicas = [...new Map(linhas.map((l) => [l.codigo, l])).values()];

// 4. Importa.
if (!SEM_IMPORTAR) {
  if (PRODUCAO) await import("../_env");
  const url = PRODUCAO ? process.env.TURSO_DATABASE_URL : "file:local.db";
  if (!url) throw new Error("TURSO_DATABASE_URL ausente no .env.local");
  const banco = drizzle(createClient({ url, authToken: PRODUCAO ? process.env.TURSO_AUTH_TOKEN || undefined : undefined }));
  // Questões do piloto ainda não revisadas são substituídas pela versão atual (um ajuste muda o
  // conteúdo e, com ele, o código). As já aprovadas ou rejeitadas não mudam nem voltam.
  const apagadas = await banco.delete(questoesRevisao).where(and(like(questoesRevisao.lote, "piloto/%"), eq(questoesRevisao.status, "pendente_revisao")));
  const decididas = new Set(
    (await banco.select({ lote: questoesRevisao.lote }).from(questoesRevisao).where(like(questoesRevisao.lote, "piloto/%"))).map((r) => r.lote),
  );
  const novas = unicas.filter((l) => !decididas.has(l.lote));
  let gravadas = 0;
  for (let i = 0; i < novas.length; i += 500) {
    const r = await banco.insert(questoesRevisao).values(novas.slice(i, i + 500)).onConflictDoNothing({ target: questoesRevisao.codigo });
    gravadas += r.rowsAffected;
  }
  console.log(
    `questoes_revisao (${PRODUCAO ? "produção" : "local.db"}): ${apagadas.rowsAffected} pendentes substituídas, ${gravadas} gravadas, ${decididas.size} já revisadas mantidas.`,
  );
}

// 5. Relatório.
const porTopico = new Map<string, { nome: string; geradas: number; reprovadas1: number; descartadas: number; aproveitadas: number }>();
for (const i of itens) {
  const nome = acharTopico(tax, i.lote.topico).topico.nome;
  const t = porTopico.get(nome) ?? { nome, geradas: 0, reprovadas1: 0, descartadas: 0, aproveitadas: 0 };
  if (!i.regenerada) t.geradas++;
  if (i.status === "SUBSTITUIDA") t.reprovadas1++;
  if (i.status === "DESCARTADA") t.descartadas++;
  if (ORDEM_STATUS.includes(i.status)) t.aproveitadas++;
  porTopico.set(nome, t);
}
const contagemStatus = new Map<string, number>();
for (const i of itens) contagemStatus.set(i.status, (contagemStatus.get(i.status) ?? 0) + 1);

const esc = (t: string | null | undefined) => (t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ROTULO: Record<string, string> = {
  VALIDADA: "Validada",
  VALIDADA_COM_RESSALVA: "Validada com ressalva",
  NECESSITA_DE_CONFERENCIA: "Necessita de conferência",
  SUBSTITUIDA: "Reprovada (regenerada)",
  DESCARTADA: "Descartada (reprovada 2 vezes)",
  DUPLICADA: "Duplicada",
};

const cartoes = itens
  .map((i) => {
    const p = prontaDe.get(i);
    const nomeTopico = acharTopico(tax, i.lote.topico).topico.nome;
    const alts = p
      ? p.alternativas.map((a) => ({ rotulo: a.letra, texto: a.texto, correta: a.letra === p.gabarito, just: i.q.analise_alternativas.find((x) => p.letraDe.get(x.id) === a.letra)?.justificativa }))
      : i.q.alternativas.map((a) => ({ rotulo: a.id, texto: a.texto, correta: a.id === i.q.id_correta, just: i.q.analise_alternativas.find((x) => x.id === a.id)?.justificativa }));
    const troca = (t: string | null) => (p ? trocarIds(t, p.letraDe) : t);
    const problemas = i.a.problemas.map((x) => `<li><b>${esc(x.tipo)}</b> (${esc(x.gravidade)}): ${esc(troca(x.descricao))}</li>`).join("");
    const destaques = [
      ["Macete do Riccardo", i.q.macete_do_riccardo],
      ["Fique ligado", i.q.fique_ligado],
      ["Cuidado na prova", i.q.cuidado_na_prova],
    ].filter(([, t]) => t).map(([r, t]) => `<p><b>${r}:</b> ${esc(troca(t!))}</p>`).join("");
    return `<article class="q" data-topico="${esc(nomeTopico)}" data-status="${i.status}">
  <header><span class="selo s-${i.status}">${ROTULO[i.status] ?? i.status}</span>
  <span class="meta">${esc(nomeTopico)} · ${esc(i.lote.id)}/${esc(i.q.id)}${i.regenerada ? " (regenerada)" : ""}${i.ajuste?.motivos.length ? " (ajustada)" : ""} · ${esc(i.lote.banca)} · ${esc(i.q.dificuldade)} · ${esc(i.q.tipo_cobranca)}</span></header>
  <p class="enunciado">${esc(i.q.enunciado)}</p>
  <ol class="alts">${alts.map((a) => `<li class="${a.correta ? "certa" : ""}"><b>${esc(a.rotulo)})</b> ${esc(a.texto)}<details><summary>Análise</summary>${esc(troca(a.just ?? ""))}</details></li>`).join("")}</ol>
  <details><summary>Comentário do professor</summary><p>${esc(troca(i.q.comentario_geral))}</p><p><b>Fundamento legal:</b> ${esc(i.q.fundamento_legal)}</p><p><b>Pegadinha:</b> ${esc(troca(i.q.pegadinha))}</p>${destaques}</details>
  ${i.ajuste?.motivos.length ? `<details><summary>Motivos do ajuste</summary><ul>${i.ajuste.motivos.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details>` : ""}
  <div class="auditor"><b>Auditor${i.ajuste?.motivos.length ? " (do ajuste)" : ""}:</b> ${esc(i.a.status)}${i.status !== i.a.status && ORDEM_STATUS.includes(i.status) ? ` (rebaixada para ${ROTULO[i.status]} pelas checagens em código)` : ""}. ${esc(troca(i.a.justificativa))}
  ${problemas ? `<ul>${problemas}</ul>` : ""}${i.a.correcao_sugerida ? `<p><b>Correção sugerida:</b> ${esc(troca(i.a.correcao_sugerida))}</p>` : ""}${i.citacoes.length ? `<p><b>Citações de jurisprudência fora da lista:</b> ${esc(i.citacoes.join(", "))}</p>` : ""}${i.semNota?.length ? `<p><b>Checagem em código:</b> ${esc(i.semNota.join(", "))}</p>` : ""}</div>
</article>`;
  })
  .join("\n");

const linhasResumo = [...porTopico.values()]
  .map((t) => `<tr><td>${esc(t.nome)}</td><td>${t.geradas}</td><td>${t.reprovadas1}</td><td>${((100 * t.reprovadas1) / Math.max(t.geradas, 1)).toFixed(0)}%</td><td>${t.descartadas}</td><td>${t.aproveitadas}</td></tr>`)
  .join("");
const maisLongas = prontas.filter((p) => tamanhoDaCorreta(p.q).maisLonga).length;
const resumoTamanho = `A correta é a alternativa mais longa em ${maisLongas} de ${prontas.length} questões (${Math.round((100 * maisLongas) / Math.max(prontas.length, 1))}%; meta: no máximo 30%).`;
console.log(resumoTamanho);
const letrasGab = new Map<string, number>();
for (const p of prontas) letrasGab.set(`${p.lote.alternativas} alt: ${p.gabarito}`, (letrasGab.get(`${p.lote.alternativas} alt: ${p.gabarito}`) ?? 0) + 1);

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisão do piloto</title>
<style>
:root{--fundo:#f6f7f9;--cartao:#fff;--texto:#1d2330;--suave:#5b6474;--borda:#dde1e7;--marca:#1f5fbf;--acerto:#1d7a46;--erro:#b3261e;--aviso:#9a6700;--fundo-certa:#e8f5ee}
@media (prefers-color-scheme:dark){:root{--fundo:#12151b;--cartao:#1b2029;--texto:#e6e9ef;--suave:#9aa3b2;--borda:#2c3340;--marca:#6ea2ff;--acerto:#5cc98a;--erro:#ff8a80;--aviso:#e3b341;--fundo-certa:#16301f}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--texto);font:15px/1.5 system-ui,sans-serif}
main{max-width:960px;margin:0 auto;padding:16px}h1{font-size:22px;margin:8px 0}
table{border-collapse:collapse;width:100%;background:var(--cartao);margin:12px 0;font-size:14px}th,td{border:1px solid var(--borda);padding:6px 8px;text-align:left}
.filtros{position:sticky;top:0;background:var(--fundo);padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:1}
select{padding:6px;background:var(--cartao);color:var(--texto);border:1px solid var(--borda);border-radius:6px;max-width:100%}
.q{background:var(--cartao);border:1px solid var(--borda);border-radius:8px;padding:12px 14px;margin:12px 0}
.q header{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.meta{color:var(--suave);font-size:13px}
.selo{font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px;border:1px solid currentColor}
.s-VALIDADA{color:var(--acerto)}.s-VALIDADA_COM_RESSALVA{color:var(--marca)}.s-NECESSITA_DE_CONFERENCIA{color:var(--aviso)}.s-SUBSTITUIDA,.s-DESCARTADA,.s-DUPLICADA{color:var(--erro)}
.enunciado{white-space:pre-wrap}.alts{list-style:none;padding:0}.alts li{padding:6px 8px;border-radius:6px;margin:4px 0}
.alts li.certa{background:var(--fundo-certa)}details{margin:4px 0}summary{cursor:pointer;color:var(--suave);font-size:13px}
.auditor{border-top:1px dashed var(--borda);margin-top:8px;padding-top:8px;font-size:14px}
</style></head><body><main>
<h1>Revisão do piloto (${itens.length} versões, ${unicas.length} aproveitáveis)</h1>
<p>Data de corte: ${DATA_CORTE}. Status final = veredito do auditor; questões que citam número de julgado fora de data/jurisprudencia.json ou dispositivo sensível sem a nota são rebaixadas para "necessita de conferência".</p>
<table><thead><tr><th>Tópico</th><th>Geradas</th><th>Reprovadas na 1ª auditoria</th><th>Taxa de reprovação</th><th>Descartadas</th><th>Aproveitáveis</th></tr></thead><tbody>${linhasResumo}</tbody></table>
<p>${[...contagemStatus].map(([s, n]) => `${ROTULO[s] ?? s}: ${n}`).join(" · ")}</p>
<p>Gabaritos após o equilíbrio: ${[...letrasGab].sort().map(([l, n]) => `${l} = ${n}`).join(" · ")}</p>
<p>${resumoTamanho}</p>
${pendentes.length ? `<p>Lotes não concluídos (fora deste relatório): ${esc(pendentes.join(", "))}</p>` : ""}
<div class="filtros"><select id="ft"><option value="">Todos os tópicos</option>${[...porTopico.keys()].map((t) => `<option>${esc(t)}</option>`).join("")}</select>
<select id="fs"><option value="">Todos os status</option>${[...contagemStatus.keys()].map((s) => `<option value="${s}">${ROTULO[s] ?? s}</option>`).join("")}</select><span id="n" class="meta"></span></div>
${cartoes}
</main><script>
const ft=document.getElementById("ft"),fs=document.getElementById("fs"),n=document.getElementById("n");
function filtrar(){let v=0;document.querySelectorAll(".q").forEach(q=>{const ok=(!ft.value||q.dataset.topico===ft.value)&&(!fs.value||q.dataset.status===fs.value);q.hidden=!ok;if(ok)v++});n.textContent=v+" questões"}
ft.onchange=fs.onchange=filtrar;filtrar();
</script></body></html>`;
mkdirSync("data/piloto", { recursive: true });
writeFileSync("data/piloto/revisao.html", html);
console.log(`Relatório: data/piloto/revisao.html (${itens.length} versões; ${[...contagemStatus].map(([s, n]) => `${s} ${n}`).join(", ")})`);
