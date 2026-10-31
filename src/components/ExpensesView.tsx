import React, { useState, useMemo } from 'react';
import { TruckUnit, ExpenseRecord, ExpenseCategory, FilterOptions, AppUser } from '../types/truck';
import { formatRupiah, formatNumber, formatDateIndo, exportExpensesToCSV, exportExpensesToExcel } from '../utils/formatters';
import { CATEGORIES, CATEGORY_COLORS } from '../data/initialData';
import {
  FileText,
  Filter,
  Search,
  PlusCircle,
  Download,
  Trash2,
  Edit2,
  Calendar,
  X,
  Check,
  AlertCircle,
  Truck,
  RotateCcw,
  Lock,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';

interface ExpensesViewProps {
  trucks: TruckUnit[];
  expenses: ExpenseRecord[];
  currentUser: AppUser;
  onAddExpense: (newExpense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  onUpdateExpense: (updatedExpense: ExpenseRecord) => void;
  onDeleteExpense: (expenseId: string) => void;
  initialFilterTruckId?: string;
  initialFilterCategory?: string;
  onOpenExcelImport?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  trucks,
  expenses,
  currentUser,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  initialFilterTruckId = 'all',
  initialFilterCategory = 'all',
  onOpenExcelImport,
}) => {
  // Form state for creating new expense
  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    date: todayStr,
    truckId: trucks[0]?.id || '',
    category: 'Minyak' as ExpenseCategory,
    description: '',
    amount: '',
    vendor: '',
    invoiceNumber: '',
  });

  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Expense modal state
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter state
  const [selectedTruckFilter, setSelectedTruckFilter] = useState<string>(initialFilterTruckId);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(initialFilterCategory);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Handle Form Submit
  const handleSaveNewExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseFloat(formData.amount.replace(/[^0-9]/g, ''));
    if (!formData.truckId) {
      setFormError('Silakan pilih Unit Truk');
      return;
    }
    if (!formData.description.trim()) {
      setFormError('Keterangan pengeluaran wajib diisi');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Jumlah biaya (Rp) harus lebih dari 0');
      return;
    }
    if (!formData.vendor.trim()) {
      setFormError('Nama vendor / bengkel / SPBU wajib diisi');
      return;
    }

    onAddExpense({
      date: formData.date,
      truckId: formData.truckId,
      category: formData.category,
      description: formData.description.trim(),
      amount: parsedAmount,
      vendor: formData.vendor.trim(),
      invoiceNumber: formData.invoiceNumber.trim() || undefined,
    });

    // Reset form
    setFormData((prev) => ({
      ...prev,
      description: '',
      amount: '',
      vendor: '',
      invoiceNumber: '',
    }));

    const unitObj = trucks.find((t) => t.id === formData.truckId);
    setFormSuccessMessage(`Biaya berhasil dicatat untuk ${unitObj?.code || 'Unit Truk'}!`);
    setTimeout(() => {
      setFormSuccessMessage(null);
    }, 4000);
  };

  // Filtered expenses calculation
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      // Filter truck
      if (selectedTruckFilter !== 'all' && item.truckId !== selectedTruckFilter) {
        return false;
      }
      // Filter category
      if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) {
        return false;
      }
      // Filter date range
      if (startDate && item.date < startDate) {
        return false;
      }
      if (endDate && item.date > endDate) {
        return false;
      }
      // Filter search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const trk = trucks.find((t) => t.id === item.truckId);
        const matchDesc = item.description.toLowerCase().includes(query);
        const matchVendor = item.vendor.toLowerCase().includes(query);
        const matchInv = (item.invoiceNumber || '').toLowerCase().includes(query);
        const matchCode = (trk?.code || '').toLowerCase().includes(query);
        const matchPlate = (trk?.plateNumber || '').toLowerCase().includes(query);
        const matchDriver = (trk?.driverName || '').toLowerCase().includes(query);

        if (!matchDesc && !matchVendor && !matchInv && !matchCode && !matchPlate && !matchDriver) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedTruckFilter, selectedCategoryFilter, searchTerm, startDate, endDate, trucks]);

  const visibleTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  const resetFilters = () => {
    setSelectedTruckFilter('all');
    setSelectedCategoryFilter('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const isFiltered =
    selectedTruckFilter !== 'all' ||
    selectedCategoryFilter !== 'all' ||
    searchTerm.trim() !== '' ||
    startDate !== '' ||
    endDate !== '';

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-emerald-400" />
              Catatan Biaya Operasional Truk TBS
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Formulir & Tabel
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Input pengeluaran baru dan pantau rekapitulasi biaya per unit truk sawit dengan filter interaktif.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {currentUser.role !== 'viewer' && onOpenExcelImport && (
            <button
              onClick={onOpenExcelImport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded-xl font-semibold text-xs sm:text-sm border border-emerald-500/50 hover:border-emerald-400 transition shadow-sm"
              title="Import data pengeluaran dari Excel atau tempel tabel Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Import / Tempel Excel</span>
            </button>
          )}

          <button
            onClick={() => exportExpensesToExcel(filteredExpenses, trucks)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs sm:text-sm border border-emerald-600 transition shadow-sm"
            title="Unduh laporan dalam format Microsoft Excel (.xlsx)"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportExpensesToCSV(filteredExpenses, trucks)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs sm:text-sm border border-slate-700 transition"
            title="Unduh laporan dalam format CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* FORMULIR CATAT PENGELUARAN BARU */}
      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Formulir Pengeluaran Baru</h2>
              <p className="text-xs text-slate-400">
                Data yang disimpan akan langsung terakumulasi pada Dashboard & Unit Truk
              </p>
            </div>
          </div>

          {currentUser.role !== 'viewer' && onOpenExcelImport && (
            <button
              type="button"
              onClick={onOpenExcelImport}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Punya banyak data? Tempel langsung dari Excel</span>
            </button>
          )}
        </div>

        {formSuccessMessage && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{formSuccessMessage}</span>
          </div>
        )}

        {formError && (
          <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSaveNewExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tanggal */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tanggal Transaksi *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Unit Truk */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Pilih Unit Truk TBS *
            </label>
            <select
              value={formData.truckId}
              onChange={(e) => setFormData({ ...formData, truckId: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.code} — {truck.plateNumber} ({truck.driverName})
                </option>
              ))}
            </select>
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Kategori Biaya *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Keterangan */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Keterangan Pengeluaran *
            </label>
            <input
              type="text"
              placeholder="Contoh: Pengisian Solar 120 Liter, Ganti Ban Belakang, Servis Rem, Upah Ritase"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Jumlah / Biaya (IDR) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Jumlah Biaya (Rp) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                min="1000"
                step="500"
                placeholder="500000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Vendor / Bengkel / SPBU */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Vendor / SPBU / Bengkel *
            </label>
            <input
              type="text"
              placeholder="Contoh: SPBU 14.284.114, Toko Sparepart Riau, Bengkel Berkah"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* No. Nota / Kuitansi (Opsional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              No. Nota / Kuitansi (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: INV-2026-091 atau SPBU-129"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Submit Button */}
          <div className="sm:col-span-2 lg:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Simpan Catatan Biaya
            </button>
          </div>
        </form>
      </div>

      {/* FILTER & PENCARIAN PANEL */}
      <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Filter & Pencarian Catatan</h3>
            {isFiltered && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Filter Aktif
              </span>
            )}
          </div>

          {/* Summary of Visible Filtered Amount */}
          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400">Total Terlihat:</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {formatRupiah(visibleTotal)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({filteredExpenses.length} catatan)
            </span>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Unit Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Filter Unit Truk
            </label>
            <select
              value={selectedTruckFilter}
              onChange={(e) => setSelectedTruckFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Unit ({trucks.length})</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.plateNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Filter Kategori
            </label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Kategori ({CATEGORIES.length})</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Cari Kata Kunci
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Vendor, sparepart, nota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* End Date & Reset */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Sampai Tanggal
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              {isFiltered && (
                <button
                  onClick={resetFilters}
                  title="Reset semua filter"
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TABEL & DAFTAR SEMUA CATATAN BIAYA */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Daftar Catatan Pengeluaran</span>
            <span className="text-xs text-slate-400 font-mono">
              ({filteredExpenses.length} dari {expenses.length} data)
            </span>
          </div>

          <span className="text-xs text-slate-400">
            Total Ditampilkan: <strong className="text-emerald-400 font-mono">{formatRupiah(visibleTotal)}</strong>
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 font-semibold text-sm">Tidak ada catatan biaya yang cocok.</p>
            <p className="text-slate-500 text-xs mt-1">
              Coba sesuaikan filter pencarian atau buat catatan baru di formulir atas.
            </p>
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="mt-3 px-3 py-1.5 bg-slate-800 text-emerald-400 text-xs font-semibold rounded-lg hover:bg-slate-700 transition"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Mobile View: High density cards for smartphone (md:hidden) */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {filteredExpenses.map((item) => {
                const truck = trucks.find((t) => t.id === item.truckId);
                const colors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Sparepart;

                return (
                  <div key={item.id} className="p-4 space-y-2.5 hover:bg-slate-800/30 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">{truck?.code || 'Unit'}</span>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {truck?.plateNumber || '-'}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
                      >
                        {item.category}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-200 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono text-slate-400">{formatDateIndo(item.date)}</span>
                      <span>•</span>
                      <span className="text-slate-300 truncate max-w-[150px]">{item.vendor}</span>
                      {item.invoiceNumber && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                            Nota: {item.invoiceNumber}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Nominal Biaya:</span>
                        <span className="font-bold text-emerald-400 font-mono text-sm">
                          {formatRupiah(item.amount)}
                        </span>
                      </div>

                      {currentUser.role === 'admin' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingExpense(item)}
                            title="Edit Catatan"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            title="Hapus Catatan"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          title="Hanya Role Admin yang berwenang mengubah biaya"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60 text-[10px]"
                        >
                          <Lock className="w-3 h-3 text-amber-400/80" />
                          <span>Terkunci</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Data Table (hidden on mobile, block on md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-semibold">Tanggal</th>
                    <th className="py-3 px-4 font-semibold">Unit Truk</th>
                    <th className="py-3 px-4 font-semibold">Kategori</th>
                    <th className="py-3 px-4 font-semibold">Keterangan</th>
                    <th className="py-3 px-4 font-semibold">Vendor / Bengkel</th>
                    <th className="py-3 px-4 font-semibold">No Nota</th>
                    <th className="py-3 px-4 font-semibold text-right">Jumlah Biaya</th>
                    <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredExpenses.map((item) => {
                    const truck = trucks.find((t) => t.id === item.truckId);
                    const colors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Sparepart;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap font-mono text-[11px]">
                          {formatDateIndo(item.date)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{truck?.code || 'Unit'}</span>
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                              {truck?.plateNumber || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-200 min-w-[200px] max-w-xs">
                          <p className="line-clamp-2">{item.description}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {item.vendor}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                          {item.invoiceNumber || '-'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-bold text-emerald-400 font-mono text-sm">
                            {formatRupiah(item.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {currentUser.role === 'admin' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingExpense(item)}
                                title="Edit Catatan (Khusus Role Admin)"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(item.id)}
                                title="Hapus Catatan (Khusus Role Admin)"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              title={`Akses Terbatas: Hanya Role Admin yang berwenang mengubah data biaya ini. Role aktif Anda: ${currentUser.roleLabel}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60 text-[10px] cursor-not-allowed"
                            >
                              <Lock className="w-3 h-3 text-amber-400/80" />
                              <span>Terkunci</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                Ubah Catatan Biaya
              </h3>
              <button
                onClick={() => setEditingExpense(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateExpense(editingExpense);
                setEditingExpense(null);
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tanggal</label>
                <input
                  type="date"
                  value={editingExpense.date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Unit Truk</label>
                <select
                  value={editingExpense.truckId}
                  onChange={(e) => setEditingExpense({ ...editingExpense, truckId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.plateNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Kategori</label>
                <select
                  value={editingExpense.category}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, category: e.target.value as ExpenseCategory })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Keterangan</label>
                <input
                  type="text"
                  value={editingExpense.description}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, description: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Jumlah Biaya (Rp)</label>
                <input
                  type="number"
                  value={editingExpense.amount}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vendor / Bengkel</label>
                <input
                  type="text"
                  value={editingExpense.vendor}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, vendor: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">No. Nota / Kuitansi</label>
                <input
                  type="text"
                  value={editingExpense.invoiceNumber || ''}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, invoiceNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Hapus Catatan Biaya?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Catatan biaya ini akan dihapus secara permanen dan total pengeluaran unit akan diperbarui.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteExpense(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
