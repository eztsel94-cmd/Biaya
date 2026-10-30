import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Scale,
  Calendar,
  User,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Check,
  ChevronDown,
  X,
  Share2,
  Copy,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  ArrowLeft,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Table,
  Eye,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DailyRecord, NewDailyRecord } from '../types/dailyRecord';
import {
  subscribeToDailyRecords,
  addDailyRecord,
  updateDailyRecord,
  deleteDailyRecord,
} from '../services/firebase';
import { getPemuatPortalUrl, getWhatsAppSharePemuatUrl } from '../utils/driverLink';

const QUICK_TRUCKS = ['DT 90', 'DT 01', 'DT 02', 'DT 03', 'DT 05', 'DT 08', 'DT 10', 'DT 12'];
const QUICK_AFDELINGS = ['Afdeling 1', 'Afdeling 2', 'Afdeling 3', 'Afdeling 4', 'Divisi Inti', 'Plasma'];

export const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
export const INDO_DAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const INDO_DAYS_HEADER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const INDO_DAYS_HEADER_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function formatDateIndoFull(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayName = INDO_DAYS_LONG[dateObj.getDay()] || '';
  const monthName = INDO_MONTHS[m - 1] || '';
  return `${dayName}, ${d} ${monthName} ${y}`;
}

interface PemuatPortalViewProps {
  initialPemuatName?: string;
  onExitToAdmin?: () => void;
}

