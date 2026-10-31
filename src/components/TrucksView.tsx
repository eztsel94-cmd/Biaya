import React, { useState } from 'react';
import { TruckUnit, ExpenseRecord, ExpenseCategory } from '../types/truck';
import { formatRupiah, formatNumber, formatDateIndo } from '../utils/formatters';
import { CATEGORIES, CATEGORY_COLORS } from '../data/initialData';
import { getDriverPortalUrl, getWhatsAppShareUrl } from '../utils/driverLink';
import {
  Truck,
  User,
  ShieldCheck,
  Wrench,
  Fuel,
  Droplets,
  Package,
  UserCheck,
  PlusCircle,
  FileText,
  Calendar,
  X,
  Database,
  ExternalLink,
  Info,
  Layers,
  ChevronRight,
  TrendingUp,
  Link2,
  Copy,
  Check,
  Share2,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  HeartHandshake,
  UserX,
} from 'lucide-react';

interface TrucksViewProps {
  trucks: TruckUnit[];
  expenses: ExpenseRecord[];
  onOpenAddExpense: (defaultTruckId?: string) => void;
  onOpenDataManager: () => void;
  onNavigateToExpensesWithFilter: (truckId: string) => void;
  onOpenDriverPortal: (truckId: string) => void;
  onOpenExcelImport?: (truckId?: string) => void;
  onDeleteTruck?: (truckId: string, deleteRelated: boolean) => void;
}

