import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';

const CommunicationsPage = () => {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6 text-[#2C3E50]">Comunicaciones</h1>
      <div className="bg-white p-10 rounded-lg shadow-sm text-center">
        <p className="text-gray-500">Bandeja de entrada vacía.</p>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationsPage;