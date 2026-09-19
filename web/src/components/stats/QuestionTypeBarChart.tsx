"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface QuestionTypeBarChartProps {
  data: { name: string; value: number }[];
  color: string;
  /** Appended to the tooltip/label value, e.g. "lần" or "%". */
  unit: string;
}

/**
 * Horizontal bars (better for many/long category names than vertical — see
 * dataviz skill's choosing-a-form guidance) comparing one *magnitude* across
 * a single skill's own question types. All bars share one hue: these aren't
 * distinct identities being compared (that's what the 4-skill FrequencyChart
 * uses categorical color for), they're sub-categories of the same skill, so
 * per the dataviz skill's color-formula this is a sequential/single-hue job,
 * not categorical — no need to invent 10 distinguishable colors.
 */
export function QuestionTypeBarChart({ data, color, unit }: QuestionTypeBarChartProps) {
  const height = Math.max(120, data.length * 34);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          barCategoryGap="24%"
          margin={{ top: 4, right: 36, left: 8, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--chart-gridline)" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
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
            formatter={(value) => [`${value} ${unit}`, ""]}
          />
          <Bar dataKey="value" fill={color} barSize={16} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value) => `${value}${unit === "%" ? "%" : ""}`}
              style={{ fill: "var(--foreground)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
