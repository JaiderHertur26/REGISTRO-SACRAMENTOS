import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff } from 'lucide-react';

const CreateChancellorModal = ({ isOpen, onClose }) => {
  const { createChancellor, getChancellorByDiocese, getUserByUsername } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // AQUÍ AGREGAMOS LOS CAMPOS FALTANTES AL ESTADO
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    contactEmail: '',
    address: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Requerido';
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
    
    const existing = getChancellorByDiocese(user.dioceseId);
    if (existing) {
        toast({ title: 'Error', description: 'Ya existe un Canciller para esta diócesis.', variant: 'destructive' });
        return;
    }

    setLoading(true);
    try {
      // AQUÍ EMPAQUETAMOS LOS DATOS NUEVOS PARA ENVIARLOS
      const chancellorData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.contactEmail,
        address: formData.address,
        dioceseId: user.dioceseId
      };
      
      const userData = {
        username: formData.username,
        password: formData.password,
        email: `${formData.username.toLowerCase()}@eclesia.org`
      };

      createChancellor(chancellorData, userData);
      toast({ title: 'Éxito', description: 'Canciller creado correctamente.' });
      handleClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo crear el canciller.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', phone: '', contactEmail: '', address: '', username: '', password: '', confirmPassword: '' });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Crear Canciller / Sede">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre del Canciller / Sede <span className="text-red-500">*</span></label>
          <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} error={errors.name} placeholder="Ej. Pbro. Juan Pérez" />
        </div>

        {/* --- NUEVOS CAMPOS VISUALES --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Teléfono</label>
            <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Número de contacto" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email de Contacto</label>
            <Input type="email" value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} placeholder="correo@ejemplo.com" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Dirección / Sede</label>
          <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Dirección física" />
        </div>
        {/* ------------------------------ */}

        <div className="border-t border-gray-100 pt-4 mt-4">
            <h4 className="text-sm font-bold text-[#2C3E50] mb-3">Credenciales de Acceso</h4>
            
            <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Usuario <span className="text-red-500">*</span></label>
                  <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} error={errors.username} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña <span className="text-red-500">*</span></label>
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
                        <label className="text-sm font-medium text-gray-700 block mb-1">Confirmar <span className="text-red-500">*</span></label>
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
          <Button type="submit" disabled={loading} className="bg-[#4B7BA7] hover:bg-[#3B6B97]">{loading ? 'Creando...' : 'Crear Canciller'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateChancellorModal;