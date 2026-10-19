// Reprocessa questões já auditadas do piloto: tamanho das alternativas (a correta não pode denunciar
// a resposta), nota obrigatória em dispositivos sensíveis, artigos conexos e ajustes pedidos na revisão.
// Retomável: o progresso fica em data/geradas/ajustes.json.
//
//   npx tsx scripts/questoes/ajustes.ts reauditoria <lote...>       entrada para reauditar lotes com o recorte novo de lei
//   npx tsx scripts/questoes/ajustes.ts registrar-reauditoria <lote> valida reauditoria.json
//   npx tsx scripts/questoes/ajustes.ts preparar                     escolhe as questões e cria ajuste-entrada.md por lote
//   npx tsx scripts/questoes/ajustes.ts status
//   npx tsx scripts/questoes/ajustes.ts conferir <lote>              só confere ajuste-gerado.json (para o subagente)
//   npx tsx scripts/questoes/ajustes.ts registrar <lote>             valida ajuste-gerado.json e cria a entrada do auditor
//   npx tsx scripts/questoes/ajustes.ts registrar-auditoria <lote>   valida ajuste-auditoria.json
//   npx tsx scripts/questoes/ajustes.ts estatisticas                 % de questões em que a correta é a mais longa
//
// O finalizar.ts usa a versão ajustada quando o auditor do ajuste não a reprova; se reprovar, fica a
// versão anterior, rebaixada para NECESSITA_DE_CONFERENCIA com o motivo.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { acharTopico, lerTaxonomia, sensiveisDoTopico } from "./contexto";
import {
  conferirQuestao,
  dispositivosSemNota,
  esquemaLoteAuditado,
  esquemaLoteGerado,
  LIMITE_TAMANHO,
  tamanhoDaCorreta,
  type Auditoria,
  type QuestaoGerada,
} from "./esquema";
import { entradaGeracao, lerProgresso, paraAuditoria, PASTA, pastaLote, type Lote } from "./piloto";

const ARQUIVO = `${PASTA}/ajustes.json`;

type QuestaoAjuste = { id: string; motivos: string[]; posicaoAlvo: number | null; permiteTrocarGabarito: boolean };
type LoteAjuste = {
  id: string;
  etapa: "pendente" | "ajustado" | "concluido";
  questoes: QuestaoAjuste[];
  reprovadas: { id: string; motivo: string }[];
  atualizadoEm: string;
};
type Ajustes = { criadoEm: string; lotes: LoteAjuste[] };

// Pedidos da revisão humana (lote/questão: instrução).
const MANUAIS: Record<string, { instrucao: string; permiteTrocarGabarito?: boolean }> = {
  "inquerito-02/q04": {
    instrucao:
      'Art. 184 do CPP: a autoridade pode negar perícia requerida pelas partes quando desnecessária, SALVO o exame de corpo de delito, que não pode ser negado. Do jeito que está, a "perícia em objeto apreendido" pode ser lida como exame de corpo de delito, e então a correta deixaria de estar certa. Reescreva o caso para que a perícia pedida não seja exame de corpo de delito (diga isso no enunciado) e acrescente a ressalva do art. 184 no comentário e na análise; ou, se preferir, transforme a questão para cobrar justamente essa exceção.',
    permiteTrocarGabarito: true,
  },
};

const lerJson = (c: string) => JSON.parse(readFileSync(c, "utf8"));
const ler = (): Ajustes => lerJson(ARQUIVO);
const salvar = (a: Ajustes) => writeFileSync(ARQUIVO, JSON.stringify(a, null, 2) + "\n");
const loteDoPiloto = (id: string) => {
  const lote = lerProgresso().lotes.find((l) => l.id === id);
  if (!lote) throw new Error(`lote ${id} não existe`);
  return lote;
};

