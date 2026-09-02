import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, Calendar, UserCheck, ChevronLeft, ChevronRight, Search, RefreshCw, Filter } from 'lucide-react';
import { useToast } from './Toast';
import { CustomSelect, type SelectOption } from './CustomSelect';

const timePresetOptions: SelectOption[] = [
  { value: 'all', label: 'Semua Waktu' },
  { value: 'today', label: 'Hari Ini' },
  { value: '7days', label: '7 Hari Terakhir' },
  { value: '30days', label: '30 Hari Terakhir' },
  { value: 'this_month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Custom Rentang Tanggal' },
];

export const SalesHistoryTable: React.FC = () => {
  const { showToast } = useToast();
  const [sales, setSales] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total_items: 0, total_pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [timePreset, setTimePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        time_preset: timePreset,
        date_from: dateFrom,
        date_to: dateTo,
      });

      const res = await fetch(`/api/sales?${q.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setSales(json.data);
        setPagination(json.pagination);
      }
    } catch {
      showToast('Gagal memuat riwayat penjualan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, timePreset, dateFrom, dateTo]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  const formatDateReadable = (isoStr: string) => {
    if (!isoStr) return '-';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '-';

    const datePart = date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${datePart}, ${hours}:${minutes}`;
  };

  return (
    <div className="space-y-6">
      {/* Search & Time Filter Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col space-y-3 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Riwayat Penjualan Domain</h2>
                <p className="text-xs text-slate-500">Daftar transaksi penjualan & domain yang telah terjual</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Search Input */}
              <div className="relative flex-1 sm:w-56">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari domain / catatan..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all"
                />
              </div>

              {/* Time Preset Select */}
              <CustomSelect
                options={timePresetOptions}
                value={timePreset}
                onChange={(val) => {
                  setTimePreset(val);
                  setPage(1);
                }}
                icon={<Calendar className="w-3.5 h-3.5" />}
              />

              <button
                onClick={() => fetchSales()}
                disabled={loading}
                className="p-2 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-all"
                title="Refresh Riwayat Penjualan"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Custom Date Range Pickers (Visible when timePreset === 'custom') */}
          {timePreset === 'custom' && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-fade-in">
              <span className="font-bold text-slate-700 flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span>Rentang Tanggal Custom:</span>
              </span>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Dari:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Sampai:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                    setPage(1);
                  }}
                  className="text-xs text-rose-600 font-semibold hover:underline ml-auto"
                >
                  Reset Tanggal
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Waktu Transaksi</th>
                <th className="p-4">Domain Terjual</th>
                <th className="p-4">Catatan Pembeli</th>
                <th className="p-4 text-right">Total Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && sales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    <div className="inline-flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                      <span>Memuat riwayat penjualan...</span>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500">
                    Belum ada riwayat penjualan yang sesuai kriteria filter.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 text-xs text-slate-700">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{formatDateReadable(s.sold_at)}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900 text-xs">
                          {s.item_count} Domain Bundling
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {s.items.map((it: any) => (
                            <span key={it.id} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                              {it.domain}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-xs text-slate-600">
                      {s.buyer_note ? (
                        <div className="flex items-center space-x-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{s.buyer_note}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="p-4 text-right font-extrabold text-emerald-700 text-sm">
                      {formatCurrency(s.total_price)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>Menampilkan {sales.length} dari {pagination.total_items} transaksi</div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-xl transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-700">
              Halaman {page} dari {pagination.total_pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
              disabled={page >= pagination.total_pages}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-xl transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
