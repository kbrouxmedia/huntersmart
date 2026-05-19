"use client";

import { useEffect, useState, useTransition } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from "firebase/firestore";
import { Meeting } from "@/types/meeting";

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-green-500/15 text-green-400 ring-1 ring-green-500/30",
  PENDING: "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
  CANCELLED: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  RESCHEDULED: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30",
};

const CHANNEL_ICONS: Record<string, string> = {
  Zoom: "🎥",
  Meet: "📹",
  Teams: "💼",
};

function formatDate(date: string, time: string) {
  const d = new Date(`${date}T${time}`);
  return new Intl.DateTimeFormat("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type StatusFilter = "ALL" | Meeting["status"];

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const q = query(collection(db, "meetings"), orderBy("scheduled_date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      startTransition(() => {
        setMeetings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting)));
        setLoading(false);
      });
    });
    return () => unsub();
  }, []);

  async function updateStatus(id: string, status: Meeting["status"]) {
    setUpdatingId(id);
    await updateDoc(doc(db, "meetings", id), { status });
    setUpdatingId(null);
  }

  const filtered = filter === "ALL" ? meetings : meetings.filter((m) => m.status === filter);

  const counts = {
    ALL: meetings.length,
    PENDING: meetings.filter((m) => m.status === "PENDING").length,
    CONFIRMED: meetings.filter((m) => m.status === "CONFIRMED").length,
    CANCELLED: meetings.filter((m) => m.status === "CANCELLED").length,
    RESCHEDULED: meetings.filter((m) => m.status === "RESCHEDULED").length,
  };

  const upcoming = meetings.filter(
    (m) => m.status !== "CANCELLED" && new Date(`${m.scheduled_date}T${m.scheduled_time}`) >= new Date()
  ).length;

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "Todas" },
    { key: "PENDING", label: "Pendientes" },
    { key: "CONFIRMED", label: "Confirmadas" },
    { key: "CANCELLED", label: "Canceladas" },
    { key: "RESCHEDULED", label: "Reagendadas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white" style={{ textWrap: "balance" }}>
          Reuniones
        </h1>
        <p className="text-sm text-zinc-500 mt-1 tabular">
          {upcoming} próximas reuniones activas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.ALL, color: "text-white" },
          { label: "Pendientes", value: counts.PENDING, color: "text-yellow-400" },
          { label: "Confirmadas", value: counts.CONFIRMED, color: "text-green-400" },
          { label: "Canceladas", value: counts.CANCELLED, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className={`text-3xl font-bold tabular ${color}`}>{value}</div>
            <div className="text-xs text-zinc-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar reuniones">
        {statusFilters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 tabular ${
              filter === key
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {label} ({counts[key as keyof typeof counts] ?? 0})
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
              <div className="skeleton h-5 w-24" />
              <div className="skeleton h-4 w-36" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 text-sm">
          No hay reuniones en esta categoría.
          <span className="block text-zinc-600 mt-1">Se crean automáticamente cuando el Agente&nbsp;17 detecta una respuesta positiva.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((meeting) => {
            const isPast = new Date(`${meeting.scheduled_date}T${meeting.scheduled_time}`) < new Date();
            const isUpdating = updatingId === meeting.id;
            return (
              <article
                key={meeting.id}
                className={`rounded-xl border bg-zinc-900 p-5 space-y-4 transition-colors ${
                  isPast ? "border-zinc-800 opacity-50" : "border-zinc-700 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true">{CHANNEL_ICONS[meeting.channel] ?? "📅"}</span>
                      <span className="font-semibold text-white">{meeting.channel}</span>
                    </div>
                    <time
                      dateTime={`${meeting.scheduled_date}T${meeting.scheduled_time}`}
                      className="text-sm text-zinc-300 mt-1 block"
                    >
                      {formatDate(meeting.scheduled_date, meeting.scheduled_time)}
                    </time>
                    <p className="text-xs text-zinc-500 tabular">
                      {meeting.timezone} · {meeting.duration_minutes}&nbsp;min
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[meeting.status]}`}>
                    {meeting.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-zinc-500 font-mono">
                  <p><span className="text-zinc-600">Lead </span>{meeting.lead_id.slice(0, 12)}…</p>
                  <p><span className="text-zinc-600">Agencia </span>{meeting.agency_id.slice(0, 12)}…</p>
                </div>

                {meeting.meeting_url && (
                  <a
                    href={meeting.meeting_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Unirse a reunión de ${meeting.channel}`}
                    className="block text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Unirse a la reunión →
                  </a>
                )}

                {!isPast && meeting.status === "PENDING" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => updateStatus(meeting.id!, "CONFIRMED")}
                      disabled={isUpdating}
                      aria-busy={isUpdating}
                      className="flex-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => updateStatus(meeting.id!, "CANCELLED")}
                      disabled={isUpdating}
                      aria-busy={isUpdating}
                      className="flex-1 text-xs bg-red-500/15 hover:bg-red-500/25 text-red-400 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                {!isPast && meeting.status === "CONFIRMED" && (
                  <button
                    onClick={() => updateStatus(meeting.id!, "RESCHEDULED")}
                    disabled={isUpdating}
                    aria-busy={isUpdating}
                    className="w-full text-xs bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    Reagendar
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
