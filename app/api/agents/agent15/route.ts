import { NextRequest } from "next/server";
import { runAgent15 } from "@/lib/agents/agent15";
import { runAgent20 } from "@/lib/agents/agent20";
import { runAgent21 } from "@/lib/agents/agent21";
import { Lead } from "@/types/lead";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const lead: Lead = await req.json();

        if (!lead.id || lead.status !== "READY_FOR_AUDIT") {
          send({ success: false, error: "Lead inválido o sin status READY_FOR_AUDIT" });
          controller.close();
          return;
        }

        // Agente 15 — Auditoría
        send({ step: "audit", message: `Auditando ${lead.company_name}…` });
        const audit = await runAgent15(lead);
        send({ step: "audit_done", audit });

        // Agente 20 — Prospección de agencias
        send({ step: "prospect", message: "Buscando agencias compatibles…" });
        const updatedLeadSnap = await getDoc(doc(db, "leads", lead.id));
        const updatedLead = { id: updatedLeadSnap.id, ...updatedLeadSnap.data() } as Lead;
        const agencies = await runAgent20(updatedLead, audit);
        send({ step: "prospect_done", agencies, count: agencies.length });

        // Agente 21 — Outreach para la mejor agencia (TIER1 o primera disponible)
        if (agencies.length > 0) {
          const bestAgency = agencies.find((a) => a.tier === "TIER1") ?? agencies[0];
          send({ step: "outreach", message: `Generando outreach para ${bestAgency.agency_name}…` });
          const closingLeadSnap = await getDoc(doc(db, "leads", lead.id));
          const closingLead = { id: closingLeadSnap.id, ...closingLeadSnap.data() } as Lead;
          const outreach = await runAgent21(closingLead, audit, bestAgency);
          send({ step: "outreach_done", outreach });
        }

        send({ success: true, message: "Pipeline completado" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        send({ success: false, error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
