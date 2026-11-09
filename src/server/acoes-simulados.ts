"use server";

// Ações dos simulados. Aluno: exigirUsuario() e Elite; dono: exigirAdmin(). Entrada sempre validada com Zod.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONCURSOS_SIMULADO } from "@/lib/planos";
import { exigirAdmin, exigirUsuario } from "@/lib/sessao";
import { lerGabarito, MAXIMO_PDF, OPCOES_SIMULADO, TAMANHO_PARTE, type OpcoesSimulado } from "@/lib/simulados";
import { temElite } from "./assinatura";
import {
  atualizarDatas,
  atualizarGabarito,
  BASE_ENVIO_COMENTADO,
  concluirArquivo,
  concluirComentado,
  criarSimulado,
  entregarTentativa,
  excluirSimulado,
  gravarParte,
  iniciarTentativa,
  obterSimuladoAdmin,
  salvarMarcacoes,
} from "./simulados";

type Resultado = { ok: true } | { ok: false; erro: string };

const idSchema = z.coerce.number().int().positive();
const respostasSchema = z.array(z.string().max(1)).max(300);

async function exigirElite() {
  const usuario = await exigirUsuario();
  return (await temElite(usuario)) ? usuario : null;
}

export async function comecarSimulado(id: unknown): Promise<Resultado> {
  const usuario = await exigirElite();
  if (!usuario) return { ok: false, erro: "Os simulados são da Tropa de Elite." };
  const sim = idSchema.safeParse(id);
  if (!sim.success) return { ok: false, erro: "Simulado inválido." };
  const r = await iniciarTentativa(sim.data, usuario.id);
  revalidatePath(`/simulados/${sim.data}`);
  return r;
}

export async function guardarMarcacoes(id: unknown, respostas: unknown): Promise<boolean> {
  const usuario = await exigirElite();
  const sim = idSchema.safeParse(id);
  const resp = respostasSchema.safeParse(respostas);
  if (!usuario || !sim.success || !resp.success) return false;
  return salvarMarcacoes(sim.data, usuario.id, resp.data);
}

export async function entregarSimulado(id: unknown, respostas: unknown): Promise<Resultado> {
  const usuario = await exigirElite();
  if (!usuario) return { ok: false, erro: "Os simulados são da Tropa de Elite." };
  const sim = idSchema.safeParse(id);
  const resp = respostasSchema.safeParse(respostas);
  if (!sim.success || !resp.success) return { ok: false, erro: "Gabarito inválido." };
  const r = await entregarTentativa(sim.data, usuario.id, resp.data);
  revalidatePath(`/simulados/${sim.data}`);
  revalidatePath("/simulados");
  return r;
}

// ---------- dono ----------

/** "2026-11-20T08:00" do campo de data e hora, no fuso de Brasília. */
const dataHora = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform((v) => new Date(`${v}:00-03:00`));

const dadosSchema = z.object({
  titulo: z.string().trim().min(3).max(150),
  duracaoMin: z.coerce.number().int().min(5).max(600),
  liberadoEm: dataHora,
  encerraEm: z.union([z.literal("").transform(() => null), dataHora]),
});

const novoSchema = dadosSchema.extend({
  concurso: z.enum(CONCURSOS_SIMULADO),
  opcoes: z.enum(Object.keys(OPCOES_SIMULADO) as [OpcoesSimulado, ...OpcoesSimulado[]]),
  questoes: z.coerce.number().int().min(1).max(300),
  gabarito: z.string().max(5000),
});

export async function novoSimulado(entrada: unknown): Promise<{ ok: true; id: number } | { ok: false; erro: string }> {
  await exigirAdmin();
  const d = novoSchema.safeParse(entrada);
  if (!d.success) return { ok: false, erro: "Confira os campos: título, concurso, datas, tempo e número de questões." };
  const g = lerGabarito(d.data.gabarito, d.data.opcoes, d.data.questoes);
  if (!g.ok) return g;
  if (d.data.encerraEm && d.data.encerraEm <= d.data.liberadoEm) return { ok: false, erro: "O encerramento precisa ser depois da liberação." };
  const id = await criarSimulado({ ...d.data, gabarito: g.gabarito });
  revalidatePath("/admin/simulados");
  return { ok: true, id };
}

