import { TruckUnit, ExpenseRecord, AppUser } from '../types/truck';

// Session ID for SSE event identification
function getClientAuthorId(): string {
  let id = sessionStorage.getItem('harbor_tbs_client_id');
  if (!id) {
    id = `user-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('harbor_tbs_client_id', id);
  }
  return id;
}

export const CLIENT_AUTHOR_ID = getClientAuthorId();

// Active User state management
let currentUser: AppUser = {
  id: 'usr-admin-1',
  name: 'Wahyu Maulana (Admin Operasional)',
  email: 'eztsel94@gmail.com',
  role: 'admin',
  roleLabel: 'Admin / Kasir Kebun',
  department: 'Divisi Logistik & Keuangan TBS',
};

export function setCurrentUser(user: AppUser) {
  currentUser = user;
  try {
    localStorage.setItem('harbor_tbs_active_user', JSON.stringify(user));
  } catch {}
}

export function getCurrentUser(): AppUser {
  try {
    const saved = localStorage.getItem('harbor_tbs_active_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role) {
        currentUser = parsed;
      }
    }
  } catch {}
  return currentUser;
}

function getAuthHeaders(): HeadersInit {
  const user = getCurrentUser();
  return {
    'Content-Type': 'application/json',
    'x-user-id': user.id,
    'x-user-role': user.role,
    'x-user-name': user.name,
    'x-user-email': user.email,
  };
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

export const api = {
  async getSystemUsers(): Promise<AppUser[]> {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Gagal memuat daftar user sistem');
    const data = await res.json();
    return data.users;
  },

  async updateUserRole(userId: string, role: string): Promise<{ user: AppUser; users: AppUser[] }> {
    const res = await fetch(`/api/users/${userId}/role`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role, authorId: CLIENT_AUTHOR_ID }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Akses Ditolak: Hanya role Admin yang berhak merubah role pengguna');
    }
    return data;
  },

  async getData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[]; connectedUsers: number }> {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Gagal mengambil data dari server');
    return res.json();
  },

  async addExpense(expense: Omit<ExpenseRecord, 'id' | 'createdAt'>): Promise<ExpenseRecord> {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...expense, authorId: CLIENT_AUTHOR_ID }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyimpan pengeluaran ke server');
    }
    return data.expense;
  },

  async addExpensesBatch(items: Omit<ExpenseRecord, 'id' | 'createdAt'>[]): Promise<ExpenseRecord[]> {
    const res = await fetch('/api/expenses/batch', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ expenses: items, authorId: CLIENT_AUTHOR_ID }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal mengimpor batch data pengeluaran ke server');
    }
    return data.expenses;
  },

  async updateExpense(expense: ExpenseRecord): Promise<ExpenseRecord> {
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...expense, authorId: CLIENT_AUTHOR_ID }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Akses Ditolak: Hanya role Admin yang dapat mengubah data biaya');
    }
    return data.expense;
  },

  async deleteExpense(id: string): Promise<void> {
    const res = await fetch(`/api/expenses/${id}?authorId=${CLIENT_AUTHOR_ID}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Akses Ditolak: Hanya role Admin yang dapat menghapus data biaya');
    }
  },

  async addTruck(truck: Omit<TruckUnit, 'id'>): Promise<TruckUnit> {
    const res = await fetch('/api/trucks', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...truck, authorId: CLIENT_AUTHOR_ID }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Akses Ditolak: Hanya role Admin yang dapat menambah unit truk');
    }
    return data.truck;
  },

  async updateTruck(truck: TruckUnit): Promise<TruckUnit> {
    const res = await fetch(`/api/trucks/${truck.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...truck, authorId: CLIENT_AUTHOR_ID }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Akses Ditolak: Hanya role Admin yang dapat mengubah unit truk');
    }
    return data.truck;
  },

  async deleteTruck(id: string, deleteRelated: boolean): Promise<void> {
    const res = await fetch(`/api/trucks/${id}?deleteRelated=${deleteRelated}&authorId=${CLIENT_AUTHOR_ID}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Akses Ditolak: Hanya role Admin yang dapat menghapus unit truk');
    }
  },

  async resetData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[] }> {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ authorId: CLIENT_AUTHOR_ID }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Akses Ditolak: Hanya role Admin yang dapat mereset database');
    }
    return data;
  },

  async importData(data: { trucks: TruckUnit[]; expenses: ExpenseRecord[] }): Promise<void> {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...data, authorId: CLIENT_AUTHOR_ID }),
    });

    const respData = await res.json();
    if (!res.ok) {
      throw new Error(respData.error || 'Akses Ditolak: Hanya role Admin yang dapat mengimpor database');
    }
  },
};
