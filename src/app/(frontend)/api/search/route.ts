import { NextResponse, type NextRequest } from "next/server";
import { searchStories } from "@/lib/content";

/**
 * GET /api/search?q=term
 * Frontend search endpoint. Today it queries the mock source; when a CMS or
 * search service is connected, only the data layer changes — the response
 * contract below stays the same for the UI.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  const limit = Math.min(50, Number(request.nextUrl.searchParams.get("limit")) || 20);
  const results = q ? await searchStories(q, limit) : [];
  return NextResponse.json(
    { query: q, total: results.length, results },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
