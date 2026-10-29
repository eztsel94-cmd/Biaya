import React, { useState } from 'react';
import { TruckUnit, ExpenseRecord, TruckStatus } from '../types/truck';
import { getDriverPortalUrl, getWhatsAppShareUrl } from '../utils/driverLink';
import {
  Database,
  Truck,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  AlertTriangle,
  Check,
  X,
  Download,
  Upload,
  Link2,
  Copy,
  Share2,
  ExternalLink,
} from 'lucide-react';

interface DataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trucks: TruckUnit[];
  expenses: ExpenseRecord[];
  onAddTruck: (newTruck: Omit<TruckUnit, 'id'>) => Promise<TruckUnit | void> | void;
  onUpdateTruck: (updatedTruck: TruckUnit) => void;
  onDeleteTruck: (truckId: string, deleteRelatedExpenses: boolean) => void;
  onResetToDefault3Units: () => void;
  onImportData: (data: { trucks: TruckUnit[]; expenses: ExpenseRecord[] }) => void;
  onOpenDriverPortal?: (truckId: string) => void;
}

export const DataManagerModal: React.FC<DataManagerModalProps> = ({
  isOpen,
  onClose,
  trucks,
  expenses,
  onAddTruck,
  onUpdateTruck,
  onDeleteTruck,
  onResetToDefault3Units,
  onImportData,
  onOpenDriverPortal,
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedTruckId, setCopiedTruckId] = useState<string | null>(null);
  const [justAddedTruck, setJustAddedTruck] = useState<TruckUnit | null>(null);

  // New truck form state
  const [newTruckForm, setNewTruckForm] = useState({
    code: '',
    plateNumber: '',
    driverName: '',
    phone: '',
    model: '',
    capacity: '8.5 Ton TBS',
    status: 'Aktif' as TruckStatus,
    year: 2022,
    notes: '',
  });

  // Edit truck form state
  const [editingTruck, setEditingTruck] = useState<TruckUnit | null>(null);

  // Delete modal state
  const [truckToDelete, setTruckToDelete] = useState<TruckUnit | null>(null);
  const [deleteRelated, setDeleteRelated] = useState<boolean>(true);

  // Status message
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4500);
  };

  const handleCopyLink = (url: string, truckId: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    setCopiedTruckId(truckId);
    setTimeout(() => {
      setCopiedTruckId((curr) => (curr === truckId ? null : curr));
    }, 2500);
  };

  const handleCreateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedCode = newTruckForm.code.trim();
    const trimmedPlate = newTruckForm.plateNumber.trim();
    const trimmedDriver = newTruckForm.driverName.trim();

    if (!trimmedCode || !trimmedPlate || !trimmedDriver) {
      showNotice('Mohon lengkapi kode unit, nomor plat, dan nama supir.');
      return;
    }

    // Client-side duplicate check
    const normalizedCode = trimmedCode.toLowerCase();
    const normalizedPlate = trimmedPlate.toLowerCase().replace(/\s+/g, '');
    const duplicateExists = trucks.some(
      (t) =>
        t.code.trim().toLowerCase() === normalizedCode ||
        t.plateNumber.trim().toLowerCase().replace(/\s+/g, '') === normalizedPlate
    );

    if (duplicateExists) {
      showNotice(`Unit "${trimmedCode}" (${trimmedPlate}) sudah ada di daftar armada! Duplikasi dicegah.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onAddTruck({
        code: trimmedCode,
        plateNumber: trimmedPlate.toUpperCase(),
        driverName: trimmedDriver,
        phone: newTruckForm.phone.trim() || undefined,
        model: newTruckForm.model.trim() || 'Truk Dump TBS',
        capacity: newTruckForm.capacity.trim() || '8.5 Ton TBS',
        status: newTruckForm.status,
        year: Number(newTruckForm.year) || 2022,
        notes: newTruckForm.notes.trim() || undefined,
      });

      setIsAdding(false);
      setNewTruckForm({
        code: '',
        plateNumber: '',
        driverName: '',
        phone: '',
        model: '',
        capacity: '8.5 Ton TBS',
        status: 'Aktif',
        year: 2022,
        notes: '',
      });

      if (created) {
        setJustAddedTruck(created);
      }
      showNotice(`Unit ${trimmedCode} berhasil ditambahkan! Link khusus supir telah siap.`);
    } catch (err: any) {
      showNotice(err?.message || 'Gagal menambahkan unit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditTruck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTruck) return;
    onUpdateTruck(editingTruck);
    setEditingTruck(null);
    showNotice(`Perubahan ${editingTruck.code} berhasil disimpan!`);
  };

  const handleConfirmDelete = () => {
    if (!truckToDelete) return;
    onDeleteTruck(truckToDelete.id, deleteRelated);
    showNotice(`Unit ${truckToDelete.code} telah dihapus dari sistem.`);
    setTruckToDelete(null);
  };

  // Export & Import JSON
  const handleExportJSON = () => {
    const dataStr = JSON.stringify({ trucks, expenses }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_harbor_homes_truk_tbs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showNotice('File backup JSON berhasil diunduh.');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.trucks && Array.isArray(parsed.trucks)) {
          onImportData({
            trucks: parsed.trucks,
            expenses: parsed.expenses || [],
          });
          showNotice(`Berhasil memulihkan ${parsed.trucks.length} unit truk.`);
        } else {
          showNotice('Format file JSON tidak valid!');
        }
      } catch (err) {
        showNotice('Gagal membaca file JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Data Manager — Kelola Unit Truk</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {trucks.length} Unit Terdaftar
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pusat manajemen armada truk TBS: tambah unit baru, bagikan link khusus supir, ubah data, dan hapus unit.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Just Added Truck Link Banner */}
        {justAddedTruck && (
          <div className="mx-6 mt-4 p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-slate-200 animate-in fade-in space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs sm:text-sm">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Unit Baru Berhasil Ditambahkan: <strong>{justAddedTruck.code}</strong> ({justAddedTruck.plateNumber})</span>
              </div>
              <button
                onClick={() => setJustAddedTruck(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Berikut link khusus untuk supir <strong>{justAddedTruck.driverName}</strong> untuk mengakses hanya data mobil miliknya:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-lg border border-slate-700 flex-1">
                <input
                  type="text"
                  readOnly
                  value={getDriverPortalUrl(justAddedTruck)}
                  className="bg-transparent text-xs font-mono text-emerald-300 flex-1 outline-none px-1 truncate select-all"
                />
                <button
                  onClick={() => handleCopyLink(getDriverPortalUrl(justAddedTruck), justAddedTruck.id)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded transition flex items-center gap-1"
                >
                  {copiedTruckId === justAddedTruck.id ? (
                    <span className="text-emerald-400 font-bold">Tersalin!</span>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>

              <a
                href={getWhatsAppShareUrl(justAddedTruck)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                Kirim ke WA Supir
              </a>

              {onOpenDriverPortal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenDriverPortal(justAddedTruck.id);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  Pratinjau
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Top toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                Tabel Unit Truk TBS Saat Ini
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Konfigurasi saat ini: <strong>{trucks.length} unit</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Unit
              </button>
              <button
                onClick={onResetToDefault3Units}
                title="Reset kembali ke default 3 unit (Unit 01, Unit 90, Unit 03)"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg border border-slate-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Reset ke 3 Unit
              </button>
            </div>
          </div>

          {/* Form Tambah Unit (if isAdding) */}
          {isAdding && (
            <div className="bg-slate-800/80 p-5 rounded-xl border border-emerald-500/40 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Tambah Unit Dump Truck Baru (Unit TBS)
                </h4>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTruck} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Kode Unit (Contoh: Unit 92) *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Unit 92"
                      value={newTruckForm.code}
                      onChange={(e) =>
                        setNewTruckForm({ ...newTruckForm, code: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nomor Plat Polisi *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: BM 9292 TBS"
                      value={newTruckForm.plateNumber}
                      onChange={(e) =>
                        setNewTruckForm({
                          ...newTruckForm,
                          plateNumber: e.target.value.toUpperCase(),
                        })
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nama Supir Utama *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Ridwan Siregar"
                      value={newTruckForm.driverName}
                      onChange={(e) =>
                        setNewTruckForm({ ...newTruckForm, driverName: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      No. WhatsApp Supir (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 0812-3456-7890"
                      value={newTruckForm.phone}
                      onChange={(e) =>
                        setNewTruckForm({ ...newTruckForm, phone: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Model / Merk Truk
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Mitsubishi Canter HDX"
                      value={newTruckForm.model}
                      onChange={(e) =>
                        setNewTruckForm({ ...newTruckForm, model: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Status Truk
                    </label>
                    <select
                      value={newTruckForm.status}
                      onChange={(e) =>
                        setNewTruckForm({
                          ...newTruckForm,
                          status: e.target.value as TruckStatus,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Perawatan">Perawatan</option>
                      <option value="Standby">Standby</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1.5"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan & Buat Link Supir'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Trucks */}
          <div className="space-y-3">
            {trucks.map((truck) => {
              const driverUrl = getDriverPortalUrl(truck);
              const waUrl = getWhatsAppShareUrl(truck, driverUrl);

              return (
                <div
                  key={truck.id}
                  className="bg-slate-800/40 border border-slate-800 hover:border-slate-700 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-base">{truck.code}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-black text-white font-bold border border-slate-700">
                        {truck.plateNumber}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          truck.status === 'Aktif'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {truck.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Supir: <strong>{truck.driverName}</strong> {truck.phone ? `(${truck.phone})` : ''} • {truck.model}
                    </p>

                    {/* Driver Link Display in Row */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> Link Supir:
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 truncate max-w-xs sm:max-w-md">
                        {driverUrl}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Salin Link Button */}
                    <button
                      onClick={() => handleCopyLink(driverUrl, truck.id)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1"
                      title="Salin link khusus supir ini"
                    >
                      {copiedTruckId === truck.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Link</span>
                        </>
                      )}
                    </button>

                    {/* WhatsApp Share Button */}
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                      title="Kirim link ke WhatsApp supir"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WA</span>
                    </a>

                    {/* Edit Button */}
                    <button
                      onClick={() => setEditingTruck(truck)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Ubah</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setTruckToDelete(truck)}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded-lg border border-rose-500/20 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export / Backup Toolbar */}
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-white block">Cadangan & Pemulihan Basis Data</span>
              <span className="text-slate-400 text-[11px]">
                Unduh file JSON untuk menyimpan salinan cadangan atau pulihkan ke sistem.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Backup JSON
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Pulihkan
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            Selesai & Tutup
          </button>
        </div>
      </div>

      {/* EDIT MODAL DIALOG */}
      {editingTruck && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                Ubah Informasi Unit Truk ({editingTruck.code})
              </h3>
              <button
                onClick={() => setEditingTruck(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTruck} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Kode Unit (Contoh: Unit 90) *
                </label>
                <input
                  type="text"
                  value={editingTruck.code}
                  onChange={(e) => setEditingTruck({ ...editingTruck, code: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nomor Polisi (Plat) *
                </label>
                <input
                  type="text"
                  value={editingTruck.plateNumber}
                  onChange={(e) =>
                    setEditingTruck({ ...editingTruck, plateNumber: e.target.value.toUpperCase() })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Supir *</label>
                <input
                  type="text"
                  value={editingTruck.driverName}
                  onChange={(e) =>
                    setEditingTruck({ ...editingTruck, driverName: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">No. WhatsApp Supir</label>
                <input
                  type="text"
                  value={editingTruck.phone || ''}
                  onChange={(e) =>
                    setEditingTruck({ ...editingTruck, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Model / Merk Truk</label>
                <input
                  type="text"
                  value={editingTruck.model}
                  onChange={(e) => setEditingTruck({ ...editingTruck, model: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Kapasitas Muatan</label>
                <input
                  type="text"
                  value={editingTruck.capacity}
                  onChange={(e) => setEditingTruck({ ...editingTruck, capacity: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status Truk</label>
                <select
                  value={editingTruck.status}
                  onChange={(e) =>
                    setEditingTruck({ ...editingTruck, status: e.target.value as TruckStatus })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Perawatan">Perawatan</option>
                  <option value="Standby">Standby</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTruck(null)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
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

      {/* DELETE TRUCK CONFIRMATION */}
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
              Anda akan menghapus unit truk ini dari armada Harbor Homes.
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
                onClick={handleConfirmDelete}
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
