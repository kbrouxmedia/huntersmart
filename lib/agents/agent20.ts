import { db } from "@/lib/firebase";
import { runAgent } from "@/lib/claude";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { Lead, Audit } from "@/types/lead";
import { Agency } from "@/types/agency";

const SYSTEM_PROMPT = `Eres un especialista en mapeo de canales y alianzas comerciales B2B.

Recibirás el JSON de un lead (con su auditoría) con status READY_FOR_OUTREACH.
Tu tarea es identificar hasta 5 agencias de marketing/desarrollo que podrían comprar este lead.

CRITERIOS DE AGENCIA IDEAL:
- Ofrecen servicios de desarrollo web, CRM o automatización
- Capacidad de ejecutar el plan de modernización detectado
- Mismo mercado geográfico o segmento
- Presencia activa (web actualizada, redes, reseñas)
- Entre 2 y 50 empleados

SEÑALES DE AGENCIA NO APTA:
- Sin sitio web o sitio abandonado
- Sin portfolio visible
- Reseñas negativas dominantes
- Enfoque exclusivo B2C o retail

CLASIFICACIÓN:
TIER1 - FIT PERFECTO: especialización alineada + mercado coincidente
TIER2 - FIT PARCIAL: capacidad presente pero especialización diferente
TIER3 - FIT BAJO: capacidad limitada o mercado distante

Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional, sin markdown. Máximo 5 agencias.
Estructura exacta por agencia:
{
  "agency_name": string,
  "website": string,
  "location": string,
  "specialization": string[],
  "tier": "TIER1" | "TIER2" | "TIER3",
  "contact_name": string,
  "contact_email": string,
  "contact_linkedin": string,
  "crm_status": "NEW",
  "lead_id": string
}`;

export async function runAgent20(lead: Lead, audit: Audit): Promise<Agency[]> {
  if (lead.status !== "READY_FOR_OUTREACH") {
    throw new Error(`Agent20: lead ${lead.id} no tiene status READY_FOR_OUTREACH`);
  }

  const input = JSON.stringify({ lead, audit });
  const raw = await runAgent(SYSTEM_PROMPT, input);

  let parsed: (Agency & { lead_id: string })[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Agent20: respuesta no es JSON válido. Raw: ${raw.slice(0, 200)}`);
  }

  const now = new Date().toISOString();
  const agencies: Agency[] = [];

  for (const item of parsed.slice(0, 5)) {
    const agency: Agency = {
      lead_id: lead.id,
      agency_name: item.agency_name,
      website: item.website,
      location: item.location,
      specialization: item.specialization,
      tier: item.tier,
      contact_name: item.contact_name,
      contact_email: item.contact_email,
      contact_linkedin: item.contact_linkedin,
      crm_status: "NEW",
      created_at: now,
    };

    const ref = await addDoc(collection(db, "agencies"), agency);
    agencies.push({ ...agency, id: ref.id });
  }

  await updateDoc(doc(db, "leads", lead.id!), {
    status: "READY_FOR_CLOSING",
    updated_at: now,
  });

  return agencies;
}
