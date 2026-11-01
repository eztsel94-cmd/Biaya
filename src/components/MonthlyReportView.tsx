import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Truck,
  Filter,
  TrendingUp,
  Layers,
  Award,
  DollarSign,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TruckUnit, ExpenseRecord, ExpenseCategory } from '../types/truck';
import { CATEGORIES } from '../data/initialData';
import { formatRupiah as formatIDR } from '../utils/formatters';

interface MonthlyReportViewProps {
  trucks: TruckUnit[];
  expenses: ExpenseRecord[];
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const MONTH_NAMES_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const UNIT_COLORS = [
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#ef4444', // Red
  '#14b8a6', // Teal
];

const CATEGORY_HEX_COLORS: Record<ExpenseCategory, string> = {
  Fuel: '#10b981',
  Lubricant: '#3b82f6',
  Sparepart: '#f59e0b',
  'Tyre & Tubes': '#06b6d4',
  Workshop: '#a855f7',
  BPJS: '#0ea5e9',
  Jamsostek: '#6366f1',
  'Potongan Mangkir': '#f43f5e',
  Beras: '#84cc16',
  Supir: '#f97316',
};

const EXPENSE_CATEGORIES = CATEGORIES.map((cat) => ({
  value: cat,
  label: cat,
}));

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  trucks,
  expenses,
}) => {
  const currentYear = new Date().getFullYear().toString();

  // Mode perbandingan: berdasarkan UNIT DT atau KATEGORI BIAYA
  const [groupBy, setGroupBy] = useState<'UNIT' | 'CATEGORY'>('UNIT');
  const [chartStackMode, setChartStackMode] = useState<'grouped' | 'stacked'>('grouped');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Daftar tahun dinamis
  const availableYears = useMemo(() => {
    const years = new Set<string>([
      currentYear,
      (Number(currentYear) - 1).toString(),
      (Number(currentYear) - 2).toString(),
    ]);
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 4) {
        years.add(e.date.substring(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [expenses, currentYear]);

  // Filter pengeluaran berdasarkan tahun, unit, dan kategori
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchYear = selectedYear === 'ALL' || e.date.startsWith(selectedYear);
      const matchTruck = selectedTruckId === 'ALL' || e.truckId === selectedTruckId;
      const matchCategory = selectedCategory === 'ALL' || e.category === selectedCategory;
      return matchYear && matchTruck && matchCategory;
    });
  }, [expenses, selectedYear, selectedTruckId, selectedCategory]);

  // Data Grafik Bulanan (Jan - Des) untuk Recharts
  const monthlyChartData = useMemo(() => {
    return MONTH_NAMES_SHORT.map((monthShort, index) => {
      const monthNum = String(index + 1).padStart(2, '0');
      const monthExpenses = filteredExpenses.filter((e) => {
        const parts = e.date.split('-');
        return parts[1] === monthNum;
      });

      const row: Record<string, any> = {
        name: monthShort,
        fullName: MONTH_NAMES_FULL[index],
        monthNum,
        Total: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      };

      // Breakdown per Unit DT
      trucks.forEach((t) => {
        const unitSum = monthExpenses
          .filter((e) => e.truckId === t.id)
          .reduce((sum, e) => sum + e.amount, 0);
        row[t.code] = unitSum;
      });

      // Breakdown per Kategori Biaya
      EXPENSE_CATEGORIES.forEach((cat) => {
        const catSum = monthExpenses
          .filter((e) => e.category === cat.value)
          .reduce((sum, e) => sum + e.amount, 0);
        row[cat.value] = catSum;
      });

      return row;
    });
  }, [filteredExpenses, trucks]);

  // Data Grafik Perbandingan Total per Unit DT
  const unitComparisonData = useMemo(() => {
    return trucks
      .map((t, index) => {
        const unitExpenses = filteredExpenses.filter((e) => e.truckId === t.id);
        const total = unitExpenses.reduce((sum, e) => sum + e.amount, 0);
        return {
          id: t.id,
          code: t.code,
          plateNumber: t.plateNumber,
          driverName: t.driverName,
          total,
          count: unitExpenses.length,
          color: UNIT_COLORS[index % UNIT_COLORS.length],
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [trucks, filteredExpenses]);

  // Statistik Ringkasan
  const summaryStats = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const activeMonths = monthlyChartData.filter((m) => m.Total > 0);
    const highestMonth = [...monthlyChartData].sort((a, b) => b.Total - a.Total)[0];
    const highestUnit = unitComparisonData[0];

    return {
      totalAmount,
      transactionCount: filteredExpenses.length,
      avgPerMonth: activeMonths.length > 0 ? totalAmount / activeMonths.length : 0,
      highestMonth: highestMonth && highestMonth.Total > 0 ? highestMonth : null,
      highestUnit: highestUnit && highestUnit.total > 0 ? highestUnit : null,
    };
  }, [filteredExpenses, monthlyChartData, unitComparisonData]);

  // Ekspor Laporan Bulanan ke Excel
  const handleExportExcel = () => {
    const rows = monthlyChartData.map((m) => {
      const base: Record<string, any> = {
        Bulan: m.fullName,
        Tahun: selectedYear === 'ALL' ? 'Semua Tahun' : selectedYear,
      };
      trucks.forEach((t) => {
        base[t.code] = m[t.code] || 0;
      });
      base['Total Biaya Operasional (IDR)'] = m.Total;
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Laporan Bulanan ${selectedYear}`);
    XLSX.writeFile(wb, `Laporan_Bulanan_DT_${selectedYear}.xlsx`);
  };

  // Format angka singkat di sumbu Y (misal Rp 1,5 Jt / Rp 500 Rb)
  const formatYAxis = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} M`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Jt`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)} Rb`;
    return `${value}`;
  };

  // Custom Tooltip untuk Recharts
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const monthRow = monthlyChartData.find((m) => m.name === label);

    return (
      <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-white text-sm">
            {monthRow ? monthRow.fullName : label} {selectedYear !== 'ALL' ? selectedYear : ''}
          </span>
          {monthRow && (
            <span className="font-mono font-bold text-amber-400">
              {formatIDR(monthRow.Total)}
            </span>
          )}
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {payload
            .filter((entry: any) => entry.value > 0)
            .sort((a: any, b: any) => b.value - a.value)
            .map((entry: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-slate-300 font-medium">{entry.name}</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {formatIDR(entry.value)}
                </span>
              </div>
            ))}
          {payload.every((entry: any) => entry.value === 0) && (
            <p className="text-slate-500 italic">Belum ada biaya tercatat di bulan ini</p>
          )}
        </div>
      </div>
    );
  };

  const visibleTrucks = useMemo(() => {
    if (selectedTruckId === 'ALL') return trucks;
    return trucks.filter((t) => t.id === selectedTruckId);
  }, [trucks, selectedTruckId]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analitik & Rekapitulasi Biaya Operasional</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Laporan Bulanan Biaya Operasional DT / Unit
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Grafik batang perbandingan biaya operasional bulanan berdasarkan Unit DT dan Kategori Pengeluaran
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tombol Mode Perbandingan */}
            <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setGroupBy('UNIT')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  groupBy === 'UNIT'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Per Unit DT</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('CATEGORY')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  groupBy === 'CATEGORY'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Per Kategori Biaya</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Tahun, Unit DT, Kategori & Tampilan Grafik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
          {/* Tahun */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Tahun Laporan
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-amber-500"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
              <option value="ALL">Semua Tahun (Akumulasi)</option>
            </select>
          </div>

          {/* Filter Unit DT */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              Filter Unit DT / Armada
            </label>
            <select
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">Semua Unit DT ({trucks.length} Unit)</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.plateNumber} ({t.driverName})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Kategori */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              Filter Kategori Biaya
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">Semua Kategori Biaya</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Gaya Grafik Batang */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              Tampilan Grafik Batang
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setChartStackMode('grouped')}
                className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartStackMode === 'grouped'
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Berjejer
              </button>
              <button
                type="button"
                onClick={() => setChartStackMode('stacked')}
                className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartStackMode === 'stacked'
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bertumpuk
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Ringkasan Bulanan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>TOTAL BIAYA ({selectedYear === 'ALL' ? 'SEMUA TAHUN' : `TAHUN ${selectedYear}`})</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white font-mono">
            {formatIDR(summaryStats.totalAmount)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Dari {summaryStats.transactionCount} catatan pengeluaran
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>RATA-RATA BIAYA PER BULAN</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {formatIDR(Math.round(summaryStats.avgPerMonth))}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Rata-rata pada bulan aktif operasional
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>BULAN BIAYA TERTINGGI</span>
            <Calendar className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-white">
            {summaryStats.highestMonth ? summaryStats.highestMonth.fullName : 'Belum Ada Data'}
          </p>
          <p className="text-xs text-rose-400 font-mono font-bold mt-1">
            {summaryStats.highestMonth ? formatIDR(summaryStats.highestMonth.Total) : 'Rp 0'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>UNIT DT BIAYA TERTINGGI</span>
            <Award className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-white">
            {summaryStats.highestUnit ? `${summaryStats.highestUnit.code} (${summaryStats.highestUnit.plateNumber})` : 'Belum Ada Data'}
          </p>
          <p className="text-xs text-sky-400 font-mono font-bold mt-1">
            {summaryStats.highestUnit ? formatIDR(summaryStats.highestUnit.total) : 'Rp 0'}
          </p>
        </div>
      </div>

      {/* GRAFIK BATANG UTAMA: PERBANDINGAN BIAYA BULANAN (Jan - Des) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <span>
                Grafik Batang Perbandingan Biaya Bulanan{' '}
                {groupBy === 'UNIT' ? 'Berdasarkan Unit DT' : 'Berdasarkan Kategori Biaya'} (
                {selectedYear === 'ALL' ? 'Semua Tahun' : `Tahun ${selectedYear}`})
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Arahkan kursor atau ketuk batang grafik untuk melihat rincian nominal rupiah setiap bulan
            </p>
          </div>
        </div>

        <div className="h-80 sm:h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyChartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }}
              />
              <YAxis
                stroke="#94a3b8"
                tickFormatter={formatYAxis}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={65}
              />
              <Tooltip content={renderCustomTooltip} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend
                wrapperStyle={{ paddingTop: '14px', fontSize: '12px' }}
              />

              {groupBy === 'UNIT'
                ? visibleTrucks.map((truck, idx) => (
                    <Bar
                      key={truck.id}
                      dataKey={truck.code}
                      name={`${truck.code} (${truck.plateNumber})`}
                      stackId={chartStackMode === 'stacked' ? 'stack' : undefined}
                      fill={UNIT_COLORS[idx % UNIT_COLORS.length]}
                      radius={chartStackMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    />
                  ))
                : EXPENSE_CATEGORIES.filter(
                    (c) => selectedCategory === 'ALL' || c.value === selectedCategory
                  ).map((cat) => (
                    <Bar
                      key={cat.value}
                      dataKey={cat.value}
                      name={cat.label}
                      stackId={chartStackMode === 'stacked' ? 'stack' : undefined}
                      fill={CATEGORY_HEX_COLORS[cat.value]}
                      radius={chartStackMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    />
                  ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRAFIK KEDUA: PERBANDINGAN TOTAL BIAYA ANTAR UNIT DT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Perbandingan Total Biaya per Unit DT</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Total akumulasi biaya operasional masing-masing unit pada periode terpilih
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={unitComparisonData}
                layout="vertical"
                margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tickFormatter={formatYAxis}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="code"
                  stroke="#94a3b8"
                  tick={{ fill: '#f8fafc', fontSize: 12, fontWeight: 700 }}
                  width={75}
                />
                <Tooltip
                  formatter={(value: any) => [formatIDR(Number(value)), 'Total Biaya']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="total" name="Total Biaya Unit" radius={[0, 6, 6, 0]}>
                  {unitComparisonData.map((entry, idx) => (
                    <Cell key={entry.id} fill={entry.color || UNIT_COLORS[idx % UNIT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kartu Peringkat Biaya Unit DT */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Rincian Biaya per Unit DT ({selectedYear === 'ALL' ? 'Semua Tahun' : selectedYear})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Urutan unit berdasarkan total pengeluaran operasional
            </p>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-72 pr-1">
            {unitComparisonData.map((u, idx) => {
              const pct =
                summaryStats.totalAmount > 0
                  ? Math.round((u.total / summaryStats.totalAmount) * 100)
                  : 0;
              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-slate-950"
                        style={{ backgroundColor: u.color }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{u.code}</span>
                          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {u.plateNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Supir: {u.driverName}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-amber-400">
                        {formatIDR(u.total)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {u.count} transaksi ({pct}%)
                      </p>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(pct, u.total > 0 ? 4 : 0)}%`,
                        backgroundColor: u.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TABEL MATRIKS REKAPITULASI BULANAN PER UNIT DT */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">
              Tabel Matriks Biaya Bulanan per Unit DT ({selectedYear === 'ALL' ? 'Semua Tahun' : `Tahun ${selectedYear}`})
            </h3>
            <p className="text-xs text-slate-400">
              Rekapitulasi detail pengeluaran bulanan dari Januari hingga Desember
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                <th className="py-3.5 px-4">Bulan</th>
                {visibleTrucks.map((t) => (
                  <th key={t.id} className="py-3.5 px-4 text-right">
                    {t.code}
                  </th>
                ))}
                <th className="py-3.5 px-4 text-right text-amber-400">Total Bulanan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
              {monthlyChartData.map((row) => (
                <tr
                  key={row.monthNum}
                  className={`hover:bg-slate-800/40 transition ${
                    row.Total > 0 ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  <td className="py-3 px-4 font-semibold text-white">{row.fullName}</td>
                  {visibleTrucks.map((t) => {
                    const val = row[t.code] || 0;
                    return (
                      <td key={t.id} className="py-3 px-4 text-right font-mono">
                        {val > 0 ? formatIDR(val) : '-'}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                    {row.Total > 0 ? formatIDR(row.Total) : 'Rp 0'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-950 font-bold text-xs sm:text-sm text-white">
                <td className="py-3.5 px-4 uppercase tracking-wider text-amber-400">
                  Total Tahun {selectedYear === 'ALL' ? '' : selectedYear}
                </td>
                {visibleTrucks.map((t) => {
                  const unitTotal = monthlyChartData.reduce(
                    (sum, m) => sum + (m[t.code] || 0),
                    0
                  );
                  return (
                    <td key={t.id} className="py-3.5 px-4 text-right font-mono text-emerald-400">
                      {formatIDR(unitTotal)}
                    </td>
                  );
                })}
                <td className="py-3.5 px-4 text-right font-mono text-base text-amber-400">
                  {formatIDR(summaryStats.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
