import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { TruckUnit, ExpenseRecord, AppUser } from "../types/truck";
import { DailyRecord, NewDailyRecord } from "../types/dailyRecord";
import { INITIAL_TRUCKS, INITIAL_EXPENSES } from "../data/initialData";

// Konfigurasi Firebase Firestore Default Sistem
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAzsjVewayOI1aq6uT82_PtulfmUc8Fk_M",
  authDomain: "traksi-22f5b.firebaseapp.com",
  projectId: "traksi-22f5b",
  storageBucket: "traksi-22f5b.firebasestorage.app",
  messagingSenderId: "900195003298",
  appId: "1:900195003298:web:c0496441e87a4b420320fb",
  measurementId: "G-2Y41RYMQDM",
};

export const STORAGE_KEY_FIREBASE = "custom_firebase_config";

export function getCustomFirebaseConfig(): any | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_FIREBASE) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.projectId && parsed.apiKey) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCustomFirebaseConfig(config: any): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_FIREBASE, JSON.stringify(config));
  }
}

export function resetToDefaultFirebaseConfig(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY_FIREBASE);
  }
}

export function isUsingCustomFirebase(): boolean {
  return Boolean(getCustomFirebaseConfig());
}

export function getCurrentFirebaseConfig(): any {
  return getCustomFirebaseConfig() || DEFAULT_FIREBASE_CONFIG;
}

export async function testFirebaseConnection(configToTest?: any): Promise<{ success: boolean; message: string; projectId: string }> {
  const targetConfig = configToTest || getCurrentFirebaseConfig();
  if (!targetConfig?.apiKey || !targetConfig?.projectId) {
    return { success: false, message: "Konfigurasi tidak lengkap (ApiKey & ProjectId wajib diisi)", projectId: "" };
  }

  const testAppName = `test-app-${Date.now()}`;
  try {
    const testApp = initializeApp(targetConfig, testAppName);
    const testDb = getFirestore(testApp);
    const testCol = collection(testDb, "_connection_probe_");
    const testQuery = query(testCol, orderBy("__name__"), where("__name__", "==", "probe"));
    await getDocs(testQuery);
    return {
      success: true,
      message: `Berhasil terhubung ke Firebase Firestore proyek "${targetConfig.projectId}"!`,
      projectId: targetConfig.projectId,
    };
  } catch (err: any) {
    if (err?.code === "permission-denied" || err?.message?.includes("insufficient permissions")) {
      return {
        success: true,
        message: `Proyek "${targetConfig.projectId}" terhubung secara sah! Aturan Firestore (Security Rules) saat ini memerlukan permission atau login.`,
        projectId: targetConfig.projectId,
      };
    }
    return {
      success: false,
      message: `Gagal terhubung: ${err?.message || "Periksa kembali Project ID atau API Key"}`,
      projectId: targetConfig.projectId || "",
    };
  }
}

// Inisialisasi Firebase App & Firestore dengan konfigurasi aktif (Kustom atau Default)
const activeFirebaseConfig = getCurrentFirebaseConfig();
export const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);
export const db = getFirestore(app);

// Inisialisasi Auth untuk otentikasi otomatis jika aturan Firestore memerlukan auth
try {
  const auth = getAuth(app);
  signInAnonymously(auth).catch((authErr) => {
    console.info("Anonymous auth status:", authErr?.message || "Not enabled, using open rules");
  });
} catch (e) {
  console.info("Auth init info:", e);
}

// Nama-nama Koleksi Cloud Firestore
export const COLLECTIONS = {
  TRUCKS: "trucks",
  EXPENSES: "expenses",
  DAILY_RECORDS: "catatan_harian_tbs",
  USERS: "system_users",
  PEMUAT: "pemuat_master",
};

// Alias untuk DailyRecordsView
export const COLLECTION_NAME = COLLECTIONS.DAILY_RECORDS;

