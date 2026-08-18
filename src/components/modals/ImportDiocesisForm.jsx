import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, XCircle, X, Loader2 } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

// 🚀 RECIBIMOS LA LISTA REAL DE LA BD
const ImportDiocesisForm = ({ isOpen, onClose, existingItems = [] }) => {
  const { user } = useAuth();
  const { importDiocesis, validateJSONStructure } = useAppData();
  const { toast } = useToast();
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [jsonContent, setJsonContent] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
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
            const codigosEnArchivo = new Set();
            const nombresEnArchivo = new Set();

            json.data.forEach((item, index) => {
                const idx = index + 1;
                const nombreRaw = item.Nombre || item.nombre || '';
                const codigoRaw = item.Codigo || item.codigo || '';

                const nombre = String(nombreRaw).trim();
                const codigo = String(codigoRaw).trim();
                
                if (!nombre || !codigo) {
                    errors.push({ index: idx, message: `Fila ${idx}: Código y Nombre son requeridos.` });
                    return;
                }

                const nombreLower = nombre.toLowerCase();
                const codigoLower = codigo.toLowerCase();

                // 1. Validar contra la Base de Datos
                const isDuplicateDB = existingItems.some(ex => {
                    const matchCodigo = (ex.codigo && String(ex.codigo).toLowerCase() === codigoLower);
                    const matchNombre = (ex.nombre && String(ex.nombre).toLowerCase() === nombreLower);
                    return matchCodigo || matchNombre;
                });

                // 2. Validar duplicados en el mismo archivo
                const isDuplicateFile = codigosEnArchivo.has(codigoLower) || nombresEnArchivo.has(nombreLower);

                if (isDuplicateDB) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Diócesis "${nombre}" ya existe en la base de datos.` });
                } else if (isDuplicateFile) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Diócesis "${nombre}" está repetida en el archivo.` });
                } else {
                    codigosEnArchivo.add(codigoLower);
                    nombresEnArchivo.add(nombreLower);
                    validCount++;
                    validData.push(item);
                }
            });

            // Guardamos solo lo que pasó las validaciones
            setJsonContent({ data: validData });
            setValidationResult({ count: validCount, errors, warnings });
            setPreview(validData.slice(0, 5));
        } catch (err) {
            toast({ title: "Error de Validación", description: err.message, variant: "destructive" });
            setValidationResult({ count: 0, errors: [{ message: err.message }], warnings: [] });
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };
    reader.readAsText(selectedFile);
  };

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
              // Limpiar claves para que coincidan con la DB
              const cleanData = jsonContent.data.map(item => ({
                  codigo: item.Codigo || item.codigo || null,
                  nombre: item.Nombre || item.nombre || null,
                  region: item.Region || item.region || null,
                  descripcion: item.Descripcion || item.descripcion || null
              }));

              result = await importDiocesis({ data: cleanData }, contextId, false);
          } else {
              result = { success: true, count: 0, message: "No hay registros nuevos para inyectar." };
          }

          if (result.success) {
               toast({
                   title: "Importación Completada",
                   description: `${result.count} diócesis inyectadas a la Nube.`,
                   className: "bg-green-50 border-green-200 text-green-900"
               });
               handleClose();
          } else {
               throw new Error(result.message);
          }
      } catch (err) {
          console.error(err);
          toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
          setLoading(false);
      }
  };

  const handleClose = () => {
      setFile(null);
      setPreview(null);
      setValidationResult(null);
      setJsonContent(null);
      onClose();
  };

  const columns = [
      { header: 'Código', accessor: 'codigo' },
      { header: 'Nombre', accessor: 'nombre' },
      { header: 'Región', accessor: 'region' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Diócesis">
        <div className="space-y-6 min-w-[700px]">
            <p className="text-gray-900 text-sm">
                Seleccione un archivo JSON con la lista de diócesis. El sistema eliminará automáticamente los registros duplicados.
            </p>
            
            {!preview && !validationResult?.errors?.length && !loading && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" id="diocesis-upload" />
                    <label htmlFor="diocesis-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-[#4B7BA7]" />
                        <span className="text-gray-900 font-bold">Seleccionar archivo JSON</span>
                        <span className="text-xs text-gray-700">Formato: {`{ "data": [...] }`}</span>
                    </label>
                </div>
            )}

            {loading && (
                <div className="py-12 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                    <p className="text-gray-900 font-medium">Procesando y validando archivo...</p>
                </div>
            )}

            {validationResult && !loading && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1 bg-green-50 p-3 rounded border border-green-200">
                             <div className="text-xs text-green-900 uppercase font-bold">Nuevos Registros</div>
                             <div className="text-2xl font-bold text-green-900">{validationResult.count}</div>
                        </div>
                        <div className="flex-1 bg-red-50 p-3 rounded border border-red-200">
                             <div className="text-xs text-red-900 uppercase font-bold">Errores Críticos</div>
                             <div className="text-2xl font-bold text-red-900">{validationResult.errors?.length || 0}</div>
                        </div>
                        <div className="flex-1 bg-yellow-50 p-3 rounded border border-yellow-200">
                             <div className="text-xs text-yellow-900 uppercase font-bold">Duplicados Omitidos</div>
                             <div className="text-2xl font-bold text-yellow-900">{validationResult.warnings?.length || 0}</div>
                        </div>
                    </div>

                    {preview && preview.length > 0 && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-900 border-b border-gray-200">
                                VISTA PREVIA (Primeros 5 Registros Válidos)
                            </div>
                            <Table columns={columns} data={preview} />
                        </div>
                    )}

                     {validationResult.errors && validationResult.errors.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200 max-h-40 overflow-y-auto">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-red-800 mb-2">
                                <XCircle className="w-4 h-4" /> Errores que impiden la carga
                            </h4>
                            <ul className="list-disc list-inside text-xs text-red-800 space-y-1">
                                {validationResult.errors.map((err, idx) => (
                                    <li key={idx}>{err.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validationResult.warnings && validationResult.warnings.length > 0 && (
                         <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 max-h-40 overflow-y-auto custom-scrollbar">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-yellow-800 mb-2">
                                <AlertTriangle className="w-4 h-4" /> Registros ignorados
                            </h4>
                            <ul className="list-disc list-inside text-xs text-yellow-800 space-y-1">
                                {validationResult.warnings.map((warn, idx) => (
                                    <li key={idx}>{warn.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                <Button variant="outline" onClick={handleClose} className="text-gray-900 border-gray-300">
                    <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    disabled={!validationResult || validationResult.errors?.length > 0}
                    className="bg-[#D4AF37] hover:bg-[#C4A027] text-white disabled:bg-gray-300"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Inyectar a la Nube
                </Button>
            </div>
        </div>
    </Modal>
  );
};

export default ImportDiocesisForm;