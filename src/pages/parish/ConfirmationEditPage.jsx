import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, X, ArrowLeft, Loader2, Info } from 'lucide-react';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';

// --- HELPER FUNCTIONS ---

// Helper to normalize sex values to specific uppercase format
const normalizeSex = (val) => {
    if (!val) return '';
    const s = String(val).toUpperCase().trim();
    
    // Handle numeric codes
    if (s === '1') return 'MASCULINO';
    if (s === '2') return 'FEMENINO';
    
    // Handle text variations
    if (s.startsWith('M')) return 'MASCULINO';
    if (s.startsWith('F')) return 'FEMENINO';
    
    return '';
};

const convertirSexo = (sexoCode) => {
    const normalized = normalizeSex(sexoCode);
    return normalized || 'NO ESPECIFICADO';
};

const InfoBox = ({ data }) => {
    if (!data) return null;

    // Determine correctness based on isAnnulled property
    const isValid = !data.isAnnulled;

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
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Fecha Confirmación</span>
                     <span className="text-base font-medium text-gray-800">{data.sacramentDate || '-'}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Ministro</span>
                     <span className="text-base font-medium text-gray-800 truncate" title={data.minister}>{data.minister || '-'}</span>
                 </div>

                 <div className="border-t border-gray-100 col-span-full my-1"></div>

                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Apellidos</span>
                     <span className="text-base font-bold text-gray-900">{data.lastName}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Nombres</span>
                     <span className="text-base font-bold text-gray-900">{data.firstName}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Sexo</span>
                     <span className="text-base font-medium text-gray-800">{convertirSexo(data.sex)}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Fecha Nacimiento</span>
                     <span className="text-base font-medium text-gray-800">{data.birthDate || '-'}</span>
                 </div>

                 <div className="border-t border-gray-100 col-span-full my-1"></div>

                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Padre</span>
                     <span className="text-base font-medium text-gray-800">{data.fatherName || 'NO REGISTRADO'}</span>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Madre</span>
                     <span className="text-base font-medium text-gray-800">{data.motherName || 'NO REGISTRADO'}</span>
                 </div>
                 <div className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Lugar Confirmación</span>
                      <span className="text-base font-medium text-gray-800">{data.sacramentPlace || data.place || '-'}</span>
                 </div>
            </div>
            {/* Status Footer - Shows CORRECTA or ANULADA based on validity */}
            <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end items-center">
                {isValid ? (
                    <span className="text-green-600 font-bold text-lg">CORRECTA</span>
                ) : (
                    <span className="text-red-600 font-bold text-lg">ANULADA</span>
                )}
            </div>
        </div>
    );
};

const ConfirmationEditPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get('id');

  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState(null);

  // Helper to convert storage format (DD/MM/YYYY) to input format (YYYY-MM-DD)
  const toInputDate = (dateStr) => {
      if (!dateStr) return '';
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr.split('T')[0];
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [d, m, y] = dateStr.split('/');
          return `${y}-${m}-${d}`;
      }
      return '';
  };

  // Helper to convert input format (YYYY-MM-DD) to storage format (DD/MM/YYYY)
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
    const key = `confirmations_${entityId}`;

    try {
        const storedData = localStorage.getItem(key);
        if (storedData) {
            const records = JSON.parse(storedData);
            const record = records.find(r => r.id === recordId);
            
            if (record) {
                // Ensure robust mapping of fields that might have different names in legacy data
                
                // Prepare baptism data object from mixed sources
                // PRIORITY: record.baptismData object -> record.baptismPlace (flat) -> record.lugarBautismo (legacy flat)
                
                const rawBaptismData = record.baptismData || {};
                
                // Construct a robust baptismInfo object
                const baptismInfo = {
                    place: rawBaptismData.place || record.baptismPlace || record.lugarBautismo || '',
                    book: rawBaptismData.book || rawBaptismData.libro || record.baptismBook || record.libroBautismo || '',
                    folio: rawBaptismData.folio || rawBaptismData.page || record.baptismFolio || record.folioBautismo || '',
                    number: rawBaptismData.number || rawBaptismData.entry || record.baptismNumber || record.numeroBautismo || ''
                };

                const initializedRecord = {
                    ...record,
                    // Map legacy/Spanish field names to form state names
                    ministerFaith: record.ministerFaith || record.daFe || record.signature || '',
                    observations: record.observations || record.notaMarginal || record.notasMarginales || '',
                    // Use the normalized baptism data object
                    baptismData: baptismInfo,
                    // VITAL: Normalize sex to uppercase MASCULINO/FEMENINO on load
                    sex: normalizeSex(record.sex || record.sexo)
                };

                setFormData(initializedRecord);
            } else {
                toast({ title: "Error", description: "Registro no encontrado.", variant: "destructive" });
                navigate('/parroquia/confirmacion/partidas');
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
      
      // Additional normalization for sex field, though select options should handle it
      if (name === 'sex') {
          finalValue = normalizeSex(value);
      }

      setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleBaptismDataChange = (field, value) => {
      setFormData(prev => ({
          ...prev,
          baptismData: {
              ...prev.baptismData,
              [field]: value
          }
      }));
  };

  const handleSave = () => {
      if (!formData) return;

      setIsLoading(true);
      const entityId = user.parishId || user.dioceseId;
      const key = `confirmations_${entityId}`;

      try {
          const storedData = localStorage.getItem(key);
          if (storedData) {
              const records = JSON.parse(storedData);
              const updatedRecords = records.map(r => 
                  r.id === recordId 
                    ? { 
                        ...formData, 
                        sex: normalizeSex(formData.sex), // Ensure saved value is normalized
                        updatedAt: new Date().toISOString() 
                      } 
                    : r
              );
              
              localStorage.setItem(key, JSON.stringify(updatedRecords));
              toast({ title: "Éxito", description: "Registro actualizado correctamente.", className: "bg-green-50 border-green-200 text-green-900" });
              navigate('/parroquia/confirmacion/partidas');
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
        <Button variant="ghost" onClick={() => navigate('/parroquia/confirmacion/partidas')} className="p-0 hover:bg-transparent text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
        </Button>
        <div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif">Editar Registro de Confirmación</h1>
            <p className="text-sm text-gray-600">Libro: {formData.book_number} | Folio: {formData.page_number} | Número: {formData.entry_number}</p>
        </div>
      </div>

      {/* Info Box with Read-Only Data */}
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

        {/* Section 1: Datos del Confirmado */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Datos del Confirmado</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Apellidos</label>
                    <Input name="lastName" value={formData.lastName || ''} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombres</label>
                    <Input name="firstName" value={formData.firstName || ''} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Sexo</label>
                    <select 
                        name="sex" 
                        value={formData.sex || ''} 
                        onChange={handleChange}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B7BA7] bg-white text-gray-900"
                    >
                        <option value="">Seleccione...</option>
                        <option value="MASCULINO">MASCULINO</option>
                        <option value="FEMENINO">FEMENINO</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha de Nacimiento</label>
                    <Input name="birthDate" type="date" value={toInputDate(formData.birthDate)} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Section 2: Datos del Sacramento */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Datos de la Confirmación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha de Confirmación</label>
                    <Input name="sacramentDate" type="date" value={toInputDate(formData.sacramentDate)} onChange={handleChange} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Lugar Confirmación (Parroquia)</label>
                    <Input name="sacramentPlace" value={formData.sacramentPlace || formData.place || ''} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Section 2.5: Datos del Bautismo - FIX APPLIED HERE */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Datos del Bautismo</h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                <div className="md:col-span-12">
                     <label className="text-xs font-semibold text-gray-700 mb-1 block">Lugar de Bautizo</label>
                     <ChurchLocationAutocomplete 
                        value={formData.baptismData?.place || ''} 
                        onChange={(val) => handleBaptismDataChange('place', val)} 
                        placeholder="Buscar iglesia y ciudad..." 
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
                 <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Libro</label>
                    <Input value={formData.baptismData?.book || ''} onChange={(e) => handleBaptismDataChange('book', e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Folio</label>
                    <Input value={formData.baptismData?.folio || ''} onChange={(e) => handleBaptismDataChange('folio', e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Número</label>
                    <Input value={formData.baptismData?.number || ''} onChange={(e) => handleBaptismDataChange('number', e.target.value)} />
                </div>
            </div>
        </div>

        {/* Section 3: Datos de los Padres */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Datos de los Padres</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre del Padre</label>
                    <Input name="fatherName" value={formData.fatherName || ''} onChange={handleChange} />
                </div>
                <div>
                     <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre de la Madre</label>
                    <Input name="motherName" value={formData.motherName || ''} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Section 4: Padrinos */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Padrinos</h3>
            <div className="grid grid-cols-1 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Padrinos</label>
                    <textarea 
                        name="godparents" 
                        value={formData.godparents || ''} 
                        onChange={handleChange}
                        className="w-full rounded-md border border-gray-300 p-2 text-sm h-16 resize-none focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900"
                    />
                </div>
            </div>
        </div>

        {/* Section 5: Datos Legales */}
        <div>
            <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Datos Adicionales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                 <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Ministro</label>
                    <Input name="minister" value={formData.minister || ''} onChange={handleChange} />
                </div>
                 <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Firma Responsable (Da Fe)</label>
                    <Input name="ministerFaith" value={formData.ministerFaith || ''} onChange={handleChange} placeholder="Nombre de quien firma" />
                </div>
            </div>
             <div className="grid grid-cols-1 gap-5">
                <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Notas Marginales</label>
                    <Input name="observations" value={formData.observations || ''} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <Button variant="outline" onClick={() => navigate('/parroquia/confirmacion/partidas')} className="text-gray-600 border-gray-300 hover:bg-gray-50">
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

export default ConfirmationEditPage;