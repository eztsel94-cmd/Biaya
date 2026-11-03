import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Scale,
  Calendar,
  User,
  MapPin,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  X,
  Copy,
  ShieldAlert,
  TrendingUp,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Table,
  Sparkles,
  RotateCcw,
  Lock,
  KeyRound,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DailyRecord } from '../types/dailyRecord';
import { TruckUnit } from '../types/truck';
import {
  subscribeToDailyRecords,
  subscribeToFirestorePemuat,
} from '../services/firebase';
import {
  getPemuatPortalUrl,
  getWhatsAppSharePemuatUrl,
  safeUpdateBrowserUrl,
  copyTextToClipboard,
} from '../utils/driverLink';
import { getTodayWIB, getWIBDateParts, getDaysAgoWIB } from '../utils/formatters';

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

export function parsePemuatNames(driverName: string | undefined | null): string[] {
  if (!driverName) return [];
  return String(driverName)
    .split(/[\/,]/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

export interface PemuatShareInfo {
  rawTonnage: number;
  pemuatNames: string[];
  pemuatCount: number;
  shareTonnage: number;
  isShared: boolean;
  partners: string[];
}

export function getRecordPemuatShare(
  record: { driverName?: string; tonnage?: number | string },
  targetPemuat?: string
): PemuatShareInfo {
  const rawTonnage = Number(record.tonnage) || 0;
  const pemuatNames = parsePemuatNames(record.driverName);
  const pemuatCount = Math.max(1, pemuatNames.length);

  if (!targetPemuat || !targetPemuat.trim()) {
    return {
      rawTonnage,
      pemuatNames,
      pemuatCount,
      shareTonnage: rawTonnage,
      isShared: pemuatCount > 1,
      partners: [],
    };
  }

  const cleanTarget = targetPemuat.trim().toUpperCase();
  const partners = pemuatNames.filter((n) => n !== cleanTarget);
  const shareTonnage = rawTonnage / pemuatCount;

  return {
    rawTonnage,
    pemuatNames,
    pemuatCount,
    shareTonnage,
    isShared: pemuatCount > 1,
    partners,
  };
}

export interface IndividualPemuatSummary {
  name: string;
  ritCount: number;
  rawTonnage: number;
  shareTonnage: number;
}

export function computeIndividualPemuatBreakdown(recordsList: DailyRecord[]): IndividualPemuatSummary[] {
  const map = new Map<string, IndividualPemuatSummary>();

  recordsList.forEach((r) => {
    const names = parsePemuatNames(r.driverName);
    if (names.length === 0) return;
    const count = names.length;
    const rawTon = Number(r.tonnage) || 0;
    const sharePerPerson = rawTon / count;

    names.forEach((name) => {
      if (!map.has(name)) {
        map.set(name, {
          name,
          ritCount: 0,
          rawTonnage: 0,
          shareTonnage: 0,
        });
      }
      const entry = map.get(name)!;
      entry.ritCount += 1;
      entry.rawTonnage += rawTon;
      entry.shareTonnage += sharePerPerson;
    });
  });

  return Array.from(map.values()).sort((a, b) => b.shareTonnage - a.shareTonnage);
}

interface PemuatPortalViewProps {
  trucks?: TruckUnit[];
  initialPemuatName?: string;
  onExitToAdmin?: () => void;
}

export const PemuatPortalView: React.FC<PemuatPortalViewProps> = ({
  trucks = [],
  initialPemuatName = '',
  onExitToAdmin,
}) => {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Master Nama Pemuat dari Firestore
  const [pemuatMaster, setPemuatMaster] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const unsub = subscribeToFirestorePemuat((list) => {
      setPemuatMaster(list);
    });
    return () => unsub();
  }, []);

  // Pilihan Nama Pemuat ('' = Semua Pemuat)
  const [selectedPemuat, setSelectedPemuat] = useState<string>(() => (initialPemuatName || '').trim());

  useEffect(() => {
    if (initialPemuatName !== undefined) {
      setSelectedPemuat(initialPemuatName.trim());
    }
  }, [initialPemuatName]);

  // Mode Tampilan: Kalender Bulanan Interaktif vs Daftar Riwayat
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  // State Tanggal Hari Ini & Navigasi Kalender sesuai Waktu Indonesia Barat (WIB / UTC+7)
  const [todayStr, setTodayStr] = useState<string>(() => getTodayWIB());
  const [calendarYear, setCalendarYear] = useState<number>(() => getWIBDateParts().year);
  const [calendarMonth, setCalendarMonth] = useState<number>(() => getWIBDateParts().monthIndex);

  // State Modal Detail per Tanggal & Pencarian Rincian
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<string | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');

  // Filter & Search State untuk Daftar Riwayat
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTruck, setFilterTruck] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH'>('THIS_MONTH');

  // Share & PIN Admin Modal State
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Sinkronisasi otomatis tanggal WIB secara real-time
  useEffect(() => {
    const syncWIBDate = () => {
      const wib = getWIBDateParts();
      setTodayStr((prevToday) => {
        if (prevToday !== wib.dateStr) {
          setCalendarYear(wib.year);
          setCalendarMonth(wib.monthIndex);
          return wib.dateStr;
        }
        return prevToday;
      });
    };

    syncWIBDate();
    const intervalId = window.setInterval(syncWIBDate, 30000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncWIBDate();
      }
    };
    window.addEventListener('focus', syncWIBDate);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncWIBDate);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  // Notifikasi helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 3500);
  };

  // Subscribe ke real-time Firestore daily records
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
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Daftar nama pemuat unik untuk tombol pilih cepat
  const allPemuatNames = useMemo(() => {
    const nameSet = new Set<string>();
    pemuatMaster.forEach((p) => {
      if (p.name && p.name.trim()) {
        nameSet.add(p.name.trim().toUpperCase());
      }
    });
    records.forEach((r) => {
      if (r.driverName) {
        parsePemuatNames(r.driverName).forEach((part) => nameSet.add(part));
      }
    });
    return Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'id'));
  }, [pemuatMaster, records]);

  // Dynamic Truck codes
  const dynamicTruckCodes = useMemo(() => {
    const codeSet = new Set<string>();
    trucks.forEach((t) => {
      if (t.code) codeSet.add(t.code.trim().toUpperCase());
    });
    records.forEach((r) => {
      if (r.truckNumber) codeSet.add(r.truckNumber.trim().toUpperCase());
    });
    return Array.from(codeSet).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [trucks, records]);

  // Saat memilih nama pemuat, perbarui URL tetap di ?portal=pemuat tanpa pindah ke beranda
  const handleSelectPemuat = (name: string) => {
    setSelectedPemuat(name);
    const queryStr = name && name.trim()
      ? `?portal=pemuat&nama=${encodeURIComponent(name.trim())}`
      : '?portal=pemuat';
    safeUpdateBrowserUrl(queryStr, true);
  };

  // Copy Link Khusus Pemuat
  const handleCopyLink = async () => {
    const url = getPemuatPortalUrl(selectedPemuat || undefined);
    await copyTextToClipboard(url);
    setIsCopied(true);
    showToast('Link Portal Pemuat berhasil disalin!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Verifikasi PIN Admin untuk keluar ke Beranda Utama Admin
  const handleVerifyPinAndExit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().toUpperCase() === 'TRAKSI_001') {
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      if (onExitToAdmin) {
        onExitToAdmin();
      }
    } else {
      setPinError('PIN Admin salah! Akses ditolak.');
    }
  };

  // Catatan yang cocok dengan Pemuat yang dipilih & pencarian
  const pemuatFilteredRecords = useMemo(() => {
    return records.filter((r) => {
      const driverNameStr = String(r.driverName || '');
      const truckNumberStr = String(r.truckNumber || '');
      const afdelingStr = String(r.afdeling || '');
      const notesStr = String(r.notes || '');

      if (selectedPemuat) {
        const parts = parsePemuatNames(driverNameStr).map((p) => p.toLowerCase());
        const target = selectedPemuat.trim().toLowerCase();
        const isMatch = parts.length > 0 ? parts.includes(target) : driverNameStr.toLowerCase().includes(target);
        if (!isMatch) return false;
      }
      if (filterTruck !== 'ALL' && truckNumberStr.toUpperCase() !== filterTruck.toUpperCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTruck = truckNumberStr.toLowerCase().includes(q);
        const matchDriver = driverNameStr.toLowerCase().includes(q);
        const matchAfdeling = afdelingStr.toLowerCase().includes(q);
        const matchNotes = notesStr.toLowerCase().includes(q);
        if (!matchTruck && !matchDriver && !matchAfdeling && !matchNotes) return false;
      }
      return true;
    });
  }, [records, selectedPemuat, filterTruck, searchQuery]);

  // Catatan terfilter untuk tampilan Daftar Riwayat (mengikuti filter periode)
  const tableFilteredRecords = useMemo(() => {
    return pemuatFilteredRecords.filter((r) => {
      const dateStr = String(r.date || '');
      if (filterDateRange === 'TODAY') {
        if (dateStr !== todayStr) return false;
      } else if (filterDateRange === '7DAYS') {
        const sevenDaysAgo = getDaysAgoWIB(7);
        if (dateStr < sevenDaysAgo) return false;
      } else if (filterDateRange === 'THIS_MONTH') {
        const curYearMonth = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
        if (!dateStr.startsWith(curYearMonth)) return false;
      }
      return true;
    });
  }, [pemuatFilteredRecords, filterDateRange, todayStr, calendarYear, calendarMonth]);

  // Hasil Hari Ini (WIB) - Jika pemuat dipilih, hitung bagian bersihnya setelah dibagi jumlah orang di truk
  const todayStats = useMemo(() => {
    const todayList = pemuatFilteredRecords.filter((r) => r.date === todayStr);
    const shareTon = todayList.reduce(
      (sum, r) => sum + getRecordPemuatShare(r, selectedPemuat).shareTonnage,
      0
    );
    const rawTon = todayList.reduce((sum, r) => sum + (Number(r.tonnage) || 0), 0);
    return {
      trips: todayList,
      tonnage: shareTon,
      rawTonnage: rawTon,
      ritCount: todayList.length,
    };
  }, [pemuatFilteredRecords, todayStr, selectedPemuat]);

  // Peta agregat harian untuk kalender (YYYY-MM-DD -> metrik & daftar rit)
  const dailyStatsMap = useMemo(() => {
    const map = new Map<string, {
      date: string;
      trips: DailyRecord[];
      totalTonnage: number;
      rawTotalTonnage: number;
      tripCount: number;
      pemuatList: string[];
      truckList: string[];
      afdelingList: string[];
    }>();

    pemuatFilteredRecords.forEach((r) => {
      const dateKey = r.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          trips: [],
          totalTonnage: 0,
          rawTotalTonnage: 0,
          tripCount: 0,
          pemuatList: [],
          truckList: [],
          afdelingList: [],
        });
      }
      const entry = map.get(dateKey)!;
      const shareInfo = getRecordPemuatShare(r, selectedPemuat);
      entry.trips.push(r);
      entry.totalTonnage += shareInfo.shareTonnage;
      entry.rawTotalTonnage += shareInfo.rawTonnage;
      entry.tripCount += 1;
      shareInfo.pemuatNames.forEach((pName) => {
        if (!entry.pemuatList.includes(pName)) {
          entry.pemuatList.push(pName);
        }
      });
      if (r.truckNumber && !entry.truckList.includes(r.truckNumber)) {
        entry.truckList.push(r.truckNumber);
      }
      if (r.afdeling && !entry.afdelingList.includes(r.afdeling)) {
        entry.afdelingList.push(r.afdeling);
      }
    });

    return map;
  }, [pemuatFilteredRecords, selectedPemuat]);

  // Langkah 1 & 2: Rincian Pembagian Tonase per Teman / Tim untuk bulan yang aktif, lalu ditotal khusus untuk pemuat terpilih
  const monthPartnerBreakdown = useMemo(() => {
    if (!selectedPemuat) return [];
    const curYearMonth = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const targetUpper = selectedPemuat.trim().toUpperCase();

    const groupMap = new Map<string, {
      key: string;
      teamLabel: string;
      partnerLabel: string;
      pemuatCount: number;
      ritCount: number;
      rawTeamTonnage: number;
      pemuatShareTonnage: number;
      trips: DailyRecord[];
    }>();

    pemuatFilteredRecords.forEach((r) => {
      if (!r.date.startsWith(curYearMonth)) return;
      const share = getRecordPemuatShare(r, selectedPemuat);
      const count = share.pemuatCount;
      const partners = share.partners;

      // Urutkan nama rekan agar DELFIN/OBI dan OBI/DELFIN masuk ke grup teman yang sama
      const sortedPartners = [...partners].sort((a, b) => a.localeCompare(b, 'id'));
      const groupKey = count === 1 ? 'SOLO' : `TEAM_${count}_${sortedPartners.join('_')}`;
      const teamLabel = count === 1 ? targetUpper : [targetUpper, ...sortedPartners].join('/');
      const partnerLabel =
        count === 1
          ? `Muat Sendiri (Utuh 1 Orang)`
          : `Bersama ${sortedPartners.join(' & ')} (Bagi ${count} Orang)`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          teamLabel,
          partnerLabel,
          pemuatCount: count,
          ritCount: 0,
          rawTeamTonnage: 0,
          pemuatShareTonnage: 0,
          trips: [],
        });
      }
      const grp = groupMap.get(groupKey)!;
      grp.ritCount += 1;
      grp.rawTeamTonnage += share.rawTonnage;
      grp.pemuatShareTonnage += share.shareTonnage;
      grp.trips.push(r);
    });

    return Array.from(groupMap.values()).sort((a, b) => b.pemuatShareTonnage - a.pemuatShareTonnage);
  }, [pemuatFilteredRecords, selectedPemuat, calendarYear, calendarMonth]);

  // Rekap tonase bersih seluruh individu pemuat pada bulan aktif (ketika melihat "Semua Pemuat")
  const monthAllIndividualsBreakdown = useMemo(() => {
    const curYearMonth = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const monthRecords = records.filter((r) => String(r.date || '').startsWith(curYearMonth));
    return computeIndividualPemuatBreakdown(monthRecords);
  }, [records, calendarYear, calendarMonth]);

  // Metrik ringkasan bulan yang sedang dibuka di kalender
  // Jika pemuat dipilih, monthTon adalah hasil penjumlahan bagian bersih dari setiap grup teman (Langkah 1 -> Langkah 2)
  const monthMetrics = useMemo(() => {
    const curYearMonth = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    let monthTon = 0;
    let rawMonthTon = 0;
    let monthRit = 0;
    const activeDays = new Set<string>();

    pemuatFilteredRecords.forEach((r) => {
      if (r.date.startsWith(curYearMonth)) {
        const share = getRecordPemuatShare(r, selectedPemuat);
        monthTon += share.shareTonnage;
        rawMonthTon += share.rawTonnage;
        monthRit += 1;
        activeDays.add(r.date);
      }
    });

    return {
      monthTon,
      rawMonthTon,
      monthRit,
      activeDaysCount: activeDays.size,
      avgTonPerRit: monthRit > 0 ? monthTon / monthRit : 0,
    };
  }, [pemuatFilteredRecords, calendarYear, calendarMonth, selectedPemuat]);

  // Grid sel kalender bulanan (Senin s/d Minggu)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
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
        rawTotalTonnage: number;
        tripCount: number;
        pemuatList: string[];
        truckList: string[];
        afdelingList: string[];
      };
    }> = [];

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
    const wib = getWIBDateParts();
    setTodayStr(wib.dateStr);
    setCalendarYear(wib.year);
    setCalendarMonth(wib.monthIndex);
    setSelectedDateForDetail(wib.dateStr);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const targetList = viewMode === 'calendar' ? pemuatFilteredRecords : tableFilteredRecords;
    if (targetList.length === 0) {
      showToast('Belum ada data untuk diekspor.', 'info');
      return;
    }

    const rows = targetList.map((r, index) => {
      const share = getRecordPemuatShare(r, selectedPemuat);
      return {
        No: index + 1,
        Tanggal: r.date,
        Afdeling: r.afdeling,
        'Urutan Rit': `Rit ${r.ritNumber || 1}`,
        'Unit Truk': r.truckNumber,
        'Tim Pemuat': r.driverName,
        'Jumlah Pemuat (Orang)': share.pemuatCount,
        'Tonase Truk Utuh (Ton)': Number(share.rawTonnage.toFixed(2)),
        ...(selectedPemuat
          ? { [`Bagian ${selectedPemuat.toUpperCase()} (Ton)`]: Number(share.shareTonnage.toFixed(2)) }
          : {}),
        'Catatan / Keterangan': r.notes || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Muat TBS');
    const suffix = selectedPemuat ? `_${selectedPemuat.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    XLSX.writeFile(workbook, `Hasil_Pemuat_TBS${suffix}_${todayStr}.xlsx`);
    showToast('File Excel berhasil diunduh.', 'success');
  };

  const currentPortalUrl = getPemuatPortalUrl(selectedPemuat || undefined);
  const waShareUrl = getWhatsAppSharePemuatUrl({
    pemuatName: selectedPemuat || undefined,
    directUrl: currentPortalUrl,
  });

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

      {/* TOP NAVIGATION BAR (TERISOLASI & TERKUNCI UNTUK PEMUAT) */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Branding */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40 overflow-hidden shrink-0">
                <img
                  src="/assets/aistudio/images_70037338.jpeg"
                  alt="Logo Traksi KPU"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm sm:text-lg tracking-tight text-white truncate">
                    Portal Hasil Pemuat TBS
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 shrink-0">
                    Traksi KPU
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                  Kalimantan Plantation Unit &bull; Rekap Hasil Ritase &amp; Tonase Muat TBS
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Salin Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                title="Salin link portal hasil pemuat ini"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Tersalin' : 'Salin Link'}</span>
              </button>

              {/* Bagikan WA */}
              <a
                href={waShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                title="Kirim link hasil muat via WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Bagikan WA</span>
              </a>

              {/* Tombol Beralih ke Beranda Admin (Terkunci PIN Admin) */}
              {onExitToAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError('');
                    setShowPinModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                  title="Buka Beranda Admin (Perlu PIN Admin)"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-5 space-y-5">
        {/* Banner Informasi Mode Hanya Lihat & Pilih Nama Pemuat */}
        <div className="bg-slate-900/95 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 mt-0.5">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black text-white">
                    {selectedPemuat
                      ? `Hasil Tonase Khusus: ${selectedPemuat.toUpperCase()}`
                      : 'Rekap Hasil Muat Seluruh Pemuat TBS'}
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold uppercase flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Data Terkunci (Hanya Lihat)</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedPemuat
                    ? `Tonase dihitung khusus bagian ${selectedPemuat.toUpperCase()} (otomatis dibagi 2 jika berdua, dibagi 3 jika bertiga, dst. lalu dijumlahkan).`
                    : 'Pilih nama pemuat di bawah ini untuk melihat perhitungan bagi hasil tonase khusus per individu.'}
                </p>
              </div>
            </div>

            <div className="text-xs font-mono text-emerald-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-center shrink-0">
              Hari Ini: <strong className="text-white">{formatDateIndoFull(todayStr)}</strong>
            </div>
          </div>

          {/* Pilihan Cepat Nama Pemuat */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pilih Nama Pemuat untuk Melihat Hasil Bagian Individu:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectPemuat('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  selectedPemuat === ''
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                Semua Pemuat
              </button>
              {allPemuatNames.map((name) => {
                const isActive = selectedPemuat.toUpperCase() === name.toUpperCase();
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectPemuat(isActive ? '' : name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-emerald-500/40 hover:text-white'
                    }`}
                  >
                    {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Warning jika terjadi kendala koneksi Firestore */}
        {firestoreError && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>Kendala koneksi database: {firestoreError}</span>
          </div>
        )}

        {/* 3 KARTU RINGKASAN HASIL MUAT (MENAMPILKAN BAGIAN BERSIH KHUSUS PEMUAT JIKA DIPILIH) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. Hasil Hari Ini */}
          <div
            onClick={() => setSelectedDateForDetail(todayStr)}
            className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-lg cursor-pointer hover:border-emerald-400 transition"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                {selectedPemuat ? `Hasil ${selectedPemuat.toUpperCase()} Hari Ini` : 'Hasil Muat Hari Ini'}
              </span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {todayStats.tonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400">Ton</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <span>
                {selectedPemuat && todayStats.rawTonnage !== todayStats.tonnage
                  ? `Total Truk: ${todayStats.rawTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T`
                  : 'Jumlah Pengiriman:'}
              </span>
              <strong className="text-emerald-300 font-mono">{todayStats.ritCount} Rit</strong>
            </div>
          </div>

          {/* 2. Total Tonase Bulan Ini */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                {selectedPemuat
                  ? `Total Bagian ${selectedPemuat.toUpperCase()} (${INDO_MONTHS[calendarMonth]})`
                  : `Total Tonase (${INDO_MONTHS[calendarMonth]})`}
              </span>
              <Scale className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {monthMetrics.monthTon.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs sm:text-sm font-bold text-sky-400">Ton</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <span>
                {selectedPemuat && monthMetrics.rawMonthTon !== monthMetrics.monthTon
                  ? `Dari Total Truk: ${monthMetrics.rawMonthTon.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T`
                  : 'Hari Kerja Aktif:'}
              </span>
              <strong className="text-white font-mono">{monthMetrics.activeDaysCount} Hari</strong>
            </div>
          </div>

          {/* 3. Total Ritase Bulan Ini */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Total Ritase ({INDO_MONTHS[calendarMonth]})
              </span>
              <Truck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {monthMetrics.monthRit}
              </span>
              <span className="text-xs sm:text-sm font-bold text-amber-400">Rit</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <span>{selectedPemuat ? `Rerata Bagian/Rit:` : `Rata-rata per Rit:`}</span>
              <strong className="text-white font-mono">
                {monthMetrics.avgTonPerRit.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T/Rit
              </strong>
            </div>
          </div>
        </div>

        {/* RINCIAN PEMBAGIAN TONASE PER TEMAN / TIM (KHUSUS PEMUAT TERPILIH) */}
        {selectedPemuat && monthPartnerBreakdown.length > 0 && (
          <div className="bg-slate-900/95 border border-emerald-500/35 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wide">
                    Rincian Bagi Hasil Tonase {selectedPemuat.toUpperCase()} per Teman ({INDO_MONTHS[calendarMonth]} {calendarYear})
                  </h2>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tonase dibagikan terlebih dahulu sesuai jumlah teman satu truk (bagi 2, bagi 3, dst.), kemudian dijumlahkan khusus untuk <strong className="text-emerald-300">{selectedPemuat.toUpperCase()}</strong>.
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-mono shrink-0 self-start sm:self-center">
                <span className="text-slate-300">Total Khusus {selectedPemuat.toUpperCase()}: </span>
                <strong className="text-emerald-300 font-black text-sm">
                  {monthMetrics.monthTon.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ton
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {monthPartnerBreakdown.map((grp) => (
                <div
                  key={grp.key}
                  className="bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-3 space-y-2 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono font-black text-xs sm:text-sm text-white block truncate">
                        {grp.teamLabel}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {grp.partnerLabel} &bull; <strong className="text-slate-200">{grp.ritCount} Rit</strong>
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
                      Bagi {grp.pemuatCount}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      Total Tim:{' '}
                      <strong className="text-slate-200">
                        {grp.rawTeamTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T
                      </strong>{' '}
                      &divide; {grp.pemuatCount}
                    </span>
                    <span className="text-emerald-400 font-black text-xs sm:text-sm bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                      = {grp.pemuatShareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ton
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Baris Total Penjumlahan Bagian Individu */}
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="text-slate-300">
                <span className="font-bold text-emerald-300 uppercase">Total Bagian {selectedPemuat.toUpperCase()}: </span>
                <span>
                  {monthPartnerBreakdown
                    .map((g) => g.pemuatShareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                    .join(' + ')}
                </span>
              </div>
              <div className="text-sm sm:text-base font-black text-emerald-400 shrink-0">
                = {monthMetrics.monthTon.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ton
              </div>
            </div>
          </div>
        )}

        {/* REKAP TONASE BERSIH PER INDIVIDU PEMUAT (TAMPIL SAAT "SEMUA PEMUAT" AKTIF) */}
        {!selectedPemuat && monthAllIndividualsBreakdown.length > 0 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>Rekap Tonase Bersih per Individu Pemuat ({INDO_MONTHS[calendarMonth]} {calendarYear})</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tonase setiap pemuat sudah otomatis dibagi sesuai jumlah teman se-truk. Ketuk nama untuk melihat rincian per teman.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {monthAllIndividualsBreakdown.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleSelectPemuat(item.name)}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-2.5 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-white group-hover:text-emerald-300 truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.ritCount} Rit</span>
                  </div>
                  <div className="mt-1 font-mono font-black text-sm text-emerald-400">
                    {item.shareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    <span className="text-[10px] font-normal text-emerald-400/80">Ton</span>
                  </div>
                  {item.rawTonnage !== item.shareTonnage && (
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                      Total truk: {item.rawTonnage.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} T
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* REKAP URUTAN RITASE PER AFDELING HARI INI (Jika Ada Muatan Hari Ini) */}
        {todayStats.trips.length > 0 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Urutan Ritase per Afdeling Hari Ini ({formatDateIndoFull(todayStr)})</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Total Hari Ini: {todayStats.ritCount} Rit ({todayStats.tonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ton)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(() => {
                const afdMap = new Map<string, DailyRecord[]>();
                todayStats.trips.forEach((t) => {
                  const afd = t.afdeling || 'Afdeling 1';
                  if (!afdMap.has(afd)) afdMap.set(afd, []);
                  afdMap.get(afd)!.push(t);
                });
                return Array.from(afdMap.entries())
                  .sort(([a], [b]) => a.localeCompare(b, 'id', { numeric: true }))
                  .map(([afdName, tList]) => {
                    const totalTons = tList.reduce(
                      (s, x) => s + getRecordPemuatShare(x, selectedPemuat).shareTonnage,
                      0
                    );
                    const sortedList = [...tList].sort((a, b) => (a.ritNumber || 0) - (b.ritNumber || 0));
                    return (
                      <div key={afdName} className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2 font-bold text-white pb-1.5 border-b border-slate-800/80">
                          <span>{afdName}</span>
                          <span className="text-emerald-400 font-mono text-[11px]">
                            {tList.length} Rit ({totalTons.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}T)
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {sortedList.map((t, idx) => {
                            const share = getRecordPemuatShare(t, selectedPemuat);
                            return (
                              <div
                                key={t.id}
                                className="text-[11px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-800/90 font-mono flex items-center justify-between gap-1.5"
                              >
                                <span className="truncate">
                                  <strong className="text-sky-400">Rit {t.ritNumber || idx + 1}:</strong>{' '}
                                  <span className="text-white font-bold">{t.truckNumber}</span> &bull;{' '}
                                  <span className="text-emerald-300 font-semibold">{t.driverName}</span>
                                </span>
                                <span className="text-emerald-400 font-bold shrink-0">
                                  {share.shareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}T
                                  {selectedPemuat && share.isShared && (
                                    <span className="text-[9px] text-slate-400 ml-0.5">
                                      ({share.rawTonnage}÷{share.pemuatCount})
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </div>
        )}

        {/* KALENDER BULANAN & DAFTAR RIWAYAT HASIL MUAT */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'calendar'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Kalender Hasil</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Daftar Riwayat</span>
                </button>
              </div>
              <span className="text-xs text-slate-400">
                {viewMode === 'calendar'
                  ? 'Ketuk tanggal pada kalender untuk melihat rincian muatan'
                  : `Menampilkan ${tableFilteredRecords.length} catatan pengiriman`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unduh Excel</span>
              </button>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <div className="space-y-4">
              {/* Navigasi Bulan */}
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

                  <div className="px-3 py-1 text-center min-w-[150px]">
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
                    className="ml-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition cursor-pointer"
                  >
                    Hari Ini
                  </button>
                </div>

                {/* Ringkasan Bulan */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">
                      {selectedPemuat ? `Bagian ${selectedPemuat.toUpperCase()}: ` : 'Total Muat: '}
                    </span>
                    <strong className="text-emerald-400 font-mono">
                      {monthMetrics.monthTon.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ton
                    </strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Ritase: </span>
                    <strong className="text-white font-mono">{monthMetrics.monthRit} Rit</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Hari Aktif: </span>
                    <strong className="text-white font-mono">{monthMetrics.activeDaysCount} Hari</strong>
                  </div>
                </div>
              </div>

              {/* Header Nama Hari */}
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

              {/* Grid Tanggal Kalender */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarCells.map((cell) => {
                  const hasData = cell.stat && cell.stat.tripCount > 0;
                  const stats = cell.stat;

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => setSelectedDateForDetail(cell.dateStr)}
                      className={`relative min-h-[88px] sm:min-h-[115px] p-1.5 sm:p-2 rounded-xl border transition-all duration-150 flex flex-col justify-between cursor-pointer select-none ${
                        cell.isCurrentMonth
                          ? hasData
                            ? 'bg-slate-950/90 border-emerald-500/40 hover:border-emerald-400 hover:bg-slate-900/90 shadow-sm'
                            : 'bg-slate-950/50 border-slate-800/60 hover:border-slate-700'
                          : 'bg-slate-950/20 border-slate-900/40 opacity-40 hover:opacity-75'
                      } ${
                        cell.isToday
                          ? 'ring-2 ring-emerald-400 border-emerald-500 bg-emerald-950/20'
                          : ''
                      }`}
                    >
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
                        {hasData && !cell.isToday && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>

                      {hasData && stats ? (
                        <div className="my-1 space-y-1">
                          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-1 py-0.5 text-center">
                            <span className="text-[11px] sm:text-xs font-black text-emerald-400 font-mono block leading-tight">
                              {stats.totalTonnage.toLocaleString('id-ID', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 2,
                              })}
                              <span className="text-[9px] font-semibold text-emerald-400/80 ml-0.5">T</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-300 font-mono">
                            <span className="font-bold text-white">{stats.tripCount}</span>
                            <span className="text-slate-400">Rit</span>
                          </div>
                        </div>
                      ) : (
                        <div className="my-auto py-2 text-center">
                          <span className="text-[10px] text-slate-700 font-mono">-</span>
                        </div>
                      )}

                      {hasData && stats ? (
                        <div className="pt-0.5 flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-900/60">
                          <span className="truncate font-medium text-slate-300">
                            {stats.truckList.slice(0, 2).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <div className="h-3" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* TAMPILAN DAFTAR RIWAYAT (READ-ONLY) */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="relative sm:col-span-5">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nomor truk DT, pemuat, afdeling..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={filterTruck}
                    onChange={(e) => setFilterTruck(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">Semua Unit Truk</option>
                    {dynamicTruckCodes.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4 flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
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

              {tableFilteredRecords.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800/80">
                  <Truck className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="font-semibold text-slate-400">Belum ada catatan muatan pada periode ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tableFilteredRecords.map((r, idx) => {
                    const share = getRecordPemuatShare(r, selectedPemuat);
                    return (
                      <div
                        key={r.id}
                        className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-slate-500 text-xs font-mono w-5">{idx + 1}.</span>
                          <span className="font-mono text-xs text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {r.date}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            Rit {r.ritNumber || 1}
                          </span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/25">
                            {r.truckNumber}
                          </span>
                          <span className="text-xs font-bold text-white">{r.driverName}</span>
                          {share.isShared && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/30">
                              Bagi {share.pemuatCount} Orang
                            </span>
                          )}
                          <span className="text-xs text-slate-400">&bull; {r.afdeling}</span>
                          {r.notes && (
                            <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded">
                              ({r.notes})
                            </span>
                          )}
                        </div>

                        <div className="text-right sm:shrink-0 border-t sm:border-t-0 border-slate-900 pt-1.5 sm:pt-0">
                          <span className="text-base font-black text-emerald-400 font-mono block">
                            {share.shareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                            <span className="text-xs font-semibold text-emerald-400/80">Ton</span>
                          </span>
                          {selectedPemuat && share.isShared && (
                            <span className="text-[10px] font-mono text-slate-400 block">
                              Total Truk: {share.rawTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T &divide; {share.pemuatCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL DETAIL PER TANGGAL (READ-ONLY — TANPA EDIT / HAPUS) */}
      {selectedDateForDetail && (() => {
        const dayStat = dailyStatsMap.get(selectedDateForDetail);
        const dayTrips = dayStat ? dayStat.trips : [];
        const dayTotalTonnage = dayStat ? dayStat.totalTonnage : 0;
        const dayRawTotalTonnage = dayStat ? dayStat.rawTotalTonnage : 0;
        const dayTruckList = dayStat ? dayStat.truckList : [];
        const dayIndividualSummaries = computeIndividualPemuatBreakdown(dayTrips);

        const filteredDayTrips = dayTrips.filter((t) => {
          if (!modalSearchQuery.trim()) return true;
          const q = modalSearchQuery.toLowerCase();
          return (
            String(t.driverName || '').toLowerCase().includes(q) ||
            String(t.truckNumber || '').toLowerCase().includes(q) ||
            String(t.afdeling || '').toLowerCase().includes(q) ||
            String(t.notes || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      Rincian Muat: {formatDateIndoFull(selectedDateForDetail)}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {selectedDateForDetail} &bull; {dayTrips.length} Ritase Tercatat
                      {selectedPemuat ? ` (Khusus Bagian ${selectedPemuat.toUpperCase()})` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateForDetail(null);
                    setModalSearchQuery('');
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                {/* Summary Mini Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block">
                      {selectedPemuat ? `Bagian ${selectedPemuat.toUpperCase()}` : 'Total Tonase'}
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                      {dayTotalTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-[10px] font-normal text-slate-400">Ton</span>
                    </span>
                    {selectedPemuat && dayRawTotalTonnage !== dayTotalTonnage && (
                      <span className="text-[9px] text-slate-500 font-mono block">
                        Truk: {dayRawTotalTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T
                      </span>
                    )}
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block">Total Ritase</span>
                    <span className="text-base sm:text-lg font-black text-white font-mono">
                      {dayTrips.length} <span className="text-[10px] font-normal text-slate-400">Rit</span>
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block">Individu Pemuat</span>
                    <span className="text-base sm:text-lg font-black text-white font-mono">
                      {dayIndividualSummaries.length} <span className="text-[10px] font-normal text-slate-400">Orang</span>
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block">Unit Truk</span>
                    <span className="text-base sm:text-lg font-black text-white font-mono">
                      {dayTruckList.length} <span className="text-[10px] font-normal text-slate-400">Unit</span>
                    </span>
                  </div>
                </div>

                {/* Daftar Bagi Hasil per Individu Pemuat Bertugas */}
                {dayIndividualSummaries.length > 0 && (
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Bagi Hasil per Individu Pemuat ({dayIndividualSummaries.length} Orang):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dayIndividualSummaries.map((item) => {
                        const isTarget = selectedPemuat && item.name.toUpperCase() === selectedPemuat.toUpperCase();
                        return (
                          <div
                            key={item.name}
                            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${
                              isTarget
                                ? 'bg-emerald-950/70 border-emerald-500/60 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-200'
                            }`}
                          >
                            <span className="font-bold text-white">{item.name}</span>
                            <span className="text-emerald-400 font-mono text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {item.shareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T ({item.ritCount} Rit)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rekap Urutan Ritase per Afdeling pada Tanggal Ini */}
                {(() => {
                  const afdMap = new Map<string, DailyRecord[]>();
                  dayTrips.forEach((t) => {
                    const afd = t.afdeling || 'Afdeling 1';
                    if (!afdMap.has(afd)) afdMap.set(afd, []);
                    afdMap.get(afd)!.push(t);
                  });
                  if (afdMap.size === 0) return null;
                  return (
                    <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Urutan Ritase per Afdeling:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {Array.from(afdMap.entries())
                          .sort(([a], [b]) => a.localeCompare(b, 'id', { numeric: true }))
                          .map(([afdName, tList]) => {
                            const totalTons = tList.reduce(
                              (s, x) => s + getRecordPemuatShare(x, selectedPemuat).shareTonnage,
                              0
                            );
                            const sortedList = [...tList].sort((a, b) => (a.ritNumber || 0) - (b.ritNumber || 0));
                            return (
                              <div key={afdName} className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1.5">
                                <div className="flex items-center justify-between gap-2 font-bold text-slate-200">
                                  <span>{afdName}</span>
                                  <span className="text-emerald-400 font-mono text-[11px]">
                                    {tList.length} Rit ({totalTons.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}T)
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {sortedList.map((t, idx) => {
                                    const share = getRecordPemuatShare(t, selectedPemuat);
                                    return (
                                      <span key={t.id} className="text-[10px] px-2 py-1 rounded bg-slate-950 border border-slate-800 text-sky-300 font-mono flex items-center justify-between gap-1.5">
                                        <span>
                                          <strong className="text-sky-400">Rit {t.ritNumber || idx + 1}:</strong> {t.truckNumber} &bull; <span className="text-emerald-300 font-semibold">{t.driverName}</span>
                                        </span>
                                        <span className="text-white font-bold shrink-0">
                                          {share.shareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}T
                                          {selectedPemuat && share.isShared && (
                                            <span className="text-[9px] text-slate-400 ml-0.5">
                                              ({share.rawTonnage}÷{share.pemuatCount})
                                            </span>
                                          )}
                                        </span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })()}

                {/* Rincian Ritase & Muatan (Hanya Lihat) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Rincian Ritase &amp; Muatan ({filteredDayTrips.length})</span>
                    </h4>
                  </div>

                  {dayTrips.length > 0 && (
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={modalSearchQuery}
                        onChange={(e) => setModalSearchQuery(e.target.value)}
                        placeholder="Cari nama pemuat, nomor unit truk, atau afdeling..."
                        className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none transition"
                      />
                    </div>
                  )}

                  {filteredDayTrips.length === 0 ? (
                    <div className="text-center py-6 bg-slate-950/50 rounded-xl border border-slate-800/80 text-slate-400 text-xs">
                      Tidak ada pengiriman tercatat pada tanggal ini.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredDayTrips.map((trip, idx) => {
                        const share = getRecordPemuatShare(trip, selectedPemuat);
                        return (
                          <div
                            key={trip.id}
                            className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-slate-500 text-xs font-mono w-4">{idx + 1}.</span>
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/25">
                                {trip.truckNumber}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                Rit {trip.ritNumber || 1}
                              </span>
                              <span className="font-bold text-xs text-white">{trip.driverName}</span>
                              {share.isShared && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/30">
                                  Bagi {share.pemuatCount}
                                </span>
                              )}
                              <span className="text-xs text-slate-400">&bull; {trip.afdeling}</span>
                              {trip.notes && (
                                <span className="text-[11px] text-slate-400 font-mono">({trip.notes})</span>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-sm font-black text-emerald-400 font-mono block">
                                {share.shareTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                                <span className="text-[10px] font-semibold text-emerald-400/80">Ton</span>
                              </span>
                              {selectedPemuat && share.isShared && (
                                <span className="text-[10px] font-mono text-slate-400 block">
                                  ({share.rawTonnage.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T &divide; {share.pemuatCount})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateForDetail(null);
                    setModalSearchQuery('');
                  }}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL VERIFIKASI PIN ADMIN UNTUK KELUAR DARI PORTAL PEMUAT */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Verifikasi Admin Traksi KPU</h3>
                <p className="text-xs text-slate-400">Masukkan PIN Admin untuk membuka Beranda Utama.</p>
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
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-md cursor-pointer"
                >
                  Buka Beranda Utama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-900 py-5 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>Portal Hasil Pemuat TBS &bull; Traksi KPU (Kalimantan Plantation Unit)</p>
          {onExitToAdmin && (
            <button
              type="button"
              onClick={() => {
                setPinInput('');
                setPinError('');
                setShowPinModal(true);
              }}
              className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Masuk sebagai Admin Pengelola</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
