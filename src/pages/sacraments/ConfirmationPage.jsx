import React from 'react';
import { Helmet } from 'react-helmet';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const ConfirmationPage = () => {
  return (
    <>
      <Helmet>
        <title>{'Confirmations'}</title>
      </Helmet>
      <DashboardLayout>
        <div className="text-center py-10">
          <h1 className="text-2xl font-bold mb-4">Libro de Confirmaciones</h1>
          <p className="text-gray-500 mb-6">La funcionalidad es idéntica a Bautismos en esta demo.</p>
          <Button className="gap-2"><Plus className="w-4 h-4" /> Nuevo Registro</Button>
        </div>
      </DashboardLayout>
    </>
  );
};

export default ConfirmationPage;