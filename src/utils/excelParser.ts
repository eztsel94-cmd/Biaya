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
 * Supports categories: Sparepart, Oli, Minyak, Mekanik, Supir, Tunjangan BPJS, Tunjangan Jamsostek, Potongan Mangkir
 */
export function detectCategory(text: string): ExpenseCategory {
  if (!text) return 'Sparepart';
  const lower = text.toLowerCase().trim();

  // 1. Tunjangan BPJS (Ketenagakerjaan / Kesehatan)
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
    return 'Tunjangan BPJS';
  }

  // 2. Tunjangan Jamsostek (Asuransi Tenaga Kerja Supir)
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
    lower.includes('jkm')
  ) {
    return 'Tunjangan Jamsostek';
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

  // 4. Minyak / BBM / Solar
  if (
    lower.includes('solar') ||
    lower.includes('biosolar') ||
    lower.includes('bio solar') ||
    lower.includes('dexlite') ||
    lower.includes('bbm') ||
    lower.includes('minyak') ||
    lower.includes('bensin') ||
    lower.includes('fuel') ||
    lower.includes('pertalite') ||
    lower.includes('pertamax') ||
    lower.includes('spbu') ||
    lower.includes('tangki bbm') ||
    /\b(\d+)\s*(liter|ltr|lt)\b/i.test(lower)
  ) {
    return 'Minyak';
  }

  // 5. Oli & Pelumas
  if (
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
    lower.includes('filter oli') ||
    lower.includes('oli mesin') ||
    lower.includes('oli gardan') ||
    lower.includes('oli persneling') ||
    lower.includes('oli transmisi')
  ) {
    return 'Oli';
  }

  // 6. Supir / Uang Jalan / Gaji / Ritase
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

  // 7. Mekanik / Bengkel / Jasa / Servis / Las
  if (
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
    return 'Mekanik';
  }

  // 5. Sparepart / Suku Cadang
  if (
    lower.includes('sparepart') ||
    lower.includes('spare part') ||
    lower.includes('sperpart') ||
    lower.includes('onderdil') ||
    lower.includes('ban') ||
    lower.includes('per daun') ||
    lower.includes('per') ||
    lower.includes('kampas') ||
    lower.includes('kanvas') ||
    lower.includes('rem') ||
    lower.includes('aki') ||
    lower.includes('accu') ||
    lower.includes('bearing') ||
    lower.includes('klaher') ||
    lower.includes('baut') ||
    lower.includes('u-bolt') ||
    lower.includes('filter') ||
    lower.includes('tali kipas') ||
    lower.includes('fan belt') ||
    lower.includes('alternator') ||
    lower.includes('wiper') ||
    lower.includes('bohlam') ||
    lower.includes('lampu') ||
    lower.includes('shock') ||
    lower.includes('bushing') ||
    lower.includes('seal') ||
    lower.includes('spion') ||
    lower.includes('velg')
  ) {
    return 'Sparepart';
  }

  // Default fallback
  return 'Sparepart';
}

/**
 * Strict DT code extractor:
 * Hanya melihat kode DT dan nomor unitnya saja, contoh: (DT 90), DT 90, dt 90, DT90, dt90, DT-90.
 * Tidak ada penambahan kata kunci lain (tidak mencocokkan plat nomor, nama supir, atau istilah lain).
 * Jika berbeda dari contoh di atas, return null agar otomatis disisihkan ke sampah/pilah manual.
 */