export const TrucksView: React.FC<TrucksViewProps> = ({
  trucks,
  expenses,
  onOpenAddExpense,
  onOpenDataManager,
  onNavigateToExpensesWithFilter,
  onOpenDriverPortal,
  onOpenExcelImport,
  onDeleteTruck,
}) => {
  const [selectedTruckForDetail, setSelectedTruckForDetail] = useState<TruckUnit | null>(null);
  const [copiedTruckId, setCopiedTruckId] = useState<string | null>(null);
  const [truckToDelete, setTruckToDelete] = useState<TruckUnit | null>(null);
  const [deleteRelated, setDeleteRelated] = useState<boolean>(true);

  const totalAllCost = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleCopyLink = (url: string, truckId: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    setCopiedTruckId(truckId);
    setTimeout(() => {
      setCopiedTruckId((curr) => (curr === truckId ? null : curr));
    }, 2500);
  };

  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'Sparepart':
        return <Package className="w-3.5 h-3.5" />;
      case 'Oli':
        return <Droplets className="w-3.5 h-3.5" />;
      case 'Minyak':
        return <Fuel className="w-3.5 h-3.5" />;
      case 'Mekanik':
        return <Wrench className="w-3.5 h-3.5" />;
      case 'Supir':
        return <UserCheck className="w-3.5 h-3.5" />;
      case 'Tunjangan BPJS':
        return <ShieldCheck className="w-3.5 h-3.5" />;
      case 'Tunjangan Jamsostek':
        return <HeartHandshake className="w-3.5 h-3.5" />;
      case 'Potongan Mangkir':
        return <UserX className="w-3.5 h-3.5" />;
      default:
        return <Layers className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <Truck className="w-6 h-6 text-emerald-400" />
              Armada Truk TBS ({trucks.length} Unit)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Harbor Homes
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Profil armada pengangkut sawit, rincian biaya per unit, dan link akses khusus supir untuk membatasi tampilan per DT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenExcelImport && (
            <button
              onClick={() => onOpenExcelImport()}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded-xl font-semibold text-xs sm:text-sm border border-emerald-500/40 hover:border-emerald-500 transition shadow-sm"
              title="Import data biaya dari file atau tempel Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Import Excel</span>
            </button>
          )}
          <button
            onClick={onOpenDataManager}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs sm:text-sm border border-slate-700 transition"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Kelola di </span>Data Manager
          </button>
          <button
            onClick={() => onOpenAddExpense()}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Catat Biaya
          </button>
        </div>
      </div>

      {/* Info bar regarding dedicated driver links */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 flex items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Setiap kartu <strong>Unit TBS</strong> di bawah ini dilengkapi <strong>Link Khusus Supir</strong>.
            Ketika supir membuka link tersebut, sistem hanya menampilkan data mobil miliknya dan menyembunyikan data unit lain.
          </span>
        </div>
      </div>

      {/* Grid of Truck Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trucks.map((truck) => {
          const unitExpenses = expenses.filter((e) => e.truckId === truck.id);
          const unitTotal = unitExpenses.reduce((sum, e) => sum + e.amount, 0);
          const percentOfAll = totalAllCost > 0 ? (unitTotal / totalAllCost) * 100 : 0;

          // Category sums
          const catSums = CATEGORIES.reduce((acc, cat) => {
            acc[cat] = unitExpenses
              .filter((e) => e.category === cat)
              .reduce((s, e) => s + e.amount, 0);
            return acc;
          }, {} as Record<ExpenseCategory, number>);

          const driverUrl = getDriverPortalUrl(truck);
          const waUrl = getWhatsAppShareUrl(truck, driverUrl);

          return (
            <div
              key={truck.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all shadow-md overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Card Top / Header */}
                <div className="p-5 border-b border-slate-800/80 bg-slate-800/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-white">{truck.code}</span>
                        {/* Indonesian License Plate Badge */}
                        <div className="px-2 py-0.5 rounded bg-black text-white font-mono text-xs font-bold border border-slate-600 shadow-inner tracking-wider">
                          {truck.plateNumber}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{truck.model}</p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
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

                  {/* Driver & Specs info */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" /> Supir Utama
                      </span>
                      <p className="font-bold text-slate-200 mt-0.5 truncate">{truck.driverName}</p>
                      {truck.phone && <p className="text-[10px] text-slate-400">{truck.phone}</p>}
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-slate-400" /> Muatan TBS
                      </span>
                      <p className="font-bold text-slate-200 mt-0.5">{truck.capacity}</p>
                      <p className="text-[10px] text-slate-400">Tahun {truck.year}</p>
                    </div>
                  </div>
                </div>

                {/* Total Cost Display */}
                <div className="p-5 border-b border-slate-800/80 bg-slate-900/50">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Total Biaya Unit
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {percentOfAll.toFixed(1)}% total armada
                    </span>
                  </div>

                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {formatRupiah(unitTotal)}
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>{unitExpenses.length} catatan pengeluaran</span>
                    <span>
                      Rerata: {unitExpenses.length > 0 ? formatRupiah(unitTotal / unitExpenses.length) : 'Rp 0'}/nota
                    </span>
                  </div>
                </div>

                {/* Rincian Biaya per Kategori */}
                <div className="p-5 space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Rincian per Kategori:
                  </span>
                  {CATEGORIES.map((cat) => {
                    const amount = catSums[cat];
                    const catPct = unitTotal > 0 ? (amount / unitTotal) * 100 : 0;
                    const colors = CATEGORY_COLORS[cat];
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className={colors.text}>{getCategoryIcon(cat)}</span>
                            <span>{cat}</span>
                          </span>
                          <span className="font-mono text-slate-200">
                            {formatRupiah(amount)}
                            <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
                              ({catPct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors.bar} rounded-full`}
                            style={{ width: `${Math.max(catPct, amount > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                {/* Card Footer Actions */}
                <div className="p-4 bg-slate-800/40 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedTruckForDetail(truck)}
                    className="flex-1 py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    Riwayat ({unitExpenses.length})
                  </button>
                  {onOpenExcelImport && (
                    <button
                      onClick={() => onOpenExcelImport(truck.id)}
                      title={`Import / Paste data Excel khusus ${truck.code}`}
                      className="py-2 px-2.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-semibold transition border border-emerald-500/30 flex items-center justify-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Excel</span>
                    </button>
                  )}
                  <button
                    onClick={() => onOpenAddExpense(truck.id)}
                    className="flex-1 py-2 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    + Biaya
                  </button>
                  {onDeleteTruck && (
                    <button
                      onClick={() => setTruckToDelete(truck)}
                      title={`Hapus Unit ${truck.code} (${truck.plateNumber})`}
                      className="py-2 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-medium transition border border-rose-500/30 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  )}
                </div>

                {/* DEDICATED DRIVER PORTAL LINK BOX - Under each TBS unit card */}
                <div className="p-3.5 bg-emerald-950/25 border-t border-emerald-500/25 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                      <Link2 className="w-3.5 h-3.5" />
                      Link Khusus Supir ({truck.code})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                      Khusus {truck.driverName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-lg border border-slate-800">
                    <input
                      type="text"
                      readOnly
                      value={driverUrl}
                      className="bg-transparent text-[11px] font-mono text-slate-300 flex-1 outline-none px-1 truncate select-all"
                    />
                    <button
                      onClick={() => handleCopyLink(driverUrl, truck.id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded transition flex items-center gap-1 border border-slate-700 shrink-0"
                    >
                      {copiedTruckId === truck.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Kirim via WhatsApp
                    </a>
                    <button
                      onClick={() => onOpenDriverPortal(truck.id)}
                      className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-semibold transition border border-slate-700 flex items-center gap-1 shrink-0"
                      title="Lihat persis seperti yang dibuka supir di HP"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      Buka Portal
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-tight">
                    Supir hanya dapat melihat data mobil {truck.code} dan tidak menampilkan data truk lainnya.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill-down Modal for Selected Truck */}
      {selectedTruckForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">
                      Riwayat Biaya {selectedTruckForDetail.code}
                    </h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-black text-white border border-slate-600">
                      {selectedTruckForDetail.plateNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Supir: {selectedTruckForDetail.driverName} • {selectedTruckForDetail.model}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTruckForDetail(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Summary inside modal */}
              {(() => {
                const trkExps = expenses.filter((e) => e.truckId === selectedTruckForDetail.id);
                const trkTotal = trkExps.reduce((s, e) => s + e.amount, 0);
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Total Pengeluaran
                        </span>
                        <span className="text-lg font-bold text-emerald-400 font-mono">
                          {formatRupiah(trkTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Jumlah Transaksi
                        </span>
                        <span className="text-lg font-bold text-white font-mono">
                          {trkExps.length} Catatan
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Status Truk
                        </span>
                        <span className="text-sm font-bold text-slate-200">
                          {selectedTruckForDetail.status} ({selectedTruckForDetail.capacity})
                        </span>
                      </div>
                    </div>

                    {trkExps.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        Belum ada catatan biaya untuk unit ini.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Daftar Catatan Pengeluaran ({trkExps.length})
                        </h4>
                        <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                          {trkExps
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((exp) => {
                              const colors = CATEGORY_COLORS[exp.category];
                              return (
                                <div key={exp.id} className="p-3.5 hover:bg-slate-800/40 transition">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
                                      >
                                        {exp.category}
                                      </span>
                                      <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
                                        <Calendar className="w-3 h-3" />
                                        {formatDateIndo(exp.date, 'long')}
                                      </span>
                                    </div>
                                    <span className="font-bold text-emerald-400 font-mono text-sm">
                                      {formatRupiah(exp.amount)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-200 font-medium mb-1">
                                    {exp.description}
                                  </p>
                                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span>Vendor: {exp.vendor}</span>
                                    {exp.invoiceNumber && (
                                      <span className="font-mono">Nota: {exp.invoiceNumber}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-800/40 flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => {
                  const id = selectedTruckForDetail.id;
                  setSelectedTruckForDetail(null);
                  onNavigateToExpensesWithFilter(id);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                Lihat di Halaman Catatan Biaya Lengkap <ChevronRight className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                {onDeleteTruck && (
                  <button
                    onClick={() => {
                      const trk = selectedTruckForDetail;
                      setSelectedTruckForDetail(null);
                      setTruckToDelete(trk);
                    }}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/30 transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Unit
                  </button>
                )}
                <button
                  onClick={() => setSelectedTruckForDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TRUCK CONFIRMATION MODAL */}
      {truckToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">
                Hapus Unit {truckToDelete.code} ({truckToDelete.plateNumber})?
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Anda akan menghapus unit truk ini dari armada dan penyimpanan browser (localStorage).
              {(() => {
                const count = expenses.filter((e) => e.truckId === truckToDelete.id).length;
                return count > 0 ? (
                  <span className="block mt-2 text-amber-300 font-semibold">
                    Perhatian: Terdapat {count} catatan biaya terkait unit ini.
                  </span>
                ) : null;
              })()}
            </p>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 mb-5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteRelated}
                  onChange={(e) => setDeleteRelated(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-0"
                />
                <span className="text-slate-300">
                  Hapus juga seluruh catatan biaya yang masih menunjuk ke {truckToDelete.code} (sesuai anjuran agar total biaya tetap rapi).
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setTruckToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (onDeleteTruck && truckToDelete) {
                    onDeleteTruck(truckToDelete.id, deleteRelated);
                    setTruckToDelete(null);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-sm"
              >
                Ya, Hapus Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
