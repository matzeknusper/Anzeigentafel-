import React, { useState } from "react";
import { QueueTicket, QueueSettings, QueueState } from "../types";
import {
  Settings,
  Users,
  Clock,
  Volume2,
  Trash2,
  UserPlus,
  Play,
  Check,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  Lock,
  LogOut,
  Calendar,
  AlertTriangle,
  UserCheck
} from "lucide-react";

interface AdminViewProps {
  tickets: QueueTicket[];
  settings: QueueSettings;
  onUpdateSettings: (newSettings: Partial<QueueSettings>) => Promise<void>;
  onCallTicket: (id: string) => Promise<void>;
  onCompleteTicket: (id: string) => Promise<void>;
  onSkipTicket: (id: string) => Promise<void>;
  onDeleteTicket: (id: string) => Promise<void>;
  onAddTicket: (name: string, matter: string, isReal: boolean, priority: number) => Promise<void>;
  onReorderTickets: (ticketIds: string[]) => Promise<void>;
  onResetQueue: () => Promise<void>;
}

export default function AdminView({
  tickets,
  settings,
  onUpdateSettings,
  onCallTicket,
  onCompleteTicket,
  onSkipTicket,
  onDeleteTicket,
  onAddTicket,
  onReorderTickets,
  onResetQueue,
}: AdminViewProps) {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("admin_session_token");
  });
  const [loginError, setLoginError] = useState<string | null>(null);

  // Settings form states
  const [simEnabled, setSimEnabled] = useState(settings.simulationEnabled);
  const [simInterval, setSimInterval] = useState(settings.simulationInterval);
  const [peakEnabled, setPeakEnabled] = useState(settings.peakSimulationEnabled);
  const [peakRate, setPeakRate] = useState(settings.peakSimulationRate);
  const [avgServiceTime, setAvgServiceTime] = useState(settings.averageServiceTime);
  const [newPassword, setNewPassword] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Add Ticket states
  const [addName, setAddName] = useState("");
  const [addMatter, setAddMatter] = useState("");
  const [addIsReal, setAddIsReal] = useState(true);
  const [addPriority, setAddPriority] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  // Loading indicator for async operations
  const [isLoading, setIsLoading] = useState(false);

  // 1. LOGIN SUBMIT
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem("admin_session_token", data.token);
        setPassword("");
        
        // Load initial state variables from props
        setSimEnabled(settings.simulationEnabled);
        setSimInterval(settings.simulationInterval);
        setPeakEnabled(settings.peakSimulationEnabled);
        setPeakRate(settings.peakSimulationRate);
        setAvgServiceTime(settings.averageServiceTime);
      } else {
        const data = await response.json();
        setLoginError(data.error || "Falsches Passwort.");
      }
    } catch (err) {
      setLoginError("Netzwerkfehler beim Anmelden.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. LOGOUT
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("admin_session_token");
  };

  // 3. UPDATE SETTINGS
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess(false);
    setIsLoading(true);

    try {
      const updates: Partial<QueueSettings> = {
        simulationEnabled: simEnabled,
        simulationInterval: Number(simInterval),
        peakSimulationEnabled: peakEnabled,
        peakSimulationRate: Number(peakRate),
        averageServiceTime: Number(avgServiceTime),
      };

      if (newPassword.trim()) {
        updates.adminPasswordHash = newPassword.trim();
      }

      await onUpdateSettings(updates);
      setSettingsSuccess(true);
      setNewPassword("");
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      alert("Fehler beim Speichern der Einstellungen.");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. ADD CUSTOM TICKET
  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;

    setAddError(null);
    setAddSuccess(false);
    setIsLoading(true);

    try {
      await onAddTicket(addName.trim(), addMatter.trim(), addIsReal, Number(addPriority));
      setAddSuccess(true);
      setAddName("");
      setAddMatter("");
      setAddIsReal(true);
      setAddPriority(0);
      setTimeout(() => setAddSuccess(false), 3000);
    } catch (err: any) {
      setAddError(err.message || "Fehler beim Hinzufügen des Tickets.");
    } finally {
      setIsLoading(false);
    }
  };

  // 5. REORDER / SHIFT TICKETS
  const handleShiftTicket = async (index: number, direction: "up" | "down") => {
    const sortedWaiting = tickets
      .filter((t) => t.status === "waiting")
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sortedWaiting.length - 1) return;

    const newWaitingList = [...sortedWaiting];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    
    // Swap items
    const temp = newWaitingList[index];
    newWaitingList[index] = newWaitingList[targetIdx];
    newWaitingList[targetIdx] = temp;

    setIsLoading(true);
    try {
      const ids = newWaitingList.map((t) => t.id);
      await onReorderTickets(ids);
    } catch (err) {
      console.error("Reorder failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 6. RESET QUEUE
  const handleReset = async () => {
    if (!confirm("🚨 SIND SIE SICHER? Dies löscht alle aktuellen Tickets und setzt die Warteschlange komplett zurück!")) {
      return;
    }
    
    setIsLoading(true);
    try {
      await onResetQueue();
    } catch (err) {
      alert("Fehler beim Zurücksetzen.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter lists of tickets
  const activeTicket = tickets.find((t) => t.status === "calling");
  
  const waitingTickets = tickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const completedCount = tickets.filter((t) => t.status === "completed").length;
  const skippedCount = tickets.filter((t) => t.status === "skipped").length;
  const realCount = tickets.filter((t) => t.isReal && (t.status === "waiting" || t.status === "calling")).length;
  const simCount = tickets.filter((t) => !t.isReal && (t.status === "waiting" || t.status === "calling")).length;

  if (!token) {
    /* LOGIN FORM VIEW */
    return (
      <div className="w-full max-w-md mx-auto font-sans" id="admin-login-container">
        <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-emerald-500/10 text-emerald-400 mb-3 border-2 border-emerald-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white">Administrations-Bereich</h2>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1.5 font-bold">
              Bitte mit dem Administrator-Passwort anmelden.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-password-field" className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-2">
                Passwort
              </label>
              <input
                id="admin-password-field"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Standard: admin123"
                disabled={isLoading}
                className="w-full bg-zinc-950 border-2 border-zinc-850 focus:border-white text-white rounded-none px-4 py-3 text-sm focus:outline-none transition-all text-center tracking-widest"
              />
            </div>

            {loginError && (
              <div className="bg-rose-500/10 border-2 border-rose-500/20 text-rose-400 rounded-none p-3 text-xs text-center font-bold uppercase tracking-wider">
                {loginError}
              </div>
            )}

            <button
              id="btn-admin-login-submit"
              type="submit"
              disabled={isLoading || !password}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black uppercase tracking-widest rounded-none py-3 text-xs shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Einloggen
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* FULL ADMIN DASHBOARD */
  return (
    <div className="space-y-8 font-sans" id="admin-dashboard-root">
      {/* HEADER LOGOUT ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border-2 border-zinc-800 rounded-none p-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
            Verwaltungsmodus Aktiv (Passwort: <code className="bg-zinc-950 px-2 py-0.5 rounded text-emerald-400 font-mono">admin123</code>)
          </span>
        </div>
        <button
          id="btn-admin-logout"
          onClick={handleLogout}
          className="self-start sm:self-auto text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-rose-400 flex items-center gap-1.5 px-3 py-1.5 hover:bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700 rounded-none transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          Abmelden
        </button>
      </div>

      {/* STATISTICS PANEL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="stats-grid">
        <div className="bg-zinc-900 border-2 border-zinc-800 p-4 rounded-none flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-none shrink-0 border border-emerald-500/10">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Wartend</p>
            <p className="text-2xl font-black font-display text-white mt-0.5">{waitingTickets.length}</p>
          </div>
        </div>

        <div className="bg-zinc-900 border-2 border-zinc-800 p-4 rounded-none flex items-center gap-3">
          <div className="p-3 bg-zinc-800 text-zinc-400 rounded-none shrink-0 border border-zinc-700">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Erledigt</p>
            <p className="text-2xl font-black font-display text-white mt-0.5">{completedCount + skippedCount}</p>
          </div>
        </div>

        <div className="bg-zinc-900 border-2 border-zinc-800 p-4 rounded-none flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-none shrink-0 border border-emerald-500/10">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Echte Kunden</p>
            <p className="text-2xl font-black font-display text-white mt-0.5">{realCount}</p>
          </div>
        </div>

        <div className="bg-zinc-900 border-2 border-zinc-800 p-4 rounded-none flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-none shrink-0 border border-amber-500/10">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Künstliche</p>
            <p className="text-2xl font-black font-display text-white mt-0.5">{simCount}</p>
          </div>
        </div>
      </div>

      {/* CORE QUEUE MANAGEMENT & MAIN ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT 2 COLS: ACTIVE TICKET & WAITING LIST */}
        <div className="lg:col-span-2 space-y-6">
          {/* CURRENT ACTIVE CALL TICKET */}
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-4 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              Aktuell in Bearbeitung
            </h3>

            {activeTicket ? (
              <div className="bg-zinc-950 border-2 border-zinc-850 p-4 rounded-none flex flex-col md:flex-row md:items-center justify-between gap-4 animate-glow">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-black font-display text-emerald-400 italic">
                    #{activeTicket.number}
                  </div>
                  <div>
                    <h4 className="text-base font-black uppercase tracking-tight text-white">{activeTicket.name}</h4>
                    {activeTicket.matter && (
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mt-0.5">{activeTicket.matter}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-none uppercase ${
                        activeTicket.isReal ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {activeTicket.isReal ? "Echt" : "Simulation"}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                        Aufruf: {new Date(activeTicket.calledAt || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-admin-complete"
                    onClick={() => onCompleteTicket(activeTicket.id)}
                    className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-widest py-2 px-4 rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Erledigt
                  </button>
                  <button
                    id="btn-admin-skip"
                    onClick={() => onSkipTicket(activeTicket.id)}
                    className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-widest py-2 px-4 rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Überspringen
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950 border-2 border-zinc-850 border-dashed rounded-none py-8 px-4 text-center text-xs text-zinc-500 font-bold uppercase tracking-wider">
                Aktuell wird kein Ticket bearbeitet. Rufen Sie jemanden auf!
              </div>
            )}
          </div>

          {/* WAITING LIST */}
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-white">Warteschlange</h3>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1 font-bold">
                  Verwalten Sie die Reihenfolge & Priorisierung manuell.
                </p>
              </div>

              {waitingTickets.length > 0 && (
                <button
                  id="btn-admin-call-next"
                  onClick={() => onCallTicket(waitingTickets[0].id)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Nächsten aufrufen
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {waitingTickets.length > 0 ? (
                waitingTickets.map((ticket, index) => (
                  <div
                    key={ticket.id}
                    className="bg-zinc-950 border-2 border-zinc-850 hover:border-zinc-700 p-3.5 rounded-none flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Move Up/Down Priorities */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleShiftTicket(index, "up")}
                          disabled={index === 0}
                          title="Nach oben verschieben"
                          className="p-1 hover:bg-zinc-900 disabled:opacity-30 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleShiftTicket(index, "down")}
                          disabled={index === waitingTickets.length - 1}
                          title="Nach unten verschieben"
                          className="p-1 hover:bg-zinc-900 disabled:opacity-30 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Ticket text & content */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black font-display text-white italic">
                            #{ticket.number}
                          </span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-none uppercase ${
                            ticket.isReal 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/10"
                          }`}>
                            {ticket.isReal ? "Echt" : "Künstlich"}
                          </span>
                          {ticket.priority > 0 && (
                            <span className="text-[8px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded-none uppercase tracking-wide">
                              Prio: {ticket.priority}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-zinc-200 mt-1 truncate uppercase tracking-wide">{ticket.name}</h4>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{ticket.matter || "Kein Anliegen"}</p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onCallTicket(ticket.id)}
                        title="Aufrufen"
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 rounded-none text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                      >
                        Aufrufen
                      </button>
                      <button
                        onClick={() => onDeleteTicket(ticket.id)}
                        title="Löschen"
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-none transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-zinc-950 border-2 border-zinc-850 rounded-none py-12 text-center text-xs text-zinc-500 font-bold uppercase tracking-widest">
                  Warteschlange leer.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 1 COL: CONFIGURATION & SIMULATION CONTROLS */}
        <div className="space-y-6">
          {/* TRAFFIC SIMULATION SETTINGS */}
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-6 shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
              <Settings className="w-4.5 h-4.5 text-emerald-400" />
              Simulations-Optionen
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* 1. Auto Advance (calling next) */}
              <div className="bg-zinc-950 border-2 border-zinc-850 p-3.5 rounded-none space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-300">Automatischer Aufruf</div>
                  <input
                    type="checkbox"
                    checked={simEnabled}
                    onChange={(e) => setSimEnabled(e.target.checked)}
                    className="w-4 h-4 text-emerald-500 border-zinc-800 rounded focus:ring-emerald-500 focus:ring-offset-zinc-900 focus:ring-2"
                  />
                </label>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">
                  Schließt Tickets automatisch ab und ruft nach X Sekunden den Nächsten auf.
                </p>
                {simEnabled && (
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                      Intervall (Sekunden)
                    </label>
                    <input
                      type="number"
                      min="5"
                      value={simInterval}
                      onChange={(e) => setSimInterval(Number(e.target.value))}
                      className="w-full bg-zinc-900 border-2 border-zinc-800 text-white rounded-none px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 2. Peak Simulation (adding simulated tickets) */}
              <div className="bg-zinc-950 border-2 border-zinc-850 p-3.5 rounded-none space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-300">Stoßzeiten simulieren</div>
                  <input
                    type="checkbox"
                    checked={peakEnabled}
                    onChange={(e) => setPeakEnabled(e.target.checked)}
                    className="w-4 h-4 text-emerald-500 border-zinc-800 rounded focus:ring-emerald-500 focus:ring-offset-zinc-900 focus:ring-2"
                  />
                </label>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">
                  Generiert in Stoßzeiten künstliche Kunden (Name & Anliegen), um Betrieb zu simulieren.
                </p>
                {peakEnabled && (
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                      Generieren alle X Sek.
                    </label>
                    <input
                      type="number"
                      min="5"
                      value={peakRate}
                      onChange={(e) => setPeakRate(Number(e.target.value))}
                      className="w-full bg-zinc-900 border-2 border-zinc-800 text-white rounded-none px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 3. Average Service Wait Factor */}
              <div>
                <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">
                  Durchschn. Wartezeit pro Kunde (Min)
                </label>
                <input
                  type="number"
                  min="1"
                  value={avgServiceTime}
                  onChange={(e) => setAvgServiceTime(Number(e.target.value))}
                  className="w-full bg-zinc-950 border-2 border-zinc-850 text-white rounded-none px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              {/* 4. Password Change Option */}
              <div>
                <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">
                  Neues Admin Passwort setzen (optional)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Passwort ändern"
                  className="w-full bg-zinc-950 border-2 border-zinc-850 text-white rounded-none px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              {settingsSuccess && (
                <div className="bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 rounded-none p-2.5 text-[10px] text-center font-bold uppercase tracking-wider">
                  Einstellungen erfolgreich gespeichert!
                </div>
              )}

              <button
                id="btn-admin-save-settings-submit"
                type="submit"
                disabled={isLoading}
                className="w-full bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest rounded-none py-3 px-3 text-xs shadow cursor-pointer transition-all"
              >
                Speichern & Anwenden
              </button>
            </form>
          </div>

          {/* MANUAL TICKET ADD FORM */}
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-6 shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-4.5 h-4.5 text-emerald-400" />
              Kunden manuell hinzufügen
            </h3>

            <form onSubmit={handleAddTicket} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="z.B. Sabine Müller"
                  className="w-full bg-zinc-950 border-2 border-zinc-850 text-white placeholder-zinc-600 rounded-none px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Anliegen</label>
                <input
                  type="text"
                  value={addMatter}
                  onChange={(e) => setAddMatter(e.target.value)}
                  placeholder="z.B. Führerscheinberatung"
                  className="w-full bg-zinc-950 border-2 border-zinc-850 text-white placeholder-zinc-600 rounded-none px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Prio (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={addPriority}
                    onChange={(e) => setAddPriority(Number(e.target.value))}
                    className="w-full bg-zinc-950 border-2 border-zinc-850 text-white rounded-none px-3 py-2 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Kundentyp</label>
                  <select
                    value={addIsReal ? "true" : "false"}
                    onChange={(e) => setAddIsReal(e.target.value === "true")}
                    className="w-full bg-zinc-950 border-2 border-zinc-850 text-white rounded-none px-2 py-2 text-xs focus:outline-none"
                  >
                    <option value="true">Echt</option>
                    <option value="false">Simulation</option>
                  </select>
                </div>
              </div>

              {addSuccess && (
                <div className="bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 rounded-none p-2.5 text-[10px] text-center font-bold uppercase tracking-wider">
                  Kunde erfolgreich eingereiht!
                </div>
              )}

              {addError && (
                <div className="bg-rose-500/10 border-2 border-rose-500/20 text-rose-400 rounded-none p-2.5 text-[10px] text-center font-bold uppercase tracking-wider">
                  {addError}
                </div>
              )}

              <button
                id="btn-admin-add-ticket-submit"
                type="submit"
                disabled={isLoading || !addName.trim()}
                className="w-full bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest rounded-none py-3 px-3 text-xs shadow cursor-pointer transition-all"
              >
                Hinzufügen
              </button>
            </form>
          </div>

          {/* DANGEROUS AREA / RESET */}
          <div className="bg-zinc-900 border-2 border-rose-500/20 rounded-none p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5" />
                Gefahrenbereich
              </h3>
              <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500 mt-1">
                Aktionen können nicht rückgängig gemacht werden.
              </p>
            </div>

            <button
              id="btn-admin-reset-queue"
              onClick={handleReset}
              disabled={isLoading}
              className="w-full bg-rose-500/10 hover:bg-rose-600 hover:text-white border border-rose-500/20 text-rose-400 font-black uppercase tracking-widest rounded-none py-3 px-3 text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Warteschlange zurücksetzen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
