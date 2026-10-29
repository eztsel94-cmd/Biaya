import { TruckUnit } from '../types/truck';

/**
 * Builds the direct, dedicated link for a driver to view only their DT.
 * Uses query parameter `dt` with the truck's unique identifier.
 */
export function getDriverPortalUrl(truck: { id: string; code: string }): string {
  if (typeof window === 'undefined') return `?dt=${encodeURIComponent(truck.id)}`;
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}?dt=${encodeURIComponent(truck.id)}`;
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

  const message = `Halo Pak *${truck.driverName}*,\n\nBerikut link khusus untuk melihat data operasional & pengeluaran Dump Truck Anda (*${truck.code} - ${truck.plateNumber}*):\n\n👉 ${url}\n\n_Catatan: Link ini khusus untuk mobil Anda saja dan tidak menampilkan data mobil armada lainnya. Simpan link ini di WhatsApp atau bookmark di HP Anda._`;

  const encodedMessage = encodeURIComponent(message);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}

/**
 * Searches trucks for a match based on URL query parameter `dt` or `unit`.
 */
export function findTruckFromUrlQuery(trucks: TruckUnit[], queryString: string): TruckUnit | null {
  if (!queryString || !trucks || trucks.length === 0) return null;

  const clean = queryString.trim().toLowerCase();
  const cleanNoSpace = clean.replace(/[\s\-_]+/g, '');

  // 1. Exact ID match
  const matchId = trucks.find((t) => t.id.toLowerCase() === clean);
  if (matchId) return matchId;

  // 2. Exact code match (e.g. "Unit 01", "DT 01", "unit 90")
  const matchCode = trucks.find((t) => t.code.toLowerCase() === clean);
  if (matchCode) return matchCode;

  // 3. Normalized code match (e.g. "unit01", "dt01", "unit90", "dt90", "unit-01", "dt-01")
  const matchCodeNormalized = trucks.find((t) => {
    const tCodeClean = t.code.toLowerCase().replace(/[\s\-_]+/g, '');
    const tPlateClean = t.plateNumber.toLowerCase().replace(/[\s\-_]+/g, '');

    // Allow dt01 matching unit01
    const tDtClean = tCodeClean.replace('unit', 'dt');
    const paramDtClean = cleanNoSpace.replace('unit', 'dt');

    return (
      tCodeClean === cleanNoSpace ||
      tDtClean === paramDtClean ||
      tPlateClean === cleanNoSpace ||
      tPlateClean.includes(cleanNoSpace)
    );
  });

  return matchCodeNormalized || null;
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

  const greeting = pemuatName ? `Halo Pak *${pemuatName}*,` : 'Halo Rekan Pemuat TBS Kebun,';
  const message = `${greeting}\n\nBerikut *Link Khusus Riwayat & Input Catatan Harian Truk TBS* untuk akses di lapangan:\n\n👉 ${url}\n\n📱 *Keunggulan Link Khusus Pemuat:*\n• Langsung terbuka di HP tanpa perlu login/password rumit\n• Terisolasi khusus untuk catatan rit & tonase TBS harian\n• Data tersambung langsung secara real-time ke sistem Firebase traksi\n\n_Silakan simpan link ini di WhatsApp Anda atau pasang bookmark di layar HP._`;

  const encodedMessage = encodeURIComponent(message);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}

