import React, { useState } from 'react';
import {
  Truck,
  LayoutDashboard,
  FileText,
  Database,
  PlusCircle,
  RefreshCw,
  ClipboardPaste,
  Sparkles,
  Scale,
  Menu,
  X,
  Layers,
  User,
  RotateCcw,
} from 'lucide-react';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (DESKTOP & MOBILE COMPACT) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo & Company Name */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold ring-1 ring-emerald-400/30 shrink-0">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-black text-sm sm:text-base lg:text-lg tracking-tight text-white truncate">
                    Truk TBS
                  </span>
                  <span className="hidden sm:inline font-bold text-sm text-slate-300">
                    · Catatan Harian
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden lg:block truncate">
                  Pencatatan Rit, Tonase, Supir & Afdeling Kebun Kelapa Sawit
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links (Hidden on Mobile) */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              <button
                onClick={() => setActiveTab('daily_records')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'daily_records'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Scale className="w-4 h-4 text-emerald-400" />
                <span>Catatan Harian</span>
              </button>

              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
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
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'trucks'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Armada</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {truckCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('expenses')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
                  activeTab === 'expenses'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Biaya Armada</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {expenseCount}
                </span>
              </button>
            </nav>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={onOpenUserModal}
                title={`Role: ${currentUser.roleLabel}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="uppercase text-[10px] font-bold">{currentUser.role}</span>
              </button>

              <button
                onClick={onOpenDataManager}
                title="Kelola data unit truk"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kelola DT</span>
              </button>

              {currentUser.role !== 'viewer' && (
                <>
                  <button
                    onClick={onOpenExcelImport}
                    title="Tempel catatan atau upload Excel"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 transition shadow-sm"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tempel</span>
                  </button>

                  <button
                    onClick={onOpenAddExpense}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Catat Biaya</span>
                  </button>
                </>
              )}
            </div>

            {/* Mobile Top Right Actions (Compact on HP) */}
            <div className="flex md:hidden items-center gap-1.5">
              {currentUser.role !== 'viewer' && (
                <button
                  onClick={onOpenExcelImport}
                  title="Tempel Catatan Cepat"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-xs font-bold shadow-sm"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">Tempel</span>
                </button>
              )}

              {currentUser.role !== 'viewer' && (
                <button
                  onClick={onOpenAddExpense}
                  title="Catat Biaya"
                  className="flex items-center justify-center p-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setIsMobileMenuOpen(true)}
                title="Buka Menu Aksi Cepat"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. NATIVE MOBILE BOTTOM NAVIGATION BAR (KHUSUS LAYAR HP) */}
      {/* ========================================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 shadow-2xl safe-area-inset-bottom">
        <div className="grid grid-cols-5 h-16 items-center px-1 max-w-md mx-auto">
          {/* Tab 1: Catatan Harian */}
          <button
            type="button"
            onClick={() => setActiveTab('daily_records')}
            className={`flex flex-col items-center justify-center h-full py-1 transition-all ${
              activeTab === 'daily_records' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Scale className="w-5 h-5" />
              {activeTab === 'daily_records' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Catatan</span>
          </button>

          {/* Tab 2: Dashboard */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center h-full py-1 transition-all ${
              activeTab === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Dashboard</span>
          </button>

          {/* Tab 3: Armada */}
          <button
            type="button"
            onClick={() => setActiveTab('trucks')}
            className={`flex flex-col items-center justify-center h-full py-1 transition-all ${
              activeTab === 'trucks' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Truck className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 text-[9px] font-mono font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {truckCount}
              </span>
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Armada</span>
          </button>

          {/* Tab 4: Biaya Armada */}
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center justify-center h-full py-1 transition-all ${
              activeTab === 'expenses' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <FileText className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 text-[9px] font-mono font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {expenseCount}
              </span>
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Biaya</span>
          </button>

          {/* Tab 5: Menu & Aksi Cepat */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center h-full py-1 text-slate-400 hover:text-emerald-400 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[10px] mt-1 tracking-tight font-medium text-slate-300">Menu</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MOBILE ACTION DRAWER / BOTTOM SHEET */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in">
          {/* Backdrop click to close */}
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />

          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Header Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Menu & Aksi Sistem Truk TBS</h3>
                  <p className="text-[11px] text-slate-400">
                    Akses Cepat Pengelolaan dari Layar HP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Login Aktif:</span>
                  <span className="font-bold text-white">{currentUser.name}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenUserModal();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 border border-slate-700 text-[11px] font-bold"
              >
                Ganti Role: {currentUser.role.toUpperCase()}
              </button>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {currentUser.role !== 'viewer' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenExcelImport();
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-left hover:bg-emerald-900/80 transition"
                >
                  <ClipboardPaste className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-200 block">Tempel Catatan</span>
                    <span className="text-[10px] text-emerald-400/80">Pilah DT & Biaya Otomatis</span>
                  </div>
                </button>
              )}

              {currentUser.role !== 'viewer' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAddExpense();
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-left hover:bg-slate-700 transition"
                >
                  <PlusCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">Catat Biaya</span>
                    <span className="text-[10px] text-slate-400">Solar, Part, Servis</span>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenDataManager();
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-left hover:bg-slate-700 transition"
              >
                <Database className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-white block">Kelola Armada</span>
                  <span className="text-[10px] text-slate-400">{truckCount} Unit di Database</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onResetData();
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-left hover:bg-rose-950/40 hover:border-rose-500/30 transition"
              >
                <RotateCcw className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Reset Demo</span>
                  <span className="text-[10px] text-slate-400">Kembali 3 Unit Awal</span>
                </div>
              </button>
            </div>

            {/* Quick Menu Links */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Navigasi Menu
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('daily_records');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold ${
                  activeTab === 'daily_records' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <span>Catatan Harian Truk TBS</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Buka &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold ${
                  activeTab === 'dashboard' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                  <span>Dashboard Ringkasan Biaya</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Buka &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('trucks');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold ${
                  activeTab === 'trucks' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  <span>Armada & Link Akses Supir</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Buka &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('expenses');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold ${
                  activeTab === 'expenses' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Daftar Seluruh Biaya Armada</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Buka &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

