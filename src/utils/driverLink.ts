import { TruckUnit } from '../types/truck';

export const PUBLIC_VERCEL_URL = 'https://biaya-three.vercel.app';
const CUSTOM_BASE_URL_STORAGE_KEY = 'traksi_kpu_public_base_url';

/**
 * Returns the shareable public base URL for links sent to Drivers & Pemuat.
 * - Inside AI Studio's private dev preview (`ais-dev-*.run.app`), opening `ais-dev-` in an external
 *   browser or WhatsApp causes a 403/Error because `ais-dev-` only works inside the AI Studio iframe.
 * - Therefore, when running on `ais-dev-*.run.app` or `ais-pre-*.run.app`, we default to the
 *   public production domain (`https://biaya-three.vercel.app`) or user-selected base URL,
 *   while on any deployed domain we use `window.location.origin`.
 */
export function getShareableBaseUrl(overrideOrigin?: string): string {
  if (overrideOrigin && overrideOrigin.trim()) {
    return overrideOrigin.trim().replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') {
    return PUBLIC_VERCEL_URL;
  }

  try {
    const savedCustom = window.localStorage?.getItem(CUSTOM_BASE_URL_STORAGE_KEY);
    if (savedCustom && savedCustom.trim().startsWith('http')) {
      return savedCustom.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore storage errors
  }

  const origin = window.location.origin || '';
  const hostname = window.location.hostname || '';

  // If running inside AI Studio preview container (ais-dev-*), convert or use public domain
  // so links shared to WhatsApp / external mobile browsers never hit 403 Forbidden.
  if (!origin || origin === 'null' || hostname.startsWith('ais-dev-')) {
    return PUBLIC_VERCEL_URL;
  }

  const pathname = (window.location.pathname || '/').replace(/\/index\.html$/i, '').replace(/\/+$/, '');
  return `${origin}${pathname}`;
}

export function getAvailableBaseUrls(): Array<{ label: string; url: string }> {
  const list: Array<{ label: string; url: string }> = [
    { label: 'Web Utama (biaya-three.vercel.app)', url: PUBLIC_VERCEL_URL },
  ];

  if (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') {
    const origin = window.location.origin.replace(/\/+$/, '');
    const sharedOrigin = origin.replace('://ais-dev-', '://ais-pre-');
    if (sharedOrigin !== PUBLIC_VERCEL_URL) {
      list.push({ label: 'Server Preview (Shared App URL)', url: sharedOrigin });
    }
    if (origin !== sharedOrigin && origin !== PUBLIC_VERCEL_URL) {
      list.push({ label: 'Domain Saat Ini', url: origin });
    }
  }

  return list;
}

export function setPreferredBaseUrl(url: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (!url || !url.trim()) {
        window.localStorage.removeItem(CUSTOM_BASE_URL_STORAGE_KEY);
      } else {
        window.localStorage.setItem(CUSTOM_BASE_URL_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function getPreferredBaseUrl(): string {
  return getShareableBaseUrl();
}

/**
 * Safely updates browser URL bar query string without throwing SecurityError in sandboxed iframes.
 */
export function safeUpdateBrowserUrl(relativeQueryOrPath: string, replace = false): void {
  if (typeof window === 'undefined') return;
  try {
    const basePath = window.location.pathname || '/';
    const cleanQuery = relativeQueryOrPath.startsWith('?')
      ? `${basePath}${relativeQueryOrPath}`
      : relativeQueryOrPath.startsWith('/')
      ? relativeQueryOrPath
      : `${basePath}`;

    if (replace && window.history?.replaceState) {
      window.history.replaceState({ path: cleanQuery }, '', cleanQuery);
    } else if (window.history?.pushState) {
      window.history.pushState({ path: cleanQuery }, '', cleanQuery);
    }
  } catch (err) {
    console.warn('Ignored history state update in restricted iframe:', err);
  }
}

/**
 * Reliable clipboard copy helper that works both in standard browsers and cross-origin iframes.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Clipboard API first
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to textarea execCommand below if blocked by iframe policy
    }
  }

  // 2. Fallback for iframes and older mobile browsers
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.warn('Fallback clipboard copy failed:', err);
    }
  }

  return false;
}

/**
 * Builds the direct, dedicated link for a driver to view only their DT.
 * Uses strictly alphanumeric `dt` parameter (stripping spaces and parentheses like `(WE)`)
 * so WhatsApp and mobile browsers never break the hyperlink.
 */
export function getDriverPortalUrl(
  truck: { id: string; code: string; plateNumber?: string },
  baseOriginOverride?: string
): string {
  // Strip spaces, parentheses, and symbols so WhatsApp link parser never truncates the URL
  const cleanCode = String(truck.code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanId = String(truck.id || '').trim();
  const queryPart = cleanCode
    ? `?dt=${encodeURIComponent(cleanCode)}&id=${encodeURIComponent(cleanId)}`
    : `?id=${encodeURIComponent(cleanId)}`;

  const baseUrl = getShareableBaseUrl(baseOriginOverride).replace(/\/+$/, '');
  return `${baseUrl}/${queryPart}`;
}

/**
 * Clean Indonesian phone number into WhatsApp international format.
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

  const message = `Halo Pak *${truck.driverName || 'Supir'}*,\n\nBerikut link khusus untuk melihat data operasional & pengeluaran unit Anda (*${truck.code} - ${truck.plateNumber}*):\n\n${url}\n\n📱 *Catatan Penting:*\n• Link ini khusus untuk unit Anda saja dan terkunci aman.\n• Silakan klik link di atas untuk membuka langsung di HP Anda.`;

  const encodedMessage = encodeURIComponent(message);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}

/**
 * Helper to extract prefix (DT, EX, MB, GD) and numeric part from a unit code string.
 */
function parseUnitPrefixAndNumber(raw: string): { prefix: string; num: number | null } {
  const upper = String(raw || '').toUpperCase();
  // Look for explicit unit prefixes first: DT, EX, MB, GD, UNIT
  const prefixMatch = upper.match(/(DT|EX|MB|GD|UNIT)\s*[-_]?\s*0*(\d+)/i);
  if (prefixMatch) {
    const normPrefix = prefixMatch[1].toUpperCase() === 'UNIT' ? 'DT' : prefixMatch[1].toUpperCase();
    const num = parseInt(prefixMatch[2], 10);
    return { prefix: normPrefix, num: isNaN(num) ? null : num };
  }

  const digitsMatch = upper.match(/0*(\d+)/);
  const lettersMatch = upper.match(/^[A-Z]+/);
  return {
    prefix: lettersMatch ? (lettersMatch[0] === 'UNIT' ? 'DT' : lettersMatch[0]) : '',
    num: digitsMatch ? parseInt(digitsMatch[1], 10) : null,
  };
}

/**
 * Builds a clean fallback TruckUnit from a URL query so DriverPortalView can render immediately
 * without waiting on a dark loading screen while Firestore connects.
 */
export function buildVirtualTruckFromQuery(queryString: string): TruckUnit | null {
  if (!queryString || queryString === 'PILIH_UNIT') return null;

  let clean = String(queryString || '').trim();
  try {
    clean = decodeURIComponent(clean.replace(/\+/g, ' ')).trim();
  } catch {
    clean = String(queryString || '').trim();
  }

  if (!clean) return null;

  const parsed = parseUnitPrefixAndNumber(clean);
  let formattedCode = clean.toUpperCase();
  if (parsed.prefix && parsed.num !== null) {
    const numStr = parsed.prefix === 'GD' && parsed.num < 10 ? `0${parsed.num}` : String(parsed.num);
    const hasWe = /WE$/i.test(clean.replace(/[^a-zA-Z0-9]/g, ''));
    formattedCode = `${parsed.prefix} ${numStr}${hasWe ? ' (WE)' : ''}`;
  }

  let explicitId = '';
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      explicitId = (urlParams.get('id') || urlParams.get('truckId') || '').trim();
    } catch {
      // ignore
    }
  }

  return {
    id: explicitId || clean,
    code: formattedCode,
    plateNumber: 'Unit Armada TBS',
    driverName: `Supir ${formattedCode}`,
    model: 'Armada Operasional TBS',
    capacity: '8.5 Ton TBS',
    status: 'Aktif',
    year: 2024,
  };
}

/**
 * Robust search to find a truck from ANY URL query parameter, hash, or input value.
 */
export function findTruckFromUrlQuery(trucks: TruckUnit[], queryString: string): TruckUnit | null {
  if (!trucks || trucks.length === 0) return null;

  // Also check if browser location currently has an explicit `id` param that matches
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const idParam = urlParams.get('id') || urlParams.get('truckId');
      if (idParam) {
        const cleanIdParam = decodeURIComponent(idParam).trim().toLowerCase();
        const exactByIdParam = trucks.find((t) => String(t.id || '').toLowerCase() === cleanIdParam);
        if (exactByIdParam) return exactByIdParam;
      }
    } catch {
      // ignore
    }
  }

  if (!queryString || queryString === 'PILIH_UNIT') return null;

  // 1. Decode safely
  let clean = String(queryString || '').trim();
  try {
    clean = decodeURIComponent(clean.replace(/\+/g, ' ')).trim();
  } catch {
    clean = String(queryString || '').trim();
  }

  const cleanLower = clean.toLowerCase();
  const cleanAlphanum = cleanLower.replace(/[^a-z0-9]/g, '');

  if (!cleanAlphanum && !cleanLower) return null;

  // 2. Exact ID match (case-insensitive)
  const matchId = trucks.find((t) => {
    const tId = String(t.id || '').toLowerCase();
    return tId === cleanLower || tId === cleanAlphanum;
  });
  if (matchId) return matchId;

  // 3. Exact code match (e.g. "DT 90", "DT 38 (WE)")
  const matchCode = trucks.find((t) => String(t.code || '').toLowerCase().trim() === cleanLower);
  if (matchCode) return matchCode;

  // 4. Normalized alphanumeric code match (e.g. "DT38WE" matches "DT 38 (WE)")
  const matchCodeNormalized = trucks.find((t) => {
    const tCode = String(t.code || '');
    const tCodeAlphanum = tCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tCodeAlphanum && tCodeAlphanum === cleanAlphanum) return true;

    // Strip parenthetical suffix like (WE) from truck code and compare
    const tWithoutParens = tCode.replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const qWithoutParens = clean.replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tWithoutParens && tWithoutParens === qWithoutParens) return true;

    return false;
  });
  if (matchCodeNormalized) return matchCodeNormalized;

  // 5. Strict Prefix + Number match (e.g. DT 90 vs MB 90 vs EX 46 vs GD 01, or DT 38 matching DT 38 (WE))
  const parsedQuery = parseUnitPrefixAndNumber(clean);
  if (parsedQuery.prefix && parsedQuery.num !== null) {
    const matchPrefixAndNum = trucks.find((t) => {
      const parsedTruck = parseUnitPrefixAndNumber(String(t.code || ''));
      return parsedTruck.prefix === parsedQuery.prefix && parsedTruck.num === parsedQuery.num;
    });
    if (matchPrefixAndNum) return matchPrefixAndNum;
  }

  // 6. Numeric match ONLY when query has no conflicting prefix
  if (!parsedQuery.prefix && parsedQuery.num !== null) {
    const matchNumber = trucks.find((t) => {
      const parsedTruck = parseUnitPrefixAndNumber(String(t.code || ''));
      return parsedTruck.num === parsedQuery.num;
    });
    if (matchNumber) return matchNumber;
  }

  // 7. Plate Number match
  const matchPlate = trucks.find((t) => {
    const tPlateClean = String(t.plateNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tPlateClean && tPlateClean === cleanAlphanum) return true;
    if (cleanAlphanum.length >= 4 && tPlateClean.includes(cleanAlphanum)) return true;
    return false;
  });
  if (matchPlate) return matchPlate;

  // 8. Driver Name match
  if (cleanAlphanum.length >= 3) {
    const matchDriver = trucks.find((t) => {
      const driverClean = String(t.driverName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return driverClean.length >= 3 && (driverClean.includes(cleanAlphanum) || cleanAlphanum.includes(driverClean));
    });
    if (matchDriver) return matchDriver;
  }

  return null;
}

