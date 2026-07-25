import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Church, Users, FileText } from 'lucide-react';

const DioceseUserDashboard = () => {
  const { data } = useAppData();
  const { user } = useAuth();

  // Filter stats for this diocese
  const vicariesCount = (data.vicariates || []).filter(v => v.dioceseId === user.dioceseId).length;
  // Deaneries are children of Vicaries which belong to Diocese
  const dioceseVicaryIds = (data.vicariates || []).filter(v => v.dioceseId === user.dioceseId).map(v => v.id);
  const deaneriesCount = (data.deaneries || []).filter(d => dioceseVicaryIds.includes(d.vicaryId)).length;
  // Parishes belong to Deaneries (or directly vicaries in some models, but we used decanateId in creation)
  // Let's assume parishes are linked to the diocese via id or chain. 
  // In createParish we added dioceseId to the parish object for easier lookup, although relational is via deanery.
  // Checking createParish... yes, it adds dioceseId.
  const parishesCount = (data.parishes || []).filter(p => p.dioceseId === user.dioceseId).length;

  const stats = [
    { label: 'Total Parroquias', value: parishesCount, icon: Church, color: 'bg-blue-600' },
    { label: 'Total Vicarías', value: vicariesCount, icon: Users, color: 'bg-indigo-600' },
    { label: 'Total Decanatos', value: deaneriesCount, icon: Users, color: 'bg-purple-600' },
  ];

  return (
    <DashboardLayout entityName={user.dioceseName}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2C3E50]">Panel de Gestión Diocesana</h1>
        <p className="text-gray-500 mt-1">{user.dioceseName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
              <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default DioceseUserDashboard;