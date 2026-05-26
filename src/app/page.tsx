"use client";

import { useState } from "react";
import IndicatorCard from "@/components/IndicatorCard";
import IndicatorModal from "@/components/IndicatorModal";
import { CRISIS_INDICATORS, MACRO_INDICATORS } from "@/lib/indicators";

function groupByCategory<T extends { category: string }>(items: T[]) {
  return items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export default function Home() {
  const macroByCategory = groupByCategory(MACRO_INDICATORS);
  const [selected, setSelected] = useState<{
    seriesId: string;
    displayName: string;
  } | null>(null);

  return (
    <main className="min-h-screen bg-black p-3 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">
            US Macro Dashboard
          </h1>
          <p className="text-gray-400 text-sm">
            미국 거시경제 지표 실시간 모니터링 · 데이터 출처: FRED
          </p>
        </header>

        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-2xl font-bold text-red-400">
              🚨 Crisis Watch
            </h2>
            <span className="text-xs text-gray-500">
              위기 감지 지표
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {CRISIS_INDICATORS.map((ind) => (
              <IndicatorCard
                key={ind.seriesId}
                seriesId={ind.seriesId}
                displayName={ind.displayName}
                onClick={() =>
                  setSelected({
                    seriesId: ind.seriesId,
                    displayName: ind.displayName,
                  })
                }
              />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-2xl font-bold text-blue-400">
              📊 Macro Dashboard
            </h2>
            <span className="text-xs text-gray-500">
              주요 거시경제 지표 25개
            </span>
          </div>

          {Object.entries(macroByCategory).map(([category, items]) => (
            <div key={category} className="mb-8">
              <h3 className="text-lg font-semibold text-gray-300 mb-3 border-l-4 border-blue-500 pl-3">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((ind) => (
                  <IndicatorCard
                    key={ind.seriesId}
                    seriesId={ind.seriesId}
                    displayName={ind.displayName}
                    onClick={() =>
                      setSelected({
                        seriesId: ind.seriesId,
                        displayName: ind.displayName,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        {selected && (
          <IndicatorModal
            seriesId={selected.seriesId}
            displayName={selected.displayName}
            onClose={() => setSelected(null)}
          />
        )}

        <footer className="mt-16 pt-8 border-t border-gray-800 text-center text-xs text-gray-600">
          <p>
            Data from FRED · Federal Reserve Bank of St. Louis
          </p>
          <p className="mt-1">Updates automatically every hour</p>
        </footer>
      </div>
    </main>
  );
}