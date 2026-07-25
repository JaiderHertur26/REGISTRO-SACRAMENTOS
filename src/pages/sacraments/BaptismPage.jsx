import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/use-toast';

const BaptismPage = () => {
  const { user } = useAuth();
  const { data, createItem, updateItem } = useAppData();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('new');
  const [formData, setFormData] = useState({ firstName: '', lastName: '', sacramentDate: '', parishId: user.parishId });

  const safeSacraments = data.sacraments || [];
  const baptisms = safeSacraments.filter(s => s.type === 'baptism' && s.parishId === user.parishId);
  const pendingBaptisms = baptisms.filter(s => s.status === 'pending');
  const seatedBaptisms = baptisms.filter(s => s.status === 'seated');

  const handleSubmit = (e) => {
    e.preventDefault();
    createItem('sacraments', { ...formData, type: 'baptism', status: 'pending', dioceseId: user.dioceseId });
    toast({ title: 'Registro Exitoso', description: 'Bautismo guardado como pendiente.' });
    setFormData({ firstName: '', lastName: '', sacramentDate: '', parishId: user.parishId });
  };

  const handleSeat = (row) => {
    updateItem('sacraments', row.id, { status: 'seated', book: '1', folio: '1', number: Date.now().toString().slice(-4) });
    toast({ title: 'Registro Sentado', description: 'El sacramento ha sido oficializado.' });
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6 text-[#2C3E50]">Gestión de Bautismos</h1>
      
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {['new', 'edit', 'seat', 'certificates'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab 
                ? 'border-[#D4AF37] text-[#2C3E50]' 
                : 'border-transparent text-gray-500 hover:text-[#4B7BA7]'
            }`}
          >
            {tab === 'new' ? 'Nuevo Bautizo' : tab === 'edit' ? 'Libro de Bautismos' : tab === 'seat' ? 'Sentar Registros' : 'Partidas'}
          </button>
        ))}
      </div>

      {activeTab === 'new' && (
        <div className="bg-white p-6 rounded-lg shadow-sm max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-semibold text-gray-700">Datos del Bautizado</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Nombres" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              <Input placeholder="Apellidos" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
              <Input type="date" required value={formData.sacramentDate} onChange={e => setFormData({...formData, sacramentDate: e.target.value})} />
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit">Guardar Registro</Button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'edit' && (
        <Table 
          columns={[{header: 'Nombre', accessor: 'firstName'}, {header: 'Apellido', accessor: 'lastName'}, {header: 'Fecha', accessor: 'sacramentDate'}, {header: 'Estado', render: r => r.status === 'seated' ? 'Sentado' : 'Pendiente'}]}
          data={baptisms}
          actions={[{ type: 'view', label: 'Ver' }]}
          onAction={() => {}}
        />
      )}

      {activeTab === 'seat' && (
        <Table 
          columns={[{header: 'Nombre', accessor: 'firstName'}, {header: 'Fecha', accessor: 'sacramentDate'}]}
          data={pendingBaptisms}
          actions={[{ type: 'seat', label: 'Sentar', variant: 'secondary' }]}
          onAction={(type, row) => handleSeat(row)}
        />
      )}

      {activeTab === 'certificates' && (
         <Table 
          columns={[{header: 'Nombre', accessor: 'firstName'}, {header: 'Libro', accessor: 'book'}, {header: 'Folio', accessor: 'folio'}, {header: 'Número', accessor: 'number'}]}
          data={seatedBaptisms}
          actions={[{ type: 'print', label: 'Imprimir', variant: 'outline' }]}
          onAction={() => window.print()}
        />
      )}
    </DashboardLayout>
  );
};

export default BaptismPage;