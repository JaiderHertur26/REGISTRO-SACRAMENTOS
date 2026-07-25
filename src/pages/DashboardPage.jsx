import React from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/context/AuthContext';
import AdminGeneralDashboard from '@/pages/admin/AdminGeneralDashboard';
import DioceseDashboard from '@/pages/diocese/DioceseDashboard';
import DashboardLayout from '@/components/DashboardLayout';
import { Church, Users, FileText, ScrollText, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppData } from '@/context/AppDataContext';
import { ROLE_TYPES } from '@/config/supabaseConfig';

// Simple Parish Dashboard Component
const ParishDashboard = () => {
    const { user } = useAuth();
    const { data } = useAppData();
    
    const parishSacraments = data.sacraments.filter(s => s.parishId === user.parishId);
    
    const stats = [
        { title: 'Bautismos', value: parishSacraments.filter(s => s.type === 'baptism').length, icon: Church, color: 'bg-blue-500', desc: 'Total registrados' },
        { title: 'Confirmaciones', value: parishSacraments.filter(s => s.type === 'confirmation').length, icon: ScrollText, color: 'bg-purple-500', desc: 'Total registradas' },
        { title: 'Matrimonios', value: parishSacraments.filter(s => s.type === 'marriage').length, icon: Users, color: 'bg-pink-500', desc: 'Total registrados' },
        { title: 'Pendientes', value: parishSacraments.filter(s => s.status === 'pending').length, icon: Activity, color: 'bg-orange-500', desc: 'Por sentar' },
    ];

    const DashboardCard = ({ icon: Icon, title, value, color, description }) => (
        <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${color}`}>
            <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            <p className="font-medium text-gray-700">{title}</p>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
        </motion.div>
    );

    // Safe extraction of parish name to avoid object rendering error
    const safeParishName = (user && user.parishName) 
        ? (typeof user.parishName === 'object' ? (user.parishName.name || 'Parroquia') : user.parishName)
        : 'Parroquia';

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">
                Bienvenido, {safeParishName}
                </h1>
                <p className="text-gray-500">Gestión Parroquial</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat, idx) => (
                    <DashboardCard key={idx} {...stat} />
                ))}
            </div>
             <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
                <div className="text-center py-8 text-gray-500">
                No hay actividad reciente para mostrar.
                </div>
            </div>
        </DashboardLayout>
    );
};

const DashboardPage = () => {
  const { user } = useAuth();

  if (!user) return null;

  // Safe role check
  const userRole = typeof user.role === 'object' ? (user.role.name || user.role.role) : user.role;

  return (
    <>
      <Helmet>
        <title>{'Dashboard'}</title>
      </Helmet>

      {userRole === ROLE_TYPES.ADMIN_GENERAL && <AdminGeneralDashboard />}
      {userRole === ROLE_TYPES.DIOCESE && <DioceseDashboard />}
      {userRole === ROLE_TYPES.PARISH && <ParishDashboard />}
      {/* Chancery Dashboard fallback */}
      {userRole === ROLE_TYPES.CHANCERY && (
          <DashboardLayout>
              <h1 className="text-2xl font-bold">Panel de Cancillería</h1>
              <p className="text-gray-500">Bienvenido al sistema de gestión documental.</p>
          </DashboardLayout>
      )}
    </>
  );
};

export default DashboardPage;