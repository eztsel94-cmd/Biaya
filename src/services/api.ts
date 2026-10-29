import { TruckUnit, ExpenseRecord, AppUser } from '../types/truck';
import { INITIAL_TRUCKS, INITIAL_EXPENSES } from '../data/initialData';

// LocalStorage Keys
export const STORAGE_KEYS = {
  TRUCKS: 'harbor_tbs_trucks_v3',
  EXPENSES: 'harbor_tbs_expenses_v3',
  USERS: 'harbor_tbs_users_v3',
  ACTIVE_USER: 'harbor_tbs_active_user',
  CLIENT_ID: 'harbor_tbs_client_id',
};

// Session ID for multi-tab event identification
function getClientAuthorId(): string {
  try {
    let id = sessionStorage.getItem(STORAGE_KEYS.CLIENT_ID);
    if (!id) {
      id = `user-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
    }
    return id;
  } catch {
    return `user-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const CLIENT_AUTHOR_ID = getClientAuthorId();

// Default system users with RBAC
export const DEFAULT_SYSTEM_USERS: AppUser[] = [
  {
    id: 'usr-admin-1',
    name: 'Wahyu Maulana (Admin Operasional)',
    email: 'eztsel94@gmail.com',
    role: 'admin',
    roleLabel: 'Admin / Kasir Kebun',
    department: 'Divisi Logistik & Keuangan TBS',
  },
  {
    id: 'usr-admin-2',
    name: 'Muhammad Rizki Aditya (Admin Operasional)',
    email: 'rizki.aditya@harborhomes.com',
    role: 'admin',
    roleLabel: 'Admin / Kasir Kebun',
    department: 'Divisi Logistik & Keuangan TBS',
  },
  {
    id: 'usr-driver-truck-1',
    name: 'Budi Santoso (Supir Unit 01)',
    email: 'budi.santoso@harborhomes.com',
    role: 'operator',
    roleLabel: 'Supir DT (Unit 01)',
    department: 'Armada Truk TBS - BM 8120 TBS',
  },
  {
    id: 'usr-driver-truck-2',
    name: 'Agus Supriyadi (Supir Unit 90)',
    email: 'agus.supriyadi@harborhomes.com',
    role: 'operator',
    roleLabel: 'Supir DT (Unit 90)',
    department: 'Armada Truk TBS - BM 8456 TBS',
  },
  {
    id: 'usr-driver-truck-3',
    name: 'Hendra Wijaya (Supir Unit 03)',
    email: 'hendra.wijaya@harborhomes.com',
    role: 'operator',
    roleLabel: 'Supir DT (Unit 03)',
    department: 'Armada Truk TBS - BM 9312 TBS',
  },
  {
    id: 'usr-viewer-1',
    name: 'Dedi Kurniawan (Manajer Lapangan)',
    email: 'dedi.kurniawan@harborhomes.com',
    role: 'viewer',
    roleLabel: 'Viewer / Pengawas Lapangan',
    department: 'Pengawasan Lapangan TBS',
  },
];

// Active User state management
let currentUser: AppUser = DEFAULT_SYSTEM_USERS[0];

export function setCurrentUser(user: AppUser) {
  currentUser = user;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));
  } catch {}
}

export function getCurrentUser(): AppUser {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role) {
        currentUser = parsed;
      }
    }
  } catch {}
  return currentUser;
}

export interface RealtimeEventData {
  type:
    | 'INIT'
    | 'EXPENSE_ADDED'
    | 'EXPENSES_BATCH_ADDED'
    | 'EXPENSE_UPDATED'
    | 'EXPENSE_DELETED'
    | 'TRUCK_ADDED'
    | 'TRUCK_UPDATED'
    | 'TRUCK_DELETED'
    | 'DATABASE_RESET'
    | 'DATABASE_IMPORTED'
    | 'USERS_UPDATED'
    | 'USER_ROLE_UPDATED';
  payload: any;
  authorId?: string;
  timestamp: string;
}

// Multi-tab BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('harbor_tbs_sync_v2');
  }
} catch {
  // BroadcastChannel not available in this environment
}

export function broadcastEvent(event: RealtimeEventData) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(event);
    } catch (err) {
      console.warn('Gagal broadcast message:', err);
    }
  }
}

