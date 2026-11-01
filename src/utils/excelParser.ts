import * as XLSX from 'xlsx';
import { ExpenseCategory, TruckUnit } from '../types/truck';
import { CATEGORIES } from '../data/initialData';

export interface ParsedExpenseItem {
  id: string;
  rawIndex: number;
  rawText?: string;
  date: string;
  truckId: string;
  truckCode: string;
  unrecognizedUnitCode?: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  vendor: string;
  invoiceNumber?: string;
  isValid: boolean;
  validationError?: string;
  needsManualReview?: boolean;
  manualReason?: string;
}

export interface UnitCostBreakdown {
  truckId: string;
  truckCode: string;
  plateNumber: string;
  driverName: string;
  categories: Record<ExpenseCategory, number>;
  categoryCounts: Record<ExpenseCategory, number>;
  totalAmount: number;
  totalItems: number;
}

/**
 * Intelligent categorization based on keywords in text
 * Supports 10 categories: Fuel, Lubricant, Sparepart, Tyre & Tubes, Workshop, BPJS, Jamsostek, Potongan Mangkir, Beras, Supir
 */
export function detectCategory(text: string): ExpenseCategory {
  if (!text) return 'Sparepart';
  const lower = text.toLowerCase().trim();

  // 1. BPJS (Ketenagakerjaan / Kesehatan)
  if (
    lower.includes('tunjangan bpjs') ||
    lower.includes('bpjs') ||
    lower.includes('bpjstk') ||
    lower.includes('bpjs-tk') ||
    lower.includes('bpjs ketenagakerjaan') ||
    lower.includes('bpjs kesehatan') ||
    lower.includes('iuran bpjs') ||
    lower.includes('premi bpjs')
  ) {
    return 'BPJS';
  }

  // 2. Jamsostek (Asuransi Tenaga Kerja)
  if (
    lower.includes('tunjangan jamsostek') ||
    lower.includes('jamsostek') ||
    lower.includes('astek') ||
    lower.includes('jamsotek') ||
    lower.includes('asuransi tenaga kerja') ||
    lower.includes('asuransi supir') ||
    lower.includes('asuransi sopir') ||
    lower.includes('jaminan sosial') ||
    lower.includes('jkk') ||
    lower.includes('jkm') ||
    lower.includes('jht')
  ) {
    return 'Jamsostek';
  }

  // 3. Potongan Mangkir (Denda / Absensi / Tidak Hadir)
  if (
    lower.includes('potongan mangkir') ||
    lower.includes('potong mangkir') ||
    lower.includes('mangkir') ||
    lower.includes('denda mangkir') ||
    lower.includes('potongan absen') ||
    lower.includes('potong absen') ||
    lower.includes('alpa') ||
    lower.includes('tidak masuk') ||
    lower.includes('bolos') ||
    lower.includes('denda supir')
  ) {
    return 'Potongan Mangkir';
  }

  // 4. Beras (Catu Beras / Tunjangan Beras)
  if (
    lower.includes('beras') ||
    lower.includes('catu beras') ||
    lower.includes('tunjangan beras') ||
    lower.includes('jatah beras') ||
    lower.includes('kupon beras') ||
    lower.includes('sembako beras')
  ) {
    return 'Beras';
  }

  // 5. Fuel (BBM / Solar / Minyak)
  if (
    lower.includes('fuel') ||
    lower.includes('solar') ||
    lower.includes('biosolar') ||
    lower.includes('bio solar') ||
    lower.includes('dexlite') ||
    lower.includes('bbm') ||
    lower.includes('minyak') ||
    lower.includes('bensin') ||
    lower.includes('pertalite') ||
    lower.includes('pertamax') ||
    lower.includes('spbu') ||
    lower.includes('tangki bbm') ||
    /\b(\d+)\s*(liter|ltr|lt)\b/i.test(lower)
  ) {
    return 'Fuel';
  }

  // 6. Lubricant (Oli & Pelumas)
  if (
    lower.includes('lubricant') ||
    lower.includes('oli') ||
    lower.includes('pelumas') ||
    lower.includes('oil') ||
    lower.includes('meditran') ||
    lower.includes('mediteran') ||
    lower.includes('rored') ||
    lower.includes('gemuk') ||
    lower.includes('grease') ||
    lower.includes('gadus') ||
    lower.includes('rimula') ||
    lower.includes('castrol') ||
    lower.includes('sae 40') ||
    lower.includes('sae 90') ||
    lower.includes('sae 15w') ||
    lower.includes('oli mesin') ||
    lower.includes('oli gardan') ||
    lower.includes('oli persneling') ||
    lower.includes('oli transmisi')
  ) {
    return 'Lubricant';
  }

  // 7. Tyre & Tubes (Ban Luar / Ban Dalam / Flap / Vulkanisir)
  if (
    lower.includes('tyre') ||
    lower.includes('tire') ||
    lower.includes('tubes') ||
    lower.includes('tube') ||
    lower.includes('ban luar') ||
    lower.includes('ban dalam') ||
    lower.includes('lidah ban') ||
    lower.includes('flap ban') ||
    lower.includes('tambal ban') ||
    lower.includes('vulkanisir') ||
    lower.includes('bridgestone') ||
    lower.includes('gajah tunggal') ||
    lower.includes('dunlop') ||
    lower.includes('swallow') ||
    /\bban\b/i.test(lower)
  ) {
    return 'Tyre & Tubes';
  }

  // 8. Supir / Uang Jalan / Gaji / Ritase
  if (
    lower.includes('supir') ||
    lower.includes('sopir') ||
    lower.includes('driver') ||
    lower.includes('gaji') ||
    lower.includes('upah supir') ||
    lower.includes('uang jalan') ||
    lower.includes('uang makan') ||
    lower.includes('ritase') ||
    lower.includes('uang rit') ||
    lower.includes('trip') ||
    lower.includes('insentif supir') ||
    lower.includes('premi supir') ||
    lower.includes('kasbon supir') ||
    lower.includes('panjar supir') ||
    lower.includes('uang saku')
  ) {
    return 'Supir';
  }

  // 9. Workshop / Mekanik / Bengkel / Jasa / Servis / Las
  if (
    lower.includes('workshop') ||
    lower.includes('mekanik') ||
    lower.includes('bengkel') ||
    lower.includes('servis') ||
    lower.includes('service') ||
    lower.includes('tune up') ||
    lower.includes('las') ||
    lower.includes('bubut') ||
    lower.includes('ongkos mekanik') ||
    lower.includes('ongkos kerja') ||
    lower.includes('jasa mekanik') ||
    lower.includes('upah mekanik') ||
    lower.includes('jasa pasang') ||
    lower.includes('jasa stel') ||
    lower.includes('stel rem') ||
    lower.includes('kuras tangki') ||
    lower.includes('montir') ||
    lower.includes('perbaikan') ||
    lower.includes('reparasi') ||
    lower.includes('overhaul') ||
    lower.includes('turun mesin') ||
    lower.includes('jasa')
  ) {
    return 'Workshop';
  }

  // 10. Sparepart / Suku Cadang (dan default fallback)
  return 'Sparepart';
}

