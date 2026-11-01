import React, { useState } from 'react';
import {
  Settings,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  RotateCcw,
  Key,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Server,
  Zap,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  DEFAULT_FIREBASE_CONFIG,
  getCurrentFirebaseConfig,
  getCustomFirebaseConfig,
  saveCustomFirebaseConfig,
  resetToDefaultFirebaseConfig,
  isUsingCustomFirebase,
  testFirebaseConnection,
} from '../services/firebase';

interface SettingsViewProps {
  onRefreshApp?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = () => {
  const currentConfig = getCurrentFirebaseConfig();
  const [formData, setFormData] = useState({
    apiKey: currentConfig.apiKey || '',
    authDomain: currentConfig.authDomain || '',
    projectId: currentConfig.projectId || '',
    storageBucket: currentConfig.storageBucket || '',
    messagingSenderId: currentConfig.messagingSenderId || '',
    appId: currentConfig.appId || '',
    measurementId: currentConfig.measurementId || '',
  });

  const [rawConfigInput, setRawConfigInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const isCustom = isUsingCustomFirebase();

  // Parse raw pasted config snippet (e.g. const firebaseConfig = { ... })
  const handleParseRawSnippet = () => {
    if (!rawConfigInput.trim()) return;
    try {
      let cleaned = rawConfigInput.trim();
      // Remove variable declarations
      cleaned = cleaned.replace(/^(const|let|var)\s+\w+\s*=\s*/, '');
      // Remove trailing semicolon
      cleaned = cleaned.replace(/;+\s*$/, '');

      // Try JSON parse first
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Fallback key-value regex extraction
        const apiKey = cleaned.match(/apiKey\s*:\s*["']([^"']+)["']/i)?.[1];
        const authDomain = cleaned.match(/authDomain\s*:\s*["']([^"']+)["']/i)?.[1];
        const projectId = cleaned.match(/projectId\s*:\s*["']([^"']+)["']/i)?.[1];
        const storageBucket = cleaned.match(/storageBucket\s*:\s*["']([^"']+)["']/i)?.[1];
        const messagingSenderId = cleaned.match(/messagingSenderId\s*:\s*["']([^"']+)["']/i)?.[1];
        const appId = cleaned.match(/appId\s*:\s*["']([^"']+)["']/i)?.[1];
        const measurementId = cleaned.match(/measurementId\s*:\s*["']([^"']+)["']/i)?.[1];

        if (apiKey || projectId) {
          parsed = {
            apiKey: apiKey || '',
            authDomain: authDomain || '',
            projectId: projectId || '',
            storageBucket: storageBucket || '',
            messagingSenderId: messagingSenderId || '',
            appId: appId || '',
            measurementId: measurementId || '',
          };
        }
      }

      if (parsed && (parsed.apiKey || parsed.projectId)) {
        setFormData((prev) => ({
          ...prev,
          apiKey: parsed.apiKey || prev.apiKey,
          authDomain: parsed.authDomain || prev.authDomain,
          projectId: parsed.projectId || prev.projectId,
          storageBucket: parsed.storageBucket || prev.storageBucket,
          messagingSenderId: parsed.messagingSenderId || prev.messagingSenderId,
          appId: parsed.appId || prev.appId,
          measurementId: parsed.measurementId || prev.measurementId,
        }));
        setRawConfigInput('');
        setTestResult({
          success: true,
          message: 'Kode konfigurasi berhasil diekstrak ke dalam formulir di bawah!',
        });
      } else {
        setTestResult({
          success: false,
          message: 'Format teks konfigurasi tidak dikenali. Pastikan menyalin objek firebaseConfig lengkap.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Gagal memproses cuplikan teks: ' + err.message,
      });
    }
  };

  // Test current form configuration
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testFirebaseConnection(formData);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal menguji koneksi Firebase',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save to localStorage & reload
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectId.trim() || !formData.apiKey.trim()) {
      setTestResult({
        success: false,
        message: 'Project ID dan API Key wajib diisi.',
      });
      return;
    }

    saveCustomFirebaseConfig({
      apiKey: formData.apiKey.trim(),
      authDomain: formData.authDomain.trim(),
      projectId: formData.projectId.trim(),
      storageBucket: formData.storageBucket.trim(),
      messagingSenderId: formData.messagingSenderId.trim(),
      appId: formData.appId.trim(),
      measurementId: formData.measurementId.trim(),
    });

    setSaveSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  // Reset to default system configuration
  const handleResetDefault = () => {
    if (window.confirm('Kembalikan konfigurasi Firebase ke setelan default sistem (traksi-22f5b)?')) {
      resetToDefaultFirebaseConfig();
      setSaveSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  const sampleRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(sampleRules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Pengaturan Firebase Firestore
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                    isCustom
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {isCustom ? 'Koneksi Kustom' : 'Koneksi Default Sistem'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Kelola kredensial proyek Firebase Anda sendiri untuk menyimpan seluruh armada, catatan harian TBS, dan pengeluaran secara mandiri.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-semibold text-slate-200 transition cursor-pointer"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <Zap className="w-4 h-4 text-amber-400" />
              )}
              <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
            </button>

            {isCustom && (
              <button
                type="button"
                onClick={handleResetDefault}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-500/40 border border-slate-700 text-xs font-semibold text-rose-300 transition cursor-pointer"
                title="Reset ke Firebase Default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Default</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications / Test Results */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-200 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Konfigurasi berhasil disimpan! Memuat ulang halaman aplikasi untuk menghubungkan database...</span>
        </div>
      )}

      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs sm:text-sm animate-in fade-in ${
            testResult.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold block mb-0.5">
              {testResult.success ? 'Koneksi Berhasil' : 'Koneksi Gagal'}
            </span>
            <span>{testResult.message}</span>
          </div>
        </div>
      )}

      {/* Quick Paste / Import Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">
            Tempel Cepat Cuplikan Konfigurasi (Opsional)
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Salin seluruh blok <code className="text-emerald-400 font-mono">const firebaseConfig = &#123; ... &#125;;</code> dari Firebase Console dan tempel di sini untuk mengisi otomatis semua kolom formulir.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            rows={2}
            value={rawConfigInput}
            onChange={(e) => setRawConfigInput(e.target.value)}
            placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "nama-proyek",\n  ...\n};`}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <button
            type="button"
            onClick={handleParseRawSnippet}
            disabled={!rawConfigInput.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ekstrak & Isi</span>
          </button>
        </div>
      </div>

      {/* Main Form: Dynamic Firebase Configuration */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Kredensial Firebase Firestore</h2>
              <p className="text-xs text-slate-400">Parameter koneksi database cloud Firestore</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
            Proyek Aktif: <strong className="text-emerald-400">{formData.projectId || '-'}</strong>
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <span>Project ID</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                placeholder="contoh: traksi-tbs-riau"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <span>API Key</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="contoh: AIzaSyAzsj..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Auth Domain */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Auth Domain
              </label>
              <input
                type="text"
                value={formData.authDomain}
                onChange={(e) => setFormData({ ...formData, authDomain: e.target.value })}
                placeholder="contoh: traksi-tbs.firebaseapp.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Storage Bucket */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Storage Bucket
              </label>
              <input
                type="text"
                value={formData.storageBucket}
                onChange={(e) => setFormData({ ...formData, storageBucket: e.target.value })}
                placeholder="contoh: traksi-tbs.appspot.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Messaging Sender ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Messaging Sender ID
              </label>
              <input
                type="text"
                value={formData.messagingSenderId}
                onChange={(e) => setFormData({ ...formData, messagingSenderId: e.target.value })}
                placeholder="contoh: 900195003298"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* App ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                App ID
              </label>
              <input
                type="text"
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                placeholder="contoh: 1:900195003298:web:c04964..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              * Kredensial tersimpan secara aman di peramban (browser local storage) perangkat Anda.
            </p>

            <button
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan & Terapkan Konfigurasi</span>
            </button>
          </div>
        </form>
      </div>

      {/* Guide: How to get Firebase credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step by Step Guide */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">
              Cara Mendapatkan Konfigurasi Firebase
            </h3>
          </div>
          <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              Buka <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a> dan buat proyek baru.
            </li>
            <li>Di dashboard proyek, klik ikon <strong>Web (&lt;/&gt;)</strong> untuk menambahkan aplikasi web.</li>
            <li>Beri nama aplikasi (contoh: <em>Truk TBS</em>) lalu salin nilai objek <code>firebaseConfig</code>.</li>
            <li>Buka menu <strong>Firestore Database</strong> &gt; klik <strong>Create Database</strong>.</li>
            <li>Tempel nilai konfigurasi ke dalam formulir pengaturan di atas lalu klik <strong>Simpan & Terapkan</strong>.</li>
          </ol>
        </div>

        {/* Security Rules Guide */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                Aturan Akses Firestore (Security Rules)
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCopyRules}
              className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRules ? 'Tersalin' : 'Salin Aturan'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Agar aplikasi dapat membaca dan menulis data ke Firestore secara langsung, pastikan tab <strong>Rules</strong> di Firestore diatur ke:
          </p>
          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto">
            {sampleRules}
          </pre>
        </div>
      </div>
    </div>
  );
};
