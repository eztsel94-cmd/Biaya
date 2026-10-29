import React from 'react';
import { TruckUnit, ExpenseRecord, ExpenseCategory } from '../types/truck';
import { formatRupiah, formatNumber, formatDateIndo } from '../utils/formatters';
import { CATEGORY_COLORS, CATEGORIES } from '../data/initialData';
import {
  TrendingUp,
  Truck,
  Wrench,
  Fuel,
  Droplets,
  UserCheck,
  Package,
  Layers,
  ArrowRight,
  PlusCircle,
  Database,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface DashboardViewProps {
  trucks: TruckUnit[];
  expenses: ExpenseRecord[];
  onSelectTruck: (truckId: string) => void;
  onOpenAddExpense: (defaultTruckId?: string) => void;
  onOpenDataManager: () => void;
  onNavigateToExpenses: (filterCategory?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  trucks,
  expenses,
  onSelectTruck,
  onOpenAddExpense,
  onOpenDataManager,
  onNavigateToExpenses,
}) => {
  // Calculations
  const totalCost = expenses.reduce((sum, item) => sum + item.amount, 0);
  const truckCount = trucks.length;
  const avgCostPerTruck = truckCount > 0 ? totalCost / truckCount : 0;
  const totalTransactions = expenses.length;

  // Breakdown by category
  const categoryTotals = CATEGORIES.reduce((acc, cat) => {
    const total = expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0);
    const count = expenses.filter((e) => e.category === cat).length;
    acc[cat] = { total, count, percent: totalCost > 0 ? (total / totalCost) * 100 : 0 };
    return acc;
  }, {} as Record<ExpenseCategory, { total: number; count: number; percent: number }>);

  // Highest category
  const sortedCategories = [...CATEGORIES].sort(
    (a, b) => (categoryTotals[b]?.total || 0) - (categoryTotals[a]?.total || 0)
  );
  const topCategory = sortedCategories[0];

  // Truck expenses breakdown map
  const truckExpenseMap = trucks.map((truck) => {
    const truckExpenses = expenses.filter((e) => e.truckId === truck.id);
    const unitTotal = truckExpenses.reduce((sum, e) => sum + e.amount, 0);
    const percentOfAll = totalCost > 0 ? (unitTotal / totalCost) * 100 : 0;

    const byCat = CATEGORIES.reduce((acc, cat) => {
      acc[cat] = truckExpenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      return acc;
    }, {} as Record<ExpenseCategory, number>);

    return {
      truck,
      unitTotal,
      percentOfAll,
      byCat,
      count: truckExpenses.length,
    };
  });

  // Recent 6 records
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'Sparepart':
        return <Package className="w-4 h-4" />;
      case 'Oli':
        return <Droplets className="w-4 h-4" />;
      case 'Minyak':
        return <Fuel className="w-4 h-4" />;
      case 'Mekanik':
        return <Wrench className="w-4 h-4" />;
      case 'Supir':
        return <UserCheck className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome & Quick Info Bar */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Armada TBS Siap Operasi
              </span>
              <span className="text-xs text-slate-400">
                Data Aktif: <strong className="text-slate-200">{truckCount} Unit Truk</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Dashboard Biaya Truk TBS Harbor Homes
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Pemantauan pengeluaran armada pengangkut Tandan Buah Segar kelapa sawit secara real-time mencakup Sparepart, Oli, Solar (Minyak), Jasa Mekanik, dan Upah Supir.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => onOpenAddExpense()}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm transition shadow-lg shadow-emerald-500/25"
            >
              <PlusCircle className="w-4 h-4" />
              Catat Pengeluaran
            </button>
            <button
              onClick={onOpenDataManager}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-sm border border-slate-700 transition"
              title="Kelola unit truk (Unit 01, Unit 90, Unit 03)"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              Data Manager
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Biaya Armada
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white tracking-tight">
            {formatRupiah(totalCost)}
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{totalTransactions} Transaksi</span>
            <span>tercatat di sistem</span>
          </p>
        </div>

        {/* Jumlah Unit */}
        <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Jumlah Unit Armada
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
            <span>{truckCount} Unit</span>
            <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Truk TBS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Termasuk <strong className="text-slate-200">Unit 90</strong> (BM 8456 TBS)
          </p>
        </div>

        {/* Rata-rata Biaya per Unit */}
        <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Rata-rata Biaya / Unit
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white tracking-tight">
            {formatRupiah(avgCostPerTruck)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Rerata alokasi per unit truk TBS
          </p>
        </div>

        {/* Kategori Pengeluaran Terbesar */}
        <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Biaya Tertinggi
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              {getCategoryIcon(topCategory)}
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-400 tracking-tight">
            {topCategory || '-'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {formatRupiah(categoryTotals[topCategory]?.total || 0)} (
            {(categoryTotals[topCategory]?.percent || 0).toFixed(1)}% total)
          </p>
        </div>
      </div>

      {/* Rincian Biaya per Kategori (Sparepart, Oli, Minyak, Mekanik, Supir) */}
      <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Rincian Biaya per Kategori Operasional
            </h2>
            <p className="text-xs text-slate-400">
              Alokasi pengeluaran untuk 5 pos biaya: Sparepart, Oli, Solar (Minyak), Jasa Mekanik, dan Upah Supir
            </p>
          </div>
          <button
            onClick={() => onNavigateToExpenses()}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            Lihat Semua Rincian <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Cards with progress bars */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {CATEGORIES.map((cat) => {
            const data = categoryTotals[cat];
            const colors = CATEGORY_COLORS[cat];
            return (
              <div
                key={cat}
                onClick={() => onNavigateToExpenses(cat)}
                className={`p-4 rounded-xl border ${colors.border} ${colors.bg} cursor-pointer hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${colors.text} flex items-center gap-1.5`}>
                    {getCategoryIcon(cat)}
                    {cat}
                  </span>
                  <span className="text-[11px] font-mono font-medium text-slate-400">
                    {data.count} nota
                  </span>
                </div>
                <div className="text-lg font-bold text-white mb-2">
                  {formatRupiah(data.total)}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(data.percent, 3)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-medium">
                  <span>Porsi Anggaran</span>
                  <span className="font-bold text-slate-200">{data.percent.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Tabel Biaya Tiap Unit & Catatan Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabel Biaya Tiap Unit (2 Cols on lg) */}
        <div className="lg:col-span-2 bg-slate-900/80 rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  Tabel Biaya Tiap Unit Truk TBS
                </h2>
                <p className="text-xs text-slate-400">
                  Perbandingan beban operasional masing-masing unit ({truckCount} unit terdaftar)
                </p>
              </div>
              <button
                onClick={onOpenDataManager}
                className="text-xs text-slate-400 hover:text-emerald-400 font-medium flex items-center gap-1"
              >
                <Database className="w-3.5 h-3.5" />
                Edit Unit
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-semibold">Unit & Plat</th>
                    <th className="pb-3 font-semibold">Supir</th>
                    <th className="pb-3 font-semibold text-right">Sparepart</th>
                    <th className="pb-3 font-semibold text-right">Oli</th>
                    <th className="pb-3 font-semibold text-right">Minyak (BBM)</th>
                    <th className="pb-3 font-semibold text-right">Mekanik</th>
                    <th className="pb-3 font-semibold text-right">Supir</th>
                    <th className="pb-3 font-semibold text-right">Total Biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {truckExpenseMap.map(({ truck, unitTotal, percentOfAll, byCat }) => (
                    <tr
                      key={truck.id}
                      onClick={() => onSelectTruck(truck.id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400 group-hover:underline">
                            {truck.code}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700">
                            {truck.plateNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{truck.model}</div>
                      </td>
                      <td className="py-3.5">
                        <div className="text-slate-200 font-semibold">{truck.driverName}</div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
                            truck.status === 'Aktif'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : truck.status === 'Perawatan'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {truck.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-300">
                        {formatNumber(byCat.Sparepart)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-300">
                        {formatNumber(byCat.Oli)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-300">
                        {formatNumber(byCat.Minyak)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-300">
                        {formatNumber(byCat.Mekanik)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-300">
                        {formatNumber(byCat.Supir)}
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="font-bold text-emerald-400 font-mono text-sm">
                          {formatRupiah(unitTotal)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {percentOfAll.toFixed(1)}% total
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>* Klik baris unit truk untuk melihat kartu & riwayat biaya detail</span>
            <button
              onClick={() => onSelectTruck(trucks[0]?.id || '')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              Buka Halaman Unit Truk <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Catatan Biaya Terbaru (1 Col on lg) */}
        <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  Catatan Terbaru
                </h2>
                <p className="text-xs text-slate-400">Pengeluaran terkini yang diinput</p>
              </div>
              <button
                onClick={() => onNavigateToExpenses()}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Semua ({totalTransactions})
              </button>
            </div>

            <div className="space-y-3">
              {recentExpenses.map((exp) => {
                const truck = trucks.find((t) => t.id === exp.truckId);
                const colors = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Sparepart;
                return (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{truck?.code || 'Unit'}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {exp.category}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-emerald-400">
                        {formatRupiah(exp.amount)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-1 mb-1">
                      {exp.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[150px]">{exp.vendor}</span>
                      <span>{formatDateIndo(exp.date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800">
            <button
              onClick={() => onOpenAddExpense()}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition border border-slate-700"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              Tambah Catatan Biaya Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
