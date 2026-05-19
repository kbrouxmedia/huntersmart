import { NextRequest, NextResponse } from "next/server";
import { runAgent14 } from "@/lib/agents/agent14";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Se requiere el campo 'query'" }, { status: 400 });
    }

    const leads = await runAgent14(query);
    return NextResponse.json({ success: true, leads, count: leads.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
