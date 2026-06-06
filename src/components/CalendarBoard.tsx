"use client";

import { useEffect, useMemo, useState } from "react";
import { queuedFetch } from "@/lib/fetchQueue";

interface CalendarEntry {
  date: string; // YYYY-MM-DD
  name: string;
  importance: number; // 1~3
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const IMPORTANCE_DOT: Record<number, string> = {
  3: "bg-red-500",
  2: "bg-yellow-400",
  1: "bg-gray-400",
};

const IMPORTANCE_STARS: Record<number, string> = {
  3: "⭐⭐⭐",
  2: "⭐⭐",
  1: "⭐",
};

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
  const [selected, setSelected] = useState<string | null>(null);

  // 이번 달 1일 ~ 다음 달 말일 데이터 한 번에 받기
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

  // 표시 중인 달
  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-based

  // 날짜별 발표 묶음
  const byDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    entries.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [entries]);

  // 그리드 셀 (앞 빈칸 + 날짜)
  const firstDow = new Date(year, month, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedEntries = selected ? byDate[selected] || [] : [];

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xl font-bold text-white">📅 매크로 발표 일정</h2>
        <span className="text-xs text-gray-500">주요 미국 경제지표 발표일</span>
      </div>

      {/* 월 전환 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-semibold text-gray-200">
          {year}년 {month + 1}월
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setMonthOffset(0);
              setSelected(null);
            }}
            className={`text-xs px-3 py-1.5 rounded ${
              monthOffset === 0
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            이번 달
          </button>
          <button
            onClick={() => {
              setMonthOffset(1);
              setSelected(null);
            }}
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

      {loading ? (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
          발표 일정 불러오는 중...
        </div>
      ) : (
        <>
          {/* 요일 헤더 */}
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

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (d === null) return <div key={`empty-${idx}`} />;
              const dateStr = ymd(year, month, d);
              const dayEntries = byDate[dateStr] || [];
              const maxImp = dayEntries.reduce(
                (m, e) => Math.max(m, e.importance),
                0
              );
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selected;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelected(isSelected ? null : dateStr)}
                  className={`aspect-square rounded-md border p-1 flex flex-col items-center justify-start text-[11px] transition-colors ${
                    isSelected
                      ? "border-blue-400 bg-gray-700"
                      : isToday
                      ? "border-blue-500/60 bg-gray-800"
                      : dayEntries.length
                      ? "border-gray-700 bg-gray-800/60 hover:bg-gray-700"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <span
                    className={
                      isToday
                        ? "text-blue-300 font-bold"
                        : dayEntries.length
                        ? "text-gray-200"
                        : "text-gray-600"
                    }
                  >
                    {d}
                  </span>
                  {dayEntries.length > 0 && (
                    <span
                      className={`mt-1 w-2 h-2 rounded-full ${
                        IMPORTANCE_DOT[maxImp] || "bg-gray-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 선택한 날짜 발표 목록 */}
          {selected && (
            <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/60 p-3">
              <div className="text-sm font-semibold text-gray-200 mb-2">
                {Number(selected.slice(5, 7))}월 {Number(selected.slice(8, 10))}일
                발표
              </div>
              {selectedEntries.length ? (
                <ul className="space-y-1">
                  {[...selectedEntries]
                    .sort((a, b) => b.importance - a.importance)
                    .map((e, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-gray-300"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            IMPORTANCE_DOT[e.importance]
                          }`}
                        />
                        <span>{e.name}</span>
                        <span className="text-[10px] ml-auto">
                          {IMPORTANCE_STARS[e.importance]}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">
                  예정된 주요 발표 없음
                </div>
              )}
            </div>
          )}

          {/* 범례 */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> 매우 중요
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400" /> 중요
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" /> 참고
            </span>
            <span className="ml-auto">날짜를 누르면 그날 발표가 표시돼요</span>
          </div>
        </>
      )}
    </section>
  );
}