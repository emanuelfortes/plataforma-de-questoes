// Confere a configuração da Efí e cadastra a URL dos avisos de Pix na chave.
//
//   npx tsx --conditions=react-server scripts/efi/configurar.ts              confere credenciais, certificado e o aviso atual
//   npx tsx --conditions=react-server scripts/efi/configurar.ts --aplicar    cadastra (ou troca) a URL do aviso de Pix
//
// Usa as variáveis do .env.local (EFI_*). Com EFI_SANDBOX=true fala com a homologação. A URL do aviso sai de
// BETTER_AUTH_URL: rode com o endereço do site no ar (https), não com localhost.
import "../_env";
import { cadastrarWebhookPix, consultarWebhookPix, efiCartaoAtivo, efiPixAtivo } from "../../src/server/efi";
import { urlsDeAviso } from "../../src/server/assinatura-efi";

const APLICAR = process.argv.includes("--aplicar");
const esconder = (url: string) => url.replace(/hmac=[^&]+/, "hmac=***");

console.log(`Ambiente: ${process.env.EFI_SANDBOX === "true" ? "homologação" : "PRODUÇÃO"}`);
// Só os nomes (nunca os valores): o que está preenchido e o que falta.
for (const nome of ["EFI_CLIENT_ID", "EFI_CLIENT_SECRET", "EFI_CERTIFICADO", "EFI_CHAVE_PIX", "NEXT_PUBLIC_EFI_CONTA", "EFI_WEBHOOK_SEGREDO", "BETTER_AUTH_URL"]) {
  console.log(`  ${process.env[nome]?.trim() ? "ok   " : "FALTA"} ${nome}`);
}
console.log(`Pix na Efí: ${efiPixAtivo() ? "configurado" : "falta EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_CERTIFICADO ou EFI_CHAVE_PIX"}`);
console.log(`Cartão na Efí: ${efiCartaoAtivo() ? "configurado" : "falta NEXT_PUBLIC_EFI_CONTA (identificador de conta)"}`);
if (!process.env.EFI_WEBHOOK_SEGREDO) {
  console.log("Falta EFI_WEBHOOK_SEGREDO (um texto aleatório longo, só letras e números).");
  process.exit(1);
}
if (!efiPixAtivo()) process.exit(1);

const urls = urlsDeAviso();
console.log(`Aviso de Pix:      ${esconder(urls.pix)}`);
console.log(`Aviso de cobrança: ${esconder(urls.cobrancas)} (vai em cada assinatura no cartão)`);

try {
  const atual = await consultarWebhookPix();
  const url = (atual as { webhookUrl?: string })?.webhookUrl;
  console.log(`Aviso cadastrado hoje na chave: ${url ? esconder(url) : "(nenhum)"}`);
} catch (erro) {
  // 404 = nenhum aviso cadastrado; outro erro costuma ser credencial ou certificado.
  console.log("Consulta do aviso:", erro instanceof Error ? erro.message : erro);
}

if (!APLICAR) {
  console.log("\nCredenciais e certificado OK. Para cadastrar o aviso de Pix, rode de novo com --aplicar.");
  process.exit(0);
}
if (!urls.pix.startsWith("https://")) {
  console.log("A URL do aviso precisa ser https (confira BETTER_AUTH_URL).");
  process.exit(1);
}
await cadastrarWebhookPix(urls.pix);
console.log("Aviso de Pix cadastrado.");