export function subscribeToEvents(callback: (event: RealtimeEventData) => void): () => void {
  const handleBroadcast = (msg: MessageEvent) => {
    if (msg.data && msg.data.type) {
      callback(msg.data);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (!e.newValue) return;
    try {
      if (e.key === STORAGE_KEYS.TRUCKS) {
        callback({
          type: 'TRUCK_UPDATED',
          payload: { trucks: JSON.parse(e.newValue) },
          timestamp: new Date().toISOString(),
        });
      } else if (e.key === STORAGE_KEYS.EXPENSES) {
        callback({
          type: 'EXPENSES_BATCH_ADDED',
          payload: { expenses: JSON.parse(e.newValue) },
          timestamp: new Date().toISOString(),
        });
      } else if (e.key === STORAGE_KEYS.USERS) {
        callback({
          type: 'USERS_UPDATED',
          payload: { users: JSON.parse(e.newValue) },
          timestamp: new Date().toISOString(),
        });
      }
    } catch {}
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

// Safe LocalStorage helpers
function readTrucksFromStorage(): TruckUnit[] {
  if (typeof window === 'undefined') return INITIAL_TRUCKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRUCKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Check if v2 exists
    const oldRaw = localStorage.getItem('harbor_tbs_trucks_v2');
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      if (Array.isArray(oldParsed) && oldParsed.length > 0) {
        localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(oldParsed));
        return oldParsed;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca trucks dari localStorage:', err);
  }
  // Default fallback seed
  try {
    localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(INITIAL_TRUCKS));
  } catch {}
  return INITIAL_TRUCKS;
}

function writeTrucksToStorage(trucks: TruckUnit[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TRUCKS, JSON.stringify(trucks));
  } catch (err) {
    console.error('Gagal menulis trucks ke localStorage:', err);
  }
}

function readExpensesFromStorage(): ExpenseRecord[] {
  if (typeof window === 'undefined') return INITIAL_EXPENSES;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure new initial records (Tunjangan BPJS, Tunjangan Jamsostek, Potongan Mangkir) are present
        const existingIds = new Set(parsed.map((e: ExpenseRecord) => e.id));
        const missingInitial = INITIAL_EXPENSES.filter((init) => !existingIds.has(init.id));
        if (missingInitial.length > 0) {
          const merged = [...parsed, ...missingInitial];
          localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(merged));
          return merged;
        }
        return parsed;
      }
    }
    // Check if v2 exists
    const oldRaw = localStorage.getItem('harbor_tbs_expenses_v2');
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      if (Array.isArray(oldParsed) && oldParsed.length > 0) {
        const existingIds = new Set(oldParsed.map((e: ExpenseRecord) => e.id));
        const missingInitial = INITIAL_EXPENSES.filter((init) => !existingIds.has(init.id));
        const merged = [...oldParsed, ...missingInitial];
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca expenses dari localStorage:', err);
  }
  // Default fallback seed
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
  } catch {}
  return INITIAL_EXPENSES;
}

function writeExpensesToStorage(expenses: ExpenseRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  } catch (err) {
    console.error('Gagal menulis expenses ke localStorage:', err);
  }
}

function readUsersFromStorage(): AppUser[] {
  if (typeof window === 'undefined') return DEFAULT_SYSTEM_USERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca users dari localStorage:', err);
  }
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_SYSTEM_USERS));
  } catch {}
  return DEFAULT_SYSTEM_USERS;
}

