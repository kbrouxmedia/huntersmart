import { NextRequest, NextResponse } from "next/server";
import { runAgent17 } from "@/lib/agents/agent17";
import { Lead } from "@/types/lead";
import { Agency } from "@/types/agency";

export async function POST(req: NextRequest) {
  try {
    const { lead, agency, agency_response }: { lead: Lead; agency: Agency; agency_response: string } =
      await req.json();

    if (!lead.id || !agency.id || !agency_response) {
      return NextResponse.json(
        { error: "Se requieren lead, agency y agency_response" },
        { status: 400 }
      );
    }

    const meeting = await runAgent17(lead, agency, agency_response);
    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
