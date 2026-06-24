import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { QueueState, QueueTicket, QueueSettings } from "./src/types";

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "queue_data.json");

// Helper to generate a random ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Simulated German names and concerns
const PRESET_NAMES = [
  "Uli (Hat 'nur eine kurze Frage')", "Sabine aus der Buchhaltung", "Der Outlook-Verzweifler", 
  "Praktikant auf Koffein", "Chef-Anruf (Wichtigtuer)", "Uwe vom Betriebsrat", 
  "Klaus (Der Drucker blockiert)", "Marketing-Melanie", "Der Agile Scrum Master", 
  "Die Kaffeemaschine (Defekt)", "HR-Heike", "Der anonyme Keks-Dieb",
  "Jürgen (IT-Support, fragt nach Neustart)", "Vertriebs-Vincent", "Sarah vom Empfang"
];

const PRESET_MATTERS = [
  "Hast du mal ganz kurz 2 Minuten?", "Kannst du mir kurz bei Excel helfen?", 
  "Der Drucker brennt schon wieder", "Lästern über den neuen Meeting-Marathon", 
  "Kaffee-Pause erzwingen", "Ich hab nichts gemacht, aber es geht nicht mehr", 
  "Einladung zu einem unproduktiven Blocker-Meeting", "Suche nach Keksen oder Nervennahrung", 
  "Mein Outlook lädt seit einer Stunde", "Wann machen wir heute Feierabend-Bier?", 
  "Hab dir gerade eine E-Mail geschickt, liest du sie kurz?", "Unaufschiebbarer Büro-Klatsch",
  "Frage, die man in 5 Sekunden hätte googeln können"
];

// Initial default settings
const DEFAULT_SETTINGS: QueueSettings = {
  simulationEnabled: true,
  simulationInterval: 60, // seconds
  peakSimulationEnabled: false,
  peakSimulationRate: 20, // seconds
  currentNumber: 100,     // start numbers at 100
  adminPasswordHash: "admin123", // plain text for simple comparison or override
  averageServiceTime: 5,  // average 5 minutes per customer
};

// Queue state in memory
let queueState: QueueState = {
  tickets: [],
  settings: DEFAULT_SETTINGS,
};

// Load state from file if exists
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const rawData = fs.readFileSync(DATA_FILE, "utf-8");
      queueState = JSON.parse(rawData);
      console.log("Queue state loaded successfully from JSON file.");
    } else {
      // Seed some starting tickets if starting fresh to look nice
      seedInitialQueue();
      saveState();
    }
  } catch (err) {
    console.error("Error loading queue state, using defaults:", err);
    seedInitialQueue();
  }
}

// Save state to file
function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(queueState, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving queue state:", err);
  }
}

// Seed queue with simulated customers
function seedInitialQueue() {
  queueState.settings = { ...DEFAULT_SETTINGS };
  queueState.tickets = [];
  
  // Let's create some initial waiting tickets
  const count = 5;
  let num = queueState.settings.currentNumber;
  
  // Set current calling ticket
  num++;
  const activeTicket: QueueTicket = {
    id: generateId(),
    number: num,
    name: "Uli (Hat 'nur eine kurze Frage')",
    matter: "Hast du mal ganz kurz 2 Minuten?",
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    completedAt: null,
    status: "calling",
    isReal: false,
    priority: 0,
  };
  queueState.tickets.push(activeTicket);

  for (let i = 0; i < count; i++) {
    num++;
    const name = PRESET_NAMES[i % PRESET_NAMES.length];
    const matter = PRESET_MATTERS[i % PRESET_MATTERS.length];
    
    const ticket: QueueTicket = {
      id: generateId(),
      number: num,
      name,
      matter,
      createdAt: new Date(Date.now() - (count - i) * 3 * 60 * 1000).toISOString(),
      calledAt: null,
      completedAt: null,
      status: "waiting",
      isReal: false,
      priority: 0,
    };
    queueState.tickets.push(ticket);
  }
  
  queueState.settings.currentNumber = num;
}

// Simulation logic runs periodically
let autoAdvanceTimer: NodeJS.Timeout | null = null;
let peakSimulationTimer: NodeJS.Timeout | null = null;

function setupSimulationTimers() {
  // Clear any existing timers
  if (autoAdvanceTimer) clearInterval(autoAdvanceTimer);
  if (peakSimulationTimer) clearInterval(peakSimulationTimer);

  // 1. Auto Advance (Calling next customer)
  if (queueState.settings.simulationEnabled) {
    const intervalMs = queueState.settings.simulationInterval * 1000;
    autoAdvanceTimer = setInterval(() => {
      autoAdvanceQueue();
    }, intervalMs);
  }

  // 2. Peak Simulation (Adding simulated customers to extend wait times / simulate traffic)
  if (queueState.settings.peakSimulationEnabled) {
    const rateMs = queueState.settings.peakSimulationRate * 1000;
    peakSimulationTimer = setInterval(() => {
      addSimulatedCustomer();
    }, rateMs);
  }
}

