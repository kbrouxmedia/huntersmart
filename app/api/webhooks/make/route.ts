import { NextRequest, NextResponse } from "next/server";
import { runAgent14 } from "@/lib/agents/agent14";
import { runAgent15 } from "@/lib/agents/agent15";
import { runAgent20 } from "@/lib/agents/agent20";
import { runAgent21 } from "@/lib/agents/agent21";
import { runAgent17 } from "@/lib/agents/agent17";
import { runAgent18 } from "@/lib/agents/agent18";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Lead, Audit } from "@/types/lead";
import { Agency } from "@/types/agency";

// Verify Make webhook secret
function verifySecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-make-secret");
  return secret === process.env.MAKE_WEBHOOK_SECRET;
}

type MakeAction =
  | "SCOUT"
  | "AUDIT"
  | "PROSPECT"
  | "OUTREACH"
  | "SCHEDULE_MEETING"
  | "HANDLE_REJECTION";

interface MakePayload {
  action: MakeAction;
  query?: string;
  lead_id?: string;
  agency_id?: string;
  agency_response?: string;
  rejection_reason?: string;
  pivot_count?: number;
}

async function getLead(lead_id: string): Promise<Lead> {
  const snap = await getDoc(doc(db, "leads", lead_id));
  if (!snap.exists()) throw new Error(`Lead ${lead_id} no encontrado`);
  return { id: snap.id, ...snap.data() } as Lead;
}

async function getAudit(lead_id: string): Promise<Audit> {
  const snap = await getDoc(doc(db, "audits", lead_id));
  if (!snap.exists()) throw new Error(`Auditoría para lead ${lead_id} no encontrada`);
  return snap.data() as Audit;
}

async function getAgency(agency_id: string): Promise<Agency> {
  const snap = await getDoc(doc(db, "agencies", agency_id));
  if (!snap.exists()) throw new Error(`Agencia ${agency_id} no encontrada`);
  return { id: snap.id, ...snap.data() } as Agency;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let payload: MakePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const { action } = payload;

  try {
    switch (action) {
      // Agente 14 — Scout: busca nuevas empresas
      case "SCOUT": {
        if (!payload.query) {
          return NextResponse.json({ error: "Campo 'query' requerido para SCOUT" }, { status: 400 });
        }
        const leads = await runAgent14(payload.query);
        return NextResponse.json({ success: true, action, leads, count: leads.length });
      }

      // Agente 15 — Auditor: audita un lead existente
      case "AUDIT": {
        if (!payload.lead_id) {
          return NextResponse.json({ error: "Campo 'lead_id' requerido para AUDIT" }, { status: 400 });
        }
        const lead = await getLead(payload.lead_id);
        const audit = await runAgent15(lead);
        return NextResponse.json({ success: true, action, audit });
      }

      // Agente 20 — Prospector: busca agencias para un lead auditado
      case "PROSPECT": {
        if (!payload.lead_id) {
          return NextResponse.json({ error: "Campo 'lead_id' requerido para PROSPECT" }, { status: 400 });
        }
        const lead = await getLead(payload.lead_id);
        const audit = await getAudit(payload.lead_id);
        const agencies = await runAgent20(lead, audit);
        return NextResponse.json({ success: true, action, agencies, count: agencies.length });
      }

      // Agente 21 — Closer: genera mensajes de outreach para lead + agencia
      case "OUTREACH": {
        if (!payload.lead_id || !payload.agency_id) {
          return NextResponse.json(
            { error: "Campos 'lead_id' y 'agency_id' requeridos para OUTREACH" },
            { status: 400 }
          );
        }
        const lead = await getLead(payload.lead_id);
        const audit = await getAudit(payload.lead_id);
        const agency = await getAgency(payload.agency_id);
        const outreach = await runAgent21(lead, audit, agency);
        return NextResponse.json({ success: true, action, outreach });
      }

      // Agente 17 — Calendar: agenda reunión tras respuesta positiva
      case "SCHEDULE_MEETING": {
        if (!payload.lead_id || !payload.agency_id || !payload.agency_response) {
          return NextResponse.json(
            { error: "Campos 'lead_id', 'agency_id' y 'agency_response' requeridos" },
            { status: 400 }
          );
        }
        const lead = await getLead(payload.lead_id);
        const agency = await getAgency(payload.agency_id);
        const meeting = await runAgent17(lead, agency, payload.agency_response);
        return NextResponse.json({ success: true, action, meeting });
      }

      // Agente 18 — Pivot: maneja rechazos y silencio
      case "HANDLE_REJECTION": {
        if (!payload.lead_id || !payload.agency_id || !payload.rejection_reason) {
          return NextResponse.json(
            { error: "Campos 'lead_id', 'agency_id' y 'rejection_reason' requeridos" },
            { status: 400 }
          );
        }
        const lead = await getLead(payload.lead_id);
        const agency = await getAgency(payload.agency_id);
        const rejection = await runAgent18(
          lead,
          agency,
          payload.rejection_reason,
          payload.pivot_count ?? 0
        );
        return NextResponse.json({ success: true, action, rejection });
      }

      default:
        return NextResponse.json(
          { error: `Acción desconocida: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
