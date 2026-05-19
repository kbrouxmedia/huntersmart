import { db } from "@/lib/firebase";
import { runAgent } from "@/lib/claude";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { Lead } from "@/types/lead";
import { Agency } from "@/types/agency";

export type RejectionStatus = "PIVOT_ACTIVE" | "ARCHIVED" | "REASSIGNED";

export type ObjectionCategory =
  | "PRECIO"
  | "TIMING"
  | "FIT"
  | "CONFIANZA"
  | "SILENCIO";

export interface Rejection {
  id?: string;
  lead_id: string;
  agency_id: string;
  objection_category: ObjectionCategory;
  pivot_strategy: {
    model: "A" | "B" | "C" | "D";
    description: string;
    action: string;
  };
  follow_up_sequence: string[];
  status: RejectionStatus;
}

const SYSTEM_PROMPT = `Eres un especialista en gestión de objeciones y reestructuración de ofertas B2B.

Recibirás el JSON de un lead, una agencia y el motivo del rechazo o silencio.
Tu tarea es clasificar la objeción y proponer una estrategia de pivot.

CLASIFICACIÓN DE OBJECIONES:
PRECIO → Pivot: revenue share, muestra gratuita, pago en fases
TIMING → Pivot: seguimiento automático a fecha indicada, valor mensual
FIT → Pivot: reclasificar agencia, activar búsqueda de alternativa
CONFIANZA → Pivot: caso de éxito, auditoría gratuita, referencia
SILENCIO → Pivot: cambiar canal, mensaje ultra-corto, archivar tras 5 intentos

MODELOS DE OFERTA ALTERNATIVA:
MODELO A - REVENUE SHARE: Sin costo inicial. Porcentaje sobre proyecto cerrado.
MODELO B - FREEMIUM: Resumen ejecutivo gratuito. Diagnóstico completo como producto de pago.
MODELO C - FASES: Fase 1 básica a precio reducido. Fase 2 si hay interés.
MODELO D - EXCLUSIVIDAD: Lead reservado 72h. Urgencia real basada en otras agencias interesadas.

REGLAS:
- Máximo 3 pivots por agencia antes de reasignar
- Nunca archivar sin intentar al menos 2 categorías de pivot
- Si el lead lleva +45 días sin conversión: status ARCHIVED

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown.
Estructura exacta:
{
  "lead_id": string,
  "agency_id": string,
  "objection_category": "PRECIO" | "TIMING" | "FIT" | "CONFIANZA" | "SILENCIO",
  "pivot_strategy": {
    "model": "A" | "B" | "C" | "D",
    "description": string,
    "action": string
  },
  "follow_up_sequence": string[],
  "status": "PIVOT_ACTIVE" | "ARCHIVED" | "REASSIGNED"
}`;

export async function runAgent18(
  lead: Lead,
  agency: Agency,
  rejectionReason: string,
  pivotCount: number = 0
): Promise<Rejection> {
  if (pivotCount >= 3) {
    const rejection: Rejection = {
      lead_id: lead.id!,
      agency_id: agency.id!,
      objection_category: "FIT",
      pivot_strategy: {
        model: "D",
        description: "Máximo de pivots alcanzado",
        action: "Reasignar lead a otra agencia",
      },
      follow_up_sequence: [],
      status: "REASSIGNED",
    };
    const ref = await addDoc(collection(db, "rejections"), rejection);
    return { ...rejection, id: ref.id };
  }

  const input = JSON.stringify({ lead, agency, rejection_reason: rejectionReason, pivot_count: pivotCount });
  const raw = await runAgent(SYSTEM_PROMPT, input);

  let parsed: Rejection;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Agent18: respuesta no es JSON válido. Raw: ${raw.slice(0, 200)}`);
  }

  const rejection: Rejection = {
    lead_id: lead.id!,
    agency_id: agency.id!,
    objection_category: parsed.objection_category,
    pivot_strategy: parsed.pivot_strategy,
    follow_up_sequence: parsed.follow_up_sequence,
    status: parsed.status,
  };

  const ref = await addDoc(collection(db, "rejections"), rejection);

  if (parsed.status === "REASSIGNED") {
    await updateDoc(doc(db, "leads", lead.id!), {
      status: "READY_FOR_CLOSING",
      updated_at: new Date().toISOString(),
    });
  }

  return { ...rejection, id: ref.id };
}