/** Versão vigente de cada questão do lote: a original ou a regenerada (as descartadas ficam de fora). */
export function versoesVigentes(lote: Lote) {
  const dir = pastaLote(lote.id);
  const gerado = esquemaLoteGerado.parse(lerJson(`${dir}/gerado.json`)).questoes;
  const auditoria = new Map(esquemaLoteAuditado.parse(lerJson(`${dir}/auditoria.json`)).auditorias.map((a) => [a.id, a]));
  const regenQ = existsSync(`${dir}/regen-gerado.json`) ? new Map(esquemaLoteGerado.parse(lerJson(`${dir}/regen-gerado.json`)).questoes.map((q) => [q.id, q])) : new Map();
  const regenA = existsSync(`${dir}/regen-auditoria.json`) ? new Map(esquemaLoteAuditado.parse(lerJson(`${dir}/regen-auditoria.json`)).auditorias.map((a) => [a.id, a])) : new Map();
  return gerado.flatMap((q) => {
    if (!lote.reprovadas.includes(q.id)) return [{ q, a: auditoria.get(q.id)!, regenerada: false }];
    if (lote.descartadas.some((d) => d.id === q.id) || !regenQ.has(q.id)) return [];
    return [{ q: regenQ.get(q.id)! as QuestaoGerada, a: regenA.get(q.id)! as Auditoria, regenerada: true }];
  });
}

// Posição-alvo da correta no ranking de tamanho (1 = a mais longa), sorteada de forma estável:
// 40% continua podendo ser a mais longa (dentro do limite de 25%), o resto vai para outra posição.
function posicaoSorteada(chave: string, alternativas: number) {
  const r = createHash("sha256").update(chave).digest().readUInt32LE(0) / 2 ** 32;
  return r < 0.4 ? 1 : 2 + Math.floor(((r - 0.4) / 0.6) * (alternativas - 1));
}

// ---------- reauditoria com o recorte novo de lei (artigos conexos) ----------
function reauditoria(ids: string[]) {
  const tax = lerTaxonomia();
  for (const id of ids) {
    const lote = loteDoPiloto(id);
    const dir = pastaLote(id);
    writeFileSync(`${dir}/reauditoria-entrada.md`, entradaGeracao(tax, lote, REAUDITORIA));
    writeFileSync(`${dir}/reauditoria-questoes.json`, JSON.stringify(paraAuditoria(versoesVigentes(lote).map((v) => v.q)), null, 2));
    console.log(`${id}: ${dir}/reauditoria-entrada.md e reauditoria-questoes.json prontos`);
  }
}
const REAUDITORIA = `## Reauditoria
Estas questões já foram auditadas com um recorte menor da lei. O texto legal abaixo agora inclui artigos conexos. Audite de novo, com atenção especial a: (1) algum artigo conexo que crie exceção ou mude a resposta; (2) dispositivos com ressalva obrigatória sem a nota. Questões que continuam corretas ficam "VALIDADA".`;

