"use client";

import { useEffect, useState } from "react";
import { Indicator, CRISIS_INDICATORS, MACRO_INDICATORS } from "@/lib/indicators";
import { isRecentlyReleased, getSearchKeywords, calculateChange } from "@/lib/todayIndicators";
import IndicatorModal from "./IndicatorModal";

type NewsItem = {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  originalLink: string;
};

type FredObservation = {
  date: string;
  value: string;
};

type FredApiResponse = {
  seriesId: string;
  title: string;
  units: string;
  lastUpdated: string;
  observations: FredObservation[];
};

type TodayIndicatorData = {
  indicator: Indicator;
  units: string;
  latestValue: number;
  previousValue: number;
  changePercent: number;
  releaseDate: string;
  observationDate: string;
  relatedNews: NewsItem[];
};

const ALL_INDICATORS = [...CRISIS_INDICATORS, ...MACRO_INDICATORS];

function getTodayKorean(): string {
  const now = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = days[now.getDay()];
  return `${year}년 ${month}월 ${date}일 (${day})`;
}

function formatValue(value: number, units: string): string {
  const isPercent = units.toLowerCase().includes("percent") || units === "%";
  if (isPercent) {
    return `${value.toFixed(2)}%`;
  }
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  }
  return value.toFixed(2);
}

function getChangeDisplay(
  changePercent: number,
  invertSignal?: boolean
): { symbol: string; color: string } {
  if (Math.abs(changePercent) < 0.01) {
    return { symbol: "━", color: "#94a3b8" };
  }
  const isRising = changePercent > 0;
  const isBad = invertSignal ? !isRising : isRising;
  return {
    symbol: isRising ? "▲" : "▼",
    color: isBad ? "#ef4444" : "#3b82f6",
  };
}

export default function TodayInsights() {
  const [todayData, setTodayData] = useState<TodayIndicatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);

  useEffect(() => {
    async function loadTodayData() {
      try {
        const results = await Promise.all(
          ALL_INDICATORS.map(async (indicator) => {
            try {
              const response = await fetch(`/api/fred?seriesId=${indicator.seriesId}`);
              if (!response.ok) return null;
              const data: FredApiResponse = await response.json();
              return { indicator, data };
            } catch {
              return null;
            }
          })
        );

        const recent: TodayIndicatorData[] = [];
        for (const result of results) {
          if (!result || !result.data) continue;
          const { indicator, data } = result;
          if (!isRecentlyReleased(data.lastUpdated, 2)) continue;
          const observations = (data.observations || []).filter((o) => o.value !== ".");
          if (observations.length < 2) continue;
          const latest = observations[observations.length - 1];
          const previous = observations[observations.length - 2];
          const latestValue = Number(latest.value);
          const previousValue = Number(previous.value);
          if (isNaN(latestValue) || isNaN(previousValue)) continue;
          recent.push({
            indicator,
            units: data.units || "",
            latestValue,
            previousValue,
            changePercent: calculateChange(latestValue, previousValue),
            releaseDate: data.lastUpdated,
            observationDate: latest.date,
            relatedNews: [],
          });
        }

        if (recent.length === 0) {
          for (const result of results) {
            if (!result || !result.data) continue;
            const { indicator, data } = result;
            const observations = (data.observations || []).filter((o) => o.value !== ".");
            if (observations.length < 2) continue;
            const latest = observations[observations.length - 1];
            const previous = observations[observations.length - 2];
            const latestValue = Number(latest.value);
            const previousValue = Number(previous.value);
            if (isNaN(latestValue) || isNaN(previousValue)) continue;
            recent.push({
              indicator,
              units: data.units || "",
              latestValue,
              previousValue,
              changePercent: calculateChange(latestValue, previousValue),
              releaseDate: data.lastUpdated,
              observationDate: latest.date,
              relatedNews: [],
            });
            if (recent.length >= 5) break;
          }
        }

        recent.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
        const top = recent.slice(0, 5);

        const withNews = await Promise.all(
          top.map(async (item) => {
            const keywords = getSearchKeywords(item.indicator.seriesId);
            if (keywords.length === 0) return item;
            try {
              const response = await fetch(`/api/news?query=${encodeURIComponent(keywords[0])}&display=3`);
              if (!response.ok) return item;
              const newsData = await response.json();
              return { ...item, relatedNews: newsData.items || [] };
            } catch {
              return item;
            }
          })
        );

        setTodayData(withNews);
      } catch (error) {
        console.error("Failed to load today data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTodayData();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-6 mb-6">
        <p className="text-slate-400 text-sm">오늘의 인사이트 로딩 중...</p>
      </div>
    );
  }

  if (todayData.length === 0) {
    return null;
  }

  return (
    <>
      <section className="mb-8 space-y-4">
        <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-lg">📅</span>
            <h2 className="text-sm sm:text-base font-semibold text-slate-200">오늘 발표된 주요 지표</h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{getTodayKorean()}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayData.map((item) => {
              const change = getChangeDisplay(item.changePercent, item.indicator.invertSignal);
              return (
                <button
                  key={item.indicator.seriesId}
                  onClick={() => setSelectedIndicator(item.indicator)}
                  className="text-left bg-slate-800/50 hover:bg-slate-800 transition rounded p-3 border border-slate-700/50"
                >
                  <div className="text-xs text-slate-400">{item.indicator.displayName}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-base font-bold text-slate-100">{formatValue(item.latestValue, item.units)}</span>
                    <span style={{ color: change.color }} className="text-xs">
                      {change.symbol} {Math.abs(item.changePercent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">관측: {item.observationDate}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-lg">📰</span>
            <h2 className="text-sm sm:text-base font-semibold text-slate-200">오늘의 관련 뉴스</h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">한국 언론 · 24시간 이내</span>
          </div>
          {todayData.every((d) => d.relatedNews.length === 0) ? (
            <p className="text-sm text-slate-400 py-4 text-center">관련 뉴스를 불러올 수 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {todayData.map((item) =>
                item.relatedNews.slice(0, 2).map((news, idx) => (
                  <div key={`${item.indicator.seriesId}-${idx}`} className="border-t border-slate-700/50 pt-3 first:border-t-0 first:pt-0">
                    <a href={news.link} target="_blank" rel="noopener noreferrer" className="block group">
                      <h3 className="text-sm sm:text-base font-medium text-slate-100 group-hover:text-blue-400 transition leading-snug">{news.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{news.description}</p>
                      <div className="text-[10px] text-slate-500 mt-1.5">{new Date(news.pubDate).toLocaleDateString("ko-KR")} · 원문 보기 ↗</div>
                    </a>
                    <button onClick={() => setSelectedIndicator(item.indicator)} className="mt-2 inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition">
                      📈 관련 차트: {item.indicator.displayName}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {selectedIndicator && (
        <IndicatorModal
          seriesId={selectedIndicator.seriesId}
          displayName={selectedIndicator.displayName}
          onClose={() => setSelectedIndicator(null)}
        />
      )}
    </>
  );
}