export const PemuatPortalView: React.FC<PemuatPortalViewProps> = ({
  initialPemuatName,
  onExitToAdmin,
}) => {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Active Pemuat profile
  const [activePemuat, setActivePemuat] = useState<string>(initialPemuatName || 'Anton');

  // Mode Tampilan: Kalender Bulanan Interaktif vs Tabel Riwayat
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  // State Navigasi Kalender
  const initialCalendarDate = new Date();
  const [calendarYear, setCalendarYear] = useState<number>(initialCalendarDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(initialCalendarDate.getMonth()); // 0 = Jan, 11 = Des

  // State Modal Detail per Tanggal
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<string | null>(null);

  // Form State Input Baru
  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<NewDailyRecord>({
    date: todayStr,
    truckNumber: 'DT 90',
    driverName: initialPemuatName || 'Anton',
    tonnage: '' as any,
    afdeling: 'Afdeling 1',
    notes: '',
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'MY_RECORDS' | 'ALL'>('ALL');
  const [filterAfdeling, setFilterAfdeling] = useState<string>('ALL');
  const [filterTruck, setFilterTruck] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH'>('TODAY');

  // Edit modal state
  const [recordToEdit, setRecordToEdit] = useState<DailyRecord | null>(null);
  const [editFormData, setEditFormData] = useState<DailyRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Delete modal state
  const [recordToDelete, setRecordToDelete] = useState<DailyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Share state
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Notifikasi helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Sync Pemuat name changes to form
  useEffect(() => {
    if (activePemuat) {
      setFormData((prev) => ({ ...prev, driverName: activePemuat }));
    }
  }, [activePemuat]);

  // Subscribe to real-time Firestore daily records
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

  // Submit new daily record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.truckNumber.trim()) {
      showToast('Mohon pilih atau masukkan Nomor Unit Truk (contoh: DT 90)', 'error');
      return;
    }
    if (!formData.driverName.trim()) {
      showToast('Mohon masukkan Nama Pemuat', 'error');
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

      showToast(`Pengiriman unit ${formData.truckNumber} (${ton} Ton) berhasil tersimpan langsung ke Firestore!`, 'success');

      // Reset form but retain date & truck for repetitive inputs
      setFormData((prev) => ({
        ...prev,
        tonnage: '' as any,
        notes: '',
      }));
    } catch (err: any) {
      console.error('Error addDoc:', err);
      showToast(`Gagal menyimpan ke database: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (record: DailyRecord) => {
    setRecordToEdit(record);
    setEditFormData({ ...record });
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData) return;

    const ton = parseFloat(String(editFormData.tonnage));
    if (isNaN(ton) || ton <= 0) {
      showToast('Mohon masukkan Tonase yang valid dalam angka', 'error');
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

      showToast(`Data unit ${editFormData.truckNumber} berhasil diperbarui!`, 'success');
      setRecordToEdit(null);
      setEditFormData(null);
    } catch (err: any) {
      showToast(`Gagal memperbarui data: ${err.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Confirm Delete
  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDailyRecord(recordToDelete.id);
      showToast(`Catatan unit ${recordToDelete.truckNumber} berhasil dihapus.`, 'info');
      setRecordToDelete(null);
    } catch (err: any) {
      showToast(`Gagal menghapus data: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy Link Khusus Pemuat
  const handleCopyLink = () => {
    const url = getPemuatPortalUrl(activePemuat || undefined);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    setIsCopied(true);
    showToast('Tautan portal pemuat berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Filter by My Records
      if (filterMode === 'MY_RECORDS' && activePemuat) {
        if (!r.driverName.toLowerCase().includes(activePemuat.toLowerCase())) return false;
      }

      // Filter by Afdeling
      if (filterAfdeling !== 'ALL' && r.afdeling !== filterAfdeling) return false;

      // Filter by Truck
      if (filterTruck !== 'ALL' && r.truckNumber !== filterTruck) return false;

      // Filter by Date Range
      if (filterDateRange === 'TODAY') {
        if (r.date !== todayStr) return false;
      } else if (filterDateRange === '7DAYS') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const sevenDaysAgo = d.toISOString().split('T')[0];
        if (r.date < sevenDaysAgo) return false;
      } else if (filterDateRange === 'THIS_MONTH') {
        const currentMonth = todayStr.substring(0, 7);
        if (!r.date.startsWith(currentMonth)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTruck = r.truckNumber.toLowerCase().includes(q);
        const matchDriver = r.driverName.toLowerCase().includes(q);
        const matchAfdeling = r.afdeling.toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        if (!matchTruck && !matchDriver && !matchAfdeling && !matchNotes) return false;
      }

      return true;
    });
  }, [records, filterMode, activePemuat, filterAfdeling, filterTruck, filterDateRange, searchQuery, todayStr]);

  // Calculations for cards
  const totalTonnage = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.tonnage) || 0), 0);
  }, [filteredRecords]);

  const totalTrips = filteredRecords.length;
  const avgTonnagePerTrip = totalTrips > 0 ? totalTonnage / totalTrips : 0;

  // Today specific calculations
  const todayRecords = useMemo(() => {
    return records.filter((r) => r.date === todayStr);
  }, [records, todayStr]);

  const todayTonnage = useMemo(() => {
    return todayRecords.reduce((sum, r) => sum + (Number(r.tonnage) || 0), 0);
  }, [todayRecords]);

  // Data catatan khusus Kalender (terfilter nama/pencarian tanpa dibatasi filter rentang tanggal)
  const calendarFilteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterMode === 'MY_RECORDS' && activePemuat) {
        if (!r.driverName.toLowerCase().includes(activePemuat.toLowerCase())) return false;
      }
      if (filterAfdeling !== 'ALL' && r.afdeling !== filterAfdeling) return false;
      if (filterTruck !== 'ALL' && r.truckNumber !== filterTruck) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTruck = r.truckNumber.toLowerCase().includes(q);
        const matchDriver = r.driverName.toLowerCase().includes(q);
        const matchAfdeling = r.afdeling.toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        if (!matchTruck && !matchDriver && !matchAfdeling && !matchNotes) return false;
      }
      return true;
    });
  }, [records, filterMode, activePemuat, filterAfdeling, filterTruck, searchQuery]);

  // Peta agregat harian untuk kalender (YYYY-MM-DD -> metrik & daftar rit)
  const dailyStatsMap = useMemo(() => {
    const map = new Map<string, {
      date: string;
      trips: DailyRecord[];
      totalTonnage: number;
      tripCount: number;
      pemuatList: string[];
      truckList: string[];
      afdelingList: string[];
    }>();

    calendarFilteredRecords.forEach((r) => {
      const dateKey = r.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          trips: [],
          totalTonnage: 0,
          tripCount: 0,
          pemuatList: [],
          truckList: [],
          afdelingList: [],
        });
      }
      const entry = map.get(dateKey)!;
      entry.trips.push(r);
      entry.totalTonnage += Number(r.tonnage) || 0;
      entry.tripCount += 1;
      if (r.driverName && !entry.pemuatList.includes(r.driverName)) {
        entry.pemuatList.push(r.driverName);
      }
      if (r.truckNumber && !entry.truckList.includes(r.truckNumber)) {
        entry.truckList.push(r.truckNumber);
      }
      if (r.afdeling && !entry.afdelingList.includes(r.afdeling)) {
        entry.afdelingList.push(r.afdeling);
      }
    });

    return map;
  }, [calendarFilteredRecords]);

  // Grid sel kalender bulanan (Senin s/d Minggu)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    // Konversi hari: 0 = Min, 1 = Sen -> jadikan Senin = 0 s/d Minggu = 6
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const daysInCurrentMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      stat?: {
        trips: DailyRecord[];
        totalTonnage: number;
        tripCount: number;
        pemuatList: string[];
        truckList: string[];
        afdelingList: string[];
      };
    }> = [];

    // Hari dari bulan sebelumnya
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(calendarYear, calendarMonth - 1, dayNum);
      const prevY = prevDate.getFullYear();
      const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
      const prevD = String(dayNum).padStart(2, '0');
      const dateStr = `${prevY}-${prevM}-${prevD}`;
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        stat: dailyStatsMap.get(dateStr),
      });
    }

    // Hari bulan aktif
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const curM = String(calendarMonth + 1).padStart(2, '0');
      const curD = String(day).padStart(2, '0');
      const dateStr = `${calendarYear}-${curM}-${curD}`;
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        stat: dailyStatsMap.get(dateStr),
      });
    }

    // Hari bulan berikutnya pelengkap grid (35 atau 42)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(calendarYear, calendarMonth + 1, day);
      const nextY = nextDate.getFullYear();
      const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nextD = String(day).padStart(2, '0');
      const dateStr = `${nextY}-${nextM}-${nextD}`;
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        stat: dailyStatsMap.get(dateStr),
      });
    }

    return cells;
  }, [calendarYear, calendarMonth, todayStr, dailyStatsMap]);

  // Metrik ringkasan bulan yang sedang dibuka di kalender
  const monthMetrics = useMemo(() => {
    const curYearMonth = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    let monthTon = 0;
    let monthRit = 0;
    const uniqueLoaders = new Set<string>();
    const activeDays = new Set<string>();

    calendarFilteredRecords.forEach((r) => {
      if (r.date.startsWith(curYearMonth)) {
        monthTon += Number(r.tonnage) || 0;
        monthRit += 1;
        activeDays.add(r.date);
        if (r.driverName) uniqueLoaders.add(r.driverName);
      }
    });

    return {
      monthTon,
      monthRit,
      activeDaysCount: activeDays.size,
      loadersCount: uniqueLoaders.size,
    };
  }, [calendarFilteredRecords, calendarYear, calendarMonth]);

  // Navigasi Bulan Kalender
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setSelectedDateForDetail(todayStr);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
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
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catatan Harian Pemuat');
    XLSX.writeFile(workbook, `Catatan_Pemuat_TBS_${todayStr}.xlsx`);
    showToast('File Excel berhasil diunduh.', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm animate-in slide-in-from-top-4 duration-200 border ${
            notification.type === 'error'
              ? 'bg-rose-950/95 text-rose-200 border-rose-500/50 shadow-rose-500/20'
              : notification.type === 'info'
              ? 'bg-sky-950/95 text-sky-200 border-sky-500/50 shadow-sky-500/20'
              : 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50 shadow-emerald-500/20'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* ISOLATED TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold ring-1 ring-emerald-400/30">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                    Portal Pemuat TBS
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                    Terisolasi
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Akses Khusus Lapangan • Catatan Rit & Tonase TBS
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Firestore Indicator */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Firestore Online</span>
              </div>

              {/* Copy Link Button */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                title="Salin tautan laman ini untuk disimpan di WhatsApp / HP"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isCopied ? 'Tersalin' : 'Salin Link'}</span>
              </button>

              {/* Exit to Admin button if opened by admin */}
              {onExitToAdmin && (
                <button
                  onClick={() => {
                    if (window.confirm('Keluar dari portal pemuat dan kembali ke dashboard admin utama?')) {
                      onExitToAdmin();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
                  title="Kembali ke Dashboard Admin Utama"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mode Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Selamat Datang Pemuat */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Akses Cepat Smartphone
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Riwayat & Input Data Harian Truk TBS
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Laman ini dirancang khusus untuk pemuat di kebun agar dapat menginput dan memantau tonase buah kelapa sawit secara real-time langsung dari HP tanpa melalui menu admin.
              </p>
            </div>

            {/* Quick Profile Filter */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-2 shrink-0">
              <User className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">Nama Pemuat:</span>
                <input
                  type="text"
                  value={activePemuat}
                  onChange={(e) => setActivePemuat(e.target.value)}
                  placeholder="Ketik nama Anda..."
                  className="bg-transparent border-b border-emerald-500/40 text-emerald-300 font-bold focus:outline-none focus:border-emerald-400 text-xs py-0.5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3 KARTU RINGKASAN TOTAL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Tonase */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                {filterDateRange === 'TODAY' ? 'Tonase Hari Ini' : 'Total Tonase'}
              </span>
              <Scale className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {totalTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs sm:text-sm font-semibold text-emerald-400 ml-1.5">Ton</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Dari <strong className="text-slate-200">{totalTrips} Ritase</strong> terfilter
            </p>
          </div>

          {/* Total Pengiriman / Rit */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Total Pengiriman</span>
              <Truck className="w-5 h-5 text-sky-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {totalTrips}
              <span className="text-xs sm:text-sm font-semibold text-sky-400 ml-1.5">Rit</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Total perjalanan angkut ke PKS
            </p>
          </div>

          {/* Rata-rata Ton per Rit */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Rerata Muatan</span>
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {avgTonnagePerTrip.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs sm:text-sm font-semibold text-amber-400 ml-1.5">Ton / Rit</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Kapasitas rata-rata per pengangkutan
            </p>
          </div>
        </div>

        {/* FORM INPUT CEPAT LAPANGAN */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Plus className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Form Input Pengiriman TBS Baru
                </h2>
                <p className="text-xs text-slate-400">
                  Data otomatis tersimpan ke cloud Firebase Firestore secara langsung
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Tanggal:
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Nomor Unit Truk */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  Nomor Unit Truk:
                </label>
                <input
                  type="text"
                  value={formData.truckNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, truckNumber: e.target.value }))}
                  placeholder="Contoh: DT 90"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-bold uppercase"
                />
                {/* Quick Unit Pills */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {QUICK_TRUCKS.slice(0, 4).map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, truckNumber: dt }))}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition ${
                        formData.truckNumber === dt
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Pemuat */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  Nama Pemuat:
                </label>
                <input
                  type="text"
                  value={formData.driverName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, driverName: e.target.value }))}
                  placeholder="Contoh: Anton"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              {/* Tonase (Ton) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  Tonase (Ton):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={formData.tonnage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tonnage: e.target.value as any }))}
                  placeholder="Contoh: 8.4"
                  required
                  className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-emerald-400 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 font-bold font-mono text-base"
                />
              </div>

              {/* Afdeling */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Afdeling:
                </label>
                <select
                  value={formData.afdeling}
                  onChange={(e) => setFormData((prev) => ({ ...prev, afdeling: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {QUICK_AFDELINGS.map((afd) => (
                    <option key={afd} value={afd}>
                      {afd}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Catatan / Keterangan & Tombol Simpan */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Catatan tambahan (contoh: TBS Masak Blok B3, Trip Siang) - Opsional"
                className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-500/25 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Simpan Pengiriman TBS</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* TABEL & KALENDER RIWAYAT INPUT DATA HARIAN */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          {/* Header & Controls: Mode Switcher, Filter & Export */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  {viewMode === 'calendar' ? (
                    <CalendarDays className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-emerald-400" />
                  )}
                  {viewMode === 'calendar' ? 'Kalender Muat TBS Bulanan' : 'Riwayat Pengiriman TBS Real-Time'}
                </h2>

                {/* View Mode Toggle: Calendar vs Table */}
                <div className="inline-flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      viewMode === 'calendar'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Kalender</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabel & Riwayat</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {viewMode === 'calendar'
                  ? `Rekap ritase per tanggal untuk bulan ${INDO_MONTHS[calendarMonth]} ${calendarYear} • Klik tanggal untuk detail lengkap`
                  : `Menampilkan ${filteredRecords.length} dari ${records.length} catatan ritase`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Toggle Mode: Semua Pemuat vs Hanya Saya */}
              <button
                type="button"
                onClick={() => setFilterMode((prev) => (prev === 'MY_RECORDS' ? 'ALL' : 'MY_RECORDS'))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  filterMode === 'MY_RECORDS'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{filterMode === 'MY_RECORDS' ? `Khusus: ${activePemuat}` : 'Semua Pemuat'}</span>
              </button>

              {/* Ekspor Excel */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
                title="Unduh data sebagai file Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAMPILAN 1: KALENDER BULANAN INTERAKTIF */}
          {/* ========================================================================= */}
          {viewMode === 'calendar' ? (
            <div className="space-y-4">
              {/* Month Navigation & Month Stat Summary */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition cursor-pointer"
                    title="Bulan sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="px-3 py-1 text-center min-w-[160px]">
                    <span className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {INDO_MONTHS[calendarMonth]} {calendarYear}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition cursor-pointer"
                    title="Bulan berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleGoToToday}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 text-xs font-semibold border border-slate-800 transition cursor-pointer"
                  >
                    Hari Ini
                  </button>
                </div>

                {/* Ringkasan Cepat Bulan Ini */}
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-xs">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                    <span className="text-slate-400">Total Muat:</span>
                    <strong className="text-emerald-400 font-mono font-bold">
                      {monthMetrics.monthTon.toLocaleString('id-ID', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      Ton
                    </strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                    <span className="text-slate-400">Ritase:</span>
                    <strong className="text-white font-mono font-bold">{monthMetrics.monthRit} Rit</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                    <span className="text-slate-400">Hari Aktif:</span>
                    <strong className="text-white font-mono font-bold">{monthMetrics.activeDaysCount} Hari</strong>
                  </div>
                </div>
              </div>

              {/* Search Bar for Calendar Filtering */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter nama pemuat, nomor truk DT, afdeling, atau catatan pada kalender..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Petunjuk Interaksi */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Ada Aktivitas Muat</span>
                  <span className="inline-block w-2.5 h-2.5 rounded-full border border-emerald-400 bg-emerald-500/20 ml-2" />
                  <span>Hari Ini</span>
                </div>
                <span className="text-slate-500 hidden sm:inline">Klik pada kotak tanggal untuk melihat rincian muat</span>
              </div>

              {/* Header Nama Hari (Senin - Minggu) */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-bold text-slate-400">
                {INDO_DAYS_HEADER.map((day, idx) => (
                  <div
                    key={day}
                    className={`py-2 rounded-lg bg-slate-950/70 border border-slate-800/80 ${
                      idx === 6 ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{INDO_DAYS_HEADER_SHORT[idx]}</span>
                  </div>
                ))}
              </div>

              {/* Grid Tanggal Kalender (7 Kolom) */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarCells.map((cell) => {
                  const hasData = cell.stat && cell.stat.tripCount > 0;
                  const stats = cell.stat;

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => setSelectedDateForDetail(cell.dateStr)}
                      className={`relative min-h-[95px] sm:min-h-[125px] p-1.5 sm:p-2 rounded-xl border transition-all duration-150 flex flex-col justify-between cursor-pointer select-none ${
                        cell.isCurrentMonth
                          ? hasData
                            ? 'bg-slate-950/90 border-slate-700/80 hover:border-emerald-500/80 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-emerald-500/10'
                            : 'bg-slate-950/50 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/40'
                          : 'bg-slate-950/20 border-slate-900/40 opacity-40 hover:opacity-80'
                      } ${
                        cell.isToday
                          ? 'ring-2 ring-emerald-400/80 border-emerald-500 bg-emerald-950/15'
                          : ''
                      }`}
                    >
                      {/* Baris Atas: Nomor Tanggal & Indikator Hari Ini */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center justify-center text-xs font-bold font-mono rounded-md px-1.5 py-0.5 ${
                            cell.isToday
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : hasData
                              ? 'text-white'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {cell.isToday && (
                          <span className="hidden md:inline-block text-[9px] uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Hari Ini
                          </span>
                        )}

                        {hasData && !cell.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>

                      {/* Tengah: Metrik Tonase & Ritase */}
                      {hasData && stats ? (
                        <div className="my-1 space-y-1">
                          {/* Tonase Card */}
                          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-1 sm:px-1.5 py-0.5 text-center">
                            <span className="text-[11px] sm:text-xs font-black text-emerald-400 font-mono block leading-tight">
                              {stats.totalTonnage.toLocaleString('id-ID', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 2,
                              })}
                              <span className="text-[9px] font-semibold text-emerald-400/80 ml-0.5">T</span>
                            </span>
                          </div>

                          {/* Ritase & Truk */}
                          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-300 font-mono">
                            <span className="font-bold text-white">{stats.tripCount}</span>
                            <span className="text-slate-400">Rit</span>
                          </div>

                          {/* Daftar Nama Pemuat (Singkat & Rapi) */}
                          <div className="hidden sm:block pt-0.5">
                            <div className="flex flex-wrap gap-1 max-h-10 overflow-hidden">
                              {stats.pemuatList.slice(0, 2).map((nama: string) => (
                                <span
                                  key={nama}
                                  className="text-[9px] font-semibold bg-slate-900 border border-slate-700/80 text-slate-200 px-1 py-0.5 rounded truncate max-w-[70px]"
                                  title={nama}
                                >
                                  {nama}
                                </span>
                              ))}
                              {stats.pemuatList.length > 2 && (
                                <span className="text-[9px] text-emerald-400 font-bold bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                                  +{stats.pemuatList.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="my-auto py-2 text-center">
                          <span className="text-[10px] text-slate-600 font-mono">-</span>
                        </div>
                      )}

                      {/* Baris Bawah: Hint / Jumlah Pemuat Mobile */}
                      {hasData && stats ? (
                        <div className="pt-0.5 flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-900/60">
                          <span className="sm:hidden text-slate-300 truncate font-medium">
                            {stats.pemuatList[0] || ''}
                            {stats.pemuatList.length > 1 ? ` (+${stats.pemuatList.length - 1})` : ''}
                          </span>
                          <span className="hidden sm:inline text-slate-500 font-medium group-hover:text-emerald-400">
                            {stats.truckList.join(', ')}
                          </span>
                          <span className="text-emerald-400 font-mono text-[9px] ml-auto">Rincian &rarr;</span>
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-700 text-center opacity-0 group-hover:opacity-100 transition">
                          Kosong
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* TAMPILAN 2: TABEL & RIWAYAT LIST VIEW */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Filter Bar (Search + Date Range) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Search Input */}
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nomor truk DT, pemuat, afdeling, catatan..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Filter Date Range */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  {(['TODAY', '7DAYS', 'THIS_MONTH', 'ALL'] as const).map((range) => {
                    const labels: Record<string, string> = {
                      TODAY: 'Hari Ini',
                      '7DAYS': '7 Hari',
                      THIS_MONTH: 'Bulan Ini',
                      ALL: 'Semua',
                    };
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setFilterDateRange(range)}
                        className={`flex-1 py-1 px-1.5 rounded-lg font-semibold text-center transition cursor-pointer ${
                          filterDateRange === range
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {labels[range]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Cards (Visible on small screens) */}
              <div className="block lg:hidden space-y-2.5">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800/80">
                    <Truck className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="font-semibold text-slate-400">Tidak ada catatan pengiriman ditemukan</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Gunakan form di atas untuk mencatat pengiriman TBS pertama hari ini.</p>
                  </div>
                ) : (
                  filteredRecords.map((r) => (
                    <div
                      key={r.id}
                      className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            {r.truckNumber}
                          </span>
                          <span className="text-xs text-slate-300 font-medium">{r.afdeling}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-400 font-mono">
                            {r.tonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                            <span className="text-[10px] font-semibold">Ton</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 font-semibold">{r.driverName}</span>
                          <span>•</span>
                          <span>{r.date}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                            title="Edit data"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRecordToDelete(r)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition"
                            title="Hapus data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {r.notes && (
                        <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg font-mono">
                          {r.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View (Visible on lg screens) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-semibold w-10">No</th>
                      <th className="pb-3 font-semibold">Tanggal</th>
                      <th className="pb-3 font-semibold">Unit Truk</th>
                      <th className="pb-3 font-semibold">Pemuat</th>
                      <th className="pb-3 font-semibold">Afdeling</th>
                      <th className="pb-3 font-semibold text-right">Tonase</th>
                      <th className="pb-3 font-semibold">Catatan</th>
                      <th className="pb-3 font-semibold text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <Truck className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                          <p className="font-semibold text-slate-400">Tidak ada catatan pengiriman</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Input data baru melalui form di atas.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, idx) => (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-3 text-slate-300 font-mono">{r.date}</td>
                          <td className="py-3">
                            <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/25">
                              {r.truckNumber}
                            </span>
                          </td>
                          <td className="py-3 text-slate-200 font-semibold">{r.driverName}</td>
                          <td className="py-3 text-slate-300">{r.afdeling}</td>
                          <td className="py-3 text-right">
                            <span className="font-bold text-emerald-400 font-mono text-sm">
                              {r.tonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                              <span className="text-[10px] font-semibold text-emerald-400/80">Ton</span>
                            </span>
                          </td>
                          <td className="py-3 text-slate-400 text-[11px] max-w-xs truncate">
                            {r.notes || '-'}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(r)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition"
                                title="Edit data"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setRecordToDelete(r)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-400 transition"
                                title="Hapus data"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL DETAIL PER TANGGAL (CALENDAR DAY DETAILS) */}
      {selectedDateForDetail && (() => {
        const dayTrips = records.filter((r) => r.date === selectedDateForDetail);
        const dayTotalTonnage = dayTrips.reduce((sum, r) => sum + (Number(r.tonnage) || 0), 0);
        const dayPemuatList = Array.from(new Set(dayTrips.map((r) => r.driverName))).filter(Boolean);
        const dayTruckList = Array.from(new Set(dayTrips.map((r) => r.truckNumber))).filter(Boolean);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm sm:text-base">
                      Rincian Muat: {formatDateIndoFull(selectedDateForDetail)}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {selectedDateForDetail} • {dayTrips.length} Ritase Tercatat
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDateForDetail(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content Scrollable */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                {/* 4 Summary Mini Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block">Total Tonase</span>
                    <strong className="text-emerald-400 font-mono text-base font-black">
                      {dayTotalTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <span className="text-[10px] text-slate-400 ml-1">Ton</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block">Total Ritase</span>
                    <strong className="text-white font-mono text-base font-black">{dayTrips.length}</strong>
                    <span className="text-[10px] text-slate-400 ml-1">Rit</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block">Pemuat Bertugas</span>
                    <strong className="text-white font-mono text-base font-black">{dayPemuatList.length}</strong>
                    <span className="text-[10px] text-slate-400 ml-1">Orang</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block">Unit Truk</span>
                    <strong className="text-white font-mono text-base font-black">{dayTruckList.length}</strong>
                    <span className="text-[10px] text-slate-400 ml-1">Unit</span>
                  </div>
                </div>

                {/* Daftar Pemuat Yang Bertugas */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      Daftar Pemuat Bertugas ({dayPemuatList.length})
                    </h4>
                  </div>
                  {dayPemuatList.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Belum ada pemuat yang mencatat ritase pada tanggal ini.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {dayPemuatList.map((nama) => {
                        const loaderTrips = dayTrips.filter((r) => r.driverName === nama);
                        const loaderTon = loaderTrips.reduce((s, r) => s + (Number(r.tonnage) || 0), 0);
                        return (
                          <div
                            key={nama}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-white"
                          >
                            <span className="font-semibold text-slate-200">{nama}</span>
                            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {loaderTon.toFixed(2)} T ({loaderTrips.length} Rit)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Daftar Rincian Ritase / Pengiriman */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      Rincian Ritase & Muatan
                    </h4>
                    <span className="text-[11px] text-slate-400">Total {dayTrips.length} transaksi</span>
                  </div>

                  {dayTrips.length === 0 ? (
                    <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-slate-800/80 text-slate-500 text-xs space-y-2">
                      <CalendarDays className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                      <p className="font-medium text-slate-400">Tidak ada pengiriman tercatat pada {selectedDateForDetail}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, date: selectedDateForDetail }));
                          setSelectedDateForDetail(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          showToast(`Tanggal form disetel ke ${selectedDateForDetail}`, 'info');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-bold text-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Input Pengiriman untuk Tanggal Ini</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayTrips.map((trip, idx) => (
                        <div
                          key={trip.id}
                          className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-xs font-mono w-4">{idx + 1}</span>
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/25 shrink-0">
                              {trip.truckNumber}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-white">{trip.driverName}</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-400">{trip.afdeling}</span>
                              </div>
                              {trip.notes && (
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{trip.notes}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-900">
                            <span className="text-sm font-black text-emerald-400 font-mono">
                              {trip.tonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                              <span className="text-[10px] font-semibold text-emerald-400/80">Ton</span>
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDateForDetail(null);
                                  handleOpenEditModal(trip);
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition cursor-pointer"
                                title="Edit pengiriman"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDateForDetail(null);
                                  setRecordToDelete(trip);
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-300 hover:text-rose-400 transition cursor-pointer"
                                title="Hapus pengiriman"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, date: selectedDateForDetail }));
                    setSelectedDateForDetail(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    showToast(`Tanggal form disetel ke ${selectedDateForDetail}`, 'info');
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>+ Tambah Muat Tanggal Ini</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDateForDetail(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT MODAL */}
      {recordToEdit && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                Edit Catatan Ritase {editFormData.truckNumber}
              </h3>
              <button
                onClick={() => {
                  setRecordToEdit(null);
                  setEditFormData(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tanggal:</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nomor Truk:</label>
                <input
                  type="text"
                  value={editFormData.truckNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, truckNumber: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nama Pemuat:</label>
                <input
                  type="text"
                  value={editFormData.driverName}
                  onChange={(e) => setEditFormData({ ...editFormData, driverName: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tonase (Ton):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={editFormData.tonnage}
                  onChange={(e) => setEditFormData({ ...editFormData, tonnage: e.target.value as any })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-bold font-mono focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Afdeling:</label>
                <select
                  value={editFormData.afdeling}
                  onChange={(e) => setEditFormData({ ...editFormData, afdeling: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {QUICK_AFDELINGS.map((afd) => (
                    <option key={afd} value={afd}>
                      {afd}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Catatan:</label>
                <input
                  type="text"
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Catatan tambahan..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setRecordToEdit(null);
                    setEditFormData(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5"
                >
                  {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Hapus Catatan Pengiriman?</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              Apakah Anda yakin ingin menghapus catatan pengiriman unit <strong>{recordToDelete.truckNumber}</strong> ({recordToDelete.tonnage} Ton - {recordToDelete.driverName}) dari database?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Hapus Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        <p>Portal Lapangan Catatan Harian Truk TBS &bull; Terhubung Real-Time ke Firebase Firestore</p>
      </footer>
    </div>
  );
};
