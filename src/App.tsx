/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TruckUnit, ExpenseRecord, AppUser } from './types/truck';
import { INITIAL_TRUCKS, INITIAL_EXPENSES } from './data/initialData';
import { Navbar, NavTabType } from './components/Navbar';
import { DailyRecordsView } from './components/DailyRecordsView';
import { DashboardView } from './components/DashboardView';
import { TrucksView } from './components/TrucksView';
import { ExpensesView } from './components/ExpensesView';
import { DataManagerModal } from './components/DataManagerModal';
import { AddExpenseModal } from './components/AddExpenseModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { UserRoleModal } from './components/UserRoleModal';
import { DriverPortalView } from './components/DriverPortalView';
import { PemuatPortalView } from './components/PemuatPortalView';
import { SettingsView } from './components/SettingsView';
import { MonthlyReportView } from './components/MonthlyReportView';
import {
  findTruckFromUrlQuery,
  buildVirtualTruckFromQuery,
  extractDriverQueryFromLocation,
  extractPemuatPortalFromLocation,
  safeUpdateBrowserUrl,
} from './utils/driverLink';
import {
  api,
  CLIENT_AUTHOR_ID,
  RealtimeEventData,
  getCurrentUser,
  setCurrentUser,
  subscribeToEvents,
} from './services/api';
import { onPermissionErrorChange } from './services/firebase';
import {
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Radio,
  Zap,
  Settings,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabType>('daily_records');

  // Filter params passed when navigating to expenses
  const [expensesInitialTruck, setExpensesInitialTruck] = useState<string>('all');
  const [expensesInitialCategory, setExpensesInitialCategory] = useState<string>('all');

  // Dedicated Driver Portal Mode
  const [driverPortalTruckId, setDriverPortalTruckId] = useState<string | null>(null);
  const [driverPortalQuery, setDriverPortalQuery] = useState<string | null>(() => extractDriverQueryFromLocation());

  // Dedicated Pemuat Portal Mode (Akses Khusus Terkunci & Hanya Lihat Hasil untuk Pemuat)
  const [isPemuatPortalMode, setIsPemuatPortalMode] = useState<boolean>(
    () => extractPemuatPortalFromLocation().isPemuat
  );
  const [pemuatPortalName, setPemuatPortalName] = useState<string>(
    () => extractPemuatPortalFromLocation().pemuatName
  );

  // Modal states
  const [isDataManagerOpen, setIsDataManagerOpen] = useState<boolean>(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState<boolean>(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [addExpenseDefaultTruckId, setAddExpenseDefaultTruckId] = useState<string | undefined>(undefined);
  const [excelImportDefaultTruckId, setExcelImportDefaultTruckId] = useState<string | undefined>(undefined);

  // Active User & RBAC state
  const [currentUser, setActiveUser] = useState<AppUser>(() => getCurrentUser());
  const [availableUsers, setAvailableUsers] = useState<AppUser[]>(() => api.getInitialUsers());

  // Real-time synchronization state (Firebase Firestore)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [liveNotification, setLiveNotification] = useState<{ message: string; isRemote: boolean } | null>(null);

  // App data state - loaded directly from Firebase Firestore onSnapshot
  const [trucks, setTrucks] = useState<TruckUnit[]>(() => api.getInitialTrucks());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => api.getInitialExpenses());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const notify = (message: string, isRemote = false) => {
    setLiveNotification({ message, isRemote });
    setTimeout(() => {
      setLiveNotification((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  // 1. Initial Load & Firebase Firestore onSnapshot sync
  useEffect(() => {
    let isMounted = true;

    // Pantau error izin Firestore
    const unsubPerm = onPermissionErrorChange((err) => {
      if (isMounted) setPermissionError(err);
    });

    // Refresh users
    api
      .getSystemUsers()
      .then((users) => {
        if (!isMounted) return;
        setAvailableUsers(users);
      })
      .catch((err) => {
        console.warn('Gagal memuat user sistem:', err);
      });

    // Subscribe to Firestore onSnapshot events (Armada & Pengeluaran)
    const unsubscribe = subscribeToEvents((data: RealtimeEventData) => {
      if (!isMounted) return;
      setIsRealtimeConnected(true);

      switch (data.type) {
        case 'INIT':
          if (data.payload?.trucks) setTrucks(data.payload.trucks);
          if (data.payload?.expenses) setExpenses(data.payload.expenses);
          break;
      }
    });

    return () => {
      isMounted = false;
      unsubPerm();
      unsubscribe();
    };
  }, []);

  // 2. Detect Dedicated Portals (Pemuat Portal & Driver Portal) from URL
  useEffect(() => {
    const checkUrlForPortals = () => {
      try {
        // A. Cek Akses Khusus Portal Pemuat (?portal=pemuat atau ?pemuat=... atau #pemuat)
        const pemuatInfo = extractPemuatPortalFromLocation();
        if (pemuatInfo.isPemuat) {
          setIsPemuatPortalMode(true);
          setPemuatPortalName(pemuatInfo.pemuatName);
          return;
        }

        // B. Cek Akses Khusus Driver Dump Truck (?dt=... atau ?unit=... atau ?id=...)
        const query = extractDriverQueryFromLocation();
        if (query) {
          setDriverPortalQuery(query);
          if (trucks.length > 0) {
            const matched = findTruckFromUrlQuery(trucks, query);
            if (matched) {
              setDriverPortalTruckId(matched.id);
            }
          }
        }
      } catch (e) {
        console.warn('Error reading URL params for portals:', e);
      }
    };

    checkUrlForPortals();
    window.addEventListener('popstate', checkUrlForPortals);
    window.addEventListener('hashchange', checkUrlForPortals);
    return () => {
      window.removeEventListener('popstate', checkUrlForPortals);
      window.removeEventListener('hashchange', checkUrlForPortals);
    };
  }, [trucks]);

  // Handle data actions with backend API
  const handleAddExpense = async (newExpenseData: Omit<ExpenseRecord, 'id' | 'createdAt'>) => {
    try {
      const created = await api.addExpense(newExpenseData);
      notify('Catatan pengeluaran berhasil disimpan langsung ke cloud Firebase Firestore.');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal menyimpan pengeluaran');
    }
  };

  const handleBatchImportExpenses = async (items: Omit<ExpenseRecord, 'id' | 'createdAt'>[]) => {
    try {
      const created = await api.addExpensesBatch(items);
      notify(`Berhasil mengimpor & menyimpan ${created.length} data biaya ke cloud Firebase Firestore!`);
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal mengimpor batch data pengeluaran');
      throw err;
    }
  };

  const handleUpdateExpense = async (updatedExpense: ExpenseRecord) => {
    try {
      await api.updateExpense(updatedExpense);
      notify('Catatan biaya berhasil diperbarui di cloud Firestore.');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal merubah data biaya');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await api.deleteExpense(expenseId);
      notify('Catatan biaya berhasil dihapus dari cloud Firestore.');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal menghapus data biaya');
    }
  };

  const handleAddTruck = async (newTruckData: Omit<TruckUnit, 'id'>): Promise<TruckUnit> => {
    try {
      const created = await api.addTruck(newTruckData);
      notify(`Unit ${created.code} (${created.plateNumber}) berhasil ditambahkan ke cloud Firestore.`);
      return created;
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal menambahkan unit truk');
      throw err;
    }
  };

  const handleUpdateTruck = async (updatedTruck: TruckUnit) => {
    try {
      const saved = await api.updateTruck(updatedTruck);
      notify(`Unit ${saved.code} (${saved.plateNumber}) berhasil diperbarui di cloud Firestore.`);
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal memperbarui unit');
    }
  };

  const handleDeleteTruck = async (truckId: string, deleteRelated: boolean) => {
    try {
      await api.deleteTruck(truckId, deleteRelated);
      notify('Unit truk berhasil dihapus dari cloud Firestore.');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal menghapus unit truk');
    }
  };

  const handleResetToDefault3Units = async () => {
    try {
      const res = await api.resetData();
      setExpenses(res.expenses);
      notify('Seluruh data biaya contoh pada cloud Firestore berhasil dibersihkan.');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal membersihkan data');
    }
  };

  const handleImportData = async (data: { trucks: TruckUnit[]; expenses: ExpenseRecord[] }) => {
    try {
      await api.importData(data);
      notify('Data berhasil dipulihkan dan diunggah ke cloud Firestore!');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal mengimpor ke Firestore');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: any) => {
    try {
      const res = await api.updateUserRole(userId, newRole);
      setAvailableUsers(res.users);
      if (userId === currentUser.id) {
        setActiveUser(res.user);
        setCurrentUser(res.user);
      }
      notify(`Role berhasil diubah: ${res.user.name} sekarang berstatus ${newRole.toUpperCase()}!`);
    } catch (err: any) {
      notify(err.message || 'Gagal mengubah role');
    }
  };

  const handleAddSystemUser = async (newUser: Omit<AppUser, 'id'>) => {
    try {
      const users = await api.addSystemUser(newUser);
      setAvailableUsers(users);
      notify(`Akun ${newUser.name} berhasil ditambahkan.`);
    } catch (err: any) {
      notify(err.message || 'Gagal menambah akun');
    }
  };

  const handleDeleteSystemUser = async (userId: string) => {
    try {
      const users = await api.deleteSystemUser(userId);
      setAvailableUsers(users);
      notify('Akun berhasil dihapus dari daftar hak akses.');
    } catch (err: any) {
      notify(err.message || 'Gagal menghapus akun');
    }
  };

  // Navigation helpers
  const handleNavigateToExpensesWithCategory = (category?: string) => {
    setExpensesInitialCategory(category || 'all');
    setExpensesInitialTruck('all');
    setActiveTab('expenses');
  };

  const handleNavigateToExpensesWithTruck = (truckId: string) => {
    setExpensesInitialTruck(truckId);
    setExpensesInitialCategory('all');
    setActiveTab('expenses');
  };

  const handleOpenAddExpense = (defaultTruckId?: string) => {
    setAddExpenseDefaultTruckId(defaultTruckId);
    setIsAddExpenseOpen(true);
  };

  // PERBAIKAN: fungsi pembuka modal Import Excel (sebelumnya belum ada)
  const handleOpenExcelImport = (defaultTruckId?: string) => {
    setExcelImportDefaultTruckId(defaultTruckId);
    setIsExcelImportOpen(true);
  };

  // Helper untuk membuka portal pemuat terkunci dan memperbarui URL tanpa reload
  const handleEnterPemuatPortal = (pemuatName?: string) => {
    const cleanName = (pemuatName || '').trim();
    setDriverPortalTruckId(null);
    setDriverPortalQuery(null);
    setPemuatPortalName(cleanName);
    setIsPemuatPortalMode(true);
    const queryStr = cleanName
      ? `?portal=pemuat&nama=${encodeURIComponent(cleanName)}`
      : '?portal=pemuat';
    safeUpdateBrowserUrl(queryStr);
  };

  // Helper untuk keluar dari portal pemuat (setelah verifikasi PIN Admin TRAKSI_001) menuju Beranda Utama
  const handleExitPemuatPortal = () => {
    safeUpdateBrowserUrl('/');
    setIsPemuatPortalMode(false);
    setActiveTab('daily_records');
  };

  // Helper untuk membuka portal supir dan memperbarui URL tanpa reload
  const handleEnterDriverPortal = (truckId: string) => {
    setIsPemuatPortalMode(false);
    setDriverPortalTruckId(truckId);
    const target = trucks.find((t) => t.id === truckId);
    if (target) {
      setDriverPortalQuery(target.code);
      const cleanCode = String(target.code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      safeUpdateBrowserUrl(`?dt=${encodeURIComponent(cleanCode)}&id=${encodeURIComponent(target.id)}`);
    }
  };

  // 3A. IF IN DEDICATED PEMUAT PORTAL MODE (TERKUNCI & HANYA LIHAT HASIL):
  if (isPemuatPortalMode || activeTab === 'pemuat_portal') {
    return (
      <PemuatPortalView
        trucks={trucks}
        initialPemuatName={pemuatPortalName}
        onExitToAdmin={handleExitPemuatPortal}
      />
    );
  }

  // 3B. IF IN DEDICATED DRIVER PORTAL MODE:
  // Render ONLY this driver's Dump Truck data!
  const activeDriverTruck = React.useMemo(() => {
    if (driverPortalTruckId) {
      const match = trucks.find((t) => t.id === driverPortalTruckId);
      if (match) return match;
    }
    if (driverPortalQuery && driverPortalQuery !== 'PILIH_UNIT') {
      const match = findTruckFromUrlQuery(trucks, driverPortalQuery);
      if (match) return match;
      // Fallback langsung agar halaman supir tampil seketika tanpa layar hitam selagi Firestore memuat
      return buildVirtualTruckFromQuery(driverPortalQuery);
    }
    return null;
  }, [trucks, driverPortalTruckId, driverPortalQuery]);

  const [unmatchedPinPrompt, setUnmatchedPinPrompt] = useState(false);
  const [unmatchedPinInput, setUnmatchedPinInput] = useState('');
  const [unmatchedPinError, setUnmatchedPinError] = useState(false);

  // Jika URL adalah ?dt= kosong (PILIH_UNIT), tampilkan kartu pemilihan unit armada secara langsung
  if (driverPortalQuery && !activeDriverTruck) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Portal Khusus Supir — Traksi KPU</h2>
            <p className="text-xs text-slate-400 mt-1">
              Silakan pilih unit kendaraan Anda di bawah ini untuk melihat rincian biaya operasional:
            </p>
          </div>
          {trucks.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Memuat daftar armada dari cloud Firestore...</span>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto grid grid-cols-2 gap-2 text-left pt-1">
              {trucks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleEnterDriverPortal(t.id)}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-emerald-950/50 border border-slate-800 hover:border-emerald-500/40 transition flex flex-col"
                >
                  <span className="text-xs font-black text-white font-mono">{t.code}</span>
                  <span className="text-[11px] text-slate-400 truncate">{t.driverName}</span>
                </button>
              ))}
            </div>
          )}

          {!unmatchedPinPrompt ? (
            <div className="pt-3 border-t border-slate-800 flex justify-center">
              <button
                onClick={() => {
                  setUnmatchedPinPrompt(true);
                  setUnmatchedPinInput('');
                  setUnmatchedPinError(false);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Buka Beranda Admin (Perlu PIN)
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-800 space-y-2 text-left">
              <label className="block text-[11px] font-bold text-slate-400 uppercase">Masukkan PIN Admin</label>
              <input
                type="password"
                value={unmatchedPinInput}
                onChange={(e) => {
                  setUnmatchedPinInput(e.target.value);
                  setUnmatchedPinError(false);
                }}
                placeholder="PIN Admin"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-center font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
              {unmatchedPinError && (
                <p className="text-[11px] text-rose-400 text-center">PIN Admin tidak sesuai.</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setUnmatchedPinPrompt(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (unmatchedPinInput.trim().toUpperCase() === 'TRAKSI_001') {
                      safeUpdateBrowserUrl('/');
                      setDriverPortalTruckId(null);
                      setDriverPortalQuery(null);
                      setUnmatchedPinPrompt(false);
                      setActiveTab('daily_records');
                    } else {
                      setUnmatchedPinError(true);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
                >
                  Buka Beranda
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeDriverTruck) {
    return (
      <>
        {/* Real-time sync banner */}
        {liveNotification && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm animate-in slide-in-from-top-4 duration-200 border ${
              liveNotification.isRemote
                ? 'bg-blue-950/95 text-blue-200 border-blue-500/50 shadow-blue-500/20'
                : 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50 shadow-emerald-500/20'
            }`}
          >
            {liveNotification.isRemote ? (
              <Zap className="w-5 h-5 text-blue-400 shrink-0 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span>{liveNotification.isRemote ? 'Sinkronisasi Real-Time' : 'Berhasil'}</span>
              </div>
              <p className="text-xs text-slate-300">{liveNotification.message}</p>
            </div>
          </div>
        )}

        <DriverPortalView
          truck={activeDriverTruck}
          expenses={expenses}
          currentUser={currentUser}
          onOpenAddExpense={(truckId) => handleOpenAddExpense(truckId)}
          onExitDriverMode={() => {
            safeUpdateBrowserUrl('/');
            setDriverPortalTruckId(null);
            setDriverPortalQuery(null);
            setActiveTab('daily_records');
          }}
        />

        {/* Expense Modal locked to only this driver's unit */}
        <AddExpenseModal
          isOpen={isAddExpenseOpen}
          onClose={() => setIsAddExpenseOpen(false)}
          trucks={[activeDriverTruck]}
          defaultTruckId={activeDriverTruck.id}
          onAddExpense={handleAddExpense}
        />
      </>
    );
  }

  // 4. STANDARD FLEET OVERVIEW / ADMIN PORTAL
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Real-time sync banner if remote update occurred */}
      {liveNotification && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm animate-in slide-in-from-top-4 duration-200 border ${
            liveNotification.isRemote
              ? 'bg-blue-950/95 text-blue-200 border-blue-500/50 shadow-blue-500/20'
              : 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50 shadow-emerald-500/20'
          }`}
        >
          {liveNotification.isRemote ? (
            <Zap className="w-5 h-5 text-blue-400 shrink-0 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span>{liveNotification.isRemote ? 'Sinkronisasi Real-Time' : 'Berhasil'}</span>
              {liveNotification.isRemote && (
                <span className="text-[10px] bg-blue-500/30 px-1.5 py-0.2 rounded font-mono uppercase">
                  Multi-User
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">{liveNotification.message}</p>
          </div>
        </div>
      )}

      {/* Main Navbar with Realtime indicator & User Role */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'pemuat_portal') {
            handleEnterPemuatPortal(pemuatPortalName);
          } else {
            setIsPemuatPortalMode(false);
            setActiveTab(tab);
          }
        }}
        truckCount={trucks.length}
        expenseCount={expenses.length}
        isRealtimeConnected={isRealtimeConnected}
        currentUser={currentUser}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onOpenDataManager={() => setIsDataManagerOpen(true)}
        onOpenAddExpense={() => handleOpenAddExpense()}
        onOpenExcelImport={() => handleOpenExcelImport()}
        onResetData={handleResetToDefault3Units}
      />

      {/* Main App Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 md:pb-12">
        {/* Warning jika aturan Firestore belum diset (Missing Permissions) */}
        {permissionError && (
          <div className="mb-5 p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white">Kendala Izin Akses Firestore (Missing Permissions):</p>
              <p>{permissionError}</p>
              <p className="text-slate-300 text-xs">
                Buka <strong>Firebase Console</strong> &rarr; Project <strong>traksi-22f5b</strong> &rarr; <strong>Firestore Database</strong> &rarr; Tab <strong>Rules</strong>, ubah aturannya menjadi:
              </p>
              <pre className="p-2 rounded bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
              </pre>
            </div>
          </div>
        )}

        {/* Real-time Firestore Cloud status alert bar */}
        <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 shrink-0 rounded-full ${
                isRealtimeConnected && !permissionError
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300 text-[11px] sm:text-xs">
              <strong className="text-white">Firestore Real-Time:</strong>{' '}
              <span className="hidden sm:inline">Semua modul tersambung ke project </span>
              <strong className="text-emerald-400 font-mono">traksi-22f5b</strong>
              <span className="hidden sm:inline"> via <code className="text-emerald-400 font-mono bg-emerald-950/60 px-1 py-0.5 rounded">onSnapshot</code></span>
            </span>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 text-slate-400 font-mono text-[11px] pt-1.5 sm:pt-0 border-t border-slate-800/80 sm:border-0">
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="hover:text-emerald-400 transition flex items-center gap-1.5"
            >
              <span>User: <strong className="text-white">{currentUser.name.split(' ')[0]}</strong> ({currentUser.roleLabel})</span>
            </button>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">Online Sync</span>
          </div>
        </div>

        {activeTab === 'daily_records' && (
          <DailyRecordsView
            trucks={trucks}
            onOpenPemuatPortal={(pemuatName) => {
              handleEnterPemuatPortal(pemuatName);
            }}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            trucks={trucks}
            expenses={expenses}
            onSelectTruck={(truckId) => {
              setActiveTab('trucks');
            }}
            onOpenAddExpense={handleOpenAddExpense}
            onOpenDataManager={() => setIsDataManagerOpen(true)}
            onNavigateToExpenses={handleNavigateToExpensesWithCategory}
          />
        )}

        {activeTab === 'monthly_report' && (
          <MonthlyReportView
            trucks={trucks}
            expenses={expenses}
          />
        )}

        {activeTab === 'trucks' && (
          <TrucksView
            trucks={trucks}
            expenses={expenses}
            onOpenAddExpense={handleOpenAddExpense}
            onOpenDataManager={() => setIsDataManagerOpen(true)}
            onNavigateToExpensesWithFilter={handleNavigateToExpensesWithTruck}
            onOpenDriverPortal={handleEnterDriverPortal}
            onOpenExcelImport={handleOpenExcelImport}
            onDeleteTruck={handleDeleteTruck}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView
            trucks={trucks}
            expenses={expenses}
            currentUser={currentUser}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            initialFilterTruckId={expensesInitialTruck}
            initialFilterCategory={expensesInitialCategory}
          />
        )}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-12 mb-16 md:mb-0 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/images_70037338.jpeg"
              alt="Logo Traksi KPU"
              className="h-6 w-auto rounded bg-white px-1.5 py-0.5 object-contain"
            />
            <span className="font-bold text-white">Traksi KPU</span>
            <span>—</span>
            <span>Kalimantan Plantation Unit • Sistem Operasional Truk TBS ({trucks.length} Unit Aktif)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="hover:text-emerald-400 transition"
            >
              Role: <strong className="text-emerald-400 uppercase">{currentUser.role}</strong>
            </button>
            <span>•</span>
            <button
              onClick={() => setIsDataManagerOpen(true)}
              className="hover:text-emerald-400 transition flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> Data Manager
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('settings')}
              className="hover:text-emerald-400 transition flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" /> Pengaturan Firebase
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <UserRoleModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        currentUser={currentUser}
        availableUsers={availableUsers}
        onSelectUser={(user) => {
          setActiveUser(user);
          setCurrentUser(user);
          notify(`Beralih ke akun ${user.name} [Role: ${user.roleLabel}]`);
        }}
        onUpdateRole={handleUpdateUserRole}
        onAddUser={handleAddSystemUser}
        onDeleteUser={handleDeleteSystemUser}
      />

      <DataManagerModal
        isOpen={isDataManagerOpen}
        onClose={() => setIsDataManagerOpen(false)}
        trucks={trucks}
        expenses={expenses}
        onAddTruck={handleAddTruck}
        onUpdateTruck={handleUpdateTruck}
        onDeleteTruck={handleDeleteTruck}
        onResetToDefault3Units={handleResetToDefault3Units}
        onImportData={handleImportData}
        onOpenDriverPortal={handleEnterDriverPortal}
      />

      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        trucks={trucks}
        defaultTruckId={addExpenseDefaultTruckId}
        onAddExpense={handleAddExpense}
      />

      {/* PERBAIKAN: modal Import Excel sekarang benar-benar dirender.
          Dengan {isExcelImportOpen && ...}, data lama di modal otomatis
          bersih setiap kali dibuka ulang. */}
      {isExcelImportOpen && (
        <ExcelImportModal
          isOpen={isExcelImportOpen}
          onClose={() => setIsExcelImportOpen(false)}
          trucks={trucks}
          defaultTruckId={excelImportDefaultTruckId}
          onImportExpenses={handleBatchImportExpenses}
        />
      )}
    </div>
  );
}
