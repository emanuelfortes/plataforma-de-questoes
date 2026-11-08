// Testa se as credenciais (EFI_CLIENT_ID e EFI_CLIENT_SECRET) e o certificado (EFI_CERTIFICADO) entram na API Pix
// da Efí. Só consulta uma cobrança que não existe: não grava nada e não cobra ninguém.
//
//   npx tsx --conditions=react-server scripts/efi/testar-conexao.ts
import "../_env";
import { consultarCobPix, ErroEfi, listarPlanosEfi } from "../../src/server/efi";

console.log(`Ambiente: ${process.env.EFI_SANDBOX === "true" ? "homologação" : "PRODUÇÃO"}`);
try {
  await consultarCobPix("testedeconexao0000000000000000");
  console.log("Resposta inesperada: a cobrança de teste existe.");
} catch (erro) {
  // Erro na rota do token (/oauth/token) = credencial ou certificado; erro na rota da cobrança = autenticou.
  if (erro instanceof ErroEfi && (erro.status === 404 || erro.status === 400) && !erro.message.includes("/oauth/token")) {
    console.log(`CONEXÃO OK: credenciais e certificado aceitos (a Efí respondeu ${erro.status}: cobrança de teste não existe, como esperado).`);
    console.log("Resposta:", erro.message);
  } else if (erro instanceof ErroEfi) {
    console.log(`A Efí recusou (status ${erro.status}):`, JSON.stringify(erro.corpo).slice(0, 300));
  } else {
    console.log("Falha de conexão:", erro instanceof Error ? erro.message : erro);
  }
}

// API Cobranças (cartão): token e lista de planos, só leitura.
try {
  const planos = await listarPlanosEfi();
  console.log(`API COBRANÇAS OK: ${planos.data?.length ?? 0} plano(s) na conta.`, JSON.stringify(planos.data).slice(0, 400));
} catch (erro) {
  console.log("API Cobranças recusou:", erro instanceof Error ? erro.message : erro);
}
