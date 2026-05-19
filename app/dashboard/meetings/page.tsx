"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from "firebase/firestore";
import { Meeting } from "@/types/meeting";

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-green-500/20 text-green-400 border border-green-500/30",
  PENDING: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border border-red-500/30",
  RESCHEDULED: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
};

const CHANNEL_ICONS: Record<string, string> = {
  Zoom: "🎥",
  Meet: "📹",
  Teams: "💼",
};

function formatDate(date: string, time: string) {
  const d = new Date(`${date}T${time}`);
  return d.toLocaleString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | Meeting["status"]>("ALL");

  useEffect(() => {
    const q = query(collection(db, "meetings"), orderBy("scheduled_date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMeetings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function updateStatus(id: string, status: Meeting["status"]) {
    await updateDoc(doc(db, "meetings", id), { status });
  }

  const filtered =
    filter === "ALL" ? meetings : meetings.filter((m) => m.status === filter);

  const counts = {
    ALL: meetings.length,
    PENDING: meetings.filter((m) => m.status === "PENDING").length,
    CONFIRMED: meetings.filter((m) => m.status === "CONFIRMED").length,
    CANCELLED: meetings.filter((m) => m.status === "CANCELLED").length,
    RESCHEDULED: meetings.filter((m) => m.status === "RESCHEDULED").length,
  };

  const upcoming = meetings.filter(
    (m) =>
      m.status !== "CANCELLED" &&
      new Date(`${m.scheduled_date}T${m.scheduled_time}`) >= new Date()
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reuniones</h1>
        <p className="text-sm text-gray-400 mt-1">
          {upcoming} próximas reuniones activas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-white">{counts.ALL}</div>
          <div className="text-xs text-gray-400 mt-1">Total</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-yellow-400">{counts.PENDING}</div>
          <div className="text-xs text-gray-400 mt-1">Pendientes</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-green-400">{counts.CONFIRMED}</div>
          <div className="text-xs text-gray-400 mt-1">Confirmadas</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-3xl font-bold text-red-400">{counts.CANCELLED}</div>
          <div className="text-xs text-gray-400 mt-1">Canceladas</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["ALL", "PENDING", "CONFIRMED", "CANCELLED", "RESCHEDULED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              filter === s
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {s === "ALL" ? "Todas" : s} ({counts[s as keyof typeof counts] ?? 0})
          </button>
        ))}
      </div>

      {/* Meeting cards */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm">
          No hay reuniones en esta categoría. Se crean automáticamente cuando el Agente 17 detecta una respuesta positiva.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((meeting) => {
            const isPast =
              new Date(`${meeting.scheduled_date}T${meeting.scheduled_time}`) < new Date();
            return (
              <div
                key={meeting.id}
                className={`rounded-xl border bg-gray-900 p-5 space-y-4 transition-colors ${
                  isPast ? "border-gray-800 opacity-60" : "border-gray-700"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{CHANNEL_ICONS[meeting.channel] ?? "📅"}</span>
                      <span className="font-semibold text-white">{meeting.channel}</span>
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      {formatDate(meeting.scheduled_date, meeting.scheduled_time)}
                    </div>
                    <div className="text-xs text-gray-500">{meeting.timezone} · {meeting.duration_minutes} min</div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[meeting.status]}`}>
                    {meeting.status}
                  </span>
                </div>

                {/* IDs */}
                <div className="space-y-1 text-xs text-gray-500">
                  <div>
                    <span className="text-gray-600">Lead: </span>
                    <span className="font-mono">{meeting.lead_id.slice(0, 12)}…</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Agencia: </span>
                    <span className="font-mono">{meeting.agency_id.slice(0, 12)}…</span>
                  </div>
                </div>

                {/* Meeting URL */}
                {meeting.meeting_url && (
                  <a
                    href={meeting.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-blue-400 hover:text-blue-300 truncate transition-colors"
                  >
                    Unirse a la reunión →
                  </a>
                )}

                {/* Actions */}
                {!isPast && meeting.status === "PENDING" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => updateStatus(meeting.id!, "CONFIRMED")}
                      className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => updateStatus(meeting.id!, "CANCELLED")}
                      className="flex-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 py-1.5 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                {!isPast && meeting.status === "CONFIRMED" && (
                  <button
                    onClick={() => updateStatus(meeting.id!, "RESCHEDULED")}
                    className="w-full text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 py-1.5 rounded-lg transition-colors"
                  >
                    Reagendar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
