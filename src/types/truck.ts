export type ExpenseCategory =
  | 'Sparepart'
  | 'Oli'
  | 'Minyak'
  | 'Mekanik'
  | 'Supir'
  | 'Tunjangan BPJS'
  | 'Tunjangan Jamsostek'
  | 'Potongan Mangkir';

export type TruckStatus = 'Aktif' | 'Perawatan' | 'Standby';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  department: string;
}

export interface TruckUnit {
  id: string;
  code: string; // e.g. "Unit 90", "Unit 01", "Unit 03"
  plateNumber: string; // e.g. "BM 8456 TBS"
  driverName: string;
  phone?: string;
  model: string; // e.g. "Hino Dutro 130 HD"
  capacity: string; // e.g. "8.5 Ton TBS"
  status: TruckStatus;
  year: number;
  notes?: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  truckId: string;
  category: ExpenseCategory;
  description: string;
  amount: number; // in IDR
  vendor: string; // Bengkel, SPBU, Toko Sparepart, etc.
  invoiceNumber?: string;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
}

export interface FilterOptions {
  truckId: string;
  category: string;
  searchTerm: string;
  startDate: string;
  endDate: string;
}