// Function to automatically advance the queue
function autoAdvanceQueue() {
  let changed = false;

  // Find currently calling tickets and complete them
  queueState.tickets.forEach(ticket => {
    if (ticket.status === "calling") {
      ticket.status = "completed";
      ticket.completedAt = new Date().toISOString();
      changed = true;
    }
  });

  // Call the next waiting ticket
  // Sorted by: higher priority first, then older createdAt
  const nextTicket = getSortedWaitingTickets()[0];
  if (nextTicket) {
    const ticketInState = queueState.tickets.find(t => t.id === nextTicket.id);
    if (ticketInState) {
      ticketInState.status = "calling";
      ticketInState.calledAt = new Date().toISOString();
      changed = true;
      console.log(`Auto-Advance: Called ticket #${ticketInState.number} (${ticketInState.name})`);
    }
  }

  if (changed) {
    saveState();
  }
}

// Function to add a simulated customer to künstlich verlängern the queue
function addSimulatedCustomer() {
  // Limit total waiting tickets to prevent running out of hand
  const waitingCount = queueState.tickets.filter(t => t.status === "waiting").length;
  if (waitingCount >= 25) return;

  const randomName = PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)];
  const randomMatter = PRESET_MATTERS[Math.floor(Math.random() * PRESET_MATTERS.length)];
  
  queueState.settings.currentNumber++;
  const ticket: QueueTicket = {
    id: generateId(),
    number: queueState.settings.currentNumber,
    name: randomName,
    matter: randomMatter,
    createdAt: new Date().toISOString(),
    calledAt: null,
    completedAt: null,
    status: "waiting",
    isReal: false,
    priority: 0,
  };

  queueState.tickets.push(ticket);
  saveState();
  console.log(`Simulated customer added: #${ticket.number} (${ticket.name})`);
}

// Helper to get sorted waiting tickets
function getSortedWaitingTickets(): QueueTicket[] {
  return queueState.tickets
    .filter(t => t.status === "waiting")
    .sort((a, b) => {
      // 1. Higher priority first
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // 2. Older createdAt first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

// Initialize state and timers on startup
loadState();
setupSimulationTimers();

app.use(express.json());

// --- API Endpoints ---

// Middleware to verify Admin Authorization
function checkAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Kein Passwort angegeben" });
  }

  // Simple string comparison for admin password
  if (authHeader !== queueState.settings.adminPasswordHash) {
    return res.status(401).json({ error: "Ungültiges Passwort" });
  }
  next();
}

// 1. Public endpoint to fetch full queue state (excluding sensitive password hash)
app.get("/api/queue", (req, res) => {
  const sanitizedSettings = { ...queueState.settings };
  // @ts-ignore
  delete sanitizedSettings.adminPasswordHash; // Strip password hash for safety

  res.json({
    tickets: queueState.tickets,
    settings: sanitizedSettings,
  });
});

// 2. Public endpoint to pull a new ticket (customer side)
app.post("/api/queue/ticket", (req, res) => {
  const { name, matter } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Bitte geben Sie einen Namen an." });
  }

  queueState.settings.currentNumber++;
  const newTicket: QueueTicket = {
    id: generateId(),
    number: queueState.settings.currentNumber,
    name: name.trim(),
    matter: (matter || "Keine Angabe").trim(),
    createdAt: new Date().toISOString(),
    calledAt: null,
    completedAt: null,
    status: "waiting",
    isReal: true, // This is a real user!
    priority: 0,  // starts at normal priority
  };

  queueState.tickets.push(newTicket);
  saveState();

  console.log(`Real customer pulled ticket: #${newTicket.number} (${newTicket.name})`);
  res.json(newTicket);
});

// 2.5. Public endpoint to cancel/delete a ticket (customer side)
app.post("/api/queue/ticket/cancel", (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Ticket-ID fehlt" });
  }

  const index = queueState.tickets.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Ticket nicht gefunden" });
  }

  // Real customer can cancel their own waiting ticket
  queueState.tickets.splice(index, 1);
  saveState();

  console.log(`Customer canceled ticket ID: ${id}`);
  res.json({ success: true });
});

// 3. Admin login endpoint to verify password
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Passwort fehlt" });
  }

  if (password === queueState.settings.adminPasswordHash) {
    res.json({ success: true, token: password });
  } else {
    res.status(401).json({ error: "Falsches Admin-Passwort!" });
  }
});

// 4. Admin endpoints (All protected by checkAdminAuth)

// Update Settings
app.post("/api/admin/settings", checkAdminAuth, (req, res) => {
  const { simulationEnabled, simulationInterval, peakSimulationEnabled, peakSimulationRate, averageServiceTime, adminPasswordHash } = req.body;

  if (simulationEnabled !== undefined) queueState.settings.simulationEnabled = !!simulationEnabled;
  if (simulationInterval !== undefined && simulationInterval > 0) queueState.settings.simulationInterval = Number(simulationInterval);
  if (peakSimulationEnabled !== undefined) queueState.settings.peakSimulationEnabled = !!peakSimulationEnabled;
  if (peakSimulationRate !== undefined && peakSimulationRate > 0) queueState.settings.peakSimulationRate = Number(peakSimulationRate);
  if (averageServiceTime !== undefined && averageServiceTime > 0) queueState.settings.averageServiceTime = Number(averageServiceTime);
  
  if (adminPasswordHash && adminPasswordHash.trim().length >= 3) {
    queueState.settings.adminPasswordHash = adminPasswordHash.trim();
  }

  saveState();
  setupSimulationTimers(); // Recalculate intervals and timers

  res.json({ success: true, settings: queueState.settings });
});

// Call/Activate a ticket manually
app.post("/api/admin/ticket/call", checkAdminAuth, (req, res) => {
  const { id } = req.body;
  const ticket = queueState.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket nicht gefunden" });
  }

  // Set any currently calling tickets to completed
  queueState.tickets.forEach(t => {
    if (t.status === "calling") {
      t.status = "completed";
      t.completedAt = new Date().toISOString();
    }
  });

  ticket.status = "calling";
  ticket.calledAt = new Date().toISOString();
  saveState();

  res.json({ success: true, ticket });
});

// Complete a ticket manually
app.post("/api/admin/ticket/complete", checkAdminAuth, (req, res) => {
  const { id } = req.body;
  const ticket = queueState.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket nicht gefunden" });
  }

  ticket.status = "completed";
  ticket.completedAt = new Date().toISOString();
  saveState();

  res.json({ success: true, ticket });
});

// Skip a ticket manually
app.post("/api/admin/ticket/skip", checkAdminAuth, (req, res) => {
  const { id } = req.body;
  const ticket = queueState.tickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket nicht gefunden" });
  }

  ticket.status = "skipped";
  ticket.completedAt = new Date().toISOString();
  saveState();

  res.json({ success: true, ticket });
});

// Delete a ticket manually
app.post("/api/admin/ticket/delete", checkAdminAuth, (req, res) => {
  const { id } = req.body;
  const index = queueState.tickets.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Ticket nicht gefunden" });
  }

  queueState.tickets.splice(index, 1);
  saveState();

  res.json({ success: true });
});

// Add a ticket manually (Admin can insert custom wait ticket)
app.post("/api/admin/ticket/add", checkAdminAuth, (req, res) => {
  const { name, matter, isReal, priority } = req.body;

  queueState.settings.currentNumber++;
  const ticket: QueueTicket = {
    id: generateId(),
    number: queueState.settings.currentNumber,
    name: (name || "Manueller Eintrag").trim(),
    matter: (matter || "Keine Angabe").trim(),
    createdAt: new Date().toISOString(),
    calledAt: null,
    completedAt: null,
    status: "waiting",
    isReal: isReal !== undefined ? !!isReal : true,
    priority: priority !== undefined ? Number(priority) : 0,
  };

  queueState.tickets.push(ticket);
  saveState();

  res.json({ success: true, ticket });
});

// Prioritize or reorder tickets
app.post("/api/admin/ticket/reorder", checkAdminAuth, (req, res) => {
  const { ticketIds } = req.body; // An array of ticket IDs in the desired order
  if (!Array.isArray(ticketIds)) {
    return res.status(400).json({ error: "Ungültiges Datenformat" });
  }

  // We want to reorder only "waiting" tickets
  // To preserve priorities correctly, we will assign decreasing priority numbers
  // based on the index in the submitted array.
  // This allows the front-end to freely order them.
  let priorityVal = ticketIds.length;
  ticketIds.forEach(id => {
    const ticket = queueState.tickets.find(t => t.id === id);
    if (ticket && ticket.status === "waiting") {
      ticket.priority = priorityVal;
      priorityVal--;
    }
  });

  saveState();
  res.json({ success: true, tickets: queueState.tickets });
});

// Reset the entire queue
app.post("/api/admin/reset", checkAdminAuth, (req, res) => {
  seedInitialQueue();
  saveState();
  setupSimulationTimers();
  res.json({ success: true, tickets: queueState.tickets, settings: queueState.settings });
});


// Vite middleware or production static folder serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
