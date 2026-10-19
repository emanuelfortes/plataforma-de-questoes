// Mesmo fluxo do piloto, mas pela API da Anthropic (Message Batches, 50% mais barato).
// PRONTO PARA USO FUTURO: precisa de ANTHROPIC_API_KEY no .env.local e só envia com --confirmar.
//
//   npx tsx scripts/questoes/api-lotes.ts enviar geracao  [--lotes a,b] [--effort high] --confirmar
//   npx tsx scripts/questoes/api-lotes.ts enviar auditoria [--lotes a,b] [--effort high] --confirmar
//   npx tsx scripts/questoes/api-lotes.ts buscar          baixa os resultados prontos para as pastas dos lotes
//
// Sem --confirmar, "enviar" só mostra quantos pedidos sairiam e o tamanho estimado.
// Depois de "buscar", rode piloto.ts registrar-geracao / registrar-auditoria em cada lote,
// exatamente como no fluxo com subagentes (as pastas e os arquivos são os mesmos).
//
// Custos: o texto do gerador/auditor e o texto legal vão com cache de 1 hora (lotes do mesmo
// tópico reaproveitam). Opus 5.5 sempre pensa; a profundidade é controlada por "effort".
import "../_env";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { esquemaLoteAuditado, esquemaLoteGerado } from "./esquema";
import { lerProgresso, pastaLote, PASTA, type Lote } from "./piloto";

const MODELO = "claude-opus-5-5";
const ARQUIVO_ENVIOS = `${PASTA}/api-envios.json`;
type Envio = { batchId: string; etapa: "geracao" | "auditoria"; lotes: { id: string; regen: boolean }[]; enviadoEm: string; baixado: boolean };

const argumentos = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = argumentos.indexOf(`--${nome}`);
  return i >= 0 ? argumentos[i + 1] : undefined;
};
const lerEnvios = (): Envio[] => (existsSync(ARQUIVO_ENVIOS) ? JSON.parse(readFileSync(ARQUIVO_ENVIOS, "utf8")) : []);
const salvarEnvios = (e: Envio[]) => writeFileSync(ARQUIVO_ENVIOS, JSON.stringify(e, null, 2) + "\n");

// Formato estruturado: a API garante o JSON no esquema; o piloto.ts ainda confere as regras extras.
function formato(etapa: Envio["etapa"]) {
  const f = zodOutputFormat(etapa === "geracao" ? esquemaLoteGerado : esquemaLoteAuditado);
  return { type: f.type, schema: f.schema };
}

/** Separa o texto legal (igual entre lotes do mesmo tópico, vai para o cache) do resto do pedido. */
function partesDoPedido(entrada: string) {
  const marca = "## Texto legal fornecido";
  const i = entrada.indexOf(marca);
  return i < 0 ? { lei: "", pedido: entrada } : { lei: entrada.slice(i), pedido: entrada.slice(0, i) };
}

function pedido(lote: Lote, etapa: Envio["etapa"], regen: boolean, effort: string): Anthropic.Messages.Batches.BatchCreateParams.Request {
  const dir = pastaLote(lote.id);
  const instrucoes = readFileSync(etapa === "geracao" ? "prompts/gerador.md" : "prompts/auditor.md", "utf8");
  // O auditor recebe a entrada original (parâmetros e lei), nunca o pedido de regeneração.
  const { lei, pedido: parametros } = partesDoPedido(readFileSync(`${dir}/${etapa === "geracao" && regen ? "regen-entrada.md" : "entrada.md"}`, "utf8"));
  const conteudo: Anthropic.Messages.TextBlockParam[] = [];
  if (lei) conteudo.push({ type: "text", text: lei, cache_control: { type: "ephemeral", ttl: "1h" } });
  if (etapa === "geracao") conteudo.push({ type: "text", text: parametros });
  else {
    const questoes = readFileSync(`${dir}/${regen ? "regen-auditoria-entrada.json" : "auditoria-entrada.json"}`, "utf8");
    conteudo.push({ type: "text", text: `${parametros}\n## Questões a auditar\n${questoes}` });
  }
  return {
    custom_id: `${lote.id}${regen ? "--regen" : ""}`,
    params: {
      model: MODELO,
      max_tokens: 64000,
      system: [{ type: "text", text: instrucoes, cache_control: { type: "ephemeral", ttl: "1h" } }],
      messages: [{ role: "user", content: conteudo }],
      output_config: { effort: effort as "low" | "medium" | "high", format: formato(etapa) },
    },
  };
}

