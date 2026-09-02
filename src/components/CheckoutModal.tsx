import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, AlertCircle, Plus, Minus, RotateCcw } from 'lucide-react';
import { useToast } from './Toast';

interface CheckoutModalProps {
  isOpen: boolean;
  selectedDomains: { id: string; domain: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, selectedDomains, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [totalPriceNum, setTotalPriceNum] = useState<number>(0);
  const [buyerNote, setBuyerNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Close drawer when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDots = (num: number) => {
    if (!num || isNaN(num)) return '';
    return num.toLocaleString('id-ID');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const num = parseInt(rawDigits, 10);
    setTotalPriceNum(isNaN(num) ? 0 : num);
  };

  const handleStepPrice = (delta: number) => {
    setTotalPriceNum((prev) => Math.max(0, prev + delta));
  };

  const handleAddPreset = (amount: number) => {
    setTotalPriceNum((prev) => Math.max(0, prev + amount));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPriceNum <= 0 || selectedDomains.length === 0) {
      setErrorMsg('Harap masukkan total harga penjualan.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_ids: selectedDomains.map(d => d.id),
          total_price: totalPriceNum,
          buyer_note: buyerNote,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`Catat penjualan ${selectedDomains.length} domain sebesar ${formatRupiah(totalPriceNum)} berhasil!`, 'success');
        setTotalPriceNum(0);
        setBuyerNote('');
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error?.message || 'Gagal mencatat penjualan.');
      }
    } catch {
      setErrorMsg('Gangguan jaringan. Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Clickable Backdrop Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
          {/* Sidebar Drawer Container */}
          <div className="pointer-events-auto w-screen max-w-full sm:max-w-xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
            
            {/* Sidebar Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">Catat Penjualan Domain</h2>
                  <p className="text-xs text-slate-500">{selectedDomains.length} domain terpilih untuk dicatat</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Body */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-6 space-y-5">
              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Selected Domains Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="text-slate-500 font-semibold mb-1">Domain dalam Paket Bundling ({selectedDomains.length}):</div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {selectedDomains.map((d) => (
                    <div key={d.id} className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between font-mono text-slate-800">
                      <span>{d.domain}</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-sans px-2 py-0.5 rounded-full font-bold">Bundled</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Price Input with Real-time Dots Separator (+/- 50k) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-700">Total Harga Penjualan (Rupiah)</label>
                  <span className="text-sm font-extrabold text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                    {formatRupiah(totalPriceNum)}
                  </span>
                </div>

                {/* Real-time Formatted Text Input + Stepper 50k */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleStepPrice(-50000)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center space-x-1 shrink-0"
                    title="Kurangi Rp 50.000 (-50k)"
                  >
                    <Minus className="w-4 h-4" />
                    <span>50k</span>
                  </button>

                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-extrabold text-sm">
                      Rp
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatDots(totalPriceNum)}
                      onChange={handleInputChange}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-base font-extrabold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStepPrice(50000)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center space-x-1 shrink-0"
                    title="Tambah Rp 50.000 (+50k)"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>50k</span>
                  </button>
                </div>

                {/* Shortcut Preset Buttons (Kelipatan 100k) */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs text-slate-500 font-semibold">Shortcut Tambah Nominal (Kelipatan 100k):</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddPreset(100000)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all"
                    >
                      +100rb
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPreset(200000)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all"
                    >
                      +200rb
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPreset(500000)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all"
                    >
                      +500rb
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPreset(1000000)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold rounded-xl transition-all"
                    >
                      +1 Juta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPreset(2000000)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold rounded-xl transition-all"
                    >
                      +2 Juta
                    </button>
                    <button
                      type="button"
                      onClick={() => setTotalPriceNum(0)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1"
                      title="Reset Nominal"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Pembeli / Kontrak (Opsional)</label>
                <textarea
                  rows={3}
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="misal: Telegram @buyer123 / Transfer BCA"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                />
              </div>

              {/* Sidebar Footer Action */}
              <div className="mt-auto pt-4 border-t border-slate-200 flex items-center justify-end space-x-3 bg-white sticky bottom-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || totalPriceNum <= 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 touch-manipulation"
                >
                  {loading ? 'Memproses...' : 'Simpan Catatan Penjualan'}
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};
