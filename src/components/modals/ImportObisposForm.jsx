import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { 
    Upload, CheckCircle2, AlertTriangle, XCircle, 
    X, Loader2, UserCheck, FileJson, Database 
} from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';
import { cn } from '@/lib/utils';

// 🚀 RECIBIMOS LA LISTA REAL DE LA BD
const ImportObisposForm = ({ isOpen, onClose, existingItems = [] }) => {
  const { user } = useAuth();
  const { importObispos, validateJSONStructure } = useAppData(); // Eliminado getObispos
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
            const structureCheck = validateJSONStructure(json);
            if (!structureCheck.isValid) {
                throw new Error(structureCheck.message);
            }

            const errors = [];
            const warnings = [];
            let validCount = 0;
            const validData = [];

            // 🚀 DOBLE FILTRO DE MEMORIA PARA EL JSON
            const nombresCompletosEnArchivo = new Set();

            json.data.forEach((item, index) => {
                const idx = index + 1;
                const nombreRaw = item.Nombre || item.nombre || '';
                const apellidoRaw = item.Apellido || item.apellido || '';
                
                const nombre = String(nombreRaw).trim();
                const apellido = String(apellidoRaw).trim();
                
                if (!nombre || !apellido) {
                    errors.push({ index: idx, message: `Fila ${idx}: Nombre y Apellido son requeridos.` });
                    return;
                }

                // Unimos nombre y apellido para crear una llave única
                const fullNameStr = `${nombre} ${apellido}`.toLowerCase();

                // 1. Validar contra la Base de Datos
                const isDuplicateDB = existingItems.some(ex => {
                    const exFullName = `${ex.nombre || ''} ${ex.apellido || ''}`.toLowerCase();
                    return exFullName === fullNameStr;
                });

                // 2. Validar duplicados en el mismo archivo
                const isDuplicateFile = nombresCompletosEnArchivo.has(fullNameStr);
                
                if (isDuplicateDB) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Obispo "${nombre} ${apellido}" ya existe en sistema.` });
                } else if (isDuplicateFile) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Obispo "${nombre} ${apellido}" está repetido en el archivo.` });
                } else {
                    nombresCompletosEnArchivo.add(fullNameStr);
                    validCount++;
                    validData.push(item);
                }
            });

            // Guardamos solo la data purificada
            setJsonContent({ data: validData });
            setValidationResult({ count: validCount, errors, warnings });
            setPreview(validData.slice(0, 5));
            
        } catch (err) {
            toast({ title: "Error de Validación", description: err.message, variant: "destructive" });
            setValidationResult({ count: 0, errors: [{ message: err.message }], warnings: [] });
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsText(selectedFile);
  };

  // 🚀 AÑADIDO ASYNC/AWAIT PARA ESPERAR A SUPABASE
  const handleConfirm = async () => {
      if (!jsonContent || !jsonContent.data) return;
      
      setLoading(true);

      try {
          const contextId = user?.parishId || user?.dioceseId;
          if (!contextId) {
              throw new Error("No se encontró el ID de su Parroquia o Diócesis.");
          }

          let result;
          if (jsonContent.data.length > 0) {
              const cleanData = jsonContent.data.map(item => ({
                  nombre: item.Nombre || item.nombre || null,
                  apellido: item.Apellido || item.apellido || null,
                  diocesis: item.Diocesis || item.diocesis || null,
                  fechaNombramiento: item.FechaNombramiento || item.fechaNombramiento || null,
                  email: item.Email || item.email || null
              }));

              result = await importObispos({ data: cleanData }, contextId, false);
          } else {
              result = { success: true, count: 0, message: "No hay registros nuevos para inyectar." };
          }

          if (result.success) {
               toast({
                   title: "Importación Completada",
                   description: `${result.count} obispos inyectados a la Nube.`,
                   className: "bg-green-50 border-green-200 text-green-900"
               });
               handleClose();
          } else {
               throw new Error(result.message);
          }
      } catch (err) {
          console.error(err);
          toast({ title: "Error en inyección", description: err.message, variant: "destructive" });
      } finally {
          setLoading(false);
      }
  };

  const handleClose = () => {
      setPreview(null);
      setValidationResult(null);
      setJsonContent(null);
      onClose();
  };

  const columns = [
      { header: 'Nombres', render: r => <span className="font-bold text-gray-900">{r.Nombre || r.nombre}</span> },
      { header: 'Apellidos', render: r => <span className="font-bold text-gray-900">{r.Apellido || r.apellido}</span> },
      { header: 'Diócesis', render: r => <span className="text-[10px] bg-blue-50 px-2 py-1 rounded text-blue-700 font-bold">{r.Diocesis || r.diocesis || '-'}</span> },
  ];

  const hasErrors = validationResult?.errors?.length > 0;
  const canConfirm = validationResult && !hasErrors && !loading;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Carga Masiva de Obispos">
        <div className="space-y-8 min-w-[700px] max-w-2xl">
            
            <div className="flex items-start gap-4 bg-blue-50/50 p-5 rounded-[1.5rem] border border-blue-100/50">
                <div className="bg-[#4B7BA7] p-2 rounded-xl text-white shadow-lg shadow-blue-900/10">
                    <UserCheck className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Nivel: Diocesano</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed font-medium uppercase tracking-tight">
                        El sistema omitirá registros duplicados. Asegúrese de que el archivo JSON tenga la llave "data" conteniendo Nombre y Apellido.
                    </p>
                </div>
            </div>

            {!preview && !hasErrors && !loading && (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group border-2 border-dashed border-gray-200 rounded-[2.5rem] p-16 text-center bg-gray-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><FileJson className="w-40 h-40" /></div>
                    <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4 group-hover:text-[#4B7BA7] transition-colors" />
                    <p className="text-lg font-black text-gray-700 uppercase tracking-tight">Subir Archivo JSON</p>
                    <p className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">Formato: {`{ "data": [...] }`}</p>
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                </div>
            )}

            {loading && (
                <div className="py-20 text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mx-auto" />
                    <p className="text-[#4B7BA7] font-black uppercase tracking-widest text-xs animate-pulse">Analizando integridad de datos...</p>
                </div>
            )}

            {validationResult && !loading && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard label="Nuevos" val={validationResult.count} color="green" />
                        <StatCard label="Errores" val={validationResult.errors.length} color="red" />
                        <StatCard label="Duplicados" val={validationResult.warnings.length} color="amber" />
                    </div>

                    {preview?.length > 0 && (
                        <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Database className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Muestra de datos purificados</span>
                            </div>
                            <Table columns={columns} data={preview} />
                        </div>
                    )}

                    {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {validationResult.errors.length > 0 && (
                                <AlertBox title="Errores Críticos" list={validationResult.errors} type="error" />
                            )}
                            {validationResult.warnings.length > 0 && (
                                <AlertBox title="Duplicados Omitidos" list={validationResult.warnings} type="warning" />
                            )}
                        </div>
                    )}
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

// --- COMPONENTES AUXILIARES ---

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

const AlertBox = ({ title, list, type }) => {
    const isError = type === 'error';
    return (
        <div className={cn("rounded-2xl border p-4 max-h-40 overflow-y-auto custom-scrollbar", isError ? "bg-red-50/50 border-red-100" : "bg-amber-50/50 border-amber-100")}>
            <div className="flex items-center gap-2 mb-3">
                {isError ? <XCircle className="w-4 h-4 text-red-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                <span className={cn("text-[10px] font-black uppercase tracking-widest", isError ? "text-red-700" : "text-amber-700")}>{title}</span>
            </div>
            <ul className="space-y-1.5">
                {list.map((msg, i) => (
                    <li key={i} className={cn("text-[10px] font-medium leading-tight", isError ? "text-red-600" : "text-amber-600")}>• {msg}</li>
                ))}
            </ul>
        </div>
    );
};

export default ImportObisposForm;