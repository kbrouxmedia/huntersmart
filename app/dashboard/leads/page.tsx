"use client";

import { useEffect, useState, useTransition } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Lead } from "@/types/lead";

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

  useEffect(() => {
    const q = query(collection(db, "leads"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      startTransition(() => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
        setLoading(false);
      });
    });
    return () => unsub();
  }, []);

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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const payload = line.replace("data: ", "").trim();
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const payload = line.replace("data: ", "").trim();
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
      }
    } catch {
      setError("Error de conexión durante el pipeline.");
      setPipelineSteps([]);
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
                <tr key={lead.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
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
                        onClick={() => handlePipeline(lead)}
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
    </div>
  );
}
