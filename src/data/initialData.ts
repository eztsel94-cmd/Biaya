import { TruckUnit, ExpenseRecord } from '../types/truck';

// Data armada standar Traksi KPU (18 unit DT & GD)
export const DEFAULT_TRAKSI_TRUCKS: string[] = [
  'DT 38', 'DT 41', 'DT 43', 'DT 44', 'DT 47', 'DT 48',
  'DT 49', 'DT 52', 'DT 56', 'DT 57', 'DT 60', 'DT 62',
  'DT 63', 'DT 90', 'DT 91', 'DT 92', 'GD 01', 'GD 04',
];

// Data awal dikosongkan sepenuhnya (tanpa data contoh) agar hanya memuat data riil dari pengguna
export const INITIAL_TRUCKS: TruckUnit[] = [];

export const INITIAL_EXPENSES: ExpenseRecord[] = [];

export const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; border: string; bar: string }
> = {
  Fuel: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bar: 'bg-emerald-500',
  },
  Lubricant: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    bar: 'bg-blue-500',
  },
  Sparepart: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    bar: 'bg-amber-500',
  },
  'Tyre & Tubes': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bar: 'bg-cyan-500',
  },
  Workshop: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    bar: 'bg-purple-500',
  },
  BPJS: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    bar: 'bg-sky-500',
  },
  Jamsostek: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    bar: 'bg-indigo-500',
  },
  'Potongan Mangkir': {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    bar: 'bg-rose-500',
  },
  Beras: {
    bg: 'bg-lime-500/10',
    text: 'text-lime-400',
    border: 'border-lime-500/30',
    bar: 'bg-lime-500',
  },
  Supir: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    bar: 'bg-orange-500',
  },
  // Fallback untuk data kategori lama jika ada
  Oli: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    bar: 'bg-blue-500',
  },
  Minyak: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bar: 'bg-emerald-500',
  },
  Mekanik: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    bar: 'bg-purple-500',
  },
  'Tunjangan BPJS': {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    bar: 'bg-sky-500',
  },
  'Tunjangan Jamsostek': {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    bar: 'bg-indigo-500',
  },
};

export const CATEGORIES = [
  'Fuel',
  'Lubricant',
  'Sparepart',
  'Tyre & Tubes',
  'Workshop',
  'BPJS',
  'Jamsostek',
  'Potongan Mangkir',
  'Beras',
  'Supir',
] as const;
