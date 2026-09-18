"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface QuestionTypeRadarChartProps {
  data: { name: string; value: number }[];
  color: string;
}

/**
 * "Balance profile" across a skill's question types — one axis per type,
 * value = share of practice (%). Single series (this skill), so one hue is
 * correct per the dataviz skill (color follows the entity, not the category
 * count) — a legend would be redundant since the title already names it.
 */
export function QuestionTypeRadarChart({ data, color }: QuestionTypeRadarChartProps) {
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="var(--chart-gridline)" />
          <PolarAngleAxis dataKey="name" tick={{ fill: "var(--chart-muted)", fontSize: 10 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, "dataMax"]}
            tick={{ fill: "var(--chart-muted)", fontSize: 10 }}
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--chart-gridline)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value) => [`${value}%`, "Tỉ lệ"]}
          />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
