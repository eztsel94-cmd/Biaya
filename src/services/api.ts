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

// Daftar pengguna sistem dengan Hak Akses (RBAC)
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

let currentUser: AppUser = DEFAULT_SYSTEM_USERS[0];
let currentUsersList: AppUser[] = [...DEFAULT_SYSTEM_USERS];

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
  return DEFAULT_SYSTEM_USERS;
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
          roleLabel: newRole === 'admin' ? 'Admin / Kasir Kebun' : newRole === 'operator' ? 'Operator Supir' : 'Viewer / Pengawas Lapangan',
        };
      }
      return u;
    });
    currentUsersList = updated;
    const target = updated.find((u) => u.id === userId) || updated[0];
    return { user: target, users: updated };
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
