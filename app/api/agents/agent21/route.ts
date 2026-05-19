import { NextRequest, NextResponse } from "next/server";
import { runAgent21 } from "@/lib/agents/agent21";
import { Lead, Audit } from "@/types/lead";
import { Agency } from "@/types/agency";

export async function POST(req: NextRequest) {
  try {
    const { lead, audit, agency }: { lead: Lead; audit: Audit; agency: Agency } = await req.json();

    if (!lead.id || lead.status !== "READY_FOR_CLOSING") {
      return NextResponse.json(
        { error: "Se requiere un lead válido con status READY_FOR_CLOSING" },
        { status: 400 }
      );
    }

    if (!agency.id) {
      return NextResponse.json({ error: "Se requiere una agencia con ID" }, { status: 400 });
    }

    const outreach = await runAgent21(lead, audit, agency);
    return NextResponse.json({ success: true, outreach });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
