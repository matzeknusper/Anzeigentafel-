import React, { useEffect, useRef, useState } from "react";
import { QueueTicket } from "../types";
import { Volume2, Monitor, Calendar, Clock, Bell, ArrowRight } from "lucide-react";
import { playChime, speakCall } from "../utils/audio";

interface DisplayScreenProps {
  tickets: QueueTicket[];
}

export default function DisplayScreen({ tickets }: DisplayScreenProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCalledTicketId = useRef<string | null>(null);

  // Find currently active calling ticket
  const activeTicket = tickets.find((t) => t.status === "calling");

  // Get recently completed or skipped tickets as history
  const historyTickets = tickets
    .filter((t) => t.status === "completed" || t.status === "skipped")
    .sort((a, b) => {
      const timeA = new Date(a.completedAt || a.createdAt).getTime();
      const timeB = new Date(b.completedAt || b.createdAt).getTime();
      return timeB - timeA; // newest completed first
    })
    .slice(0, 4);

  // Get upcoming tickets in queue
  const upcomingTickets = tickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .slice(0, 5);

  // Effect to announce calling number
  useEffect(() => {
    if (!activeTicket) {
      prevCalledTicketId.current = null;
      return;
    }

    const activeId = activeTicket.id;
    const prevId = prevCalledTicketId.current;

    if (activeId !== prevId) {
      if (soundEnabled) {
        // Trigger double-chime gong
        playChime();
        // Wait and voice call
        setTimeout(() => {
          speakCall(activeTicket.number, activeTicket.name);
        }, 850);
      }
      prevCalledTicketId.current = activeId;
    }
  }, [activeTicket, soundEnabled]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 font-sans" id="display-screen-root">
      {/* HEADER ROW WITH TIME & SOUND ENABLE */}
      <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-black uppercase tracking-tight text-white font-display">
            Öffentliche Anzeigetafel (Wartezimmer-Modus)
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 md:gap-6 text-xs text-zinc-400 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 font-mono">
            <Clock className="w-4 h-4 text-zinc-500" />
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <Calendar className="w-4 h-4 text-zinc-500" />
            {currentTime.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}
          </div>

          <button
            id="toggle-display-audio-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none border-2 text-xs font-black uppercase tracking-tighter cursor-pointer transition-colors ${
              soundEnabled
                ? "bg-zinc-100 border-zinc-100 text-zinc-950 hover:bg-zinc-200"
                : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900"
            }`}
          >
            <Volume2 className="w-4 h-4" />
            {soundEnabled ? "Stimme Ein" : "Stimme Aus"}
          </button>
        </div>
      </div>

      {/* CORE DISPLAY BOARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* BIG PULSING MAIN CALL AREA (LEFT 2 COLS) */}
        <div className="md:col-span-2 bg-zinc-900 border-2 border-zinc-800 rounded-none p-8 flex flex-col items-center justify-center min-h-[400px] shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)] relative overflow-hidden">
          {activeTicket ? (
            <div className="text-center w-full space-y-6 z-10">
              <span className="text-[10px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-none uppercase animate-pulse inline-flex items-center gap-1.5">
                <Bell className="w-4 h-4" />
                Aktueller Aufruf
              </span>

              <div className="py-2">
                <h1 className="text-[8rem] md:text-[10rem] font-black font-display text-white leading-none tracking-tighter filter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-glow inline-block px-10 py-4 rounded-none bg-zinc-950 border-4 border-zinc-100 italic uppercase">
                  #{activeTicket.number}
                </h1>
              </div>

              <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase tracking-tight text-zinc-100">
                  {activeTicket.name}
                </h2>
                <p className="text-xs text-zinc-400 uppercase tracking-widest font-black italic">
                  Anliegen: {activeTicket.matter || "Beratung"}
                </p>
              </div>

              <div className="pt-6 border-t-2 border-zinc-850 max-w-sm mx-auto flex items-center justify-center gap-2 text-xs text-emerald-400 font-black uppercase tracking-widest">
                <span>Bitte zum Schalter begeben</span>
                <ArrowRight className="w-4 h-4 animate-bounce-x" />
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-none bg-zinc-950 flex items-center justify-center mx-auto border-2 border-zinc-800 text-zinc-600">
                <Monitor className="w-8 h-8" />
              </div>
              <p className="text-zinc-400 text-lg font-black uppercase tracking-tight">Bereit für den nächsten Aufruf</p>
              <p className="text-zinc-600 text-xs font-semibold max-w-xs mx-auto uppercase tracking-wider">
                Aktuell wird kein Ticket aufgerufen.
              </p>
            </div>
          )}

          {/* Decorative background styling */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none"></div>
        </div>

        {/* SIDE BAR: UPCOMING & HISTORY (RIGHT 1 COL) */}
        <div className="space-y-6">
          {/* UPCOMING TICKETS LIST */}
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-5 shadow-xl">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 border-b-2 border-zinc-850 pb-2">
              Nächste Nummern
            </h3>

            <div className="space-y-2.5">
              {upcomingTickets.length > 0 ? (
                upcomingTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-none flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black font-display text-emerald-400 italic">
                        #{ticket.number}
                      </span>
                      <div className="text-left">
                        <p className="text-xs font-black uppercase text-zinc-300 truncate max-w-[120px]">
                          {ticket.name}
                        </p>
                        <p className="text-[9px] font-semibold uppercase text-zinc-500 truncate max-w-[120px]">
                          {ticket.matter || "Beratung"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-none font-bold uppercase tracking-wider">
                      In Kürze
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 py-4 text-center">Warteschlange leer</p>
              )}
            </div>
          </div>

          {/* HISTORY BOARD */}
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-5 shadow-xl">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 border-b-2 border-zinc-850 pb-2">
              Letzte Aufrufe
            </h3>

            <div className="space-y-2.5">
              {historyTickets.length > 0 ? (
                historyTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between text-xs py-2 border-b border-zinc-800/40 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <strong className="font-display font-black text-zinc-300 italic">#{ticket.number}</strong>
                      <span className="text-zinc-400 font-semibold uppercase text-[10px] truncate max-w-[100px]">{ticket.name}</span>
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      ticket.status === "completed" ? "bg-zinc-800 text-zinc-500" : "bg-rose-500/10 text-rose-400"
                    }`}>
                      {ticket.status === "completed" ? "Erledigt" : "Überspr."}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 py-4 text-center font-mono">Keine Historie</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
