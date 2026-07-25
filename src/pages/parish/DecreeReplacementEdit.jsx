import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Save, X, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const DecreeReplacementEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const decreeId = searchParams.get('id');
  const { toast } = useToast();
  const { 
    getDecreeReplacementsBySacrament, 
    updateDecreeReplacement,
    deleteDecreeReplacement,
    getConceptosAnulacion
  } = useAppData();
  
  const [decree, setDecree] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.parishId) {
      setConcepts(getConceptosAnulacion(user.parishId));
      if (decreeId) loadDecree();
    }
  }, [user, decreeId]);

  const loadDecree = () => {
    const types = ['bautismo', 'confirmacion', 'matrimonio'];
    let found = null;
    for (const t of types) {
      const list = getDecreeReplacementsBySacrament(t, user.parishId);
      found = list.find(d => d.id === decreeId);
      if (found) break;
    }
    
    if (found) {
      setDecree(found);
    } else {
      toast({ title: "Error", description: "Decreto no encontrado.", variant: "destructive" });
      navigate('/parish/decree-replacement/view');
    }
    setIsLoading(false);
  };

  const handleSave = () => {
    const result = updateDecreeReplacement(decree.id, {
      conceptoAnulacionId: decree.conceptoAnulacionId,
      notes: decree.notes,
      status: decree.status,
      decreeNumber: decree.decreeNumber,
      decreeDate: decree.decreeDate
    }, user.parishId);
    
    if (result.success) {
      toast({ title: "Guardado", description: "El decreto ha sido actualizado.", className: "bg-green-600 text-white" });
      navigate('/parish/decree-replacement/view');
    } else {
      toast({ title: "Error", description: result.error || "No se pudo guardar el decreto.", variant: "destructive" });
    }
  };

  const handleDelete = () => {
    if (window.confirm('¿Está seguro de que desea eliminar este decreto?')) {
      const result = deleteDecreeReplacement(decree.id, user.parishId);
      if (result.success) {
        toast({ title: "Eliminado", description: "El decreto ha sido eliminado.", className: "bg-green-600 text-white" });
        navigate('/parish/decree-replacement/view');
      } else {
        toast({ title: "Error", description: result.error || "No se pudo eliminar el decreto.", variant: "destructive" });
      }
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!decree) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">Decreto no encontrado</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/parish/decree-replacement/view')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold">Editar Decreto de Reemplazo</h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Decreto
              </label>
              <Input
                value={decree.decreeNumber || ''}
                onChange={(e) => setDecree({ ...decree, decreeNumber: e.target.value })}
                placeholder="Ej: 001-2024"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha del Decreto
              </label>
              <Input
                type="date"
                value={decree.decreeDate || ''}
                onChange={(e) => setDecree({ ...decree, decreeDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Concepto de Anulación
            </label>
            <select
              value={decree.conceptoAnulacionId || ''}
              onChange={(e) => setDecree({ ...decree, conceptoAnulacionId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar concepto...</option>
              {concepts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas
            </label>
            <textarea
              value={decree.notes || ''}
              onChange={(e) => setDecree({ ...decree, notes: e.target.value })}
              placeholder="Notas adicionales..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={decree.status || 'active'}
              onChange={(e) => setDecree({ ...decree, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          <div className="flex gap-3 pt-6 border-t">
            <Button
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </Button>
            <Button
              onClick={() => navigate('/parish/decree-replacement/view')}
              variant="outline"
              className="flex items-center gap-2 ml-auto"
            >
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DecreeReplacementEdit;