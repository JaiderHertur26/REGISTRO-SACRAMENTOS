import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const CreateDioceseUserModal = ({ isOpen, onClose, onSuccess }) => {
  const { createUser, data, getUserByUsername } = useAppData();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    dioceseId: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
      if (!formData.username || !formData.email || !formData.password || !formData.dioceseId) {
          toast({ title: 'Error', description: 'Todos los campos son obligatorios', variant: 'destructive' });
          return false;
      }
      if (formData.username.length < 3) {
          toast({ title: 'Error', description: 'El usuario debe tener al menos 3 caracteres', variant: 'destructive' });
          return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
          toast({ title: 'Error', description: 'El formato del correo electrónico es inválido', variant: 'destructive' });
          return false;
      }
      if (formData.password.length < 6) {
          toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' });
          return false;
      }
      if (formData.password !== formData.confirmPassword) {
          toast({ title: 'Error', description: 'Las contraseñas no coinciden', variant: 'destructive' });
          return false;
      }
      if (getUserByUsername(formData.username)) {
          toast({ title: 'Error', description: 'El nombre de usuario ya existe', variant: 'destructive' });
          return false;
      }
      return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    const selectedDiocese = data.dioceses.find(d => d.id === formData.dioceseId);
    
    const newUser = {
      username: formData.username,
      email: formData.email,
      password: formData.password,
      role: 'diocese',
      dioceseId: formData.dioceseId,
      dioceseName: selectedDiocese?.name,
      dioceseType: selectedDiocese?.type
    };

    createUser(newUser);
    toast({ title: 'Usuario creado', description: 'Usuario Diócesis creado correctamente' });
    if (onSuccess) onSuccess();
    onClose();
    setFormData({ username: '', email: '', password: '', confirmPassword: '', dioceseId: '' });
  };

  const dioceseOptions = data.dioceses.map(d => ({ value: d.id, label: d.name }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Usuario Diócesis">
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
        <div className="grid grid-cols-2 gap-4">
            <Input 
            label="Contraseña" 
            name="password" 
            type="password" 
            value={formData.password} 
            onChange={handleChange} 
            required 
            />
            <Input 
            label="Confirmar Contraseña" 
            name="confirmPassword" 
            type="password" 
            value={formData.confirmPassword} 
            onChange={handleChange} 
            required 
            />
        </div>
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
          <Button type="submit">Crear Usuario</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateDioceseUserModal;