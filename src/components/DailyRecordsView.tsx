import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Calendar,
  User,
  Scale,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  TrendingUp,
  FileSpreadsheet,
  Clock,
  Check,
  ChevronDown,
  X,
  ExternalLink,
  Save,
  Share2,
  Smartphone,
  Link2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DailyRecord, NewDailyRecord } from '../types/dailyRecord';
import { TruckUnit } from '../types/truck';
import {
  subscribeToDailyRecords,
  addDailyRecord,
  updateDailyRecord,
  deleteDailyRecord,
  clearAllDemoDataFirestore,
  subscribeToFirestorePemuat,
  addPemuatFirestore,
  deletePemuatFirestore,
  COLLECTION_NAME,
} from '../services/firebase';
import { SharePemuatModal } from './SharePemuatModal';
import { PemuatManagerModal } from './PemuatManagerModal';
import { getPemuatPortalUrl } from '../utils/driverLink';

const QUICK_TRUCKS = ['DT 90', 'DT 01', 'DT 02', 'DT 03', 'DT 05', 'DT 08', 'DT 10', 'DT 12'];
const QUICK_AFDELINGS = ['Afdeling 1', 'Afdeling 2', 'Afdeling 3', 'Afdeling 4', 'Divisi Inti', 'Plasma'];

interface DailyRecordsViewProps {
  trucks?: TruckUnit[];
  onOpenPemuatPortal?: (pemuatName?: string) => void;
}

