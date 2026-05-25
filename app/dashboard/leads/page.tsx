"use client";

import { useEffect, useState, useTransition } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, doc } from "firebase/firestore";
import { Lead, Audit } from "@/types/lead";
import { Agency } from "@/types/agency";
import { Outreach } from "@/types/outreach";

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
  LOW: "bg-zinc-800 text-zinc-400",
};

const STATUS_STYLES: Record<string, string> = {
  READY_FOR_AUDIT: "bg-blue-500/15 text-blue-400",
  READY_FOR_OUTREACH: "bg-violet-500/15 text-violet-400",
  READY_FOR_CLOSING: "bg-orange-500/15 text-orange-400",
  OUTREACH_ACTIVE: "bg-cyan-500/15 text-cyan-400",
  MEETING_SCHEDULED: "bg-green-500/15 text-green-400",
  CONVERTED: "bg-emerald-500/15 text-emerald-400",
  ARCHIVED: "bg-zinc-800 text-zinc-500",
};

const CITIES = ["Montreal", "Toronto", "Vancouver", "Calgary", "Miami", "New York", "Ciudad de México", "Madrid", "Barcelona", "Buenos Aires"];

type PipelineStep = { step: string; message: string; done: boolean };

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-red-500" : score >= 50 ? "bg-yellow-500" : "bg-zinc-600";
  return (
    <div className="flex items-center gap-2">
      <span className="tabular text-sm font-semibold text-white w-7">{score}</span>
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full score-bar ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-800/50">
      {[140, 80, 80, 60, 60, 80, 60].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function SearchingBanner({ city }: { city: string }) {
  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 flex items-center gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      <div>
        <p className="text-sm font-medium text-white">Analizando empresas en {city}…</p>
        <p className="text-xs text-zinc-500 mt-0.5">La IA está buscando empresas con deficiencias digitales. Toma 15–30&nbsp;seg.</p>
      </div>
    </div>
  );
}

function PipelineBanner({ steps, leadName }: { steps: PipelineStep[]; leadName: string }) {
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 space-y-3">
      <p className="text-sm font-medium text-white">Pipeline activo — {leadName}</p>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.step} className="flex items-center gap-3">
            {s.done ? (
              <span className="text-emerald-400 text-sm">✓</span>
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            )}
            <span className={`text-xs ${s.done ? "text-zinc-400 line-through" : "text-white"}`}>
              {s.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingCity, setSearchingCity] = useState("");
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [pipelineLeadName, setPipelineLeadName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [, startTransition] = useTransition();

  // Drawer / Detail states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [matchedAgencies, setMatchedAgencies] = useState<Agency[]>([]);
  const [outreach, setOutreach] = useState<Outreach | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"audit" | "agencies" | "outreach">("audit");
  const [outreachActiveTab, setOutreachActiveTab] = useState<number>(1);
  const [simulating, setSimulating] = useState(false);
  const [simulationText, setSimulationText] = useState("");
  const [copiedDay, setCopiedDay] = useState<number | null>(null);

  useEffect(() => {
    const q = query(collection(db, "leads"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      startTransition(() => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead));
        setLeads(list);
        setLoading(false);

        // Update selected lead details if it exists and changed in snapshot
        if (selectedLead) {
          const updated = list.find(l => l.id === selectedLead.id);
          if (updated) {
            setSelectedLead(updated);
          }
        }
      });
    });
    return () => unsub();
  }, [selectedLead]);

  // Load Lead details (Audit, Matched Agencies, Outreach) in real-time
  useEffect(() => {
    if (!selectedLead?.id) {
      setAudit(null);
      setMatchedAgencies([]);
      setOutreach(null);
      return;
    }

    setLoadingDetails(true);

    // 1. Audit listener
    const unsubAudit = onSnapshot(doc(db, "audits", selectedLead.id), (snap) => {
      if (snap.exists()) {
        setAudit(snap.data() as Audit);
      } else {
        setAudit(null);
      }
      setLoadingDetails(false);
    });

    // 2. Matched Agencies listener (using lead_id relation)
    const qAgencies = query(collection(db, "agencies"), where("lead_id", "==", selectedLead.id));
    const unsubAgencies = onSnapshot(qAgencies, (snap) => {
      setMatchedAgencies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Agency)));
    });

    // 3. Outreach listener (using lead_id as doc ID)
    const unsubOutreach = onSnapshot(doc(db, "outreach", selectedLead.id), (snap) => {
      if (snap.exists()) {
        setOutreach(snap.data() as Outreach);
      } else {
        setOutreach(null);
      }
    });

    return () => {
      unsubAudit();
      unsubAgencies();
      unsubOutreach();
    };
  }, [selectedLead?.id]);

  async function handleScout(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || searchingCity) return;
    setError("");
    setSuccess("");
    const city = searchQuery;
    setSearchingCity(city);
    const prompt = `Encuentra empresas con alto ingreso y deficiencias digitales evidentes en ${city}. Analiza todos los sectores de alto valor: construcción, manufactura, servicios profesionales, salud, logística, tecnología, retail B2B. Mínimo 50 empleados. Prioriza empresas con múltiples deficiencias digitales y alto potencial de modernización.`;
    
    try {
      const res = await fetch("/api/agents/agent14", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt }),
      });
      if (!res.body) throw new Error("Sin respuesta");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done && !buffer) break;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        const lines = buffer.split("\n");
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.replace("data: ", "").trim();
          if (payload === "searching") continue;
          try {
            const data = JSON.parse(payload);
            if (!data.success) setError(data.error);
            else {
              setSuccess(`${data.count} leads encontrados en ${city}`);
              setSearchQuery("");
              setTimeout(() => setSuccess(""), 6000);
            }
          } catch { /* ignore partial */ }
        }
        if (done) break;
      }
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setSearchingCity("");
    }
  }

  async function handlePipeline(lead: Lead) {
    setError("");
    setPipelineLeadName(lead.company_name);
    const steps: PipelineStep[] = [
      { step: "audit", message: `Auditando ${lead.company_name}…`, done: false },
      { step: "prospect", message: "Buscando agencias compatibles…", done: false },
      { step: "outreach", message: "Generando mensajes de outreach…", done: false },
    ];
    setPipelineSteps([...steps]);

    try {
      const res = await fetch("/api/agents/agent15", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      if (!res.body) throw new Error("Sin respuesta");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done && !buffer) break;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        const lines = buffer.split("\n");
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.replace("data: ", "").trim();
          try {
            const data = JSON.parse(payload);
            if (data.step === "audit_done") {
              setPipelineSteps((prev) => prev.map((s) => s.step === "audit" ? { ...s, done: true } : s));
            }
            if (data.step === "prospect_done") {
              setPipelineSteps((prev) => prev.map((s) => s.step === "prospect" ? { ...s, done: true } : s));
            }
            if (data.step === "outreach_done") {
              setPipelineSteps((prev) => prev.map((s) => s.step === "outreach" ? { ...s, done: true } : s));
            }
            if (data.success === true) {
              setSuccess(`Pipeline completado para ${lead.company_name}`);
              setTimeout(() => { setSuccess(""); setPipelineSteps([]); }, 6000);
            }
            if (data.success === false) {
              setError(data.error);
              setPipelineSteps([]);
            }
          } catch { /* ignore partial */ }
        }
        if (done) break;
      }
    } catch {
      setError("Error de conexión durante el pipeline.");
      setPipelineSteps([]);
    }
  }

  async function triggerSimulation(simulationType: "MEETING" | "REJECTION") {
    if (!selectedLead?.id || simulating) return;
    setSimulating(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/agents/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          type: simulationType,
          customText: simulationText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al simular agente");
      }
      setSuccess(data.message);
      setSimulationText("");
      setTimeout(() => setSuccess(""), 6000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSimulating(false);
    }
  }

  const isPipelineRunning = pipelineSteps.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white" style={{ textWrap: "balance" }}>Leads</h1>
        <p className="text-sm text-zinc-500 mt-1 tabular">
          {leads.length} {leads.length === 1 ? "empresa" : "empresas"} en el sistema
        </p>
      </div>

      {/* Scout Form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-white">¿Dónde buscamos leads?</p>
          <p className="text-xs text-zinc-500 mt-0.5">Escoge un lugar — la IA encuentra empresas con deficiencias digitales automáticamente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CITIES.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => setSearchQuery(city)}
              disabled={!!searchingCity}
              aria-pressed={searchQuery === city}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
                searchQuery === city ? "bg-blue-600 border-blue-600 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
        <form onSubmit={handleScout} className="flex gap-2" role="search">
          <label htmlFor="scout-location" className="sr-only">Ciudad o país</label>
          <input
            id="scout-location"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={!!searchingCity}
            placeholder="O escribe una ciudad o país…"
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!!searchingCity || !searchQuery.trim()}
            aria-busy={!!searchingCity}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {searchingCity ? "Buscando…" : "Buscar →"}
          </button>
        </form>
      </div>

      {searchingCity && <SearchingBanner city={searchingCity} />}
      {isPipelineRunning && <PipelineBanner steps={pipelineSteps} leadName={pipelineLeadName} />}
      {success && (
        <div role="status" aria-live="polite" className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm text-emerald-400">
          ✓ {success}
        </div>
      )}
      {error && (
        <div role="alert" aria-live="polite" className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm" aria-label="Lista de leads">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Empresa</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Industria</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide hidden md:table-cell">Ubicación</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Score</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Prioridad</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Estado</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-zinc-500 text-sm">
                  No hay leads todavía. Escoge una ciudad para comenzar.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr 
                  key={lead.id} 
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsDrawerOpen(true);
                  }}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white truncate max-w-[180px]">{lead.company_name}</div>
                    <div className="text-zinc-500 text-xs truncate max-w-[180px]">{lead.website_url}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 truncate max-w-[120px]">{lead.industry}</td>
                  <td className="px-4 py-3 text-zinc-300 hidden md:table-cell">{lead.location}</td>
                  <td className="px-4 py-3"><ScoreBar score={lead.opportunity_score} /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[lead.priority]}`}>
                      {lead.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[lead.status] ?? ""}`}>
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.status === "READY_FOR_AUDIT" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePipeline(lead);
                        }}
                        disabled={isPipelineRunning}
                        aria-label={`Iniciar pipeline para ${lead.company_name}`}
                        className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        Iniciar Pipeline
                      </button>
                    )}
                    {lead.status === "OUTREACH_ACTIVE" && (
                      <span className="text-xs text-cyan-400">En outreach ✓</span>
                    )}
                    {lead.status === "MEETING_SCHEDULED" && (
                      <span className="text-xs text-green-400">Reunión agendada ✓</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {isDrawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-2xl transform transition-transform duration-300 ease-out bg-[#0c0c0e] border-l border-zinc-800 flex flex-col shadow-2xl">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedLead.company_name}</h2>
                  <a 
                    href={selectedLead.website_url.startsWith("http") ? selectedLead.website_url : `https://${selectedLead.website_url}`} 
                    target="_blank" 
                    rel="noreferrer noopener"
                    className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    {selectedLead.website_url} 
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-lg p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <span className="sr-only">Cerrar</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Tabs */}
                <div className="flex border-b border-zinc-800">
                  {(["audit", "agencies", "outreach"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 pb-3 text-sm font-medium border-b-2 text-center transition-all ${
                        activeTab === tab
                          ? "border-blue-500 text-white"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {tab === "audit" ? "📊 Auditoría" : tab === "agencies" ? "🤝 Agencias" : "✉️ Outreach"}
                    </button>
                  ))}
                </div>

                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    <p className="text-xs text-zinc-500">Cargando detalles...</p>
                  </div>
                ) : (
                  <>
                    {activeTab === "audit" && (
                      <div className="space-y-6">
                        {!audit ? (
                          <div className="text-center py-12 border border-dashed border-zinc-850 rounded-xl bg-zinc-900/20">
                            <p className="text-sm text-zinc-500">Este lead no ha sido auditado aún.</p>
                            <p className="text-xs text-zinc-650 mt-1">Corre el pipeline principal para generar el diagnóstico.</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Score & Financial loss */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                                <span className="text-xs text-zinc-500">Puntuación Técnica</span>
                                <div className="flex items-baseline gap-1 mt-2">
                                  <span className="text-3xl font-bold text-white">{audit.technical_score}</span>
                                  <span className="text-sm text-zinc-500">/100</span>
                                </div>
                                <div className="w-full bg-zinc-855 h-1.5 rounded-full overflow-hidden mt-3">
                                  <div 
                                    className={`h-full rounded-full ${
                                      audit.technical_score >= 80 ? "bg-emerald-500" : audit.technical_score >= 50 ? "bg-yellow-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${audit.technical_score}%` }}
                                  />
                                </div>
                              </div>

                              <div className="bg-red-950/15 border border-red-900/30 rounded-xl p-4 flex flex-col justify-between">
                                <span className="text-xs text-red-400">Pérdida Mensual Estimada</span>
                                <div className="text-2xl font-bold text-red-400 mt-2">
                                  -${audit.total_estimated_monthly_loss.toLocaleString()} USD
                                </div>
                                <span className="text-[10px] text-zinc-500 mt-3 block leading-tight">
                                  Impacto financiero proyectado por deficiencias digitales.
                                </span>
                              </div>
                            </div>

                            {/* Current Tech Stack */}
                            <div className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Stack Tecnológico</h3>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-2.5">
                                  <span className="text-zinc-500 block">CMS</span>
                                  <span className="text-zinc-300 font-medium mt-0.5 block">{audit.current_stack.cms || "No detectado"}</span>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-2.5">
                                  <span className="text-zinc-500 block">CRM</span>
                                  <span className="text-zinc-300 font-medium mt-0.5 block">{audit.current_stack.crm || "Ninguno"}</span>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-2.5">
                                  <span className="text-zinc-500 block">Analytics</span>
                                  <span className="text-zinc-300 font-medium mt-0.5 block truncate">{audit.current_stack.analytics || "Ninguno"}</span>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-2.5 col-span-2">
                                  <span className="text-zinc-500 block">Pixels Activos</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Array.isArray(audit.current_stack.pixels) && audit.current_stack.pixels.length > 0 ? (
                                      audit.current_stack.pixels.map((p: string) => (
                                        <span key={p} className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">{p}</span>
                                      ))
                                    ) : (
                                      <span className="text-zinc-500 text-[10px]">Ninguno</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Executive Summary */}
                            <div className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Resumen Ejecutivo</h3>
                              <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed">
                                {audit.executive_summary}
                              </div>
                            </div>

                            {/* Deficiencies */}
                            <div className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Deficiencias Críticas</h3>
                              <ul className="space-y-1.5">
                                {audit.deficiencies.map((def: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                                    <span className="text-red-400 shrink-0 mt-0.5">⚠️</span>
                                    <span>{def}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Modernization Plan */}
                            <div className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Plan de Modernización</h3>
                              <ol className="space-y-2">
                                {audit.modernization_plan.map((step: string, i: number) => (
                                  <li key={i} className="flex gap-3 text-xs text-zinc-300 bg-zinc-900 border border-zinc-850 rounded-lg p-3">
                                    <span className="font-bold text-blue-400">{i + 1}</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "agencies" && (
                      <div className="space-y-4">
                        {matchedAgencies.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-zinc-850 rounded-xl bg-zinc-900/20">
                            <p className="text-sm text-zinc-500">No hay agencias vinculadas a este lead.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {matchedAgencies.map((agency) => (
                              <div key={agency.id} className="bg-zinc-900 border border-zinc-850 rounded-xl p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold text-sm text-white">{agency.agency_name}</h4>
                                    <p className="text-xs text-zinc-500 mt-0.5">{agency.location}</p>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    agency.tier === "TIER1" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
                                  }`}>
                                    {agency.tier === "TIER1" ? "Fit Perfecto" : "Fit Parcial"}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  {agency.specialization.map((s) => (
                                    <span key={s} className="bg-zinc-850 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                                  ))}
                                </div>

                                <div className="border-t border-zinc-850 pt-3 flex items-center justify-between text-xs text-zinc-400">
                                  <div>
                                    <p className="text-zinc-300 font-medium">{agency.contact_name}</p>
                                    <p className="text-[10px] text-zinc-500">{agency.contact_email}</p>
                                  </div>
                                  {agency.contact_linkedin && (
                                    <a 
                                      href={agency.contact_linkedin} 
                                      target="_blank" 
                                      rel="noreferrer noopener"
                                      className="text-xs text-blue-400 hover:underline"
                                    >
                                      LinkedIn
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "outreach" && (
                      <div className="space-y-6">
                        {!outreach ? (
                          <div className="text-center py-12 border border-dashed border-zinc-850 rounded-xl bg-zinc-900/20">
                            <p className="text-sm text-zinc-500">No se han generado correos de outreach para este lead.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Day Tabs */}
                            <div className="flex gap-2">
                              {[1, 3, 7].map((day) => (
                                <button
                                  key={day}
                                  onClick={() => {
                                    setOutreachActiveTab(day);
                                    setCopiedDay(null);
                                  }}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    outreachActiveTab === day
                                      ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20"
                                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                  }`}
                                >
                                  Día {day}
                                </button>
                              ))}
                            </div>

                            {/* Message Display */}
                            {outreach.messages?.map((msg) => {
                              if (msg.day !== outreachActiveTab) return null;
                              return (
                                <div key={msg.day} className="space-y-3">
                                  <div className="relative bg-zinc-900 border border-zinc-850 rounded-xl p-4 flex flex-col">
                                    <pre className="text-xs text-zinc-300 font-sans whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                                      {msg.content}
                                    </pre>
                                  </div>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(msg.content);
                                      setCopiedDay(msg.day);
                                      setTimeout(() => setCopiedDay(null), 3000);
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 bg-zinc-855 hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors text-xs font-medium py-2 rounded-lg border border-zinc-700"
                                  >
                                    {copiedDay === msg.day ? (
                                      <>
                                        <span className="text-emerald-400">✓</span> ¡Copiado al portapapeles!
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 5h3m-3 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                        Copiar Mensaje
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Drawer Footer / Simulator */}
              {selectedLead.status !== "CONVERTED" && selectedLead.status !== "ARCHIVED" && (
                <div className="px-6 py-5 border-t border-zinc-800 bg-[#0a0a0c] space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span>🤖 Panel de Simulación (Agente 17 / 18)</span>
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Simula respuestas de agencias para avanzar en el pipeline sin depender de webhooks externos.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      value={simulationText}
                      onChange={(e) => setSimulationText(e.target.value)}
                      placeholder="Escribe un mensaje de respuesta personalizado o déjalo vacío para usar un mensaje por defecto..."
                      className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2 text-xs text-white placeholder-zinc-650 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 h-16 resize-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => triggerSimulation("MEETING")}
                        disabled={simulating || loadingDetails || matchedAgencies.length === 0}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        {simulating ? "Simulando..." : "🤝 Simular Aceptación (Reunión)"}
                      </button>

                      <button
                        onClick={() => triggerSimulation("REJECTION")}
                        disabled={simulating || loadingDetails || matchedAgencies.length === 0}
                        className="flex-1 bg-red-955/40 hover:bg-red-955/60 border border-red-900/30 text-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        {simulating ? "Simulando..." : "❌ Simular Objeción / Rechazo"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
