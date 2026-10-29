import { TruckUnit, ExpenseRecord } from '../types/truck';

// Sesuai permintaan pengguna: HANYA 3 UNIT
// Unit 02 — BM 8456 TBS telah diubah menjadi: Unit 90
export const INITIAL_TRUCKS: TruckUnit[] = [
  {
    id: 'truck-1',
    code: 'Unit 01',
    plateNumber: 'BM 8120 TBS',
    driverName: 'Budi Santoso',
    phone: '0812-7482-9910',
    model: 'Mitsubishi Canter FE 74 HD',
    capacity: '8.0 Ton TBS',
    status: 'Aktif',
    year: 2021,
    notes: 'Rute Kebun Afdeling 1 - PKS Muara Jaya. Kondisi mesin prima.',
  },
  {
    id: 'truck-2',
    code: 'Unit 90', // Diubah dari Unit 02 — BM 8456 TBS menjadi Unit 90
    plateNumber: 'BM 8456 TBS',
    driverName: 'Agus Supriyadi',
    phone: '0852-6619-3044',
    model: 'Hino Dutro 130 HD Plantations',
    capacity: '8.5 Ton TBS',
    status: 'Aktif',
    year: 2022,
    notes: 'Rute Kebun Afdeling 2 & Blok C - Timbangan PKS Utama. Baru servis rutin.',
  },
  {
    id: 'truck-3',
    code: 'Unit 03',
    plateNumber: 'BM 9312 TBS',
    driverName: 'Hendra Wijaya',
    phone: '0813-8821-4501',
    model: 'Isuzu Elf NMR 71 HD',
    capacity: '8.5 Ton TBS',
    status: 'Perawatan',
    year: 2020,
    notes: 'Sedang ganti per daun belakang & kampas rem di bengkel rekanan.',
  },
];

