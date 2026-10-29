export interface DailyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  truckNumber: string; // e.g. DT 90
  driverName: string; // e.g. Anton
  tonnage: number; // e.g. 8.45
  afdeling: string; // e.g. Afdeling 1
  notes?: string;
  createdAt?: any;
}

export type NewDailyRecord = Omit<DailyRecord, 'id' | 'createdAt'>;
