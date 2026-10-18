// Gera os ícones do app (PWA) em public/icones a partir da logo (public/marca/logo-riccardo.png).
// Uso: npx tsx scripts/gerar-icones.ts
// Rode de novo se trocar a logo ou a cor de fundo da marca (src/app/globals.css).
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const LOGO = "public/marca/logo-riccardo.png";
const FUNDO = "#081433"; // --color-fundo
const PASTA = "public/icones";

// "escala": fração do lado ocupada pela logo. Ícones "maskable" são recortados em círculo pelo
// Android, então a logo precisa caber nos ~60% centrais. "fundo": false deixa transparente (favicon).
const ICONES = [
  { arquivo: "icone-192.png", lado: 192, escala: 0.84, fundo: true },
  { arquivo: "icone-512.png", lado: 512, escala: 0.84, fundo: true },
  { arquivo: "icone-maskable-512.png", lado: 512, escala: 0.6, fundo: true },
  { arquivo: "apple-touch-icon.png", lado: 180, escala: 0.8, fundo: true },
  { arquivo: "favicon-48.png", lado: 48, escala: 1, fundo: false },
];

await mkdir(PASTA, { recursive: true });
for (const i of ICONES) {
  const tamanhoLogo = Math.round(i.lado * i.escala);
  const logo = await sharp(LOGO)
    .resize(tamanhoLogo, tamanhoLogo, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: i.lado,
      height: i.lado,
      channels: 4,
      background: i.fundo ? FUNDO : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(`${PASTA}/${i.arquivo}`);
  console.log(`  ${PASTA}/${i.arquivo}`);
}
