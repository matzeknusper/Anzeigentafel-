/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { QueueTicket, QueueSettings } from "./types";
import CustomerView from "./components/CustomerView";
import AdminView from "./components/AdminView";
import DisplayScreen from "./components/DisplayScreen";
import { Ticket, Monitor, Settings, Users, ArrowUpRight } from "lucide-react";

export default function App() {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [activeTab, setActiveTab] = useState<"customer" | "display" | "admin">("customer");
  const [error, setError] = useState<string | null>(null);

  // Poll server state every 2 seconds for real-time synchronization
  useEffect(() => {
    async function fetchState() {
      try {
        const response = await fetch("/api/queue");
        if (response.ok) {
          const data = await response.json();
          setTickets(data.tickets);
          setSettings(data.settings);
          setError(null);
        } else {
          setError("Fehler beim Laden der Warteschlangen-Daten.");
        }
      } catch (err) {
        setError("Verbindung zum Server unterbrochen. Synchronisierung fehlgeschlagen.");
      }
    }

    fetchState(); // Initial fetch
    const timer = setInterval(fetchState, 2000);
    return () => clearInterval(timer);
  }, []);

  // --- API OPERATIONS ---

  // Helper to fetch with admin auth header automatically injected
  const fetchWithAdminAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("admin_session_token") || "";
    const headers = {
      "Content-Type": "application/json",
      Authorization: token,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("admin_session_token");
        throw new Error("Nicht autorisiert. Bitte melden Sie sich erneut an.");
      }
      const data = await response.json();
      throw new Error(data.error || "Aktion fehlgeschlagen.");
    }

    return response.json();
  };

  // 1. Customer: Pull a new ticket
  const handlePullTicket = async (name: string, matter: string): Promise<QueueTicket> => {
    const response = await fetch("/api/queue/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, matter }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Fehler beim Erstellen des Tickets.");
    }

    const newTicket = await response.json();
    // Update local state immediately for snappy response
    setTickets((prev) => [...prev, newTicket]);
    return newTicket;
  };

  // 2. Customer: Cancel/Stornieren ticket
  const handleCancelTicket = async (ticketId: string): Promise<void> => {
    const response = await fetch("/api/queue/ticket/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticketId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Fehler beim Stornieren des Tickets.");
    }

    // Update local state
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  };

  // 3. Admin: Update Settings
  const handleUpdateSettings = async (newSettings: Partial<QueueSettings>): Promise<void> => {
    const data = await fetchWithAdminAuth("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(newSettings),
    });
    setSettings(data.settings);
  };

  // 4. Admin: Call / activate a ticket
  const handleCallTicket = async (id: string): Promise<void> => {
    await fetchWithAdminAuth("/api/admin/ticket/call", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  };

  // 5. Admin: Complete a ticket
  const handleCompleteTicket = async (id: string): Promise<void> => {
    await fetchWithAdminAuth("/api/admin/ticket/complete", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  };

  // 6. Admin: Skip a ticket
  const handleSkipTicket = async (id: string): Promise<void> => {
    await fetchWithAdminAuth("/api/admin/ticket/skip", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  };

  // 7. Admin: Delete a ticket manually
  const handleDeleteTicket = async (id: string): Promise<void> => {
    await fetchWithAdminAuth("/api/admin/ticket/delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  };

  // 8. Admin: Add a ticket manually
  const handleAddTicket = async (
    name: string,
    matter: string,
    isReal: boolean,
    priority: number
  ): Promise<void> => {
    await fetchWithAdminAuth("/api/admin/ticket/add", {
      method: "POST",
      body: JSON.stringify({ name, matter, isReal, priority }),
    });
  };

  // 9. Admin: Reorder tickets (Save order of waiting tickets)
  const handleReorderTickets = async (ticketIds: string[]): Promise<void> => {
    await fetchWithAdminAuth("/api/admin/ticket/reorder", {
      method: "POST",
      body: JSON.stringify({ ticketIds }),
    });
  };

  // 10. Admin: Reset the entire queue
  const handleResetQueue = async (): Promise<void> => {
    const data = await fetchWithAdminAuth("/api/admin/reset", {
      method: "POST",
    });
    setTickets(data.tickets);
    setSettings(data.settings);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* GLOBAL STATUS ERROR BAR */}
      {error && (
        <div className="bg-orange-600 text-white text-xs py-2 px-4 text-center font-bold animate-pulse shrink-0 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          {error}
        </div>
      )}

      {/* TOP NAVIGATION / BRAND HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo Title */}
          <div className="flex flex-col text-center md:text-left">
            <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-black mb-1 animate-pulse">
              BÜRO-SCHUTZSCHILD & ABWEHRSYSTEM
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none italic uppercase text-white flex items-center justify-center md:justify-start gap-2">
              MATZE.GUARD <span className="text-xs font-mono font-normal tracking-widest text-emerald-400 normal-case not-italic bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">v1.0</span>
            </h1>
          </div>

          {/* Core Navigation Selector Tabs */}
          <nav className="flex items-center bg-zinc-900 p-1.5 rounded-xl border border-zinc-800" id="tab-navigation">
            <button
              id="tab-btn-customer"
              onClick={() => setActiveTab("customer")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-tighter rounded-lg transition-all cursor-pointer ${
                activeTab === "customer"
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Ticket className="w-4 h-4" />
              Kunden-Bereich
            </button>
            <button
              id="tab-btn-display"
              onClick={() => setActiveTab("display")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-tighter rounded-lg transition-all cursor-pointer ${
                activeTab === "display"
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Monitor className="w-4 h-4" />
              Anzeigetafel
            </button>
            <button
              id="tab-btn-admin"
              onClick={() => setActiveTab("admin")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-tighter rounded-lg transition-all cursor-pointer ${
                activeTab === "admin"
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Settings className="w-4 h-4" />
              Verwaltung
            </button>
          </nav>
        </div>
      </header>

      {/* CORE VIEWPORT CAROUSEL / SWITCHER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        {settings ? (
          <div className="w-full">
            {activeTab === "customer" && (
              <CustomerView
                tickets={tickets}
                settings={settings}
                onPullTicket={handlePullTicket}
                onCancelTicket={handleCancelTicket}
              />
            )}

            {activeTab === "display" && (
              <DisplayScreen tickets={tickets} />
            )}

            {activeTab === "admin" && (
              <AdminView
                tickets={tickets}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onCallTicket={handleCallTicket}
                onCompleteTicket={handleCompleteTicket}
                onSkipTicket={handleSkipTicket}
                onDeleteTicket={handleDeleteTicket}
                onAddTicket={handleAddTicket}
                onReorderTickets={handleReorderTickets}
                onResetQueue={handleResetQueue}
              />
            )}
          </div>
        ) : (
          /* FULL-SCREEN INITIAL LOAD PLACEHOLDER */
          <div className="text-center py-12 space-y-4">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-zinc-100 rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
              Live-Verbindung wird aufgebaut...
            </p>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-6 text-center text-[10px] uppercase tracking-widest text-zinc-500 shrink-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 MATZE.GUARD Systems. Das ultimative Büro-Schild.</p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 flex items-center gap-1 transition-colors font-bold"
            >
              GitHub Ready <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