export async function editarSimulado(id: unknown, entrada: unknown): Promise<Resultado & { recorrigidas?: number }> {
  await exigirAdmin();
  const sim = idSchema.safeParse(id);
  const d = dadosSchema.extend({ gabarito: z.string().max(5000) }).safeParse(entrada);
  if (!sim.success || !d.success) return { ok: false, erro: "Confira os campos." };
  const s = await obterSimuladoAdmin(sim.data);
  if (!s) return { ok: false, erro: "Simulado não encontrado." };
  const g = lerGabarito(d.data.gabarito, s.opcoes as OpcoesSimulado, s.gabarito.length);
  if (!g.ok) return g;
  await atualizarDatas(sim.data, { titulo: d.data.titulo, duracaoMin: d.data.duracaoMin, liberadoEm: d.data.liberadoEm, encerraEm: d.data.encerraEm });
  const recorrigidas = g.gabarito.join("") === s.gabarito.join("") ? 0 : await atualizarGabarito(sim.data, g.gabarito);
  revalidatePath("/admin/simulados");
  revalidatePath("/simulados");
  return { ok: true, recorrigidas };
}

const tipoSchema = z.enum(["prova", "comentado"]).catch("prova");

/**
 * Um pedaço do PDF (FormData: id, parte, dados e tipo). O navegador corta o arquivo em TAMANHO_PARTE.
 * tipo "prova" é o caderno que o aluno baixa; "comentado" é o gabarito comentado, liberado só depois da entrega.
 */
export async function enviarParteDoPdf(form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const tipo = tipoSchema.parse(form.get("tipo"));
  const id = idSchema.safeParse(form.get("id"));
  const parte = z.coerce.number().int().min(0).max(Math.ceil(MAXIMO_PDF / TAMANHO_PARTE)).safeParse(form.get("parte"));
  const dados = form.get("dados");
  if (!id.success || !parte.success || !(dados instanceof Blob) || dados.size === 0 || dados.size > TAMANHO_PARTE) {
    return { ok: false, erro: "Parte do arquivo inválida." };
  }
  const bytes = Buffer.from(await dados.arrayBuffer());
  // Confere a assinatura de PDF ("%PDF") no começo do arquivo.
  if (parte.data === 0 && bytes.subarray(0, 4).toString("latin1") !== "%PDF") return { ok: false, erro: "O arquivo não é um PDF." };
  await gravarParte(id.data, (tipo === "comentado" ? BASE_ENVIO_COMENTADO : 0) + parte.data, bytes);
  return { ok: true };
}

export async function concluirPdf(id: unknown, nome: unknown, bytes: unknown, partes: unknown, tipo: unknown = "prova"): Promise<Resultado> {
  await exigirAdmin();
  const d = z
    .object({ id: idSchema, nome: z.string().trim().min(1).max(200), bytes: z.number().int().positive().max(MAXIMO_PDF), partes: z.number().int().positive() })
    .safeParse({ id, nome, bytes, partes });
  if (!d.success) return { ok: false, erro: "Dados do arquivo inválidos." };
  const ok =
    tipoSchema.parse(tipo) === "comentado"
      ? await concluirComentado(d.data.id, d.data.bytes, d.data.partes)
      : await concluirArquivo(d.data.id, d.data.nome, d.data.bytes, d.data.partes);
  revalidatePath("/admin/simulados");
  revalidatePath("/simulados");
  return ok ? { ok: true } : { ok: false, erro: "O envio do PDF ficou incompleto. Tente de novo." };
}

export async function apagarSimulado(id: unknown): Promise<Resultado> {
  await exigirAdmin();
  const sim = idSchema.safeParse(id);
  if (!sim.success) return { ok: false, erro: "Simulado inválido." };
  await excluirSimulado(sim.data);
  revalidatePath("/admin/simulados");
  revalidatePath("/simulados");
  return { ok: true };
}
