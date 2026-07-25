import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';

const EditChancellorModal = ({ isOpen, onClose, chancellor }) => {
  const { updateChancellor, data } = useAppData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (chancellor) {
      setName(chancellor.name || '');
      setPhone(chancellor.phone || '');
      setEmail(chancellor.email || chancellor.contactEmail || '');
      setAddress(chancellor.address || '');
      
      // Find associated user for additional data if available
      const foundUser = data.users?.find(u => u.id === chancellor.userId);
      setUser(foundUser);
    }
  }, [chancellor, data.users]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim() && !phone.trim() && !email.trim() && !address.trim()) {
      toast({ title: 'Error', description: 'Debe completar al menos un campo para actualizar.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await updateChancellor(chancellor.id, { 
        name, 
        phone, 
        email, 
        address 
      });

      if (result && !result.success) {
        throw new Error(result.message || 'Error al actualizar');
      }

      toast({ title: 'Éxito', description: 'Cancillería actualizada correctamente.', className: "bg-green-50" });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Helper to resolve the display username checking multiple sources:
   * 1. The found user object from global state
   * 2. Direct properties on the chancellor object (fallbacks from legacy/import data)
   */
  const getDisplayUsername = () => {
    // Check global user object first
    if (user) {
      if (typeof user.username === 'string') return user.username;
      if (user.username?.username) return user.username.username;
      if (user.email) return user.email;
    }

    // Fallback to chancellor object properties as requested
    return (
      chancellor?.username || 
      chancellor?.usuario || 
      chancellor?.user_email || 
      "No asignado"
    );
  };

  if (!chancellor) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Cancillería">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre del Canciller / Sede</label>
          <Input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Ej. Pbro. Juan Pérez / Cancillería Diocesana"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Teléfono</label>
            <Input 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              placeholder="Número de contacto"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email de Contacto</label>
            <Input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="correo@ejemplo.com"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Dirección / Sede</label>
          <Input 
            value={address} 
            onChange={e => setAddress(e.target.value)} 
            placeholder="Dirección física de la cancillería"
          />
        </div>

        <div className="border-t border-gray-100 pt-4 mt-4 bg-gray-50 p-4 rounded-md">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Información de Cuenta (Referencia)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Nombre de Usuario</label>
              <p className="text-sm font-bold text-gray-900 bg-white border border-gray-200 px-2 py-1 rounded select-all">
                {getDisplayUsername()}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Contraseña</label>
              <p className="text-sm font-medium text-gray-500 italic mt-1">Protegida / No editable aquí</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 italic">
            * El nombre de usuario se utiliza para acceder al sistema. No se puede cambiar desde este formulario.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-[#4B7BA7] hover:bg-[#3B6B97]" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditChancellorModal;