import { NextRequest, NextResponse } from "next/server";
import { runAgent15 } from "@/lib/agents/agent15";
import { Lead } from "@/types/lead";

export async function POST(req: NextRequest) {
  try {
    const lead: Lead = await req.json();

    if (!lead.id || lead.status !== "READY_FOR_AUDIT") {
      return NextResponse.json(
        { error: "Se requiere un lead válido con status READY_FOR_AUDIT" },
        { status: 400 }
      );
    }

    const audit = await runAgent15(lead);
    return NextResponse.json({ success: true, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
