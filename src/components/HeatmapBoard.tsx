"use client";

import { useEffect, useState } from "react";
import { CRISIS_INDICATORS, MACRO_INDICATORS } from "@/lib/indicators";
import type { Indicator } from "@/lib/indicators";
import { queuedFetch } from "@/lib/fetchQueue";

type Status = "danger" | "warning" | "normal" | "unknown";

interface TileState {
  status: Status;
  value: number | null;
  change: number;
  loaded: boolean;
}

const ALL_INDICATORS: Indicator[] = [...CRISIS_INDICATORS, ...MACRO_INDICATORS];

// 최근 데이터 시작일 (가벼운 데이터로 최신값/직전값만 빠르게)
function twoYearsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().split("T")[0];
}

// 색(상태) 계산 — invertSignal 규칙 반영
function getStatus(value: number, ind: Indicator): Status {
  const w = ind.warningThreshold;
  const d = ind.dangerThreshold;
  if (w === undefined && d === undefined) return "unknown";
  if (ind.invertSignal) {
    // 낮을수록 위험
    if (d !== undefined && value <= d) return "danger";
    if (w !== undefined && value <= w) return "warning";
    return "normal";
  }
  // 높을수록 위험
  if (d !== undefined && value >= d) return "danger";
  if (w !== undefined && value >= w) return "warning";
  return "normal";
}

const STATUS_STYLE: Record<Status, string> = {
  danger: "bg-red-600/90 border-red-400 text-white",
  warning: "bg-yellow-500/90 border-yellow-300 text-black",
  normal: "bg-emerald-700/80 border-emerald-500 text-white",
  unknown: "bg-gray-800 border-gray-700 text-gray-400",
};

// ── 위기 종합 단계 ───────────────────────────────
type Stage = "stable" | "caution" | "elevated" | "danger";

interface StageInfo {
  emoji: string;
  label: string;
  desc: string;
  box: string;
  labelColor: string;
}

// 위험/경계 개수로 종합 단계 결정 (아래 숫자는 자유롭게 조정 가능)
function getStage(danger: number, warning: number): Stage {
  if (danger >= 3) return "danger";                    // 위험 3개 이상 → 🔴 위험
  if (danger >= 1 || warning >= 4) return "elevated";  // 위험 1~2개 또는 경계 4개 이상 → 🟠 경계
  if (warning >= 1) return "caution";                  // 경계 1~3개 → 🟡 주의
  return "stable";                                     // 그 외 → 🟢 안정
}

const STAGE_INFO: Record<Stage, StageInfo> = {
  stable: {
    emoji: "🟢",
    label: "안정",
    desc: "특이 위험 신호 없음",
    box: "bg-emerald-950/40 border-emerald-700",
    labelColor: "text-emerald-400",
  },
  caution: {
    emoji: "🟡",
    label: "주의",
    desc: "일부 경계 신호 발생",
    box: "bg-yellow-950/40 border-yellow-700",
    labelColor: "text-yellow-400",
  },
  elevated: {
    emoji: "🟠",
    label: "경계",
    desc: "위험 신호 감지 — 주시 필요",
    box: "bg-orange-950/40 border-orange-700",
    labelColor: "text-orange-400",
  },
  danger: {
    emoji: "🔴",
    label: "위험",
    desc: "다수 위험 신호 — 경계 강화",
    box: "bg-red-950/50 border-red-600",
    labelColor: "text-red-400",
  },
};

interface HeatmapBoardProps {
  onSelect: (seriesId: string, displayName: string) => void;
}

export default function HeatmapBoard({ onSelect }: HeatmapBoardProps) {
  const [tiles, setTiles] = useState<Record<string, TileState>>({});

  useEffect(() => {
    let cancelled = false;
    const startDate = twoYearsAgo();

    ALL_INDICATORS.forEach((ind) => {
      const url = `/api/fred?seriesId=${ind.seriesId}&startDate=${startDate}`;
      queuedFetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json) => {
          if (cancelled) return;
          const vals: number[] = (json.observations || [])
            .map((o: { value: string }) => parseFloat(o.value))
            .filter((v: number) => !isNaN(v));
          const value = vals.length ? vals[vals.length - 1] : null;
          const prev = vals.length > 1 ? vals[vals.length - 2] : value;
          setTiles((cur) => ({
            ...cur,
            [ind.seriesId]: {
              status: value !== null ? getStatus(value, ind) : "unknown",
              value,
              change: value !== null && prev !== null ? value - prev : 0,
              loaded: true,
            },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setTiles((cur) => ({
            ...cur,
            [ind.seriesId]: {
              status: "unknown",
              value: null,
              change: 0,
              loaded: true,
            },
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // 종합 카운트
  let danger = 0,
    warning = 0,
    normal = 0;
  Object.values(tiles).forEach((t) => {
    if (t.status === "danger") danger++;
    else if (t.status === "warning") warning++;
    else if (t.status === "normal") normal++;
  });
  const loadedCount = Object.values(tiles).filter((t) => t.loaded).length;
  const allLoaded = loadedCount === ALL_INDICATORS.length;

  // 종합 단계
  const stage = getStage(danger, warning);
  const info = STAGE_INFO[stage];

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xl font-bold text-white">🌡️ 위기 요약 보드</h2>
        <span className="text-xs text-gray-500">한눈에 보는 전체 상태</span>
      </div>

      {/* 종합 단계 헤드라인 */}
      <div
        className={`rounded-xl border ${info.box} p-4 mb-4 flex items-center gap-4`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl sm:text-4xl leading-none">{info.emoji}</span>
          <div className="min-w-0">
            <div className="text-[11px] text-gray-400 leading-tight">
              현재 위기 단계
            </div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold leading-tight ${info.labelColor}`}
            >
              {info.label}
            </div>
            <div className="text-[11px] text-gray-400 leading-tight truncate">
              {info.desc}
            </div>
          </div>
        </div>

        <div className="ml-auto text-right shrink-0">
          <div className="flex items-center justify-end gap-2 sm:gap-3 text-sm font-medium">
            <span className="text-red-400">🔴 {danger}</span>
            <span className="text-yellow-400">🟡 {warning}</span>
            <span className="text-emerald-400">🟢 {normal}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {allLoaded
              ? "35개 지표 기준"
              : `집계 중… ${loadedCount}/${ALL_INDICATORS.length}`}
          </div>
        </div>
      </div>

      {/* 색 타일 격자 */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {ALL_INDICATORS.map((ind) => {
          const t = tiles[ind.seriesId];
          const style = t
            ? STATUS_STYLE[t.status]
            : "bg-gray-900 border-gray-800 text-gray-600 animate-pulse";
          return (
            <button
              key={ind.seriesId}
              onClick={() => onSelect(ind.seriesId, ind.displayName)}
              className={`rounded-md border p-1.5 text-left transition-transform active:scale-95 ${style}`}
            >
              <div className="text-[10px] font-medium leading-tight line-clamp-2 min-h-[26px]">
                {ind.displayName}
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs font-bold">
                  {t && t.value !== null
                    ? t.value.toLocaleString("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 2,
                      })
                    : t?.loaded
                    ? "—"
                    : "···"}
                </span>
                {t && t.value !== null && t.change !== 0 && (
                  <span className="text-[10px] opacity-80">
                    {t.change > 0 ? "▲" : "▼"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-600 mt-2">
        타일을 누르면 큰 차트가 열려요 · 회색 = 기준값 미설정 지표
      </p>
    </section>
  );
}