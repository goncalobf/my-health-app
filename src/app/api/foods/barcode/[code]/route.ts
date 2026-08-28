import { NextResponse } from "next/server";
import { lookupBarcode } from "@/lib/openfoodfacts";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const result = await lookupBarcode(code);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}
