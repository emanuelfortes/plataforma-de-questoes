// Orquestra o piloto de 200 questões feito por subagentes no Claude Code (sem a API).
// O progresso fica em data/geradas/progresso.json: se o trabalho parar, retoma de onde parou.
//
//   npx tsx scripts/questoes/piloto.ts preparar                    cria lotes, entradas e progresso
//   npx tsx scripts/questoes/piloto.ts status                      mostra a etapa de cada lote
//   npx tsx scripts/questoes/piloto.ts registrar-geracao <lote>    valida gerado.json (ou regen-gerado.json)
//   npx tsx scripts/questoes/piloto.ts registrar-auditoria <lote>  valida a auditoria e decide regeneração
//
// Arquivos por lote em data/geradas/lotes/<lote>/:
//   entrada.md            pedido ao gerador (parâmetros, edital e texto legal)
//   gerado.json           saída do gerador
//   auditoria-entrada.json questões sem o status e as ressalvas do gerador (o auditor decide sozinho)
//   auditoria.json        saída do auditor
//   regen-entrada.md / regen-gerado.json / regen-auditoria-entrada.json / regen-auditoria.json  (se houver reprovadas)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { acharTopico, lerJurisprudencia, lerTaxonomia, sensiveisDoTopico, textoLegal, type Taxonomia } from "./contexto";
import {
  citacoesForaDaLista,
  conferirLote,
  conferirQuestao,
  dispositivosSemNota,
  notaConferida,
  trechosAConfirmar,
  esquemaLoteAuditado,
  esquemaLoteGerado,
  type Auditoria,
  type QuestaoGerada,
} from "./esquema";

export const PASTA = "data/geradas";
export const ARQUIVO_PROGRESSO = `${PASTA}/progresso.json`;
export const DATA_CORTE = "2026-10-18";

export type Etapa =
  | "pendente"
  | "gerado"
  | "auditado"
  | "regen_pendente"
  | "regen_gerado"
  | "concluido";

export type Lote = {
  id: string;
  topico: string; // id na taxonomia
  concurso: string;
  banca: string;
  alternativas: number;
  foco: string;
  etapa: Etapa;
  reprovadas: string[]; // ids reprovados na primeira auditoria
  descartadas: { id: string; motivo: string }[];
  atualizadoEm: string;
};
type Progresso = { criadoEm: string; dataCorte: string; lotes: Lote[] };

