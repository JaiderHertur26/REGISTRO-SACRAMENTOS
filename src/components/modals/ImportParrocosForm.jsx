import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { 
    Upload, CheckCircle2, AlertTriangle, XCircle, 
    Loader2, UserCheck, FileJson, Database 
} from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';
import { cn } from '@/lib/utils';

const ImportParrocosForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { validateJSONStructure, getParrocos, importParrocos } = useAppData(); // 🚀 Importamos la función del servicio
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [normalizedContent, setNormalizedContent] = useState(null);

  // =========================================================================
  // 🧠 LÓGICA DE PROCESAMIENTO (INTELIGENCIA ARTIFICIAL DE NOMBRES)
  // =========================================================================
  
  const splitFullName = (fullName) => {
      if (!fullName) return { nombre: '', apellido: '' };
      const parts = fullName.trim().split(' ').filter(p => p);
      if (parts.length === 1) return { nombre: parts[0].toUpperCase(), apellido: '' };

      const titulos = ['PBRO.', 'PBRO', 'PADRE', 'FRAY', 'MONS.', 'MONS', 'OBISPO', 'CANÓNIGO'];
      const firstWord = parts[0].toUpperCase();

      let nombreParts = [];
      let apellidoParts = [];

      if (titulos.includes(firstWord) && parts.length > 1) {
          nombreParts = [parts[0], parts[1]];
          apellidoParts = parts.slice(2);
      } else if (parts.length === 2) {
          nombreParts = [parts[0]];
          apellidoParts = [parts[1]];
      } else if (parts.length === 3) {
          nombreParts = [parts[0]];
          apellidoParts = [parts[1], parts[2]];
      } else {
          nombreParts = [parts[0], parts[1]];
          apellidoParts = parts.slice(2);
      }

      return {
          nombre: nombreParts.join(' ').toUpperCase(),
          apellido: apellidoParts.join(' ').toUpperCase()
      };
  };

  const normalizeItem = (item) => {
      const rawName = (item.Nombre || item.nombre || '').trim();
      const { nombre: calcNombre, apellido: calcApellido } = splitFullName(rawName);

      return {
          codigo: (item.Codigo || item.codigo || '').toString().trim(),
          nombre: (item.Nombres || item.nombres || calcNombre).toUpperCase(),
          apellido: (item.Apellidos || item.apellidos || item.apellido || calcApellido).toUpperCase(),
          fechaIngreso: item.fechaIngreso || item.FechaIngreso || item.fecing || item.fechaNombramiento || '',
          fechaSalida: item.fechaSalida || item.FechaSalida || item.fecsal || '',
          estado: item.Estado !== undefined ? item.Estado : (item.estado !== undefined ? item.estado : 1),
          email: (item.Email || item.email || '').toLowerCase(),
          telefono: item.Telefono || item.telefono || ''
      };
  };

  // --- 1. VALIDACIÓN Y ANÁLISIS ---
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setLoading(true);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            const structureCheck = validateJSONStructure(json);
            if (!structureCheck.isValid) throw new Error(structureCheck.message);

            const existingData = getParrocos(user?.parishId) || [];
            const errors = [];
            const warnings = [];
            let validCount = 0;
            const normalizedData = [];

            json.data.forEach((item, index) => {
                const rowNum = index + 1;
                const normItem = normalizeItem(item);
                
                if (!normItem.nombre) {
                    errors.push(`Fila ${rowNum}: El Nombre es campo obligatorio.`);
                    return;
                }

                const isDuplicate = existingData.some(ex => {
                    const codeMatch = ex.codigo && normItem.codigo && String(ex.codigo) === String(normItem.codigo);
                    const nameMatch = (ex.nombre || '').toLowerCase() === normItem.nombre.toLowerCase() && 
                                     (ex.apellido || '').toLowerCase() === normItem.apellido.toLowerCase();
                    return codeMatch || nameMatch;
                });
                
                if (isDuplicate) {
                    warnings.push(`Fila ${rowNum}: Registro duplicado detectado (${normItem.nombre}).`);
                } else {
                    validCount++;
                    normalizedData.push(normItem);
                }
            });

            setNormalizedContent(normalizedData);
            setValidationResult({ count: validCount, errors, warnings });
            setPreview(normalizedData.slice(0, 5));

        } catch (err) {
            toast({ title: "Error en Estructura", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  // --- 2. IMPORTACIÓN DELEGADA AL SERVICIO ---
  const handleConfirm = async () => {
      if (!normalizedContent?.length) return;
      
      setLoading(true);
      try {
          const parishId = user?.parishId;
          if (!parishId) throw new Error("No se pudo identificar la parroquia actual.");

          // 🚀 DELEGAMOS LA INSERCIÓN A SUPABASE AL SERVICIO CENTRAL
          const result = await importParrocos({ data: normalizedContent }, parishId, false);

          if (!result.success) throw new Error(result.message || "Fallo en la importación central.");

          window.dispatchEvent(new Event('storage'));

          toast({
              title: "¡Historial Actualizado!",
              description: `${result.count} párrocos inyectados correctamente en la Nube.`,
              className: "bg-green-50 border-green-200 text-green-900"
          });
          handleClose();
      } catch (error) {
          console.error("Error en importación:", error);
          toast({ title: "Error de Inyección", description: error.message, variant: "destructive" });
      } finally {
          setLoading(false);
      }
  };

  const handleClose = () => {
      setPreview(null);
      setValidationResult(null);
      setNormalizedContent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
  };

  const columns = [
      { header: 'NOMBRES Y APELLIDOS', render: (r) => <span className="font-bold uppercase text-gray-800">{r.nombre} {r.apellido}</span> },
      { header: 'PERIODO', render: (r) => <span className="text-[10px] font-mono text-gray-400">{r.fechaIngreso || '---'} • {r.fechaSalida || 'PRESENTE'}</span> },
      { header: 'ESTADO', render: (r) => (
          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase border", 
            String(r.estado) === '1' ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-500 border-gray-100")}>
            {String(r.estado) === '1' ? 'ACTIVO' : 'INACTIVO'}
          </span>
      )},
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Historial de Párrocos">
        <div className="space-y-8 min-w-[750px] max-w-2xl">
            
            {/* Header Informativo */}
            <div className="flex items-start gap-4 bg-blue-50/50 p-5 rounded-[1.5rem] border border-blue-100/50">
                <div className="bg-[#4B7BA7] p-2 rounded-xl text-white shadow-lg shadow-blue-900/20">
                    <UserCheck className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Carga Masiva</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed font-medium uppercase tracking-tight">
                        El sistema separará automáticamente títulos, nombres y apellidos. Se recomienda un archivo JSON limpio para evitar inconsistencias en las partidas.
                    </p>
                </div>
            </div>

            {/* Zona de Carga */}
            {!preview && !loading && (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group border-2 border-dashed border-gray-200 rounded-[2.5rem] p-16 text-center bg-gray-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><FileJson className="w-40 h-40" /></div>
                    <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4 group-hover:text-[#4B7BA7] transition-colors" />
                    <p className="text-lg font-black text-gray-700 uppercase tracking-tight">Seleccionar Lista de Párrocos</p>
                    <p className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">JSON compatible con estructura SACRAMENTUM</p>
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                </div>
            )}

            {/* Estado de Carga */}
            {loading && (
                <div className="py-20 text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mx-auto" />
                    <p className="text-[#4B7BA7] font-black uppercase tracking-widest text-xs animate-pulse">
                        {preview ? 'Sincronizando con la Nube...' : 'Analizando e identificando párrocos...'}
                    </p>
                </div>
            )}

            {/* Resultados de Validación */}
            {validationResult && !loading && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                    
                    {/* Estadísticas */}
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard label="Listos" val={validationResult.count} color="green" />
                        <StatCard label="Con Error" val={validationResult.errors.length} color="red" />
                        <StatCard label="Duplicados" val={validationResult.warnings.length} color="amber" />
                    </div>

                    {/* Tabla de Vista Previa */}
                    {preview?.length > 0 && (
                        <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Database className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Previsualización de normalización</span>
                            </div>
                            <Table columns={columns} data={preview} />
                        </div>
                    )}

                    {/* Alertas */}
                    {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {validationResult.errors.length > 0 && (
                                <AlertBox title="Errores Críticos" list={validationResult.errors} type="error" />
                            )}
                            {validationResult.warnings.length > 0 && (
                                <AlertBox title="Omitidos" list={validationResult.warnings} type="warning" />
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
                    disabled={!validationResult || validationResult.count === 0 || validationResult.errors.length > 0 || loading}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-xl text-white px-10 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all transform active:scale-95 disabled:opacity-30"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar e Inyectar
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

export default ImportParrocosForm;