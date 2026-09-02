import React from 'react';
import { Plus, LogOut, LayoutDashboard, ShoppingBag, Shield } from 'lucide-react';
import { useToast } from './Toast';

interface NavbarProps {
  currentPath?: string;
  onOpenIngestModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath = '/', onOpenIngestModal }) => {
  const { showToast } = useToast();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        showToast('Berhasil logout dari sistem.', 'info');
        window.location.href = '/login';
      }
    } catch {
      showToast('Gagal melakukan logout.', 'error');
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-indigo-600/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Web & Domain Manager</h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">Inventory, Health Checker & Sales</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <a
              href="/"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                currentPath === '/'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </a>

            <a
              href="/sales"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                currentPath === '/sales'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Penjualan</span>
            </a>
          </nav>

          {/* Action Buttons: Add Domain & Logout */}
          <div className="flex items-center space-x-2.5">
            {onOpenIngestModal && (
              <button
                onClick={onOpenIngestModal}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 touch-manipulation"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Domain</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
