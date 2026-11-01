export interface DailyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  truckNumber: string; // e.g. DT 90
  driverName: string; // e.g. Anton or multi-loaders ANTON/DELFIN/YUVEN
  tonnage: number; // e.g. 8.45
  afdeling: string; // e.g. Afdeling 1
  ritNumber?: number; // e.g. 1 for Rit 1, 2 for Rit 2 (urutan ritase otomatis per afdeling)
  notes?: string;
  createdAt?: any;
}

export type NewDailyRecord = Omit<DailyRecord, 'id' | 'createdAt'>;
