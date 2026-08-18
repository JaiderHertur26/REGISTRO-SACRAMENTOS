import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, XCircle, X, Loader2, Database } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';
import { cn } from '@/lib/utils';

// 🚀 AHORA RECIBE LA LISTA REAL DE LA BASE DE DATOS COMO PROP (existingItems)
const ImportIglesiasForm = ({ isOpen, onClose, existingItems = [] }) => {
  const { user } = useAuth();
  const { importIglesias } = useAppData(); // Se eliminó getIglesiasList de aquí
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [jsonContent, setJsonContent] = useState(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setLoading(true);
    setPreview(null);
    setValidationResult(null);

    try {
        const textData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error("Error físico al leer el archivo."));
            reader.readAsText(selectedFile);
        });

        const json = JSON.parse(textData);
        
        if (!json || !json.data || !Array.isArray(json.data)) {
            throw new Error("El archivo no tiene la estructura requerida: { \"data\": [...] }");
        }

        const errors = [];
        const warnings = [];
        let validCount = 0;
        const validData = [];

        // 🚀 DOBLE FILTRO: Memoria para no duplicar los que vengan repetidos en el propio archivo
        const codigosEnArchivo = new Set();
        const nombresEnArchivo = new Set();

        json.data.forEach((item, index) => {
            const idx = index + 1;
            
            if (!item || typeof item !== 'object') {
                warnings.push(`Fila ${idx}: Omitida (Fila completamente vacía o corrupta).`);
                return; 
            }

            const nombreRaw = item.Nombre || item.nombre || '';
            const codigoRaw = item.Codigo || item.codigo || '';
            
            const nombre = String(nombreRaw).trim();
            const codigo = String(codigoRaw).trim();
            const nombreLower = nombre.toLowerCase();
            const codigoLower = codigo.toLowerCase();

            if (!nombre) {
                warnings.push(`Fila ${idx}: Omitida (La iglesia no tiene nombre asignado).`);
                return; 
            }

            // 1. Validar contra la Base de Datos real
            const isDuplicateDB = existingItems.some(ex => {
                if (!ex) return false;
                const matchCodigo = (codigoLower && ex.codigo && String(ex.codigo).toLowerCase() === codigoLower);
                const matchNombre = (ex.nombre && String(ex.nombre).toLowerCase() === nombreLower);
                return matchCodigo || matchNombre;
            });

            // 2. Validar contra el mismo archivo JSON
            const isDuplicateFile = (codigoLower && codigosEnArchivo.has(codigoLower)) || nombresEnArchivo.has(nombreLower);
            
            if (isDuplicateDB) {
                warnings.push(`Fila ${idx}: Omitida "${nombre}" (Ya existe en la Base de Datos).`);
            } else if (isDuplicateFile) {
                warnings.push(`Fila ${idx}: Omitida "${nombre}" (Repetido dentro del mismo archivo).`);
            } else {
                if (codigoLower) codigosEnArchivo.add(codigoLower);
                nombresEnArchivo.add(nombreLower);
                validCount++;
                validData.push(item);
            }
        });

        // Solo guardamos la data que pasó todos los filtros
        setJsonContent({ data: validData });
        setValidationResult({ count: validCount, errors, warnings });
        setPreview(validData.slice(0, 5));

    } catch (err) {
        console.error(err);
        toast({ title: "Error de Lectura", description: err.message, variant: "destructive" });
        setValidationResult({ count: 0, errors: [err.message], warnings: [] });
    } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
      if (!jsonContent || !jsonContent.data) return;
      
      setLoading(true);

      try {
          const contextId = user?.parishId || user?.dioceseId;
          if (!contextId) {
              throw new Error("Falta el ID de contexto para realizar la importación.");
          }

          let result;
          if (jsonContent.data.length > 0) {
              const cleanData = jsonContent.data.map(item => ({
                  codigo: item.Codigo || item.codigo || null,
                  nombre: item.Nombre || item.nombre || null,
                  nit: item.Nit || item.nit || item.nronit || null,
                  direccion: item.Direccion || item.direccion || null,
                  ciudad: item.Ciudad || item.ciudad || null,
                  telefono: item.Telefono || item.telefono || null,
                  fax: item.Fax || item.fax || item.nrofax || null,
                  email: item.Email || item.email || null,
                  parroco: item.Parroco || item.parroco || null,
                  diocesis: item.Diocesis || item.diocesis || null
              }));

              result = await importIglesias({ data: cleanData }, contextId, false);
          } else {
              result = { success: true, count: 0, message: "No hay registros nuevos para inyectar." };
          }

          if (result.success) {
               toast({
                   title: "Base de Datos Actualizada",
                   description: `${result.count} iglesias inyectadas a la Nube.`,
                   className: "bg-green-50 border-green-200 text-green-900"
               });
               handleClose();
          } else {
               throw new Error(result.message);
          }

      } catch (err) {
          console.error("Fallo de inyección:", err);
          toast({ title: "Fallo en Guardado", description: err.message, variant: "destructive" });
      } finally {
          setLoading(false); 
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
      { header: 'Diócesis', render: r => <span className="text-[10px] bg-blue-50 px-2 py-1 rounded text-blue-700 font-bold">{r.diocesis || r.Diocesis || '-'}</span> },
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
                    <p className="font-black text-sm text-gray-500 uppercase tracking-widest">Analizando e inyectando datos...</p>
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

export default ImportIglesiasForm;