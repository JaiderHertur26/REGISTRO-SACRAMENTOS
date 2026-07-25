import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditDecanateModal = ({ isOpen, onClose, decanate }) => {
  const { updateDecanate, data } = useAppData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    decanName: ''
  });
  const [vicaryName, setVicaryName] = useState('');

  useEffect(() => {
    if (decanate) {
      setFormData({
        name: decanate.name || '',
        decanName: decanate.decanName || ''
      });
      const vicary = data.vicariates.find(v => v.id === decanate.vicaryId);
      setVicaryName(vicary ? vicary.name : 'Vicaría Desconocida');
    }
  }, [decanate, data.vicariates]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.decanName) {
        toast({ title: 'Error', description: 'Todos los campos son obligatorios', variant: 'destructive' });
        return;
    }

    setLoading(true);
    try {
      updateDecanate(decanate.id, formData);
      toast({ title: 'Éxito', description: 'Decanato actualizado correctamente.' });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el decanato.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!decanate) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Decanato">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Vicaría (Solo Lectura)</label>
          <Input 
            value={vicaryName} 
            disabled 
            className="bg-gray-100 text-gray-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre del Decanato</label>
          <Input 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre del Decano</label>
          <Input 
            value={formData.decanName} 
            onChange={e => setFormData({...formData, decanName: e.target.value})} 
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

export default EditDecanateModal;