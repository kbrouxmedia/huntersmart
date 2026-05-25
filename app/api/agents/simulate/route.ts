import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { runAgent17 } from "@/lib/agents/agent17";
import { runAgent18 } from "@/lib/agents/agent18";
import { Lead } from "@/types/lead";
import { Agency } from "@/types/agency";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { leadId, type, customText }: { leadId: string; type: "MEETING" | "REJECTION"; customText?: string } =
      await req.json();

    if (!leadId || !type) {
      return NextResponse.json(
        { error: "Se requieren leadId y type ('MEETING' o 'REJECTION')" },
        { status: 400 }
      );
    }

    // 1. Get Lead
    const leadSnap = await getDoc(doc(db, "leads", leadId));
    if (!leadSnap.exists()) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }
    const lead = { id: leadSnap.id, ...leadSnap.data() } as Lead;

    // 2. Get matched agencies
    const q = query(collection(db, "agencies"), where("lead_id", "==", leadId));
    const agenciesSnap = await getDocs(q);
    const agencies = agenciesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Agency));

    if (agencies.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron agencias prospectadas para este lead. Por favor, corre primero el pipeline." },
        { status: 400 }
      );
    }

    // Pick TIER1 or first agency
    const agency = agencies.find((a) => a.tier === "TIER1") ?? agencies[0];

    if (type === "MEETING") {
      const responseText =
        customText ||
        `Hola, me parece interesante el diagnóstico de deficiencias de ${lead.company_name}. Hablemos mañana por Zoom a las 11:00 AM.`;

      // Run Agent 17 (Calendar)
      const meeting = await runAgent17(lead, agency, responseText);
      return NextResponse.json({
        success: true,
        message: "Reunión agendada con éxito por simulación del Agente 17",
        meeting,
      });
    } else if (type === "REJECTION") {
      const objectionText =
        customText ||
        "El costo del plan de modernización es muy elevado para nuestro presupuesto trimestral actual.";

      // Count existing rejections to determine pivot_count
      const rejectionsQuery = query(
        collection(db, "rejections"),
        where("lead_id", "==", leadId),
        where("agency_id", "==", agency.id!)
      );
      const rejectionsSnap = await getDocs(rejectionsQuery);
      const pivotCount = rejectionsSnap.size;

      // Run Agent 18 (Pivot/Objection handler)
      const rejection = await runAgent18(lead, agency, objectionText, pivotCount);
      return NextResponse.json({
        success: true,
        message: `Objeción procesada por simulación del Agente 18. Pivot count: ${pivotCount}`,
        rejection,
      });
    } else {
      return NextResponse.json({ error: "Tipo de simulación no válido" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