// Plano do piloto: 4 lotes de 10 por tópico. Tópicos comuns aos 3 concursos: 3 lotes IDECAN
// (PCCE, GMF, PCCE) e 1 Vunesp (CFO), na proporção 2/3 e 1/3 da taxonomia.
const PLANO: { prefixo: string; topico: string; lotes: { concurso: string; foco: string }[] }[] = [
  {
    prefixo: "crase",
    topico: "lingua-portuguesa--crase",
    lotes: [
      { concurso: "pcce-2021", foco: "Regra geral (preposição a + artigo a) e casos em que a crase é proibida (antes de verbo, palavra masculina, pronomes pessoais, de tratamento e indefinidos, expressões com palavras repetidas)." },
      { concurso: "pcce-2021", foco: "Casos facultativos (antes de pronome possessivo feminino, nomes próprios femininos, depois de 'até') e locuções adverbiais, prepositivas e conjuntivas femininas." },
      { concurso: "pcce-2021", foco: "Crase com pronomes demonstrativos (aquele, aquela, aquilo, a, as) e relativos (a qual, as quais), e com nomes de lugar (teste do 'volto da/volto de')." },
      { concurso: "pcce-2021", foco: "Aplicação em reescrita de frases e em trechos de texto: indicação de horas, distância determinada, 'à moda de', 'à distância', paralelismo e mudança de sentido com e sem crase." },
    ],
  },
  {
    prefixo: "direitos",
    topico: "direito-constitucional--direitos-e-garantias-fundamentais",
    lotes: [
      { concurso: "pcce-2021", foco: "Art. 5º, caput e incisos I a XX: igualdade, legalidade, tortura, liberdade de manifestação, consciência e crença, inviolabilidade da intimidade, da casa e das comunicações, liberdade de locomoção, reunião e associação." },
      { concurso: "gm-fortaleza", foco: "Art. 5º, incisos XXI a XLV: representação por associações, propriedade e função social, desapropriação, direito de petição e certidões, inafastabilidade da jurisdição, direito adquirido, júri, legalidade e retroatividade penal, racismo, crimes inafiançáveis e imprescritíveis, pessoalidade da pena." },
      { concurso: "pcce-2021", foco: "Art. 5º, incisos XLVI a LXVII: individualização e espécies de penas proibidas, extradição, juiz natural, devido processo, contraditório, provas ilícitas, presunção de inocência, identificação criminal, prisão e direitos do preso, prisão civil." },
      { concurso: "cfo-pmce", foco: "Art. 5º, incisos LXVIII a LXXIX e §§ 1º a 4º: habeas corpus, mandado de segurança individual e coletivo, mandado de injunção, habeas data, ação popular, assistência jurídica, gratuidades, razoável duração do processo, proteção de dados, aplicação imediata, tratados de direitos humanos e Tribunal Penal Internacional." },
    ],
  },
  {
    prefixo: "patrimonio",
    topico: "direito-penal--crimes-contra-o-patrimonio",
    lotes: [
      { concurso: "pcce-2021", foco: "Furto (art. 155), inclusive privilegiado, qualificado, de veículo, mediante fraude eletrônica e com emprego de explosivo, e furto de coisa comum (art. 156)." },
      { concurso: "gm-fortaleza", foco: "Roubo (art. 157), majorantes e qualificadoras, latrocínio, extorsão (art. 158), extorsão mediante sequestro (art. 159) e extorsão indireta (art. 160)." },
      { concurso: "pcce-2021", foco: "Usurpação (arts. 161 e 162), dano (arts. 163 a 167) e apropriação indébita, inclusive previdenciária e de coisa havida por erro (arts. 168 a 170)." },
      { concurso: "cfo-pmce", foco: "Estelionato e fraudes (arts. 171 a 179, inclusive fraude eletrônica e representação), receptação (art. 180 e 180-A) e disposições gerais: imunidades absolutas e relativas (arts. 181 a 183)." },
    ],
  },
  {
    prefixo: "inquerito",
    topico: "direito-processual-penal--inquerito-policial",
    lotes: [
      { concurso: "pcce-2021", foco: "Polícia judiciária, natureza e características do inquérito (inquisitivo, escrito, sigiloso, dispensável, indisponível), formas de instauração conforme a ação penal, notitia criminis e delatio criminis (arts. 4º e 5º)." },
      { concurso: "gm-fortaleza", foco: "Diligências da autoridade policial, reprodução simulada, indiciamento, identificação criminal, sigilo, incomunicabilidade e acesso do defensor (arts. 6º a 9º, 14, 14-A, 20 e 21)." },
      { concurso: "pcce-2021", foco: "Prazos de conclusão (preso e solto), relatório, remessa, devolução para diligências, arquivamento e vedação de arquivamento pela autoridade policial, novas provas e requisições (arts. 10 a 19, 22 e 23)." },
      { concurso: "cfo-pmce", foco: "Casos concretos que combinem arts. 4º a 23 do CPP: atribuições da autoridade policial, instauração, diligências, prazos e conclusão do inquérito." },
    ],
  },
  {
    prefixo: "drogas",
    topico: "legislacao-penal-especial--lei-de-drogas",
    lotes: [
      { concurso: "pcce-2021", foco: "Sisnad e princípios, atividades de prevenção e atenção ao usuário, o crime do art. 28 (posse para consumo pessoal), penas, critérios para distinguir consumo de tráfico e procedimento aplicável ao usuário." },
      { concurso: "gm-fortaleza", foco: "Tráfico (art. 33, caput e §§), tráfico privilegiado (§ 4º), figuras equiparadas, maquinários (art. 34), associação para o tráfico (art. 35), financiamento (art. 36) e colaboração como informante (art. 37)." },
      { concurso: "pcce-2021", foco: "Prescrição culposa (art. 38), condução de embarcação ou aeronave (art. 39), causas de aumento (art. 40), colaboração premiada (art. 41), fixação da pena (art. 42), vedações do art. 44 e regras de inquérito e procedimento (arts. 50 a 53)." },
      { concurso: "cfo-pmce", foco: "Casos concretos que combinem os crimes dos arts. 28 a 39 com as causas de aumento, a colaboração e as regras de procedimento e de destruição de drogas da Lei 11.343/2006." },
    ],
  },
];

