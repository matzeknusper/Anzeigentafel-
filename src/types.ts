export interface QueueTicket {
  id: string;
  number: number;         // Sequential number, e.g., 101
  name: string;           // Customer's name
  matter: string;         // Customer's request / concern
  createdAt: string;      // ISO Date string
  calledAt: string | null;  // ISO Date string when calling started
  completedAt: string | null; // ISO Date string when completed
  status: 'waiting' | 'calling' | 'completed' | 'skipped';
  isReal: boolean;        // true for user-entered, false for auto-generated simulation
  priority: number;       // Higher number = higher priority
}

export interface QueueSettings {
  simulationEnabled: boolean;     // Whether to automatically advance (call next)
  simulationInterval: number;     // Auto-advance interval in seconds
  peakSimulationEnabled: boolean; // Whether to artificially add simulated customers
  peakSimulationRate: number;     // Speed of adding simulated customers in seconds
  currentNumber: number;          // Highest ticket number generated so far
  adminPasswordHash: string;      // Hashed or simple admin password
  averageServiceTime: number;     // Dynamic wait calculation factor (minutes per person)
}

export interface QueueState {
  tickets: QueueTicket[];
  settings: QueueSettings;
}
