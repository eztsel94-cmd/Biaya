import React, { useState, useEffect } from 'react';
import { TruckUnit, ExpenseRecord, ExpenseCategory } from '../types/truck';
import { CATEGORIES } from '../data/initialData';
import { PlusCircle, X, Check, AlertCircle } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  trucks: TruckUnit[];
  defaultTruckId?: string;
  onAddExpense: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  trucks,
  defaultTruckId,
  onAddExpense,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(todayStr);
  const [truckId, setTruckId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Minyak');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setTruckId(defaultTruckId || (trucks[0]?.id ?? ''));
      setDescription('');
      setAmount('');
      setVendor('');
      setInvoiceNumber('');
      setError(null);
    }
  }, [isOpen, defaultTruckId, trucks]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(/[^0-9]/g, ''));

    if (!truckId) {
      setError('Silakan pilih unit truk.');
      return;
    }
    if (!description.trim()) {
      setError('Keterangan pengeluaran wajib diisi.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Jumlah nominal biaya (Rp) harus lebih dari 0.');
      return;
    }
    if (!vendor.trim()) {
      setError('Nama vendor / bengkel / SPBU wajib diisi.');
      return;
    }

    onAddExpense({
      date,
      truckId,
      category,
      description: description.trim(),
      amount: parsedAmount,
      vendor: vendor.trim(),
      invoiceNumber: invoiceNumber.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/60">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Catat Biaya Unit TBS</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tanggal Transaksi *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Unit Truk TBS *</label>
              <select
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
              >
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.plateNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Kategori Biaya *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nominal Biaya (Rp) *</label>
              <input
                type="number"
                min="1000"
                step="500"
                placeholder="500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Keterangan Pengeluaran *</label>
            <input
              type="text"
              placeholder="Contoh: Pengisian Solar 120L atau Ganti oli mesin & filter"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Vendor / Bengkel / SPBU *</label>
              <input
                type="text"
                placeholder="Nama penyedia jasa/toko"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">No Nota / Kuitansi</label>
              <input
                type="text"
                placeholder="Opsional (SPBU-091)"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg shadow-sm transition"
            >
              Simpan Biaya
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