export function extractRawUnitCode(text: string): string | null {
  if (!text) return null;
  // Strictly matches patterns like: (DT 90), [DT 90], DT 90, DT90, dt 90, dt90, DT-90, dt-90
  const match = text.match(/(?:^|[\s(\[#_:\/-])dt[\s._-]*([0-9]{1,4})(?:$|[\s)\]:;,\/-])/i);
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
  const todayStr = new Date().toISOString().split('T')[0];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Cek apakah baris merupakan header unit (contoh: "DT 90", "DT90:", "[dt 90]", "Unit 90", "=== DT 01 ===")
    const lineMatchedTruck = matchTruck(line, trucks);
    const rawUnitFound = extractRawUnitCode(line);

    // Cek apakah baris mengandung nominal biaya
    const amountInLine = extractAmountFromText(line);

    // Jika baris adalah murni header unit tanpa biaya:
    const isPureHeader =
      Boolean(lineMatchedTruck || rawUnitFound) &&
      amountInLine <= 0 &&
      line.length < 60;

    if (isPureHeader) {
      if (lineMatchedTruck) {
        activeTruck = lineMatchedTruck;
        activeRawUnitCode = null;
        detectedUnitsSet.add(lineMatchedTruck.code);
      } else if (rawUnitFound) {
        activeTruck = null;
        activeRawUnitCode = rawUnitFound;
        unmatchedUnitsSet.add(rawUnitFound);
      }
      continue;
    }

    const amount = amountInLine;
    if (amount <= 0) {
      // Baris bukan catatan biaya (misal judul, sapaan, catatan non-angka), lewati
      continue;
    }

    // Tentukan truk untuk baris biaya ini:
    let lineTruck: TruckUnit | null = null;
    let lineRawCode: string | null = null;

    if (lineMatchedTruck) {
      // Baris ini secara eksplisit menyebutkan kode DT valid yang cocok dengan unit di database
      lineTruck = lineMatchedTruck;
      activeTruck = lineMatchedTruck; // perbarui konteks untuk baris-baris berikutnya
      activeRawUnitCode = null;
      detectedUnitsSet.add(lineMatchedTruck.code);
    } else if (rawUnitFound) {
      // Menulis kode DT lengkap tetapi unit tidak ditemukan/tidak cocok di database
      lineRawCode = rawUnitFound;
      activeTruck = null;
      activeRawUnitCode = rawUnitFound;
      unmatchedUnitsSet.add(rawUnitFound);
    } else if (activeTruck) {
      // Mengikuti header DT aktif sebelumnya (yang cocok)
      lineTruck = activeTruck;
    } else if (activeRawUnitCode) {
      // Mengikuti header DT aktif sebelumnya (yang tidak cocok dengan unit database)
      lineRawCode = activeRawUnitCode;
      unmatchedUnitsSet.add(activeRawUnitCode);
    }

    const category = detectCategory(line);
    const date = extractDateFromText(line) || todayStr;
    const cleanDesc = cleanExpenseDescription(line, category);
    const vendor = extractVendorFromText(line, category);
    const invoiceMatch = line.match(/(?:inv|nota|kwitansi|faktur|no\.?|struk)[-:\s#]*([a-zA-Z0-9\/-]+)/i);
    const invoiceNumber = invoiceMatch ? invoiceMatch[1].trim() : undefined;

    // LOGIKA PEMILAHAN:
    // KONDISI 1: TOMBOL DT DEFAULT AKTIF (ON)
    // Sesuai instruksi: "Kalo tombol dt default on maka tetap masukin semua biaya ke dt terpilih ...tanpa melihat kode"
    if (useDefaultTruck && defaultTruck) {
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
    // Mengandalkan kode DT secara murni:
    // 2a. Kode cocok dengan unit di database -> Format Valid / Otomatis Cocok
    // 2b. Kode lengkap tapi tidak ada persamaan di database -> Data Tidak Cocok (bisa diedit manual)
    // 2c. Tanpa kode DT -> Data Tidak Cocok / Perlu Pilah Manual
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
      // KODE DT LENGKAP TAPI TIDAK COCOK DENGAN UNIT YANG TERSEDIA
      // Tidak boleh dimasukkan sembarangan ke unit lain, masuk ke Data Tidak Cocok
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
        manualReason: `Kode unit "${lineRawCode}" ditemukan, namun tidak ada unit yang cocok di daftar armada. Otomatis masuk ke sampah / pilah manual agar bisa diedit kembali.`,
      });
    } else {
      // BARIS DENGAN FORMAT BERBEDA DARI CONTOH (DT 90) ATAU TANPA KODE DT
      manualItems.push({
        id: `manual-nocode-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawIndex: idx,
        rawText: line,
        date,
        truckId: '',
        truckCode: 'Tanpa Kode DT',
        category,
        description: cleanDesc,
        amount,
        vendor,
        invoiceNumber,
        isValid: false,
        needsManualReview: true,
        manualReason: 'Format berbeda dengan contoh (DT 90). Otomatis dibuang ke sampah / pilah manual agar bisa diedit kembali.',
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
 */
function extractAmountFromText(line: string): number {
  // 1. Million multiplier: 1.5jt, 1,5 juta
  const jtMatch = line.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:jt|juta)\b/i);
  if (jtMatch) {
    const n = parseFloat(jtMatch[1].replace(',', '.'));
    if (!isNaN(n) && n > 0) return Math.round(n * 1000000);
  }

  // 2. Thousand multiplier: 450rb, 150k, 500 ribu
  const rbMatch = line.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:rb|k|ribu)\b/i);
  if (rbMatch) {
    const n = parseFloat(rbMatch[1].replace(',', '.'));
    if (!isNaN(n) && n > 0) return Math.round(n * 1000);
  }

  // 3. Currency prefix: Rp 850.000 or IDR 850,000
  const rpMatch = line.match(/(?:rp\.?|idr)\s*([0-9.,]+)/i);
  if (rpMatch) {
    const n = parseAmount(rpMatch[1]);
    if (n > 0) return n;
  }

  // 4. Standard Indonesian formatted thousand: 850.000 or 1.250.000
  const dotPattern = /\b([0-9]{1,3}(?:\.[0-9]{3})+)\b/;
  const dotMatch = line.match(dotPattern);
  if (dotMatch) {
    const n = parseAmount(dotMatch[1]);
    if (n > 0) return n;
  }

  // 5. Bare digits >= 1000 (e.g. 500000, 850000)
  const bareMatch = line.match(/\b([0-9]{4,9})\b/);
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
    // Remove explicit unit prefixes like "(DT 90)", "DT 90:", "dt 90 -", "[DT 90]"
    .replace(/(?:\(?\s*dt\s*\)?)[\s._-]*[0-9]{1,4}[:\s\-]*/i, '')
    // Remove amount patterns
    .replace(/(?:rp\.?|idr)\s*[0-9.,]+(?:\s*(?:jt|juta|rb|k|ribu))?/gi, '')
    .replace(/[0-9]+(?:[.,][0-9]+)?\s*(?:jt|juta|rb|k|ribu)\b/gi, '')
    .replace(/\b[0-9]{1,3}(?:\.[0-9]{3})+\b/g, '')
    // Clean multiple spaces and dashes
    .replace(/[:\-–—\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3) {
    switch (category) {
      case 'Minyak':
        return 'Pengisian BioSolar TBS';
      case 'Sparepart':
        return 'Penggantian Sparepart Unit';
      case 'Mekanik':
        return 'Jasa Servis & Mekanik';
      case 'Oli':
        return 'Penggantian Oli & Pelumas';
      case 'Supir':
        return 'Upah Ritase & Uang Jalan Supir';
      case 'Tunjangan BPJS':
        return 'Tunjangan BPJS Ketenagakerjaan / Kesehatan';
      case 'Tunjangan Jamsostek':
        return 'Tunjangan Premi Asuransi Jamsostek Supir';
      case 'Potongan Mangkir':
        return 'Potongan Mangkir / Absensi Supir';
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
    case 'Minyak':
      return 'SPBU Mitra Kebun TBS';
    case 'Oli':
      return 'Toko Oli & Pelumas Nusantara';
    case 'Mekanik':
      return 'Bengkel Servis Berkah Truk';
    case 'Supir':
      return 'Kasbon Operasional Kasir Kebun';
    case 'Tunjangan BPJS':
      return 'BPJS Ketenagakerjaan KC Rokan Hulu';
    case 'Tunjangan Jamsostek':
      return 'Jamsostek Tenaga Kerja Sawit';
    case 'Potongan Mangkir':
      return 'Bagian Personalia & Kasir Kebun';
    case 'Sparepart':
    default:
      return 'Toko Sparepart Mitra Mandiri';
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
