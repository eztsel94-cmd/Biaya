import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Shield,
  Smartphone,
  User,
  Info,
  Sparkles,
  Link2,
} from 'lucide-react';
import { getPemuatPortalUrl, getWhatsAppSharePemuatUrl } from '../utils/driverLink';

interface SharePemuatModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPemuatNames?: string[];
  onOpenPreview?: (pemuatName?: string) => void;
}

export const SharePemuatModal: React.FC<SharePemuatModalProps> = ({
  isOpen,
  onClose,
  existingPemuatNames = ['Anton', 'Bambang', 'Suryanto', 'Rahmad'],
  onOpenPreview,
}) => {
  const [selectedPemuat, setSelectedPemuat] = useState<string>('');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentPortalUrl = getPemuatPortalUrl(selectedPemuat || undefined);
  const waShareUrl = getWhatsAppSharePemuatUrl({
    pemuatName: selectedPemuat || undefined,
    phone: customPhone || undefined,
    directUrl: currentPortalUrl,
  });

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(currentPortalUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenDirect = () => {
    if (onOpenPreview) {
      onOpenPreview(selectedPemuat || undefined);
      onClose();
    } else {
      window.open(currentPortalUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Link Khusus Akses Pemuat
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Terisolasi
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bagi tautan khusus untuk pemuat di lapangan tanpa membuka data admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Security & Isolation Callout */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-emerald-300">
                100% Terisolasi & Aman untuk Pekerja Lapangan
              </p>
              <p className="text-slate-300 leading-relaxed">
                Pemuat yang membuka link ini <strong>hanya dapat mengakses</strong> form input pengiriman TBS dan tabel riwayat ritase harian. Menu <em>Dashboard Biaya</em>, <em>Armada</em>, <em>Biaya Unit</em>, dan <em>Data Manager</em> <strong>tidak akan ditampilkan</strong> sama sekali.
              </p>
            </div>
          </div>

          {/* Target Pemuat Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Target Pemuat (Opsional):
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {selectedPemuat ? `Terkunci untuk: ${selectedPemuat}` : 'Semua Pemuat'}
              </span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSelectedPemuat('')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition ${
                  selectedPemuat === ''
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                Semua Pemuat
              </button>
              {existingPemuatNames.slice(0, 3).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedPemuat(name)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition truncate ${
                    selectedPemuat === name
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={selectedPemuat}
              onChange={(e) => setSelectedPemuat(e.target.value)}
              placeholder="Atau ketik nama pemuat spesifik (contoh: Anton)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Link URL Display & Copy */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-emerald-400" />
              Tautan Khusus Pemuat (Siap Dibagikan):
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 font-mono text-xs text-emerald-400 truncate select-all">
                {currentPortalUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer ${
                  copied
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Kirim via WhatsApp */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Kirim Langsung ke WhatsApp Pemuat</span>
              </div>
              <span className="text-[10px] text-slate-400">Pesan otomatis disiapkan</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="Nomor HP/WA Pemuat (contoh: 08123456789)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <a
                href={waShareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shrink-0 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Buka WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Quick Preview Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenDirect}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Buka Pratinjau Tampilan Pemuat (Mode Terisolasi)</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-500" />
            <span>Pemuat dapat membuka link ini dari browser HP apapun.</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
