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
} from 'lucide-react';
import { TruckUnit, ExpenseCategory, ExpenseRecord } from '../types/truck';
import { formatRupiah, formatNumber } from '../utils/formatters';
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

  // Handle parse from text (supports freeform text and excel tables)
  const handleParseText = () => {
    setErrorMessage(null);
    setSuccessCount(null);
    if (!inputText.trim()) {
      setErrorMessage('Silakan tempel (paste) catatan atau tulisan biaya terlebih dahulu.');
      return;
    }

    try {
      setIsProcessing(true);
      const parseOptions = {
        useDefaultTruck,
        defaultTruckId: selectedDefaultTruckId,
      };

      if (inputText.includes('\t') || (inputText.includes(';') && !inputText.includes(','))) {
        const { items, manualItems: mItems } = parsePastedExcelText(inputText, trucks, parseOptions);
        if (items.length === 0 && mItems.length === 0) {
          setErrorMessage('Tidak ada baris data biaya yang dapat dideteksi dari teks tabel yang ditempel.');
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
      } else {
        const result = parseFreeformNotes(inputText, trucks, parseOptions);
        if (result.items.length === 0 && result.manualItems.length === 0) {
          setErrorMessage(
            'Tidak ada data biaya yang terdeteksi. Pastikan mencantumkan rincian dan nominal biaya (contoh: "Solar 850.000").'
          );
          setParsedItems([]);
          setManualItems([]);
          return;
        }
        setParsedItems(result.items);
        setManualItems(result.manualItems);
        setDetectedUnits(result.detectedUnits);
        setUnmatchedUnits(result.unmatchedUnits);
        if (result.items.length === 0 && result.manualItems.length > 0) {
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

  // Muat contoh catatan bebas untuk pengujian cepat
  const handleLoadSampleDT90 = () => {
    setActiveTab('freeform');
    setInputText(`DT 90
- Bio solar 100 liter 850.000 SPBU Pasir
- Kampas rem depan bendix 450rb
- Ongkos montir bengkel las 200rb
- Tunjangan BPJS supir 175.000
- Tunjangan Jamsostek supir 150rb
- Potongan mangkir 1 hari 125.000
- Upah supir ritase afdeling 2 450.000
- Ganti oli mesin meditran 550rb`);
    setErrorMessage(null);
  };

  const handleLoadSampleMultiDT = () => {
    setActiveTab('freeform');
    setInputText(`PENGELUARAN ARMADA TRUK TBS - 24 MARET

DT 90:
- Bio solar 100 liter 850.000
- Kampas rem depan 450rb
- Tunjangan BPJS supir 175.000
- Tunjangan Jamsostek supir 150.000
- Potongan mangkir supir 125.000

DT 01:
- Bio solar 90 liter 750.000 SPBU Pasir
- Ganti ban luar bridgestone 1.950.000
- Ongkos las bak dump truk 350rb
- Ganti oli gardan rored 320rb

DT 03:
- Solar industri 800.000
- Filter solar & oli iself 380rb
- Jasa tuneup diesel 250rb`);
    setErrorMessage(null);
  };

  // Contoh tanpa kode DT untuk menguji logika Unit Default ON vs OFF
  const handleLoadSampleWithoutDT = () => {
    setActiveTab('freeform');
    setInputText(`- Bio solar 100 liter 850.000 SPBU Pasir
- Kampas rem depan bendix 450rb
- Ongkos montir bengkel las 200rb
- Ganti oli mesin meditran 550rb
- Tambal ban dump truk 80.000`);
    setErrorMessage(null);
  };

  // Contoh dengan kode DT yang belum terdaftar di sistem (menguji Fitur Data Tidak Cocok)
  const handleLoadSampleMismatchDT = () => {
    setActiveTab('freeform');
    setInputText(`DT 88 (Unit Belum Terdaftar di Sistem):
- Beli ban luar dump truck Rp 2.450.000
- Jasa pasang ban & cek rem 150.000

DT 90:
- Ganti oli mesin Meditran SX4 10 Liter 580.000
- Servis kampas rem depan 200.000`);
    setErrorMessage(null);
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

  // Helper to auto-create an unrecognized unit if user pasted e.g. DT 99 or DT 88
  const handleRegisterNewUnit = async (unitCode: string) => {
    if (!onAddTruck) return;
    try {
      const cleanNum = unitCode.replace(/[^0-9]/g, '') || '99';
      const created = await onAddTruck({
        code: unitCode.toUpperCase(),
        plateNumber: `BM ${cleanNum.padEnd(4, '0')} TBS`,
        driverName: `Supir ${unitCode}`,
        model: 'Dump Truck TBS 130 HD',
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

  const handleDeleteRow = (index: number) => {
    setParsedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAll = () => {
    setInputText('');
    setParsedItems([]);
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
      case 'Minyak':
        return <Fuel className="w-3.5 h-3.5" />;
      case 'Sparepart':
        return <Package className="w-3.5 h-3.5" />;
      case 'Mekanik':
        return <Wrench className="w-3.5 h-3.5" />;
      case 'Oli':
        return <Droplets className="w-3.5 h-3.5" />;
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

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Minyak',
        'Keterangan': 'Pengisian BioSolar 120 Liter',
        'Nominal Biaya': 816000,
        'Vendor': 'SPBU Pasir Pengaraian',
        'No Invoice': 'SPBU-2810',
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Sparepart',
        'Keterangan': 'Beli kampas rem depan Bendix HD',
        'Nominal Biaya': 450000,
        'Vendor': 'Toko Sparepart Mandiri',
        'No Invoice': 'INV-4412',
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Mekanik',
        'Keterangan': 'Jasa pasang kampas rem & las engsel bak',
        'Nominal Biaya': 200000,
        'Vendor': 'Bengkel Servis Berkah Truk',
        'No Invoice': 'BSB-1028',
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Tunjangan BPJS',
        'Keterangan': 'Tunjangan Iuran BPJS Ketenagakerjaan Supir',
        'Nominal Biaya': 175000,
        'Vendor': 'BPJS Ketenagakerjaan KC Rokan Hulu',
        'No Invoice': 'BPJS-1028-90',
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Tunjangan Jamsostek',
        'Keterangan': 'Tunjangan Premi Asuransi Jamsostek Supir',
        'Nominal Biaya': 150000,
        'Vendor': 'Jamsostek Tenaga Kerja Sawit',
        'No Invoice': 'JAM-1028',
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Potongan Mangkir',
        'Keterangan': 'Potongan mangkir supir 1 hari kerja',
        'Nominal Biaya': 125000,
        'Vendor': 'Kasir / Bagian Personalia',
        'No Invoice': 'POT-MGK-28',
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'DT 90',
        'Kategori': 'Supir',
        'Keterangan': 'Upah ritase supir afdeling 2',
        'Nominal Biaya': 450000,
        'Vendor': 'Kasbon Kasir Kebun',
        'No Invoice': 'UPH-2810-90',
      },
      {
        'Tanggal': '2026-10-28',
        'Unit Truk': 'Unit 01',
        'Kategori': 'Oli',
        'Keterangan': 'Ganti Oli Mesin Meditran SX4 10 Liter',
        'Nominal Biaya': 580000,
        'Vendor': 'Toko Oli Nusantara',
        'No Invoice': 'TOPN-9012',
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
                  Auto-Detect DT 90 & Kategori
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tempel tulisan bebas, catatan WA, atau tabel Excel. Sistem otomatis memilah nomor DT (misal: DT 90), nominal biaya, dan kategori (Solar, Sparepart, Mekanik, Oli, Supir, Tunjangan BPJS, Tunjangan Jamsostek, Potongan Mangkir).
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

            {/* Action Buttons & Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleLoadSampleDT90}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                title="Muat contoh catatan biaya unit DT 90"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Contoh DT 90</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleMultiDT}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition cursor-pointer"
                title="Muat contoh catatan gabungan banyak truk (DT 90, DT 01, DT 03)"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Contoh Multi Unit</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleWithoutDT}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition cursor-pointer"
                title="Uji coba teks tanpa kode DT (Uji coba Toggle DT Default ON vs OFF)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Contoh Tanpa Kode DT</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleMismatchDT}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                title="Uji coba catatan dengan kode DT tidak cocok di database (Fitur Data Tidak Cocok)"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>Contoh Kode Tidak Cocok (DT 88)</span>
              </button>

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

          {/* CARD PENGATURAN UNIT DEFAULT & TOMBOL PENGALIH (TOGGLE SWITCH) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tombol Pengalih (Toggle Switch) */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useDefaultTruck}
                  onClick={() => setUseDefaultTruck(!useDefaultTruck)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useDefaultTruck ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                  title="Klik untuk mengaktifkan / menonaktifkan Unit DT Default"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                      useDefaultTruck ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">Pilih DT Default</span>
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
                      ? 'Teks tanpa kode DT otomatis masuk ke unit default terpilih'
                      : 'Murni logika otomatis. Teks tanpa kode DT disisihkan ke "Perlu Pilah Manual"'}
                  </p>
                </div>
              </div>

              {/* Dropdown Pemilihan Unit DT Default */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-300 shrink-0">Unit DT Default:</label>
                <select
                  value={selectedDefaultTruckId}
                  onChange={(e) => setSelectedDefaultTruckId(e.target.value)}
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

            {/* Banner Penjelasan Dinamis Sesuai Status Toggle (Logika 2) */}
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
                    <strong className="text-emerald-300">Kondisi Aktif (ON):</strong> Jika pada teks tempel tidak disebutkan kode DT sama sekali, sistem tidak akan menyisihkannya ke manual, melainkan langsung memasukkan seluruh biaya atau data tersebut ke nomor DT default yang Anda pilih (otomatis masuk ke{' '}
                    <strong className="text-white underline font-mono">
                      {trucks.find((t) => t.id === selectedDefaultTruckId)?.code || 'DT Default'}
                    </strong>).
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-300">Kondisi Non-Aktif (OFF):</strong> Sistem kembali murni mengandalkan logika otomatis. Data yang tidak memiliki kode DT yang jelas akan otomatis disisihkan ke menu <strong>"Perlu Pilah Manual"</strong>, dan hanya biaya yang memiliki kode DT yang sah saja yang akan diproses serta dibagi secara otomatis.
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
                  placeholder={`Tempel tulisan atau catatan biaya apapun di sini. Contoh:\n\nDT 90\n- Bio solar 100 liter 850.000 SPBU Pasir\n- Kampas rem depan bendix 450rb\n- Ongkos montir bengkel las 200rb\n- Tunjangan BPJS supir 175.000\n- Tunjangan Jamsostek supir 150rb\n- Potongan mangkir 1 hari 125.000\n- Upah supir ritase afdeling 2 450.000\n- Ganti oli mesin meditran 550rb\n\nDT 01:\nIsi biosolar 700.000\nGanti ban luar bridgestone 1.950.000`}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 font-mono text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition resize-y leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Format kode DT yang didukung: <strong>DT 90</strong>, <strong>DT90</strong>, <strong>dt 90</strong>, <strong>dt-90</strong>, dll.
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
                    Format kolom yang didukung: Unit/DT, Kategori, Keterangan, Nominal, Vendor, Tanggal.
                  </p>
                </div>
              </div>
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
                      Hasil Pemilahan: {parsedItems.length + manualItems.length} Catatan Biaya Terdeteksi
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {parsedItems.length} baris otomatis cocok dengan unit DT &bull; {manualItems.length} baris disisihkan ke Pilah Manual.
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

              {/* Tab Switcher: Otomatis Cocok vs Data Tidak Cocok */}
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
                  <span>Format Valid / Otomatis Cocok</span>
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
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Data Tidak Cocok / Edit Manual</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                    manualItems.length > 0
                      ? activeResultTab === 'manual'
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {manualItems.length}
                  </span>
                  {manualItems.some((i) => Boolean(i.unrecognizedUnitCode)) && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/30 text-rose-200 border border-rose-500/40">
                      {manualItems.filter((i) => Boolean(i.unrecognizedUnitCode)).length} Unit Tak Terdaftar
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
                                    <td className="py-2 px-3 whitespace-nowrap text-slate-400 font-mono">
                                      {item.date}
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
                      {/* Banner Fitur Data Tidak Cocok */}
                      <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-amber-300 text-sm">
                                Fitur Data Tidak Cocok ({manualItems.length} Catatan)
                              </h4>
                              {manualItems.some((i) => Boolean(i.unrecognizedUnitCode)) && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  {manualItems.filter((i) => Boolean(i.unrecognizedUnitCode)).length} kode unit tidak terdaftar di database
                                </span>
                              )}
                              {manualItems.some((i) => !i.unrecognizedUnitCode) && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {manualItems.filter((i) => !i.unrecognizedUnitCode).length} tanpa kode DT
                                </span>
                              )}
                            </div>
                            <p className="text-slate-300 mt-1 leading-relaxed">
                              Data yang memiliki kode unit tetapi tidak cocok dengan unit database <strong>TIDAK dimasukkan sembarangan</strong> ke unit default agar tidak menambah pekerjaan Anda. Anda dapat mengedit tanggal, kategori, rincian, dan nominal biaya secara manual di bawah, atau langsung mencocokkannya ke unit yang ada.
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
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSaving ? 'Menyimpan...' : `Simpan ${validItemsCount} Catatan ke Database`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
