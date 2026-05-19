"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Agency } from "@/types/agency";

const TIER_COLORS: Record<string, string> = {
  TIER1: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  TIER2: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  TIER3: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};

const TIER_LABELS: Record<string, string> = {
  TIER1: "Fit Perfecto",
  TIER2: "Fit Parcial",
  TIER3: "Fit Bajo",
};

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "TIER1" | "TIER2" | "TIER3">("ALL");

  useEffect(() => {
    const q = query(collection(db, "agencies"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setAgencies(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Agency)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = filter === "ALL" ? agencies : agencies.filter((a) => a.tier === filter);

  const counts = {
    ALL: agencies.length,
    TIER1: agencies.filter((a) => a.tier === "TIER1").length,
    TIER2: agencies.filter((a) => a.tier === "TIER2").length,
    TIER3: agencies.filter((a) => a.tier === "TIER3").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Agencias</h1>
        <p className="text-sm text-gray-400 mt-1">{agencies.length} agencias en el sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(["ALL", "TIER1", "TIER2", "TIER3"] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => setFilter(tier)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              filter === tier
                ? "border-blue-500 bg-blue-500/10"
                : "border-gray-800 bg-gray-900 hover:border-gray-700"
            }`}
          >
            <div className="text-2xl font-bold text-white">{counts[tier]}</div>
            <div className="text-xs text-gray-400 mt-1">
              {tier === "ALL" ? "Total" : TIER_LABELS[tier]}
            </div>
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm">
          No hay agencias en esta categoría. Se agregan automáticamente cuando el Agente 20 corre.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agency) => (
            <div
              key={agency.id}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">{agency.agency_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{agency.location}</div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[agency.tier]}`}>
                  {agency.tier}
                </span>
              </div>

              {/* Specialization */}
              <div className="flex flex-wrap gap-1.5">
                {agency.specialization.map((s) => (
                  <span
                    key={s}
                    className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-md"
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Contact */}
              <div className="border-t border-gray-800 pt-4 space-y-1.5">
                <div className="text-xs text-gray-400">
                  <span className="text-gray-600">Contacto: </span>
                  {agency.contact_name}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  <span className="text-gray-600">Email: </span>
                  {agency.contact_email}
                </div>
                {agency.contact_linkedin && (
                  <a
                    href={agency.contact_linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors block truncate"
                  >
                    LinkedIn →
                  </a>
                )}
              </div>

              {/* Website */}
              {agency.website && (
                <a
                  href={agency.website}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-gray-500 hover:text-gray-300 truncate transition-colors"
                >
                  {agency.website}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
