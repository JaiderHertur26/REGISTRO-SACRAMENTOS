import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditVicaryModal = ({ isOpen, onClose, vicary }) => {
  const { updateVicary } = useAppData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    vicarioName: ''
  });

  useEffect(() => {
    if (vicary) {
      setFormData({
        name: vicary.name || '',
        vicarioName: vicary.vicarioName || ''
      });
    }
  }, [vicary]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.vicarioName) {
        toast({ title: 'Error', description: 'Todos los campos son obligatorios', variant: 'destructive' });
        return;
    }

    setLoading(true);
    try {
      updateVicary(vicary.id, formData);
      toast({ title: 'Éxito', description: 'Vicaría actualizada correctamente.' });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la vicaría.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!vicary) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Vicaría">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la Vicaría</label>
          <Input 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre del Vicario</label>
          <Input 
            value={formData.vicarioName} 
            onChange={e => setFormData({...formData, vicarioName: e.target.value})} 
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditVicaryModal;