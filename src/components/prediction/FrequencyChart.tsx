"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface FrequencyChartProps {
  data: { name: string; count: number }[];
}

const SERIES_COLORS = [
  "var(--chart-reading)",
  "var(--chart-listening)",
  "var(--chart-writing)",
  "var(--chart-speaking)",
];

export function FrequencyChart({ data }: FrequencyChartProps) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-gridline)" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-gridline)" }}
            tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-gridline)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--chart-gridline)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value) => [`${value} lần`, "Số lần luyện"]}
          />
          <Bar dataKey="count" barSize={24} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
            ))}
            <LabelList dataKey="count" position="top" style={{ fill: "var(--foreground)", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
