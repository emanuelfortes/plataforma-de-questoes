// Separa o comentário da questão em partes para exibir (explicação, alternativa por alternativa, letra da lei,
// avisos). O texto no banco não muda: as partes vêm dos rótulos que a geração e as importações já usam
// ("Análise das alternativas:", "Fundamento legal:", "Pegadinha:" ...). Sem rótulo, fica um texto só.

export type ItemAlternativa = { letra: string; estado: "correta" | "errada" | null; texto: string };

export type ParteComentario =
  | { tipo: "texto"; texto: string }
  | { tipo: "alternativas"; itens: ItemAlternativa[] }
  | { tipo: "lei"; rotulo: string; texto: string }
  | { tipo: "aviso"; rotulo: string; texto: string }
  | { tipo: "nota"; rotulo: string; texto: string };

// Rótulo encontrado no texto: tipo da parte e título mostrado ao aluno.
const ROTULOS: { padrao: string; tipo: ParteComentario["tipo"]; titulo: string }[] = [
  { padrao: "Análise das alternativas", tipo: "alternativas", titulo: "Alternativa por alternativa" },
  { padrao: "Fundamento legal", tipo: "lei", titulo: "Letra da lei" },
  { padrao: "Fundamento jurisprudencial", tipo: "lei", titulo: "Jurisprudência" },
  { padrao: "Jurisprudência", tipo: "lei", titulo: "Jurisprudência" },
  { padrao: "Fundamento", tipo: "lei", titulo: "Letra da lei" },
  { padrao: "Pegadinha", tipo: "aviso", titulo: "Pegadinha" },
  { padrao: "MACETE DO RICCARDO", tipo: "aviso", titulo: "Macete do Riccardo" },
  { padrao: "FIQUE LIGADO", tipo: "aviso", titulo: "Fique ligado" },
  { padrao: "CUIDADO NA PROVA", tipo: "aviso", titulo: "Cuidado na prova" },
  { padrao: "Atenção", tipo: "aviso", titulo: "Atenção" },
  { padrao: "Atualização", tipo: "nota", titulo: "Atualização" },
];

// Rótulo no começo do texto, depois de quebra de linha ou depois do fim de uma frase.
const RE_ROTULO = new RegExp(
  `(^|\\n|[.!?;)"”»]\\s)\\s*(${ROTULOS.map((r) => r.padrao).join("|")})\\s*:\\s*`,
  "g",
);

export type MarcaAlternativa = { letra: string; inicio: number; fim: number };

/**
 * Onde começa cada "A)", "B)"... num trecho de análise. Procura as letras em sequência (A, depois B...) e,
 * havendo mais de um "C)" (ex.: "(B − C)" numa questão de conjuntos), prefere o que vem depois de fim de frase.
 */
export function localizarAlternativas(texto: string): MarcaAlternativa[] {
  const todas = [...texto.matchAll(/(^|\s)\(?([A-E])\)\s+/g)].map((m) => {
    const inicio = m.index! + m[1]!.length;
    const antes = texto.slice(Math.max(0, inicio - 3), inicio);
    return { letra: m[2]!, inicio, fim: m.index! + m[0].length, aposFrase: inicio === 0 || /[.!?;:\n]\s*$/.test(antes) };
  });
  const marcas: MarcaAlternativa[] = [];
  let pos = 0;
  for (let c = (todas[0]?.letra ?? "A").charCodeAt(0); c <= 69; c++) {
    const letra = String.fromCharCode(c);
    const candidatas = todas.filter((m) => m.letra === letra && m.inicio >= pos);
    const escolhida = candidatas.find((m) => m.aposFrase) ?? candidatas[0];
    if (!escolhida) break;
    marcas.push({ letra, inicio: escolhida.inicio, fim: escolhida.fim });
    pos = escolhida.fim;
  }
  return marcas;
}

/** "A) Errada: ...  B) Correta. ..." vira uma lista; precisa de pelo menos duas letras em ordem. */
function separarAlternativas(texto: string): ItemAlternativa[] | null {
  const ordem = localizarAlternativas(texto);
  if (ordem.length < 2) return null;
  return ordem.map((m, i) => {
    let t = texto.slice(m.fim, ordem[i + 1]?.inicio ?? texto.length).trim();
    let estado: ItemAlternativa["estado"] = null;
    const s = /^(correta|certa|incorreta|errada)\b\s*[.:,;\-–]?\s*/i.exec(t);
    if (s) {
      estado = /^(correta|certa)$/i.test(s[1]!) ? "correta" : "errada";
      t = t.slice(s[0].length);
    }
    return { letra: m.letra, estado, texto: t.charAt(0).toUpperCase() + t.slice(1) };
  });
}

export function separarComentario(comentario: string): ParteComentario[] {
  const texto = comentario.replace(/\r\n/g, "\n").trim();
  const achados = [...texto.matchAll(RE_ROTULO)].map((m) => ({
    rotulo: ROTULOS.find((r) => r.padrao === m[2])!,
    inicio: m.index! + m[1]!.length,
    fim: m.index! + m[0].length,
  }));
  if (!achados.length) return [{ tipo: "texto", texto }];

  const partes: ParteComentario[] = [];
  const intro = texto.slice(0, achados[0]!.inicio).trim();
  if (intro) partes.push({ tipo: "texto", texto: intro });
  achados.forEach((a, i) => {
    const corpo = texto.slice(a.fim, achados[i + 1]?.inicio ?? texto.length).trim();
    if (!corpo) return;
    if (a.rotulo.tipo === "alternativas") {
      const itens = separarAlternativas(corpo);
      partes.push(itens ? { tipo: "alternativas", itens } : { tipo: "texto", texto: corpo });
    } else if (a.rotulo.tipo === "texto") {
      partes.push({ tipo: "texto", texto: corpo });
    } else {
      partes.push({ tipo: a.rotulo.tipo, rotulo: a.rotulo.titulo, texto: corpo });
    }
  });
  return partes;
}
