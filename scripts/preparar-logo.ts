// Prepara a logo para fundo escuro: no arquivo original as partes brancas (caveira, fuzis,
// contorno) são transparentes, então "somem" sobre o azul-marinho da plataforma.
// Aqui, tudo que é transparente DENTRO do brasão vira branco; só o lado de fora continua
// transparente (descoberto por preenchimento a partir das bordas da imagem).
// Uso: npx tsx scripts/preparar-logo.ts caminho/da/logo-original.png
import sharp from "sharp";

const ORIGEM = process.argv[2] ?? "F:/GitHub/riccardo-nobrega/src/img/logo-riccardo.png";

const { data, info } = await sharp(ORIGEM).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: l, height: a } = info;
const fora = new Uint8Array(l * a);
const pilha: number[] = [];
const transparente = (p: number) => data[p * 4 + 3]! < 128;
for (let x = 0; x < l; x++) pilha.push(x, (a - 1) * l + x);
for (let y = 0; y < a; y++) pilha.push(y * l, y * l + l - 1);
while (pilha.length) {
  const p = pilha.pop()!;
  if (fora[p] || !transparente(p)) continue;
  fora[p] = 1;
  const x = p % l;
  if (x > 0) pilha.push(p - 1);
  if (x < l - 1) pilha.push(p + 1);
  if (p >= l) pilha.push(p - l);
  if (p < l * (a - 1)) pilha.push(p + l);
}

const vizinhoDeFora = (p: number) => {
  const x = p % l;
  return (x > 0 && fora[p - 1]) || (x < l - 1 && fora[p + 1]) || (p >= l && fora[p - l]) || (p < l * (a - 1) && fora[p + l]);
};

for (let p = 0; p < l * a; p++) {
  // Fora do brasão e a borda suavizada dele ficam como estão.
  if (fora[p] || vizinhoDeFora(p)) continue;
  const i = p * 4;
  const alfa = data[i + 3]! / 255;
  // Mistura o pixel sobre branco e deixa opaco.
  for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c]! * alfa + 255 * (1 - alfa));
  data[i + 3] = 255;
}

await sharp(data, { raw: { width: l, height: a, channels: 4 } })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile("public/marca/logo-riccardo.png");
await sharp("public/marca/logo-riccardo.png").resize(192, 192).png({ compressionLevel: 9 }).toFile("public/marca/logo-email.png");
console.log("public/marca/logo-riccardo.png e logo-email.png gerados");
