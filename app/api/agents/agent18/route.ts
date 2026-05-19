import { NextRequest, NextResponse } from "next/server";
import { runAgent18 } from "@/lib/agents/agent18";
import { Lead } from "@/types/lead";
import { Agency } from "@/types/agency";

export async function POST(req: NextRequest) {
  try {
    const {
      lead,
      agency,
      rejection_reason,
      pivot_count,
    }: { lead: Lead; agency: Agency; rejection_reason: string; pivot_count?: number } =
      await req.json();

    if (!lead.id || !agency.id || !rejection_reason) {
      return NextResponse.json(
        { error: "Se requieren lead, agency y rejection_reason" },
        { status: 400 }
      );
    }

    const rejection = await runAgent18(lead, agency, rejection_reason, pivot_count ?? 0);
    return NextResponse.json({ success: true, rejection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
