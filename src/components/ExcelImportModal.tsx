import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download,
  Info,
  Layers,
  Wrench,
  Fuel,
  Droplets,
  UserCheck,
  Package,
  Calculator,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  UserX,
  PlusCircle,
  Truck,
  Disc,
  Wheat,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { TruckUnit, ExpenseCategory, ExpenseRecord } from '../types/truck';
import { formatRupiah, formatNumber, getTodayWIB, getWIBDateParts } from '../utils/formatters';
import { CATEGORIES, CATEGORY_COLORS } from '../data/initialData';
import {
  parsePastedExcelText,
  parseFreeformNotes,
  parseExcelFile,
  calculateUnitBreakdowns,
  ParsedExpenseItem,
  UnitCostBreakdown,
} from '../utils/excelParser';
import * as XLSX from 'xlsx';

const MONTH_NAMES_ID = [
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

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trucks: TruckUnit[];
  onImportExpenses: (items: Omit<ExpenseRecord, 'id' | 'createdAt'>[]) => Promise<void>;
  onAddTruck?: (truck: Omit<TruckUnit, 'id'>) => Promise<TruckUnit>;
  defaultTruckId?: string;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  trucks,
  onImportExpenses,
  onAddTruck,
  defaultTruckId,
}) => {
  const [activeTab, setActiveTab] = useState<'freeform' | 'table' | 'upload'>('freeform');
  const [inputText, setInputText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Unit Default state & toggle switch (Aktif / Non-Aktif)
  const [useDefaultTruck, setUseDefaultTruck] = useState<boolean>(false);
  const [selectedDefaultTruckId, setSelectedDefaultTruckId] = useState<string>(
    defaultTruckId || trucks[0]?.id || ''
  );
  // Kondisi Filter Kode Ketat: Hanya (DT 90 atau DT90), selain itu tidak masuk
  const [autoHideNonDt, setAutoHideNonDt] = useState<boolean>(true);
  const [rejectedNonDtCount, setRejectedNonDtCount] = useState<number>(0);

  // Fitur Pilih Bulan & Tanggal Pencatatan Biaya (agar bisa menaruh biaya ke bulan sebelumnya)
  const [targetYear, setTargetYear] = useState<number>(() => getWIBDateParts().year);
  const [targetMonth, setTargetMonth] = useState<number>(() => getWIBDateParts().monthIndex);
  const [targetDate, setTargetDate] = useState<string>(() => getTodayWIB());

  // Parsed items & breakdown state
  const [parsedItems, setParsedItems] = useState<ParsedExpenseItem[]>([]);
  const [manualItems, setManualItems] = useState<ParsedExpenseItem[]>([]);
  const [detectedUnits, setDetectedUnits] = useState<string[]>([]);
  const [unmatchedUnits, setUnmatchedUnits] = useState<string[]>([]);
  const [activeResultTab, setActiveResultTab] = useState<'valid' | 'manual'>('valid');
  const [manualFilter, setManualFilter] = useState<'all' | 'mismatch' | 'nocode'>('all');
  const [bulkManualTruckId, setBulkManualTruckId] = useState<string>(
    defaultTruckId || trucks[0]?.id || ''
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const wibCurrent = getWIBDateParts();
  const prevMonthIndex = wibCurrent.monthIndex === 0 ? 11 : wibCurrent.monthIndex - 1;
  const prevMonthYear = wibCurrent.monthIndex === 0 ? wibCurrent.year - 1 : wibCurrent.year;
  const twoMonthsAgoIndex = (wibCurrent.monthIndex + 10) % 12;
  const twoMonthsAgoYear = wibCurrent.monthIndex < 2 ? wibCurrent.year - 1 : wibCurrent.year;

  // Helper untuk mengubah bulan & tahun serta langsung menerapkan tanggal ke hasil pemilahan yang sudah ada
  const handleSelectMonthYear = (newMonthIndex: number, newYear: number) => {
    let normalizedMonth = newMonthIndex;
    let normalizedYear = newYear;
    if (normalizedMonth < 0) {
      normalizedMonth = 11;
      normalizedYear -= 1;
    } else if (normalizedMonth > 11) {
      normalizedMonth = 0;
      normalizedYear += 1;
    }

    const daysInTargetMonth = new Date(normalizedYear, normalizedMonth + 1, 0).getDate();
    const isSelectingCurrentMonth =
      normalizedYear === wibCurrent.year && normalizedMonth === wibCurrent.monthIndex;

    // Jika memilih bulan ini gunakan tanggal hari ini WIB; jika memilih bulan sebelumnya gunakan akhir bulan / tanggal valid di bulan tersebut
    const currentDayPart = parseInt(targetDate.split('-')[2] || '1', 10) || wibCurrent.day;
    const chosenDay = isSelectingCurrentMonth
      ? wibCurrent.day
      : Math.min(currentDayPart, daysInTargetMonth);

    const newDateStr = `${normalizedYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(
      chosenDay
    ).padStart(2, '0')}`;

    setTargetMonth(normalizedMonth);
    setTargetYear(normalizedYear);
    setTargetDate(newDateStr);

    if (parsedItems.length > 0) {
      setParsedItems((prev) => prev.map((item) => ({ ...item, date: newDateStr })));
    }
    if (manualItems.length > 0) {
      setManualItems((prev) => prev.map((item) => ({ ...item, date: newDateStr })));
    }
  };

  const handleSelectExactDate = (newDateStr: string) => {
    if (!newDateStr) return;
    setTargetDate(newDateStr);
    const parts = newDateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
        setTargetYear(y);
        setTargetMonth(m);
      }
    }
    if (parsedItems.length > 0) {
      setParsedItems((prev) => prev.map((item) => ({ ...item, date: newDateStr })));
    }
    if (manualItems.length > 0) {
      setManualItems((prev) => prev.map((item) => ({ ...item, date: newDateStr })));
    }
  };

  const runTextParse = (
    textToParse: string,
    overrideUseDefault?: boolean,
    overrideDefaultId?: string,
    overrideHideNonDt?: boolean,
    overrideDefaultDate?: string
  ) => {
    setErrorMessage(null);
    setSuccessCount(null);
    if (!textToParse.trim()) {
      setErrorMessage('Silakan tempel (paste) catatan atau tulisan biaya terlebih dahulu.');
      return;
    }

    const effectiveUseDefault =
      overrideUseDefault !== undefined ? overrideUseDefault : useDefaultTruck;
    const effectiveDefaultId =
      overrideDefaultId !== undefined
        ? overrideDefaultId
        : selectedDefaultTruckId || trucks[0]?.id || '';
    const effectiveHideNonDt =
      overrideHideNonDt !== undefined ? overrideHideNonDt : autoHideNonDt;
    const effectiveDate = overrideDefaultDate || targetDate || getTodayWIB();

    try {
      setIsProcessing(true);
      const parseOptions = {
        useDefaultTruck: effectiveUseDefault,
        defaultTruckId: effectiveDefaultId,
        defaultDate: effectiveDate,
      };

      if (textToParse.includes('\t') || (textToParse.includes(';') && !textToParse.includes(','))) {
        const { items, manualItems: mItems } = parsePastedExcelText(textToParse, trucks, parseOptions);
        const nonDtRejected = mItems.filter((m) => !m.unrecognizedUnitCode);
        const filteredManual = effectiveHideNonDt
          ? mItems.filter((m) => Boolean(m.unrecognizedUnitCode))
          : mItems;

        setRejectedNonDtCount(nonDtRejected.length);

        if (items.length === 0 && mItems.length === 0) {
          setErrorMessage('Tidak ada baris data biaya yang dapat dideteksi dari teks tabel yang ditempel.');
          setParsedItems([]);
          setManualItems([]);
          return;
        }
        setParsedItems(items);
        setManualItems(filteredManual);
        setDetectedUnits(Array.from(new Set(items.map((i) => i.truckCode))));
        setUnmatchedUnits(
          Array.from(
            new Set(mItems.map((m) => m.unrecognizedUnitCode).filter(Boolean) as string[])
          )
        );
        if (items.length === 0 && filteredManual.length > 0) {
          setActiveResultTab('manual');
        } else {
          setActiveResultTab('valid');
        }
      } else {
        const result = parseFreeformNotes(textToParse, trucks, parseOptions);
        const nonDtRejected = result.manualItems.filter((m) => !m.unrecognizedUnitCode);
        const filteredManual = effectiveHideNonDt
          ? result.manualItems.filter((m) => Boolean(m.unrecognizedUnitCode))
          : result.manualItems;

        setRejectedNonDtCount(nonDtRejected.length);

        if (result.items.length === 0 && result.manualItems.length === 0) {
          setErrorMessage(
            'Tidak ada data biaya yang terdeteksi. Pastikan mencantumkan kode (DT 90 atau DT90) serta nominal biaya.'
          );
          setParsedItems([]);
          setManualItems([]);
          return;
        }
        setParsedItems(result.items);
        setManualItems(filteredManual);
        setDetectedUnits(result.detectedUnits);
        setUnmatchedUnits(result.unmatchedUnits);
        if (result.items.length === 0 && filteredManual.length > 0) {
          setActiveResultTab('manual');
        } else {
          setActiveResultTab('valid');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memilah data yang ditempel.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle parse from text (supports freeform text and excel tables)
  const handleParseText = () => {
    runTextParse(inputText);
  };



  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setErrorMessage(null);
    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const { items, manualItems: mItems } = await parseExcelFile(file, trucks, {
        useDefaultTruck,
        defaultTruckId: selectedDefaultTruckId,
        defaultDate: targetDate || getTodayWIB(),
      });

      if (items.length === 0 && mItems.length === 0) {
        setErrorMessage('File Excel tidak berisi data nominal biaya yang valid.');
        setParsedItems([]);
        setManualItems([]);
        return;
      }

      setParsedItems(items);
      setManualItems(mItems);
      setDetectedUnits(Array.from(new Set(items.map((i) => i.truckCode))));
      setUnmatchedUnits([]);
      if (items.length === 0 && mItems.length > 0) {
        setActiveResultTab('manual');
      } else {
        setActiveResultTab('valid');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses file Excel.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Update field manual untuk baris yang tidak cocok (edit tanggal, nominal, kategori, keterangan)
  const handleUpdateManualField = (
    manualIndex: number,
    field: keyof ParsedExpenseItem,
    value: any
  ) => {
    setManualItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== manualIndex) return item;
        const updated = { ...item, [field]: value };
        if (field === 'amount') {
          const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9]/g, '')) || 0;
          updated.amount = num;
        }
        return updated;
      })
    );
  };

  // Tetapkan satu baris manual ke unit truk tertentu (langsung dipindahkan ke parsedItems)
  const handleAssignManualItem = (manualIndex: number, targetTruckId: string) => {
    const targetTruck = trucks.find((t) => t.id === targetTruckId);
    if (!targetTruck) return;

    const itemToMove = manualItems[manualIndex];
    if (!itemToMove) return;

    const updatedItem: ParsedExpenseItem = {
      ...itemToMove,
      truckId: targetTruck.id,
      truckCode: targetTruck.code,
      isValid: itemToMove.amount > 0,
      needsManualReview: false,
      validationError: undefined,
    };

    setParsedItems((prev) => [...prev, updatedItem]);
    setManualItems((prev) => prev.filter((_, idx) => idx !== manualIndex));
  };

  // Terapkan semua baris di daftar "Perlu Pilah Manual" ke unit yang dipilih
  const handleBulkAssignManual = (targetTruckId: string) => {
    const targetTruck = trucks.find((t) => t.id === targetTruckId);
    if (!targetTruck || manualItems.length === 0) return;

    const convertedItems: ParsedExpenseItem[] = manualItems.map((item) => ({
      ...item,
      truckId: targetTruck.id,
      truckCode: targetTruck.code,
      isValid: item.amount > 0,
      needsManualReview: false,
      validationError: undefined,
    }));

    setParsedItems((prev) => [...prev, ...convertedItems]);
    setManualItems([]);
    setActiveResultTab('valid');
  };

  // Hapus satu baris dari daftar "Perlu Pilah Manual"
  const handleDeleteManualItem = (manualIndex: number) => {
    setManualItems((prev) => prev.filter((_, idx) => idx !== manualIndex));
  };

  // Helper to auto-create an unrecognized unit if user pasted e.g. DT 90, GD 01, EX 46, MB 13
  const handleRegisterNewUnit = async (unitCode: string) => {
    if (!onAddTruck) return;
    try {
      const cleanPrefix = (unitCode.match(/^[a-zA-Z]+/) || ['DT'])[0].toUpperCase();
      const cleanNum = unitCode.replace(/[^0-9]/g, '') || '99';
      const created = await onAddTruck({
        code: unitCode.toUpperCase(),
        plateNumber: `BM ${cleanNum.padEnd(4, '0')} ${cleanPrefix}`,
        driverName: `Operator ${unitCode}`,
        model: `Unit Operasional ${cleanPrefix}`,
        capacity: '8.5 Ton TBS',
        status: 'Aktif',
        year: 2023,
        notes: `Unit dibuat otomatis saat tempel catatan biaya (${unitCode})`,
      });

      // 1. Re-map items that had this unit code in parsedItems (if any)
      setParsedItems((prev) =>
        prev.map((item) => {
          if (item.unrecognizedUnitCode === unitCode || item.truckCode === unitCode) {
            return {
              ...item,
              truckId: created.id,
              truckCode: created.code,
              unrecognizedUnitCode: undefined,
              isValid: item.amount > 0,
              validationError: undefined,
            };
          }
          return item;
        })
      );

      // 2. Otomatis alihkan item yang ada di manualItems dengan kode unit ini ke parsedItems!
      const itemsToPromote = manualItems.filter(
        (m) => m.unrecognizedUnitCode === unitCode || m.truckCode === unitCode
      );
      if (itemsToPromote.length > 0) {
        const promoted: ParsedExpenseItem[] = itemsToPromote.map((item) => ({
          ...item,
          truckId: created.id,
          truckCode: created.code,
          unrecognizedUnitCode: undefined,
          isValid: item.amount > 0,
          needsManualReview: false,
          validationError: undefined,
        }));
        setParsedItems((prev) => [...prev, ...promoted]);
        setManualItems((prev) =>
          prev.filter(
            (m) => m.unrecognizedUnitCode !== unitCode && m.truckCode !== unitCode
          )
        );
      }

      setUnmatchedUnits((prev) => prev.filter((u) => u !== unitCode));
      setDetectedUnits((prev) => [...prev, created.code]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftarkan unit baru');
    }
  };

  // Row edits
  const handleUpdateRowCategory = (index: number, newCat: ExpenseCategory) => {
    setParsedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, category: newCat } : item))
    );
  };

  const handleUpdateRowTruck = (index: number, newTruckId: string) => {
    const t = trucks.find((tr) => tr.id === newTruckId);
    setParsedItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              truckId: newTruckId,
              truckCode: t?.code || 'Unit',
              unrecognizedUnitCode: undefined,
              isValid: item.amount > 0 && Boolean(newTruckId),
              validationError: item.amount <= 0 ? 'Nominal tidak valid' : undefined,
            }
          : item
      )
    );
  };

  const handleUpdateRowAmount = (index: number, newAmountStr: string) => {
    const val = parseFloat(newAmountStr.replace(/[^0-9]/g, '')) || 0;
    setParsedItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              amount: val,
              isValid: val > 0 && Boolean(item.truckId),
              validationError: val <= 0 ? 'Nominal tidak valid' : undefined,
            }
          : item
      )
    );
  };

  const handleUpdateRowDescription = (index: number, newDesc: string) => {
    setParsedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, description: newDesc } : item))
    );
  };

  const handleUpdateRowDate = (index: number, newDateStr: string) => {
    if (!newDateStr) return;
    setParsedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, date: newDateStr } : item))
    );
  };

  const handleDeleteRow = (index: number) => {
    setParsedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAll = () => {
    setInputText('');
    setParsedItems([]);
    setManualItems([]);
    setUnmatchedUnits([]);
    setRejectedNonDtCount(0);
    setErrorMessage(null);
    setSuccessCount(null);
  };

  // Save parsed items to backend
  const handleSaveToDatabase = async () => {
    const validItems = parsedItems.filter((i) => i.isValid && i.amount > 0 && i.truckId);
    if (validItems.length === 0) {
      setErrorMessage('Tidak ada data valid yang dapat disimpan. Pastikan unit telah dipilih dan nominal > 0.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const payload = validItems.map((item) => ({
        date: item.date,
        truckId: item.truckId,
        category: item.category,
        description: item.description,
        amount: item.amount,
        vendor: item.vendor || 'Vendor Mitra TBS',
        invoiceNumber: item.invoiceNumber || undefined,
      }));

      await onImportExpenses(payload);
      setSuccessCount(validItems.length);
      setParsedItems([]);
      setInputText('');

      // Auto close after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan data pengeluaran ke server');
    } finally {
      setIsSaving(false);
    }
  };

  // Unit breakdowns calculation
  const unitBreakdowns = calculateUnitBreakdowns(parsedItems, trucks);
  const grandTotalAmount = parsedItems.reduce((sum, item) => sum + item.amount, 0);
  const validItemsCount = parsedItems.filter((item) => item.isValid).length;

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

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Fuel',
        'Keterangan': 'Pengisian BioSolar 120 Liter',
        'Nominal Biaya': 816000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Lubricant',
        'Keterangan': 'Ganti Oli Mesin Meditran SX4 10 Liter',
        'Nominal Biaya': 580000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Sparepart',
        'Keterangan': 'Beli kampas rem depan Bendix HD',
        'Nominal Biaya': 450000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Tyre & Tubes',
        'Keterangan': 'Ganti ban luar & ban dalam',
        'Nominal Biaya': 1950000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Workshop',
        'Keterangan': 'Jasa pasang kampas rem & las engsel bak',
        'Nominal Biaya': 200000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'BPJS',
        'Keterangan': 'Iuran BPJS Ketenagakerjaan',
        'Nominal Biaya': 175000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Jamsostek',
        'Keterangan': 'Premi Asuransi Jamsostek',
        'Nominal Biaya': 150000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Potongan Mangkir',
        'Keterangan': 'Potongan mangkir 1 hari kerja',
        'Nominal Biaya': 125000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Beras',
        'Keterangan': 'Catu beras bulanan',
        'Nominal Biaya': 250000,
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Supir',
        'Keterangan': 'Upah ritase supir afdeling 2',
        'Nominal Biaya': 450000,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Biaya_TBS');
    XLSX.writeFile(wb, 'Template_Laporan_Biaya_DT.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Tempel Catatan & Pilah Data Otomatis
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Auto-Detect DT & Kategori
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tempel tulisan bebas, catatan WA, atau tabel Excel. Sistem otomatis memilah nomor DT, nominal biaya, dan kategori (Fuel, Lubricant, Sparepart, Tyre & Tubes, Workshop, BPJS, Jamsostek, Potongan Mangkir, Beras, Supir).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Success Banner */}
          {successCount !== null && (
            <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-sm animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong>Berhasil Tersimpan!</strong> {successCount} catatan biaya telah berhasil dimasukkan ke masing-masing unit truk terkait di database.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs sm:text-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Unregistered Units alert if any */}
          {unmatchedUnits.length > 0 && (
            <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Terdeteksi unit baru yang belum ada di database:{' '}
                  <strong>{unmatchedUnits.join(', ')}</strong>
                </span>
              </div>
              {onAddTruck && (
                <div className="flex items-center gap-2">
                  {unmatchedUnits.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => handleRegisterNewUnit(u)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
                    >
                      + Daftarkan {u} ke Database
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('freeform')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeTab === 'freeform'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>1. Tempel Tulisan Bebas / WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeTab === 'upload'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>2. Upload File Excel (.xlsx)</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">

              {inputText && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border border-slate-700 hover:border-rose-500/40 transition cursor-pointer"
                  title="Kosongkan teks yang ditempel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan Teks</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                title="Unduh format template spreadsheet Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Format Template Excel</span>
              </button>
            </div>
          </div>

          {/* FITUR PILIH PERIODE BULAN & TANGGAL BIAYA (BISA MASUK KE BULAN SEBELUMNYA) */}
          <div className="bg-slate-950/90 border border-sky-500/35 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Pilih Bulan &amp; Periode Pencatatan Biaya
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                      Periode Aktif: {MONTH_NAMES_ID[targetMonth]} {targetYear} ({targetDate})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pilih <strong>Bulan Sebelumnya</strong> atau bulan tertentu untuk menaruh biaya yang belum terinput ke bulan lalu.
                  </p>
                </div>
              </div>

              {/* Tombol Cepat: Bulan Ini, Bulan Sebelumnya, 2 Bulan Lalu */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectMonthYear(wibCurrent.monthIndex, wibCurrent.year)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    targetMonth === wibCurrent.monthIndex && targetYear === wibCurrent.year
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800'
                  }`}
                >
                  Bulan Ini ({MONTH_NAMES_ID[wibCurrent.monthIndex]})
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectMonthYear(prevMonthIndex, prevMonthYear)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    targetMonth === prevMonthIndex && targetYear === prevMonthYear
                      ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm shadow-sky-500/20'
                      : 'bg-slate-900 text-sky-300 hover:bg-sky-950/60 border-sky-500/30'
                  }`}
                >
                  &larr; Bulan Sebelumnya ({MONTH_NAMES_ID[prevMonthIndex]} {prevMonthYear})
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectMonthYear(twoMonthsAgoIndex, twoMonthsAgoYear)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    targetMonth === twoMonthsAgoIndex && targetYear === twoMonthsAgoYear
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  {MONTH_NAMES_ID[twoMonthsAgoIndex]} {twoMonthsAgoYear}
                </button>
              </div>
            </div>

            {/* Bar Pilih Bulan, Tahun, dan Tanggal Spesifik */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
              {/* Navigasi & Dropdown Bulan */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectMonthYear(targetMonth - 1, targetYear)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
                  title="Mundur 1 bulan"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={targetMonth}
                  onChange={(e) => handleSelectMonthYear(parseInt(e.target.value, 10), targetYear)}
                  className="flex-1 bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES_ID.map((mName, idx) => (
                    <option key={mName} value={idx}>
                      Bulan: {mName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleSelectMonthYear(targetMonth + 1, targetYear)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
                  title="Maju 1 bulan"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Dropdown Tahun */}
              <div>
                <select
                  value={targetYear}
                  onChange={(e) => handleSelectMonthYear(targetMonth, parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                    <option key={yr} value={yr}>
                      Tahun: {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input Tanggal Pencatatan Spesifik */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 shrink-0">Tgl Catat:</span>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => handleSelectExactDate(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-sky-300 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* FITUR KONDISI FILTER KODE KETAT (DT, EX, MB, GD + NOMOR UNIT) & UNIT DEFAULT */}
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3.5 sm:p-4 space-y-3.5 shadow-md">
            {/* KONDISI 1: ATURAN KODE WAJIB (DT, EX, MB, GD) */}
            <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Kondisi Kode Unit: DT, EX, MB, GD (Cocok Huruf & Nomor)
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      KONDISI AKTIF
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Kode yang terbaca dan masuk biayanya: <strong className="text-emerald-300 font-mono">DT 90 / DT90</strong>, <strong className="text-emerald-300 font-mono">GD 01 / GD01</strong>, <strong className="text-emerald-300 font-mono">EX 46 / EX46</strong>, <strong className="text-emerald-300 font-mono">MB 13 / MB13</strong>. Sistem mencocokkan <strong>huruf depan sekaligus nomornya</strong> (contoh: <code className="text-amber-300 font-mono">MB 90</code> hanya masuk ke <code className="text-amber-300 font-mono">MB 90</code> dan tidak akan dobel ke <code className="text-amber-300 font-mono">DT 90</code>).
                  </p>
                </div>
              </div>

              {/* Toggle Buang Otomatis Kode Selain DT / EX / MB / GD */}
              <div className="flex items-center gap-2.5 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoHideNonDt}
                  onClick={() => {
                    const nextVal = !autoHideNonDt;
                    setAutoHideNonDt(nextVal);
                    if (inputText.trim() && (parsedItems.length > 0 || manualItems.length > 0 || rejectedNonDtCount > 0)) {
                      runTextParse(inputText, useDefaultTruck, selectedDefaultTruckId, nextVal);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoHideNonDt ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                  title="Otomatis buang/abaikan baris yang kodenya bukan DT, EX, MB, atau GD"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                      autoHideNonDt ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-[11px] font-semibold text-slate-200">
                  {autoHideNonDt ? 'Buang Otomatis Selain DT/EX/MB/GD' : 'Tampilkan di Tab Tidak Masuk'}
                </span>
              </div>
            </div>

            {/* KONDISI 2: TOMBOL PENGALIH (TOGGLE SWITCH) DT DEFAULT */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useDefaultTruck}
                  onClick={() => {
                    const nextVal = !useDefaultTruck;
                    setUseDefaultTruck(nextVal);
                    if (inputText.trim() && (parsedItems.length > 0 || manualItems.length > 0 || rejectedNonDtCount > 0)) {
                      runTextParse(inputText, nextVal, selectedDefaultTruckId, autoHideNonDt);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useDefaultTruck ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                  title="Klik untuk mengaktifkan / menonaktifkan Unit Default"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                      useDefaultTruck ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">Pilih Unit Default</span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        useDefaultTruck
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {useDefaultTruck ? 'AKTIF (ON)' : 'NON-AKTIF (OFF)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {useDefaultTruck
                      ? 'Biaya tanpa kode masuk ke Unit Default terpilih (kode selain DT/EX/MB/GD seperti CP05 tetap tidak masuk)'
                      : 'Murni mencocokkan huruf depan (DT, EX, MB, GD) & nomor unit dengan Armada'}
                  </p>
                </div>
              </div>

              {/* Dropdown Pemilihan Unit Default */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-300 shrink-0">Unit Default:</label>
                <select
                  value={selectedDefaultTruckId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedDefaultTruckId(nextId);
                    if (useDefaultTruck && inputText.trim() && (parsedItems.length > 0 || manualItems.length > 0)) {
                      runTextParse(inputText, useDefaultTruck, nextId, autoHideNonDt);
                    }
                  }}
                  disabled={!useDefaultTruck}
                  className={`bg-slate-900 border rounded-xl px-3 py-1.5 text-xs font-bold transition focus:outline-none ${
                    useDefaultTruck
                      ? 'border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20 cursor-pointer'
                      : 'border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} ({t.plateNumber}) - {t.driverName || 'Armada'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner Penjelasan Dinamis Sesuai Status Toggle */}
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed transition ${
                useDefaultTruck
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-900/70 border-slate-800 text-slate-300'
              }`}
            >
              {useDefaultTruck ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-300">Kondisi Unit Default Aktif (ON):</strong> Rincian biaya otomatis dimasukkan ke unit{' '}
                    <strong className="text-white underline font-mono">
                      {trucks.find((t) => t.id === selectedDefaultTruckId)?.code || 'Unit Default'}
                    </strong>
                    , namun jika ada blok unit dengan kode selain <strong>DT, EX, MB, GD</strong> (misal <code>CP05</code>), biaya tersebut tetap <strong>tidak dimasukkan</strong>.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-300">Kondisi Pencocokan Huruf & Nomor (DT, EX, MB, GD):</strong> Sistem memeriksa huruf depan (<strong>DT, EX, MB, GD</strong>) dan nomor unitnya secara spesifik (contoh: <code>DT 90</code>, <code>GD 01</code>, <code>EX 46</code>, <code>MB 13</code>) sehingga tidak akan tertukar atau dobel antar jenis unit yang bernomor sama.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TAB 1: FREEFORM TEXT PASTING */}
          {activeTab === 'freeform' && (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  rows={6}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Tempel tulisan atau catatan biaya di sini. Contoh:\n\n* DT 90\n  * Fuel: 17,445,413\n  * Lubricants: 397,387\n\n* EX 46\n  * Sparepart: 1,668,882\n  * Workshop: 1,889,553\n\n* MB 13\n  * Fuel: 2,450,000\n\n* GD 01\n  * Tyre & Tubes: 243,000`}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 font-mono text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition resize-y leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Kode didukung: <strong>DT, EX, MB, GD</strong> (contoh: <strong>DT 90, GD 01, EX 46, MB 13</strong>). Huruf & nomor dicocokkan persis agar tidak dobel.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {inputText && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleParseText}
                    disabled={isProcessing || !inputText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition shadow-lg shadow-emerald-500/20 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isProcessing ? 'Memilah Data...' : 'Pilah Data Otomatis ✨'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXCEL FILE UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/80 bg-slate-950/50 hover:bg-slate-950/80 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition shadow-lg shadow-emerald-500/10">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {selectedFile ? selectedFile.name : 'Klik atau seret file Excel (.xlsx / .csv) ke sini'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Format kolom yang didukung: Unit (DT 90, GD 01, EX 46, MB 13), Kategori, Keterangan, Nominal, Tanggal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* INFO JIKA SEMUA BARIS DITOLAK KARENA BUKAN KODE DT / EX / MB / GD */}
          {parsedItems.length === 0 && manualItems.length === 0 && rejectedNonDtCount > 0 && (
            <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 text-sm block">
                    {rejectedNonDtCount} Baris Biaya Otomatis Tidak Dimasukkan (Bukan Kode DT, EX, MB, GD)
                  </strong>
                  <span className="text-slate-300">
                    Sesuai kondisi, hanya kode dengan awalan <strong>DT, EX, MB, GD</strong> (contoh: DT 90, GD 01, EX 46, MB 13) yang masuk biaya. Baris dengan kode lain otomatis tidak dimasukkan.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAutoHideNonDt(false);
                  runTextParse(inputText, useDefaultTruck, selectedDefaultTruckId, false);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs shrink-0 transition cursor-pointer"
              >
                Lihat {rejectedNonDtCount} Baris yang Ditolak
              </button>
            </div>
          )}

          {/* PARSED RESULTS SECTION (FORMAT COCOK & PERLU PILAH MANUAL) */}
          {(parsedItems.length > 0 || manualItems.length > 0) && (
            <div className="space-y-5 pt-3 border-t border-slate-800 animate-in fade-in">
              {/* Summary Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 p-4 rounded-xl border border-emerald-500/30">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Hasil Pemilahan: {parsedItems.length} Biaya Masuk (DT / EX / MB / GD)
                    </h3>
                    {rejectedNonDtCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {rejectedNonDtCount} baris selain DT/EX/MB/GD tidak dimasukkan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {parsedItems.length} baris kode (DT, EX, MB, GD) siap disimpan
                    {manualItems.length > 0 ? ` • ${manualItems.length} baris di tab Tidak Masuk / Pilah Manual` : ''}.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Total Biaya Siap Simpan
                    </span>
                    <span className="text-lg font-mono font-black text-emerald-400">
                      {formatRupiah(grandTotalAmount)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveToDatabase}
                    disabled={isSaving || validItemsCount === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/25 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSaving ? 'Menyimpan...' : `Simpan ${validItemsCount} Biaya ke Database`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tab Switcher: Otomatis Cocok vs Tidak Masuk / Perlu Pilah Manual */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveResultTab('valid')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                    activeResultTab === 'valid'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Masuk Biaya (DT / EX / MB / GD)</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                    activeResultTab === 'valid' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {parsedItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveResultTab('manual')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                    activeResultTab === 'manual'
                      ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Tidak Masuk / Pilah Manual</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                    manualItems.length > 0
                      ? activeResultTab === 'manual'
                        ? 'bg-slate-950 text-rose-400'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {manualItems.length}
                  </span>
                  {manualItems.some((i) => Boolean(i.unrecognizedUnitCode)) && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/30 text-rose-200 border border-rose-500/40">
                      {manualItems.filter((i) => Boolean(i.unrecognizedUnitCode)).length} Unit DT Belum Terdaftar
                    </span>
                  )}
                </button>
              </div>

              {/* KONTEN TAB 1: FORMAT VALID / OTOMATIS COCOK */}
              {activeResultTab === 'valid' && (
                <div className="space-y-4">
                  {parsedItems.length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                      <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 opacity-80" />
                      <p className="font-semibold text-slate-300 text-sm">Belum Ada Biaya yang Cocok Otomatis</p>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Semua baris teks saat ini berada di tab <strong>"Perlu Pilah Manual"</strong> karena tidak menyebutkan kode DT yang sah saat tombol DT Default non-aktif.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveResultTab('manual')}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                      >
                        <span>Buka Tab Perlu Pilah Manual ({manualItems.length})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Unit Breakdown Cards */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <Truck className="w-4 h-4 text-emerald-400" />
                            <span>Rekap Biaya per Unit Truk Terkait:</span>
                          </h4>
                          <span className="text-xs text-slate-400">
                            {unitBreakdowns.length} Unit Terdeteksi
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {unitBreakdowns.map((b) => (
                            <div
                              key={b.truckId}
                              className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 shadow-md"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white">{b.truckCode}</span>
                                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400">
                                      {b.plateNumber}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">{b.driverName}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-mono font-bold text-emerald-300 block">
                                    {formatRupiah(b.totalAmount)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{b.totalItems} transaksi</span>
                                </div>
                              </div>

                              {/* Chips per Category */}
                              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-850">
                                {CATEGORIES.map((cat) => {
                                  const amt = b.categories[cat];
                                  if (!amt || amt <= 0) return null;
                                  const colors = CATEGORY_COLORS[cat];
                                  return (
                                    <span
                                      key={cat}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
                                    >
                                      {getCategoryIcon(cat)}
                                      <span>{cat}:</span>
                                      <strong className="font-mono">{formatRupiah(amt)}</strong>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detailed Editable Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Daftar Rincian Biaya Otomatis Cocok (Dapat Diubah Sebelum Disimpan):
                          </span>
                          <span className="text-xs text-slate-400">
                            Klik dropdown untuk koreksi Unit atau Kategori jika diperlukan
                          </span>
                        </div>

                        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                                <th className="py-2.5 px-3">Tgl</th>
                                <th className="py-2.5 px-3">Truk / Unit</th>
                                <th className="py-2.5 px-3">Kategori Otomatis</th>
                                <th className="py-2.5 px-3">Keterangan / Rincian</th>
                                <th className="py-2.5 px-3">Nominal (Rp)</th>
                                <th className="py-2.5 px-3">Vendor / Rekanan</th>
                                <th className="py-2.5 px-3 text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {parsedItems.map((item, idx) => {
                                const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Sparepart;
                                return (
                                  <tr
                                    key={item.id}
                                    className={`hover:bg-slate-900/50 transition ${
                                      !item.isValid ? 'bg-rose-500/5' : ''
                                    }`}
                                  >
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <input
                                        type="date"
                                        value={item.date}
                                        onChange={(e) => handleUpdateRowDate(idx, e.target.value)}
                                        className="bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none"
                                      />
                                    </td>

                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <select
                                        value={item.truckId}
                                        onChange={(e) => handleUpdateRowTruck(idx, e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                                      >
                                        {trucks.map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.code} ({t.plateNumber})
                                          </option>
                                        ))}
                                      </select>
                                    </td>

                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <select
                                        value={item.category}
                                        onChange={(e) =>
                                          handleUpdateRowCategory(idx, e.target.value as ExpenseCategory)
                                        }
                                        className={`border rounded px-2 py-1 text-xs font-bold focus:outline-none bg-slate-900 ${catColor.text} ${catColor.border}`}
                                      >
                                        {CATEGORIES.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    </td>

                                    <td className="py-2 px-3 min-w-[200px]">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleUpdateRowDescription(idx, e.target.value)}
                                        className="w-full bg-slate-900/70 border border-slate-750 focus:border-emerald-500 rounded px-2 py-1 text-xs text-slate-200"
                                      />
                                    </td>

                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <input
                                        type="text"
                                        value={formatNumber(item.amount)}
                                        onChange={(e) => handleUpdateRowAmount(idx, e.target.value)}
                                        className="w-28 font-mono text-right font-bold bg-slate-900/70 border border-slate-750 focus:border-emerald-500 rounded px-2 py-1 text-xs text-emerald-400"
                                      />
                                    </td>

                                    <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                                      <span className="truncate max-w-[140px] block" title={item.vendor}>
                                        {item.vendor}
                                      </span>
                                    </td>

                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRow(idx)}
                                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                                        title="Hapus baris ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* KONTEN TAB 2: FITUR DATA TIDAK COCOK / EDIT MANUAL */}
              {activeResultTab === 'manual' && (
                <div className="space-y-4">
                  {manualItems.length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 opacity-80" />
                      <p className="font-semibold text-slate-200 text-sm">Tidak Ada Data yang Perlu Dipilah Manual</p>
                      <p className="text-xs text-slate-400">
                        Seluruh data telah memiliki kode DT yang cocok dengan unit yang tersedia di database.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Banner Fitur Sampah & Pilah Manual */}
                      <div className="bg-rose-950/25 border border-rose-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5">
                          <Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-rose-300 text-sm">
                                Sampah / Perlu Pilah Manual ({manualItems.length} Catatan)
                              </h4>
                              {manualItems.some((i) => Boolean(i.unrecognizedUnitCode)) && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  {manualItems.filter((i) => Boolean(i.unrecognizedUnitCode)).length} kode unit tidak ada di armada
                                </span>
                              )}
                              {manualItems.some((i) => !i.unrecognizedUnitCode) && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {manualItems.filter((i) => !i.unrecognizedUnitCode).length} format berbeda dari contoh (DT 90)
                                </span>
                              )}
                            </div>
                            <p className="text-slate-300 mt-1 leading-relaxed">
                              Sistem hanya membaca kode DT dan nomor unitnya saja seperti <strong>(DT 90)</strong>. Semua baris yang berbeda otomatis disisihkan ke sini (tidak dimasukkan sembarangan ke unit lain) agar Anda dapat memeriksa dan mengeditnya secara manual.
                            </p>
                          </div>
                        </div>

                        {/* Bulk Action Bar */}
                        <div className="flex items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shrink-0">
                          <span className="text-slate-400 text-[11px] font-semibold">Terapkan Semua ke:</span>
                          <select
                            value={bulkManualTruckId}
                            onChange={(e) => setBulkManualTruckId(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-bold"
                          >
                            {trucks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.code} ({t.plateNumber})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleBulkAssignManual(bulkManualTruckId)}
                            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                          >
                            Terapkan Semua
                          </button>
                        </div>
                      </div>

                      {/* Sub-Filter Chips */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400 text-[11px] font-semibold mr-1">Filter Tampilan:</span>
                        <button
                          type="button"
                          onClick={() => setManualFilter('all')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            manualFilter === 'all'
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          Semua ({manualItems.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setManualFilter('mismatch')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            manualFilter === 'mismatch'
                              ? 'bg-rose-500 text-white font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-rose-300 border border-slate-800'
                          }`}
                        >
                          Kode Tidak Ada di Database ({manualItems.filter((i) => Boolean(i.unrecognizedUnitCode)).length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setManualFilter('nocode')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            manualFilter === 'nocode'
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-amber-300 border border-slate-800'
                          }`}
                        >
                          Tanpa Kode DT ({manualItems.filter((i) => !i.unrecognizedUnitCode).length})
                        </button>
                      </div>

                      {/* Tabel Data Tidak Cocok dengan Fitur Edit Manual Lengkap */}
                      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto shadow-inner">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                              <th className="py-2.5 px-3 w-8">No</th>
                              <th className="py-2.5 px-3 w-32">Tanggal</th>
                              <th className="py-2.5 px-3">Kode / Alasan Disisihkan</th>
                              <th className="py-2.5 px-3 w-36">Kategori</th>
                              <th className="py-2.5 px-3 min-w-[200px]">Keterangan (Edit Manual)</th>
                              <th className="py-2.5 px-3 w-36">Nominal Biaya</th>
                              <th className="py-2.5 px-3 w-44">Cocokkan ke Unit</th>
                              <th className="py-2.5 px-3 text-center w-12">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {manualItems
                              .map((item, originalIdx) => ({ item, originalIdx }))
                              .filter(({ item }) => {
                                if (manualFilter === 'mismatch') return Boolean(item.unrecognizedUnitCode);
                                if (manualFilter === 'nocode') return !item.unrecognizedUnitCode;
                                return true;
                              })
                              .map(({ item, originalIdx }, displayIdx) => {
                                const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Sparepart;
                                const isUnmatchedCode = Boolean(item.unrecognizedUnitCode);

                                return (
                                  <tr key={item.id} className="hover:bg-slate-900/50 transition">
                                    <td className="py-2.5 px-3 font-mono text-slate-500 align-top pt-3">
                                      {displayIdx + 1}
                                    </td>

                                    {/* Tanggal (Editable) */}
                                    <td className="py-2.5 px-3 align-top">
                                      <input
                                        type="date"
                                        value={item.date}
                                        onChange={(e) =>
                                          handleUpdateManualField(originalIdx, 'date', e.target.value)
                                        }
                                        className="bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none w-full"
                                      />
                                    </td>

                                    {/* Kode & Alasan Disisihkan */}
                                    <td className="py-2.5 px-3 align-top space-y-1">
                                      {isUnmatchedCode ? (
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                              {item.unrecognizedUnitCode}
                                            </span>
                                            <span className="text-[10px] text-rose-400 font-medium">
                                              Tidak cocok di database
                                            </span>
                                          </div>
                                          {onAddTruck && item.unrecognizedUnitCode && (
                                            <button
                                              type="button"
                                              onClick={() => handleRegisterNewUnit(item.unrecognizedUnitCode!)}
                                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                                              title={`Daftarkan unit ${item.unrecognizedUnitCode} ke database`}
                                            >
                                              <span>+ Daftarkan {item.unrecognizedUnitCode}</span>
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                          <Info className="w-3 h-3 text-amber-400" />
                                          <span>Tanpa Kode DT</span>
                                        </span>
                                      )}
                                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs" title={item.rawText}>
                                        Teks: "{item.rawText || item.description}"
                                      </div>
                                    </td>

                                    {/* Kategori (Editable) */}
                                    <td className="py-2.5 px-3 align-top">
                                      <select
                                        value={item.category}
                                        onChange={(e) =>
                                          handleUpdateManualField(
                                            originalIdx,
                                            'category',
                                            e.target.value as ExpenseCategory
                                          )
                                        }
                                        className={`w-full bg-slate-900 border ${catColor.border} rounded-lg px-2 py-1 text-xs font-semibold ${catColor.text} focus:outline-none`}
                                      >
                                        {CATEGORIES.map((cat) => (
                                          <option key={cat} value={cat}>
                                            {cat}
                                          </option>
                                        ))}
                                      </select>
                                    </td>

                                    {/* Keterangan (Editable) */}
                                    <td className="py-2.5 px-3 align-top">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) =>
                                          handleUpdateManualField(originalIdx, 'description', e.target.value)
                                        }
                                        placeholder="Keterangan biaya..."
                                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                                      />
                                    </td>

                                    {/* Nominal (Editable) */}
                                    <td className="py-2.5 px-3 align-top">
                                      <input
                                        type="number"
                                        value={item.amount || ''}
                                        onChange={(e) =>
                                          handleUpdateManualField(originalIdx, 'amount', e.target.value)
                                        }
                                        placeholder="Nominal..."
                                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-400 focus:outline-none"
                                      />
                                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                        {formatRupiah(item.amount)}
                                      </span>
                                    </td>

                                    {/* Pilih DT (Cocokkan) */}
                                    <td className="py-2.5 px-3 align-top whitespace-nowrap">
                                      <select
                                        defaultValue=""
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleAssignManualItem(originalIdx, e.target.value);
                                          }
                                        }}
                                        className="w-full bg-slate-900 border border-emerald-500/50 hover:border-emerald-400 focus:border-emerald-400 rounded-lg px-2 py-1.5 text-xs text-emerald-300 font-bold focus:outline-none cursor-pointer"
                                      >
                                        <option value="" disabled>
                                          -- Pilih Unit Truk --
                                        </option>
                                        {trucks.map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.code} ({t.plateNumber})
                                          </option>
                                        ))}
                                      </select>
                                    </td>

                                    {/* Aksi Hapus */}
                                    <td className="py-2.5 px-3 text-center align-top pt-3">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteManualItem(originalIdx)}
                                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                                        title="Hapus baris ini dari daftar manual"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Tutup
          </button>

          {parsedItems.length > 0 && (
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSaving || validItemsCount === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isSaving ? 'Menyimpan...' : `Simpan ${validItemsCount} Catatan`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