/**
 * Strict DT code extractor:
 * Hanya membaca kode DT sesuai contoh: DT 90 atau DT90 (termasuk dalam kurung (DT 90) / (DT90) atau bullet * DT90).
 * Selain format tersebut (misal CP05, Unit 90, dll.) return null agar tidak masuk.
 */
export function extractRawUnitCode(text: string): string | null {
  if (!text) return null;
  // Strictly matches only DT 90 or DT90 (optionally preceded by space, paren, bracket, bullet *)
  const match = text.match(/(?:^|[\s(\[*•\-])dt([ ]?[0-9]{1,4})(?:$|[\s)\]:;,.])/i);
  if (match) {
    const rawDigits = match[1].trim();
    const numVal = parseInt(rawDigits, 10);
    if (!isNaN(numVal)) {
      const formattedNum = numVal < 10 && rawDigits.length === 1 ? `0${numVal}` : rawDigits;
      return `DT ${formattedNum}`;
    }
  }
  return null;
}

/**
 * Strict Truck matching:
 * Hanya melihat kode DT dan nomor unitnya saja (contoh: DT 90).
 * Jika ada kode DT dan nomornya cocok dengan unit yang terdaftar di armada (trucks), return unit truk tersebut.
 * Jika nomor DT tidak terdaftar di armada atau tidak memiliki kode DT, return null.
 */
export function matchTruck(text: string, trucks: TruckUnit[]): TruckUnit | null {
  if (!text || trucks.length === 0) return null;

  // 1. Ekstraksi kode DT dengan pola ketat saja (DT 90)
  const rawCode = extractRawUnitCode(text);
  if (!rawCode) return null;

  const numMatch = rawCode.match(/[0-9]+/);
  if (!numMatch) return null;
  const targetNum = parseInt(numMatch[0], 10);

  // 2. Cocokkan nomor DT dengan daftar unit armada yang ada
  for (const truck of trucks) {
    const truckNumMatch = truck.code.match(/[0-9]+/);
    if (truckNumMatch && parseInt(truckNumMatch[0], 10) === targetNum) {
      return truck;
    }
  }

  return null;
}

/**
 * Clean & parse currency or number values
 * Handles: "Rp 1.500.000", "500rb", "150k", "1.5jt", "1,5 juta", "816000", "850.000,00"
 */
