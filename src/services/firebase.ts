import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { DailyRecord, NewDailyRecord } from "../types/dailyRecord";

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

// Inisialisasi Firebase singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Nama koleksi Firestore untuk Catatan Harian Truk TBS
export const COLLECTION_NAME = "catatan_harian_tbs";
export const recordsCollection = collection(db, COLLECTION_NAME);

/**
 * Berlangganan data secara real-time menggunakan onSnapshot Firestore.
 * Jika koneksi internet terputus atau aturan firestore belum diset,
 * akan memanggil callback onError.
 */
export function subscribeToDailyRecords(
  onData: (records: DailyRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(recordsCollection, orderBy("date", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
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
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error("Gagal menghubungkan onSnapshot:", err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Menambahkan data catatan harian TBS ke Firestore menggunakan addDoc
 */
export async function addDailyRecord(record: NewDailyRecord): Promise<string> {
  const docRef = await addDoc(recordsCollection, {
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

/**
 * Menghapus data catatan harian TBS dari Firestore menggunakan deleteDoc
 */
export async function deleteDailyRecord(id: string): Promise<void> {
  const targetDoc = doc(db, COLLECTION_NAME, id);
  await deleteDoc(targetDoc);
}
