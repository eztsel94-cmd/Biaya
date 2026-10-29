import * as XLSX from 'xlsx';
import { ExpenseCategory, TruckUnit } from '../types/truck';
import { CATEGORIES } from '../data/initialData';

export interface ParsedExpenseItem {
  id: string;
  rawIndex: number;
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
 * Supports 5 core categories: Sparepart, Oli, Minyak (Solar), Mekanik, Supir
 */
export function detectCategory(text: string): ExpenseCategory {
  if (!text) return 'Sparepart';
  const lower = text.toLowerCase().trim();

  // 1. Minyak / BBM / Solar
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
 * Intelligent Truck matching
 * Matches "DT 90", "Unit 90", "90", "DT-90", "DT 01", "BM 8456 TBS", or driver name
 */
export function matchTruck(text: string, trucks: TruckUnit[]): TruckUnit | null {
  if (!text || trucks.length === 0) return null;
  const clean = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Direct ID match
  const byId = trucks.find((t) => t.id.toLowerCase() === clean);
  if (byId) return byId;

  // 2. Exact or clean code match ("unit01", "unit90", "dt01", "dt90", "90", "01")
  for (const truck of trucks) {
    const truckCodeClean = truck.code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const numOnly = truck.code.replace(/[^0-9]/g, '');

    if (truckCodeClean === clean) return truck;
    if (numOnly && clean === numOnly) return truck;
    if (clean === `dt${numOnly}` || clean === `unit${numOnly}`) return truck;
    if (clean === `dumptruck${numOnly}` || clean === `dtruck${numOnly}`) return truck;
  }

  // 3. Plate number match (e.g. "BM 8456 TBS" -> "bm8456tbs" or "8456")
  for (const truck of trucks) {
    const plateClean = truck.plateNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    const plateNumOnly = truck.plateNumber.replace(/[^0-9]/g, '');

    if (clean.includes(plateClean) || plateClean.includes(clean)) return truck;
    if (plateNumOnly && clean.includes(plateNumOnly)) return truck;
  }

  // 4. Regex word boundary match for Unit / DT numbers (e.g. "DT 90" or "Unit 90" or "DT-90" inside longer text)
  for (const truck of trucks) {
    const numOnly = truck.code.replace(/[^0-9]/g, '');
    if (numOnly) {
      // Regex pattern: matches "dt 90", "unit 90", "dt-90", "dt90", "unit-90", "#90"
      const unitPattern = new RegExp(`(?:\\b|\\s|_|-)(?:dt|unit|dump\\s*truck|truk|armada)[\\s-_]*0?${numOnly}\\b`, 'i');
      if (unitPattern.test(text)) {
        return truck;
      }
      // Also match standalone isolated number if prefixed by # or bounded
      const isolatedPattern = new RegExp(`(?:#|no\\.?\\s*)0?${numOnly}\\b`, 'i');
      if (isolatedPattern.test(text)) {
        return truck;
      }
    }
  }

  // 5. Driver name match
  for (const truck of trucks) {
    const driverClean = truck.driverName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (driverClean && (clean.includes(driverClean) || driverClean.includes(clean))) {
      return truck;
    }
  }

  return null;
}

/**
 * Extract Unit code pattern from text even if not yet in database
 * e.g. "DT 90", "DT 15", "Unit 04"
 */
export function extractRawUnitCode(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(?:dt|unit|dump\s*truck|armada)[-\s]*([0-9]{1,3}[a-zA-Z]?)/i);
  if (match) {
    const num = match[1].trim();
    return `DT ${num.padStart(2, '0')}`;
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

/**
 * Freeform Natural Language Note Parser
 * Parses WhatsApp messages, casual notes, unstructured text, bullet points.
 * Context-aware: when a unit (like "DT 90" or "Unit 90") is detected in a line or header,
 * all subsequent items belong to that unit until another unit is mentioned!
 */
export function parseFreeformNotes(
  text: string,
  trucks: TruckUnit[],
  defaultTruckId?: string
): {
  items: ParsedExpenseItem[];
  detectedUnits: string[];
  unmatchedUnits: string[];
} {
  if (!text || !text.trim()) {
    return { items: [], detectedUnits: [], unmatchedUnits: [] };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const items: ParsedExpenseItem[] = [];
  const detectedUnitsSet = new Set<string>();
  const unmatchedUnitsSet = new Set<string>();

  let activeTruck: TruckUnit | null =
    (defaultTruckId ? trucks.find((t) => t.id === defaultTruckId) : null) || null;
  let activeRawUnitCode: string | null = null;
  const todayStr = new Date().toISOString().split('T')[0];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Check if line is a unit header, e.g.:
    // "DT 90", "DT 90:", "[DT 90]", "Unit 90", "Dump Truck 90", "=== DT 01 ==="
    const lineMatchedTruck = matchTruck(line, trucks);
    const rawUnitFound = extractRawUnitCode(line);

    // Check if line contains an amount
    const amountInLine = extractAmountFromText(line);

    // If line is strictly or primarily a unit header without expenses:
    const isPureHeader =
      Boolean(lineMatchedTruck || rawUnitFound) &&
      amountInLine <= 0 &&
      line.length < 50;

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

    // If line has an expense, check if it specifies a truck locally:
    let lineTruck = activeTruck;
    let lineRawCode = activeRawUnitCode;

    if (lineMatchedTruck) {
      lineTruck = lineMatchedTruck;
      activeTruck = lineMatchedTruck; // update context as well
      activeRawUnitCode = null;
      detectedUnitsSet.add(lineMatchedTruck.code);
    } else if (rawUnitFound && !activeTruck) {
      lineRawCode = rawUnitFound;
      unmatchedUnitsSet.add(rawUnitFound);
    }

    // If still no truck and we have a defaultTruckId, assign it
    if (!lineTruck && defaultTruckId) {
      lineTruck = trucks.find((t) => t.id === defaultTruckId) || null;
    }
    // If still no truck and trucks exist, default to first truck as fallback
    if (!lineTruck && trucks.length > 0 && !lineRawCode) {
      lineTruck = trucks[0];
    }

    const amount = amountInLine;
    if (amount <= 0) {
      // Line doesn't look like an expense record, skip
      continue;
    }

    const category = detectCategory(line);
    const date = extractDateFromText(line) || todayStr;

    // Clean description: strip amount substrings, unit markers, leading bullets
    const cleanDesc = cleanExpenseDescription(line, category);

    // Vendor estimation based on category
    let vendor = extractVendorFromText(line, category);

    // Invoice number if present
    const invoiceMatch = line.match(/(?:inv|nota|kwitansi|faktur|no\.?|struk)[-:\s#]*([a-zA-Z0-9\/-]+)/i);
    const invoiceNumber = invoiceMatch ? invoiceMatch[1].trim() : undefined;

    const isValid = amount > 0 && Boolean(lineTruck);
    const validationError =
      amount <= 0
        ? 'Nominal biaya tidak valid'
        : !lineTruck
        ? `Unit ${lineRawCode || 'DT'} belum terdaftar di database`
        : undefined;

    items.push({
      id: `freeform-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rawIndex: idx,
      date,
      truckId: lineTruck?.id || '',
      truckCode: lineTruck?.code || lineRawCode || 'DT Belum Dikenali',
      unrecognizedUnitCode: !lineTruck && lineRawCode ? lineRawCode : undefined,
      category,
      description: cleanDesc,
      amount,
      vendor,
      invoiceNumber,
      isValid,
      validationError,
    });
  }

  return {
    items,
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
    // Remove explicit unit prefixes like "DT 90:", "Unit 90 -", "[DT 90]"
    .replace(/(?:dt|unit|dump\s*truck)[-\s]*[0-9]{1,3}[:\s\-]*/i, '')
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
export function processRawRows(
  rows: any[][],
  trucks: TruckUnit[],
  defaultTruckId?: string
): { items: ParsedExpenseItem[]; detectedHeaders: string[] } {
  if (!rows || rows.length === 0) {
    return { items: [], detectedHeaders: [] };
  }

  const cleanRows = rows.filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));
  if (cleanRows.length === 0) {
    return { items: [], detectedHeaders: [] };
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
    if (!matchedTruck && defaultTruckId) {
      matchedTruck = trucks.find((t) => t.id === defaultTruckId) || null;
    }
    if (!matchedTruck && rawDesc) {
      matchedTruck = matchTruck(rawDesc, trucks);
    }
    if (!matchedTruck && trucks.length > 0) {
      matchedTruck = trucks[0];
    }

    let category: ExpenseCategory = 'Sparepart';
    if (rawCategory) {
      category = detectCategory(rawCategory);
    } else if (rawDesc) {
      category = detectCategory(rawDesc);
    } else if (rawVendor) {
      category = detectCategory(rawVendor);
    }

    const description = rawDesc.trim() || `Pengeluaran ${category} ${matchedTruck?.code || 'Unit'}`;
    let vendor = rawVendor.trim();
    if (!vendor) {
      vendor = extractVendorFromText(rawDesc || category, category);
    }

    const date = parseDate(rawDate);
    const isValid = amount > 0 && Boolean(matchedTruck);
    const validationError =
      amount <= 0
        ? 'Nominal biaya tidak valid (0 atau kosong)'
        : !matchedTruck
        ? 'Unit DT tidak dikenali'
        : undefined;

    items.push({
      id: `parsed-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rawIndex: r,
      date,
      truckId: matchedTruck?.id || trucks[0]?.id || '',
      truckCode: matchedTruck?.code || 'Unit Truk',
      category,
      description,
      amount,
      vendor,
      invoiceNumber: rawInvoice.trim() || undefined,
      isValid,
      validationError,
    });
  }

  return { items, detectedHeaders };
}

/**
 * Parse clipboard text pasted from Excel (TSV or CSV)
 */
export function parsePastedExcelText(
  text: string,
  trucks: TruckUnit[],
  defaultTruckId?: string
): { items: ParsedExpenseItem[]; detectedHeaders: string[] } {
  if (!text || !text.trim()) {
    return { items: [], detectedHeaders: [] };
  }

  // If text doesn't contain tabs or semicolons, but has newline with freeform content,
  // route through the intelligent natural language note parser!
  const hasTabs = text.includes('\t');
  const hasSemicolons = text.includes(';');

  if (!hasTabs && !hasSemicolons) {
    const freeformResult = parseFreeformNotes(text, trucks, defaultTruckId);
    if (freeformResult.items.length > 0) {
      return { items: freeformResult.items, detectedHeaders: ['Teks Catatan Bebas'] };
    }
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

  return processRawRows(rows, trucks, defaultTruckId);
}

/**
 * Parse uploaded Excel file buffer
 */
export async function parseExcelFile(
  file: File,
  trucks: TruckUnit[],
  defaultTruckId?: string
): Promise<{ items: ParsedExpenseItem[]; detectedHeaders: string[]; sheetNames: string[] }> {
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

        const { items, detectedHeaders } = processRawRows(rawRows, trucks, defaultTruckId);
        resolve({ items, detectedHeaders, sheetNames });
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
