import { db } from "@/lib/firebase";
import { runAgent } from "@/lib/claude";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { Lead } from "@/types/lead";
import { Agency } from "@/types/agency";
import { Meeting } from "@/types/meeting";

const SYSTEM_PROMPT = `Eres un coordinador de agenda y logística comercial B2B.

Recibirás el JSON de un lead y una agencia que respondió positivamente al outreach.
Tu tarea es planificar los detalles de la reunión.

FLUJO:

1. INTERPRETACIÓN:
   - Extrae disponibilidad horaria mencionada (si existe)
   - Detecta zona horaria
   - Canal preferido (Zoom, Meet, Teams)
   - Urgencia percibida

2. PROPUESTA DE REUNIÓN:
   - Priorizar slots 9-11am y 2-4pm hora local
   - Evitar Lunes antes 10am y Viernes después 3pm
   - Duración: 15 minutos
   - Si no hay preferencia, proponer próximas 48h hábiles

3. ESTRUCTURA DE LA REUNIÓN (en la invitación):
   - 0-2 min: Presentación y contexto
   - 2-8 min: Lead y diagnóstico técnico
   - 8-12 min: Propuesta comercial y ROI
   - 12-15 min: Cierre y próximos pasos

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown.
Estructura exacta:
{
  "lead_id": string,
  "agency_id": string,
  "scheduled_date": string (YYYY-MM-DD),
  "scheduled_time": string (HH:MM),
  "timezone": string,
  "duration_minutes": 15,
  "channel": "Zoom" | "Meet" | "Teams",
  "meeting_url": string,
  "status": "PENDING"
}`;

export async function runAgent17(
  lead: Lead,
  agency: Agency,
  agencyResponse: string
): Promise<Meeting> {
  const input = JSON.stringify({ lead, agency, agency_response: agencyResponse });
  const raw = await runAgent(SYSTEM_PROMPT, input);

  let parsed: Meeting;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Agent17: respuesta no es JSON válido. Raw: ${raw.slice(0, 200)}`);
  }

  const meeting: Meeting = {
    lead_id: lead.id!,
    agency_id: agency.id!,
    scheduled_date: parsed.scheduled_date,
    scheduled_time: parsed.scheduled_time,
    timezone: parsed.timezone,
    duration_minutes: 15,
    channel: parsed.channel,
    meeting_url: parsed.meeting_url || "",
    status: "PENDING",
  };

  const ref = await addDoc(collection(db, "meetings"), meeting);

  await updateDoc(doc(db, "leads", lead.id!), {
    status: "MEETING_SCHEDULED",
    updated_at: new Date().toISOString(),
  });

  return { ...meeting, id: ref.id };
}
