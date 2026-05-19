"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Lead } from "@/types/lead";

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-500/20 text-red-400 border border-red-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  LOW: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  READY_FOR_AUDIT: "bg-blue-500/20 text-blue-400",
  READY_FOR_OUTREACH: "bg-purple-500/20 text-purple-400",
  READY_FOR_CLOSING: "bg-orange-500/20 text-orange-400",
  OUTREACH_ACTIVE: "bg-cyan-500/20 text-cyan-400",
  MEETING_SCHEDULED: "bg-green-500/20 text-green-400",
  CONVERTED: "bg-emerald-500/20 text-emerald-400",
  ARCHIVED: "bg-gray-500/20 text-gray-400",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query_, setQuery_] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "leads"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleScout(e: React.FormEvent) {
    e.preventDefault();
    if (!query_.trim()) return;
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/agents/agent14", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query_ }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error);
      else setQuery_("");
    } catch {
      setError("Error de conexión");
    } finally {
      setRunning(false);
    }
  }

  async function handleAudit(lead: Lead) {
    try {
      await fetch("/api/agents/agent15", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch {
      setError("Error al auditar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-sm text-gray-400 mt-1">{leads.length} empresas en el sistema</p>
        </div>
      </div>

      {/* Scout Form */}
      <form onSubmit={handleScout} className="flex gap-3">
        <input
          type="text"
          value={query_}
          onChange={(e) => setQuery_(e.target.value)}
          placeholder="Ej: empresas de construcción en Montreal con más de 50 empleados"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={running}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {running ? "Buscando..." : "Buscar Leads"}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm">
          No hay leads todavía. Usa el buscador para encontrar empresas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Empresa</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Industria</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Ubicación</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Score</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Prioridad</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{lead.company_name}</div>
                    <div className="text-gray-500 text-xs">{lead.website_url}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{lead.industry}</td>
                  <td className="px-4 py-3 text-gray-300">{lead.location}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-white">{lead.opportunity_score}</span>
                    <span className="text-gray-500">/100</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[lead.priority]}`}>
                      {lead.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[lead.status] ?? ""}`}>
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.status === "READY_FOR_AUDIT" && (
                      <button
                        onClick={() => handleAudit(lead)}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg transition-colors"
                      >
                        Auditar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