// Trecho de cada edital para o tópico (verticalizados em docs/).
export const EDITAL: Record<string, Record<string, string>> = {
  "lingua-portuguesa--crase": {
    "pcce-2021": "Domínio da estrutura morfossintática do período: (...) emprego dos sinais de pontuação; concordância verbal e nominal; emprego do sinal indicativo de crase; colocação dos pronomes átonos.",
  },
  "direito-constitucional--direitos-e-garantias-fundamentais": {
    "pcce-2021": "3. Direitos e garantias fundamentais. 3.1 Direitos e deveres individuais e coletivos, direitos sociais, direitos de nacionalidade, direitos políticos, partidos políticos.",
    "gm-fortaleza": "2. Dos Direitos e Garantias Fundamentais (Art. 5º ao 11 da CRFB/88).",
    "cfo-pmce": "1. Direitos e garantias fundamentais: direitos e deveres individuais e coletivos, direitos sociais e direitos políticos.",
  },
  "direito-penal--crimes-contra-o-patrimonio": {
    "pcce-2021": "7. Crimes contra o patrimônio.",
    "gm-fortaleza": "2. Dos Crimes contra a Pessoa e contra o Patrimônio (Art. 121 ao 183 do Código Penal).",
    "cfo-pmce": "23. Crimes contra o patrimônio.",
  },
  "direito-processual-penal--inquerito-policial": {
    "pcce-2021": "2. Inquérito policial. 2.1 Histórico, natureza, conceito, finalidade, características, fundamento, titularidade, grau de cognição, valor probatório, formas de instauração, notitia criminis, delatio criminis, procedimentos investigativos, indiciamento, garantias do investigado. 2.2 Conclusão, prazos.",
    "gm-fortaleza": "6. Do Inquérito Policial (Art. 4º ao 23 do Código de Processo Penal).",
    "cfo-pmce": "32. Inquérito policial.",
  },
  "legislacao-penal-especial--lei-de-drogas": {
    "pcce-2021": "15. Repressão ao tráfico ilícito de drogas e seus crimes (Lei nº 11.343/2006).",
    "gm-fortaleza": "Lei nº 11.343/2006 (Lei de Drogas).",
    "cfo-pmce": "39. Lei nº 11.343/2006 (Entorpecentes) e alterações posteriores.",
  },
};

// 10 questões por lote: 3 fáceis, 4 médias e 3 difíceis.
export const DISTRIBUICAO = "3 fáceis (q01 a q03), 4 médias (q04 a q07) e 3 difíceis (q08 a q10)";

export function lerProgresso(): Progresso {
  return JSON.parse(readFileSync(ARQUIVO_PROGRESSO, "utf8"));
}
function salvarProgresso(p: Progresso) {
  writeFileSync(ARQUIVO_PROGRESSO, JSON.stringify(p, null, 2) + "\n");
}
export const pastaLote = (id: string) => `${PASTA}/lotes/${id}`;
const lerJson = (caminho: string) => JSON.parse(readFileSync(caminho, "utf8"));

/** Julgados da lista que tocam as leis do tópico (por enquanto a lista inteira, que é pequena). */
export function listaJurisprudencia() {
  const lista = lerJurisprudencia();
  return lista.length
    ? lista.map((j) => `  - ${j.tribunal}, ${j.tipo} ${j.numero} (${j.dispositivo_afetado}): ${j.tese}`).join("\n")
    : "nenhuma (não cite número de súmula, tema ou processo)";
}

/** Seção com os dispositivos que só podem ser cobrados com nota obrigatória no comentário. */
export function secaoSensiveis(sensiveis: ReturnType<typeof sensiveisDoTopico>, leis: Taxonomia["leis"]) {
  if (!sensiveis.length) return "";
  const itens = sensiveis
    .map((d) => `- ${leis[d.lei]?.nome ?? d.lei}, art. ${d.artigos.map((a) => a.replace("-", "º-")).join(", ")} (${d.situacao}). Nota base: ${notaConferida(d.nota)}`)
    .join("\n");
  return `\n## Dispositivos com ressalva obrigatória
Estes dispositivos podem ser cobrados, mas a questão que os usar (no enunciado, nas alternativas ou no fundamento) DEVE trazer no comentario_geral a nota abaixo, adaptada ao caso, e o enunciado deve deixar claro se cobra a letra da lei ou o entendimento atual. Sem a nota, a questão volta para reescrita.
${itens}
`;
}

