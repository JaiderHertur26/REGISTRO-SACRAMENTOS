import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, XCircle, X, Loader2, Database } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';
import { cn } from '@/lib/utils';

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
            
            if (!json || !json.data || !Array.isArray(json.data)) {
                throw new Error("El archivo no tiene la estructura requerida: { \"data\": [...] }");
            }

            const contextId = user?.parishId || user?.dioceseId;
            const existingData = getIglesiasList(contextId) || [];
            
            const errors = [];
            const warnings = [];
            let validCount = 0;
            const validData = [];

            json.data.forEach((item, index) => {
                const idx = index + 1;
                
                if (!item || typeof item !== 'object') {
                    // 🚀 STRING, NO OBJETO
                    warnings.push(`Fila ${idx}: Omitida (Fila completamente vacía o corrupta).`);
                    return; 
                }

                const nombreRaw = item.Nombre || item.nombre || '';
                const codigoRaw = item.Codigo || item.codigo || '';
                
                const nombre = String(nombreRaw).trim();
                const codigo = String(codigoRaw).trim();

                if (!nombre) {
                    warnings.push(`Fila ${idx}: Omitida (La iglesia no tiene nombre asignado).`);
                    return; 
                }

                const isDuplicate = existingData.some(ex => {
                    if (!ex) return false;
                    const matchCodigo = (codigo && ex.codigo && String(ex.codigo) === codigo);
                    const matchNombre = (ex.nombre && String(ex.nombre).toLowerCase() === nombre.toLowerCase());
                    return matchCodigo || matchNombre;
                });
                
                if (isDuplicate) {
                    warnings.push(`Fila ${idx}: Omitida "${nombre}" (Ya existe en sistema).`);
                } else {
                    validCount++;
                    validData.push(item);
                }
            });

            setJsonContent({ data: validData });
            setValidationResult({ count: validCount, errors, warnings });
            setPreview(validData.slice(0, 5));

        } catch (err) {
            console.error(err);
            toast({ title: "Error de Lectura", description: err.message, variant: "destructive" });
            setValidationResult({ count: 0, errors: [err.message], warnings: [] });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = async () => {
      if (!jsonContent || !jsonContent.data) return;
      
      setLoading(true);

      const contextId = user?.parishId || user?.dioceseId;
      if (!contextId) {
          toast({ title: "Error", description: "Falta el ID de contexto.", variant: "destructive" });
          setLoading(false);
          return;
      }

      let result;
      if (jsonContent.data.length > 0) {
          const cleanData = jsonContent.data.map(item => ({
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
          result = { success: true, count: 0, message: "No hay registros nuevos para inyectar." };
      }

      setLoading(false);

      if (result.success) {
           toast({
               title: "Base de Datos Actualizada",
               description: `${result.count} iglesias inyectadas a la Nube.`,
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
        <div className="space-y-6 min-w-[700px] max-w-3xl">
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-[1.5rem] flex gap-3 items-start">
                <Database className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest">Motor de Inyección</h4>
                    <p className="text-[11px] text-blue-700 leading-tight mt-1">El sistema omitirá registros duplicados o sin nombre. Asegúrese de que el archivo JSON tenga la llave "data".</p>
                </div>
            </div>

            {!preview && !hasErrors && !loading && (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-[2rem] p-12 text-center bg-gray-50 hover:bg-white hover:border-[#4B7BA7] transition-all cursor-pointer">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                    <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <span className="text-gray-900 font-black uppercase text-sm block">Seleccionar archivo JSON</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 block">Formato: {`{ "data": [...] }`}</span>
                </div>
            )}

            {loading && (
                <div className="py-16 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                    <p className="font-black text-sm text-gray-500 uppercase tracking-widest">Analizando y purificando datos...</p>
                </div>
            )}

            {validationResult && !loading && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 w-full">
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

                    <div className="w-full">
                         {preview && preview.length > 0 && (
                            <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white mb-4 w-full">
                                <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vista Previa de Limpieza</span>
                                </div>
                                <Table columns={columns} data={preview} />
                            </div>
                        )}

                        {hasErrors && (
                            <div className="bg-red-50 rounded-2xl p-5 border border-red-100 max-h-48 overflow-y-auto custom-scrollbar mb-4 w-full">
                                <h4 className="flex items-center gap-2 text-xs uppercase tracking-widest font-black text-red-800 mb-3">
                                    <XCircle className="w-5 h-5" /> Errores Críticos
                                </h4>
                                <ul className="list-none space-y-2">
                                    {validationResult.errors.map((msg, idx) => (
                                        <li key={idx} className="text-sm text-red-700 font-medium border-b border-red-100/50 pb-2">{msg}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {validationResult.warnings?.length > 0 && (
                             <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 max-h-48 overflow-y-auto custom-scrollbar w-full">
                                <h4 className="flex items-center gap-2 text-xs uppercase tracking-widest font-black text-amber-800 mb-3">
                                    <AlertTriangle className="w-5 h-5" /> Advertencias
                                </h4>
                                <ul className="list-none space-y-2">
                                    {validationResult.warnings.map((msg, idx) => (
                                        <li key={idx} className="text-sm text-amber-700 font-medium border-b border-amber-100/50 pb-2">{msg}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-4">
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

// --- COMPONENTES AUXILIARES PARA ESTÉTICA ---
const StatCard = ({ label, val, color }) => {
    const colors = {
        green: "bg-green-50 border-green-100 text-green-700",
        red: "bg-red-50 border-red-100 text-red-700",
        amber: "bg-amber-50 border-amber-100 text-amber-700"
    };
    return (
        <div className={cn("p-5 rounded-3xl border text-center shadow-sm", colors[color])}>
            <div className="text-3xl font-black leading-none mb-1">{val}</div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">{label}</div>
        </div>
    );
};

export default ImportIglesiasForm;