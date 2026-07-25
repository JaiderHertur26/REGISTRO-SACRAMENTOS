import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff } from 'lucide-react';

const CreateParishModal = ({ isOpen, onClose }) => {
  const { createParish, getVicariesByDiocese, data, getUserByUsername } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    vicaryId: '',
    decanateId: '',
    parroco: '',
    startDate: '',
    nit: '',
    address: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});

  // Derived Data
  const vicaries = getVicariesByDiocese(user?.dioceseId || '');
  
  // Filter Deaneries based on selected Vicary
  const availableDeaneries = formData.vicaryId 
    ? data.deaneries.filter(d => d.vicaryId === formData.vicaryId) 
    : [];

  const handleVicaryChange = (e) => {
    const vicaryId = e.target.value;
    setFormData(prev => ({
        ...prev,
        vicaryId,
        decanateId: '' // Reset decanate to "Sin Decanato" when vicary changes
    }));
  };

  const validate = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.name) newErrors.name = 'Requerido';
    if (!formData.vicaryId) newErrors.vicaryId = 'Requerido';
    
    // Decanate is strictly optional now, even if available.

    if (!formData.parroco) newErrors.parroco = 'Requerido';
    if (!formData.startDate) newErrors.startDate = 'Requerido';
    if (!formData.nit) newErrors.nit = 'Requerido';
    
    if (!formData.address) newErrors.address = 'Requerido';
    
    if (!formData.phone) newErrors.phone = 'Requerido';
    else if (!/^\d+$/.test(formData.phone)) newErrors.phone = 'Solo números';

    if (!formData.email) newErrors.email = 'Requerido';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email inválido';

    if (!formData.username) newErrors.username = 'Requerido';
    else if (getUserByUsername(formData.username)) newErrors.username = 'Usuario ya existe';

    if (!formData.password) newErrors.password = 'Requerido';
    else if (formData.password.length < 6) newErrors.password = 'Mínimo 6 caracteres';

    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Parish Data
      const parishData = {
        name: formData.name,
        vicaryId: formData.vicaryId,
        decanateId: formData.decanateId || null, // Ensure null if empty string (Sin Decanato)
        dioceseId: user.dioceseId,
        parroco: formData.parroco,
        startDate: formData.startDate,
        nit: formData.nit,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        city: user.city || 'Desconocida'
      };

      // User Data
      const userData = {
        username: formData.username,
        password: formData.password,
        email: formData.email,
        dioceseId: user.dioceseId
      };

      createParish(parishData, userData);
      toast({ title: 'Éxito', description: 'Parroquia y usuario creados correctamente.' });
      handleClose();
    } catch (error) {
        console.error(error);
      toast({ title: 'Error', description: 'No se pudo crear la parroquia.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
        name: '', vicaryId: '', decanateId: '', parroco: '', startDate: '',
        nit: '', address: '', phone: '', email: '',
        username: '', password: '', confirmPassword: ''
    });
    setErrors({});
    onClose();
  };

  const vicaryOptions = vicaries.map(v => ({ value: v.id, label: v.name }));
  
  // Always include "Sin Decanato" option, plus any available deaneries
  const decanateOptions = [
    { value: '', label: 'Sin Decanato' },
    ...availableDeaneries.map(d => ({ value: d.id, label: d.name }))
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Crear Parroquia">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Name */}
        <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la Parroquia</label>
            <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                error={errors.name} 
                placeholder="Ej. Parroquia San José"
            />
        </div>

        {/* Ecclesiastical Hierarchy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Vicaría</label>
                <Select 
                    placeholder="Seleccionar Vicaría"
                    options={vicaryOptions}
                    value={formData.vicaryId}
                    onChange={handleVicaryChange}
                    error={errors.vicaryId}
                />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Decanato (Opcional)</label>
                <Select 
                    placeholder="Seleccionar Decanato"
                    options={decanateOptions}
                    value={formData.decanateId}
                    onChange={e => setFormData({...formData, decanateId: e.target.value})}
                    error={errors.decanateId}
                    disabled={!formData.vicaryId && decanateOptions.length <= 1} 
                />
            </div>
        </div>

        {/* Priest Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Párroco Actual</label>
                <Input value={formData.parroco} onChange={e => setFormData({...formData, parroco: e.target.value})} error={errors.parroco} />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Fecha Inicio Párroco</label>
                <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} error={errors.startDate} />
            </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">NIT</label>
                <Input value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})} error={errors.nit} />
            </div>
             <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Dirección</label>
                <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} error={errors.address} />
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Teléfono</label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} error={errors.phone} />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Correo Electrónico</label>
                <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} error={errors.email} />
            </div>
        </div>

        {/* User Credentials */}
        <div className="border-t border-gray-100 pt-4 mt-4">
            <h4 className="text-sm font-bold text-[#2C3E50] mb-3">Credenciales de Acceso</h4>
            
            <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Usuario</label>
                  <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} error={errors.username} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña</label>
                        <div className="relative">
                            <Input 
                                type={showPassword ? "text" : "password"}
                                value={formData.password} 
                                onChange={e => setFormData({...formData, password: e.target.value})} 
                                error={errors.password}
                                className="pr-10"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Confirmar</label>
                        <div className="relative">
                            <Input 
                                type={showConfirmPassword ? "text" : "password"}
                                value={formData.confirmPassword} 
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                                error={errors.confirmPassword}
                                className="pr-10"
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-gray-400">
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateParishModal;