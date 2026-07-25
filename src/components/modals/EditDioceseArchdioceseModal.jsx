import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditDioceseArchdioceseModal = ({ isOpen, onClose, diocese }) => {
  const { updateDioceseArchdiocese } = useAppData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    ecclesiasticalProvince: '',
    bishop: '',
    auxiliaryBishop: '',
    jurisdiction: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (diocese) {
      setFormData({
        name: diocese.name || '',
        ecclesiasticalProvince: diocese.ecclesiasticalProvince || '',
        bishop: diocese.bishop || '',
        auxiliaryBishop: diocese.auxiliaryBishop || '',
        jurisdiction: diocese.jurisdiction || ''
      });
    }
  }, [diocese]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'El nombre es requerido';
    else if (!formData.name.toLowerCase().includes('diócesis') && !formData.name.toLowerCase().includes('arquidiócesis') && !formData.name.toLowerCase().includes('diocesis') && !formData.name.toLowerCase().includes('arquidiocesis')) {
      newErrors.name = 'El nombre debe contener "Diócesis" o "Arquidiócesis"';
    }

    if (!formData.ecclesiasticalProvince) newErrors.ecclesiasticalProvince = 'La provincia eclesiástica es requerida';
    if (!formData.bishop) newErrors.bishop = 'El Obispo/Arzobispo es requerido';
    if (!formData.jurisdiction) newErrors.jurisdiction = 'La jurisdicción es requerida';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updates = {
        name: formData.name,
        ecclesiasticalProvince: formData.ecclesiasticalProvince,
        bishop: formData.bishop,
        auxiliaryBishop: formData.auxiliaryBishop || '',
        jurisdiction: formData.jurisdiction,
        city: formData.jurisdiction // Update city as it maps to jurisdiction
      };

      updateDioceseArchdiocese(diocese.id, updates);
      
      toast({ title: 'Éxito', description: 'Diócesis/Arquidiócesis actualizada correctamente.' });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el registro.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!diocese) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Diócesis/Arquidiócesis">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre Oficial</label>
          <Input 
            placeholder="Ej: Arquidiócesis de Bogotá" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            error={errors.name}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Provincia Eclesiástica</label>
              <Input 
                placeholder="Provincia" 
                value={formData.ecclesiasticalProvince} 
                onChange={e => setFormData({...formData, ecclesiasticalProvince: e.target.value})} 
                error={errors.ecclesiasticalProvince}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Jurisdicción Eclesiástica</label>
              <Input 
                placeholder="Ciudad/Región" 
                value={formData.jurisdiction} 
                onChange={e => setFormData({...formData, jurisdiction: e.target.value})} 
                error={errors.jurisdiction}
              />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Obispo/Arzobispo</label>
              <Input 
                placeholder="Nombre completo" 
                value={formData.bishop} 
                onChange={e => setFormData({...formData, bishop: e.target.value})} 
                error={errors.bishop}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Obispo Auxiliar (Opcional)</label>
              <Input 
                placeholder="Nombre completo" 
                value={formData.auxiliaryBishop} 
                onChange={e => setFormData({...formData, auxiliaryBishop: e.target.value})} 
              />
            </div>
        </div>

        <div className="border-t border-gray-100 my-4 pt-4">
            <h4 className="text-sm font-bold text-[#2C3E50] mb-3">Credenciales de Acceso (Solo Lectura)</h4>
            
            <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Usuario Administrador</label>
                  <Input 
                    value={diocese.username || 'No asignado'} 
                    disabled
                    className="bg-gray-50 text-gray-500"
                  />
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditDioceseArchdioceseModal;