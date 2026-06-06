"use client";

import { useEffect, useMemo, useState } from "react";
import { queuedFetch } from "@/lib/fetchQueue";

interface CalendarEntry {
  date: string; // YYYY-MM-DD
  name: string;
  importance: number; // 1~3
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const IMPORTANCE_STARS: Record<number, string> = {
  3: "⭐⭐⭐",
  2: "⭐⭐",
  1: "⭐",
};

function impChipClass(importance: number): string {
  if (importance === 3)
    return "bg-red-500/20 text-red-300 border border-red-500/40";
  if (importance === 2)
    return "bg-yellow-500/20 text-yellow-200 border border-yellow-500/40";
  return "bg-gray-600/30 text-gray-300 border border-gray-600/50";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export default function CalendarBoard() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = 이번 달, 1 = 다음 달

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const now = new Date();
    const startStr = ymd(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const endStr = ymd(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );

    queuedFetch(`/api/calendar?start=${startStr}&end=${endStr}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setEntries(json.entries || []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const byDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    entries.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => b.importance - a.importance)
    );
    return map;
  }, [entries]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xl font-bold text-white">📅 매크로 발표 일정</h2>
        <span className="text-xs text-gray-500">주요 미국 경제지표 발표일</span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-semibold text-gray-200">
          {year}년 {month + 1}월
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setMonthOffset(0)}
            className={`text-xs px-3 py-1.5 rounded ${
              monthOffset === 0
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            이번 달
          </button>
          <button
            onClick={() => setMonthOffset(1)}
            className={`text-xs px-3 py-1.5 rounded ${
              monthOffset === 1
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            다음 달
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 mb-2">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/40 border border-red-500/60" />{" "}
          매우 중요 (⭐⭐⭐)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/40 border border-yellow-500/60" />{" "}
          중요 (⭐⭐)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-500/40 border border-gray-500/60" />{" "}
          참고 (⭐)
        </span>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
          발표 일정 불러오는 중...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`text-center text-[11px] py-1 ${
                  i === 0
                    ? "text-red-400"
                    : i === 6
                    ? "text-blue-400"
                    : "text-gray-500"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (d === null) return <div key={`empty-${idx}`} />;
              const dateStr = ymd(year, month, d);
              const dayEntries = byDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={dateStr}
                  className={`rounded-md border p-1 min-h-[72px] sm:min-h-[104px] flex flex-col gap-1 ${
                    isToday
                      ? "border-blue-500/70 bg-gray-800"
                      : dayEntries.length
                      ? "border-gray-700 bg-gray-800/50"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <span
                    className={`text-[11px] ${
                      isToday
                        ? "text-blue-300 font-bold"
                        : dayEntries.length
                        ? "text-gray-200"
                        : "text-gray-600"
                    }`}
                  >
                    {d}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {dayEntries.map((e, i) => (
                      <div
                        key={i}
                        title={`${e.name} · 중요도 ${IMPORTANCE_STARS[e.importance]}`}
                        className={`rounded px-1 py-0.5 text-[9px] sm:text-[11px] leading-tight flex items-center gap-1 ${impChipClass(
                          e.importance
                        )}`}
                      >
                        <span className="truncate">{e.name}</span>
                        <span className="hidden sm:inline shrink-0 text-[9px] opacity-80">
                          {IMPORTANCE_STARS[e.importance]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}