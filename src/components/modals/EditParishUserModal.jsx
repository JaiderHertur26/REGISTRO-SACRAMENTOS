import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditParishUserModal = ({ isOpen, onClose, onSuccess, user, dioceseId }) => {
  const { updateUser, data } = useAppData();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    parishId: ''
  });

  useEffect(() => {
    if (user) {
        // Safely extract username string
        let safeUsername = user.username;
        if (typeof safeUsername === 'object' && safeUsername !== null) {
            safeUsername = safeUsername.name || safeUsername.username || '';
        }

        setFormData({
            username: safeUsername,
            email: user.email,
            parishId: user.parishId || ''
        });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.parishId) {
        toast({ title: 'Error', description: 'Todos los campos son obligatorios', variant: 'destructive' });
        return;
    }

    const selectedParish = data.parishes.find(p => p.id === formData.parishId);
    
    // Ensure parishName is a string
    const parishName = selectedParish 
        ? (typeof selectedParish.name === 'object' ? (selectedParish.name.name || 'Parroquia') : selectedParish.name)
        : 'Parroquia';

    updateUser(user.id, {
      username: formData.username,
      email: formData.email,
      parishId: formData.parishId,
      parishName: parishName
    });

    toast({ title: 'Usuario actualizado', description: 'Los datos han sido guardados correctamente.' });
    if (onSuccess) onSuccess();
    onClose();
  };

  // Filter parishes by current diocese
  const parishOptions = data.parishes
    .filter(p => p.dioceseId === dioceseId)
    .map(p => ({ value: p.id, label: p.name }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Usuario Parroquia">
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
          label="Parroquia Asignada" 
          name="parishId"
          value={formData.parishId} 
          onChange={handleChange}
          options={parishOptions}
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

export default EditParishUserModal;