async function enviar(etapa: Envio["etapa"]) {
  const filtro = opcao("lotes")?.split(",");
  const effort = opcao("effort") ?? "high";
  const etapasAlvo: Record<string, boolean> = etapa === "geracao" ? { pendente: false, regen_pendente: true } : { gerado: false, regen_gerado: true };
  const lotes = lerProgresso().lotes.filter((l) => l.etapa in etapasAlvo && (!filtro || filtro.includes(l.id)));
  const jaEnviados = new Set(lerEnvios().filter((e) => !e.baixado && e.etapa === etapa).flatMap((e) => e.lotes.map((l) => l.id)));
  const alvo = lotes.filter((l) => !jaEnviados.has(l.id));
  if (!alvo.length) return console.log("Nenhum lote nessa etapa (ou todos já enviados e aguardando).");
  const pedidos = alvo.map((l) => pedido(l, etapa, etapasAlvo[l.etapa] === true, effort));
  const caracteres = pedidos.reduce((s, p) => s + JSON.stringify(p.params.messages).length + JSON.stringify(p.params.system).length, 0);
  console.log(`${pedidos.length} pedidos de ${etapa} (${alvo.map((l) => l.id).join(", ")}); cerca de ${Math.round(caracteres / 3.5 / 1000)} mil tokens de entrada antes do cache.`);
  if (!argumentos.includes("--confirmar")) return console.log("Nada enviado. Acrescente --confirmar para enviar de verdade.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ausente no .env.local");

  const lote = await new Anthropic().messages.batches.create({ requests: pedidos });
  salvarEnvios([
    ...lerEnvios(),
    { batchId: lote.id, etapa, lotes: alvo.map((l) => ({ id: l.id, regen: l.etapa.startsWith("regen") })), enviadoEm: new Date().toISOString(), baixado: false },
  ]);
  console.log(`Enviado: ${lote.id}. Rode "buscar" daqui a alguns minutos (até 24 h).`);
}

async function buscar() {
  const cliente = new Anthropic();
  const envios = lerEnvios();
  for (const envio of envios.filter((e) => !e.baixado)) {
    const info = await cliente.messages.batches.retrieve(envio.batchId);
    if (info.processing_status !== "ended") {
      console.log(`${envio.batchId}: ainda processando (${info.request_counts.processing} pendentes)`);
      continue;
    }
    for await (const r of await cliente.messages.batches.results(envio.batchId)) {
      const [id, sufixo] = r.custom_id.split("--");
      const regen = sufixo === "regen";
      if (r.result.type !== "succeeded") {
        console.log(`${r.custom_id}: ${r.result.type} (reenviar)`);
        continue;
      }
      const texto = r.result.message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      const nome = envio.etapa === "geracao" ? (regen ? "regen-gerado.json" : "gerado.json") : regen ? "regen-auditoria.json" : "auditoria.json";
      writeFileSync(`${pastaLote(id!)}/${nome}`, texto);
      const u = r.result.message.usage;
      console.log(`${r.custom_id}: ${nome} salvo (entrada ${u.input_tokens}, cache lido ${u.cache_read_input_tokens ?? 0}, saída ${u.output_tokens})`);
    }
    envio.baixado = true;
  }
  salvarEnvios(envios);
  console.log("Agora rode piloto.ts registrar-geracao / registrar-auditoria nos lotes baixados.");
}

const [comando, etapa] = argumentos;
if (comando === "enviar" && (etapa === "geracao" || etapa === "auditoria")) await enviar(etapa);
else if (comando === "buscar") await buscar();
else console.log("Comandos: enviar geracao|auditoria [--lotes a,b] [--effort low|medium|high] [--confirmar] | buscar");
