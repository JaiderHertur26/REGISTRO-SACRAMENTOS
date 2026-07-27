import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Network, User, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// 🚀 Añadimos "dioceseId" a las props recibidas
const CreateVicaryModal = ({ isOpen, onClose, dioceseId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({ name: '', vicarioName: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;

    if (!dioceseId) {
        toast({ title: 'Error Crítico', description: 'Jurisdicción no detectada. Recarga la página.', variant: 'destructive' });
        return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('vicarias').insert([{
        name: formData.name,
        vicar_name: formData.vicarioName,
        diocese_id: dioceseId // Usamos el ID rastreado
      }]);
      
      if (error) throw error;

      toast({ title: 'Éxito', description: 'Vicaría creada en la nube. Recarga para ver los cambios.', className: "bg-green-50 border-green-200 text-green-700" });
      setFormData({ name: '', vicarioName: '' });
      onClose();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error de Supabase', description: error.message || 'No se pudo crear la vicaría.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nueva Vicaría">
      <form onSubmit={handleSubmit} className="space-y-4 p-2 pt-4">
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Oficial de la Vicaría</label>
          <div className="relative">
              <Network className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                required
                type="text"
                placeholder="Ej: Vicaría de San Pedro" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                disabled={loading}
              />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vicario a Cargo (Opcional)</label>
          <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Ej: Pbro. Juan Pérez" 
                value={formData.vicarioName} 
                onChange={e => setFormData({...formData, vicarioName: e.target.value})} 
                className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                disabled={loading}
              />
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="w-1/3 rounded-xl border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="w-2/3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear Vicaría'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateVicaryModal;