"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

type Point = { day: string; balance: number; projected: boolean };

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
};

export function ForecastChart({ data }: { data: Point[] }) {
  // Split into two series so we can style historical vs projected differently.
  // Recharts can't render a single line with a per-segment style, so we
  // duplicate the data with the "other" series filled with null.
  const merged = data.map((p) => ({
    day: p.day,
    historical: p.projected ? null : p.balance,
    projected:  p.projected ? p.balance : null,
  }));

  // Find the boundary day (last historical) for the dashed reference line.
  const boundaryIdx = data.findIndex((p) => p.projected);
  const boundaryDay = boundaryIdx > 0 ? data[boundaryIdx - 1].day : null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={merged} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4f46e5" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#a855f7" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d) => format(parseISO(d as string), "d MMM")}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          minTickGap={28}
        />
        <YAxis
          tickFormatter={(v) => formatMoneyCompact(v as number)}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={70}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, n) => {
            if (v == null) return ["", ""];
            return [formatMoney(Number(v)), n === "historical" ? "Balance" : "Projected"];
          }}
          labelFormatter={(d) => format(parseISO(d as string), "EEEE, d MMM yyyy")}
        />
        <Area
          type="monotone"
          dataKey="historical"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#histFill)"
          connectNulls={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="projected"
          stroke="#a855f7"
          strokeWidth={2}
          strokeDasharray="4 3"
          fill="url(#projFill)"
          connectNulls={false}
          isAnimationActive={false}
        />
        {boundaryDay ? (
          <ReferenceLine
            x={boundaryDay}
            stroke="var(--muted-2)"
            strokeDasharray="2 2"
            label={{ value: "today", fill: "var(--muted)", fontSize: 10, position: "top" }}
          />
        ) : null}
        {/* Zero line — visible when balance crosses into the negative */}
        <ReferenceLine y={0} stroke="var(--border)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
