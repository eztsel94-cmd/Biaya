import React from 'react';
import { Truck, LayoutDashboard, FileText, Database, PlusCircle, RefreshCw, ClipboardPaste, Sparkles, Scale } from 'lucide-react';

import { AppUser } from '../types/truck';

export type NavTabType = 'daily_records' | 'dashboard' | 'trucks' | 'expenses';

interface NavbarProps {
  activeTab: NavTabType;
  setActiveTab: (tab: NavTabType) => void;
  truckCount: number;
  expenseCount: number;
  isRealtimeConnected: boolean;
  currentUser: AppUser;
  onOpenUserModal: () => void;
  onOpenDataManager: () => void;
  onOpenAddExpense: () => void;
  onOpenExcelImport: () => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  truckCount,
  expenseCount,
  isRealtimeConnected,
  currentUser,
  onOpenUserModal,
  onOpenDataManager,
  onOpenAddExpense,
  onOpenExcelImport,
  onResetData,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Company Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold ring-1 ring-emerald-400/30">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Sistem Catatan Harian Truk TBS
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                  Firebase Real-time
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Pencatatan Rit, Tonase, Supir & Afdeling Kebun Kelapa Sawit
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('daily_records')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'daily_records'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Scale className="w-4 h-4 text-emerald-400" />
              <span>Catatan Harian</span>
              <span className="hidden md:inline px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 font-mono">
                Firestore
              </span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('trucks')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'trucks'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Armada</span>
              <span className="px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {truckCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'expenses'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Biaya Armada</span>
              <span className="px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {expenseCount}
              </span>
            </button>
          </nav>

          {/* Action Buttons: User Role, Data Manager & Catat Biaya */}
          <div className="flex items-center gap-2">
            {/* User Role Badge / Switcher */}
            <button
              onClick={onOpenUserModal}
              title={`Login sebagai: ${currentUser.name} (${currentUser.roleLabel}). Klik untuk ganti role.`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                currentUser.role === 'admin'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : currentUser.role === 'operator'
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              <span className="hidden xl:inline">{currentUser.name.split(' ')[0]}</span>
              <span className="uppercase text-[10px] font-bold px-1 py-0.2 rounded bg-black/40">
                {currentUser.role}
              </span>
            </button>

            <button
              onClick={onOpenDataManager}
              title="Kelola data unit truk (Tambah, Edit nama/Unit 90, Hapus unit)"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition shadow-sm"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Data Manager</span>
              <span className="md:hidden">Kelola</span>
            </button>

            {currentUser.role !== 'viewer' && (
              <>
                <button
                  onClick={onOpenExcelImport}
                  title="Tempel tulisan apapun / catatan DT 90 - Otomatis memilah nomor DT, Solar, Sparepart, Mekanik, Oli, Supir, BPJS, Jamsostek, Potongan Mangkir"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500 transition shadow-sm"
                >
                  <ClipboardPaste className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Tempel Catatan Cepat</span>
                  <span className="sm:hidden">Tempel</span>
                </button>

                <button
                  onClick={onOpenAddExpense}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Catat Biaya</span>
                  <span className="sm:hidden">Biaya</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
