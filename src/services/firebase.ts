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

// Konfigurasi Firebase Firestore pengguna
const firebaseConfig = {
  apiKey: "AIzaSyAzsjVewayOI1aq6uT82_PtulfmUc8Fk_M",
  authDomain: "traksi-22f5b.firebaseapp.com",
  projectId: "traksi-22f5b",
  storageBucket: "traksi-22f5b.firebasestorage.app",
  messagingSenderId: "900195003298",
  appId: "1:900195003298:web:c0496441e87a4b420320fb",
  measurementId: "G-2Y41RYMQDM",
};

// Inisialisasi Firebase App & Firestore
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Inisialisasi Auth untuk otentikasi otomatis jika aturan Firestore memerlukan auth
try {
  const auth = getAuth(app);
  signInAnonymously(auth).catch((authErr) => {
    // Jika anonymous auth belum diaktifkan di Firebase Console,
    // Firestore tetap dapat bekerja dengan open rules (allow read, write: if true)
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
};

// Alias untuk DailyRecordsView
export const COLLECTION_NAME = COLLECTIONS.DAILY_RECORDS;

export const trucksCollection = collection(db, COLLECTIONS.TRUCKS);
export const expensesCollection = collection(db, COLLECTIONS.EXPENSES);
export const dailyRecordsCollection = collection(db, COLLECTIONS.DAILY_RECORDS);
export const usersCollection = collection(db, COLLECTIONS.USERS);

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
      async (snapshot) => {
        setPermissionError(null);
        if (snapshot.empty && !isExpensesBootstrapped) {
          isExpensesBootstrapped = true;
          console.info("Koleksi biaya di Firestore masih kosong. Melakukan inisialisasi pengeluaran default...");
          try {
            await bootstrapInitialExpenses();
            return;
          } catch (e) {
            console.warn("Bootstrap pengeluaran gagal:", e);
          }
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
  const docRef = await addDoc(dailyRecordsCollection, {
    date: record.date,
    truckNumber: record.truckNumber.trim().toUpperCase(),
    driverName: record.driverName.trim(),
    tonnage: Number(record.tonnage),
    afdeling: record.afdeling.trim(),
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
    notes: (record.notes || "").trim(),
    updatedAt: serverTimestamp(),
  });
}

// ==========================================
// 4. RESET & IMPORT DATA CLOUD FIRESTORE
// ==========================================

export async function resetAllFirestoreData(): Promise<{ trucks: TruckUnit[]; expenses: ExpenseRecord[] }> {
  // 1. Bersihkan seluruh data lama
  const existingTrucksSnap = await getDocs(trucksCollection);
  const existingExpSnap = await getDocs(expensesCollection);

  const cleanBatch = writeBatch(db);
  existingTrucksSnap.forEach((d) => cleanBatch.delete(d.ref));
  existingExpSnap.forEach((d) => cleanBatch.delete(d.ref));
  await cleanBatch.commit();

  // 2. Isi ulang armada dan pengeluaran default
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
