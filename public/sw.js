// Service worker do PWA. Registrado em src/components/registrar-sw.tsx.
//
// De propósito ele NÃO guarda páginas nem respostas da API: o conteúdo é por aluno (sessão,
// questões, desempenho) e um cache errado mostraria dados velhos ou de outra conta.
// Ele só guarda a página "sem internet" e os ícones, e mostra essa página quando a rede cai.
// Mudou este arquivo? Troque a VERSAO para os aparelhos descartarem o cache antigo.
const VERSAO = "v1";
const CACHE = `rn-offline-${VERSAO}`;
const OFFLINE = "/offline.html";
const ARQUIVOS = [OFFLINE, "/icones/icone-192.png", "/icones/favicon-48.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  // Só navegação de página (abrir/recarregar uma tela). Todo o resto segue direto para a rede.
  if (pedido.mode !== "navigate") return;
  evento.respondWith(fetch(pedido).catch(() => caches.match(OFFLINE)));
});