export const DailyRecordsView: React.FC<DailyRecordsViewProps> = ({ trucks = [], onOpenPemuatPortal }) => {
  // State data dari Firestore
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Master Pemuat & Modal Tambah Manual (Tersimpan permanen di cloud)
  const [pemuatMaster, setPemuatMaster] = useState<Array<{ id: string; name: string }>>([]);
  const [isPemuatManagerOpen, setIsPemuatManagerOpen] = useState(false);

  // Dynamic Truck Unit Sesuai yang Terdata di Armada
  const dynamicTruckCodes = useMemo(() => {
    if (trucks && trucks.length > 0) {
      return trucks.map((t) => t.code);
    }
    return QUICK_TRUCKS;
  }, [trucks]);

  // Berlangganan Master Nama Pemuat dari Firestore
  useEffect(() => {
    const unsub = subscribeToFirestorePemuat((list) => {
      setPemuatMaster(list);
    });
    return () => unsub();
  }, []);

  // Form State Input Baru (Default Contoh Cepat untuk Kemudahan Input)
  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<NewDailyRecord>({
    date: todayStr,
    truckNumber: 'DT 90',
    driverName: 'Anton',
    tonnage: '8.4' as any,
    afdeling: 'Afdeling 1',
    notes: 'TBS Masak PKS Inti',
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAfdeling, setFilterAfdeling] = useState<string>('ALL');
  const [filterTruck, setFilterTruck] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH'>('ALL');

  // Edit modal state
  const [recordToEdit, setRecordToEdit] = useState<DailyRecord | null>(null);
  const [editFormData, setEditFormData] = useState<DailyRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Delete modal state
  const [recordToDelete, setRecordToDelete] = useState<DailyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Share link pemuat modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Notifikasi helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Berlangganan Firestore onSnapshot Real-Time
  useEffect(() => {
    setLoading(true);
    setFirestoreError(null);

    const unsubscribe = subscribeToDailyRecords(
      (data) => {
        setRecords(data);
        setLoading(false);
        setFirestoreError(null);
      },
      (err) => {
        setLoading(false);
        const msg = err.message || 'Gagal memuat data dari Firestore';
        setFirestoreError(msg);
        showToast(`Koneksi Firestore: ${msg}`, 'error');
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle Submit Form Input Baru
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.truckNumber.trim()) {
      showToast('Mohon masukkan Nomor Unit Truk (contoh: DT 90)', 'error');
      return;
    }
    if (!formData.driverName.trim()) {
      showToast('Mohon masukkan Nama Pemuat (contoh: Anton)', 'error');
      return;
    }
    const ton = parseFloat(String(formData.tonnage));
    if (isNaN(ton) || ton <= 0) {
      showToast('Mohon masukkan Tonase yang valid dalam angka (contoh: 8.5)', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDailyRecord({
        date: formData.date || todayStr,
        truckNumber: formData.truckNumber.trim().toUpperCase(),
        driverName: formData.driverName.trim(),
        tonnage: ton,
        afdeling: formData.afdeling.trim() || 'Afdeling 1',
        notes: (formData.notes || '').trim(),
      });

      showToast(`Data pengiriman ${formData.truckNumber} (${ton} Ton) berhasil tersimpan ke Firestore!`, 'success');

      // Reset form tapi pertahankan tanggal dan afdeling untuk memudahkan input berulang
      setFormData((prev) => ({
        ...prev,
        driverName: '',
        tonnage: '' as any,
        notes: '',
      }));
    } catch (err: any) {
      console.error('Error addDoc:', err);
      showToast(`Gagal menyimpan ke Firestore: ${err.message || 'Cek koneksi internet/aturan database'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buka Modal Edit
  const handleOpenEditModal = (record: DailyRecord) => {
    setRecordToEdit(record);
    setEditFormData({ ...record });
  };

  // Simpan Perubahan Edit ke Firestore
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData) return;

    if (!editFormData.truckNumber.trim()) {
      showToast('Mohon masukkan Nomor Unit Truk (contoh: DT 90)', 'error');
      return;
    }
    if (!editFormData.driverName.trim()) {
      showToast('Mohon masukkan Nama Pemuat (contoh: Anton)', 'error');
      return;
    }
    const ton = parseFloat(String(editFormData.tonnage));
    if (isNaN(ton) || ton <= 0) {
      showToast('Mohon masukkan Tonase yang valid dalam angka (contoh: 8.5)', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      await updateDailyRecord({
        ...editFormData,
        truckNumber: editFormData.truckNumber.trim().toUpperCase(),
        driverName: editFormData.driverName.trim(),
        tonnage: ton,
        afdeling: editFormData.afdeling.trim() || 'Afdeling 1',
        notes: (editFormData.notes || '').trim(),
      });

      showToast(`Data unit ${editFormData.truckNumber} berhasil diperbarui di Firestore!`, 'success');
      setRecordToEdit(null);
      setEditFormData(null);
    } catch (err: any) {
      console.error('Error updateDoc:', err);
      showToast(`Gagal memperbarui data: ${err.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Hapus Data dari Firestore
  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDailyRecord(recordToDelete.id);
      showToast(`Catatan unit ${recordToDelete.truckNumber} berhasil dihapus dari Firestore.`, 'info');
      setRecordToDelete(null);
    } catch (err: any) {
      console.error('Error deleteDoc:', err);
      showToast(`Gagal menghapus data: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Muat 5 contoh data pengiriman TBS ke Firestore untuk uji coba cepat
  const handleLoadSampleData = async () => {
    setIsSubmitting(true);
    try {
      const sampleRows: Array<{
        date: string;
        truckNumber: string;
        driverName: string;
        tonnage: number;
        afdeling: string;
        notes: string;
      }> = [
        {
          date: todayStr,
          truckNumber: 'DT 90',
          driverName: 'Anton',
          tonnage: 8.4,
          afdeling: 'Afdeling 1',
          notes: 'TBS Masak Blok A12 PKS Inti',
        },
        {
          date: todayStr,
          truckNumber: 'DT 01',
          driverName: 'Bambang',
          tonnage: 8.1,
          afdeling: 'Afdeling 2',
          notes: 'TBS Buah Super Divisi 2',
        },
        {
          date: todayStr,
          truckNumber: 'DT 03',
          driverName: 'Suryanto',
          tonnage: 8.65,
          afdeling: 'Afdeling 3',
          notes: 'TBS Plasma Kemitraan',
        },
        {
          date: todayStr,
          truckNumber: 'DT 90',
          driverName: 'Anton',
          tonnage: 8.25,
          afdeling: 'Afdeling 1',
          notes: 'Trip Sore Pabrik Kelapa Sawit',
        },
        {
          date: todayStr,
          truckNumber: 'DT 02',
          driverName: 'Rahmad',
          tonnage: 7.9,
          afdeling: 'Afdeling 4',
          notes: 'TBS Restan Panen Pagi',
        },
      ];

      for (const row of sampleRows) {
        await addDailyRecord(row);
      }
      showToast('5 data contoh pengiriman TBS berhasil dimasukkan ke Firestore!', 'success');
    } catch (err: any) {
      console.error('Error insert sample data:', err);
      showToast(`Gagal memasukkan contoh data: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bersihkan data contoh dari Firestore
  const handleClearDemoData = async () => {
    if (!window.confirm('Bersihkan seluruh data contoh / uji coba dari Firestore? Data catatan asli Anda tidak akan dihapus.')) return;
    setIsSubmitting(true);
    try {
      const res = await clearAllDemoDataFirestore();
      showToast(
        `Berhasil membersihkan data contoh dari Firestore (${res.deletedDaily} catatan rit & ${res.deletedExpenses} biaya demo dibersihkan).`,
        'success'
      );
    } catch (err: any) {
      showToast(`Gagal membersihkan data contoh: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ekspor ke Excel (.xlsx)
  const handleExportExcel = () => {
    if (records.length === 0) {
      showToast('Belum ada data untuk diekspor.', 'info');
      return;
    }

    const rows = filteredRecords.map((r, index) => ({
      No: index + 1,
      Tanggal: r.date,
      'Unit Truk': r.truckNumber,
      'Nama Pemuat': r.driverName,
      Afdeling: r.afdeling,
      'Tonase (Ton)': r.tonnage,
      'Catatan / Keterangan': r.notes || '-',
      'ID Dokumen Firestore': r.id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catatan Harian TBS');

    // Atur lebar kolom
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 30 },
      { wch: 25 },
    ];

    const fileName = `Catatan_Harian_Truk_TBS_${todayStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showToast(`File ${fileName} berhasil diunduh!`, 'success');
  };

  // Filtering data
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return records.filter((r) => {
      // Search
      const matchSearch =
        !q ||
        r.truckNumber.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.afdeling.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Filter Afdeling
      if (filterAfdeling !== 'ALL' && r.afdeling !== filterAfdeling) {
        return false;
      }

      // Filter Truck
      if (filterTruck !== 'ALL' && r.truckNumber !== filterTruck) {
        return false;
      }

      // Filter Date Range
      if (filterDateRange === 'TODAY' && r.date !== todayStr) {
        return false;
      }
      if (filterDateRange === '7DAYS') {
        const d = new Date(r.date);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (d < sevenDaysAgo) return false;
      }
      if (filterDateRange === 'THIS_MONTH') {
        const curMonth = todayStr.substring(0, 7); // YYYY-MM
        if (!r.date.startsWith(curMonth)) return false;
      }

      return true;
    });
  }, [records, searchQuery, filterAfdeling, filterTruck, filterDateRange, todayStr]);

  // Statistik Ringkasan
  const totalTonnage = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.tonnage) || 0), 0);
  }, [filteredRecords]);

  const totalTrips = filteredRecords.length;

  const avgTonnage = useMemo(() => {
    return totalTrips > 0 ? totalTonnage / totalTrips : 0;
  }, [totalTonnage, totalTrips]);

  const uniqueTrucksCount = useMemo(() => {
    const set = new Set(filteredRecords.map((r) => r.truckNumber));
    return set.size;
  }, [filteredRecords]);

  // Format Tanggal Indonesia
  const formatDateIndo = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all transform animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'success'
              ? 'bg-emerald-900/95 text-emerald-200 border border-emerald-500/50 shadow-emerald-950/50'
              : notification.type === 'error'
              ? 'bg-rose-900/95 text-rose-200 border border-rose-500/50 shadow-rose-950/50'
              : 'bg-sky-900/95 text-sky-200 border border-sky-500/50 shadow-sky-950/50'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          {notification.type === 'info' && <Check className="w-5 h-5 text-sky-400 shrink-0" />}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Status Koneksi */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                <Truck className="w-6 h-6" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Sistem Catatan Harian Truk TBS
              </h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PKS & Kebun Kelapa Sawit
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Pencatatan real-time pengangkutan Tandan Buah Segar (TBS) per unit truk, pemuat, afdeling, dan tonase ke Firebase Firestore.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Real-time Firestore */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs font-medium text-slate-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Firestore: <strong className="text-emerald-400 font-mono">traksi-22f5b</strong></span>
            </div>

            {/* Tombol Bagikan Link Khusus Pemuat (Terisolasi) */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-black transition shadow-lg shadow-emerald-500/25 cursor-pointer"
              title="Buka & bagikan tautan khusus pemuat agar bisa akses terisolasi dari smartphone"
            >
              <Share2 className="w-4 h-4 text-slate-950" />
              <span>Link Khusus Pemuat</span>
              <span className="hidden sm:inline-block bg-slate-950/20 px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase">
                Terisolasi
              </span>
            </button>

            {/* Tombol Isi 5 Contoh Data */}
            <button
              onClick={handleLoadSampleData}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
              title="Isi contoh 5 data pengangkutan TBS untuk simulasi / uji coba cepat"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Isi 5 Contoh Data</span>
              <span className="sm:hidden">Contoh Data</span>
            </button>

            <button
              onClick={handleClearDemoData}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/70 hover:text-rose-300 text-slate-400 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold transition cursor-pointer"
              title="Bersihkan seluruh data contoh / demo dari Firestore"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bersihkan Contoh</span>
              <span className="sm:hidden">Bersihkan</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-950/40 cursor-pointer"
              title="Unduh seluruh data sebagai spreadsheet Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel</span>
            </button>
          </div>
        </div>

        {/* Warning jika aturan Firestore belum diset */}
        {firestoreError && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Terjadi Kendala Koneksi Firestore:</p>
              <p className="mt-0.5">{firestoreError}</p>
              <p className="text-rose-400/90 text-xs mt-1">
                Catatan: Pastikan di Firebase Console project <strong>traksi-22f5b</strong> bagian Firestore Rules sudah diizinkan: <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">allow read, write: if true;</code>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Kartu Ringkasan Total (Summary Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Tonase */}
        <div className="bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-400">Total Tonase</span>
            <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
            {totalTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs sm:text-sm font-semibold text-emerald-400 ml-1">Ton</span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1 truncate">
            TBS ({filteredRecords.length} catatan)
          </p>
        </div>

        {/* Total Pengiriman / Rit */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-sky-400">Total Pengiriman</span>
            <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
            {totalTrips}
            <span className="text-xs sm:text-sm font-semibold text-sky-400 ml-1">Rit</span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1 truncate">
            Trip angkut pabrik
          </p>
        </div>

        {/* Rata-Rata Tonase per Rit */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400">Rata-Rata Muatan</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
            {avgTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs sm:text-sm font-semibold text-amber-400 ml-1">T/Rit</span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1 truncate">
            Rerata per ritase
          </p>
        </div>

        {/* Armada Aktif */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-purple-400">Unit Beroperasi</span>
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
            {uniqueTrucksCount}
            <span className="text-xs sm:text-sm font-semibold text-purple-400 ml-1">Unit</span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1 truncate">
            DT di periode ini
          </p>
        </div>
      </div>

      {/* Grid Utama: Form Input Harian & Tabel Riwayat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Form Input Data Harian Sederhana (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl sticky top-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Form Input Data Harian
                </h2>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                Real-time
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Tanggal Pengiriman
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Nomor Unit Truk */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-emerald-400" />
                    Nomor Unit Truk
                  </label>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Otomatis dari Armada ({dynamicTruckCodes.length} Unit)
                  </span>
                </div>
                <input
                  type="text"
                  list="daily-truck-codes-list"
                  placeholder="Ketik atau pilih (cth: DT 90)"
                  value={formData.truckNumber}
                  onChange={(e) => setFormData({ ...formData, truckNumber: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono font-semibold text-sm focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
                />
                <datalist id="daily-truck-codes-list">
                  {dynamicTruckCodes.map((dt) => (
                    <option key={dt} value={dt} />
                  ))}
                </datalist>

                {/* Tombol Cepat Pilihan DT Sesuai Armada */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {dynamicTruckCodes.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setFormData({ ...formData, truckNumber: dt })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-mono font-medium transition border cursor-pointer ${
                        formData.truckNumber.toUpperCase() === dt
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border-slate-700/60'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Pemuat (Fitur Otomatis & Tambah Manual) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    Nama Pemuat
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPemuatManagerOpen(true)}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer"
                    title="Tulis nama pemuat manual agar tersimpan di fitur otomatis"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>+ Tulis / Kelola Pemuat</span>
                  </button>
                </div>
                <input
                  type="text"
                  list="daily-pemuat-master-list"
                  placeholder="Ketik nama atau pilih tombol di bawah..."
                  value={formData.driverName}
                  onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
                />
                <datalist id="daily-pemuat-master-list">
                  {pemuatMaster.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>

                {/* Tombol Cepat Otomatis Nama Pemuat */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pemuatMaster.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, driverName: p.name })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition border cursor-pointer ${
                        formData.driverName === p.name
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border-slate-700/60'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tonase (Ton) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  Tonase (Tonase dalam Ton)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="50"
                    placeholder="Contoh: 8.75"
                    value={formData.tonnage}
                    onChange={(e) => setFormData({ ...formData, tonnage: e.target.value as any })}
                    required
                    className="w-full px-3.5 py-2.5 pr-14 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 bg-emerald-950/70 px-2 py-1 rounded">
                    TON
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[7.5, 8.0, 8.5, 9.0, 9.5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData({ ...formData, tonnage: preset as any })}
                      className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 font-mono cursor-pointer"
                    >
                      {preset}T
                    </button>
                  ))}
                </div>
              </div>

              {/* Afdeling */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Afdeling / Lokasi Panen
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Afdeling 1"
                  value={formData.afdeling}
                  onChange={(e) => setFormData({ ...formData, afdeling: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
                />

                {/* Pilihan Cepat Afdeling */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_AFDELINGS.map((afd) => (
                    <button
                      key={afd}
                      type="button"
                      onClick={() => setFormData({ ...formData, afdeling: afd })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition border cursor-pointer ${
                        formData.afdeling === afd
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border-slate-700/60'
                      }`}
                    >
                      {afd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan Tambahan (Opsional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Trip 1, Buah Matang, PKS Inti"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
                />
              </div>

              {/* Tombol Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm tracking-wide transition shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Firestore...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Simpan ke Firestore</span>
                  </>
                )}
              </button>
            </form>

          </div>
        </div>

        {/* Kolom Kanan: Tabel Ringkasan Riwayat Input (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
            {/* Header Tabel & Kontrol Filter */}
            <div className="space-y-4 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>Riwayat Input Data Harian</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-emerald-400 border border-slate-700 font-mono">
                      {filteredRecords.length} Data
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Data sinkron otomatis secara langsung dari database Firestore
                  </p>
                </div>

                {/* Filter Periode */}
                <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setFilterDateRange('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filterDateRange === 'ALL'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setFilterDateRange('TODAY')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filterDateRange === 'TODAY'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    onClick={() => setFilterDateRange('7DAYS')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filterDateRange === '7DAYS'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    7 Hari
                  </button>
                  <button
                    onClick={() => setFilterDateRange('THIS_MONTH')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filterDateRange === 'THIS_MONTH'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>

              {/* Baris Pencarian & Dropdown Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6 relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari Unit Truk, Pemuat, Afdeling..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={filterTruck}
                    onChange={(e) => setFilterTruck(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="ALL">Semua Truk</option>
                    {QUICK_TRUCKS.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={filterAfdeling}
                    onChange={(e) => setFilterAfdeling(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="ALL">Semua Afdeling</option>
                    {QUICK_AFDELINGS.map((afd) => (
                      <option key={afd} value={afd}>
                        {afd}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Konten Tabel */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
                <p className="text-sm">Menghubungkan & menyinkronkan data dari Firestore...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3 border border-dashed border-slate-800 rounded-2xl">
                <Truck className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">
                  {records.length === 0 ? 'Belum ada catatan pengangkutan TBS' : 'Tidak ada data yang cocok dengan filter'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {records.length === 0
                    ? 'Silakan isi form di sebelah kiri untuk mencatat rit pengangkutan TBS pertama Anda ke database cloud.'
                    : 'Coba ubah kata kunci pencarian atau sesuaikan filter periode dan afdeling.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mobile View: High-density touch-friendly cards (md:hidden) */}
                <div className="md:hidden space-y-3">
                  {filteredRecords.map((r) => (
                    <div
                      key={r.id}
                      className="bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold text-xs">
                            <Truck className="w-3.5 h-3.5" />
                            {r.truckNumber}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {r.afdeling}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-emerald-400 text-base">
                            {Number(r.tonnage).toLocaleString('id-ID', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1 font-semibold">Ton</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{r.driverName}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400 text-[11px]">{formatDateIndo(r.date)}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                            title="Edit data ini di Firestore"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRecordToDelete(r)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus data ini dari Firestore"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {r.notes && (
                        <p className="text-[11px] text-slate-400 bg-slate-900/70 p-2 rounded-lg font-mono">
                          {r.notes}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Ringkasan Mobile */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      Total ({filteredRecords.length} Rit)
                    </span>
                    <span className="font-mono font-black text-emerald-400 text-base">
                      {totalTonnage.toLocaleString('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xs">Ton</span>
                    </span>
                  </div>
                </div>

                {/* Desktop View: Full Data Table (hidden on mobile, block on md+) */}
                <div className="hidden md:block overflow-x-auto -mx-5 sm:mx-0">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="py-3 px-3 sm:px-4 font-semibold">Tgl</th>
                        <th className="py-3 px-3 sm:px-4 font-semibold">Unit Truk</th>
                        <th className="py-3 px-3 sm:px-4 font-semibold">Pemuat</th>
                        <th className="py-3 px-3 sm:px-4 font-semibold">Afdeling</th>
                        <th className="py-3 px-3 sm:px-4 font-semibold text-right">Tonase</th>
                        <th className="py-3 px-3 sm:px-4 font-semibold hidden md:table-cell">Catatan</th>
                        <th className="py-3 px-3 sm:px-4 font-semibold text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-800/40 transition group"
                        >
                          {/* Tanggal */}
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap text-slate-300 font-medium text-xs">
                            {formatDateIndo(r.date)}
                          </td>

                          {/* Unit Truk */}
                          <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold text-xs">
                              <Truck className="w-3 h-3" />
                              {r.truckNumber}
                            </span>
                          </td>

                          {/* Pemuat */}
                          <td className="py-3 px-3 sm:px-4 font-medium text-white whitespace-nowrap">
                            {r.driverName}
                          </td>

                          {/* Afdeling */}
                          <td className="py-3 px-3 sm:px-4 text-slate-300 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {r.afdeling}
                            </span>
                          </td>

                          {/* Tonase */}
                          <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              {Number(r.tonnage).toLocaleString('id-ID', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1">Ton</span>
                          </td>

                          {/* Catatan */}
                          <td className="py-3 px-3 sm:px-4 text-slate-400 text-xs hidden md:table-cell max-w-xs truncate">
                            {r.notes || '-'}
                          </td>

                          {/* Aksi: Edit & Hapus */}
                          <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditModal(r)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                                title="Edit data ini di Firestore"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setRecordToDelete(r)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Hapus data ini dari Firestore"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Footer Ringkasan Baris */}
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 bg-slate-800/40 text-xs font-bold text-slate-300">
                        <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-slate-400">
                          Total Muatan ({filteredRecords.length} Rit):
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-mono text-sm font-black">
                          {totalTonnage.toLocaleString('id-ID', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          <span className="text-xs">Ton</span>
                        </td>
                        <td colSpan={2} className="py-3 px-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Edit Data Harian TBS */}
      {recordToEdit && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Catatan Harian TBS</h3>
                  <p className="text-xs text-slate-400">
                    Perubahan akan langsung tersinkronisasi ke Firebase Firestore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRecordToEdit(null);
                  setEditFormData(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Tanggal Pengiriman
                </label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Unit Truk */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  Nomor Unit Truk
                </label>
                <input
                  type="text"
                  value={editFormData.truckNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, truckNumber: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono font-semibold text-sm focus:outline-none focus:border-emerald-500 transition"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_TRUCKS.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, truckNumber: dt })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-mono font-medium transition border cursor-pointer ${
                        editFormData.truckNumber.toUpperCase() === dt
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border-slate-700/60'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Pemuat */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  Nama Pemuat
                </label>
                <input
                  type="text"
                  value={editFormData.driverName}
                  onChange={(e) => setEditFormData({ ...editFormData, driverName: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Tonase (Ton) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  Tonase (Ton)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="50"
                    value={editFormData.tonnage}
                    onChange={(e) => setEditFormData({ ...editFormData, tonnage: e.target.value as any })}
                    required
                    className="w-full px-3.5 py-2.5 pr-14 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500 transition"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 bg-emerald-950/70 px-2 py-1 rounded">
                    TON
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[7.5, 8.0, 8.5, 9.0, 9.5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, tonnage: preset as any })}
                      className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 font-mono cursor-pointer"
                    >
                      {preset}T
                    </button>
                  ))}
                </div>
              </div>

              {/* Afdeling */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Afdeling / Lokasi Panen
                </label>
                <input
                  type="text"
                  value={editFormData.afdeling}
                  onChange={(e) => setEditFormData({ ...editFormData, afdeling: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_AFDELINGS.map((afd) => (
                    <button
                      key={afd}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, afdeling: afd })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition border cursor-pointer ${
                        editFormData.afdeling === afd
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border-slate-700/60'
                      }`}
                    >
                      {afd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan / Keterangan */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Tombol Aksi Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setRecordToEdit(null);
                    setEditFormData(null);
                  }}
                  disabled={isUpdating}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Data */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Konfirmasi Hapus Data</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Unit Truk:</span>
                <span className="font-mono font-bold text-emerald-400">{recordToDelete.truckNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pemuat:</span>
                <span className="font-medium text-white">{recordToDelete.driverName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tanggal:</span>
                <span>{formatDateIndo(recordToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Afdeling:</span>
                <span>{recordToDelete.afdeling}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tonase:</span>
                <span className="font-bold text-white font-mono">{recordToDelete.tonnage} Ton</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Dokumen ini akan dihapus secara permanen langsung dari Firebase Firestore (<code className="text-rose-400 font-mono">deleteDoc</code>).
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition shadow-lg shadow-rose-950/40 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Pemuat Isolated Link Modal */}
      <SharePemuatModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        existingPemuatNames={Array.from(new Set(records.map((r) => r.driverName).filter(Boolean)))}
        onOpenPreview={(name) => {
          if (onOpenPemuatPortal) {
            onOpenPemuatPortal(name);
          } else {
            const url = getPemuatPortalUrl(name);
            window.open(url, '_blank');
          }
        }}
      />

      {/* Modal Kelola / Tulis Nama Pemuat Baru Manual */}
      <PemuatManagerModal
        isOpen={isPemuatManagerOpen}
        onClose={() => setIsPemuatManagerOpen(false)}
        pemuatList={pemuatMaster}
        onAddPemuat={addPemuatFirestore}
        onDeletePemuat={deletePemuatFirestore}
        onSelectPemuat={(name) => setFormData((prev) => ({ ...prev, driverName: name }))}
      />
    </div>
  );
};
