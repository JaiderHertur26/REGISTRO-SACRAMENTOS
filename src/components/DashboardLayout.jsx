import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DashboardLayout = ({ children, entityName }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Safe extraction of user properties to prevent "Objects are not valid as a React child" errors
  const getSafeUsername = (u) => {
    if (!u) return '';
    if (typeof u.username === 'string') return u.username;
    if (typeof u.username === 'object' && u.username !== null) {
      const candidate = u.username.name || u.username.username || 'Usuario';
      return typeof candidate === 'object' ? 'Usuario' : String(candidate);
    }
    if (u.name) {
       return typeof u.name === 'object' ? 'Usuario' : String(u.name);
    }
    return 'Usuario';
  };

  const getSafeRole = (u) => {
    if (!u) return '';
    if (typeof u.role === 'string') return u.role;
    if (typeof u.role === 'object' && u.role !== null) {
      const candidate = u.role.name || u.role.role || 'guest';
      return typeof candidate === 'object' ? 'guest' : String(candidate);
    }
    return 'guest';
  };

  const getSafeEntityName = (ent) => {
      if (typeof ent === 'string') return ent;
      if (typeof ent === 'object' && ent !== null) {
          const candidate = ent.name || 'Eclesia Digital';
          return typeof candidate === 'object' ? 'Eclesia Digital' : String(candidate);
      }
      return 'Eclesia Digital';
  };

  const safeEntityName = getSafeEntityName(entityName);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onLogout={handleLogout}
        role={getSafeRole(user)}
      />
      
      <Header 
        username={getSafeUsername(user)} 
        role={getSafeRole(user)} 
        entityName={safeEntityName} 
        onLogout={handleLogout}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area */}
      {/* 🚀 AQUÍ CAMBIAMOS lg:pl-64 POR lg:pl-72 */}
      <main className="lg:pl-72 pt-16 flex-1 transition-all duration-300 bg-gray-50">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;