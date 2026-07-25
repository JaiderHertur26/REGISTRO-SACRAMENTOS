import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, X, ArrowLeft, Loader2, Info, Heart } from 'lucide-react';

const InfoBox = ({ data }) => {
    if (!data) return null;
    return (
        <div className="mb-6 border border-blue-200 rounded-lg overflow-hidden shadow-sm bg-white">
            <div className="bg-gradient-to-r from-[#4B7BA7] to-[#2a4e70] px-6 py-3 border-b border-blue-800">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                   <Info className="w-5 h-5 text-blue-200" />
                   Resumen del Registro (Lectura)
                </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Libro / Folio / Número</span>
                     <span className="text-base font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block font-mono">
                         {data.book_number} / {data.page_number} / {data.entry_number}
                     </span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Fecha Matrimonio</span>
                     <span className="text-base font-medium text-gray-800">{data.sacramentDate || '-'}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Lugar</span>
                     <span className="text-base font-medium text-gray-800 truncate" title={data.place}>{data.place || '-'}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Ministro</span>
                     <span className="text-base font-medium text-gray-800 truncate" title={data.minister}>{data.minister || '-'}</span>
                 </div>

                 <div className="border-t border-gray-100 col-span-full my-1"></div>

                 <div className="col-span-2 space-y-1">
                     <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Novio</span>
                     <span className="text-lg font-bold text-gray-900">{data.groomName} {data.groomSurname}</span>
                 </div>
                 <div className="col-span-2 space-y-1">
                     <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block">Novia</span>
                     <span className="text-lg font-bold text-gray-900">{data.brideName} {data.brideSurname}</span>
                 </div>
            </div>
        </div>
    );
};

const MatrimonioEditPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get('id');

  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState(null);

  const toInputDate = (dateStr) => {
      if (!dateStr) return '';
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr.split('T')[0];
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [d, m, y] = dateStr.split('/');
          return `${y}-${m}-${d}`;
      }
      return '';
  };

  const toStorageDate = (dateStr) => {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
  };

  useEffect(() => {
    if (!user || !recordId) return;
    loadRecord();
  }, [user, recordId]);

  const loadRecord = () => {
    setIsLoading(true);
    const entityId = user.parishId || user.dioceseId;
    const key = `matrimonios_${entityId}`;

    try {
        const storedData = localStorage.getItem(key);
        if (storedData) {
            const records = JSON.parse(storedData);
            const record = records.find(r => r.id === recordId);
            
            if (record) {
                setFormData(record);
            } else {
                toast({ title: "Error", description: "Registro no encontrado.", variant: "destructive" });
                navigate('/parroquia/matrimonio/partidas');
            }
        }
    } catch (error) {
        console.error("Error loading record:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const handleChange = (e) => {
      const { name, value, type } = e.target;
      let finalValue = value;
      
      if (type === 'date') {
          finalValue = toStorageDate(value);
      }

      setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSave = () => {
      if (!formData) return;

      setIsLoading(true);
      const entityId = user.parishId || user.dioceseId;
      const key = `matrimonios_${entityId}`;

      try {
          const storedData = localStorage.getItem(key);
          if (storedData) {
              const records = JSON.parse(storedData);
              const updatedRecords = records.map(r => 
                  r.id === recordId 
                    ? { ...formData, updatedAt: new Date().toISOString() } 
                    : r
              );
              
              localStorage.setItem(key, JSON.stringify(updatedRecords));
              toast({ title: "Éxito", description: "Registro actualizado correctamente.", className: "bg-green-50 border-green-200 text-green-900" });
              navigate('/parroquia/matrimonio/partidas');
          }
      } catch (error) {
          console.error("Error saving record:", error);
          toast({ title: "Error", description: "No se pudo guardar los cambios.", variant: "destructive" });
      } finally {
          setIsLoading(false);
      }
  };

  if (isLoading && !formData) {
      return (
          <DashboardLayout entityName={user?.parishName || "Parroquia"}>
              <div className="flex justify-center items-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" />
              </div>
          </DashboardLayout>
      );
  }

  if (!formData) return null;

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/parroquia/matrimonio/partidas')} className="p-0 hover:bg-transparent text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
        </Button>
        <div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif">Editar Registro de Matrimonio</h1>
            <p className="text-sm text-gray-600">Libro: {formData.book_number} | Folio: {formData.page_number} | Número: {formData.entry_number}</p>
        </div>
      </div>

      <InfoBox data={formData} />

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-8">
        
        {/* Section 0: Datos de Registro */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Datos del Registro</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Libro</label>
                    <Input name="book_number" value={formData.book_number || ''} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Folio</label>
                    <Input name="page_number" value={formData.page_number || ''} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Número</label>
                    <Input name="entry_number" value={formData.entry_number || ''} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Section 1: Contrayentes */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Contrayentes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 p-4 bg-blue-50/50 rounded-lg">
                    <h4 className="font-bold text-blue-800 text-xs uppercase flex items-center gap-2"><Heart className="w-3 h-3"/> Novio</h4>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombres</label>
                        <Input name="groomName" value={formData.groomName || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Apellidos</label>
                        <Input name="groomSurname" value={formData.groomSurname || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Identificación</label>
                        <Input name="groomId" value={formData.groomId || ''} onChange={handleChange} />
                    </div>
                </div>
                <div className="space-y-4 p-4 bg-pink-50/50 rounded-lg">
                     <h4 className="font-bold text-pink-800 text-xs uppercase flex items-center gap-2"><Heart className="w-3 h-3"/> Novia</h4>
                     <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombres</label>
                        <Input name="brideName" value={formData.brideName || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Apellidos</label>
                        <Input name="brideSurname" value={formData.brideSurname || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Identificación</label>
                        <Input name="brideId" value={formData.brideId || ''} onChange={handleChange} />
                    </div>
                </div>
            </div>
        </div>

        {/* Section 2: Datos de los Padres */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Padres</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h5 className="font-semibold text-gray-600 text-xs uppercase">Padres del Novio</h5>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Padre</label>
                        <Input name="groomFather" value={formData.groomFather || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Madre</label>
                        <Input name="groomMother" value={formData.groomMother || ''} onChange={handleChange} />
                    </div>
                </div>
                <div className="space-y-4">
                    <h5 className="font-semibold text-gray-600 text-xs uppercase">Padres de la Novia</h5>
                     <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Padre</label>
                        <Input name="brideFather" value={formData.brideFather || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Madre</label>
                        <Input name="brideMother" value={formData.brideMother || ''} onChange={handleChange} />
                    </div>
                </div>
            </div>
        </div>

        {/* Section 3: Datos de la Celebración */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Datos del Sacramento</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha Matrimonio</label>
                    <Input name="sacramentDate" type="date" value={toInputDate(formData.sacramentDate)} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Lugar</label>
                    <Input name="place" value={formData.place || ''} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Ministro</label>
                    <Input name="minister" value={formData.minister || ''} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Section 4: Testigos */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Testigos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Testigo 1</label>
                    <Input name="witness1" value={formData.witness1 || ''} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Testigo 2</label>
                    <Input name="witness2" value={formData.witness2 || ''} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <Button variant="outline" onClick={() => navigate('/parroquia/matrimonio/partidas')} className="text-gray-600 border-gray-300 hover:bg-gray-50">
                <X className="w-4 h-4 mr-2" />
                Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-medium">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar Cambios
            </Button>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default MatrimonioEditPage;