function registrarReauditoria(id: string) {
  const arquivo = `${pastaLote(id)}/reauditoria.json`;
  const r = esquemaLoteAuditado.safeParse(lerJson(arquivo));
  if (!r.success) return falhar(`INVALIDO ${arquivo}: ${r.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const contagem = new Map<string, number>();
  for (const a of r.data.auditorias) contagem.set(a.status, (contagem.get(a.status) ?? 0) + 1);
  console.log(`${id}: reauditoria válida (${[...contagem].map(([s, n]) => `${s} ${n}`).join(", ")})`);
}

// ---------- preparar ----------
function preparar() {
  if (existsSync(ARQUIVO)) return console.log(`${ARQUIVO} já existe (use "status"). Apague-o para recomeçar do zero.`);
  const tax = lerTaxonomia();
  const lotes: LoteAjuste[] = [];
  for (const lote of lerProgresso().lotes.filter((l) => l.etapa === "concluido")) {
    const dir = pastaLote(lote.id);
    const sensiveis = sensiveisDoTopico(acharTopico(tax, lote.topico).topico);
    const reaud = existsSync(`${dir}/reauditoria.json`) ? new Map(esquemaLoteAuditado.parse(lerJson(`${dir}/reauditoria.json`)).auditorias.map((a) => [a.id, a])) : new Map<string, Auditoria>();
    const questoes: QuestaoAjuste[] = [];
    for (const { q, a } of versoesVigentes(lote)) {
      const motivos: string[] = [];
      let posicaoAlvo: number | null = null;
      const t = tamanhoDaCorreta(q);
      if (t.maisLonga || t.razao > LIMITE_TAMANHO) {
        const alvo = posicaoSorteada(`${lote.id}/${q.id}`, lote.alternativas);
        if (alvo !== 1 || t.razao > LIMITE_TAMANHO) {
          posicaoAlvo = alvo;
          motivos.push(
            `Tamanho: hoje a correta é a ${t.posicao}ª mais longa (${t.correta} caracteres; média das erradas ${t.media}). Reescreva as alternativas para que a correta fique na posição ${alvo} do ranking de tamanho (1 = a mais longa) e no máximo 25% acima da média das erradas. Prefira enriquecer os distratores com detalhes plausíveis do mesmo nível (prazos, condições, remissões) a cortar informação da correta, e não mude o que torna cada alternativa certa ou errada.`,
          );
        }
      }
      const semNota = dispositivosSemNota(q, sensiveis);
      if (semNota.length)
        motivos.push(`Nota obrigatória: a questão cobra ${semNota.join(", ")}. Acrescente ao comentario_geral a nota da seção "Dispositivos com ressalva obrigatória", adaptada ao caso, e deixe claro no enunciado se a questão cobra a letra da lei.`);
      const manual = MANUAIS[`${lote.id}/${q.id}`];
      if (manual) motivos.push(`Revisão do professor: ${manual.instrucao}`);
      const ra = reaud.get(q.id);
      if (ra && ra.status !== "VALIDADA")
        motivos.push(`Reauditoria com os artigos conexos (${ra.status}): ${ra.justificativa}${ra.correcao_sugerida ? ` Correção sugerida: ${ra.correcao_sugerida}` : ""}`);
      // Se a questão já vai ser reescrita, aproveita a correção pontual sugerida na primeira auditoria.
      if (motivos.length && a.correcao_sugerida) motivos.push(`Aproveite também a correção sugerida pelo auditor: ${a.correcao_sugerida}`);
      if (motivos.length) questoes.push({ id: q.id, motivos, posicaoAlvo, permiteTrocarGabarito: Boolean(manual?.permiteTrocarGabarito || (ra && ra.status === "REPROVADA")) });
    }
    if (!questoes.length) continue;
    const vigentes = new Map(versoesVigentes(lote).map((v) => [v.q.id, v.q]));
    const pedido = questoes
      .map((x) => `### ${x.id}\n${x.motivos.map((m) => `- ${m}`).join("\n")}${x.permiteTrocarGabarito ? "\n- Nesta questão o gabarito pode mudar, se o ajuste exigir." : "\n- Mantenha o mesmo id_correta e os mesmos ids de alternativas."}`)
      .join("\n\n");
    const extra = `## Ajuste de questões já auditadas
Reescreva SOMENTE as questões listadas abaixo, mantendo ids, tema, dificuldade e o ponto cobrado. Devolva cada questão completa (todos os campos), atualizando analise_alternativas, comentário e fundamentos para refletir o novo texto. Não mencione letras de alternativas.

${pedido}

## Questões atuais (JSON)
${JSON.stringify(questoes.map((x) => vigentes.get(x.id)), null, 2)}`;
    writeFileSync(`${dir}/ajuste-entrada.md`, entradaGeracao(tax, lote, extra));
    lotes.push({ id: lote.id, etapa: "pendente", questoes, reprovadas: [], atualizadoEm: new Date().toISOString() });
  }
  salvar({ criadoEm: new Date().toISOString(), lotes });
  const total = lotes.reduce((s, l) => s + l.questoes.length, 0);
  console.log(`${total} questões em ${lotes.length} lotes para ajuste:`);
  for (const l of lotes) console.log(`  ${l.id}: ${l.questoes.map((x) => x.id).join(", ")}`);
}