export function entradaGeracao(tax: Taxonomia, lote: Lote, extra?: string) {
  const { disciplina, topico } = acharTopico(tax, lote.topico);
  const concurso = tax.concursos.find((c) => c.id === lote.concurso)!;
  const lei = textoLegal(tax, topico);
  const letras = "ABCDE".slice(0, lote.alternativas).split("").join(", ");
  return `# Pedido de geração: lote ${lote.id}

## Parâmetros da produção
- Disciplina: ${disciplina}
- Tema: ${topico.nome}
- Subtemas do tema: ${topico.subtopicos.join("; ") || "não especificados"}
- Foco deste lote (não saia dele): ${lote.foco}
- Cargo: ${concurso.cargo}
- Órgão: ${concurso.orgao}
- Banca examinadora: ${concurso.banca}${concurso.edicao ? ` (${concurso.edicao})` : ""}
- Número de alternativas por questão: ${lote.alternativas} (as letras ${letras} serão atribuídas pelo sistema depois; use ids a1 a a${lote.alternativas})
- Quantidade de questões: 10 (ids q01 a q10)
- Dificuldade: ${DISTRIBUICAO}
- Objetivo: PLATAFORMA
- Data de corte legislativo: ${DATA_CORTE}
- Data de corte jurisprudencial: ${DATA_CORTE}
- Lista de jurisprudência fornecida (só estes podem ser citados pelo número): ${listaJurisprudencia()}
- Perfil da banca: sem questões anteriores fornecidas; use apenas características gerais conhecidas da banca.
- Tamanho das alternativas: a correta não pode ser mais de 25% mais longa que a média das erradas, e no lote ela deve ser a mais longa em no máximo 4 das 10 questões (verificado em código).
${topico.nota ? `- Observação: ${topico.nota}\n` : ""}
## Trecho do edital (${concurso.nome})
${EDITAL[lote.topico]?.[lote.concurso] ?? "não informado"}
${secaoSensiveis(sensiveisDoTopico(topico), tax.leis)}${extra ? `\n${extra}\n` : ""}
## Texto legal fornecido
${lei || "Não há texto legal para este tema (disciplina sem lei de referência). Use conhecimento consolidado e incontroverso da norma-padrão."}
`;
}

function preparar() {
  if (existsSync(ARQUIVO_PROGRESSO)) {
    console.log(`${ARQUIVO_PROGRESSO} já existe: nada a preparar (use "status").`);
    return;
  }
  const tax = lerTaxonomia();
  const lotes: Lote[] = PLANO.flatMap((t) =>
    t.lotes.map((l, i) => {
      const c = tax.concursos.find((x) => x.id === l.concurso)!;
      return {
        id: `${t.prefixo}-0${i + 1}`,
        topico: t.topico,
        concurso: l.concurso,
        banca: c.banca,
        alternativas: c.alternativas,
        foco: l.foco,
        etapa: "pendente" as Etapa,
        reprovadas: [],
        descartadas: [],
        atualizadoEm: new Date().toISOString(),
      };
    }),
  );
  for (const lote of lotes) {
    mkdirSync(pastaLote(lote.id), { recursive: true });
    writeFileSync(`${pastaLote(lote.id)}/entrada.md`, entradaGeracao(tax, lote));
  }
  salvarProgresso({ criadoEm: new Date().toISOString(), dataCorte: DATA_CORTE, lotes });
  console.log(`${lotes.length} lotes preparados em ${PASTA}/lotes/`);
}

function status() {
  const p = lerProgresso();
  const contagem = new Map<string, number>();
  for (const l of p.lotes) {
    contagem.set(l.etapa, (contagem.get(l.etapa) ?? 0) + 1);
    console.log(`${l.id.padEnd(14)} ${l.etapa.padEnd(15)} ${l.banca} ${l.alternativas} alt  reprovadas: ${l.reprovadas.length}  descartadas: ${l.descartadas.length}`);
  }
  console.log([...contagem].map(([e, n]) => `${e}: ${n}`).join(" | "));
}

/** Valida a saída do gerador; com erro, não avança a etapa (o subagente refaz). */
export function validarGerado(caminho: string, lote: Lote, idsEsperados?: string[]) {
  const r = esquemaLoteGerado.safeParse(lerJson(caminho));
  if (!r.success) return { erros: r.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const sensiveis = sensiveisDoTopico(acharTopico(lerTaxonomia(), lote.topico).topico);
  const erros = [...r.data.questoes.flatMap((q) => conferirQuestao(q, lote.alternativas, sensiveis)), ...conferirLote(r.data.questoes)];
  const ids = r.data.questoes.map((q) => q.id);
  if (idsEsperados && !idsEsperados.every((id) => ids.includes(id))) erros.push(`faltam ids: ${idsEsperados.filter((id) => !ids.includes(id)).join(", ")}`);
  if (new Set(ids).size !== ids.length) erros.push("ids de questão repetidos");
  return { erros, lote: r.data };
}

/** O auditor não vê o status nem as ressalvas do gerador. */
export function paraAuditoria(questoes: QuestaoGerada[]) {
  return { questoes: questoes.map(({ status_gerador: _, ressalvas: __, ...q }) => q) };
}

function registrarGeracao(id: string) {
  const p = lerProgresso();
  const lote = p.lotes.find((l) => l.id === id);
  if (!lote) throw new Error(`lote ${id} não existe`);
  const regen = lote.etapa === "regen_pendente";
  if (!regen && lote.etapa !== "pendente") return console.log(`${id}: já está em "${lote.etapa}", nada a fazer.`);
  const arquivo = `${pastaLote(id)}/${regen ? "regen-gerado.json" : "gerado.json"}`;
  if (!existsSync(arquivo)) throw new Error(`${arquivo} não existe`);
  const { erros, lote: gerado } = validarGerado(arquivo, lote, regen ? lote.reprovadas : undefined);
  if (erros.length || !gerado) {
    console.log(`INVALIDO ${arquivo}:\n  ${erros.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(`${pastaLote(id)}/${regen ? "regen-auditoria-entrada.json" : "auditoria-entrada.json"}`, JSON.stringify(paraAuditoria(gerado.questoes), null, 2));
  lote.etapa = regen ? "regen_gerado" : "gerado";
  lote.atualizadoEm = new Date().toISOString();
  salvarProgresso(p);
  console.log(`${id}: ${gerado.questoes.length} questões válidas, pronto para auditoria${regen ? " (regeneração)" : ""}`);
}

/** Aplica a checagem de jurisprudência sobre o veredito do auditor. */
/** Aplica as checagens em código sobre o veredito do auditor: número de julgado fora da lista ou
 *  dispositivo sensível sem nota rebaixam para NECESSITA_DE_CONFERENCIA. */
export function statusFinal(q: QuestaoGerada, a: Auditoria, topicoId: string) {
  const citacoes = citacoesForaDaLista(q, lerJurisprudencia());
  const sensiveis = sensiveisDoTopico(acharTopico(lerTaxonomia(), topicoId).topico);
  // Trecho de nota ainda não conferido na fonte oficial entra na lista como "a confirmar".
  const semNota = [...dispositivosSemNota(q, sensiveis), ...trechosAConfirmar(q, sensiveis).map((t) => `a confirmar: ${t}`)];
  const status = (citacoes.length || semNota.length) && a.status !== "REPROVADA" ? "NECESSITA_DE_CONFERENCIA" : a.status;
  return { status, citacoes, semNota };
}

function registrarAuditoria(id: string) {
  const p = lerProgresso();
  const lote = p.lotes.find((l) => l.id === id);
  if (!lote) throw new Error(`lote ${id} não existe`);
  const regen = lote.etapa === "regen_gerado";
  if (!regen && lote.etapa !== "gerado") return console.log(`${id}: já está em "${lote.etapa}", nada a fazer.`);
  const dir = pastaLote(id);
  const gerado = esquemaLoteGerado.parse(lerJson(`${dir}/${regen ? "regen-gerado.json" : "gerado.json"}`));
  const arquivo = `${dir}/${regen ? "regen-auditoria.json" : "auditoria.json"}`;
  const r = esquemaLoteAuditado.safeParse(lerJson(arquivo));
  if (!r.success) {
    console.log(`INVALIDO ${arquivo}:\n  ${r.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const porId = new Map(r.data.auditorias.map((a) => [a.id, a]));
  const faltando = gerado.questoes.filter((q) => !porId.has(q.id)).map((q) => q.id);
  if (faltando.length) {
    console.log(`INVALIDO ${arquivo}: sem auditoria para ${faltando.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const reprovadas = gerado.questoes.filter((q) => porId.get(q.id)!.status === "REPROVADA");
  if (!regen) {
    lote.reprovadas = reprovadas.map((q) => q.id);
    if (reprovadas.length) {
      // Pedido de regeneração: só as reprovadas, com o motivo, sem mostrar o raciocínio do gerador.
      const motivos = reprovadas
        .map((q) => {
          const a = porId.get(q.id)!;
          return `- ${q.id} (${q.dificuldade}): reprovada pelo auditor. Motivo: ${a.justificativa} Problemas: ${a.problemas.map((x) => x.descricao).join(" | ")}`;
        })
        .join("\n");
      const extra = `## Regeneração
Este pedido substitui questões reprovadas na auditoria. Gere SOMENTE as questões ${lote.reprovadas.join(", ")}, com os mesmos ids e a mesma dificuldade, sobre outros pontos do foco do lote (não reaproveite o caso, o dispositivo e a pegadinha da questão reprovada) e evitando os problemas apontados:
${motivos}
`;
      writeFileSync(`${dir}/regen-entrada.md`, entradaGeracao(lerTaxonomia(), lote, extra));
      lote.etapa = "regen_pendente";
    } else lote.etapa = "concluido";
  } else {
    lote.descartadas = reprovadas.map((q) => ({ id: q.id, motivo: porId.get(q.id)!.justificativa }));
    lote.etapa = "concluido";
  }
  lote.atualizadoEm = new Date().toISOString();
  salvarProgresso(p);
  const resumo = new Map<string, number>();
  for (const q of gerado.questoes) {
    const s = statusFinal(q, porId.get(q.id)!, lote.topico).status;
    resumo.set(s, (resumo.get(s) ?? 0) + 1);
  }
  console.log(`${id}: auditoria${regen ? " da regeneração" : ""} registrada (${[...resumo].map(([s, n]) => `${s} ${n}`).join(", ")}); etapa agora: ${lote.etapa}`);
}

/** Só confere um arquivo (não mexe no progresso): usado pelos subagentes antes de entregar. */
function conferir(id: string, arquivo: string) {
  const lote = lerProgresso().lotes.find((l) => l.id === id);
  if (!lote) throw new Error(`lote ${id} não existe`);
  const json = lerJson(arquivo);
  if ("auditorias" in json) {
    const r = esquemaLoteAuditado.safeParse(json);
    console.log(r.success ? `OK: ${r.data.auditorias.length} auditorias` : `INVALIDO:\n  ${r.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ")}`);
    if (!r.success) process.exitCode = 1;
    return;
  }
  const { erros, lote: gerado } = validarGerado(arquivo, lote);
  if (erros.length) {
    console.log(`INVALIDO:\n  ${erros.join("\n  ")}`);
    process.exitCode = 1;
  } else console.log(`OK: ${gerado!.questoes.length} questões`);
}

// Só roda a linha de comando quando chamado direto (finalizar.ts importa este arquivo).
const direto = /questoes[\\/]piloto\.ts$/.test(process.argv[1] ?? "");
const [comando, arg, arg2] = direto ? process.argv.slice(2) : [];
if (comando === "preparar") preparar();
else if (comando === "conferir" && arg && arg2) conferir(arg, arg2);
else if (comando === "status") status();
else if (comando === "registrar-geracao" && arg) registrarGeracao(arg);
else if (comando === "registrar-auditoria" && arg) registrarAuditoria(arg);
else if (comando) {
  console.log("Comandos: preparar | status | registrar-geracao <lote> | registrar-auditoria <lote>");
  process.exitCode = 1;
}
