"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, parseISO } from "date-fns";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

type SeriesPoint = { day: string; income: number; expense: number };
type BalancePoint = { day: string; balance: number };
type Slice = { name: string; value: number; color: string };

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
};

export function TrendChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d) => format(parseISO(d as string), "d MMM")}
          tickLine={false}
          axisLine={false}
          fontSize={11}
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
          formatter={(v, name) => [formatMoney(Number(v)), name === "income" ? "Income" : "Expense"]}
          labelFormatter={(d) => format(parseISO(d as string), "EEEE, d MMM yyyy")}
        />
        <Legend formatter={(v) => (v === "income" ? "Income" : "Expense")} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="income"  stroke="#10b981" strokeWidth={2} fill="url(#incomeFill)" />
        <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BalanceChart({ data }: { data: BalancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4f46e5" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tickFormatter={(d) => format(parseISO(d as string), "d MMM")} tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickFormatter={(v) => formatMoneyCompact(v as number)} tickLine={false} axisLine={false} fontSize={11} width={70} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [formatMoney(Number(v)), "Balance"]}
          labelFormatter={(d) => format(parseISO(d as string), "EEEE, d MMM yyyy")}
        />
        <Area type="monotone" dataKey="balance" stroke="#4f46e5" strokeWidth={2} fill="url(#balanceFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data }: { data: Slice[] }) {
  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-[12.5px] text-[--color-muted]">No data for this period</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={56}
          outerRadius={88}
          paddingAngle={1}
          stroke="var(--surface)"
        >
          {data.map((s) => <Cell key={s.name} fill={s.color} />)}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, n) => [formatMoney(Number(v)), String(n)]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ data }: { data: Slice[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 28 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => formatMoneyCompact(v as number)} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={120} fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [formatMoney(Number(v)), "Total"]}
          cursor={{ fill: "var(--surface-2)" }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((s) => <Cell key={s.name} fill={s.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
