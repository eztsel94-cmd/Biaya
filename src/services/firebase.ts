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

let isTrucksBootstrapped = false;

export function subscribeToFirestoreTrucks(
  onData: (trucks: TruckUnit[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(trucksCollection, orderBy("code", "asc"));
    return onSnapshot(
      q,
      async (snapshot) => {
        setPermissionError(null);
        if (snapshot.empty && !isTrucksBootstrapped) {
          isTrucksBootstrapped = true;
          console.info("Koleksi armada di Firestore masih kosong. Melakukan inisialisasi armada default...");
          try {
            await bootstrapInitialTrucks();
            return;
          } catch (e) {
            console.warn("Bootstrap armada gagal:", e);
          }
        }

        const items: TruckUnit[] = [];
        snapshot.forEach((docSnapshot) => {
          const d = docSnapshot.data();
          items.push({
            id: docSnapshot.id,
            code: d.code || "DT -",
            plateNumber: d.plateNumber || "BM 0000 TBS",
            driverName: d.driverName || "Supir",
            phone: d.phone,
            model: d.model || "Truk Dump TBS",
            capacity: d.capacity || "8.5 Ton TBS",
            status: d.status || "Aktif",
            year: d.year || 2022,
            notes: d.notes,
          });
        });
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
  const batch = writeBatch(db);
  INITIAL_TRUCKS.forEach((truck) => {
    const docRef = doc(db, COLLECTIONS.TRUCKS, truck.id);
    batch.set(docRef, {
      code: truck.code,
      plateNumber: truck.plateNumber,
      driverName: truck.driverName,
      phone: truck.phone || "",
      model: truck.model,
      capacity: truck.capacity,
      status: truck.status,
      year: truck.year,
      notes: truck.notes || "",
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
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

let isExpensesBootstrapped = false;

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

        // Jika koleksi biaya di Firestore masih kosong, masukkan 22 data contoh secara otomatis
        if (snapshot.empty && !isExpensesBootstrapped) {
          isExpensesBootstrapped = true;
          bootstrapInitialExpenses().catch((err) => {
            console.warn("Auto-bootstrap initial expenses failed:", err);
          });
          onData(INITIAL_EXPENSES);
          return;
        }

        const items: ExpenseRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const d = docSnapshot.data();
          items.push({
            id: docSnapshot.id,
            truckId: d.truckId || "",
            category: d.category || "Sparepart",
            amount: typeof d.amount === "number" ? d.amount : parseFloat(d.amount) || 0,
            date: d.date || new Date().toISOString().split("T")[0],
            description: d.description || "-",
            vendor: d.vendor || "Gudang Traksi",
            invoiceNumber: d.invoiceNumber || undefined,
            createdByName: d.createdByName || undefined,
            createdAt: d.createdAt ? (typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toISOString() : String(d.createdAt)) : new Date().toISOString(),
          });
        });
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
  const batch = writeBatch(db);
  INITIAL_EXPENSES.forEach((exp) => {
    const docRef = doc(db, COLLECTIONS.EXPENSES, exp.id);
    batch.set(docRef, {
      truckId: exp.truckId,
      category: exp.category,
      amount: exp.amount,
      date: exp.date,
      description: exp.description,
      vendor: exp.vendor || "Gudang Traksi",
      invoiceNumber: exp.invoiceNumber || "",
      createdByName: exp.createdByName || "Sistem Default",
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function addExpenseFirestore(
  expense: Omit<ExpenseRecord, "id" | "createdAt">
): Promise<ExpenseRecord> {
  const docRef = await addDoc(expensesCollection, {
    truckId: expense.truckId,
    category: expense.category,
    amount: Number(expense.amount),
    date: expense.date,
    description: expense.description.trim(),
    vendor: (expense.vendor || "Gudang Traksi").trim(),
    invoiceNumber: (expense.invoiceNumber || "").trim(),
    createdByName: expense.createdByName || "Kasir / Admin",
    createdAt: serverTimestamp(),
  });
  return {
    ...expense,
    id: docRef.id,
    createdAt: new Date().toISOString(),
  };
}

export async function updateExpenseFirestore(expense: ExpenseRecord): Promise<ExpenseRecord> {
  const docRef = doc(db, COLLECTIONS.EXPENSES, expense.id);
  await updateDoc(docRef, {
    truckId: expense.truckId,
    category: expense.category,
    amount: Number(expense.amount),
    date: expense.date,
    description: expense.description.trim(),
    vendor: (expense.vendor || "Gudang Traksi").trim(),
    invoiceNumber: (expense.invoiceNumber || "").trim(),
    updatedByName: expense.updatedByName || "",
    updatedAt: serverTimestamp(),
  });
  return expense;
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
    batch.set(newDocRef, {
      truckId: item.truckId,
      category: item.category,
      amount: Number(item.amount),
      date: item.date,
      description: item.description.trim(),
      vendor: (item.vendor || "Gudang Traksi").trim(),
      invoiceNumber: (item.invoiceNumber || "").trim(),
      createdByName: item.createdByName || "Impor Excel",
      createdAt: serverTimestamp(),
    });
    created.push({
      ...item,
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
        const items: DailyRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          items.push({
            id: docSnapshot.id,
            date: data.date || new Date().toISOString().split("T")[0],
            truckNumber: data.truckNumber || "DT -",
            driverName: data.driverName || "-",
            tonnage: typeof data.tonnage === "number" ? data.tonnage : parseFloat(data.tonnage) || 0,
            afdeling: data.afdeling || "Afdeling 1",
            ritNumber: typeof data.ritNumber === "number" ? data.ritNumber : parseInt(data.ritNumber, 10) || undefined,
            notes: data.notes || "",
            createdAt: data.createdAt,
          });
        });
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

  const docRef = await addDoc(dailyRecordsCollection, {
    date: record.date,
    truckNumber: record.truckNumber.trim().toUpperCase(),
    driverName: record.driverName.trim(),
    tonnage: Number(record.tonnage),
    afdeling: record.afdeling.trim(),
    ritNumber: Number(calculatedRitNumber),
    notes: (record.notes || "").trim(),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteDailyRecord(id: string): Promise<void> {
  const targetDoc = doc(db, COLLECTIONS.DAILY_RECORDS, id);
  await deleteDoc(targetDoc);
}

export async function updateDailyRecord(record: DailyRecord): Promise<void> {
  const targetDoc = doc(db, COLLECTIONS.DAILY_RECORDS, record.id);
  await updateDoc(targetDoc, {
    date: record.date,
    truckNumber: record.truckNumber.trim().toUpperCase(),
    driverName: record.driverName.trim(),
    tonnage: Number(record.tonnage),
    afdeling: record.afdeling.trim(),
    ritNumber: Number(record.ritNumber) || 1,
    notes: (record.notes || "").trim(),
    updatedAt: serverTimestamp(),
  });
}

// ==========================================
// 3B. MASTER NAMA PEMUAT TBS (Otomatis & Real-time)
// ==========================================

export const INITIAL_DEFAULT_PEMUAT = [
  "ANTON",
  "DELFIN",
  "YUVEN",
  "BAMBANG",
  "CANDRA",
  "DEDIK",
  "EKO",
  "SURYANTO",
];

let isPemuatBootstrapped = false;

export async function bootstrapInitialPemuat(): Promise<void> {
  if (isPemuatBootstrapped) return;
  try {
    const snap = await getDocs(pemuatCollection);
    if (snap.empty) {
      const batch = writeBatch(db);
      for (const name of INITIAL_DEFAULT_PEMUAT) {
        const docRef = doc(pemuatCollection);
        batch.set(docRef, {
          name: name.trim(),
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    isPemuatBootstrapped = true;
  } catch (err) {
    console.warn("Bootstrap pemuat notice:", err);
  }
}

export function subscribeToFirestorePemuat(
  onData: (pemuat: Array<{ id: string; name: string }>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    bootstrapInitialPemuat();
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

        // Jika Firestore masih kosong, berikan fallback default
        if (list.length === 0) {
          onData(INITIAL_DEFAULT_PEMUAT.map((n, i) => ({ id: `default-${i}`, name: n })));
        } else {
          onData(list);
        }
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
  // 1. Bersihkan seluruh data lama
  const existingTrucksSnap = await getDocs(trucksCollection);
  const existingExpSnap = await getDocs(expensesCollection);

  const cleanBatch = writeBatch(db);
  existingTrucksSnap.forEach((d) => cleanBatch.delete(d.ref));
  existingExpSnap.forEach((d) => cleanBatch.delete(d.ref));
  await cleanBatch.commit();

  // 2. Isi ulang profil unit armada resmi dan data contoh biaya
  await bootstrapInitialTrucks();
  await bootstrapInitialExpenses();

  return { trucks: INITIAL_TRUCKS, expenses: INITIAL_EXPENSES };
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
      batch.set(docRef, {
        truckId: e.truckId,
        category: e.category,
        amount: Number(e.amount),
        date: e.date,
        description: e.description,
        vendor: e.vendor || "Gudang Traksi",
        invoiceNumber: e.invoiceNumber || "",
        createdByName: e.createdByName || "Import Backup",
        updatedAt: serverTimestamp(),
      });
    });
  }

  await batch.commit();
}
