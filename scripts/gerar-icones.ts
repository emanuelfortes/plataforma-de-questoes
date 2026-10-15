// Gera os ícones do app (PWA) em public/icones a partir de um desenho SVG com as iniciais.
// Uso: npx tsx scripts/gerar-icones.ts
// Rode de novo se mudar as cores da marca (src/app/globals.css) ou as iniciais.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const MARCA = "#2f6bff"; // --color-marca
const INICIAIS = "RN";
const PASTA = "public/icones";

// "seguro": fração do lado onde as letras cabem. Ícones "maskable" são recortados em círculo
// pelo Android, então as letras precisam caber nos 80% centrais (o fundo azul vai até a borda).
// "cantos": fundo arredondado e transparente fora dele (favicon da aba do navegador).
function svg(lado: number, seguro: number, cantos: boolean) {
  const quadro = lado * seguro;
  const raio = cantos ? lado * 0.22 : 0;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}">
  <rect width="${lado}" height="${lado}" rx="${raio}" fill="${MARCA}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" fill="#ffffff"
    font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${quadro * 0.42}">${INICIAIS}</text>
</svg>`);
}

const ICONES = [
  { arquivo: "icone-192.png", lado: 192, seguro: 1, cantos: false },
  { arquivo: "icone-512.png", lado: 512, seguro: 1, cantos: false },
  { arquivo: "icone-maskable-512.png", lado: 512, seguro: 0.75, cantos: false },
  { arquivo: "apple-touch-icon.png", lado: 180, seguro: 1, cantos: false },
  { arquivo: "favicon-48.png", lado: 48, seguro: 1, cantos: true },
];

await mkdir(PASTA, { recursive: true });
for (const i of ICONES) {
  await sharp(svg(i.lado, i.seguro, i.cantos)).png().toFile(`${PASTA}/${i.arquivo}`);
  console.log(`  ${PASTA}/${i.arquivo}`);
}
