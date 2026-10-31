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
import { findTruckFromUrlQuery } from './utils/driverLink';
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
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabType>('daily_records');

  // Filter params passed when navigating to expenses
  const [expensesInitialTruck, setExpensesInitialTruck] = useState<string>('all');
  const [expensesInitialCategory, setExpensesInitialCategory] = useState<string>('all');

  // Dedicated Driver Portal Mode
  const [driverPortalTruckId, setDriverPortalTruckId] = useState<string | null>(null);

  // Dedicated Pemuat Portal Mode (Akses Khusus Terisolasi untuk Pemuat)
  const [isPemuatPortalMode, setIsPemuatPortalMode] = useState<boolean>(false);
  const [pemuatPortalName, setPemuatPortalName] = useState<string>('');

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
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
        const hashParams = hash ? new URLSearchParams(hash) : null;

        // A. Cek Akses Khusus Portal Pemuat (?portal=pemuat atau ?pemuat=... atau #pemuat)
        const portalParam = urlParams.get('portal') || hashParams?.get('portal');
        const modeParam = urlParams.get('mode') || hashParams?.get('mode');
        const pemuatParam = urlParams.get('pemuat') || hashParams?.get('pemuat');
        const namaParam = urlParams.get('nama') || hashParams?.get('nama');
        const isPemuatHash = hash.toLowerCase().includes('pemuat');

        if (
          portalParam === 'pemuat' ||
          modeParam === 'pemuat' ||
          pemuatParam !== null ||
          isPemuatHash
        ) {
          setIsPemuatPortalMode(true);
          const targetName =
            namaParam ||
            (pemuatParam && pemuatParam !== 'true' && pemuatParam !== '1' ? pemuatParam : '');
          if (targetName) {
            setPemuatPortalName(targetName.trim());
          }
          return;
        }

        // B. Cek Akses Khusus Driver Dump Truck (?dt=... atau ?unit=...)
        let query = urlParams.get('dt') || urlParams.get('unit');
        if (!query && hashParams) {
          query = hashParams.get('dt') || hashParams.get('unit') || hash;
        }

        if (query && trucks.length > 0) {
          const matched = findTruckFromUrlQuery(trucks, query);
          if (matched) {
            setDriverPortalTruckId(matched.id);
          }
        }
      } catch (e) {
        console.warn('Error reading URL params for portals:', e);
      }
    };

    checkUrlForPortals();
    window.addEventListener('popstate', checkUrlForPortals);
    return () => window.removeEventListener('popstate', checkUrlForPortals);
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
      setTrucks(res.trucks);
      setExpenses(res.expenses);
      notify('Data cloud Firestore berhasil di-reset kembali ke 3 Unit Armada Default (Unit 01, Unit 90, Unit 03).');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal mereset data');
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

  // 3. IF IN DEDICATED ISOLATED PEMUAT PORTAL MODE:
  // Render ONLY the daily records & trip input for loaders (100% isolated from admin modules)
  if (isPemuatPortalMode) {
    return (
      <PemuatPortalView
        initialPemuatName={pemuatPortalName}
        onExitToAdmin={() => {
          if (window.history.pushState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.pushState({ path: cleanUrl }, '', cleanUrl);
          }
          setIsPemuatPortalMode(false);
        }}
      />
    );
  }

  // 4. IF IN DEDICATED DRIVER PORTAL MODE:
  // Render ONLY this driver's Dump Truck data!
  const activeDriverTruck = driverPortalTruckId
    ? trucks.find((t) => t.id === driverPortalTruckId)
    : null;

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
            if (window.history.pushState) {
              const cleanUrl = window.location.origin + window.location.pathname;
              window.history.pushState({ path: cleanUrl }, '', cleanUrl);
            }
            setDriverPortalTruckId(null);
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
        setActiveTab={setActiveTab}
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
            onOpenPemuatPortal={(pemuatName) => {
              if (pemuatName) setPemuatPortalName(pemuatName);
              setIsPemuatPortalMode(true);
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

        {activeTab === 'trucks' && (
          <TrucksView
            trucks={trucks}
            expenses={expenses}
            onOpenAddExpense={handleOpenAddExpense}
            onOpenDataManager={() => setIsDataManagerOpen(true)}
            onNavigateToExpensesWithFilter={handleNavigateToExpensesWithTruck}
            onOpenDriverPortal={(truckId) => setDriverPortalTruckId(truckId)}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-12 mb-16 md:mb-0 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Harbor Homes</span>
            <span>—</span>
            <span>Sistem Laporan Biaya Truk TBS Real-Time ({trucks.length} Unit Aktif)</span>
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
              onClick={handleResetToDefault3Units}
              className="hover:text-amber-400 transition flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Default 3 Unit
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
        onOpenDriverPortal={(truckId) => setDriverPortalTruckId(truckId)}
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
