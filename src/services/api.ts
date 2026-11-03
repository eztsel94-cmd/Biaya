import { TruckUnit, ExpenseRecord, AppUser } from '../types/truck';
import { INITIAL_TRUCKS, INITIAL_EXPENSES } from '../data/initialData';
import {
  subscribeToFirestoreTrucks,
  subscribeToFirestoreExpenses,
  addTruckFirestore,
  updateTruckFirestore,
  deleteTruckFirestore,
  addExpenseFirestore,
  updateExpenseFirestore,
  deleteExpenseFirestore,
  addExpensesBatchFirestore,
  resetAllFirestoreData,
  importAllFirestoreData,
  firestorePermissionError,
  onPermissionErrorChange,
} from './firebase';

// Identifier untuk sesi pengguna saat ini
export const CLIENT_AUTHOR_ID = `usr-${Math.random().toString(36).substring(2, 8)}`;

// Daftar pengguna sistem dengan Hak Akses (RBAC) — bersih tanpa data contoh bawaan
export const DEFAULT_SYSTEM_USERS: AppUser[] = [
  {
    id: 'usr-admin-1',
    name: 'Admin Traksi KPU',
    email: 'eztsel94@gmail.com',
    role: 'admin',
    roleLabel: 'Admin Utama',
    department: 'Traksi KPU - Kalimantan Plantation Unit',
  },
];

const USERS_STORAGE_KEY = 'traksi_kpu_rbac_users_v1';

const DUMMY_USER_IDS = new Set([
  'usr-admin-2',
  'usr-driver-truck-1',
  'usr-driver-truck-2',
  'usr-driver-truck-3',
  'usr-operator-1',
  'usr-viewer-1',
]);

function loadSavedUsers(): AppUser[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter((u: AppUser) => !DUMMY_USER_IDS.has(u.id));
          if (cleaned.length > 0) return cleaned;
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return [...DEFAULT_SYSTEM_USERS];
}

function saveUsersToStorage(users: AppUser[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  } catch {
    // ignore storage errors
  }
}

let currentUsersList: AppUser[] = loadSavedUsers();
let currentUser: AppUser = currentUsersList[0] || DEFAULT_SYSTEM_USERS[0];

export function setCurrentUser(user: AppUser) {
  currentUser = user;
}

export function getCurrentUser(): AppUser {
  return currentUser;
}

// Inisialisasi awal UI cepat (tanpa layar kosong) saat Firestore sedang menghubungkan
export function getInitialTrucks(): TruckUnit[] {
  return INITIAL_TRUCKS;
}

export function getInitialExpenses(): ExpenseRecord[] {
  return INITIAL_EXPENSES;
}

export function getInitialUsers(): AppUser[] {
  return currentUsersList;
}

export type RealtimeEventData = {
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
  authorName?: string;
  timestamp: string;
};

/**
 * Berlangganan event real-time langsung ke Firebase Firestore menggunakan onSnapshot.
 * Sinkronisasi otomatis di seluruh tab dan perangkat tanpa localStorage.
 */
export function subscribeToEvents(callback: (data: RealtimeEventData) => void): () => void {
  // Listener Firestore Armada
  const unsubTrucks = subscribeToFirestoreTrucks((trucks) => {
    callback({
      type: 'INIT',
      payload: { trucks },
      authorId: 'firestore-sync',
      timestamp: new Date().toISOString(),
    });
  });

  // Listener Firestore Pengeluaran Biaya
  const unsubExpenses = subscribeToFirestoreExpenses((expenses) => {
    callback({
      type: 'INIT',
      payload: { expenses },
      authorId: 'firestore-sync',
      timestamp: new Date().toISOString(),
    });
  });

  return () => {
    unsubTrucks();
    unsubExpenses();
  };
}

/**
 * Layanan API terpusat yang menjalankan operasi langsung ke Firebase Firestore
 */
export const api = {
  getInitialTrucks,
  getInitialExpenses,
  getInitialUsers,

  async getData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[] }> {
    return {
      trucks: INITIAL_TRUCKS,
      expenses: INITIAL_EXPENSES,
    };
  },

  async getTrucks(): Promise<TruckUnit[]> {
    return INITIAL_TRUCKS;
  },

  async getExpenses(): Promise<ExpenseRecord[]> {
    return INITIAL_EXPENSES;
  },

  async getSystemUsers(): Promise<AppUser[]> {
    return currentUsersList;
  },

  async updateUserRole(userId: string, newRole: 'admin' | 'operator' | 'viewer'): Promise<{ user: AppUser; users: AppUser[] }> {
    const updated = currentUsersList.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          role: newRole,
          roleLabel: newRole === 'admin' ? 'Admin / Kasir Kebun' : newRole === 'operator' ? 'Operator / Supir DT' : 'Viewer / Pengawas Lapangan',
        };
      }
      return u;
    });
    currentUsersList = updated;
    saveUsersToStorage(currentUsersList);
    const target = updated.find((u) => u.id === userId) || updated[0];
    return { user: target, users: updated };
  },

  async addSystemUser(newUser: Omit<AppUser, 'id'>): Promise<AppUser[]> {
    const created: AppUser = {
      ...newUser,
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    currentUsersList = [...currentUsersList, created];
    saveUsersToStorage(currentUsersList);
    return currentUsersList;
  },

  async deleteSystemUser(userId: string): Promise<AppUser[]> {
    if (userId === 'usr-admin-1') return currentUsersList;
    currentUsersList = currentUsersList.filter((u) => u.id !== userId);
    if (currentUsersList.length === 0) {
      currentUsersList = [...DEFAULT_SYSTEM_USERS];
    }
    saveUsersToStorage(currentUsersList);
    return currentUsersList;
  },

  // Operasi Armada Truk -> Firestore
  async addTruck(truck: Omit<TruckUnit, 'id'>): Promise<TruckUnit> {
    return await addTruckFirestore(truck);
  },

  async updateTruck(truck: TruckUnit): Promise<TruckUnit> {
    return await updateTruckFirestore(truck);
  },

  async deleteTruck(id: string, deleteRelated: boolean): Promise<void> {
    return await deleteTruckFirestore(id, deleteRelated);
  },

  // Operasi Biaya Truk -> Firestore
  async addExpense(expense: Omit<ExpenseRecord, 'id' | 'createdAt'>): Promise<ExpenseRecord> {
    return await addExpenseFirestore(expense);
  },

  async addExpensesBatch(items: Omit<ExpenseRecord, 'id' | 'createdAt'>[]): Promise<ExpenseRecord[]> {
    return await addExpensesBatchFirestore(items);
  },

  async updateExpense(expense: ExpenseRecord): Promise<ExpenseRecord> {
    return await updateExpenseFirestore(expense);
  },

  async deleteExpense(id: string): Promise<void> {
    return await deleteExpenseFirestore(id);
  },

  // Reset & Impor Keseluruhan -> Firestore
  async resetData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[] }> {
    return await resetAllFirestoreData();
  },

  async importData(data: { trucks: TruckUnit[]; expenses: ExpenseRecord[] }): Promise<void> {
    return await importAllFirestoreData(data);
  },
};
