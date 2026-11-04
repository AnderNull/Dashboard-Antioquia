import { NextResponse } from "next/server";
import { handleError, requirePermiso } from "@/lib/api";
import { getBloqueos } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requirePermiso();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await getBloqueos());
  } catch (e) {
    return handleError(e);
  }
}