export function parseAmount(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;

  let str = String(val).trim().toLowerCase();

  // Multiplier: 1.5 jt / 1,5 juta
  const jutaMatch = str.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:jt|juta)\b/i);
  if (jutaMatch) {
    const num = parseFloat(jutaMatch[1].replace(',', '.'));
    return isNaN(num) ? 0 : Math.round(num * 1000000);
  }

  // Multiplier: 450rb / 450k / 450 ribu
  const ribuMatch = str.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:rb|k|ribu)\b/i);
  if (ribuMatch) {
    const num = parseFloat(ribuMatch[1].replace(',', '.'));
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }

  // Remove currency prefix
  str = str.replace(/^(rp\.?|idr)\s*/i, '');

  // Detect Indonesian format: 1.500.000,00 -> remove dot, replace comma with dot
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.') && !str.includes(',')) {
    const dotParts = str.split('.');
    if (dotParts.length > 2 || (dotParts.length === 2 && dotParts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    const commaParts = str.split(',');
    if (commaParts.length > 2 || (commaParts.length === 2 && commaParts[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * Clean & parse date string to YYYY-MM-DD
 */
export function parseDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];

  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const dateObj = new Date(excelEpoch.getTime() + val * 86400000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

export interface ParseFreeformOptions {
  useDefaultTruck?: boolean;
  defaultTruckId?: string;
}

export interface ParseFreeformResult {
  items: ParsedExpenseItem[];
  manualItems: ParsedExpenseItem[];
  detectedUnits: string[];
  unmatchedUnits: string[];
}

/**
 * Freeform Natural Language Note Parser
 * Parses WhatsApp messages, casual notes, unstructured text, bullet points.
 * 
 * LOGIKA 1: Ekstraksi & Validasi Format Kode DT
 * - Mencari pola DT (DT 90, DT90, dt 90, dt90, DT-90, dll.)
 * - Jika Format Valid (Cocok): Langsung dikelompokkan ke kategori DT yang sesuai.
 * - Jika Format Tidak Valid / Tidak Ada Kode:
 *   - Jika Tombol DT Default AKTIF (ON): Masuk ke nomor DT default terpilih.
 *   - Jika Tombol DT Default NON-AKTIF (OFF): Otomatis disisihkan ke daftar "Perlu Pilah Manual".
 */
export function parseFreeformNotes(
  text: string,
  trucks: TruckUnit[],
  options?: ParseFreeformOptions | string
): ParseFreeformResult {
  if (!text || !text.trim()) {
    return { items: [], manualItems: [], detectedUnits: [], unmatchedUnits: [] };
  }

  // Normalize options
  let useDefaultTruck = false;
  let defaultTruckId = '';
  if (typeof options === 'string') {
    defaultTruckId = options;
    useDefaultTruck = Boolean(options);
  } else if (options && typeof options === 'object') {
    useDefaultTruck = Boolean(options.useDefaultTruck);
    defaultTruckId = options.defaultTruckId || '';
  }

  const defaultTruck =
    (defaultTruckId ? trucks.find((t) => t.id === defaultTruckId) : null) ||
    trucks[0] ||
    null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const items: ParsedExpenseItem[] = [];
  const manualItems: ParsedExpenseItem[] = [];
  const detectedUnitsSet = new Set<string>();
  const unmatchedUnitsSet = new Set<string>();

  let activeTruck: TruckUnit | null = null;
  let activeRawUnitCode: string | null = null;
  let activeNonDtCode: string | null = null;
  const todayStr = new Date().toISOString().split('T')[0];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const cleanBulletLine = line.replace(/^[\s*\-•>#]+/, '').trim();

    // 1. Lewati baris rekap jumlah / total (contoh: "* Total Biaya: 27,448,205", "Total:", "Sub Total:")
    // agar angka total tidak ikut tercatat ganda sebagai item pengeluaran
    if (
      /^(?:total\s*biaya|total\s*pengeluaran|sub\s*total|subtotal|grand\s*total|jumlah\s*biaya|total)\b/i.test(
        cleanBulletLine
      )
    ) {
      continue;
    }

    // 2. Lewati baris kategori yang bernilai kosong / strip (contoh: "* GRN: -", "* Lain-Lain: -", "* BPJS: 0")
    // tanpa mengubah konteks unit DT aktif saat ini
    if (/:\s*(?:[-–—]+|rp\.?\s*0|0|nihil|kosong)\s*$/i.test(cleanBulletLine)) {
      continue;
    }

    // Cek apakah baris mengandung kode DT (DT 90 atau DT90)
    const lineMatchedTruck = matchTruck(line, trucks);
    const rawUnitFound = extractRawUnitCode(line);

    // Cek apakah baris mengandung nominal biaya
    const amountInLine = extractAmountFromText(line);

    // 3. Jika baris tidak memiliki nominal biaya (murni baris header unit / judul seksi):
    if (amountInLine <= 0) {
      if (lineMatchedTruck) {
        activeTruck = lineMatchedTruck;
        activeRawUnitCode = null;
        activeNonDtCode = null;
        detectedUnitsSet.add(lineMatchedTruck.code);
      } else if (rawUnitFound) {
        activeTruck = null;
        activeRawUnitCode = rawUnitFound;
        activeNonDtCode = null;
        unmatchedUnitsSet.add(rawUnitFound);
      } else if (cleanBulletLine.length > 0 && cleanBulletLine.length < 50) {
        // Header unit yang BUKAN format DT 90 / DT90 (contoh: "* CP05", "EX01", "Unit 1")
        // Reset activeTruck agar biaya di bawahnya TIDAK masuk ke unit DT sebelumnya!
        activeTruck = null;
        activeRawUnitCode = null;
        activeNonDtCode = cleanBulletLine.replace(/[:\-]+$/, '').trim();
      }
      continue;
    }

    const amount = amountInLine;

    // Cek apakah baris berbiaya ini menyebutkan kode non-DT secara eksplisit di awal baris (misal "CP05 Fuel: 500,000")
    const nonDtInlineMatch = cleanBulletLine.match(/^([a-z]{2,4}[ ]?[0-9]{1,4})\b/i);
    const inlineNonDtCode =
      nonDtInlineMatch && !/^dt/i.test(nonDtInlineMatch[1])
        ? nonDtInlineMatch[1].toUpperCase()
        : null;

    // Tentukan truk untuk baris biaya ini:
    let lineTruck: TruckUnit | null = null;
    let lineRawCode: string | null = null;
    let lineNonDtCode: string | null = null;

    if (lineMatchedTruck) {
      // Baris ini secara eksplisit menyebutkan kode DT valid (DT 90 / DT90) yang cocok dengan unit di database
      lineTruck = lineMatchedTruck;
      activeTruck = lineMatchedTruck;
      activeRawUnitCode = null;
      activeNonDtCode = null;
      detectedUnitsSet.add(lineMatchedTruck.code);
    } else if (rawUnitFound) {
      // Menulis kode DT valid (DT 90 / DT90) tetapi nomor unit tersebut belum terdaftar di Armada
      lineRawCode = rawUnitFound;
      activeTruck = null;
      activeRawUnitCode = rawUnitFound;
      activeNonDtCode = null;
      unmatchedUnitsSet.add(rawUnitFound);
    } else if (inlineNonDtCode) {
      // Menulis kode non-DT (misal CP05) pada baris yang sama
      lineNonDtCode = inlineNonDtCode;
      activeTruck = null;
      activeRawUnitCode = null;
      activeNonDtCode = inlineNonDtCode;
    } else if (activeTruck) {
      // Mengikuti header DT aktif sebelumnya (yang cocok)
      lineTruck = activeTruck;
    } else if (activeRawUnitCode) {
      // Mengikuti header DT aktif sebelumnya (yang belum terdaftar di Armada)
      lineRawCode = activeRawUnitCode;
      unmatchedUnitsSet.add(activeRawUnitCode);
    } else if (activeNonDtCode) {
      // Berada di bawah header non-DT (contoh: * CP05) -> tidak boleh masuk ke biaya DT!
      lineNonDtCode = activeNonDtCode;
    }

    const category = detectCategory(line);
    const date = extractDateFromText(line) || todayStr;
    const cleanDesc = cleanExpenseDescription(line, category);
    const vendor = extractVendorFromText(line, category);
    const invoiceMatch = line.match(/(?:inv|nota|kwitansi|faktur|no\.?|struk)[-:\s#]*([a-zA-Z0-9\/-]+)/i);
    const invoiceNumber = invoiceMatch ? invoiceMatch[1].trim() : undefined;

    // LOGIKA PEMILAHAN:
    // KONDISI 1: TOMBOL DT DEFAULT AKTIF (ON)
    if (useDefaultTruck && defaultTruck) {
      // Jika baris berada di bawah kode non-DT (misal CP05), tetap jangan masukkan kecuali memang tanpa kode atau DT
      if (lineNonDtCode) {
        manualItems.push({
          id: `manual-nondt-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          rawIndex: idx,
          rawText: line,
          date,
          truckId: '',
          truckCode: `${lineNonDtCode} (Bukan DT)`,
          category,
          description: cleanDesc,
          amount,
          vendor,
          invoiceNumber,
          isValid: false,
          needsManualReview: true,
          manualReason: `Kode "${lineNonDtCode}" bukan format DT 90 / DT90 sehingga tidak dimasukkan.`,
        });
        continue;
      }

      detectedUnitsSet.add(defaultTruck.code);
      items.push({
        id: `freeform-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: idx,
        rawText: line,
        date,
        truckId: defaultTruck.id,
        truckCode: defaultTruck.code,
        category,
        description: cleanDesc,
        amount,
        vendor,
        invoiceNumber,
        isValid: true,
        needsManualReview: false,
      });
      continue;
    }

    // KONDISI 2: TOMBOL DT DEFAULT NON-AKTIF (OFF)
    // Hanya kode DT 90 atau DT90 yang cocok dengan Armada yang masuk ke items!
    if (lineTruck) {
      items.push({
        id: `freeform-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: idx,
        rawText: line,
        date,
        truckId: lineTruck.id,
        truckCode: lineTruck.code,
        category,
        description: cleanDesc,
        amount,
        vendor,
        invoiceNumber,
        isValid: true,
        needsManualReview: false,
      });
    } else if (lineRawCode) {
      // Format DT valid (contoh DT 91 / DT91) tetapi unit belum didaftarkan di menu Armada
      manualItems.push({
        id: `manual-mismatch-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: idx,
        rawText: line,
        date,
        truckId: '',
        truckCode: lineRawCode,
        unrecognizedUnitCode: lineRawCode,
        category,
        description: cleanDesc,
        amount,
        vendor,
        invoiceNumber,
        isValid: false,
        needsManualReview: true,
        manualReason: `Kode unit "${lineRawCode}" terdeteksi, namun belum terdaftar di daftar Armada. Klik "+ Daftarkan ${lineRawCode}" di atas jika ingin memasukkannya.`,
      });
    } else {
      // Format bukan DT 90 / DT90 (misal CP05 atau tanpa kode DT) -> tidak masuk!
      const labelCode = lineNonDtCode ? `${lineNonDtCode} (Bukan DT)` : 'Tanpa Kode DT';
      manualItems.push({
        id: `manual-nocode-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: idx,
        rawText: line,
        date,
        truckId: '',
        truckCode: labelCode,
        category,
        description: cleanDesc,
        amount,
        vendor,
        invoiceNumber,
        isValid: false,
        needsManualReview: true,
        manualReason: lineNonDtCode
          ? `Kode "${lineNonDtCode}" bukan format DT 90 atau DT90 sehingga otomatis tidak dimasukkan.`
          : 'Tidak menggunakan kode DT 90 atau DT90 sehingga otomatis tidak dimasukkan.',
      });
    }
  }

  return {
    items,
    manualItems,
    detectedUnits: Array.from(detectedUnitsSet),
    unmatchedUnits: Array.from(unmatchedUnitsSet),
  };
}

/**
 * Extract amount number from natural text line
 * Supports both dot (17.445.413) and comma (17,445,413) thousand separators
 */
function extractAmountFromText(line: string): number {
  if (!line) return 0;

  // Hilangkan kode unit seperti DT 90 / DT90 / CP05 agar nomor unit tidak terbaca sebagai nominal
  const lineWithoutUnit = line
    .replace(/(?:^|[\s(\[*•\-])[a-z]{2,4}[ ]?[0-9]{1,4}(?:$|[\s)\]:;,.])/gi, ' ')
    .trim();

  // 1. Million multiplier: 1.5jt, 1,5 juta
  const jtMatch = lineWithoutUnit.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:jt|juta)\b/i);
  if (jtMatch) {
    const n = parseFloat(jtMatch[1].replace(',', '.'));
    if (!isNaN(n) && n > 0) return Math.round(n * 1000000);
  }

  // 2. Thousand multiplier: 450rb, 150k, 500 ribu
  const rbMatch = lineWithoutUnit.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:rb|k|ribu)\b/i);
  if (rbMatch) {
    const n = parseFloat(rbMatch[1].replace(',', '.'));
    if (!isNaN(n) && n > 0) return Math.round(n * 1000);
  }

  // 3. Currency prefix: Rp 850.000 or Rp 17,445,413 or IDR 850,000
  const rpMatch = lineWithoutUnit.match(/(?:rp\.?|idr)\s*([0-9.,]+)/i);
  if (rpMatch) {
    const n = parseAmount(rpMatch[1]);
    if (n > 0) return n;
  }

  // 4. Formatted thousand with dot OR comma: 850.000, 1.250.000, 17,445,413, 397,387, 243,000
  const sepPattern = /\b([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?)\b/;
  const sepMatch = lineWithoutUnit.match(sepPattern);
  if (sepMatch) {
    const n = parseAmount(sepMatch[1]);
    if (n > 0) return n;
  }

  // 5. Bare digits >= 1000 (e.g. 500000, 850000)
  const bareMatch = lineWithoutUnit.match(/\b([0-9]{4,12})\b/);
  if (bareMatch) {
    const n = parseInt(bareMatch[1], 10);
    if (!isNaN(n) && n >= 1000) return n;
  }

  return 0;
}

/**
 * Extract date from text if exists
 */
function extractDateFromText(line: string): string | null {
  // YYYY-MM-DD
  const ymd = line.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (ymd) return ymd[1];

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = line.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
}

/**
 * Clean description by removing bullets, amount strings, unit headers
 */
function cleanExpenseDescription(line: string, category: ExpenseCategory): string {
  let cleaned = line
    // Remove bullets and numbers at start
    .replace(/^[\s*\-•>#]+/, '')
    .replace(/^[0-9]+[.)]\s*/, '')
    // Remove explicit unit prefixes like "(DT 90)", "DT 90:", "DT90 -"
    .replace(/(?:\(?\s*dt[ ]?[0-9]{1,4}\s*\)?)[:\s\-]*/i, '')
    // Remove amount patterns (Rp, jt/rb, dot or comma thousands, bare digits)
    .replace(/(?:rp\.?|idr)\s*[0-9.,]+(?:\s*(?:jt|juta|rb|k|ribu))?/gi, '')
    .replace(/[0-9]+(?:[.,][0-9]+)?\s*(?:jt|juta|rb|k|ribu)\b/gi, '')
    .replace(/\b[0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?\b/g, '')
    .replace(/\b[0-9]{4,12}\b/g, '')
    // Clean multiple spaces and dashes
    .replace(/[:\-–—\s]+$/, '')
    .replace(/^[:\-–—\s]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3) {
    switch (category) {
      case 'Fuel':
        return 'Pengisian Fuel / BioSolar TBS';
      case 'Lubricant':
        return 'Penggantian Lubricant (Oli & Pelumas)';
      case 'Sparepart':
        return 'Penggantian Sparepart Unit';
      case 'Tyre & Tubes':
        return 'Penggantian Ban Luar / Ban Dalam (Tyre & Tubes)';
      case 'Workshop':
        return 'Jasa Servis & Workshop Mekanik';
      case 'BPJS':
        return 'Iuran BPJS Ketenagakerjaan / Kesehatan';
      case 'Jamsostek':
        return 'Premi Asuransi Jamsostek';
      case 'Potongan Mangkir':
        return 'Potongan Mangkir / Absensi';
      case 'Beras':
        return 'Tunjangan / Catu Beras';
      case 'Supir':
        return 'Upah Ritase & Operasional Supir';
      default:
        return 'Biaya Operasional Truk TBS';
    }
  }

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Extract or estimate vendor from text
 */
function extractVendorFromText(line: string, category: ExpenseCategory): string {
  const lower = line.toLowerCase();

  if (lower.includes('spbu')) {
    const spbuMatch = line.match(/(spbu[a-zA-Z0-9\.\s\-]*)/i);
    return spbuMatch ? spbuMatch[1].trim() : 'SPBU Mitra Kebun';
  }
  if (lower.includes('bengkel')) {
    const bengkelMatch = line.match(/(bengkel[a-zA-Z0-9\.\s\-]*)/i);
    return bengkelMatch ? bengkelMatch[1].trim() : 'Bengkel Rekanan';
  }
  if (lower.includes('toko ban') || lower.includes('toko')) {
    const tokoMatch = line.match(/(toko[a-zA-Z0-9\.\s\-]*)/i);
    return tokoMatch ? tokoMatch[1].trim() : 'Toko Sparepart Rekanan';
  }

  switch (category) {
    case 'Fuel':
      return 'SPBU / Gudang BBM';
    case 'Lubricant':
      return 'Gudang Oli & Pelumas';
    case 'Tyre & Tubes':
      return 'Gudang Ban & Vulkanisir';
    case 'Workshop':
      return 'Workshop / Bengkel Traksi';
    case 'BPJS':
      return 'BPJS Ketenagakerjaan';
    case 'Jamsostek':
      return 'Jamsostek';
    case 'Potongan Mangkir':
      return 'Bagian Personalia & Kasir';
    case 'Beras':
      return 'Logistik / Gudang Beras';
    case 'Supir':
      return 'Kasir Operasional Kebun';
    case 'Sparepart':
    default:
      return 'Gudang Sparepart Traksi';
  }
}

/**
 * Detect column indices from an Excel header row
 */
export function detectColumns(headerRow: any[]) {
  const map = {
    truckCol: -1,
    categoryCol: -1,
    amountCol: -1,
    descCol: -1,
    dateCol: -1,
    vendorCol: -1,
    invoiceCol: -1,
  };

  headerRow.forEach((cell, idx) => {
    if (cell === null || cell === undefined) return;
    const h = String(cell).toLowerCase().trim();

    if (map.truckCol === -1 && /^(unit|dt|truk|truck|mobil|armada|nopol|plat|no\s*plat|kendaraan)/i.test(h)) {
      map.truckCol = idx;
    } else if (map.amountCol === -1 && /(nominal|biaya|jumlah|total|harga|tarif|rupiah|rp|amount|cost|bayar|pengeluaran)/i.test(h)) {
      map.amountCol = idx;
    } else if (map.categoryCol === -1 && /(kategori|category|jenis|pos|klasifikasi|tipe|kelompok)/i.test(h)) {
      map.categoryCol = idx;
    } else if (map.descCol === -1 && /(keterangan|uraian|deskripsi|detail|item|rincian|catatan|keperluan|peruntukan|pekerjaan)/i.test(h)) {
      map.descCol = idx;
    } else if (map.dateCol === -1 && /(tanggal|tgl|date|waktu|hari)/i.test(h)) {
      map.dateCol = idx;
    } else if (map.vendorCol === -1 && /(vendor|toko|bengkel|spbu|penyedia|rekanan|kasir|pihak|sumber)/i.test(h)) {
      map.vendorCol = idx;
    } else if (map.invoiceCol === -1 && /(faktur|invoice|nota|kwitansi|no\s*inv|struk|bon|bukti)/i.test(h)) {
      map.invoiceCol = idx;
    }
  });

  return map;
}

/**
 * Process raw 2D array rows (from Excel or TSV table paste)
 */
/**
 * Process raw 2D array rows (from Excel or TSV table paste)
 */
export function processRawRows(
  rows: any[][],
  trucks: TruckUnit[],
  options?: { useDefaultTruck?: boolean; defaultTruckId?: string } | string
): { items: ParsedExpenseItem[]; manualItems: ParsedExpenseItem[]; detectedHeaders: string[] } {
  if (!rows || rows.length === 0) {
    return { items: [], manualItems: [], detectedHeaders: [] };
  }

  // Normalize options
  let useDefaultTruck = false;
  let defaultTruckId = '';
  if (typeof options === 'string') {
    defaultTruckId = options;
    useDefaultTruck = Boolean(options);
  } else if (options && typeof options === 'object') {
    useDefaultTruck = Boolean(options.useDefaultTruck);
    defaultTruckId = options.defaultTruckId || '';
  }

  const defaultTruck =
    (defaultTruckId ? trucks.find((t) => t.id === defaultTruckId) : null) ||
    trucks[0] ||
    null;

  const cleanRows = rows.filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));
  if (cleanRows.length === 0) {
    return { items: [], manualItems: [], detectedHeaders: [] };
  }

  let startRowIndex = 0;
  let colMap = detectColumns(cleanRows[0]);
  let detectedHeaders: string[] = [];

  const matchedCols = Object.values(colMap).filter((idx) => idx !== -1).length;
  if (matchedCols >= 2) {
    detectedHeaders = cleanRows[0].map((c) => String(c || '').trim());
    startRowIndex = 1;
  } else if (cleanRows.length > 1) {
    const colMap2 = detectColumns(cleanRows[1]);
    const matchedCols2 = Object.values(colMap2).filter((idx) => idx !== -1).length;
    if (matchedCols2 >= 2) {
      colMap = colMap2;
      detectedHeaders = cleanRows[1].map((c) => String(c || '').trim());
      startRowIndex = 2;
    }
  }

  if (colMap.amountCol === -1) {
    for (let c = 0; c < 10; c++) {
      let numericCount = 0;
      for (let r = startRowIndex; r < Math.min(startRowIndex + 5, cleanRows.length); r++) {
        const val = cleanRows[r]?.[c];
        if (val !== undefined && parseAmount(val) > 0) {
          numericCount++;
        }
      }
      if (numericCount >= 2) {
        colMap.amountCol = c;
        break;
      }
    }
  }

  const items: ParsedExpenseItem[] = [];
  const manualItems: ParsedExpenseItem[] = [];

  for (let r = startRowIndex; r < cleanRows.length; r++) {
    const row = cleanRows[r];
    if (!row || row.length === 0) continue;

    const rawUnit = colMap.truckCol !== -1 ? String(row[colMap.truckCol] || '') : '';
    const rawCategory = colMap.categoryCol !== -1 ? String(row[colMap.categoryCol] || '') : '';
    const rawDesc = colMap.descCol !== -1 ? String(row[colMap.descCol] || '') : '';
    const rawAmount = colMap.amountCol !== -1 ? row[colMap.amountCol] : 0;
    const rawDate = colMap.dateCol !== -1 ? row[colMap.dateCol] : '';
    const rawVendor = colMap.vendorCol !== -1 ? String(row[colMap.vendorCol] || '') : '';
    const rawInvoice = colMap.invoiceCol !== -1 ? String(row[colMap.invoiceCol] || '') : '';

    const amount = parseAmount(rawAmount);
    if (amount <= 0 && !rawDesc && !rawUnit) {
      continue;
    }

    let matchedTruck = matchTruck(rawUnit, trucks);
    if (!matchedTruck && rawDesc) {
      matchedTruck = matchTruck(rawDesc, trucks);
    }
    const rawUnitFound = extractRawUnitCode(rawUnit) || extractRawUnitCode(rawDesc);

    let category: ExpenseCategory = 'Sparepart';
    if (rawCategory) {
      category = detectCategory(rawCategory);
    } else if (rawDesc) {
      category = detectCategory(rawDesc);
    } else if (rawVendor) {
      category = detectCategory(rawVendor);
    }

    const description = rawDesc.trim() || `Pengeluaran ${category}`;
    let vendor = rawVendor.trim();
    if (!vendor) {
      vendor = extractVendorFromText(rawDesc || category, category);
    }

    const date = parseDate(rawDate);
    const rowText = row.filter(Boolean).join(' | ');

    // KONDISI 1: TOMBOL DT DEFAULT AKTIF (ON)
    // Sesuai instruksi: "Kalo tombol dt default on maka tetap masukin semua biaya ke dt terpilih ...tanpa melihat kode"
    if (useDefaultTruck && defaultTruck) {
      items.push({
        id: `parsed-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: r,
        rawText: rowText,
        date,
        truckId: defaultTruck.id,
        truckCode: defaultTruck.code,
        category,
        description,
        amount,
        vendor,
        invoiceNumber: rawInvoice.trim() || undefined,
        isValid: true,
        needsManualReview: false,
      });
      continue;
    }

    // KONDISI 2: TOMBOL DT DEFAULT NON-AKTIF (OFF)
    if (matchedTruck) {
      items.push({
        id: `parsed-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: r,
        rawText: rowText,
        date,
        truckId: matchedTruck.id,
        truckCode: matchedTruck.code,
        category,
        description,
        amount,
        vendor,
        invoiceNumber: rawInvoice.trim() || undefined,
        isValid: true,
        needsManualReview: false,
      });
    } else if (rawUnitFound) {
      // Kode DT terdeteksi lengkap, namun tidak ada persamaan dengan unit yang tersedia di database
      manualItems.push({
        id: `manual-table-mismatch-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: r,
        rawText: rowText,
        date,
        truckId: '',
        truckCode: rawUnitFound,
        unrecognizedUnitCode: rawUnitFound,
        category,
        description,
        amount,
        vendor,
        invoiceNumber: rawInvoice.trim() || undefined,
        isValid: false,
        needsManualReview: true,
        manualReason: `Kode unit "${rawUnitFound}" terdeteksi, namun tidak cocok dengan unit yang tersedia di database.`,
      });
    } else {
      // Baris tabel tidak memiliki kode DT sama sekali
      manualItems.push({
        id: `manual-table-nocode-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: r,
        rawText: rowText,
        date,
        truckId: '',
        truckCode: 'Tanpa Kode DT',
        category,
        description,
        amount,
        vendor,
        invoiceNumber: rawInvoice.trim() || undefined,
        isValid: false,
        needsManualReview: true,
        manualReason: 'Tidak ada kode DT pada baris tabel (Format tidak valid / tidak ada kode)',
      });
    }
  }

  return { items, manualItems, detectedHeaders };
}

/**
 * Parse clipboard text pasted from Excel (TSV or CSV)
 */
export function parsePastedExcelText(
  text: string,
  trucks: TruckUnit[],
  options?: { useDefaultTruck?: boolean; defaultTruckId?: string } | string
): { items: ParsedExpenseItem[]; manualItems: ParsedExpenseItem[]; detectedHeaders: string[] } {
  if (!text || !text.trim()) {
    return { items: [], manualItems: [], detectedHeaders: [] };
  }

  // If text doesn't contain tabs or semicolons, but has newline with freeform content,
  // route through the intelligent natural language note parser!
  const hasTabs = text.includes('\t');
  const hasSemicolons = text.includes(';');

  if (!hasTabs && !hasSemicolons) {
    const freeformResult = parseFreeformNotes(text, trucks, options);
    return {
      items: freeformResult.items,
      manualItems: freeformResult.manualItems,
      detectedHeaders: ['Teks Catatan Bebas'],
    };
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: string[][] = lines.map((line) => {
    if (line.includes('\t')) {
      return line.split('\t');
    } else if (line.includes(';') && !line.includes(',')) {
      return line.split(';');
    } else {
      const pattern = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
      const cells: string[] = [];
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (match.index === pattern.lastIndex) pattern.lastIndex++;
        const val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2] || '';
        cells.push(val);
      }
      return cells.length > 0 ? cells : line.split(',');
    }
  });

  return processRawRows(rows, trucks, options);
}

/**
 * Parse uploaded Excel file buffer
 */
export async function parseExcelFile(
  file: File,
  trucks: TruckUnit[],
  options?: { useDefaultTruck?: boolean; defaultTruckId?: string } | string
): Promise<{ items: ParsedExpenseItem[]; manualItems: ParsedExpenseItem[]; detectedHeaders: string[]; sheetNames: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetNames = workbook.SheetNames;
        if (sheetNames.length === 0) {
          throw new Error('File Excel tidak memiliki lembar kerja (sheet)');
        }

        const firstSheetName = sheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        const { items, manualItems, detectedHeaders } = processRawRows(rawRows, trucks, options);
        resolve({ items, manualItems, detectedHeaders, sheetNames });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file Excel'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Group parsed items into unit-specific cost breakdowns across 5 categories:
 * Sparepart, Oli, Minyak, Mekanik, Supir
 */
export function calculateUnitBreakdowns(
  items: ParsedExpenseItem[],
  trucks: TruckUnit[]
): UnitCostBreakdown[] {
  const breakdownMap = new Map<string, UnitCostBreakdown>();

  items.forEach((item) => {
    const truck = trucks.find((t) => t.id === item.truckId);
    const truckId = item.truckId || (item.unrecognizedUnitCode ? `unregistered-${item.unrecognizedUnitCode}` : 'unknown');
    const truckCode = truck?.code || item.truckCode || 'Unit';
    const plateNumber = truck?.plateNumber || '-';
    const driverName = truck?.driverName || '-';

    if (!breakdownMap.has(truckId)) {
      const initialCategories = CATEGORIES.reduce((acc, cat) => {
        acc[cat] = 0;
        return acc;
      }, {} as Record<ExpenseCategory, number>);

      const initialCounts = CATEGORIES.reduce((acc, cat) => {
        acc[cat] = 0;
        return acc;
      }, {} as Record<ExpenseCategory, number>);

      breakdownMap.set(truckId, {
        truckId,
        truckCode,
        plateNumber,
        driverName,
        categories: initialCategories,
        categoryCounts: initialCounts,
        totalAmount: 0,
        totalItems: 0,
      });
    }

    const b = breakdownMap.get(truckId)!;
    const cat = item.category as ExpenseCategory;
    if (b.categories[cat] !== undefined) {
      b.categories[cat] += item.amount;
      b.categoryCounts[cat] += 1;
    }
    b.totalAmount += item.amount;
    b.totalItems += 1;
  });

  return Array.from(breakdownMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}
