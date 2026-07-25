import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
    Church, LogOut, Settings as SettingsIcon, LayoutDashboard, 
    Users, Network, ChevronRight, Database, Sliders, 
    HeartHandshake as Handshake, ScrollText, Heart, List, 
    FileText, Bell, AlertCircle, Mail, Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

// =========================================================================
// 🧩 COMPONENTE: ITEM INDIVIDUAL (Mantiene recursión y lógica de insignias)
// =========================================================================
const SidebarItem = ({ item, isActive, isChild = false, badgeCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const location = useLocation();

  // Lógica de extracción de etiqueta segura (Código 1)
  const getSafeLabel = (lbl) => {
      if (typeof lbl === 'string') return lbl;
      if (typeof lbl === 'object' && lbl !== null) {
          const candidate = lbl.name || lbl.label || 'Menú';
          return typeof candidate === 'object' ? 'Menú' : String(candidate);
      }
      return 'Menú';
  };
  const label = getSafeLabel(item.label);

  // Auto-expandir si el usuario está dentro de una ruta hija
  useEffect(() => {
    if (hasChildren) {
      const childActive = item.children.some(child => location.pathname.startsWith(child.path));
      if (childActive) setIsOpen(true);
    }
  }, [location.pathname, hasChildren, item.children]);

  if (hasChildren) {
    return (
      <div className="mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 group",
            isOpen ? "bg-slate-50" : "hover:bg-gray-50"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
                "p-2 rounded-xl transition-all",
                isOpen || isActive ? "bg-[#D4AF37] text-white shadow-lg shadow-yellow-500/20" : "bg-gray-100 text-gray-400 group-hover:text-gray-600"
            )}>
                {item.icon && <item.icon className="w-4 h-4" />}
            </div>
            <span className={cn(
                "text-[11px] font-black uppercase tracking-widest",
                isOpen || isActive ? "text-gray-900" : "text-gray-500"
            )}>{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {badgeCount > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                    {badgeCount}
                </span>
            )}
            <ChevronRight className={cn("w-4 h-4 text-gray-300 transition-transform duration-300", isOpen && "rotate-90 text-[#D4AF37]")} />
          </div>
        </button>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-1 ml-6 pl-4 border-l-2 border-gray-100 space-y-1">
                {item.children.map((child, idx) => {
                  const isChildActive = location.pathname.startsWith(child.path);
                  return (
                    <SidebarItem 
                      key={idx} 
                      item={child} 
                      isActive={isChildActive}
                      isChild={true}
                      badgeCount={child.badgeCount}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      className={cn(
        "flex items-center justify-between py-3 px-4 mb-2 rounded-2xl transition-all duration-300 group",
        isActive 
          ? "bg-[#4B7BA7] text-white shadow-xl shadow-blue-900/20" 
          : isChild ? "hover:bg-slate-100 text-gray-500 hover:text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
            "p-2 rounded-xl transition-all",
            isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400 group-hover:text-gray-600"
        )}>
            {item.icon && <item.icon className="w-4 h-4" />}
        </div>
        <span className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            isActive ? "text-white" : "text-gray-500"
        )}>{label}</span>
      </div>
      
      {badgeCount > 0 && (
        <span className={cn(
            "text-[9px] font-black px-2 py-0.5 rounded-full",
            isActive ? "bg-white text-[#4B7BA7]" : "bg-red-500 text-white animate-pulse"
        )}>
            {badgeCount}
        </span>
      )}
    </Link>
  );
};

// =========================================================================
// 🏛️ COMPONENTE PRINCIPAL: SIDEBAR
// =========================================================================
const Sidebar = ({ isOpen, onClose, onLogout, role }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { getParishNotifications, matrimonialNotificationAvisos } = useAppData();
  
  const [notificationCount, setNotificationCount] = useState(0);
  const [avisosCount, setAvisosCount] = useState(0);

  // Lógica de Rol Blindada (Código 1)
  const safeRole = typeof role === 'object' && role !== null 
    ? (role.role || role.name || '') 
    : String(role || '');

  useEffect(() => {
    if (safeRole === ROLE_TYPES.PARISH && user?.parishId) {
        const notifications = getParishNotifications(user.parishId);
        
        // Filtramos solo las 'unread'
        const unreadCount = notifications.filter(notif => notif.status === 'unread').length;
        setNotificationCount(unreadCount);
        
        const pendingAvisos = (matrimonialNotificationAvisos || []).filter(a => a.status === 'pendiente');
        setAvisosCount(pendingAvisos.length);
    }
  }, [location, getParishNotifications, matrimonialNotificationAvisos, user, safeRole]);

  // --- ESTRUCTURA DE MENÚS DINÁMICOS (Restaurada de Código 1) ---
  const getMenuItems = () => {
    if (safeRole === ROLE_TYPES.ADMIN_GENERAL) {
        return [
            { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
            { label: 'Diócesis/Arquidiócesis', path: '/admin/dioceses', icon: Church },
            { label: 'Ajustes', path: '/admin/settings', icon: SettingsIcon }
        ];
    } 
    if (safeRole === ROLE_TYPES.DIOCESE) {
        return [
            { label: 'Dashboard', path: '/diocese/dashboard', icon: LayoutDashboard },
            { label: 'Organización Eclesiástica', path: '/diocese/ecclesiastical', icon: Network },
            { label: 'Comunicaciones', path: '/communications', icon: Users },
            { label: 'Ajustes', path: '/diocese/settings', icon: SettingsIcon }
        ];
    } 
    if (safeRole === ROLE_TYPES.PARISH) {
        return [
            { label: 'Dashboard', path: '/parish/dashboard', icon: LayoutDashboard },
            { label: 'Notificaciones Cancillería', path: '/parish/notifications', icon: Bell, badgeCount: notificationCount },
            {
                label: 'Bautismo',
                icon: Church,
                children: [
                    { label: 'Nuevo Bautizo', path: '/parroquia/bautismo/nuevo' },
                    { label: 'Bautismo Celebrado', path: '/parroquia/bautismo/celebrado' },
                    { label: 'Sentar Registros', path: '/parroquia/bautismo/sentar-registros' },
                    { label: 'Editar Bautizo', path: '/parroquia/bautismo/editar' },
                    { label: 'Partidas', path: '/parroquia/bautismo/partidas' },
                    { label: 'Índice General', path: '/parroquia/bautismo/indice', icon: List },
                    { label: 'Base de Datos', path: '/parroquia/bautismo/base-datos', icon: Database },
                ]
            },
            { 
                label: 'Confirmación',
                icon: Handshake, 
                children: [
                    { label: 'Nueva Confirmación', path: '/parroquia/confirmacion/nuevo' },
                    { label: 'Confirmación Celebrada', path: '/parroquia/confirmacion/celebrado' },
                    { label: 'Sentar Registros', path: '/parroquia/confirmacion/sentar-registros' },
                    { label: 'Editar Confirmación', path: '/parroquia/confirmacion/editar' },
                    { label: 'Partidas', path: '/parroquia/confirmacion/partidas' },
                    { label: 'Índice General', path: '/parroquia/confirmacion/indice', icon: List },
                ]
            },
            { 
                label: 'Matrimonio',
                icon: Heart,
                badgeCount: avisosCount,
                children: [
                    { label: 'Nuevo Matrimonio', path: '/parroquia/matrimonio/nuevo' },
                    { label: 'Matrimonio Celebrado', path: '/parroquia/matrimonio/celebrado' },
                    { label: 'Sentar Registros', path: '/parroquia/matrimonio/sentar-registros' },
                    { label: 'Editar Matrimonio', path: '/parroquia/matrimonio/editar' },
                    { label: 'Partidas', path: '/parroquia/matrimonio/partidas' },
                    { label: 'Índice General', path: '/parroquia/matrimonio/indice', icon: List },
                    { label: 'Notificación', path: '/parroquia/matrimonio/notificacion', icon: Mail },
                    { label: 'Aviso Alerta', path: '/parroquia/matrimonio/aviso-notificacion', icon: AlertCircle, badgeCount: avisosCount },
                ]
            },
            { label: 'Datos Auxiliares', path: '/datos-auxiliares', icon: Database },
            { label: 'Parámetros', path: '/parroquia/parametros', icon: Sliders },
            {
                label: 'Decretos',
                icon: FileText,
                children: [
                    { label: 'Nuevo D. Reposición', path: '/parish/decree-replacement/new' },
                    { label: 'Nuevo D. Corrección', path: '/parish/decree-correction/new' },
                    { label: 'Ver Reposición', path: '/parish/decree-replacement/view' },
                    { label: 'Ver Corrección', path: '/parish/decree-correction/view' },
                    { label: 'Editar Reposición', path: '/parish/decree-replacement/edit' },
                    { label: 'Editar Corrección', path: '/parish/decree-correction/edit' },
                    { label: 'Conceptos Anulación', path: '/parish/annulment-concepts' },
                    { label: 'Nulidad Matrimonial', path: '/parroquia/decretos/nulidad', icon: Heart }
                ]
            },            
            { label: 'Ajustes', path: '/parroquia/ajustes', icon: SettingsIcon }
        ];
    } 
    if (safeRole === ROLE_TYPES.CHANCERY) {
        return [
            { label: 'Dashboard', path: '/chancery/dashboard', icon: LayoutDashboard },
            {
                label: 'Decretos',
                icon: FileText,
                children: [
                    { label: 'Nueva Corrección', path: '/chancery/decree-correction/new' },
                    { label: 'Nueva Reposición', path: '/chancery/decree-replacement/new' },
                    { label: 'Ver Reposición', path: '/chancery/decree-replacement/view' },
                    { label: 'Ver Corrección', path: '/chancery/decree-correction/view' },
                    { label: 'Editar Reposición', path: '/chancery/decree-replacement/edit' },
                    { label: 'Editar Corrección', path: '/chancery/decree-correction/edit' },
                    { label: 'Conceptos Anulación', path: '/chancery/decree-annulment' }
                ]
            },
            { label: 'Pendientes', path: '/chancery/pending', icon: ScrollText },
            { label: 'Certificaciones', path: '/chancery/certifications', icon: Users },
            { label: 'Comunicaciones', path: '/communications', icon: Users }
        ];
    }
    return [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }];
  };

  const menuItems = getMenuItems();

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transform transition-transform duration-500 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          
          {/* HEADER DEL LOGO */}
          <div className="h-24 flex items-center px-8 border-b border-slate-50 bg-white shrink-0">
            <div className="w-10 h-10 bg-[#4B7BA7] rounded-2xl flex items-center justify-center mr-4 shadow-lg shadow-blue-900/20 rotate-3 transition-transform hover:rotate-0">
              <Landmark className="w-6 h-6 text-white -rotate-3 transition-transform hover:rotate-0" />
            </div>
            <div>
                <span className="block font-black text-xl text-gray-900 tracking-tighter leading-none">SACRAMENTUM</span>
                <span className="text-[9px] font-black text-[#D4AF37] uppercase tracking-[0.3em]">Eclesia Digital</span>
            </div>
            <button onClick={onClose} className="ml-auto lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          </div>

          {/* LISTA DE NAVEGACIÓN */}
          <div className="flex-1 overflow-y-auto py-8 px-5 custom-scrollbar bg-white">
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em] mb-6 px-4">Centro de Operaciones</p>
            {menuItems.map((item, idx) => (
              <SidebarItem 
                key={idx} 
                item={item} 
                isActive={location.pathname === item.path || (item.children && item.children.some(c => location.pathname.startsWith(c.path)))}
                badgeCount={item.badgeCount}
              />
            ))}
          </div>

          {/* FOOTER: USUARIO Y CIERRE */}
          <div className="p-6 bg-slate-50/50 border-t border-gray-100 shrink-0">
            <div className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm mb-4">
                <div className="flex items-center gap-3">
                    {/* 🚀 AQUÍ AÑADIMOS shrink-0 AL CONTENEDOR DEL CÍRCULO */}
                    <div className="w-10 h-10 shrink-0 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs uppercase">
                        {user?.username?.substring(0, 2)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black text-gray-900 uppercase truncate leading-none mb-1">{user?.username}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter truncate">
                            {safeRole === ROLE_TYPES.ADMIN_GENERAL ? 'Súper Administrador' :
                             safeRole === ROLE_TYPES.DIOCESE ? (user?.dioceseName || 'Gestión Diocesana') :
                             safeRole === ROLE_TYPES.CHANCERY ? 'Cancillería' : 
                             (user?.parishName || 'Despacho Parroquial')}
                        </span>
                    </div>
                </div>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center justify-center gap-3 w-full px-4 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all active:scale-95 border border-red-100/50 shadow-sm shadow-red-900/5"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión Segura</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;