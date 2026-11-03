import { TruckUnit } from '../types/truck';

/**
 * Builds the direct, dedicated link for a driver to view only their DT.
 * Standardizes to include both ?dt=... (clean code) and &id=... (truck id)
 * so it resolves reliably in any browser, iframe, or mobile client.
 */
export function getDriverPortalUrl(truck: { id: string; code: string; plateNumber?: string }): string {
  const cleanCode = truck.code.replace(/[\s\-_]+/g, '');
  if (typeof window === 'undefined') {
    return `?dt=${encodeURIComponent(cleanCode)}&id=${encodeURIComponent(truck.id)}`;
  }

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}?dt=${encodeURIComponent(cleanCode)}&id=${encodeURIComponent(truck.id)}`;
}

/**
 * Clean Indonesian phone number into WhatsApp international format.
 * Examples:
 *   "0812-7482-9910" -> "6281274829910"
 *   "+62 813 1234 5678" -> "6281312345678"
 */
export function formatPhoneNumberForWhatsApp(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return '62' + digits.substring(1);
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  return '62' + digits;
}

/**
 * Generates a pre-filled WhatsApp share URL for sending the link to the driver.
 */
export function getWhatsAppShareUrl(truck: TruckUnit, directUrl?: string): string {
  const url = directUrl || getDriverPortalUrl(truck);
  const phone = formatPhoneNumberForWhatsApp(truck.phone);

  const message = `Halo Pak *${truck.driverName}*,\n\nBerikut link khusus untuk melihat data operasional & pengeluaran Dump Truck Anda (*${truck.code} - ${truck.plateNumber}*):\n\n👉 ${url}\n\n📱 *Catatan Penting:*\n• Link ini khusus untuk mobil Anda saja dan tidak menampilkan data mobil armada lainnya.\n• Anda juga bisa menyimpan QR Code atau bookmark link ini di layar utama HP Anda agar mudah dibuka sewaktu-waktu.`;

  const encodedMessage = encodeURIComponent(message);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}

/**
 * Robust search to find a truck from ANY URL query parameter, hash, or input value.
 * Matches:
 *  - Truck ID (e.g. "truck-1", "truck-2")
 *  - Full code (e.g. "Unit 01", "DT 90", "Unit 90")
 *  - Alphanumeric code (e.g. "unit01", "unit90", "dt90", "dt01", "dt-90")
 *  - Numbers/digits (e.g. "90" matches "Unit 90" or "DT 90", "1" or "01" matches "Unit 01")
 *  - Plate number (e.g. "BM 8456 TBS", "BM8456TBS", "8456")
 *  - Driver name (e.g. "Agus", "Budi", "Hendra")
 */
export function findTruckFromUrlQuery(trucks: TruckUnit[], queryString: string): TruckUnit | null {
  if (!queryString || !trucks || trucks.length === 0) return null;

  // 1. Decode safely
  let clean = queryString.trim();
  try {
    clean = decodeURIComponent(clean.replace(/\+/g, ' ')).trim();
  } catch {
    clean = queryString.trim();
  }

  const cleanLower = clean.toLowerCase();
  const cleanAlphanum = cleanLower.replace(/[^a-z0-9]/g, '');

  if (!cleanAlphanum && !cleanLower) return null;

  // 2. Exact ID match (case-insensitive)
  const matchId = trucks.find(
    (t) => t.id.toLowerCase() === cleanLower || t.id.toLowerCase() === cleanAlphanum
  );
  if (matchId) return matchId;

  // 3. Exact code match (e.g. "Unit 01", "DT 90")
  const matchCode = trucks.find((t) => t.code.toLowerCase().trim() === cleanLower);
  if (matchCode) return matchCode;

  // 4. Normalized code match with "dt" and "unit" interchangeability
  const matchCodeNormalized = trucks.find((t) => {
    const tCodeAlphanum = t.code.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tCodeAlphanum === cleanAlphanum) return true;

    // Interchange unit <-> dt
    const tAsDt = tCodeAlphanum.replace(/^unit/, 'dt');
    const paramAsDt = cleanAlphanum.replace(/^unit/, 'dt');
    if (tAsDt === paramAsDt) return true;

    const tAsUnit = tCodeAlphanum.replace(/^dt/, 'unit');
    const paramAsUnit = cleanAlphanum.replace(/^dt/, 'unit');
    if (tAsUnit === paramAsUnit) return true;

    return false;
  });
  if (matchCodeNormalized) return matchCodeNormalized;

  // 5. Numeric sequence match: if query has digits (e.g. "90", "01", "1", "3")
  const queryDigitsMatch = cleanLower.match(/\d+/);
  if (queryDigitsMatch) {
    const queryNum = parseInt(queryDigitsMatch[0], 10);
    if (!isNaN(queryNum)) {
      const matchNumber = trucks.find((t) => {
        const truckDigits = t.code.match(/\d+/);
        if (truckDigits) {
          const tNum = parseInt(truckDigits[0], 10);
          return tNum === queryNum;
        }
        return false;
      });
      if (matchNumber) return matchNumber;
    }
  }

  // 6. Plate Number match
  const matchPlate = trucks.find((t) => {
    const tPlateClean = t.plateNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tPlateClean === cleanAlphanum) return true;
    if (cleanAlphanum.length >= 3 && tPlateClean.includes(cleanAlphanum)) return true;

    // Check 4-digit plate number
    const plateDigits = t.plateNumber.match(/\d+/);
    if (queryDigitsMatch && plateDigits && plateDigits[0] === queryDigitsMatch[0]) return true;
    return false;
  });
  if (matchPlate) return matchPlate;

  // 7. Driver Name match
  const matchDriver = trucks.find((t) => {
    const driverClean = t.driverName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (driverClean.includes(cleanAlphanum) || cleanAlphanum.includes(driverClean)) return true;
    return false;
  });
  if (matchDriver) return matchDriver;

  return null;
}

/**
 * Extracts any potential driver portal query from the current browser location.
 * Looks in search query params (?dt=..., ?id=..., ?unit=..., ?driver=..., etc.)
 * and URL hash (#dt=..., #unit=..., etc.)
 */
export function extractDriverQueryFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = hash ? new URLSearchParams(hash) : null;

    // Direct priority params
    const candidates = [
      urlParams.get('dt'),
      urlParams.get('id'),
      urlParams.get('unit'),
      urlParams.get('driver'),
      urlParams.get('supir'),
      urlParams.get('truck'),
      urlParams.get('truckId'),
      urlParams.get('mobil'),
      hashParams?.get('dt'),
      hashParams?.get('id'),
      hashParams?.get('unit'),
      hashParams?.get('driver'),
      hashParams?.get('supir'),
    ];

    for (const val of candidates) {
      if (val && val.trim().length > 0) {
        return val.trim();
      }
    }

    // Check hash patterns like #/dt/90 or #dt-90 or #unit90 or #DT90
    if (hash) {
      const cleanHash = hash.replace(/^\/+/, '');
      if (cleanHash.startsWith('dt-') || cleanHash.startsWith('dt') || cleanHash.startsWith('unit')) {
        return cleanHash;
      }
    }
  } catch (err) {
    console.warn('Failed to extract driver query from location:', err);
  }

  return null;
}

/**
 * Extracts Pemuat Portal mode and optional target pemuat name from current browser URL.
 */
export function extractPemuatPortalFromLocation(): { isPemuat: boolean; pemuatName: string } {
  if (typeof window === 'undefined') {
    return { isPemuat: false, pemuatName: '' };
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = hash ? new URLSearchParams(hash) : null;

    const portalParam = (urlParams.get('portal') || hashParams?.get('portal') || '').toLowerCase();
    const modeParam = (urlParams.get('mode') || hashParams?.get('mode') || '').toLowerCase();
    const pemuatParam = urlParams.get('pemuat') ?? hashParams?.get('pemuat') ?? null;
    const namaParam = urlParams.get('nama') || hashParams?.get('nama') || '';
    const isPemuatHash = hash.toLowerCase().includes('pemuat');

    if (
      portalParam === 'pemuat' ||
      modeParam === 'pemuat' ||
      pemuatParam !== null ||
      isPemuatHash
    ) {
      const rawName =
        namaParam ||
        (pemuatParam && pemuatParam !== 'true' && pemuatParam !== '1' ? pemuatParam : '');
      let decodedName = rawName.trim();
      try {
        decodedName = decodeURIComponent(decodedName.replace(/\+/g, ' ')).trim();
      } catch {
        // ignore decode error
      }
      return { isPemuat: true, pemuatName: decodedName };
    }
  } catch (err) {
    console.warn('Failed to extract pemuat portal from location:', err);
  }

  return { isPemuat: false, pemuatName: '' };
}

/**
 * Builds the direct, dedicated link for a Loader / Pemuat to access the isolated daily records portal.
 * Uses query parameter `portal=pemuat` (and optional `nama=...`).
 */
export function getPemuatPortalUrl(pemuatName?: string): string {
  if (typeof window === 'undefined') {
    return pemuatName && pemuatName.trim()
      ? `?portal=pemuat&nama=${encodeURIComponent(pemuatName.trim())}`
      : '?portal=pemuat';
  }
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  if (pemuatName && pemuatName.trim()) {
    return `${origin}${pathname}?portal=pemuat&nama=${encodeURIComponent(pemuatName.trim())}`;
  }
  return `${origin}${pathname}?portal=pemuat`;
}

/**
 * Generates a pre-filled WhatsApp share URL for sending the isolated portal link to a loader.
 */
export function getWhatsAppSharePemuatUrl(options?: {
  pemuatName?: string;
  phone?: string;
  directUrl?: string;
}): string {
  const pemuatName = options?.pemuatName?.trim();
  const url = options?.directUrl || getPemuatPortalUrl(pemuatName);
  const phone = formatPhoneNumberForWhatsApp(options?.phone);

  const greeting = pemuatName ? `Halo *${pemuatName}*,` : 'Halo Rekan Pemuat TBS Traksi KPU,';
  const message = `${greeting}\n\nBerikut *Link Portal Hasil Muat TBS Traksi KPU* untuk melihat hasil ritase & tonase muatan harian/bulanan Anda:\n\n👉 ${url}\n\n📱 *Informasi Portal Pemuat:*\n• Tampilan khusus pemuat (mudah melihat hasil tonase & urutan rit per afdeling)\n• Mode terkunci & aman (data tidak dapat diubah sembarangan)\n• Data terhubung langsung secara real-time\n\n_Silakan simpan link ini di WhatsApp atau tambahkan ke Layar Utama HP Anda._`;

  const encodedMessage = encodeURIComponent(message);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}
