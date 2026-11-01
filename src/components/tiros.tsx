import type { CSSProperties } from "react";

// Onde cada tiro acerta o cartão (x e y em %): nos cantos e bordas, para não cobrir a frase.
const PONTOS = [
  { x: 9, y: 26, tam: 5.2 },
  { x: 91, y: 74, tam: 4.6 },
  { x: 14, y: 86, tam: 4 },
  { x: 86, y: 16, tam: 4.4 },
  { x: 60, y: 92, tam: 3.8 },
];
/** Intervalo entre os tiros da rajada (o tranco do cartão usa o mesmo ritmo, em globals.css). */
const INTERVALO = 0.16;

const n = (v: number) => v.toFixed(1);
const ponto = (a: number, r: number) => `${n(Math.cos(a) * r)} ${n(Math.sin(a) * r)}`;

/**
 * Furo de bala: marca de pólvora, reboco lascado, o furo e a teia de rachaduras (raios de tamanhos
 * diferentes, alguns com galho, e pedaços de anel ligando os raios). Tudo sai do índice (sem Math.random).
 */
function Furo({ i }: { i: number }) {
  const total = 11;
  const raios = Array.from({ length: total }, (_, k) => {
    const angulo = (k / total) * Math.PI * 2 + (((i * 13 + k * 7) % 10) / 10) * 0.45;
    const comprimento = k % 3 === 0 ? 40 + ((i * 7 + k) % 8) : 18 + ((i * 17 + k * 11) % 20);
    const desvio = (((i + k) % 3) - 1) * 0.18;
    const meio = comprimento * 0.5;
    let d = `M${ponto(angulo, 10)} L${ponto(angulo + desvio, meio)} L${ponto(angulo - desvio / 2, comprimento)}`;
    // Galho saindo do meio dos raios longos.
    if (k % 3 === 0) d += ` M${ponto(angulo + desvio, meio)} L${ponto(angulo + desvio + 0.45, meio + 12)}`;
    return { angulo, comprimento, d };
  });
  // Anéis: ligam raios vizinhos nas distâncias 17 e 27 (só onde os dois chegam até lá).
  const aneis = [17, 27].flatMap((r, j) =>
    raios.flatMap((raio, k) => {
      const prox = raios[(k + 1) % total]!;
      if ((k + i + j) % 2 || raio.comprimento < r || prox.comprimento < r) return [];
      return [`M${ponto(raio.angulo, r)} L${ponto(prox.angulo, r + ((k % 2) * 2 - 1) * 1.5)}`];
    }),
  );
  const lasca = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2;
    return ponto(a, 11 + ((i * 5 + k * 7) % 7)).replace(" ", ",");
  }).join(" ");
  return (
    <svg viewBox="-50 -50 100 100" style={{ rotate: `${i * 67}deg` }}>
      <circle r={22} fill="var(--color-furo)" fillOpacity={0.12} />
      <path
        d={[...raios.map((r) => r.d), ...aneis].join(" ")}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points={lasca} fill="var(--color-borda-forte)" fillOpacity={0.7} />
      <circle r={9} fill="var(--color-furo)" stroke="var(--color-suave)" strokeOpacity={0.5} strokeWidth={1.4} />
      <circle cx={-1.8} cy={-1.8} r={4.5} fill="var(--color-furo)" stroke="currentColor" strokeOpacity={0.15} strokeWidth={0.8} />
    </svg>
  );
}

/**
 * Rajada no cartão da frase (o pai precisa de `relative overflow-hidden` e da classe `rajada` com --tiros,
 * para o tranco a cada tiro). Cada tiro: clarão, furo, estilhaços e um pouco de fumaça.
 */
export function Rajada({ tiros }: { tiros: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {PONTOS.slice(0, tiros).map((p, i) => (
        <span
          key={i}
          className="furo"
          style={{ "--x": `${p.x}%`, "--y": `${p.y}%`, "--tam": `${p.tam}rem`, "--atraso": `${0.1 + i * INTERVALO}s` } as CSSProperties}
        >
          <span className="fumaca" />
          <Furo i={i} />
          <span className="clarao" />
          {Array.from({ length: 5 }, (_, k) => {
            const a = (k / 5) * Math.PI * 2 + i;
            const d = 22 + ((i * 7 + k * 5) % 16);
            return <span key={k} className="estilhaco" style={{ "--dx": `${n(Math.cos(a) * d)}px`, "--dy": `${n(Math.sin(a) * d)}px` } as CSSProperties} />;
          })}
        </span>
      ))}
    </div>
  );
}