export const trucksCollection = collection(db, COLLECTIONS.TRUCKS);
export const expensesCollection = collection(db, COLLECTIONS.EXPENSES);
export const dailyRecordsCollection = collection(db, COLLECTIONS.DAILY_RECORDS);
export const usersCollection = collection(db, COLLECTIONS.USERS);
export const pemuatCollection = collection(db, COLLECTIONS.PEMUAT);

// Status error izin akses global (missing permissions)
export let firestorePermissionError: string | null = null;
const permissionListeners: Array<(err: string | null) => void> = [];

export function onPermissionErrorChange(cb: (err: string | null) => void) {
  permissionListeners.push(cb);
  cb(firestorePermissionError);
  return () => {
    const idx = permissionListeners.indexOf(cb);
    if (idx !== -1) permissionListeners.splice(idx, 1);
  };
}

function setPermissionError(err: any) {
  if (err && (err.code === "permission-denied" || err.message?.includes("Missing or insufficient permissions"))) {
    firestorePermissionError =
      "Izin akses Firebase Firestore belum dibuka. Pastikan di Firebase Console -> Firestore Database -> Rules diatur ke: allow read, write: if true;";
  } else if (err) {
    firestorePermissionError = err.message || "Gagal menghubungi database Firestore";
  } else {
    firestorePermissionError = null;
  }
  permissionListeners.forEach((cb) => cb(firestorePermissionError));
}

// ==========================================
// 1. MODUL ARMADA TRUK (onSnapshot Real-time)
// ==========================================

const SAMPLE_TRUCK_IDS = new Set(["truck-1", "truck-2", "truck-3"]);
const SAMPLE_TRUCK_PLATES = new Set(["BM 8120 TBS", "BM 8456 TBS", "BM 9312 TBS"]);

