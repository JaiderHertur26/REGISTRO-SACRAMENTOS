import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditDioceseUserModal = ({ isOpen, onClose, onSuccess, user }) => {
  const { updateUser, data } = useAppData();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    dioceseId: ''
  });

  useEffect(() => {
    if (user) {
        setFormData({
            username: user.username,
            email: user.email,
            dioceseId: user.dioceseId || ''
        });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.dioceseId) {
        toast({ title: 'Error', description: 'Todos los campos son obligatorios', variant: 'destructive' });
        return;
    }

    const selectedDiocese = data.dioceses.find(d => d.id === formData.dioceseId);
    
    updateUser(user.id, {
      username: formData.username,
      email: formData.email,
      dioceseId: formData.dioceseId,
      dioceseName: selectedDiocese?.name,
      dioceseType: selectedDiocese?.type
    });

    toast({ title: 'Usuario actualizado', description: 'Los datos han sido guardados correctamente.' });
    if (onSuccess) onSuccess();
    onClose();
  };

  const dioceseOptions = data.dioceses.map(d => ({ value: d.id, label: d.name }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Usuario Diocesano">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input 
          label="Usuario" 
          name="username" 
          value={formData.username} 
          onChange={handleChange} 
          required 
        />
        <Input 
          label="Email" 
          name="email" 
          type="email" 
          value={formData.email} 
          onChange={handleChange} 
          required 
        />
        <Select 
          label="Diócesis Asignada" 
          name="dioceseId"
          value={formData.dioceseId} 
          onChange={handleChange}
          options={dioceseOptions}
          required 
        />
        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar Cambios</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditDioceseUserModal;