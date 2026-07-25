import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditParishModal = ({ isOpen, onClose, parish }) => {
  const { updateParish, data } = useAppData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [parishUser, setParishUser] = useState(null);

  useEffect(() => {
    if (parish) {
      setFormData({
        name: parish.name,
        parroco: parish.parroco,
        startDate: parish.startDate,
        nit: parish.nit,
        address: parish.address,
        phone: parish.phone,
        email: parish.email
      });
      // Find associated user for read-only display
      const user = data.users.find(u => u.id === parish.userId);
      setParishUser(user);
    }
  }, [parish, data.users]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      updateParish(parish.id, formData);
      toast({ title: 'Éxito', description: 'Parroquia actualizada correctamente.' });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!parish) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Parroquia">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la Parroquia</label>
            <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Párroco Actual</label>
                <Input value={formData.parroco || ''} onChange={e => setFormData({...formData, parroco: e.target.value})} />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Fecha Inicio Párroco</label>
                <Input type="date" value={formData.startDate || ''} onChange={e => setFormData({...formData, startDate: e.target.value})} />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">NIT</label>
                <Input value={formData.nit || ''} onChange={e => setFormData({...formData, nit: e.target.value})} />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Teléfono</label>
                <Input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Correo Electrónico</label>
                <Input value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
             <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Dirección</label>
                <Input value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mt-4 bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-bold text-[#2C3E50] mb-3">Credenciales (Solo Lectura)</h4>
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Usuario</label>
                    <p className="text-sm font-medium text-gray-900">{parishUser?.username || 'N/A'}</p>
                 </div>
                 <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Contraseña</label>
                    <p className="text-sm font-medium text-gray-900">******</p>
                 </div>
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditParishModal;