"use client";

import { useEffect, useState, useTransition } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Agency } from "@/types/agency";

const TIER_STYLES: Record<string, string> = {
  TIER1: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  TIER2: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  TIER3: "bg-zinc-800 text-zinc-400",
};

const TIER_LABELS: Record<string, string> = {
  TIER1: "Fit Perfecto",
  TIER2: "Fit Parcial",
  TIER3: "Fit Bajo",
};

type FilterKey = "ALL" | "TIER1" | "TIER2" | "TIER3";

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex justify-between gap-2">
        <div className="space-y-2">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-5 w-16 rounded-md" />
        <div className="skeleton h-5 w-20 rounded-md" />
      </div>
      <div className="border-t border-zinc-800 pt-4 space-y-2">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton h-3 w-40" />
      </div>
    </div>
  );
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const q = query(collection(db, "agencies"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      startTransition(() => {
        setAgencies(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Agency)));
        setLoading(false);
      });
    });
    return () => unsub();
  }, []);

  const filtered = filter === "ALL" ? agencies : agencies.filter((a) => a.tier === filter);

  const counts: Record<FilterKey, number> = {
    ALL: agencies.length,
    TIER1: agencies.filter((a) => a.tier === "TIER1").length,
    TIER2: agencies.filter((a) => a.tier === "TIER2").length,
    TIER3: agencies.filter((a) => a.tier === "TIER3").length,
  };

  const filters: { key: FilterKey; label: string; sublabel: string }[] = [
    { key: "ALL", label: "Todas", sublabel: "Agencias" },
    { key: "TIER1", label: "TIER 1", sublabel: "Fit Perfecto" },
    { key: "TIER2", label: "TIER 2", sublabel: "Fit Parcial" },
    { key: "TIER3", label: "TIER 3", sublabel: "Fit Bajo" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white" style={{ textWrap: "balance" }}>
          Agencias
        </h1>
        <p className="text-sm text-zinc-500 mt-1 tabular">
          {agencies.length} {agencies.length === 1 ? "agencia" : "agencias"} en el sistema
        </p>
      </div>

      {/* Filter cards */}
      <div className="grid grid-cols-4 gap-3" role="group" aria-label="Filtrar por tier">
        {filters.map(({ key, label, sublabel }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              filter === key
                ? "border-blue-500 bg-blue-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <div className="text-2xl font-bold text-white tabular">{counts[key]}</div>
            <div className="text-xs font-medium text-white mt-1">{label}</div>
            <div className="text-xs text-zinc-500">{sublabel}</div>
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 text-sm">
          No hay agencias en esta categoría.
          <span className="block text-zinc-600 mt-1">Se agregan automáticamente cuando corre el Agente&nbsp;20.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agency) => (
            <article
              key={agency.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{agency.agency_name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{agency.location}</div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${TIER_STYLES[agency.tier]}`}>
                  {TIER_LABELS[agency.tier]}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {agency.specialization.map((s) => (
                  <span key={s} className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-md">
                    {s}
                  </span>
                ))}
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-1.5">
                <p className="text-xs text-zinc-400 truncate">
                  <span className="text-zinc-600">Contacto </span>
                  {agency.contact_name}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  <span className="text-zinc-600">Email </span>
                  <span translate="no">{agency.contact_email}</span>
                </p>
                {agency.contact_linkedin && (
                  <a
                    href={agency.contact_linkedin}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`LinkedIn de ${agency.agency_name}`}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors block"
                  >
                    Ver LinkedIn →
                  </a>
                )}
              </div>

              {agency.website && (
                <a
                  href={agency.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Sitio web de ${agency.agency_name}`}
                  className="block text-xs text-zinc-500 hover:text-zinc-300 truncate transition-colors"
                >
                  {agency.website}
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
