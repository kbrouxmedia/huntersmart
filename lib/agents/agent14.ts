import { db } from "@/lib/firebase";
import { runAgent } from "@/lib/claude";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Lead } from "@/types/lead";

const SYSTEM_PROMPT = `Eres un analista B2B especializado en identificar empresas con alto potencial comercial y deficiencias digitales explotables.

Tu objetivo es identificar UNA SOLA empresa (la mejor oportunidad) que cumpla simultáneamente:
1. Alto ingreso estimado (mínimo 50 empleados)
2. Deficiencias digitales evidentes en fuentes públicas

Devuelve EXACTAMENTE 1 empresa. La más prometedora.

DEFICIENCIAS A DETECTAR:
- Sitio web con diseño desactualizado (+5 años)
- Ausencia de HTTPS o errores de seguridad
- Sin presencia activa en Google Business
- Sin pixel de Meta, Google Ads o analytics detectables
- Sin chatbot, CRM visible o automatización de contacto
- Formularios básicos sin seguimiento
- Redes sociales inactivas o inexistentes

FILTRO DE EXCLUSIÓN:
- Menos de 10 empleados estimados
- Sin sitio web funcional
- Sector público o ONGs

SCORING:
- 80-100: Múltiples deficiencias + industria de alto ingreso
- 50-79: 1-2 deficiencias claras + empresa mediana
- 0-49: Pocas señales, archivar

Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional, sin markdown, sin explicaciones.
Cada objeto debe seguir exactamente esta estructura:
{
  "company_name": string,
  "industry": string,
  "estimated_employees": number,
  "website_url": string,
  "location": string,
  "detected_deficiencies": string[],
  "opportunity_score": number (0-100),
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "status": "READY_FOR_AUDIT"
}`;

function assignPriority(score: number): Lead["priority"] {
  if (score >= 80) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export async function runAgent14(query: string): Promise<Lead[]> {
  const raw = await runAgent(SYSTEM_PROMPT, query);

  let parsed: Omit<Lead, "id" | "created_at" | "updated_at">[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Agent14: respuesta no es JSON válido. Raw: ${raw.slice(0, 200)}`);
  }

  const now = new Date().toISOString();
  const leads: Lead[] = [];

  for (const item of parsed.slice(0, 1)) {
    if ((item.opportunity_score ?? 0) < 50) continue;

    const lead: Lead = {
      ...item,
      priority: assignPriority(item.opportunity_score),
      status: "READY_FOR_AUDIT",
      created_at: now,
      updated_at: now,
    };

    const ref = await addDoc(collection(db, "leads"), lead);
    leads.push({ ...lead, id: ref.id });
  }

  return leads;
}