/**
 * Extracts any potential driver portal query from the current browser location.
 * Also detects empty `?dt=` so a driver link never accidentally drops into Admin Beranda.
 */
export function extractDriverQueryFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // Do not trigger driver portal if URL is explicitly for pemuat portal
    const pemuatCheck = extractPemuatPortalFromLocation();
    if (pemuatCheck.isPemuat) return null;

    const search = window.location.search || '';
    const urlParams = new URLSearchParams(search);
    const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = hash.includes('=') ? new URLSearchParams(hash) : null;

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

    // If URL explicitly has `?dt` or `?unit` even with empty value (e.g. `/?dt=`),
    // return a sentinel so it stays locked in Driver Portal selection screen instead of opening Admin Beranda!
    if (urlParams.has('dt') || urlParams.has('unit') || urlParams.has('supir')) {
      return 'PILIH_UNIT';
    }

    // Check hash patterns like #/dt/90 or #dt-90 or #unit90 or #DT90
    if (hash) {
      const cleanHash = hash.replace(/^\/+/, '').toLowerCase();
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
    const hashParams = hash.includes('=') ? new URLSearchParams(hash) : null;
    const pathname = (window.location.pathname || '').toLowerCase();

    const portalParam = (urlParams.get('portal') || hashParams?.get('portal') || '').toLowerCase();
    const modeParam = (urlParams.get('mode') || hashParams?.get('mode') || '').toLowerCase();
    const pemuatParam = urlParams.get('pemuat') ?? hashParams?.get('pemuat') ?? null;
    const namaParam = urlParams.get('nama') || hashParams?.get('nama') || '';
    const isPemuatHash = hash.toLowerCase().includes('pemuat');
    const isPemuatPath = pathname.endsWith('/pemuat') || pathname.includes('/portal-pemuat');

    if (
      portalParam === 'pemuat' ||
      modeParam === 'pemuat' ||
      pemuatParam !== null ||
      isPemuatHash ||
      isPemuatPath
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
export function getPemuatPortalUrl(pemuatName?: string, baseOriginOverride?: string): string {
  const cleanName = pemuatName ? pemuatName.trim() : '';
  const queryPart = cleanName
    ? `?portal=pemuat&nama=${encodeURIComponent(cleanName)}`
    : '?portal=pemuat';

  const baseUrl = getShareableBaseUrl(baseOriginOverride).replace(/\/+$/, '');
  return `${baseUrl}/${queryPart}`;
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
  const message = `${greeting}\n\nBerikut *Link Portal Hasil Muat TBS Traksi KPU* untuk melihat hasil ritase & tonase muatan harian/bulanan Anda:\n\n${url}\n\n📱 *Informasi Portal Pemuat:*\n• Pilih nama Anda di bagian atas untuk melihat hasil muat Anda\n• Mode terkunci & aman (hanya lihat hasil, data tidak dapat diubah)\n• Data terhubung langsung secara real-time`;

  const encodedMessage = encodeURIComponent(message);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}
