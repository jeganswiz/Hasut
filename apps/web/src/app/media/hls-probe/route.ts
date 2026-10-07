import { NextResponse } from "next/server";
import { readHlsProbe } from "../../../lib/hls-probe";

export async function GET(request: Request): Promise<NextResponse> {
  const src = new URL(request.url).searchParams.get("src") ?? "";
  const result = await readHlsProbe(src, process.env.LIVE_HLS_BASE_URL ?? "");
  return NextResponse.json(
    { ready: result.ready },
    { status: result.status, headers: { "cache-control": "no-store" } },
  );
}