export function subscribeToFirestoreTrucks(
  onData: (trucks: TruckUnit[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(trucksCollection, orderBy("code", "asc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setPermissionError(null);

        const items: TruckUnit[] = [];
        const sampleRefsToDelete: any[] = [];

        snapshot.forEach((docSnapshot) => {
          const d = docSnapshot.data();
          const plate = String(d.plateNumber || "").trim().toUpperCase();
          // Bersihkan otomatis jika masih ada dokumen armada contoh bawaan lama di Firestore
          if (SAMPLE_TRUCK_IDS.has(docSnapshot.id) || SAMPLE_TRUCK_PLATES.has(plate)) {
            sampleRefsToDelete.push(docSnapshot.ref);
            return;
          }

          items.push({
            id: docSnapshot.id,
            code: d.code || "DT -",
            plateNumber: d.plateNumber || "-",
            driverName: d.driverName || "Supir",
            phone: d.phone,
            model: d.model || "Truk Dump TBS",
            capacity: d.capacity || "8.5 Ton TBS",
            status: d.status || "Aktif",
            year: d.year || 2022,
            notes: d.notes,
          });
        });

        if (sampleRefsToDelete.length > 0) {
          const batch = writeBatch(db);
          sampleRefsToDelete.forEach((ref) => batch.delete(ref));
          batch.commit().catch((err) => console.warn("Gagal membersihkan armada contoh lama:", err));
        }

        onData(items);
      },
      (error) => {
        console.error("Firestore subscribeToTrucks error:", error);
        setPermissionError(error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error("subscribeToFirestoreTrucks failed:", err);
    setPermissionError(err);
    if (onError) onError(err);
    return () => {};
  }
}

export async function bootstrapInitialTrucks(): Promise<void> {
  // Dinonaktifkan agar tidak pernah mengisi data contoh otomatis
}

export async function addTruckFirestore(truck: Omit<TruckUnit, "id">): Promise<TruckUnit> {
  const docRef = await addDoc(trucksCollection, {
    code: truck.code.trim().toUpperCase(),
    plateNumber: truck.plateNumber.trim().toUpperCase(),
    driverName: truck.driverName.trim(),
    phone: truck.phone || "",
    model: truck.model || "Truk Dump TBS",
    capacity: truck.capacity || "8.5 Ton TBS",
    status: truck.status || "Aktif",
    year: Number(truck.year) || 2022,
    notes: truck.notes || "",
    createdAt: serverTimestamp(),
  });
  return {
    ...truck,
    id: docRef.id,
  };
}

export async function updateTruckFirestore(truck: TruckUnit): Promise<TruckUnit> {
  const docRef = doc(db, COLLECTIONS.TRUCKS, truck.id);
  await updateDoc(docRef, {
    code: truck.code.trim().toUpperCase(),
    plateNumber: truck.plateNumber.trim().toUpperCase(),
    driverName: truck.driverName.trim(),
    phone: truck.phone || "",
    model: truck.model || "Truk Dump TBS",
    capacity: truck.capacity || "8.5 Ton TBS",
    status: truck.status || "Aktif",
    year: Number(truck.year) || 2022,
    notes: truck.notes || "",
    updatedAt: serverTimestamp(),
  });
  return truck;
}

export async function deleteTruckFirestore(id: string, deleteRelated: boolean): Promise<void> {
  // 1. Hapus dokumen truk dari Firestore
  const docRef = doc(db, COLLECTIONS.TRUCKS, id);
  await deleteDoc(docRef);

  // 2. Jika dipilih, hapus semua pengeluaran terkait unit tersebut dari Firestore
  if (deleteRelated) {
    try {
      const q = query(expensesCollection, where("truckId", "==", id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn("Gagal menghapus catatan biaya terkait truk:", e);
    }
  }
}

// ==========================================
// 2. MODUL BIAYA UNIT (onSnapshot Real-time)
// ==========================================

// Kategori aman untuk kompatibilitas mundur dengan deployment lama (mencegah layar hitam di biaya-three.vercel.app)
const LEGACY_SAFE_CATEGORIES = new Set([
  "Fuel",
  "Lubricant",
  "Sparepart",
  "Workshop",
  "BPJS",
  "Jamsostek",
]);

export function toLegacySafeCategory(cat: ExpenseRecord["category"]): string {
  if (LEGACY_SAFE_CATEGORIES.has(cat)) return cat;
  switch (cat) {
    case "Tyre & Tubes":
      return "Sparepart";
    case "Workshop":
      return "Workshop";
    case "Potongan Mangkir":
      return "BPJS";
    case "Beras":
      return "Jamsostek";
    case "Supir":
      return "BPJS";
    default:
      return "Sparepart";
  }
}

export function normalizeExpenseCategory(raw: any): ExpenseRecord["category"] {
  const val = String(raw || "").trim();
  const lower = val.toLowerCase();
  if (lower === "fuel" || lower === "minyak" || lower === "solar" || lower === "bbm") return "Fuel";
  if (lower === "lubricant" || lower === "oli" || lower === "pelumas") return "Lubricant";
  if (lower === "sparepart" || lower === "spare part") return "Sparepart";
  if (lower === "tyre & tubes" || lower === "tyre & tube" || lower === "ban" || lower === "tyre") return "Tyre & Tubes";
  if (lower === "workshop" || lower === "mekanik" || lower === "bengkel") return "Workshop";
  if (lower === "bpjs" || lower === "tunjangan bpjs") return "BPJS";
  if (lower === "jamsostek" || lower === "tunjangan jamsostek") return "Jamsostek";
  if (lower === "potongan mangkir" || lower === "mangkir") return "Potongan Mangkir";
  if (lower === "beras" || lower === "tunjangan beras" || lower === "catu beras") return "Beras";
  if (lower === "supir" || lower === "sopir" || lower === "driver") return "Supir";
  return "Sparepart";
}

export function subscribeToFirestoreExpenses(
  onData: (expenses: ExpenseRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(expensesCollection, orderBy("date", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setPermissionError(null);

        const items: ExpenseRecord[] = [];
        const sampleRefsToDelete: any[] = [];
        const docsToHealCategory: Array<{ ref: any; safeCat: string; realCat: string }> = [];

        snapshot.forEach((docSnapshot) => {
          const d = docSnapshot.data();
          // Bersihkan otomatis jika dokumen adalah data contoh bawaan lama (exp-01 s/d exp-22 atau milik truck-1..3)
          if (
            /^exp-\d+$/.test(docSnapshot.id) ||
            SAMPLE_TRUCK_IDS.has(String(d.truckId || "")) ||
            d.createdByName === "Sistem Default"
          ) {
            sampleRefsToDelete.push(docSnapshot.ref);
            return;
          }

          const resolvedCategory = normalizeExpenseCategory(d.realCategory || d.category);
          const safeCategory = toLegacySafeCategory(resolvedCategory);

          // Jika dokumen di Firestore masih menyimpan kategori baru langsung di field `category`,
          // otomatis perbaiki agar aplikasi di domain lama tidak pernah mengalami crash layar hitam
          if (!LEGACY_SAFE_CATEGORIES.has(String(d.category || ""))) {
            docsToHealCategory.push({
              ref: docSnapshot.ref,
              safeCat: safeCategory,
              realCat: resolvedCategory,
            });
          }

          items.push({
            id: docSnapshot.id,
            truckId: String(d.truckId || ""),
            category: resolvedCategory,
            amount: typeof d.amount === "number" ? d.amount : parseFloat(d.amount) || 0,
            date: String(d.date || new Date().toISOString().split("T")[0]),
            description: String(d.description || "-"),
            vendor: String(d.vendor || ""),
            invoiceNumber: d.invoiceNumber ? String(d.invoiceNumber) : undefined,
            createdByName: d.createdByName ? String(d.createdByName) : undefined,
            createdAt: d.createdAt
              ? typeof d.createdAt.toDate === "function"
                ? d.createdAt.toDate().toISOString()
                : String(d.createdAt)
              : new Date().toISOString(),
          });
        });

        if (sampleRefsToDelete.length > 0) {
          const batch = writeBatch(db);
          sampleRefsToDelete.forEach((ref) => batch.delete(ref));
          batch.commit().catch((err) => console.warn("Gagal membersihkan biaya contoh lama:", err));
        }

        if (docsToHealCategory.length > 0) {
          const healBatch = writeBatch(db);
          docsToHealCategory.slice(0, 450).forEach((item) => {
            healBatch.update(item.ref, {
              category: item.safeCat,
              realCategory: item.realCat,
            });
          });
          healBatch.commit().catch((err) => console.warn("Gagal menyelaraskan kompatibilitas kategori:", err));
        }

        onData(items);
      },
      (error) => {
        console.error("Firestore subscribeToExpenses error:", error);
        setPermissionError(error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error("subscribeToFirestoreExpenses failed:", err);
    setPermissionError(err);
    if (onError) onError(err);
    return () => {};
  }
}

export async function bootstrapInitialExpenses(): Promise<void> {
  // Dinonaktifkan agar tidak pernah mengisi data contoh otomatis
}

export async function addExpenseFirestore(
  expense: Omit<ExpenseRecord, "id" | "createdAt">
): Promise<ExpenseRecord> {
  const realCat = normalizeExpenseCategory(expense.category);
  const safeCat = toLegacySafeCategory(realCat);
  const docRef = await addDoc(expensesCollection, {
    truckId: expense.truckId,
    category: safeCat,
    realCategory: realCat,
    amount: Number(expense.amount) || 0,
    date: expense.date,
    description: (expense.description || "-").trim(),
    vendor: (expense.vendor || "Gudang Traksi").trim(),
    invoiceNumber: (expense.invoiceNumber || "").trim(),
    createdByName: expense.createdByName || "Kasir / Admin",
    createdAt: serverTimestamp(),
  });
  return {
    ...expense,
    category: realCat,
    id: docRef.id,
    createdAt: new Date().toISOString(),
  };
}

export async function updateExpenseFirestore(expense: ExpenseRecord): Promise<ExpenseRecord> {
  const realCat = normalizeExpenseCategory(expense.category);
  const safeCat = toLegacySafeCategory(realCat);
  const docRef = doc(db, COLLECTIONS.EXPENSES, expense.id);
  await updateDoc(docRef, {
    truckId: expense.truckId,
    category: safeCat,
    realCategory: realCat,
    amount: Number(expense.amount) || 0,
    date: expense.date,
    description: (expense.description || "-").trim(),
    vendor: (expense.vendor || "Gudang Traksi").trim(),
    invoiceNumber: (expense.invoiceNumber || "").trim(),
    updatedByName: expense.updatedByName || "",
    updatedAt: serverTimestamp(),
  });
  return {
    ...expense,
    category: realCat,
  };
}

export async function deleteExpenseFirestore(id: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.EXPENSES, id);
  await deleteDoc(docRef);
}

export async function addExpensesBatchFirestore(
  items: Omit<ExpenseRecord, "id" | "createdAt">[]
): Promise<ExpenseRecord[]> {
  const batch = writeBatch(db);
  const created: ExpenseRecord[] = [];

  for (const item of items) {
    const newDocRef = doc(expensesCollection);
    const realCat = normalizeExpenseCategory(item.category);
    const safeCat = toLegacySafeCategory(realCat);
    batch.set(newDocRef, {
      truckId: item.truckId,
      category: safeCat,
      realCategory: realCat,
      amount: Number(item.amount) || 0,
      date: item.date,
      description: (item.description || "-").trim(),
      vendor: (item.vendor || "Gudang Traksi").trim(),
      invoiceNumber: (item.invoiceNumber || "").trim(),
      createdByName: item.createdByName || "Impor Excel",
      createdAt: serverTimestamp(),
    });
    created.push({
      ...item,
      category: realCat,
      id: newDocRef.id,
      createdAt: new Date().toISOString(),
    });
  }

  await batch.commit();
  return created;
}

// ==========================================
// 3. MODUL CATATAN HARIAN TBS (onSnapshot)
// ==========================================

export function subscribeToDailyRecords(
  onData: (records: DailyRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(dailyRecordsCollection, orderBy("date", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setPermissionError(null);
        const rawItems: DailyRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          let parsedTonnage: number | null = null;
          if (data.tonnage !== null && data.tonnage !== undefined && data.tonnage !== '') {
            const num = Number(data.tonnage);
            if (!isNaN(num) && num > 0) {
              parsedTonnage = num;
            }
          }

          rawItems.push({
            id: docSnapshot.id,
            date: data.date || new Date().toISOString().split("T")[0],
            truckNumber: data.truckNumber || "DT -",
            driverName: (data.driverName || "").trim(),
            tonnage: parsedTonnage,
            afdeling: (data.afdeling || "Afdeling 1").trim(),
            ritNumber: typeof data.ritNumber === "number" ? data.ritNumber : parseInt(data.ritNumber, 10) || undefined,
            notes: data.notes || "",
            createdAt: data.createdAt,
          });
        });

        // Urutkan nomor Ritase (Rit 1, Rit 2, dst.) secara berurutan per Tanggal & per Afdeling
        const groupMap = new Map<string, DailyRecord[]>();
        rawItems.forEach((item) => {
          const key = `${item.date}__${(item.afdeling || "Afdeling 1").trim().toLowerCase()}`;
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(item);
        });

        const getCreatedMillis = (ts: any): number => {
          if (!ts) return 0;
          if (typeof ts.toMillis === "function") return ts.toMillis();
          if (typeof ts.seconds === "number") return ts.seconds * 1000;
          const parsed = Date.parse(String(ts));
          return isNaN(parsed) ? 0 : parsed;
        };

        const normalizedRitById = new Map<string, number>();
        groupMap.forEach((groupList) => {
          const sorted = [...groupList].sort((a, b) => {
            const timeA = getCreatedMillis(a.createdAt);
            const timeB = getCreatedMillis(b.createdAt);
            if (timeA !== timeB && timeA > 0 && timeB > 0) {
              return timeA - timeB;
            }
            const ritA = a.ritNumber || 9999;
            const ritB = b.ritNumber || 9999;
            if (ritA !== ritB) return ritA - ritB;
            return a.id.localeCompare(b.id);
          });
          sorted.forEach((rec, idx) => {
            normalizedRitById.set(rec.id, idx + 1);
          });
        });

        const items = rawItems.map((item) => ({
          ...item,
          ritNumber: normalizedRitById.get(item.id) ?? item.ritNumber ?? 1,
        }));

        onData(items);
      },
      (error) => {
        console.error("Firebase onSnapshot error:", error);
        setPermissionError(error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error("Gagal menghubungkan onSnapshot:", err);
    setPermissionError(err);
    if (onError) onError(err);
    return () => {};
  }
}

export async function addDailyRecord(record: NewDailyRecord): Promise<string> {
  // Hitung nomor ritase otomatis per afdeling & tanggal jika belum ditentukan
  let calculatedRitNumber = record.ritNumber;
  if (!calculatedRitNumber || calculatedRitNumber <= 0) {
    try {
      const q = query(
        dailyRecordsCollection,
        where("date", "==", record.date),
        where("afdeling", "==", record.afdeling.trim())
      );
      const snap = await getDocs(q);
      calculatedRitNumber = snap.size + 1;
    } catch {
      calculatedRitNumber = 1;
    }
  }

  const hasValidTonnage =
    record.tonnage !== null &&
    record.tonnage !== undefined &&
    String(record.tonnage).trim() !== '' &&
    !isNaN(Number(record.tonnage)) &&
    Number(record.tonnage) > 0;

  const docRef = await addDoc(dailyRecordsCollection, {
    date: record.date,
    truckNumber: (record.truckNumber || '').trim().toUpperCase(),
    driverName: (record.driverName || '').trim(),
    tonnage: hasValidTonnage ? Number(record.tonnage) : null,
    afdeling: (record.afdeling || 'Afdeling 1').trim(),
    ritNumber: Number(calculatedRitNumber),
    notes: (record.notes || '').trim(),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteDailyRecord(id: string): Promise<void> {
  const targetDoc = doc(db, COLLECTIONS.DAILY_RECORDS, id);
  await deleteDoc(targetDoc);
}

export async function deleteAllDailyRecords(targetIds?: string[]): Promise<number> {
  if (targetIds && targetIds.length > 0) {
    const chunkSize = 400;
    let deletedCount = 0;
    for (let i = 0; i < targetIds.length; i += chunkSize) {
      const chunk = targetIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, COLLECTIONS.DAILY_RECORDS, id));
      });
      await batch.commit();
      deletedCount += chunk.length;
    }
    return deletedCount;
  }

  const snap = await getDocs(dailyRecordsCollection);
  if (snap.empty) return 0;

  const docs = snap.docs;
  const chunkSize = 400;
  let deletedCount = 0;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deletedCount += chunk.length;
  }
  return deletedCount;
}

export async function updateDailyRecord(record: DailyRecord): Promise<void> {
  const targetDoc = doc(db, COLLECTIONS.DAILY_RECORDS, record.id);
  const hasValidTonnage =
    record.tonnage !== null &&
    record.tonnage !== undefined &&
    String(record.tonnage).trim() !== '' &&
    !isNaN(Number(record.tonnage)) &&
    Number(record.tonnage) > 0;

  await updateDoc(targetDoc, {
    date: record.date,
    truckNumber: (record.truckNumber || '').trim().toUpperCase(),
    driverName: (record.driverName || '').trim(),
    tonnage: hasValidTonnage ? Number(record.tonnage) : null,
    afdeling: (record.afdeling || 'Afdeling 1').trim(),
    ritNumber: Number(record.ritNumber) || 1,
    notes: (record.notes || '').trim(),
    updatedAt: serverTimestamp(),
  });
}

// ==========================================
// 3B. MASTER NAMA PEMUAT TBS (Otomatis & Real-time)
// ==========================================

export const INITIAL_DEFAULT_PEMUAT: string[] = [];

export async function bootstrapInitialPemuat(): Promise<void> {
  // Dinonaktifkan agar tidak pernah mengisi nama pemuat contoh otomatis
}

export function subscribeToFirestorePemuat(
  onData: (pemuat: Array<{ id: string; name: string }>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(pemuatCollection, orderBy("name", "asc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setPermissionError(null);
        const list: Array<{ id: string; name: string }> = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.name) {
            list.push({
              id: docSnap.id,
              name: String(d.name).trim(),
            });
          }
        });
        onData(list);
      },
      (error) => {
        console.error("Firebase pemuat onSnapshot error:", error);
        setPermissionError(error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    setPermissionError(err);
    if (onError) onError(err);
    return () => {};
  }
}

export async function addPemuatFirestore(name: string): Promise<string> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Nama pemuat tidak boleh kosong");
  const docRef = await addDoc(pemuatCollection, {
    name: cleanName,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deletePemuatFirestore(id: string): Promise<void> {
  const targetDoc = doc(db, COLLECTIONS.PEMUAT, id);
  await deleteDoc(targetDoc);
}

// ==========================================
// 4. RESET & IMPORT DATA CLOUD FIRESTORE
// ==========================================

export async function clearAllDemoDataFirestore(): Promise<{ deletedDaily: number; deletedExpenses: number }> {
  let deletedDaily = 0;
  let deletedExpenses = 0;

  // 1. Bersihkan catatan harian TBS uji coba
  const dailySnap = await getDocs(dailyRecordsCollection);
  if (!dailySnap.empty) {
    const batch = writeBatch(db);
    dailySnap.forEach((d) => {
      const data = d.data();
      if (
        data.notes?.includes('PKS Inti') ||
        data.notes?.includes('Buah Matang') ||
        data.notes?.includes('Plasma') ||
        data.driverName === 'Anton' ||
        data.driverName === 'Bambang' ||
        data.driverName === 'Suryanto'
      ) {
        batch.delete(d.ref);
        deletedDaily++;
      }
    });
    if (deletedDaily > 0) {
      await batch.commit();
    }
  }

  // 2. Bersihkan catatan pengeluaran contoh
  const expSnap = await getDocs(expensesCollection);
  if (!expSnap.empty) {
    const batch = writeBatch(db);
    expSnap.forEach((d) => {
      if (d.id.startsWith('exp-') || d.data().createdByName === 'Sistem Default') {
        batch.delete(d.ref);
        deletedExpenses++;
      }
    });
    if (deletedExpenses > 0) {
      await batch.commit();
    }
  }

  return { deletedDaily, deletedExpenses };
}

export async function resetAllFirestoreData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[] }> {
  // Bersihkan seluruh data biaya contoh tanpa memasukkan data dummy lagi
  const existingExpSnap = await getDocs(expensesCollection);
  if (!existingExpSnap.empty) {
    const cleanBatch = writeBatch(db);
    existingExpSnap.forEach((d) => cleanBatch.delete(d.ref));
    await cleanBatch.commit();
  }

  return { trucks: [], expenses: [] };
}

export async function importAllFirestoreData(data: {
  trucks: TruckUnit[];
  expenses: ExpenseRecord[];
}): Promise<void> {
  const batch = writeBatch(db);

  if (Array.isArray(data.trucks)) {
    data.trucks.forEach((t) => {
      const docRef = doc(db, COLLECTIONS.TRUCKS, t.id);
      batch.set(docRef, {
        code: t.code,
        plateNumber: t.plateNumber,
        driverName: t.driverName,
        phone: t.phone || "",
        model: t.model,
        capacity: t.capacity,
        status: t.status,
        year: t.year,
        notes: t.notes || "",
        updatedAt: serverTimestamp(),
      });
    });
  }

  if (Array.isArray(data.expenses)) {
    data.expenses.forEach((e) => {
      const docRef = doc(db, COLLECTIONS.EXPENSES, e.id);
      const realCat = normalizeExpenseCategory(e.category);
      const safeCat = toLegacySafeCategory(realCat);
      batch.set(docRef, {
        truckId: e.truckId,
        category: safeCat,
        realCategory: realCat,
        amount: Number(e.amount) || 0,
        date: e.date,
        description: e.description || "-",
        vendor: e.vendor || "Gudang Traksi",
        invoiceNumber: e.invoiceNumber || "",
        createdByName: e.createdByName || "Import Backup",
        updatedAt: serverTimestamp(),
      });
    });
  }

  await batch.commit();
}
