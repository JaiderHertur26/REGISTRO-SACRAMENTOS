import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Map, User as UserIcon } from 'lucide-react';

const CreateDecanateModal = ({ isOpen, onClose }) => {
  const { data, createDecanate } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false); // Estado de carga añadido

  const [formData, setFormData] = useState({
    name: '',
    decanName: '',
    vicaryId: ''
  });

  // Extraemos las vicarías de forma segura y filtramos por la diócesis actual
  const vicaries = (data?.vicariates || []).filter(v => v.dioceseId === user?.dioceseId);

  // Convertimos a async para esperar a Supabase
  const handleSubmit = async (e) => { 
    e.preventDefault();
    
    if (!formData.vicaryId) {
        toast({ title: "Campo requerido", description: "Debes seleccionar a qué Vicaría pertenece este decanato.", variant: "destructive" });
        return;
    }

    setLoading(true); // Inicia la carga

    try {
        const newDecanate = {
            ...formData,
            dioceseId: user.dioceseId
        };

        // Esperamos la respuesta de la nube
        const result = await createDecanate(newDecanate); 
        
        if (result && result.success) {
            toast({ title: "Éxito", description: "Decanato creado y subido a la nube.", variant: "success" });
            setFormData({ name: '', decanName: '', vicaryId: '' });
            onClose();
        } else {
            toast({ title: "Error", description: result?.message || "No se pudo crear el decanato.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "Error de conexión.", variant: "destructive" });
    } finally {
        setLoading(false); // Termina la carga
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nuevo Decanato">
      <form onSubmit={handleSubmit} className="space-y-4 p-2">
        
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Vicaría a la que pertenece</label>
          <select
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none bg-white font-medium disabled:opacity-50"
            value={formData.vicaryId}
            onChange={(e) => setFormData({...formData, vicaryId: e.target.value})}
            disabled={loading}
          >
            <option value="">-- Seleccione una Vicaría --</option>
            {vicaries.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          {vicaries.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No tienes vicarías creadas. Primero crea una Vicaría.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre del Decanato</label>
          <div className="relative">
              <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none disabled:bg-gray-100"
                placeholder="Ej: Decanato Norte"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                disabled={loading}
              />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre del Decano (Opcional)</label>
          <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none disabled:bg-gray-100"
                placeholder="Ej: Pbro. Juan Pérez"
                value={formData.decanName}
                onChange={(e) => setFormData({...formData, decanName: e.target.value})}
                disabled={loading}
              />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} className="w-1/3" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" className="w-2/3 bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-bold" disabled={loading}>
            {loading ? 'Subiendo a la nube...' : 'Guardar Decanato'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateDecanateModal;