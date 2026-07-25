import React, { useState } from 'react';
import { Menu, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROLE_TYPES } from '@/config/supabaseConfig';

const Header = ({ username, role, entityName, onLogout, onToggleSidebar }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Helper to safely get string from potential object
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      const candidate = val.name || val.username || val.label || 'Usuario';
      return typeof candidate === 'object' ? 'Usuario' : String(candidate);
    }
    return String(val);
  };

  const displayUsername = safeString(username);
  const displayEntityName = safeString(entityName) || 'Eclesia Digital';
  
  const rawRole = typeof role === 'object' && role !== null ? (role.role || role.name || '') : role;
  const safeRoleStr = typeof rawRole === 'object' ? '' : String(rawRole);

  const getRoleLabel = (r) => {
    const roleStr = String(r);
    switch(roleStr) {
      case ROLE_TYPES.ADMIN_GENERAL: return 'Administrador General';
      case ROLE_TYPES.DIOCESE: return 'Diócesis/Arquidiócesis';
      case ROLE_TYPES.PARISH: return 'Parroquia';
      case ROLE_TYPES.CHANCERY: return 'Cancillería';
      default: return roleStr || 'Usuario';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-0 z-30 lg:left-72 transition-all duration-300">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="hidden md:block flex-1">
            <h2 className="text-lg font-bold text-[#111111] whitespace-normal">
              {displayEntityName}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-[#D4AF37] hover:bg-gray-50">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border border-white"></span>
          </Button>

          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
            >
              <div className="w-8 h-8 bg-[#D4AF37]/20 rounded-full flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/30">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-bold text-[#111111] leading-none">{displayUsername}</p>
                <p className="text-xs text-gray-500 mt-1">{getRoleLabel(safeRoleStr)}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 animate-in fade-in zoom-in-95 duration-200">
                <div className="md:hidden px-4 py-2 border-b border-gray-100 mb-1">
                   <p className="font-bold text-sm text-[#111111]">{displayUsername}</p>
                   <p className="text-xs text-gray-500">{getRoleLabel(safeRoleStr)}</p>
                </div>
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;