import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Helmet } from 'react-helmet';

const MarriagePage = () => {
  return (
    <DashboardLayout>
      <Helmet><title>Matrimonios - Eclesia Digital</title></Helmet>
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold mb-4">Libro de Matrimonios</h1>
        <p className="text-gray-500">Módulo de gestión de matrimonios.</p>
      </div>
    </DashboardLayout>
  );
};
export default MarriagePage;