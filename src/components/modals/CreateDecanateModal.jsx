import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { LayoutGrid, User, Network, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const CreateDecanateModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [vicaries, setVicaries] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({ name: '', decanName: '', vicaryId: '' });

  // Carga Vicarías directo de Supabase al abrir el modal
  useEffect(() => {
      if (!isOpen || !user?.dioceseId) return;
      const fetchVicaries = async () => {
          setFetching(true);
          const { data } = await supabase.from('vicarias').select('*').eq('diocese_id', user.dioceseId);
          if (data) setVicaries(data);
          setFetching(false);
      };
      fetchVicaries();
  }, [isOpen, user]);

  const handleSubmit = async (e) => { 
    e.preventDefault();
    if (!formData.vicaryId) {
        toast({ title: "Requerido", description: "Selecciona una Vicaría.", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
        const { error } = await supabase.from('decanatos').insert([{
            name: formData.name,
            dean_name: formData.decanName,
            vicaria_id: formData.vicaryId,
            diocese_id: user.dioceseId
        }]);
        
        if (error) throw error;
        
        toast({ title: "Éxito", description: "Decanato creado en la nube. Recarga para ver los cambios.", className: "bg-green-50 border-green-200 text-green-700" });
        setFormData({ name: '', decanName: '', vicaryId: '' });
        onClose();
    } catch (error) {
        console.error(error);
        // Muestra el mensaje exacto de Supabase si falla
        toast({ title: "Error de Supabase", description: error.message || "No se pudo crear el decanato.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nuevo Decanato">
      <form onSubmit={handleSubmit} className="space-y-4 p-2 pt-4">
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vicaría a la que pertenece</label>
          <div className="relative">
              <Network className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <select
                required
                className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-700 uppercase transition-all appearance-none"
                value={formData.vicaryId}
                onChange={(e) => setFormData({...formData, vicaryId: e.target.value})}
                disabled={loading || fetching}
              >
                <option value="" disabled>-- Seleccione una Vicaría --</option>
                {vicaries.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
          </div>
          {vicaries.length === 0 && !fetching && (
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-2 ml-1">Crea una Vicaría primero.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Oficial del Decanato</label>
          <div className="relative">
              <LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text" required
                className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                placeholder="Ej: Decanato Norte"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                disabled={loading}
              />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Decano a Cargo (Opcional)</label>
          <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                placeholder="Ej: Pbro. Juan Pérez"
                value={formData.decanName}
                onChange={(e) => setFormData({...formData, decanName: e.target.value})}
                disabled={loading}
              />
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 mt-4">
          <Button type="button" variant="outline" onClick={onClose} className="w-1/3 rounded-xl border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" className="w-2/3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all" disabled={loading || vicaries.length === 0}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear Decanato'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateDecanateModal;