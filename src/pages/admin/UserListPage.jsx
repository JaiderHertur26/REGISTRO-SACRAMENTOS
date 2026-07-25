import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const UserListPage = () => {
  const { data } = useAppData();
  
  const columns = [
    { header: 'Usuario', accessor: 'username' },
    { header: 'Email', accessor: 'email' },
    { header: 'Rol', accessor: 'role' },
    { 
      header: 'Entidad', 
      render: (row) => row.role === 'diocese' ? row.dioceseName : row.role === 'parish' ? row.parishName : '-' 
    }
  ];

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#2C3E50]">Usuarios del Sistema</h1>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Crear Usuario
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={data.users || []}
        actions={[{ type: 'edit', label: 'Editar' }, { type: 'delete', label: 'Eliminar', variant: 'danger' }]}
        onAction={() => {}} 
      />
    </DashboardLayout>
  );
};

export default UserListPage;