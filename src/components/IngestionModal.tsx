import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle2, AlertCircle, Clipboard, Plus, RefreshCw } from 'lucide-react';
import { parseRawTextMulti } from '@/lib/parser';
import { useToast } from './Toast';

interface IngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface BatchResult {
  domain: string;
  action: 'created' | 'updated' | 'skipped';
  reason?: string;
}

export const IngestionModal: React.FC<IngestionModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<BatchResult[] | null>(null);

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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRawText('');
      setErrorMsg(null);
      setResults(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedPreview = rawText.trim() ? parseRawTextMulti(rawText) : null;

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        showToast('Teks berhasil ditempel dari clipboard!', 'success');
      } else {
        showToast('Clipboard kosong.', 'error');
      }
    } catch {
      showToast('Gagal membaca clipboard. Silakan tempel manual (Ctrl+V).', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setResults(null);

    try {
      const res = await fetch('/api/websites/batch-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawText }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResults(data.data.results);
        
        const { created, updated, skipped, total } = data.data;
        
        // Show summary toast
        if (skipped === 0) {
          showToast(`${total} domain berhasil diproses (${created} baru, ${updated} diperbarui)`, 'success');
        } else {
          showToast(`${total} domain diproses: ${created} baru, ${updated} diperbarui, ${skipped} dilewati`, 'success');
        }
        
        onSuccess();
      } else {
        setErrorMsg(data.error?.message || 'Gagal menyimpan data domain.');
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
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">Batch Ingest Multi Domain</h2>
                  <p className="text-xs text-slate-500">Paste raw text untuk banyak domain sekaligus</p>
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Raw Text Input</label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
                    title="Tempel dari Clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Paste dari Clipboard</span>
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`domain: example1.com\nusername: admin\npassword: secret123\nlogin_url: https://example1.com/wp-login.php\nendpoint:\nhttps://example1.com/shell1.php\n---\ndomain: example2.com\nusername: admin2\npassword: secret456\nlogin_url: https://example2.com/wp-login.php\nendpoint:\nhttps://example2.com/shell1.php`}
                  className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Pisahkan setiap domain dengan <code className="bg-slate-100 px-1 rounded">---</code> atau baris kosong ganda
                </p>
              </div>

              {/* Live Multi-Domain Preview */}
              {parsedPreview && parsedPreview.total > 0 && (
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3 text-xs">
                  <div className="font-semibold text-indigo-900 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    <span>Terdeteksi {parsedPreview.total} domain:</span>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parsedPreview.domains.map((domain, i) => (
                      <div key={i} className="p-2 bg-white/60 rounded-lg border border-indigo-100">
                        <div className="font-semibold text-slate-900 mb-1">
                          {i + 1}. {domain.domain}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-slate-600">
                          <div>User: <strong className="text-slate-800">{domain.login_user || '-'}</strong></div>
                          <div>Pass: <strong className="text-slate-800">{domain.login_password ? '•••••' : '-'}</strong></div>
                          <div>Login URL: <strong className="text-slate-800">{domain.login_url ? '✓' : '-'}</strong></div>
                          <div>Endpoints: <strong className="text-slate-800">{domain.endpoints.length}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch Results */}
              {results && results.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-3 text-xs">
                  <div className="font-semibold text-emerald-900 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Hasil Proses ({results.length} domain):</span>
                  </div>
                  
                  <div className="space-y-1">
                    {results.map((result, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                        <span className="font-mono text-slate-800">{result.domain}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          result.action === 'created' ? 'bg-emerald-500 text-white' :
                          result.action === 'updated' ? 'bg-blue-500 text-white' :
                          'bg-slate-300 text-slate-700'
                        }`}>
                          {result.action === 'created' ? 'NEW' : result.action === 'updated' ? 'UPDATED' : 'SKIPPED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sidebar Footer Action */}
              <div className="mt-auto pt-4 border-t border-slate-200 flex items-center justify-between space-x-3 bg-white sticky bottom-0">
                <div className="text-xs text-slate-500">
                  {parsedPreview && parsedPreview.total > 0 && (
                    <span>{parsedPreview.total} domain siap diproses</span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !rawText.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 touch-manipulation flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Simpan {parsedPreview?.total || 0} Domain</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};
