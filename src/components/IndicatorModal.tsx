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
import { INDICATOR_DESCRIPTIONS } from "@/lib/indicatorDescriptions";
import { queuedFetch } from "@/lib/fetchQueue";

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

interface IndicatorModalProps {
  seriesId: string;
  displayName: string;
  onClose: () => void;
}

type RangeKey = "1Y" | "5Y" | "10Y" | "MAX";

const RANGES: { key: RangeKey; label: string; years: number | null }[] = [
  { key: "1Y", label: "1년", years: 1 },
  { key: "5Y", label: "5년", years: 5 },
  { key: "10Y", label: "10년", years: 10 },
  { key: "MAX", label: "전체", years: null },
];

// 과거 위기 시점 (큰 차트에만 표시)
const CRISIS_EVENTS = [
  { date: "2008-09-15", label: "리먼 파산" },
  { date: "2020-03-11", label: "코로나 팬데믹" },
  { date: "2022-02-24", label: "우크라이나 전쟁" },
  { date: "2023-03-10", label: "SVB 파산" },
];

function getStartDate(years: number | null): string {
  if (years === null) return "";
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split("T")[0];
}

// Y축 숫자 보기 좋게 정리 (긴 소수 찌꺼기 제거, 큰 수는 3M·215K 식으로)
function formatYTick(v: number): string {
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }
  return Number(v.toFixed(2)).toString();
}

// 역사적 백분위 문구 (top = 상위 몇 %인지)
function percentileText(top: number): string {
  if (top <= 1) return "역대 최고 수준 (상위 1% 이내)";
  if (top >= 99) return "역대 최저 수준 (하위 1% 이내)";
  return `상위 ${top}%`;
}

export default function IndicatorModal({
  seriesId,
  displayName,
  onClose,
}: IndicatorModalProps) {
  const [range, setRange] = useState<RangeKey>("10Y");
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 역사적 백분위용 — 전체 기간 데이터 (선택 기간과 무관, 모달 열 때 1번만)
  const [fullValues, setFullValues] = useState<number[] | null>(null);
  const [fullSpan, setFullSpan] = useState<{ first: string; last: string } | null>(
    null
  );

  // ESC 키로 닫기 + 배경 스크롤 막기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // 차트용 데이터 가져오기 (선택 기간에 따라)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const rangeConf = RANGES.find((r) => r.key === range)!;
    const startDate = getStartDate(rangeConf.years);
    const url = `/api/fred?seriesId=${seriesId}${
      startDate ? `&startDate=${startDate}` : ""
    }`;

    queuedFetch(url)
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

  // 역사적 백분위용 전체 데이터 가져오기 (seriesId 바뀔 때만 1번)
  useEffect(() => {
    let cancelled = false;
    setFullValues(null);
    setFullSpan(null);

    const url = `/api/fred?seriesId=${seriesId}`; // startDate 없음 = 전체 기간
    queuedFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const arr = json.observations || [];
        const vals: number[] = arr
          .map((o: { value: string }) => parseFloat(o.value))
          .filter((v: number) => !isNaN(v));
        setFullValues(vals);
        if (arr.length) {
          setFullSpan({
            first: arr[0].date,
            last: arr[arr.length - 1].date,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFullValues([]);
      });

    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const obs = data
    ? data.observations
        .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
        .filter((o) => !isNaN(o.value))
    : [];

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
  const isYoY = indicator?.transform === "yoy";

  // 지표 설명 (정적 텍스트)
  const description = INDICATOR_DESCRIPTIONS[seriesId];

  // 역사적 백분위 계산 (전체 데이터의 가장 최근 값 기준)
  let percentileTop: number | null = null;
  let pctTotal = 0;
  let spanText = "";
  if (fullValues && fullValues.length >= 24) {
    const total = fullValues.length;
    const ref = fullValues[total - 1]; // 가장 최근 값
    const below = fullValues.filter((v) => v < ref).length;
    const rankFromBottom = (below / total) * 100; // 과거의 몇 %가 현재보다 낮은가
    percentileTop = Math.round(100 - rankFromBottom);
    pctTotal = total;
    if (fullSpan) {
      spanText = `${fullSpan.first.slice(0, 4)}년~${fullSpan.last.slice(0, 4)}년`;
    }
  }

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

  // 현재 데이터 범위에 포함되는 위기 시점만 필터
  const firstDate = obs[0]?.date ?? "";
  const lastDate = obs[obs.length - 1]?.date ?? "";
  const visibleCrises = CRISIS_EVENTS.filter(
    (c) => c.date >= firstDate && c.date <= lastDate
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-4 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xl flex items-center justify-center"
          aria-label="닫기"
        >
          ✕
        </button>

        {/* 헤더 */}
        <div className="mb-4 pr-12">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {displayName}
            </h2>
            <span className="text-xs sm:text-sm text-gray-500 font-mono">
              {seriesId}
            </span>
          </div>
          {data && (
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {data.units}
            </p>
          )}
        </div>

        {/* 현재값 */}
        {!loading && !error && data && (
          <div className="flex items-baseline gap-3 mb-2 flex-wrap">
            <span className="text-3xl sm:text-5xl font-bold text-white">
              {latestValue.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              {isYoY ? "%" : ""}
            </span>
            <span
              className={`text-sm sm:text-base font-medium ${
                isUp
                  ? "text-red-400"
                  : isDown
                  ? "text-blue-400"
                  : "text-gray-400"
              }`}
            >
              {isUp ? "▲" : isDown ? "▼" : "—"}{" "}
              {Math.abs(change).toFixed(2)}
              {isYoY ? "%p" : ` (${changePercent.toFixed(2)}%)`}
            </span>
          </div>
        )}

        {/* 역사적 백분위 */}
        {!loading && !error && data && percentileTop !== null && (
          <div className="mb-3 text-xs sm:text-sm">
            <span className="text-gray-400">📊 역사적 위치: </span>
            <span className="text-gray-100 font-semibold">
              {percentileText(percentileTop)}
            </span>
            {spanText && (
              <span className="text-gray-500">
                {" "}
                · {spanText} 데이터 {pctTotal.toLocaleString()}개 기준
              </span>
            )}
          </div>
        )}

        {/* 지표 설명 */}
        {description && (
          <div className="mb-4 rounded-lg bg-gray-800/60 border border-gray-700 p-3 text-xs sm:text-sm text-gray-300 leading-relaxed">
            <span className="text-gray-400 font-medium">ℹ️ 이 지표는? </span>
            {description}
          </div>
        )}

        {/* 차트 */}
        <div className="h-64 sm:h-96 -mx-2 mb-4">
          {loading && (
            <div className="h-full flex items-center justify-center text-gray-500">
              로딩 중...
            </div>
          )}
          {error && (
            <div className="h-full flex items-center justify-center text-red-400">
              로드 실패: {error}
            </div>
          )}
          {!loading && !error && data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={obs}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => v.slice(0, 7)}
                  minTickGap={50}
                />
                <YAxis
                  domain={[minVal - padding, maxVal + padding]}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  width={55}
                  tickFormatter={formatYTick}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  itemStyle={{ color: "#60a5fa" }}
                  formatter={(value) =>
                    typeof value === "number"
                      ? value.toFixed(2)
                      : String(value)
                  }
                />
                {/* 위험 기준선 (가로) */}
                {indicator?.warningThreshold !== undefined && (
                  <ReferenceLine
                    y={indicator.warningThreshold}
                    stroke="#eab308"
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                    label={{
                      value: `경계 ${indicator.warningThreshold}`,
                      position: "right",
                      fill: "#eab308",
                      fontSize: 11,
                    }}
                  />
                )}
                {indicator?.dangerThreshold !== undefined && (
                  <ReferenceLine
                    y={indicator.dangerThreshold}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                    label={{
                      value: `위험 ${indicator.dangerThreshold}`,
                      position: "right",
                      fill: "#ef4444",
                      fontSize: 11,
                    }}
                  />
                )}
                {/* 과거 위기 시점 세로줄 */}
                {visibleCrises.map((crisis) => (
                  <ReferenceLine
                    key={crisis.date}
                    x={crisis.date}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    label={{
                      value: crisis.label,
                      position: "top",
                      fill: "#fca5a5",
                      fontSize: 10,
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 기간 선택 버튼 */}
        <div className="flex gap-2 mb-4">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`text-sm px-3 py-2 rounded transition-colors flex-1 ${
                range === r.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* 위기 시점 범례 */}
        {visibleCrises.length > 0 && (
          <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-red-400">⎯⎯</span> 빨간 점선: 과거 위기 시점
            {visibleCrises.map((c) => (
              <span key={c.date}>
                · {c.label} ({c.date})
              </span>
            ))}
          </div>
        )}

        {/* 푸터 정보 */}
        {!loading && !error && data && (
          <div className="text-xs sm:text-sm text-gray-500 border-t border-gray-800 pt-3">
            <div>최근 발표: {latest?.date}</div>
            <div>출처: FRED · 갱신: {data.lastUpdated.split(" ")[0]}</div>
          </div>
        )}
      </div>
    </div>
  );
}