// ---------- validação ----------
function validarAjuste(id: string) {
  const loteA = ler().lotes.find((l) => l.id === id);
  if (!loteA) throw new Error(`lote ${id} não tem ajuste`);
  const lote = loteDoPiloto(id);
  const arquivo = `${pastaLote(id)}/ajuste-gerado.json`;
  if (!existsSync(arquivo)) return { erros: [`${arquivo} não existe`] };
  const r = esquemaLoteGerado.safeParse(lerJson(arquivo));
  if (!r.success) return { erros: r.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const sensiveis = sensiveisDoTopico(acharTopico(lerTaxonomia(), lote.topico).topico);
  const anteriores = new Map(versoesVigentes(lote).map((v) => [v.q.id, v.q]));
  const erros: string[] = [];
  const ids = r.data.questoes.map((q) => q.id);
  const esperados = loteA.questoes.map((x) => x.id);
  if (ids.length !== esperados.length || !esperados.every((x) => ids.includes(x))) erros.push(`as questões devem ser exatamente: ${esperados.join(", ")} (vieram ${ids.join(", ")})`);
  for (const q of r.data.questoes) {
    const pedido = loteA.questoes.find((x) => x.id === q.id);
    if (!pedido) continue;
    erros.push(...conferirQuestao(q, lote.alternativas, sensiveis));
    const antes = anteriores.get(q.id)!;
    if (!pedido.permiteTrocarGabarito && q.id_correta !== antes.id_correta) erros.push(`${q.id}: o id_correta mudou (${antes.id_correta} para ${q.id_correta}); mantenha o mesmo gabarito`);
    const t = tamanhoDaCorreta(q);
    if (pedido.posicaoAlvo !== null && t.posicao !== pedido.posicaoAlvo)
      erros.push(`${q.id}: a correta está na posição ${t.posicao} do ranking de tamanho (${t.correta} caracteres; erradas: ${q.alternativas.filter((a) => a.id !== q.id_correta).map((a) => a.texto.length).join(", ")}); o pedido é a posição ${pedido.posicaoAlvo}`);
  }
  return { erros, lote: r.data };
}

function falhar(msg: string) {
  console.log(msg);
  process.exitCode = 1;
}

function conferir(id: string) {
  const { erros, lote } = validarAjuste(id);
  if (erros.length) falhar(`INVALIDO:\n  ${erros.join("\n  ")}`);
  else console.log(`OK: ${lote!.questoes.length} questões ajustadas`);
}

function registrar(id: string) {
  const a = ler();
  const loteA = a.lotes.find((l) => l.id === id)!;
  if (loteA.etapa !== "pendente") return console.log(`${id}: já está em "${loteA.etapa}".`);
  const { erros, lote } = validarAjuste(id);
  if (erros.length || !lote) return falhar(`INVALIDO:\n  ${erros.join("\n  ")}`);
  writeFileSync(`${pastaLote(id)}/ajuste-auditoria-entrada.json`, JSON.stringify(paraAuditoria(lote.questoes), null, 2));
  loteA.etapa = "ajustado";
  loteA.atualizadoEm = new Date().toISOString();
  salvar(a);
  console.log(`${id}: ${lote.questoes.length} questões ajustadas e válidas, pronto para auditoria`);
}

function registrarAuditoria(id: string) {
  const a = ler();
  const loteA = a.lotes.find((l) => l.id === id)!;
  if (loteA.etapa !== "ajustado") return console.log(`${id}: está em "${loteA.etapa}", nada a fazer.`);
  const arquivo = `${pastaLote(id)}/ajuste-auditoria.json`;
  const r = esquemaLoteAuditado.safeParse(lerJson(arquivo));
  if (!r.success) return falhar(`INVALIDO ${arquivo}: ${r.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const faltam = loteA.questoes.filter((x) => !r.data.auditorias.some((y) => y.id === x.id)).map((x) => x.id);
  if (faltam.length) return falhar(`INVALIDO ${arquivo}: sem auditoria para ${faltam.join(", ")}`);
  loteA.reprovadas = r.data.auditorias.filter((x) => x.status === "REPROVADA").map((x) => ({ id: x.id, motivo: x.justificativa }));
  loteA.etapa = "concluido";
  loteA.atualizadoEm = new Date().toISOString();
  salvar(a);
  const contagem = new Map<string, number>();
  for (const x of r.data.auditorias) contagem.set(x.status, (contagem.get(x.status) ?? 0) + 1);
  console.log(`${id}: auditoria do ajuste registrada (${[...contagem].map(([s, n]) => `${s} ${n}`).join(", ")})`);
}

function status() {
  const a = ler();
  for (const l of a.lotes) console.log(`${l.id.padEnd(14)} ${l.etapa.padEnd(10)} ${l.questoes.map((x) => x.id).join(",")}${l.reprovadas.length ? `  reprovadas: ${l.reprovadas.map((x) => x.id).join(",")}` : ""}`);
  const etapas = new Map<string, number>();
  for (const l of a.lotes) etapas.set(l.etapa, (etapas.get(l.etapa) ?? 0) + 1);
  console.log([...etapas].map(([e, n]) => `${e}: ${n}`).join(" | "));
}

/** Versões que o finalizar vai usar (ajustada quando aprovada). Exportado para o finalizar. */
export function ajusteAprovado(loteId: string, questaoId: string): { q: QuestaoGerada; a: Auditoria; motivos: string[] } | { reprovado: string } | null {
  if (!existsSync(ARQUIVO)) return null;
  const loteA = ler().lotes.find((l) => l.id === loteId);
  const pedido = loteA?.questoes.find((x) => x.id === questaoId);
  if (!loteA || !pedido || loteA.etapa !== "concluido") return null;
  const reprovada = loteA.reprovadas.find((x) => x.id === questaoId);
  if (reprovada) return { reprovado: reprovada.motivo };
  const dir = pastaLote(loteId);
  const q = esquemaLoteGerado.parse(lerJson(`${dir}/ajuste-gerado.json`)).questoes.find((x) => x.id === questaoId)!;
  const a = esquemaLoteAuditado.parse(lerJson(`${dir}/ajuste-auditoria.json`)).auditorias.find((x) => x.id === questaoId)!;
  return { q, a, motivos: pedido.motivos };
}

function estatisticas() {
  let total = 0;
  let longas = 0;
  let acima = 0;
  for (const lote of lerProgresso().lotes.filter((l) => l.etapa === "concluido")) {
    for (const v of versoesVigentes(lote)) {
      const aj = ajusteAprovado(lote.id, v.q.id);
      const q = aj && "q" in aj ? aj.q : v.q;
      const t = tamanhoDaCorreta(q);
      total++;
      if (t.maisLonga) longas++;
      if (t.razao > LIMITE_TAMANHO) acima++;
    }
  }
  console.log(`${total} questões: a correta é a mais longa em ${longas} (${Math.round((100 * longas) / total)}%); acima do limite de 25%: ${acima}`);
}

const direto = /questoes[\\/]ajustes\.ts$/.test(process.argv[1] ?? "");
const [comando, ...args] = direto ? process.argv.slice(2) : [];
if (comando === "reauditoria" && args.length) reauditoria(args);
else if (comando === "registrar-reauditoria" && args[0]) registrarReauditoria(args[0]);
else if (comando === "preparar") preparar();
else if (comando === "status") status();
else if (comando === "conferir" && args[0]) conferir(args[0]);
else if (comando === "registrar" && args[0]) registrar(args[0]);
else if (comando === "registrar-auditoria" && args[0]) registrarAuditoria(args[0]);
else if (comando === "estatisticas") estatisticas();
else if (comando) falhar("Comandos: reauditoria <lote...> | registrar-reauditoria <lote> | preparar | status | conferir <lote> | registrar <lote> | registrar-auditoria <lote> | estatisticas");
