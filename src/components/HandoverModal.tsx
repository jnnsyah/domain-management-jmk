import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileText } from 'lucide-react';
import { useToast } from './Toast';

interface HandoverModalProps {
  isOpen: boolean;
  selectedDomains: { id: string; domain: string }[];
  onClose: () => void;
}

export const HandoverModal: React.FC<HandoverModalProps> = ({ isOpen, selectedDomains, onClose }) => {
  const { showToast } = useToast();
  const [handoverText, setHandoverText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (isOpen && selectedDomains.length > 0) {
      fetchHandoverText();
    }
  }, [isOpen, selectedDomains]);

  const fetchHandoverText = async () => {
    setLoading(true);
    try {
      const items = selectedDomains.map(d => ({ website_id: d.id }));
      const res = await fetch('/api/websites/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHandoverText(data.handover_text);
      }
    } catch {
      setHandoverText('Gagal memuat teks handover.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (!handoverText) return;
    navigator.clipboard.writeText(handoverText);
    setCopied(true);
    showToast('Teks Handover berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

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
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">Data Handover Sidebar</h2>
                  <p className="text-xs text-slate-500">{selectedDomains.length} domain terformat untuk pembeli</p>
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
            <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col">
              {loading ? (
                <div className="flex-1 flex items-center justify-center py-12 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <textarea
                  readOnly
                  rows={16}
                  value={handoverText}
                  className="w-full flex-1 p-4 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-600 resize-none select-all"
                />
              )}
            </div>

            {/* Sidebar Footer Action */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between sticky bottom-0 z-10">
              <span className="text-xs text-slate-500 font-medium">{selectedDomains.length} domain</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Tutup
                </button>
                <button
                  onClick={handleCopyAll}
                  disabled={loading || !handoverText}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 touch-manipulation disabled:opacity-50"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Tersalin!' : 'Copy Semua Handover'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