// 19 Catatan biaya realistis untuk 3 unit truk TBS Harbor Homes
export const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: 'exp-01',
    date: '2026-10-25',
    truckId: 'truck-2', // Unit 90
    category: 'Minyak',
    description: 'Pengisian BioSolar 120 Liter untuk 2 ritase TBS blok timur',
    amount: 816000,
    vendor: 'SPBU 14.284.114 Pasir Pengaraian',
    invoiceNumber: 'SPBU-261025-08',
    createdAt: '2026-10-25T14:30:00Z',
  },
  {
    id: 'exp-02',
    date: '2026-10-24',
    truckId: 'truck-1', // Unit 01
    category: 'Sparepart',
    description: 'Penggantian Ban Luar Belakang Kiri Bridgestone M840 7.50-16',
    amount: 1950000,
    vendor: 'Toko Ban Mandiri Jaya',
    invoiceNumber: 'INV-BM-8921',
    createdAt: '2026-10-24T10:15:00Z',
  },
  {
    id: 'exp-03',
    date: '2026-10-23',
    truckId: 'truck-3', // Unit 03
    category: 'Mekanik',
    description: 'Jasa pasang per daun belakang (4 lembar) & stel rem tromol',
    amount: 650000,
    vendor: 'Bengkel Servis Berkah Truk',
    invoiceNumber: 'BSB-0941',
    createdAt: '2026-10-23T16:00:00Z',
  },
  {
    id: 'exp-04',
    date: '2026-10-22',
    truckId: 'truck-2', // Unit 90
    category: 'Oli',
    description: 'Ganti Oli Mesin Meditran SX4 15W-40 (10 Liter) + Filter Oli Sakura',
    amount: 580000,
    vendor: 'Toko Oli & Pelumas Nusantara',
    invoiceNumber: 'TOPN-7731',
    createdAt: '2026-10-22T09:45:00Z',
  },
  {
    id: 'exp-05',
    date: '2026-10-21',
    truckId: 'truck-1', // Unit 01
    category: 'Supir',
    description: 'Uang jalan & upah ritase supir (4 trip pengantaran TBS ke PKS)',
    amount: 600000,
    vendor: 'Kasbon Operasional Kasir Kebun',
    invoiceNumber: 'UPH-2110-01',
    createdAt: '2026-10-21T17:20:00Z',
  },
  {
    id: 'exp-06',
    date: '2026-10-20',
    truckId: 'truck-3', // Unit 03
    category: 'Sparepart',
    description: 'Beli 4 Lembar Per Daun No. 2 & 3 Indospring HD',
    amount: 1420000,
    vendor: 'Toko Sparepart Riau Mandiri',
    invoiceNumber: 'SRM-4410',
    createdAt: '2026-10-20T11:00:00Z',
  },
  {
    id: 'exp-07',
    date: '2026-10-19',
    truckId: 'truck-2', // Unit 90
    category: 'Minyak',
    description: 'Isi Solar Dexlite 80 Liter perjalanan antar rayon sawit',
    amount: 1040000,
    vendor: 'SPBU 14.284.114 Pasir Pengaraian',
    invoiceNumber: 'SPBU-191026-12',
    createdAt: '2026-10-19T08:30:00Z',
  },
  {
    id: 'exp-08',
    date: '2026-10-18',
    truckId: 'truck-1', // Unit 01
    category: 'Mekanik',
    description: 'Jasa tune up mesin, servis injektor & kuras tangki solar',
    amount: 750000,
    vendor: 'Bengkel Diesel Sentral Sawit',
    invoiceNumber: 'BDSS-2209',
    createdAt: '2026-10-18T15:10:00Z',
  },
  {
    id: 'exp-09',
    date: '2026-10-17',
    truckId: 'truck-2', // Unit 90
    category: 'Supir',
    description: 'Upah supir ritase TBS afdeling 2 (3 trip x Rp 150.000)',
    amount: 450000,
    vendor: 'Kasbon Operasional Kasir Kebun',
    invoiceNumber: 'UPH-1710-90',
    createdAt: '2026-10-17T18:00:00Z',
  },
  {
    id: 'exp-10',
    date: '2026-10-16',
    truckId: 'truck-1', // Unit 01
    category: 'Oli',
    description: 'Penggantian Oli Gardan Rored EPA SAE 90 (4 Liter) & Oli Persneling',
    amount: 390000,
    vendor: 'Toko Oli & Pelumas Nusantara',
    invoiceNumber: 'TOPN-7690',
    createdAt: '2026-10-16T13:40:00Z',
  },
  {
    id: 'exp-11',
    date: '2026-10-15',
    truckId: 'truck-3', // Unit 03
    category: 'Minyak',
    description: 'Pengisian BioSolar 100 Liter angkut panen blok barat',
    amount: 680000,
    vendor: 'SPBU Simpang Tangun',
    invoiceNumber: 'SPBU-151026-03',
    createdAt: '2026-10-15T09:10:00Z',
  },
  {
    id: 'exp-12',
    date: '2026-10-14',
    truckId: 'truck-2', // Unit 90
    category: 'Sparepart',
    description: 'Ganti Kampas Rem Depan Bendix Heavy Duty (1 set)',
    amount: 520000,
    vendor: 'Toko Sparepart Riau Mandiri',
    invoiceNumber: 'SRM-4389',
    createdAt: '2026-10-14T14:20:00Z',
  },
  {
    id: 'exp-13',
    date: '2026-10-12',
    truckId: 'truck-1', // Unit 01
    category: 'Minyak',
    description: 'Isi BioSolar 115 Liter ritase TBS ke pabrik kelapa sawit',
    amount: 782000,
    vendor: 'SPBU 14.284.114 Pasir Pengaraian',
    invoiceNumber: 'SPBU-121026-05',
    createdAt: '2026-10-12T07:50:00Z',
  },
  {
    id: 'exp-14',
    date: '2026-10-10',
    truckId: 'truck-3', // Unit 03
    category: 'Supir',
    description: 'Upah supir dan uang makan jalan 2 ritase TBS',
    amount: 350000,
    vendor: 'Kasbon Operasional Kasir Kebun',
    invoiceNumber: 'UPH-1010-03',
    createdAt: '2026-10-10T17:45:00Z',
  },
  {
    id: 'exp-15',
    date: '2026-10-08',
    truckId: 'truck-2', // Unit 90
    category: 'Mekanik',
    description: 'Las penguatan engsel bak dump truk & ganti baut u-bolt',
    amount: 480000,
    vendor: 'Bengkel Las Kurnia Teknik',
    invoiceNumber: 'BKT-512',
    createdAt: '2026-10-08T16:30:00Z',
  },
  {
    id: 'exp-16',
    date: '2026-10-06',
    truckId: 'truck-3', // Unit 03
    category: 'Oli',
    description: 'Kuras Oli Mesin Rimula R4X 15W-40 (9.5 Liter) + Filter Solar Bawah',
    amount: 620000,
    vendor: 'Toko Oli & Pelumas Nusantara',
    invoiceNumber: 'TOPN-7512',
    createdAt: '2026-10-06T10:00:00Z',
  },
  {
    id: 'exp-17',
    date: '2026-10-05',
    truckId: 'truck-1', // Unit 01
    category: 'Sparepart',
    description: 'Penggantian Fan Belt Alternator & Tali Kipas AC Bando',
    amount: 230000,
    vendor: 'Toko Sparepart Riau Mandiri',
    invoiceNumber: 'SRM-4301',
    createdAt: '2026-10-05T11:40:00Z',
  },
  {
    id: 'exp-18',
    date: '2026-10-03',
    truckId: 'truck-2', // Unit 90
    category: 'Sparepart',
    description: 'Ganti Grease Gemuk Chassis Shell Gadus (2 kaleng) & Nipel',
    amount: 195000,
    vendor: 'Toko Oli & Pelumas Nusantara',
    invoiceNumber: 'TOPN-7489',
    createdAt: '2026-10-03T14:10:00Z',
  },
  {
    id: 'exp-19',
    date: '2026-10-01',
    truckId: 'truck-1', // Unit 01
    category: 'Minyak',
    description: 'Pengisian BioSolar awal bulan 130 Liter persiapan panen raya',
    amount: 884000,
    vendor: 'SPBU 14.284.114 Pasir Pengaraian',
    invoiceNumber: 'SPBU-011026-02',
    createdAt: '2026-10-01T08:15:00Z',
  },
];

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  Sparepart: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    bar: 'bg-amber-500',
  },
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
  Supir: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    bar: 'bg-orange-500',
  },
};

export const CATEGORIES = [
  'Sparepart',
  'Oli',
  'Minyak',
  'Mekanik',
  'Supir',
] as const;

