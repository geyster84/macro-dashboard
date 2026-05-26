import { NextRequest, NextResponse } from "next/server";

// 메모리 캐시 (1시간 유효)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1시간

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";
  const display = searchParams.get("display") ?? "5";

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  // 캐시 확인
  const cacheKey = `${query}-${display}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "NAVER API keys not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
      query
    )}&display=${display}&sort=date`;

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `NAVER API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // HTML 태그 제거 + 24시간 이내 필터
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const items = (data.items || [])
      .map((item: { title: string; description: string; pubDate: string; link: string; originallink: string }) => ({
        title: item.title.replace(/<\/?b>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'"),
        description: item.description.replace(/<\/?b>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'"),
        pubDate: item.pubDate,
        link: item.link,
        originalLink: item.originallink,
        pubTimestamp: new Date(item.pubDate).getTime(),
      }))
      .filter((item: { pubTimestamp: number }) => item.pubTimestamp >= oneDayAgo);

    const result = { items, query, count: items.length };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}