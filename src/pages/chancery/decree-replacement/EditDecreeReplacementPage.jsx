import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Save, X, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const EditDecreeReplacementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const id = searchParams.get('id');
  const sacrament = searchParams.get('sacrament') || 'bautismo';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
      numeroDecreto: '',
      fechaDecreto: '',
      causa: '', 
      libroOriginal: '',
      folioOriginal: '',
      numeroOriginal: '',
      nombres: '',
      apellidos: '',
      descripcionHechos: '',
      autoridad: '',
      testigos: ''
  });

  useEffect(() => {
    if ((user?.parishId || user?.dioceseId) && id) {
        loadData();
    }
  }, [user, id]);

  const loadData = () => {
    const entityId = user.parishId || user.dioceseId;
    const storageKey = `decrees_replacement_${entityId}`;
    const allDecrees = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    const decree = allDecrees.find(d => d.id === id);
    if (decree) {
        setFormData(decree);
    } else {
        toast({ title: "Error", description: "Decreto no encontrado", variant: "destructive" });
        navigate('/chancery/decree-replacement');
    }
  };

  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
        const entityId = user.parishId || user.dioceseId;
        const storageKey = `decrees_replacement_${entityId}`;
        const allDecrees = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        const updatedDecrees = allDecrees.map(d => d.id === id ? { ...d, ...formData } : d);
        localStorage.setItem(storageKey, JSON.stringify(updatedDecrees));
        
        await new Promise(resolve => setTimeout(resolve, 500));

        toast({
            title: "Decreto Actualizado",
            description: "Los cambios han sido guardados exitosamente.",
            className: "bg-green-50 border-green-200 text-green-900"
        });
        
        navigate('/chancery/decree-replacement');
        
    } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "Error al actualizar", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const sacramentLabel = sacrament.charAt(0).toUpperCase() + sacrament.slice(1);

  return (
    <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 font-serif">Editar Decreto Reposición</h1>
            <p className="text-gray-600 font-medium text-sm">Editando decreto para {sacramentLabel}.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-5xl mx-auto p-6 space-y-6">
              
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <h3 className="font-bold text-orange-800 text-sm uppercase mb-3 border-b border-orange-300 pb-2">Datos del Decreto</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número de Decreto</label>
                          <input type="text" name="numeroDecreto" value={formData.numeroDecreto} onChange={handleChange} className="w-full px-3 py-2 border border-orange-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Fecha Decreto</label>
                          <input type="date" name="fechaDecreto" value={formData.fechaDecreto} onChange={handleChange} className="w-full px-3 py-2 border border-orange-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Causa</label>
                          <select name="causa" value={formData.causa} onChange={handleChange} className="w-full px-3 py-2 border border-orange-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none bg-white">
                              <option value="PERDIDA">Pérdida de Libros</option>
                              <option value="DETERIORO">Deterioro Total</option>
                              <option value="DESTRUCCION">Destrucción (Incendio/Inundación)</option>
                          </select>
                      </div>
                  </div>
              </div>

              {/* ... [Other form sections identical to EditDecreeReplacement.jsx] ... */}

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
                      <X className="w-4 h-4 mr-2" /> Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-[#D4AF37] hover:bg-[#C4A027] text-white font-bold">
                      {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar Cambios
                  </Button>
              </div>
        </form>
    </DashboardLayout>
  );
};

export default EditDecreeReplacementPage;