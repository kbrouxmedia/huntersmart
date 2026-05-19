"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Lead } from "@/types/lead";
import { Outreach } from "@/types/outreach";

const STAGES = [
  {
    key: "READY_FOR_AUDIT",
    label: "Por Auditar",
    color: "border-blue-500",
    dot: "bg-blue-500",
    agent: "Agente 14",
  },
  {
    key: "READY_FOR_OUTREACH",
    label: "Por Prospectar",
    color: "border-purple-500",
    dot: "bg-purple-500",
    agent: "Agente 15",
  },
  {
    key: "READY_FOR_CLOSING",
    label: "Por Cerrar",
    color: "border-orange-500",
    dot: "bg-orange-500",
    agent: "Agente 20",
  },
  {
    key: "OUTREACH_ACTIVE",
    label: "Outreach Activo",
    color: "border-cyan-500",
    dot: "bg-cyan-500",
    agent: "Agente 21",
  },
  {
    key: "MEETING_SCHEDULED",
    label: "Reunión Agendada",
    color: "border-green-500",
    dot: "bg-green-500",
    agent: "Agente 17",
  },
  {
    key: "CONVERTED",
    label: "Convertidos",
    color: "border-emerald-500",
    dot: "bg-emerald-500",
    agent: "—",
  },
] as const;

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [outreaches, setOutreaches] = useState<Outreach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubLeads = onSnapshot(
      query(collection(db, "leads"), orderBy("updated_at", "desc")),
      (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
        setLoading(false);
      }
    );
    const unsubOutreach = onSnapshot(collection(db, "outreach"), (snap) => {
      setOutreaches(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Outreach)));
    });
    return () => {
      unsubLeads();
      unsubOutreach();
    };
  }, []);

  const byStage = (key: string) => leads.filter((l) => l.status === key);
  const totalActive = leads.filter((l) => l.status !== "ARCHIVED" && l.status !== "CONVERTED").length;
  const conversionRate =
    leads.length > 0 ? Math.round((byStage("CONVERTED").length / leads.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Pipeline</h1>
        <p className="text-sm text-gray-400 mt-1">Vista completa del flujo de leads</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-white">{leads.length}</div>
          <div className="text-xs text-gray-400 mt-1">Total Leads</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-cyan-400">{totalActive}</div>
          <div className="text-xs text-gray-400 mt-1">En progreso</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-green-400">{outreaches.length}</div>
          <div className="text-xs text-gray-400 mt-1">Outreaches enviados</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-emerald-400">{conversionRate}%</div>
          <div className="text-xs text-gray-400 mt-1">Tasa de conversión</div>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {STAGES.map((stage) => {
            const stageLeads = byStage(stage.key);
            return (
              <div key={stage.key} className="space-y-3">
                {/* Column header */}
                <div className={`rounded-lg border-t-2 ${stage.color} bg-gray-900 px-3 py-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{stage.label}</span>
                    <span className="text-xs bg-gray-800 text-gray-300 rounded-full px-2 py-0.5">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{stage.agent}</div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {stageLeads.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-800 p-3 text-center text-xs text-gray-600">
                      vacío
                    </div>
                  )}
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-lg border border-gray-800 bg-gray-900 p-3 space-y-2 hover:border-gray-700 transition-colors"
                    >
                      <div className="text-xs font-medium text-white leading-tight">
                        {lead.company_name}
                      </div>
                      <div className="text-xs text-gray-500">{lead.industry}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                          <span className="text-xs text-gray-500">{lead.opportunity_score}/100</span>
                        </div>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            lead.priority === "HIGH"
                              ? "bg-red-500/20 text-red-400"
                              : lead.priority === "MEDIUM"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-gray-700 text-gray-400"
                          }`}
                        >
                          {lead.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Outreach activity */}
      {outreaches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Actividad de Outreach</h2>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Lead ID</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Agencia ID</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Mensajes</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody>
                {outreaches.map((o) => (
                  <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{o.lead_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{o.agency_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-gray-300">{o.messages?.length ?? 0} mensajes</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
