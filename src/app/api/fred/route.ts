import { NextRequest, NextResponse } from "next/server";

const FRED_API_KEY = process.env.NEXT_PUBLIC_FRED_API_KEY;
const BASE_URL = "https://api.stlouisfed.org/fred";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get("seriesId");
  // startDate가 없으면 1900-01-01부터 (= FRED 전체 데이터)
  const startDate = searchParams.get("startDate") ?? "1900-01-01";
  const endDate = searchParams.get("endDate") ?? "";

  if (!seriesId) {
    return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  }

  try {
    const infoUrl = `${BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;

    let obsUrl = `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=asc&observation_start=${startDate}`;
    if (endDate) obsUrl += `&observation_end=${endDate}`;

    const [infoRes, obsRes] = await Promise.all([
      fetch(infoUrl, { next: { revalidate: 3600 } }),
      fetch(obsUrl, { next: { revalidate: 3600 } }),
    ]);

    if (!infoRes.ok || !obsRes.ok) {
      return NextResponse.json(
        { error: `FRED error: ${infoRes.status}/${obsRes.status}` },
        { status: 502 }
      );
    }

    const infoData = await infoRes.json();
    const obsData = await obsRes.json();

    const info = infoData.seriess?.[0];
    const observations = (obsData.observations || []).filter(
      (o: { value: string }) => o.value !== "."
    );

    return NextResponse.json({
      seriesId,
      title: info?.title ?? seriesId,
      units: info?.units ?? "",
      lastUpdated: info?.last_updated ?? "",
      observations,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}