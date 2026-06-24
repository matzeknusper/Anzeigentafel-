import React, { useState, useEffect, useRef } from "react";
import { QueueTicket, QueueSettings } from "../types";
import { Ticket, Users, Clock, LogOut, Bell, BellOff, Volume2, Info } from "lucide-react";
import { playChime, speakCall } from "../utils/audio";

interface CustomerViewProps {
  tickets: QueueTicket[];
  settings: QueueSettings;
  onPullTicket: (name: string, matter: string) => Promise<QueueTicket>;
  onCancelTicket: (ticketId: string) => Promise<void>;
}

export default function CustomerView({
  tickets,
  settings,
  onPullTicket,
  onCancelTicket,
}: CustomerViewProps) {
  const [name, setName] = useState("");
  const [matter, setMatter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [myTicketId, setMyTicketId] = useState<string | null>(() => {
    return localStorage.getItem("my_queue_ticket_id");
  });
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const prevStatusRef = useRef<string | null>(null);

  // Sync state & handle notification callouts
  const myTicket = myTicketId ? tickets.find((t) => t.id === myTicketId) : null;

  useEffect(() => {
    if (!myTicket) return;

    const currentStatus = myTicket.status;
    const prevStatus = prevStatusRef.current;

    // Detect transition to "calling"
    if (currentStatus === "calling" && prevStatus === "waiting") {
      triggerNotificationCallout(myTicket);
    }

    prevStatusRef.current = currentStatus;
  }, [myTicket, tickets]);

  // Handle request for notification permissions
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("Dieses Gerät unterstützt keine Browser-Benachrichtigungen.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      new Notification("Benachrichtigungen aktiv!", {
        body: "Wir informieren Sie, sobald Sie aufgerufen werden.",
        icon: "https://img.icons8.com/color/192/000000/queue.png",
      });
    } else {
      setNotificationsEnabled(false);
      alert("Benachrichtigungen wurden blockiert. Bitte in den Browsereinstellungen aktivieren.");
    }
  };

  const triggerNotificationCallout = (ticket: QueueTicket) => {
    // 1. Browser Notification
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification("Sie sind an der Reihe! 🔔", {
        body: `Ihre Ticketnummer #${ticket.number} (${ticket.name}) wird jetzt aufgerufen.`,
        tag: "queue-call",
        requireInteraction: true,
      });
    }

    // 2. Audio Chime
    if (soundEnabled) {
      playChime();
      // Wait slightly after chime to speak
      setTimeout(() => {
        speakCall(ticket.number, ticket.name);
      }, 800);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const created = await onPullTicket(name, matter);
      setMyTicketId(created.id);
      localStorage.setItem("my_queue_ticket_id", created.id);
      prevStatusRef.current = created.status;
      setName("");
      setMatter("");
      
      // Request notifications on successful drawing
      if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => {
          requestNotificationPermission();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || "Fehler beim Ziehen der Nummer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!myTicketId) return;
    if (!confirm("Möchten Sie die Warteschlange wirklich verlassen und Ihr Ticket stornieren?")) return;

    setIsLoading(true);
    try {
      await onCancelTicket(myTicketId);
      localStorage.removeItem("my_queue_ticket_id");
      setMyTicketId(null);
      prevStatusRef.current = null;
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetTicket = () => {
    // If ticket was completed or skipped, just clear from local view
    localStorage.removeItem("my_queue_ticket_id");
    setMyTicketId(null);
    prevStatusRef.current = null;
  };

  // Helper Calculations
  const currentlyCalling = tickets.find((t) => t.status === "calling");

  // Sorted waiting queue
  const sortedWaiting = tickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Position of customer's ticket in the queue (0-indexed)
  let peopleAhead = 0;
  if (myTicket && myTicket.status === "waiting") {
    const idx = sortedWaiting.findIndex((t) => t.id === myTicketId);
    peopleAhead = idx !== -1 ? idx : 0;
  }

  // Estimated wait time (minutes)
  const estimatedWait = myTicket && myTicket.status === "waiting"
    ? (peopleAhead + 1) * settings.averageServiceTime
    : 0;

  return (
    <div className="w-full max-w-lg mx-auto font-sans" id="customer-view-container">
      {!myTicketId || !myTicket ? (
        /* DRAW TICKET VIEW */
        <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-emerald-500/10 text-emerald-400 mb-4 border-2 border-emerald-500/20">
              <Ticket className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic text-white">
              Wartenummer ziehen
            </h2>
            <p className="text-zinc-400 text-xs uppercase tracking-widest mt-2 font-bold">
              Tragen Sie Ihren Namen & Grund der Störung ein, um sich hinten anzustellen.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="customer-name" className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-2">
                Ihr Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="customer-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. SABINE AUS DER BUCHHALTUNG"
                disabled={isLoading}
                className="w-full bg-zinc-950 border-2 border-zinc-850 focus:border-white text-white placeholder-zinc-600 rounded-none px-4 py-3 text-sm focus:outline-none transition-all"
              />
            </div>

            <div>
              <label htmlFor="customer-matter" className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-2">
                Ihr Anliegen / Grund der Störung
              </label>
              <input
                id="customer-matter"
                type="text"
                value={matter}
                onChange={(e) => setMatter(e.target.value)}
                placeholder="z.B. Kaffee-Lieferung, 'Hast du mal 2 Minuten?'"
                disabled={isLoading}
                className="w-full bg-zinc-950 border-2 border-zinc-850 focus:border-white text-white placeholder-zinc-600 rounded-none px-4 py-3 text-sm focus:outline-none transition-all"
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 border-2 border-rose-500/20 text-rose-400 rounded-none p-3 text-xs font-bold uppercase tracking-wider">
                {error}
              </div>
            )}

            <button
              id="btn-pull-ticket"
              type="submit"
              disabled={isLoading || !name.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black uppercase tracking-tighter rounded-none py-4 px-4 text-sm shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[0px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  <Ticket className="w-5 h-5" />
                  Ticket ziehen & anstellen
                </>
              )}
            </button>
          </form>

          {/* Current Status Board Hint */}
          <div className="mt-8 pt-6 border-t-2 border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-zinc-500" />
              Aktuell wartend: <strong className="text-zinc-100 font-black text-xs">{sortedWaiting.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-zinc-500" />
              Aktuell aufgerufen:{" "}
              <strong className="text-emerald-400 font-mono font-black text-xs">
                {currentlyCalling ? `#${currentlyCalling.number}` : "Keine"}
              </strong>
            </span>
          </div>
        </div>
      ) : (
        /* MY ACTIVE TICKET VIEW */
        <div className="space-y-6">
          {/* TICKET DETAILS BOX */}
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-none p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)] relative overflow-hidden">
            {myTicket.status === "calling" ? (
              <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500 animate-pulse"></div>
            ) : (
              <div className="absolute top-0 left-0 w-full h-1.5 bg-zinc-400"></div>
            )}

            {/* Quick Control Bar inside Ticket */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-none border border-emerald-500/20">
                Ihr Digitales Ticket
              </span>
              <div className="flex items-center gap-2">
                {/* Audio voice synthesizer callout control */}
                <button
                  id="toggle-sound-btn"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Sprachausgabe stummschalten" : "Sprachausgabe aktivieren"}
                  className={`p-2 rounded-none border-2 text-xs transition-colors flex items-center justify-center cursor-pointer ${
                    soundEnabled
                      ? "bg-zinc-100 border-zinc-100 text-zinc-950 hover:bg-zinc-200"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900"
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                {/* Notifications setup button */}
                <button
                  id="toggle-notifications-btn"
                  onClick={requestNotificationPermission}
                  title={notificationsEnabled ? "Benachrichtigungen sind aktiv" : "Benachrichtigungen aktivieren"}
                  className={`p-2 rounded-none border-2 text-xs transition-colors flex items-center justify-center cursor-pointer ${
                    notificationsEnabled
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900"
                  }`}
                >
                  {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Main numbers display */}
            <div className="text-center py-6 border-b-2 border-zinc-850">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ihre Ticketnummer</p>
              <h1 className="text-7xl md:text-8xl font-black font-display text-white mt-2 tracking-tighter">
                #{myTicket.number}
              </h1>
              <p className="text-xl font-black text-zinc-100 uppercase tracking-tight mt-2">
                {myTicket.name}
              </p>
              {myTicket.matter && (
                <p className="text-xs text-zinc-500 italic mt-1 uppercase tracking-wider font-semibold">
                  Grund: {myTicket.matter}
                </p>
              )}
            </div>

            {/* STATUS DISPLAY DECISION */}
            {myTicket.status === "waiting" && (
              <div className="py-6 space-y-6">
                {/* Statistics Bento Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950 border-2 border-zinc-850 p-4 rounded-none text-center">
                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">
                      Kollegen vor Ihnen
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-white">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="text-2xl font-black font-display">{peopleAhead}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-950 border-2 border-zinc-850 p-4 rounded-none text-center">
                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">
                      Wartezeit ca.
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-white">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-2xl font-black font-display">{estimatedWait} Min</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-950 border-2 border-zinc-850 p-4 rounded-none flex items-center gap-3">
                  <div className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </div>
                  <div className="text-left text-xs leading-normal">
                    <p className="text-zinc-200 font-bold uppercase tracking-tight">Bitte belästigen Sie Matze erst beim Aufruf.</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5 uppercase tracking-wide font-semibold">Die Anzeige aktualisiert sich automatisch in Echtzeit.</p>
                  </div>
                </div>
              </div>
            )}

            {myTicket.status === "calling" && (
              <div className="py-6 space-y-5">
                <div className="bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 rounded-none p-5 text-center animate-glow">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-emerald-500/20 text-emerald-400 mb-3 animate-bounce">
                    <Bell className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Sie werden aufgerufen!</h3>
                  <p className="text-xs uppercase tracking-wider text-emerald-300 font-bold mt-2">
                    Bitte begeben Sie sich unverzüglich zum Schalter / Mitarbeiter-Bereich.
                  </p>
                </div>
                
                <button
                  id="test-chime-voice-btn"
                  onClick={() => triggerNotificationCallout(myTicket)}
                  className="w-full bg-zinc-950 border-2 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900 text-xs py-3 px-3 rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-bold uppercase tracking-widest"
                >
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  Durchsage erneut abspielen
                </button>
              </div>
            )}

            {myTicket.status === "completed" && (
              <div className="py-6 space-y-4">
                <div className="bg-zinc-950 border-2 border-zinc-850 rounded-none p-5 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-emerald-500/10 text-emerald-400 mb-3">
                    <Info className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">Besuch beendet</h3>
                  <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-bold">
                    Ihr Ticket wurde erfolgreich bearbeitet. Vielen Dank!
                  </p>
                </div>

                <button
                  id="btn-new-ticket"
                  onClick={handleResetTicket}
                  className="w-full bg-white text-black hover:bg-zinc-200 font-black rounded-none py-3.5 text-xs uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Neues Ticket ziehen
                </button>
              </div>
            )}

            {myTicket.status === "skipped" && (
              <div className="py-6 space-y-4">
                <div className="bg-zinc-950 border-2 border-zinc-850 rounded-none p-5 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-rose-500/10 text-rose-400 mb-3">
                    <LogOut className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">Übersprungen</h3>
                  <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-bold">
                    Sie waren beim Aufruf leider nicht anwesend. Ihr Ticket wurde übersprungen.
                  </p>
                </div>

                <button
                  id="btn-retry-ticket"
                  onClick={handleResetTicket}
                  className="w-full bg-white text-black hover:bg-zinc-200 font-black rounded-none py-3.5 text-xs uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Neues Ticket ziehen
                </button>
              </div>
            )}

            {/* Active board progress & calling footer info */}
            <div className="border-t-2 border-zinc-850 pt-5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-500" />
                Aktuell: <strong className="text-emerald-400 font-mono text-xs">{currentlyCalling ? `#${currentlyCalling.number}` : "Keine"}</strong>
              </span>

              {/* Only show cancellation if waiting or calling */}
              {(myTicket.status === "waiting" || myTicket.status === "calling") && (
                <button
                  id="btn-cancel-ticket"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="text-rose-400 hover:text-rose-300 font-black uppercase tracking-widest flex items-center gap-1 py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 rounded-none transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Stornieren
                </button>
              )}
            </div>
          </div>

          {/* HELPFUL INFORMATION BLOCK FOR PWA */}
          <div className="bg-zinc-900/50 border-2 border-zinc-800/50 rounded-none p-4 flex gap-3 text-xs text-zinc-400 leading-normal">
            <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-zinc-300 uppercase tracking-wider text-[10px]">💡 Progressive Web App (PWA)</p>
              <p className="mt-1 font-semibold text-zinc-500">
                Sie können diese Seite auf Ihrem Smartphone zum Startbildschirm hinzufügen. So verhält sie sich wie eine native App und Sie können bequem auf Ihr Ticket zugreifen.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
