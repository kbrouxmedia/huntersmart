import { db } from "@/lib/firebase";
import { runAgent } from "@/lib/claude";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { Lead, Audit } from "@/types/lead";

const SYSTEM_PROMPT = `Eres un auditor técnico especializado en diagnóstico de rendimiento digital y detección de oportunidades de conversión B2B.

Recibirás el JSON de un lead con status READY_FOR_AUDIT. Debes auditar el sitio web de la empresa.

PUNTOS DE AUDITORÍA:

1. RENDIMIENTO TÉCNICO
   - Core Web Vitals: LCP, FID, CLS (estimados)
   - Tiempo de carga mobile vs desktop
   - Score PageSpeed estimado
   - Uso de CDN

2. STACK TECNOLÓGICO
   - CMS (WordPress, Webflow, custom, etc.)
   - CRM (HubSpot, Salesforce, GHL, ninguno)
   - Pixels activos (Meta, Google Ads, TikTok, LinkedIn)
   - Analytics (GA4, Hotjar, Clarity, ninguno)
   - Automatizaciones (chatbots, pop-ups, formularios)

3. UX/UI Y CONVERSIÓN
   - Claridad del CTA principal
   - Social proof (testimonios, casos de éxito)
   - Diseño responsive mobile
   - Flujo de contacto

4. SEO BÁSICO
   - Meta titles y descriptions
   - Estructura de headings
   - Google Business Profile

CÁLCULO DE IMPACTO ECONÓMICO:
Para cada deficiencia estima el impacto negativo mensual en revenue en USD.

El executive_summary debe estar en lenguaje de negocio, NO técnico. Máximo 3 párrafos.

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown.
Estructura exacta:
{
  "technical_score": number (0-100),
  "deficiencies": string[],
  "current_stack": {
    "cms": string,
    "crm": string,
    "analytics": string,
    "pixels": string[],
    "automations": string[]
  },
  "modernization_plan": string[],
  "total_estimated_monthly_loss": number,
  "executive_summary": string,
  "audit_date": string (ISO),
  "status": "READY_FOR_OUTREACH"
}`;

export async function runAgent15(lead: Lead): Promise<Audit> {
  if (lead.status !== "READY_FOR_AUDIT") {
    throw new Error(`Agent15: lead ${lead.id} no tiene status READY_FOR_AUDIT`);
  }

  const raw = await runAgent(SYSTEM_PROMPT, JSON.stringify(lead));

  let audit: Audit;
  try {
    audit = JSON.parse(raw);
  } catch {
    throw new Error(`Agent15: respuesta no es JSON válido. Raw: ${raw.slice(0, 200)}`);
  }

  audit.audit_date = new Date().toISOString();
  audit.status = "READY_FOR_OUTREACH";

  await setDoc(doc(db, "audits", lead.id!), audit);
  await updateDoc(doc(db, "leads", lead.id!), {
    status: "READY_FOR_OUTREACH",
    updated_at: new Date().toISOString(),
  });

  return audit;
}