function writeUsersToStorage(users: AppUser[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (err) {
    console.error('Gagal menulis users ke localStorage:', err);
  }
}

// API Service Implementation backed by localStorage
export const api = {
  // Synchronous accessors for initial render (prevents flicker or blank delay)
  getInitialTrucks(): TruckUnit[] {
    return readTrucksFromStorage();
  },

  getInitialExpenses(): ExpenseRecord[] {
    return readExpensesFromStorage();
  },

  getInitialUsers(): AppUser[] {
    return readUsersFromStorage();
  },

  async getSystemUsers(): Promise<AppUser[]> {
    return readUsersFromStorage();
  },

  async updateUserRole(userId: string, role: string): Promise<{ user: AppUser; users: AppUser[] }> {
    const users = readUsersFromStorage();
    const target = users.find((u) => u.id === userId);
    if (!target) throw new Error('Pengguna tidak ditemukan');

    target.role = role as any;
    writeUsersToStorage(users);

    const event: RealtimeEventData = {
      type: 'USER_ROLE_UPDATED',
      payload: { user: target, users },
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);

    return { user: target, users };
  },

  async getData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[]; connectedUsers: number }> {
    const trucks = readTrucksFromStorage();
    const expenses = readExpensesFromStorage();
    return { trucks, expenses, connectedUsers: 1 };
  },

  async addExpense(expense: Omit<ExpenseRecord, 'id' | 'createdAt'>): Promise<ExpenseRecord> {
    const expenses = readExpensesFromStorage();
    const newRecord: ExpenseRecord = {
      ...expense,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newRecord, ...expenses];
    writeExpensesToStorage(updated);

    const event: RealtimeEventData = {
      type: 'EXPENSE_ADDED',
      payload: newRecord,
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);

    return newRecord;
  },

  async addExpensesBatch(items: Omit<ExpenseRecord, 'id' | 'createdAt'>[]): Promise<ExpenseRecord[]> {
    const expenses = readExpensesFromStorage();
    const newRecords: ExpenseRecord[] = items.map((item, idx) => ({
      ...item,
      id: `exp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    }));
    const updated = [...newRecords, ...expenses];
    writeExpensesToStorage(updated);

    const event: RealtimeEventData = {
      type: 'EXPENSES_BATCH_ADDED',
      payload: { expenses: newRecords, count: newRecords.length },
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);

    return newRecords;
  },

  async updateExpense(expense: ExpenseRecord): Promise<ExpenseRecord> {
    const expenses = readExpensesFromStorage();
    const updated = expenses.map((e) => (e.id === expense.id ? expense : e));
    writeExpensesToStorage(updated);

    const event: RealtimeEventData = {
      type: 'EXPENSE_UPDATED',
      payload: expense,
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);

    return expense;
  },

  async deleteExpense(id: string): Promise<void> {
    const expenses = readExpensesFromStorage();
    const updated = expenses.filter((e) => e.id !== id);
    writeExpensesToStorage(updated);

    const event: RealtimeEventData = {
      type: 'EXPENSE_DELETED',
      payload: { id },
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);
  },

  async addTruck(truck: Omit<TruckUnit, 'id'>): Promise<TruckUnit> {
    const trucks = readTrucksFromStorage();
    const newTruck: TruckUnit = {
      ...truck,
      id: `truck-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [...trucks, newTruck];
    writeTrucksToStorage(updated);

    const event: RealtimeEventData = {
      type: 'TRUCK_ADDED',
      payload: newTruck,
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);

    return newTruck;
  },

  async updateTruck(truck: TruckUnit): Promise<TruckUnit> {
    const trucks = readTrucksFromStorage();
    const updated = trucks.map((t) => (t.id === truck.id ? truck : t));
    writeTrucksToStorage(updated);

    const event: RealtimeEventData = {
      type: 'TRUCK_UPDATED',
      payload: truck,
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);

    return truck;
  },

  async deleteTruck(id: string, deleteRelated: boolean): Promise<void> {
    // 1. Delete from trucks list
    const trucks = readTrucksFromStorage();
    const updatedTrucks = trucks.filter((t) => t.id !== id);
    writeTrucksToStorage(updatedTrucks);

    // 2. Delete related expenses if requested
    if (deleteRelated) {
      const expenses = readExpensesFromStorage();
      const updatedExpenses = expenses.filter((e) => e.truckId !== id);
      writeExpensesToStorage(updatedExpenses);
    }

    // 3. Broadcast to all open tabs
    const event: RealtimeEventData = {
      type: 'TRUCK_DELETED',
      payload: { id, deleteRelated },
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);
  },

  async resetData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[] }> {
    writeTrucksToStorage(INITIAL_TRUCKS);
    writeExpensesToStorage(INITIAL_EXPENSES);

    const event: RealtimeEventData = {
      type: 'DATABASE_RESET',
      payload: { trucks: INITIAL_TRUCKS, expenses: INITIAL_EXPENSES },
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);

    return { trucks: INITIAL_TRUCKS, expenses: INITIAL_EXPENSES };
  },

  async importData(data: { trucks: TruckUnit[]; expenses: ExpenseRecord[] }): Promise<void> {
    if (data.trucks && Array.isArray(data.trucks)) {
      writeTrucksToStorage(data.trucks);
    }
    if (data.expenses && Array.isArray(data.expenses)) {
      writeExpensesToStorage(data.expenses);
    }

    const event: RealtimeEventData = {
      type: 'DATABASE_IMPORTED',
      payload: data,
      authorId: CLIENT_AUTHOR_ID,
      timestamp: new Date().toISOString(),
    };
    broadcastEvent(event);
  },
};
