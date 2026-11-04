import { NextResponse } from "next/server";
import { handleError, requireRole } from "@/lib/api";
import { getBloqueos } from "@/lib/googleSheets";
import { ROLES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireRole([...ROLES]);
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await getBloqueos());
  } catch (e) {
    return handleError(e);
  }
}
