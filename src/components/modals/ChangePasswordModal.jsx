import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const ChangePasswordModal = ({ isOpen, onClose, user }) => {
  const { updateUser } = useAppData();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmNewPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.newPassword.length < 6) {
        toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' });
        return;
    }

    if (formData.newPassword !== formData.confirmNewPassword) {
      toast({ title: 'Error', description: 'Las nuevas contraseñas no coinciden', variant: 'destructive' });
      return;
    }

    updateUser(user.id, { password: formData.newPassword });
    toast({ title: 'Contraseña actualizada', description: 'La contraseña ha sido modificada correctamente.' });
    onClose();
    setFormData({ newPassword: '', confirmNewPassword: '' });
  };

  // Safe username extraction for title
  const getSafeUsername = (u) => {
      if (!u) return '';
      if (typeof u.username === 'string') return u.username;
      if (typeof u.username === 'object' && u.username !== null) {
          return u.username.name || u.username.username || 'Usuario';
      }
      return 'Usuario';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cambiar Contraseña - ${getSafeUsername(user)}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500 mb-4">Ingrese la nueva contraseña para este usuario.</p>
        <div className="grid grid-cols-1 gap-4">
            <Input 
                label="Nueva Contraseña" 
                name="newPassword" 
                type="password" 
                value={formData.newPassword} 
                onChange={handleChange} 
                required 
            />
            <Input 
                label="Confirmar Nueva Contraseña" 
                name="confirmNewPassword" 
                type="password" 
                value={formData.confirmNewPassword} 
                onChange={handleChange} 
                required 
            />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Actualizar Contraseña</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;