import React, { useState } from 'react';
import { AppUser, UserRole } from '../types/truck';
import { ShieldCheck, UserCheck, Eye, X, Check, Lock, Star, ArrowDown, Truck, Crown, KeyRound, AlertCircle } from 'lucide-react';

interface UserRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  availableUsers: AppUser[];
  onSelectUser: (user: AppUser) => void;
  onUpdateRole: (userId: string, newRole: UserRole) => void;
}

export const UserRoleModal: React.FC<UserRoleModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableUsers,
  onSelectUser,
  onUpdateRole,
}) => {
  if (!isOpen) return null;

  const isAdmin = currentUser.role === 'admin';

  // PIN Verification State when a non-admin attempts to switch into an Admin account
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinTargetUser, setPinTargetUser] = useState<AppUser | null>(null);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const handleSelectAccount = (targetUser: AppUser) => {
    // Jika pengguna saat ini adalah supir/operator dan ingin beralih ke akun Admin:
    if (!isAdmin && targetUser.role === 'admin') {
      setPinTargetUser(targetUser);
      setPinInput('');
      setPinError(null);
      setShowPinModal(true);
      return;
    }

    onSelectUser(targetUser);
    onClose();
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default master PIN otorisasi admin: 1234
    if (pinInput === '1234') {
      if (pinTargetUser) {
        onSelectUser(pinTargetUser);
      }
      setShowPinModal(false);
      onClose();
    } else {
      setPinError('PIN Admin salah! Supir tidak diizinkan masuk ke akun Admin.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manajemen Hak Akses Admin & Supir DT</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Sistem Otorisasi
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Supir tidak dapat mengangkat admin atau merubah data biaya. Hanya Admin yang berhak mengatur role.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Supir Restricted Notice if currently logged in as Supir */}
          {!isAdmin && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-amber-300 block mb-0.5">Sesi Akun Supir / Operator Terbatas:</strong>
                Saat ini Anda masuk sebagai Supir. Anda tidak diizinkan mengubah hak akses, mengangkat admin, atau mengubah/menghapus data biaya unit. Hanya akun Admin yang berwenang.
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-emerald-200 block mb-0.5">Sesi Admin Aktif ({currentUser.name}):</strong>
                Anda memiliki wewenang penuh (seperti admin grup WA). Anda dapat mengangkat supir menjadi Admin atau menurunkannya kembali, serta mengedit seluruh pengeluaran.
              </div>
            </div>
          )}

          {/* User List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Daftar Pengguna, Supir DT & Admin ({availableUsers.length} Terdaftar):
              </label>
              <span className="text-[11px] text-slate-500">
                {isAdmin ? 'Admin berhak mengangkat supir' : 'Akun Admin dilindungi PIN'}
              </span>
            </div>

            <div className="space-y-2">
              {availableUsers.map((user) => {
                const isSelected = user.id === currentUser.id;
                const isUserAdmin = user.role === 'admin';

                return (
                  <div
                    key={user.id}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                          user.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : user.role === 'operator'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {user.role === 'admin' ? (
                          <Crown className="w-5 h-5 text-amber-400" />
                        ) : user.role === 'operator' ? (
                          <Truck className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-xs sm:text-sm">{user.name}</span>
                          <span
                            className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                              user.role === 'admin'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : user.role === 'operator'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}
                          >
                            {user.role === 'admin' && <Star className="w-2.5 h-2.5 fill-amber-400" />}
                            {user.role === 'admin' ? 'ADMIN' : user.role === 'operator' ? 'SUPIR / DT' : 'AUDITOR'}
                          </span>

                          {isSelected && (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                              Akun Anda
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {user.roleLabel} • <span className="text-slate-500">{user.department}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action buttons (Switch Account & Admin promote/demote) */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* WhatsApp-Style Admin Privilege Changer: HANYA MUNCUL JIKA USER ADALAH ADMIN */}
                      {isAdmin && (
                        <>
                          {user.role === 'operator' ? (
                            <button
                              onClick={() => onUpdateRole(user.id, 'admin')}
                              title="Angkat supir/operator ini menjadi Admin penuh"
                              className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-lg border border-amber-500/40 flex items-center gap-1 transition"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span>Jadikan Admin</span>
                            </button>
                          ) : isUserAdmin && user.id !== currentUser.id ? (
                            <button
                              onClick={() => onUpdateRole(user.id, 'operator')}
                              title="Kembalikan role menjadi Supir/Operator biasa"
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-lg border border-slate-700 flex items-center gap-1 transition"
                            >
                              <ArrowDown className="w-3 h-3 text-slate-400" />
                              <span>Kembalikan jadi Supir</span>
                            </button>
                          ) : null}
                        </>
                      )}

                      {/* Select / Switch active account */}
                      <button
                        onClick={() => handleSelectAccount(user)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : !isAdmin && user.role === 'admin'
                            ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {!isAdmin && user.role === 'admin' && <Lock className="w-3 h-3 text-amber-400" />}
                        <span>{isSelected ? 'Sedang Dipakai' : !isAdmin && user.role === 'admin' ? 'Masuk (PIN)' : 'Gunakan Akun'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/40 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            * Menambah DT baru otomatis mendaftarkan supir selaku operator.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* PIN VERIFICATION MODAL FOR NON-ADMINS */}
      {showPinModal && pinTargetUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <KeyRound className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Verifikasi Otorisasi Admin</h4>
                <p className="text-[11px] text-slate-400">Akun Admin dilindungi keamanan PIN</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              Anda sedang login sebagai Supir. Masukkan PIN Admin untuk beralih ke akun{' '}
              <strong className="text-emerald-400">{pinTargetUser.name}</strong>.
            </p>

            {pinError && (
              <div className="p-2 mb-3 bg-rose-500/20 border border-rose-500/40 rounded-lg text-[11px] text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPin} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  PIN Admin (Default: <strong>1234</strong>)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  placeholder="Masukkan 4 digit PIN"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center tracking-widest text-base font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-sm"
                >
                  Verifikasi & Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
