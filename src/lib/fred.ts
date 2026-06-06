// FRED API 호출 함수 (재시도 + 타임아웃 + 메모리 캐시)
const FRED_API_KEY = process.env.FRED_API_KEY;
const BASE_URL = "https://api.stlouisfed.org/fred";

export interface FredObservation {
  date: string;
  value: string;
}

export interface FredSeriesData {
  seriesId: string;
  title: string;
  units: string;
  lastUpdated: string;
  observations: FredObservation[];
}

// 간단한 메모리 캐시 (서버 사이드)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1시간

async function fetchWithRetry(
  url: string,
  cacheKey: string,
  retries = 3
): Promise<unknown> {
  // 캐시 확인
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }

      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function fetchSeriesInfo(seriesId: string) {
  const url = `${BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;
  const data = (await fetchWithRetry(url, `info:${seriesId}`)) as {
    seriess?: Array<{ title: string; units: string; last_updated: string }>;
  };
  return data.seriess?.[0];
}

export async function fetchSeriesObservations(
  seriesId: string,
  limit: number = 24
): Promise<FredObservation[]> {
  const url = `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const data = (await fetchWithRetry(url, `obs:${seriesId}:${limit}`)) as {
    observations: FredObservation[];
  };
  return data.observations;
}

export async function fetchSeriesData(
  seriesId: string
): Promise<FredSeriesData> {
  const [info, observations] = await Promise.all([
    fetchSeriesInfo(seriesId),
    fetchSeriesObservations(seriesId),
  ]);

  return {
    seriesId,
    title: info?.title ?? seriesId,
    units: info?.units ?? "",
    lastUpdated: info?.last_updated ?? "",
    observations: observations.reverse(),
  };
}