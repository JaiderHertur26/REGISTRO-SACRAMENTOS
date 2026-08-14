import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { 
    Upload, CheckCircle2, AlertTriangle, XCircle, 
    X, MapPin, Loader2, FileJson, Info, Database 
} from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';
import { cn } from '@/lib/utils';

const ImportCiudadesForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importCiudades, validateJSONStructure, getCiudadesList } = useAppData();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [jsonContent, setJsonContent] = useState(null);

  // --- 1. PROCESAMIENTO Y VALIDACIÓN DEL ARCHIVO ---
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setLoading(true);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            
            // Validar Estructura Base
            const structureCheck = validateJSONStructure(json);
            if (!structureCheck.isValid) throw new Error(structureCheck.message);

            setJsonContent(json);
            
            // 🚀 SOLUCIÓN: Usar parishId si no hay dioceseId
            const targetContextId = user?.parishId || user?.dioceseId;
            const existingData = getCiudadesList(targetContextId);
            
            const errors = [];
            const warnings = [];
            let validCount = 0;

            json.data.forEach((item, index) => {
                const rowNum = index + 1;
                const nombre = (item.data || item.Data || item.nombre || '').trim();
                
                if (!nombre) {
                    errors.push(`Fila ${rowNum}: El nombre de la ciudad es obligatorio.`);
                    return;
                }

                const isDuplicate = existingData.some(ex => 
                    String(ex.nombre).toLowerCase() === nombre.toLowerCase()
                );
                
                if (isDuplicate) {
                    warnings.push(`Fila ${rowNum}: "${nombre.toUpperCase()}" ya existe en el catálogo.`);
                } else {
                    validCount++;
                }
            });

            setValidationResult({ 
                count: validCount, 
                errors, 
                warnings,
                preview: json.data.slice(0, 5) 
            });

        } catch (err) {
            toast({ title: "Archivo Inválido", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  // --- 2. EJECUCIÓN DE LA IMPORTACIÓN ---
  const handleConfirm = () => {
      if (!jsonContent?.data) return;
      
      setLoading(true);
      
      // 🚀 SOLUCIÓN: Usar parishId si no hay dioceseId
      const targetContextId = user?.parishId || user?.dioceseId;
      
      if (!targetContextId) {
          toast({ title: "Error de Contexto", description: "No se encontró el ID de su Parroquia o Diócesis.", variant: "destructive" });
          setLoading(false);
          return;
      }

      const existingData = getCiudadesList(targetContextId);
      
      // Filtrar duplicados antes de enviar al motor de importación
      const filteredData = jsonContent.data.filter(item => {
          const nombre = (item.data || item.Data || item.nombre || '').trim().toLowerCase();
          return !existingData.some(ex => String(ex.nombre).toLowerCase() === nombre);
      });

      if (filteredData.length === 0) {
          toast({ title: "Sin novedades", description: "Todas las ciudades del archivo ya existen." });
          handleClose();
          return;
      }

      const result = importCiudades({ ...jsonContent, data: filteredData }, targetContextId, false);

      if (result.success) {
           toast({
               title: "¡Catálogo Actualizado!",
               description: `Se han integrado ${result.count} nuevas ciudades con éxito.`,
               className: "bg-green-50 border-green-200 text-green-900"
           });
           handleClose();
      } else {
           toast({ title: "Fallo en Importación", description: result.message, variant: 'destructive' });
           setLoading(false);
      }
  };

  const handleClose = () => {
      setValidationResult(null);
      setJsonContent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
  };

  const columns = [
      { header: 'CIUDAD / MUNICIPIO', render: (r) => <span className="font-bold uppercase text-gray-800">{r.data || r.nombre}</span> },
      { header: 'FUENTE', render: (r) => <span className="text-[10px] font-mono text-gray-400">{r.source || 'SISTEMA'}</span> },
      { header: 'PESO', render: (r) => <span className="text-xs font-bold text-[#4B7BA7]">{r.weight || '0'}</span> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Catálogo de Ciudades">
        <div className="space-y-8 min-w-[700px] max-w-2xl">
            
            {/* Header Informativo */}
            <div className="flex items-start gap-4 bg-blue-50/50 p-5 rounded-[1.5rem] border border-blue-100/50">
                <div className="bg-[#4B7BA7] p-2 rounded-xl text-white shadow-lg shadow-blue-900/10">
                    <MapPin className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Nivel: General</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed font-medium uppercase tracking-tight">
                        Actualice el catálogo maestro de ubicaciones. El sistema normalizará los nombres y evitará registros duplicados automáticamente.
                    </p>
                </div>
            </div>

            {/* Zona de Carga */}
            {!validationResult && !loading && (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group border-2 border-dashed border-gray-200 rounded-[2.5rem] p-16 text-center bg-gray-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><FileJson className="w-40 h-40" /></div>
                    <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4 group-hover:text-[#4B7BA7] transition-colors" />
                    <p className="text-lg font-black text-gray-700 uppercase tracking-tight">Subir Archivo de Ciudades</p>
                    <p className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">Formato Requerido: JSON {`{ "data": [...] }`}</p>
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                </div>
            )}

            {/* Estado de Carga */}
            {loading && (
                <div className="py-20 text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mx-auto" />
                    <p className="text-[#4B7BA7] font-black uppercase tracking-widest text-xs animate-pulse">Analizando integridad de datos...</p>
                </div>
            )}

            {/* Resultados de Validación */}
            {validationResult && !loading && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                    
                    {/* Estadísticas en Tarjetas */}
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard label="Nuevas" val={validationResult.count} color="green" />
                        <StatCard label="Errores" val={validationResult.errors.length} color="red" />
                        <StatCard label="Duplicados" val={validationResult.warnings.length} color="amber" />
                    </div>

                    {/* Tabla de Vista Previa */}
                    {validationResult.preview?.length > 0 && (
                        <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Database className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Muestra de datos purificados</span>
                            </div>
                            <Table columns={columns} data={validationResult.preview} />
                        </div>
                    )}

                    {/* Lista de Alertas (Scrollable) */}
                    {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {validationResult.errors.length > 0 && (
                                <AlertBox title="Errores Críticos" list={validationResult.errors} type="error" />
                            )}
                            {validationResult.warnings.length > 0 && (
                                <AlertBox title="Notas / Advertencias" list={validationResult.warnings} type="warning" />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <Button variant="ghost" onClick={handleClose} className="px-8 text-gray-400 font-black uppercase tracking-widest text-[10px]">
                    Cancelar
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    disabled={!validationResult || validationResult.count === 0 || validationResult.errors.length > 0}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-xl text-white px-10 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all transform active:scale-95 disabled:opacity-30"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Iniciar Importación
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

export default ImportCiudadesForm;