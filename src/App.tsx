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
import { findTruckFromUrlQuery } from './utils/driverLink';
import {
  api,
  CLIENT_AUTHOR_ID,
  RealtimeEventData,
  getCurrentUser,
  setCurrentUser,
  subscribeToEvents,
} from './services/api';
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

  // Real-time synchronization state (localStorage & multi-tab)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const [liveNotification, setLiveNotification] = useState<{ message: string; isRemote: boolean } | null>(null);

  // App data state - loaded directly from browser localStorage (zero delay, permanent)
  const [trucks, setTrucks] = useState<TruckUnit[]>(() => api.getInitialTrucks());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => api.getInitialExpenses());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const notify = (message: string, isRemote = false) => {
    setLiveNotification({ message, isRemote });
    setTimeout(() => {
      setLiveNotification((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  // 1. Initial Load & Multi-tab sync via BroadcastChannel / storage events
  useEffect(() => {
    let isMounted = true;

    // Refresh users from storage
    api
      .getSystemUsers()
      .then((users) => {
        if (!isMounted) return;
        setAvailableUsers(users);
      })
      .catch((err) => {
        console.warn('Gagal memuat user sistem:', err);
      });

    // Refresh data from storage
    api
      .getData()
      .then((data) => {
        if (!isMounted) return;
        if (data.trucks && Array.isArray(data.trucks)) {
          setTrucks(data.trucks);
        }
        if (data.expenses && Array.isArray(data.expenses)) {
          setExpenses(data.expenses);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('Gagal memuat data dari localStorage:', err);
        setIsLoading(false);
      });

    // Subscribe to multi-tab real-time events
    const unsubscribe = subscribeToEvents((data: RealtimeEventData) => {
      if (!isMounted) return;
      const isRemote = Boolean(data.authorId && data.authorId !== CLIENT_AUTHOR_ID);

      switch (data.type) {
        case 'INIT':
          if (data.payload?.trucks) setTrucks(data.payload.trucks);
          if (data.payload?.expenses) setExpenses(data.payload.expenses);
          break;

        case 'EXPENSE_ADDED':
          setExpenses((prev) => {
            const exists = prev.some((e) => e.id === data.payload.id);
            if (exists) return prev;
            return [data.payload, ...prev];
          });
          if (isRemote) {
            notify(
              `User lain menambahkan biaya baru: "${data.payload.description}" (Rp ${data.payload.amount?.toLocaleString('id-ID')})`,
              true
            );
          }
          break;

        case 'EXPENSES_BATCH_ADDED':
          if (Array.isArray(data.payload?.expenses)) {
            setExpenses((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const newItems = data.payload.expenses.filter((e: any) => !existingIds.has(e.id));
              return [...newItems, ...prev];
            });
            if (isRemote) {
              notify(
                `${data.payload.authorName || 'User lain'} mengimpor ${data.payload.count || data.payload.expenses.length} data biaya dari Excel!`,
                true
              );
            }
          }
          break;

        case 'EXPENSE_UPDATED':
          setExpenses((prev) =>
            prev.map((e) => (e.id === data.payload.id ? data.payload : e))
          );
          if (isRemote) {
            notify(`Catatan biaya diperbarui secara real-time oleh pengguna lain.`, true);
          }
          break;

        case 'EXPENSE_DELETED':
          setExpenses((prev) => prev.filter((e) => e.id !== data.payload.id));
          if (isRemote) {
            notify(`Catatan biaya dihapus oleh pengguna lain.`, true);
          }
          break;

        case 'TRUCK_ADDED':
          setTrucks((prev) => {
            const exists = prev.some((t) => t.id === data.payload.id);
            if (exists) return prev;
            return [...prev, data.payload];
          });
          if (isRemote) {
            notify(`Unit truk baru (${data.payload.code}) ditambahkan oleh pengguna lain!`, true);
          }
          break;

        case 'TRUCK_UPDATED':
          if (data.payload?.trucks && Array.isArray(data.payload.trucks)) {
            setTrucks(data.payload.trucks);
          } else if (data.payload?.id) {
            setTrucks((prev) =>
              prev.map((t) => (t.id === data.payload.id ? data.payload : t))
            );
          }
          if (isRemote) {
            notify(`Informasi armada truk diperbarui secara real-time.`, true);
          }
          break;

        case 'TRUCK_DELETED':
          setTrucks((prev) => prev.filter((t) => t.id !== data.payload.id));
          if (data.payload?.deleteRelated) {
            setExpenses((prev) => prev.filter((e) => e.truckId !== data.payload.id));
          }
          if (isRemote) {
            notify(`Unit truk telah dihapus oleh pengguna lain.`, true);
          }
          break;

        case 'DATABASE_RESET':
          setTrucks(data.payload.trucks || []);
          setExpenses(data.payload.expenses || []);
          if (isRemote) {
            notify(`Database telah di-reset ke 3 unit default oleh administrator.`, true);
          }
          break;

        case 'DATABASE_IMPORTED':
          if (data.payload.trucks) setTrucks(data.payload.trucks);
          if (data.payload.expenses) setExpenses(data.payload.expenses);
          if (isRemote) {
            notify(`Database diperbarui dari file backup oleh pengguna lain.`, true);
          }
          break;

        case 'USERS_UPDATED':
        case 'USER_ROLE_UPDATED':
          if (Array.isArray(data.payload?.users)) {
            setAvailableUsers(data.payload.users);
            const me = data.payload.users.find((u: AppUser) => u.id === currentUser.id);
            if (me) {
              setActiveUser(me);
              setCurrentUser(me);
            }
          }
          if (isRemote && data.payload?.user) {
            notify(`Hak akses user ${data.payload.user.name} diperbarui oleh Admin.`, true);
          }
          break;
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Detect Driver Portal parameter from URL (?dt=... or ?unit=... or #dt=...)
  useEffect(() => {
    const checkUrlForDriverPortal = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let query = urlParams.get('dt') || urlParams.get('unit');

        if (!query && window.location.hash) {
          const hash = window.location.hash.replace(/^#/, '');
          const hashParams = new URLSearchParams(hash);
          query = hashParams.get('dt') || hashParams.get('unit') || hash;
        }

        if (query && trucks.length > 0) {
          const matched = findTruckFromUrlQuery(trucks, query);
          if (matched) {
            setDriverPortalTruckId(matched.id);
          }
        }
      } catch (e) {
        console.warn('Error reading URL params for driver link:', e);
      }
    };

    checkUrlForDriverPortal();
    window.addEventListener('popstate', checkUrlForDriverPortal);
    return () => window.removeEventListener('popstate', checkUrlForDriverPortal);
  }, [trucks]);

  // Handle data actions with backend API
  const handleAddExpense = async (newExpenseData: Omit<ExpenseRecord, 'id' | 'createdAt'>) => {
    try {
      const created = await api.addExpense(newExpenseData);
      setExpenses((prev) => {
        const already = prev.some((e) => e.id === created.id);
        if (already) return prev;
        return [created, ...prev];
      });
      notify('Catatan pengeluaran berhasil disimpan secara permanen di browser (localStorage).');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal menyimpan pengeluaran');
    }
  };

  const handleBatchImportExpenses = async (items: Omit<ExpenseRecord, 'id' | 'createdAt'>[]) => {
    try {
      const created = await api.addExpensesBatch(items);
      setExpenses((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newItems = created.filter((e) => !existingIds.has(e.id));
        return [...newItems, ...prev];
      });
      notify(`Berhasil mengimpor & menyimpan ${created.length} data biaya ke browser (localStorage)!`);
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal mengimpor batch data pengeluaran');
      throw err;
    }
  };

  const handleUpdateExpense = async (updatedExpense: ExpenseRecord) => {
    try {
      const updated = await api.updateExpense(updatedExpense);
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      notify('Catatan biaya berhasil diperbarui.');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal merubah data biaya');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await api.deleteExpense(expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      notify('Catatan biaya berhasil dihapus secara permanen.');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal menghapus data biaya');
    }
  };

  const handleAddTruck = async (newTruckData: Omit<TruckUnit, 'id'>): Promise<TruckUnit> => {
    try {
      const created = await api.addTruck(newTruckData);
      setTrucks((prev) => {
        const already = prev.some(
          (t) =>
            t.id === created.id ||
            t.code.trim().toLowerCase() === created.code.trim().toLowerCase()
        );
        if (already) return prev;
        return [...prev, created];
      });
      notify(`Unit ${created.code} (${created.plateNumber}) berhasil ditambahkan dan disimpan permanen.`);
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
      setTrucks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      notify(`Unit ${saved.code} (${saved.plateNumber}) berhasil diperbarui.`);
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal memperbarui unit');
    }
  };

  const handleDeleteTruck = async (truckId: string, deleteRelated: boolean) => {
    try {
      await api.deleteTruck(truckId, deleteRelated);
      setTrucks((prev) => prev.filter((t) => t.id !== truckId));
      if (deleteRelated) {
        setExpenses((prev) => prev.filter((e) => e.truckId !== truckId));
      }
      notify('Unit truk berhasil dihapus secara permanen dari penyimpanan.');
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
      notify('Data berhasil di-reset kembali ke 3 Unit Armada Default (Unit 01, Unit 90, Unit 03).');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal mereset data');
    }
  };

  const handleImportData = async (data: { trucks: TruckUnit[]; expenses: ExpenseRecord[] }) => {
    try {
      await api.importData(data);
      setTrucks(data.trucks);
      setExpenses(data.expenses);
      notify('Data berhasil dipulihkan dari file backup!');
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Gagal mengimpor ke server');
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

  // 3. IF IN DEDICATED DRIVER PORTAL MODE:
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Real-time multi-user status alert bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRealtimeConnected
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300">
              <strong className="text-white">Penyimpanan Browser (localStorage):</strong>{' '}
              Data tersimpan otomatis secara permanen di browser Anda. Fitur hapus unit & catatan biaya bekerja langsung tanpa database cloud, siap digunakan di Vercel!
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="hover:text-emerald-400 transition flex items-center gap-1.5"
            >
              <span>User: <strong className="text-white">{currentUser.name.split(' ')[0]}</strong> ({currentUser.roleLabel})</span>
            </button>
            <span>•</span>
            <span>ID Sesi: {CLIENT_AUTHOR_ID}</span>
          </div>
        </div>

        {activeTab === 'daily_records' && <DailyRecordsView />}

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
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-12 text-center text-xs text-slate-400">
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
