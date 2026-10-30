// Baixa o texto integral e atualizado das leis de data/taxonomia.json para data/leis/<id>.txt.
// Uso: npx tsx scripts/leis/baixar-leis.ts            (todas as leis federais do planalto)
//      npx tsx scripts/leis/baixar-leis.ts cf88 cp     (só as indicadas)
//
// O texto riscado no planalto (<strike>) é dispositivo revogado ou com redação antiga: é removido,
// para a geração de questões nunca usar redação revogada. Leis estaduais e municipais não estão
// no planalto: o script avisa e elas precisam ser salvas à mão em data/leis/<id>.txt.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

type Lei = { nome: string; fonte: string; observacao?: string };
const taxonomia = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync("data/taxonomia.json", "utf8"))) as {
  leis: Record<string, Lei>;
};

const PASTA = "data/leis";
mkdirSync(PASTA, { recursive: true });

const ENTIDADES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", sect: "§", deg: "°" };

function htmlParaTexto(html: string) {
  return (
    html
      // Fora do corpo da lei: cabeçalho do site, scripts e estilos.
      .replace(/<(script|style|header|footer)[\s\S]*?<\/\1>/gi, "")
      // Redação revogada ou alterada: o planalto mostra riscada.
      .replace(/<(strike|s|del)\b[\s\S]*?<\/\1>/gi, "")
      // Quebras de linha do próprio HTML não são quebras do texto (o navegador as trata como espaço).
      .replace(/\s+/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|h\d|li|table)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (m, nome) => ENTIDADES[nome.toLowerCase()] ?? m)
      .replace(/[ \t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      // Linhas que sobram só com marcação de remissão.
      .replace(/^\((Vide|Incluído|Redação dada|Revogado)[^\n]*\)$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

const pedidas = process.argv.slice(2);
const ids = Object.keys(taxonomia.leis).filter((id) => !pedidas.length || pedidas.includes(id));
const manuais: string[] = [];

for (const id of ids) {
  const lei = taxonomia.leis[id]!;
  if (!lei.fonte.includes("planalto.gov.br")) {
    manuais.push(`${id}: ${lei.nome} (${lei.fonte})${existsSync(`${PASTA}/${id}.txt`) ? " [já existe]" : ""}`);
    continue;
  }
  try {
    const resposta = await fetch(lei.fonte, { headers: { "User-Agent": "Mozilla/5.0 (plataforma de questoes)" } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    // O planalto serve as páginas em Windows-1252.
    // A maioria das páginas do Planalto vem em windows-1252; algumas (ex.: Lei Maria da Penha) em UTF-16,
    // marcadas pelos bytes FF FE no começo. Sem isto, o texto saía como "ÿþ L e i ..." e a lei ficava vazia.
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    const codificacao = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "windows-1252";
    const html = new TextDecoder(codificacao).decode(bytes);
    const texto = htmlParaTexto(html);
    const cabecalho = [
      `# ${lei.nome}`,
      `# Fonte: ${lei.fonte}`,
      `# Baixado em: ${new Date().toISOString().slice(0, 10)} (texto compilado; trechos riscados/revogados removidos)`,
      ...(lei.observacao ? [`# Observação: ${lei.observacao}`] : []),
      "",
    ].join("\n");
    writeFileSync(`${PASTA}/${id}.txt`, `${cabecalho}\n${texto}\n`);
    console.log(`ok  ${id.padEnd(24)} ${(texto.length / 1000).toFixed(0).padStart(5)} mil caracteres`);
  } catch (erro) {
    console.log(`ERRO ${id}: ${erro instanceof Error ? erro.message : erro}`);
  }
  await new Promise((r) => setTimeout(r, 800)); // gentil com o servidor do planalto
}

if (manuais.length) {
  console.log(`\nSalvar à mão em ${PASTA}/<id>.txt (não estão no planalto):`);
  for (const m of manuais) console.log(`  ${m}`);
}
