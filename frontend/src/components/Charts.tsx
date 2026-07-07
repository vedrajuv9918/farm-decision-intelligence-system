import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ChartPoint } from "../types/api";

export function TrendChart({ data, color = "#2E7D32" }: { data: ChartPoint[]; color?: string }) {
  return (
    <div className="h-64 rounded-lg bg-white p-4 shadow-soft">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => Number(value).toLocaleString("en-IN")} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fill="url(#trendGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-64 rounded-lg bg-white p-4 shadow-soft">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => Number(value).toLocaleString("en-IN")} />
          <Tooltip />
          <Bar dataKey="value" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineTrendChart({ data, color = "#2E7D32" }: { data: ChartPoint[]; color?: string }) {
  return (
    <div className="h-72 rounded-lg bg-white p-4 shadow-soft">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => Number(value).toLocaleString("en-IN")} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
