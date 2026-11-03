import React, { useState, useMemo } from 'react';
import { TruckUnit, ExpenseRecord, ExpenseCategory, AppUser } from '../types/truck';
import { formatRupiah, formatDateIndo, getWIBDateParts } from '../utils/formatters';
import { CATEGORIES, CATEGORY_COLORS } from '../data/initialData';
import { getDriverPortalUrl, getWhatsAppShareUrl } from '../utils/driverLink';
import {
  Truck,
  Fuel,
  Droplets,
  Package,
  Wrench,
  UserCheck,
  ShieldAlert,
  PlusCircle,
  Copy,
  Check,
  Share2,
  Calendar,
  Search,
  Filter,
  Lock,
  ExternalLink,
  ChevronRight,
  Info,
  Clock,
  LogOut,
  KeyRound,
  FileText,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  UserX,
  Layers,
  QrCode,
  ChevronLeft,
  RotateCcw,
  Disc,
  Wheat,
} from 'lucide-react';
import { DriverQrCodeModal } from './DriverQrCodeModal';

const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

interface DriverPortalViewProps {
  truck: TruckUnit;
  expenses: ExpenseRecord[];
  currentUser: AppUser;
  onOpenAddExpense: (truckId: string) => void;
  onExitDriverMode: () => void;
}

