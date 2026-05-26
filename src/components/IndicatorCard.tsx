"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { CRISIS_INDICATORS, MACRO_INDICATORS } from "@/lib/indicators";

interface Observation {
  date: string;
  value: string;
}

interface SeriesData {
  seriesId: string;
  title: string;
  units: string;
  lastUpdated: string;
  observations: Observation[];
}

interface IndicatorCardProps {
  seriesId: string;
  displayName?: string;
  onClick?: () => void;
}

type RangeKey = "1Y" | "5Y" | "10Y" | "MAX";

const RANGES: { key: RangeKey; label: string; years: number | null }[] = [
  { key: "1Y", label: "1년", years: 1 },
  { key: "5Y", label: "5년", years: 5 },
  { key: "10Y", label: "10년", years: 10 },
  { key: "MAX", label: "전체", years: null },
];

function getStartDate(years: number | null): string {
  if (years === null) return "";
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split("T")[0];
}

export default function IndicatorCard({
  seriesId,
  displayName,
  onClick,
}: IndicatorCardProps) {
  const [range, setRange] = useState<RangeKey>("5Y");
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const rangeConf = RANGES.find((r) => r.key === range)!;
    const startDate = getStartDate(rangeConf.years);
    const url = `/api/fred?seriesId=${seriesId}${
      startDate ? `&startDate=${startDate}` : ""
    }`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [seriesId, range]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-5 h-72 flex items-center justify-center">
        <div className="text-gray-500 text-sm">
          {displayName ?? seriesId} 로딩 중...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/30 p-5 h-72">
        <h3 className="text-sm font-semibold text-red-400 mb-2">
          {displayName ?? seriesId}
        </h3>
        <p className="text-xs text-red-500">로드 실패: {error}</p>
      </div>
    );
  }

  const obs = data.observations
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .filter((o) => !isNaN(o.value));

  const latest = obs[obs.length - 1];
  const previous = obs[obs.length - 2];
  const latestValue = latest?.value ?? 0;
  const previousValue = previous?.value ?? 0;
  const change = latestValue - previousValue;
  const changePercent = previousValue ? (change / previousValue) * 100 : 0;
  const isUp = change > 0;
  const isDown = change < 0;

    // 이 지표의 위험 기준값 찾기
  const indicator = [...CRISIS_INDICATORS, ...MACRO_INDICATORS].find(
    (i) => i.seriesId === seriesId
  );

  // 차트 Y축 범위 — 기준선까지 포함
  const dataMin = obs.length > 0 ? Math.min(...obs.map((o) => o.value)) : 0;
  const dataMax = obs.length > 0 ? Math.max(...obs.map((o) => o.value)) : 1;
  const thresholds = [
    indicator?.warningThreshold,
    indicator?.dangerThreshold,
  ].filter((v): v is number => v !== undefined);
  const minVal = Math.min(dataMin, ...thresholds);
  const maxVal = Math.max(dataMax, ...thresholds);
  const padding = (maxVal - minVal) * 0.1;

  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-gray-700 bg-gray-900 p-3 sm:p-5 hover:border-gray-500 hover:bg-gray-800 transition-colors cursor-pointer"
    >

      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-200 truncate">
            {displayName ?? data.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{data.units}</p>
        </div>
        <span className="text-xs text-gray-600 font-mono ml-2 shrink-0">
          {seriesId}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold text-white">
          {latestValue.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
        </span>
        <span
          className={`text-xs font-medium ${
            isUp
              ? "text-red-400"
              : isDown
              ? "text-blue-400"
              : "text-gray-400"
          }`}
        >
          {isUp ? "▲" : isDown ? "▼" : "—"}{" "}
          {Math.abs(change).toFixed(2)} ({changePercent.toFixed(2)}%)
        </span>
      </div>

      <div className="h-28 sm:h-32 -mx-2 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={obs}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v) => v.slice(0, 7)}
              minTickGap={40}
            />
            <YAxis
              domain={[minVal - padding, maxVal + padding]}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#9ca3af" }}
              itemStyle={{ color: "#60a5fa" }}
              formatter={(value) =>
                typeof value === "number" ? value.toFixed(2) : String(value)
              }
            />
               {(() => {
              const ind = [...CRISIS_INDICATORS, ...MACRO_INDICATORS].find(
                (i) => i.seriesId === seriesId
              );
              return (
                <>
                  {ind?.warningThreshold !== undefined && (
                    <ReferenceLine
                      y={ind.warningThreshold}
                      stroke="#eab308"
                      strokeDasharray="4 4"
                      strokeOpacity={0.7}
                    />
                  )}
                  {ind?.dangerThreshold !== undefined && (
                    <ReferenceLine
                      y={ind.dangerThreshold}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      strokeOpacity={0.7}
                    />
                  )}
                </>
              );
            })()}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#60a5fa"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={(e) => {
              e.stopPropagation();
              setRange(r.key);
            }}
            className={`text-xs px-2 py-1.5 sm:py-1 rounded transition-colors flex-1 ${
              range === r.key
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 border-t border-gray-800 pt-2">
        <div>최근 발표: {latest?.date}</div>
        <div>출처: FRED · {data.lastUpdated.split(" ")[0]}</div>
      </div>
    </div>
  );
}