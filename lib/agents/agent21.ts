import { db } from "@/lib/firebase";
import { runAgent } from "@/lib/claude";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { Lead, Audit } from "@/types/lead";
import { Agency } from "@/types/agency";
import { Outreach, OutreachMessage } from "@/types/outreach";

const SYSTEM_PROMPT = `Eres un especialista en copywriting de conversión B2B y presentación de ROI.

Recibirás el JSON de un lead con su auditoría y una agencia objetivo.
Tu tarea es crear una secuencia de 3 mensajes de outreach personalizados.

SECUENCIA:

MENSAJE 1 (Día 1):
- Gancho: dato específico de la agencia
- Propuesta: lead con diagnóstico listo para cerrar
- Prueba: 2-3 deficiencias críticas con impacto económico
- CTA: 15 minutos para presentar el caso

MENSAJE 2 (Día 3, sin respuesta):
- Recordatorio suave del valor
- Dato nuevo de urgencia
- CTA: misma reunión de 15 minutos

MENSAJE 3 (Día 7, sin respuesta):
- Tono directo y escaso
- Lead ofrecido a otra agencia en 48h
- CTA: Sí/No

TONO POR TIER:
- TIER1: igual a igual, directo
- TIER2: consultivo, más explicativo
- TIER3: educativo, más contexto

CUMPLIMIENTO ANTI-SPAM:
- Incluir opción de opt-out en cada mensaje
- Máx 1 mensaje cada 48h
- Lenguaje profesional y respetuoso

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown.
Estructura exacta:
{
  "lead_id": string,
  "agency_id": string,
  "messages": [
    { "day": 1, "content": string },
    { "day": 3, "content": string },
    { "day": 7, "content": string }
  ],
  "status": "SCHEDULED"
}`;

export async function runAgent21(lead: Lead, audit: Audit, agency: Agency): Promise<Outreach> {
  if (lead.status !== "READY_FOR_CLOSING") {
    throw new Error(`Agent21: lead ${lead.id} no tiene status READY_FOR_CLOSING`);
  }

  const input = JSON.stringify({ lead, audit, agency });
  const raw = await runAgent(SYSTEM_PROMPT, input);

  let parsed: { lead_id: string; agency_id: string; messages: OutreachMessage[]; status: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Agent21: respuesta no es JSON válido. Raw: ${raw.slice(0, 200)}`);
  }

  const outreach: Outreach = {
    lead_id: lead.id!,
    agency_id: agency.id!,
    messages: parsed.messages,
    status: "SCHEDULED",
    created_at: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, "outreach"), outreach);

  await updateDoc(doc(db, "leads", lead.id!), {
    status: "OUTREACH_ACTIVE",
    updated_at: new Date().toISOString(),
  });

  return { ...outreach, id: ref.id };
}
