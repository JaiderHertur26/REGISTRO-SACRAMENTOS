import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, XCircle, X, Loader2, Database } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const ImportIglesiasForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importIglesias, getIglesiasList } = useAppData();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [jsonContent, setJsonContent] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setLoading(true);
    setPreview(null);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            
            // 🚀 SALTAMOS EL VALIDADOR ESTRICTO Y VERIFICAMOS MANUALMENTE
            if (!json || !json.data || !Array.isArray(json.data)) {
                throw new Error("El archivo no tiene la estructura requerida: { \"data\": [...] }");
            }

            setJsonContent(json);

            // 🚀 Usar parishId si no hay dioceseId
            const contextId = user?.parishId || user?.dioceseId;
            const existingData = getIglesiasList(contextId) || [];
            
            const errors = [];
            const warnings = [];
            let validCount = 0;

            json.data.forEach((item, index) => {
                const idx = index + 1;
                // Extraemos tolerando mayúsculas, minúsculas y nulos
                const nombre = (item.Nombre || item.nombre || '').trim();
                const codigo = (item.Codigo || item.codigo || '').toString().trim();

                // Validación Básica
                if (!nombre) {
                    errors.push({ index: idx, message: `Fila ${idx}: La iglesia no tiene nombre asignado.` });
                    return;
                }

                // Detector de Duplicados 
                const isDuplicate = existingData.some(ex => {
                    const matchCodigo = (codigo && ex.codigo && String(ex.codigo) === String(codigo));
                    const matchNombre = (ex.nombre && String(ex.nombre).toLowerCase() === String(nombre).toLowerCase());
                    return matchCodigo || matchNombre;
                });
                
                if (isDuplicate) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Se omitirá "${nombre}" (Ya existe en la base de datos).` });
                } else {
                    validCount++;
                }
            });

            setValidationResult({ count: validCount, errors, warnings });
            setPreview(json.data.slice(0, 5));
        } catch (err) {
            toast({ title: "Error de Lectura", description: err.message, variant: "destructive" });
            setValidationResult({ count: 0, errors: [{ message: err.message }], warnings: [] });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = async () => {
      if (!jsonContent || !jsonContent.data || !validationResult) return;
      
      setLoading(true);

      const contextId = user?.parishId || user?.dioceseId;
      if (!contextId) {
          toast({ title: "Error", description: "Falta el ID de contexto de la parroquia.", variant: "destructive" });
          setLoading(false);
          return;
      }

      const existingData = getIglesiasList(contextId) || [];
      const originalCount = jsonContent.data.length;
      
      // 🚀 FILTRO SEGURO ANTES DE INYECTAR
      const filteredData = jsonContent.data.filter(item => {
          const nombre = (item.Nombre || item.nombre || '').trim().toLowerCase();
          const codigo = (item.Codigo || item.codigo || '').toString().trim();
          
          return !existingData.some(ex => {
              const matchCod = (codigo && ex.codigo && String(ex.codigo) === String(codigo));
              const matchNom = (ex.nombre && String(ex.nombre).toLowerCase() === nombre);
              return matchCod || matchNom;
          });
      });

      const duplicatesCount = originalCount - filteredData.length;
      
      let result;
      if (filteredData.length > 0) {
          // Limpiamos los "nulls" para evitar errores en Supabase
          const cleanData = filteredData.map(item => ({
              codigo: item.codigo || item.Codigo || null,
              nombre: item.nombre || item.Nombre || null,
              nit: item.nronit || item.nit || null,
              direccion: item.direccion || null,
              ciudad: item.ciudad || null,
              telefono: item.telefono || null,
              fax: item.nrofax || item.fax || null,
              email: item.email || null,
              parroco: item.parroco || null,
              diocesis: item.diocesis || null
          }));

          result = await importIglesias({ data: cleanData }, contextId, false);
      } else {
          result = { success: true, count: 0, message: "No hay registros nuevos. Todos son duplicados." };
      }

      setLoading(false);

      if (result.success) {
           let msg = `${result.count} iglesias inyectadas a la Nube.`;
           if (duplicatesCount > 0) {
               msg = `${result.count} iglesias inyectadas, ${duplicatesCount} omitidas por ser duplicadas.`;
           }
           
           toast({
               title: "Base de Datos Actualizada",
               description: msg,
               className: "bg-green-50 border-green-200 text-green-900"
           });
           handleClose();
      } else {
           toast({ title: "Fallo en Guardado", description: result.message, variant: "destructive" });
      }
  };

  const handleClose = () => {
      setPreview(null);
      setValidationResult(null);
      setJsonContent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
  };

  const columns = [
      { header: 'Código', render: r => <span className="font-mono text-gray-500">{r.codigo || r.Codigo || '-'}</span> },
      { header: 'Nombre Oficial', render: r => <span className="font-bold text-gray-900">{r.nombre || r.Nombre}</span> },
      { header: 'Ciudad', render: r => r.ciudad || r.Ciudad || '-' },
      { header: 'Diócesis', render: r => <span className="text-[10px] bg-blue-50 px-2 py-1 rounded text-blue-700 font-bold">{r.diocesis || '-'}</span> },
  ];

  const hasErrors = validationResult?.errors?.length > 0;
  const canConfirm = validationResult && !hasErrors && !loading;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Carga Masiva de Iglesias">
        <div className="space-y-6 min-w-[700px] max-w-2xl">
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-[1.5rem] flex gap-3 items-start">
                <Database className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest">Motor de Inyección</h4>
                    <p className="text-[11px] text-blue-700 leading-tight mt-1">El sistema omitirá registros con el mismo código o nombre. Asegúrese de que el archivo JSON tenga la llave "data".</p>
                </div>
            </div>

            {!preview && !hasErrors && (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-[2rem] p-12 text-center bg-gray-50 hover:bg-white hover:border-[#4B7BA7] transition-all cursor-pointer">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                    <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <span className="text-gray-900 font-black uppercase text-sm block">Seleccionar archivo JSON</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 block">Formato: {`{ "data": [...] }`}</span>
                </div>
            )}

            {loading && (
                <div className="py-12 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                    <p className="font-black text-xs text-gray-400 uppercase tracking-widest">Procesando registros...</p>
                </div>
            )}

            {validationResult && !loading && (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-green-50 border border-green-100 p-4 rounded-2xl text-center">
                             <div className="text-[10px] text-green-700 uppercase font-black tracking-widest mb-1">Listos</div>
                             <div className="text-3xl font-black text-green-900">{validationResult.count || 0}</div>
                        </div>
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center">
                             <div className="text-[10px] text-red-700 uppercase font-black tracking-widest mb-1">Errores</div>
                             <div className="text-3xl font-black text-red-900">{validationResult.errors?.length || 0}</div>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center">
                             <div className="text-[10px] text-amber-700 uppercase font-black tracking-widest mb-1">Omitidos</div>
                             <div className="text-3xl font-black text-amber-900">{validationResult.warnings?.length || 0}</div>
                        </div>
                    </div>

                    {preview && preview.length > 0 && (
                        <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vista Previa de Limpieza</span>
                            </div>
                            <Table columns={columns} data={preview} />
                        </div>
                    )}

                    {hasErrors && (
                        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 max-h-40 overflow-y-auto custom-scrollbar">
                            <h4 className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-red-800 mb-2">
                                <XCircle className="w-4 h-4" /> Errores Críticos (Detienen inyección)
                            </h4>
                            <ul className="list-none space-y-1">
                                {validationResult.errors.map((err, idx) => (
                                    <li key={idx} className="text-xs text-red-600 font-medium border-b border-red-100/50 pb-1">{err.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validationResult.warnings?.length > 0 && (
                         <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 max-h-40 overflow-y-auto custom-scrollbar">
                            <h4 className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-amber-800 mb-2">
                                <AlertTriangle className="w-4 h-4" /> Advertencias (Duplicados a Omitir)
                            </h4>
                            <ul className="list-none space-y-1">
                                {validationResult.warnings.map((warn, idx) => (
                                    <li key={idx} className="text-xs text-amber-600 font-medium border-b border-amber-100/50 pb-1">{warn.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <Button variant="ghost" onClick={handleClose} className="px-8 text-gray-400 font-black uppercase tracking-widest text-[10px]">
                    Cancelar
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    disabled={!canConfirm}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-xl text-white px-10 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all transform active:scale-95 disabled:opacity-30"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Inyectar a la Nube
                </Button>
            </div>
        </div>
    </Modal>
  );
};

export default ImportIglesiasForm;