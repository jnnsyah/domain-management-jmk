import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Copy, Check, ShieldCheck, Trash2, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from './Toast';

interface SlideOverDrawerProps {
  websiteId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({ websiteId, isOpen, onClose, onRefresh }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [addingEp, setAddingEp] = useState(false);

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
    if (isOpen && websiteId) {
      fetchDetail();
    } else {
      setData(null);
    }
  }, [isOpen, websiteId]);

  const fetchDetail = async () => {
    if (!websiteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
      } else {
        showToast(json.error?.message || 'Gagal memuat detail website.', 'error');
      }
    } catch {
      showToast('Gangguan jaringan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndpointUrl.trim() || !websiteId) return;

    setAddingEp(true);
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_id: websiteId, url: newEndpointUrl.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Endpoint baru berhasil ditambahkan!', 'success');
        setNewEndpointUrl('');
        fetchDetail();
        onRefresh();
      } else {
        showToast(json.error?.message || 'Gagal menambah endpoint.', 'error');
      }
    } catch {
      showToast('Gangguan jaringan.', 'error');
    } finally {
      setAddingEp(false);
    }
  };

  const handleSetPrimary = async (endpointId: string) => {
    try {
      const res = await fetch(`/api/endpoints/${endpointId}`, { method: 'PUT' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Endpoint primary diperbarui!', 'success');
        fetchDetail();
        onRefresh();
      }
    } catch {
      showToast('Gagal mengubah primary endpoint.', 'error');
    }
  };

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus endpoint ini?')) return;
    try {
      const res = await fetch(`/api/endpoints/${endpointId}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Endpoint berhasil dihapus!', 'success');
        fetchDetail();
        onRefresh();
      }
    } catch {
      showToast('Gagal menghapus endpoint.', 'error');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text || text === 'UNRESOLVED') return;
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin ke clipboard!`, 'info');
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
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {data ? data.domain : 'Detail Website'}
                </h2>
                <p className="text-xs text-slate-500">ID: {websiteId}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  <span>Memuat detail...</span>
                </div>
              ) : data ? (
                <>
                  {/* General Info Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 flex items-center justify-between">
                      <span>Informasi Umum</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.status === 'sold' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {data.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">IP Address:</span>
                      <button onClick={() => copyToClipboard(data.ip, 'IP')} className="font-mono text-slate-900 font-bold hover:text-indigo-600">
                        {data.ip || 'UNRESOLVED'}
                      </button>
                    </div>

                    {data.login_url && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Login URL:</span>
                        <a href={data.login_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-mono hover:underline truncate max-w-[240px]">
                          {data.login_url}
                        </a>
                      </div>
                    )}

                    {data.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-900 font-semibold">{data.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Credentials Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Kredensial Raw Plaintext</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500">Username:</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-900 font-bold">{data.login_user || '-'}</span>
                        {data.login_user && (
                          <button onClick={() => copyToClipboard(data.login_user, 'Username')} className="text-slate-400 hover:text-indigo-600">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500">Password (RAW):</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-900 font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                          {data.credentials.login_password || '-'}
                        </span>
                        {data.credentials.login_password && (
                          <button onClick={() => copyToClipboard(data.credentials.login_password, 'Password RAW')} className="text-slate-400 hover:text-indigo-600">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {data.credentials.gsocket_user && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-500">Gsocket User (RAW):</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {data.credentials.gsocket_user}
                          </span>
                          <button onClick={() => copyToClipboard(data.credentials.gsocket_user, 'Gsocket User RAW')} className="text-slate-400 hover:text-indigo-600">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Endpoints List */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
                      Daftar Endpoint ({data.endpoints?.length || 0})
                    </div>

                    {data.status !== 'sold' && (
                      <form onSubmit={handleAddEndpoint} className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="https://..."
                          value={newEndpointUrl}
                          onChange={(e) => setNewEndpointUrl(e.target.value)}
                          required
                          className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={addingEp || !newEndpointUrl.trim()}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </form>
                    )}

                    <div className="space-y-2">
                      {data.endpoints?.map((epItem: any) => (
                        <div key={epItem.id} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center space-x-1 mb-0.5">
                              {epItem.is_primary && (
                                <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-bold rounded">PRIMARY</span>
                              )}
                              <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${epItem.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                                {epItem.status_code ? `HTTP ${epItem.status_code}` : epItem.is_active ? 'LIVE' : 'UNCHECKED'}
                              </span>
                            </div>
                            <a href={epItem.url} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-slate-800 hover:text-indigo-600 truncate block">
                              {epItem.url}
                            </a>
                          </div>

                          {data.status !== 'sold' && (
                            <div className="flex items-center space-x-1 shrink-0">
                              {!epItem.is_primary && (
                                <button
                                  onClick={() => handleSetPrimary(epItem.id)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded border border-slate-200"
                                >
                                  Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteEndpoint(epItem.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Sidebar Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end sticky bottom-0 z-10">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
