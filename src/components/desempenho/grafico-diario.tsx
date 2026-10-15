"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rotuloDia } from "@/lib/datas";
import type { PontoDia } from "@/server/desempenho";

export function GraficoDiario({ dados }: { dados: PontoDia[] }) {
  const comRotulo = dados.map((d) => ({ ...d, rotulo: rotuloDia(d.dia) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={comRotulo} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-borda)" />
          <XAxis
            dataKey="rotulo"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
            tick={{ fontSize: 11, fill: "var(--color-suave)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-suave)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--color-fundo)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-borda)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="acertos" name="Acertos" stackId="a" fill="var(--color-acerto)" />
          <Bar
            dataKey="erros"
            name="Erros"
            stackId="a"
            fill="var(--color-erro)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
