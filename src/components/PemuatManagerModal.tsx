import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  RotateCcw,
} from 'lucide-react';

interface PemuatItem {
  id: string;
  name: string;
}

interface PemuatManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pemuatList: PemuatItem[];
  onAddPemuat: (name: string) => Promise<string>;
  onDeletePemuat: (id: string) => Promise<void>;
  onSelectPemuat?: (name: string) => void;
}

export const PemuatManagerModal: React.FC<PemuatManagerModalProps> = ({
  isOpen,
  onClose,
  pemuatList,
  onAddPemuat,
  onDeletePemuat,
  onSelectPemuat,
}) => {
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) {
      setErrorMessage('Nama pemuat tidak boleh kosong.');
      return;
    }

    // Cek duplikasi
    const exists = pemuatList.some(
      (p) => p.name.toLowerCase() === clean.toLowerCase()
    );
    if (exists) {
      setErrorMessage(`Nama "${clean}" sudah terdaftar di fitur otomatis.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onAddPemuat(clean);
      setSuccessMessage(`Nama "${clean}" berhasil disimpan ke fitur otomatis!`);
      setNewName('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan nama pemuat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: PemuatItem) => {
    if (
      !window.confirm(
        `Hapus nama "${item.name}" dari daftar otomatis? Nama ini tidak akan muncul lagi di tombol otomatis.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(item.id);
      await onDeletePemuat(item.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghapus nama pemuat.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Kelola Nama Pemuat TBS
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Fitur Otomatis
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tulis nama pemuat manual di bawah ini agar tersimpan dan muncul otomatis di pilihan form lapangan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Notification Messages */}
          {successMessage && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Input Manual Pemuat Baru */}
          <div className="bg-slate-950/80 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <label className="text-xs font-bold text-slate-200">
                Tulis Nama Pemuat Baru (Manual):
              </label>
            </div>

            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ketik nama (contoh: Sugeng, Supri, Joko)..."
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Menyimpan...' : '+ Simpan ke Otomatis'}</span>
              </button>
            </form>
            <p className="text-[11px] text-slate-500">
              * Nama yang disimpan di sini akan otomatis muncul sebagai tombol cepat (chip) di form input pengangkutan TBS.
            </p>
          </div>

          {/* Daftar Nama Pemuat Yang Sudah Tersimpan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Daftar Pemuat Tersimpan ({pemuatList.length}):
              </span>
              <span className="text-[11px] text-slate-500">
                Klik nama untuk langsung memilihnya di form
              </span>
            </div>

            {pemuatList.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                Belum ada pemuat yang tersimpan. Tulis nama di atas untuk menambahkan.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pemuatList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-2 group transition"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectPemuat) {
                          onSelectPemuat(item.name);
                          onClose();
                        }
                      }}
                      className="flex items-center gap-2 text-left truncate flex-1 cursor-pointer"
                      title={`Pilih ${item.name}`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-200 text-xs truncate group-hover:text-emerald-300">
                        {item.name}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition cursor-pointer"
                      title={`Hapus ${item.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Tersinkronisasi Real-Time dengan Cloud Firestore
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
