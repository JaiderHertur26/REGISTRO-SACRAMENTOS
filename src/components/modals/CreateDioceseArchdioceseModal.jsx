import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff } from 'lucide-react';

const CreateDioceseArchdioceseModal = ({ isOpen, onClose }) => {
  const { createDioceseArchdiocese, getUserByUsername } = useAppData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    ecclesiasticalProvince: '',
    bishop: '',
    auxiliaryBishop: '',
    jurisdiction: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'El nombre es requerido';
    else if (!formData.name.toLowerCase().includes('diócesis') && !formData.name.toLowerCase().includes('arquidiócesis') && !formData.name.toLowerCase().includes('diocesis') && !formData.name.toLowerCase().includes('arquidiocesis')) {
      newErrors.name = 'El nombre debe contener "Diócesis" o "Arquidiócesis"';
    }

    if (!formData.ecclesiasticalProvince) newErrors.ecclesiasticalProvince = 'La provincia eclesiástica es requerida';
    if (!formData.bishop) newErrors.bishop = 'El Obispo/Arzobispo es requerido';
    if (!formData.jurisdiction) newErrors.jurisdiction = 'La jurisdicción es requerida';
    
    if (!formData.username) newErrors.username = 'El usuario es requerido';
    else if (getUserByUsername(formData.username)) newErrors.username = 'Este nombre de usuario ya existe';

    if (!formData.password) newErrors.password = 'La contraseña es requerida';
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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const dioceseData = {
        name: formData.name,
        ecclesiasticalProvince: formData.ecclesiasticalProvince,
        bishop: formData.bishop,
        auxiliaryBishop: formData.auxiliaryBishop || '',
        jurisdiction: formData.jurisdiction,
        city: formData.jurisdiction,
        country: 'Colombia' 
      };

      const userData = {
        username: formData.username,
        password: formData.password,
        email: `${formData.username.toLowerCase()}@eclesia.org`
      };

      const result = createDioceseArchdiocese(dioceseData, userData);
      
      if (result.success) {
          toast({ title: 'Éxito', description: 'Diócesis/Arquidiócesis creada correctamente.' });
          handleClose();
      } else {
          toast({ title: 'Error', description: result.message || 'No se pudo crear el registro.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message || 'No se pudo crear el registro.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      ecclesiasticalProvince: '',
      bishop: '',
      auxiliaryBishop: '',
      jurisdiction: '',
      username: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Crear Diócesis/Arquidiócesis">
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
            <h4 className="text-sm font-bold text-[#2C3E50] mb-3">Credenciales de Acceso</h4>
            
            <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Usuario Administrador</label>
                  <Input 
                    placeholder="Usuario único" 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value})} 
                    error={errors.username}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña</label>
                        <div className="relative">
                            <Input 
                                type={showPassword ? "text" : "password"}
                                placeholder="******" 
                                value={formData.password} 
                                onChange={e => setFormData({...formData, password: e.target.value})} 
                                error={errors.password}
                                className="pr-10"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Confirmar Contraseña</label>
                        <div className="relative">
                            <Input 
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="******" 
                                value={formData.confirmPassword} 
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                                error={errors.confirmPassword}
                                className="pr-10"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateDioceseArchdioceseModal;