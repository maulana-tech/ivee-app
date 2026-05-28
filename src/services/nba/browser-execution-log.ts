const STORAGE_KEY = 'canon-execution-log';
const MAX_ENTRIES = 500;

export type ExecutionLogEntryType =
  | 'signal'
  | 'risk_check'
  | 'order_submit'
  | 'order_fill'
  | 'order_cancel'
  | 'error';

export interface BrowserLogEntry {
  timestamp: string;
  type: ExecutionLogEntryType;
  automation_id: string;
  market_id: string;
  payload: Record<string, unknown>;
}

function loadRaw(): BrowserLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BrowserLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRaw(entries: BrowserLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
  }
}

class BrowserExecutionLog {
  appendEntry(entry: BrowserLogEntry): void {
    const entries = loadRaw();
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
    saveRaw(entries);
  }

  getEntries(): BrowserLogEntry[] {
    return loadRaw();
  }

  clearEntries(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  }

  exportAsJsonl(): string {
    return loadRaw()
      .map(entry => JSON.stringify(entry))
      .join('\n');
  }

  getEntriesByAutomation(id: string): BrowserLogEntry[] {
    return loadRaw().filter(entry => entry.automation_id === id);
  }

  getEntriesByDate(date: string): BrowserLogEntry[] {
    return loadRaw().filter(entry => entry.timestamp.startsWith(date));
  }
}

export const browserExecutionLog = new BrowserExecutionLog();
