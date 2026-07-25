import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditChanceryUserModal = ({ isOpen, onClose, onSuccess, user, dioceseId }) => {
  const { updateUser, data } = useAppData();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    chancelleryId: ''
  });

  useEffect(() => {
    if (user) {
        setFormData({
            username: user.username,
            email: user.email,
            chancelleryId: user.chancelleryId || ''
        });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.chancelleryId) {
        toast({ title: 'Error', description: 'Todos los campos son obligatorios', variant: 'destructive' });
        return;
    }

    const selectedChancery = data.chancelleries.find(c => c.id === formData.chancelleryId);
    
    updateUser(user.id, {
      username: formData.username,
      email: formData.email,
      chancelleryId: formData.chancelleryId,
      chancelleryName: selectedChancery?.name
    });

    toast({ title: 'Usuario actualizado', description: 'Los datos han sido guardados correctamente.' });
    if (onSuccess) onSuccess();
    onClose();
  };

  // Filter chanceries by current diocese
  const chanceryOptions = data.chancelleries
    .filter(c => c.dioceseId === dioceseId)
    .map(c => ({ value: c.id, label: c.name }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Usuario Cancillería">
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
          label="Cancillería Asignada" 
          name="chancelleryId"
          value={formData.chancelleryId} 
          onChange={handleChange}
          options={chanceryOptions}
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

export default EditChanceryUserModal;