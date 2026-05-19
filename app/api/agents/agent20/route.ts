import { NextRequest, NextResponse } from "next/server";
import { runAgent20 } from "@/lib/agents/agent20";
import { Lead, Audit } from "@/types/lead";

export async function POST(req: NextRequest) {
  try {
    const { lead, audit }: { lead: Lead; audit: Audit } = await req.json();

    if (!lead.id || lead.status !== "READY_FOR_OUTREACH") {
      return NextResponse.json(
        { error: "Se requiere un lead válido con status READY_FOR_OUTREACH" },
        { status: 400 }
      );
    }

    const agencies = await runAgent20(lead, audit);
    return NextResponse.json({ success: true, agencies, count: agencies.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