export const DriverPortalView: React.FC<DriverPortalViewProps> = ({
  truck,
  expenses,
  currentUser,
  onOpenAddExpense,
  onExitDriverMode,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or '0'..'11'
  const [selectedYear, setSelectedYear] = useState<string>('all'); // 'all' or '2026', '2025', etc.
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // 1. Strictly filter expenses to THIS TRUCK ONLY
  const unitExpenses = useMemo(() => {
    return expenses.filter((e) => e.truckId === truck.id);
  }, [expenses, truck.id]);

  // Available years dynamically from unitExpenses + standard recent years
  const availableYears = useMemo(() => {
    const currentYear = getWIBDateParts().year;
    const yearSet = new Set<number>([currentYear, currentYear - 1, currentYear - 2, currentYear - 3]);
    unitExpenses.forEach((e) => {
      const y = new Date(e.date).getFullYear();
      if (!isNaN(y) && y > 2000) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [unitExpenses]);

  // Expenses filtered by selected Bulan & Tahun
  const periodExpenses = useMemo(() => {
    return unitExpenses.filter((e) => {
      const d = new Date(e.date);
      if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) {
        return false;
      }
      if (selectedMonth !== 'all' && d.getMonth() !== Number(selectedMonth)) {
        return false;
      }
      return true;
    });
  }, [unitExpenses, selectedMonth, selectedYear]);

  // Total all-time cost for THIS TRUCK ONLY
  const totalUnitCost = useMemo(() => {
    return unitExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [unitExpenses]);

  // Total cost for selected Bulan & Tahun period
  const periodUnitCost = useMemo(() => {
    return periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [periodExpenses]);

  // Current month cost for this truck
  const currentMonthCost = useMemo(() => {
    const wib = getWIBDateParts();
    const currentYear = wib.year;
    const currentMonth = wib.monthIndex;
    return unitExpenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [unitExpenses]);

  // Category totals for this truck (respecting Bulan & Tahun filter)
  const categorySums = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat] = periodExpenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      return acc;
    }, {} as Record<ExpenseCategory, number>);
  }, [periodExpenses]);

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return periodExpenses
      .filter((e) => {
        if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          const matchDesc = e.description?.toLowerCase().includes(s);
          const matchCat = e.category?.toLowerCase().includes(s);
          if (!matchDesc && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [periodExpenses, selectedCategory, searchTerm]);

  const periodLabel = useMemo(() => {
    if (selectedMonth === 'all' && selectedYear === 'all') return 'Semua Periode';
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      return `${INDO_MONTHS[Number(selectedMonth)]} ${selectedYear}`;
    }
    if (selectedMonth !== 'all') {
      return `Bulan ${INDO_MONTHS[Number(selectedMonth)]} (Semua Tahun)`;
    }
    return `Tahun ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  const handleStepMonth = (delta: number) => {
    const now = new Date();
    let m = selectedMonth === 'all' ? now.getMonth() : Number(selectedMonth);
    let y = selectedYear === 'all' ? now.getFullYear() : Number(selectedYear);
    m += delta;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setSelectedMonth(String(m));
    setSelectedYear(String(y));
  };

  const driverUrl = getDriverPortalUrl(truck);
  const waUrl = getWhatsAppShareUrl(truck, driverUrl);

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(driverUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleVerifyPinAndExit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().toUpperCase() === 'TRAKSI_001') {
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      onExitDriverMode();
    } else {
      setPinError('PIN Admin salah! Akses ditolak.');
    }
  };

  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'Fuel':
        return <Fuel className="w-3.5 h-3.5" />;
      case 'Lubricant':
        return <Droplets className="w-3.5 h-3.5" />;
      case 'Sparepart':
        return <Package className="w-3.5 h-3.5" />;
      case 'Tyre & Tubes':
        return <Disc className="w-3.5 h-3.5" />;
      case 'Workshop':
        return <Wrench className="w-3.5 h-3.5" />;
      case 'BPJS':
        return <ShieldCheck className="w-3.5 h-3.5" />;
      case 'Jamsostek':
        return <HeartHandshake className="w-3.5 h-3.5" />;
      case 'Potongan Mangkir':
        return <UserX className="w-3.5 h-3.5" />;
      case 'Beras':
        return <Wheat className="w-3.5 h-3.5" />;
      case 'Supir':
        return <UserCheck className="w-3.5 h-3.5" />;
      default:
        return <Layers className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Mobile-First Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 px-2 py-1 rounded-xl bg-white border border-emerald-500/30 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/images_70037338.jpeg"
                alt="Logo Traksi KPU"
                className="h-full w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                  TRAKSI KPU • PORTAL SUPIR
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                  Unit Terisolasi
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-white leading-tight">
                {truck.code} • <span className="font-mono text-emerald-400">{truck.plateNumber}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              title="Lihat & Download QR Code Mobil Ini"
              className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white rounded-lg border border-emerald-500/40 transition flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">QR Code</span>
            </button>
            <button
              onClick={() => onOpenAddExpense(truck.id)}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-md flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">+ Catat Biaya</span>
              <span className="sm:hidden">+ Biaya</span>
            </button>
            <button
              onClick={() => setShowPinModal(true)}
              title="Beralih ke Dashboard Admin (Perlu PIN)"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Isolation Notice Banner */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 text-emerald-200 shadow-md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Akses Khusus Unit Ini Saja ({truck.code})
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
                Anda sedang melihat portal operasional untuk Dump Truck{' '}
                <strong className="text-white font-mono">{truck.plateNumber}</strong>. Halaman ini hanya
                menampilkan catatan pengeluaran, status, dan riwayat mobil Anda. Seluruh data armada truk lain
                serta laporan keuangan induk disembunyikan demi keamanan.
              </p>
            </div>
          </div>
        </div>

        {/* Truck Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-black text-white">{truck.code}</span>
                <span className="font-mono text-sm px-2.5 py-0.5 rounded bg-black text-white font-bold border border-slate-700 shadow-inner">
                  {truck.plateNumber}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    truck.status === 'Aktif'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : truck.status === 'Perawatan'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {truck.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {truck.model} • Kapasitas {truck.capacity} • Tahun {truck.year}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Link Disalin!' : 'Salin Link Ini'}
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                Kirim via WA
              </a>
            </div>
          </div>

          {/* Key Driver Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Supir Utama</span>
              <p className="text-sm font-bold text-white mt-0.5 truncate">{truck.driverName}</p>
              {truck.phone && <p className="text-[11px] text-slate-400">{truck.phone}</p>}
            </div>
            <div className="bg-slate-800/40 p-3 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block truncate">
                Biaya ({periodLabel})
              </span>
              <p className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                {formatRupiah(periodUnitCost)}
              </p>
              <p className="text-[10px] text-slate-400">{periodExpenses.length} transaksi di periode ini</p>
            </div>
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Semua Waktu</span>
              <p className="text-sm sm:text-base font-extrabold text-white font-mono mt-0.5">
                {formatRupiah(totalUnitCost)}
              </p>
              <p className="text-[10px] text-slate-400">{unitExpenses.length} total transaksi</p>
            </div>
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Biaya Bulan Ini</span>
              <p className="text-sm sm:text-base font-extrabold text-sky-400 font-mono mt-0.5">
                {formatRupiah(currentMonthCost)}
              </p>
              <p className="text-[10px] text-slate-400">Periode berjalan</p>
            </div>
          </div>

          {/* Filter Bulan & Tahun (Melihat Biaya Bulan Sebelumnya & Tahun Sebelumnya) */}
          <div className="p-3.5 bg-slate-950/90 rounded-xl border border-emerald-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-white block">
                    Pilih Bulan & Tahun Biaya Unit ({truck.code})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Lihat riwayat biaya unit pada bulan sebelumnya maupun tahun sebelumnya
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleStepMonth(-1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
                  title="Lihat Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bulan Lalu</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setSelectedMonth(String(now.getMonth()));
                    setSelectedYear(String(now.getFullYear()));
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 transition"
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleStepMonth(1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
                  title="Lihat Bulan Berikutnya"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Pilih Bulan
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">Semua Bulan (1 Tahun Penuh)</option>
                  {INDO_MONTHS.map((mName, idx) => (
                    <option key={mName} value={String(idx)}>
                      {idx + 1}. {mName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Pilih Tahun
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">Semua Tahun</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth('all');
                    setSelectedYear('all');
                  }}
                  disabled={selectedMonth === 'all' && selectedYear === 'all'}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tampilkan Semua Periode</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Share Link Box */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[11px] font-bold text-emerald-400 shrink-0">Link Langsung Supir:</span>
              <code className="bg-slate-900 px-2 py-1 rounded text-slate-300 font-mono text-[11px] truncate select-all">
                {driverUrl}
              </code>
            </div>
            <button
              onClick={handleCopyLink}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 shrink-0 self-end sm:self-auto"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Tersalin' : 'Salin URL'}
            </button>
          </div>
        </div>

        {/* Category Breakdown Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Rincian Pengeluaran Berdasarkan Kategori ({truck.code} • {periodLabel})
            </h2>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Total Periode: {formatRupiah(periodUnitCost)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CATEGORIES.map((cat) => {
              const amount = categorySums[cat];
              const pct = periodUnitCost > 0 ? (amount / periodUnitCost) * 100 : 0;
              const colors = CATEGORY_COLORS[cat];
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(isSelected ? 'all' : cat)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className={`p-1.5 rounded-lg ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {getCategoryIcon(cat)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-medium">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-300 block">{cat}</span>
                    <span className="text-xs font-bold text-white font-mono block mt-0.5">
                      {formatRupiah(amount)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expenses List & Filter */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-800/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Riwayat Pengeluaran {truck.code}
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-400">
                  {filteredExpenses.length}
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari keterangan pengeluaran..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* List Content */}
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium">Belum ada catatan biaya untuk pencarian ini.</p>
              <button
                onClick={() => onOpenAddExpense(truck.id)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition"
              >
                + Tambah Catatan Biaya Sekarang
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredExpenses.map((exp) => {
                const colors = CATEGORY_COLORS[exp.category];
                return (
                  <div
                    key={exp.id}
                    className="p-4 hover:bg-slate-800/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors.bg} ${colors.text} border ${colors.border} flex items-center gap-1`}
                        >
                          {getCategoryIcon(exp.category)}
                          {exp.category}
                        </span>
                        <span className="text-slate-400 text-xs flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formatDateIndo(exp.date, 'long')}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-100">{exp.description}</p>

                      {exp.createdByName && (
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>Dicatat oleh: {exp.createdByName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
                      <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                        {formatRupiah(exp.amount)}
                      </span>
                      <span className="text-[10px] text-slate-400">Biaya {truck.code}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Driver Guide & Home Screen Shortcut Tip */}
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Tips untuk Supir ({truck.driverName}):
          </div>
          <p className="leading-relaxed">
            Agar tidak perlu mengetik link setiap hari, buka link ini di Google Chrome / browser HP Anda,
            lalu tekan menu titik tiga (⋮) dan pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.
            Ikon Dump Truck {truck.code} akan langsung muncul di layar HP Anda seperti aplikasi biasa!
          </p>
        </div>
      </main>

      {/* Driver Portal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/assets/aistudio/images_70037338.jpeg"
              alt="Logo Traksi KPU"
              className="h-5 w-auto rounded bg-white px-1 py-0.5 object-contain"
            />
            <span className="font-bold text-white">Traksi KPU</span> • Portal Supir TBS Sawit ({truck.code})
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPinModal(true)}
              className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Masuk sebagai Admin Pengelola
            </button>
          </div>
        </div>
      </footer>

      {/* PIN Verification Modal to Exit Driver Mode */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Verifikasi Admin Armada</h3>
                <p className="text-xs text-slate-400">Masukkan PIN Admin untuk membuka dashboard penuh.</p>
              </div>
            </div>

            <form onSubmit={handleVerifyPinAndExit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  PIN Admin
                </label>
                <input
                  type="password"
                  maxLength={32}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  autoFocus
                  placeholder="Masukkan PIN Admin"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-center text-white tracking-widest text-base font-mono focus:border-emerald-500 outline-none"
                />
                {pinError && (
                  <p className="text-xs text-rose-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {pinError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-md"
                >
                  Buka Dashboard Utama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver QR Code Modal */}
      {showQrModal && (
        <DriverQrCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          truck={truck}
        />
      )}
    </div>
  );
};
