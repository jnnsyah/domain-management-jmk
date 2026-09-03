import React from 'react';
import { ShoppingCart, FileText, X, Globe, Link, ExternalLink, XCircle } from 'lucide-react';

interface MultiSelectFloatingBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onOpenCheckout: () => void;
  onOpenHandover: () => void;
  onCopySelectedDomains: () => void;
  onCopySelectedUrls: () => void;
  onCopySelectedEndpoints: () => void;
  onRejectSelected?: () => void;
}

export const MultiSelectFloatingBar: React.FC<MultiSelectFloatingBarProps> = ({
  selectedCount,
  onClearSelection,
  onOpenCheckout,
  onOpenHandover,
  onCopySelectedDomains,
  onCopySelectedUrls,
  onCopySelectedEndpoints,
  onRejectSelected,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl animate-bounce-short">
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl p-3 sm:px-5 sm:py-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Selected Counter & Clear selection */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center">
            {selectedCount}
          </span>
          <span className="text-xs font-semibold text-slate-200 hidden sm:inline">
            Domain Terpilih
          </span>
          <button
            onClick={onClearSelection}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors ml-1"
            title="Batal Seleksi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons: Copy Domain, Copy URL (https://), Copy Endpoint, Reject, Handover, Catat Penjualan */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
          <button
            onClick={onCopySelectedDomains}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center space-x-1 border border-slate-700"
            title="Copy Semua Nama Domain Terpilih (example.com)"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Copy Domain</span>
          </button>

          <button
            onClick={onCopySelectedUrls}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center space-x-1 border border-slate-700"
            title="Copy Semua Domain URL Terpilih (https://example.com)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Copy URL</span>
          </button>

          <button
            onClick={onCopySelectedEndpoints}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center space-x-1 border border-slate-700"
            title="Copy Semua Primary Endpoint Terpilih"
          >
            <Link className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Copy Endpoint</span>
          </button>

          <button
            onClick={onOpenHandover}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1 border border-slate-700"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Handover</span>
          </button>

          {onRejectSelected && (
            <button
              onClick={onRejectSelected}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1 shadow-md shadow-rose-600/30"
              title="Tandai Domain Terpilih sebagai Reject"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Mark as Reject</span>
            </button>
          )}

          <button
            onClick={onOpenCheckout}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1 shadow-md shadow-emerald-600/30"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Catat Penjualan</span>
          </button>
        </div>

      </div>
    </div>
  );
};
