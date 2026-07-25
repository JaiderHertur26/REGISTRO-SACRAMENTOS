import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const ImportObisposForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importObispos, validateJSONStructure, getObispos } = useAppData();
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

            setJsonContent(json);

            // Manual Validation
            const existingData = getObispos(user?.parishId);
            const errors = [];
            const warnings = [];
            let validCount = 0;

            json.data.forEach((item, index) => {
                const idx = index + 1;
                const nombre = (item.Nombre || item.nombre || '').trim();
                const apellido = (item.Apellido || item.apellido || '').trim();
                
                if (!nombre || !apellido) {
                    errors.push({ index: idx, message: `Fila ${idx}: Nombre y Apellido son requeridos.` });
                    return;
                }

                const isDuplicate = existingData.some(ex => ex.nombre.toLowerCase() === nombre.toLowerCase());
                
                if (isDuplicate) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Obispo duplicado "${nombre}" (será ignorada).` });
                } else {
                    validCount++;
                }
            });

            setValidationResult({ count: validCount, errors, warnings });
            setPreview(json.data.slice(0, 5));
        } catch (err) {
            toast({ title: "Error de Validación", description: err.message, variant: "destructive" });
            setValidationResult({ count: 0, errors: [{ message: err.message }], warnings: [] });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = () => {
      if (!jsonContent || !jsonContent.data) return;
      
      setLoading(true);

      const existingData = getObispos(user?.parishId);
      const originalCount = jsonContent.data.length;
      
      const filteredData = jsonContent.data.filter(item => {
          const nombre = (item.Nombre || item.nombre || '').trim().toLowerCase();
          return !existingData.some(ex => ex.nombre.toLowerCase() === nombre);
      });

      const duplicatesCount = originalCount - filteredData.length;
      
      let result;
      if (filteredData.length > 0) {
          const filteredJson = { ...jsonContent, data: filteredData };
          result = importObispos(filteredJson, user?.parishId, false);
      } else {
          result = { success: true, count: 0 };
      }

      setLoading(false);

      if (result.success) {
           let msg = `${result.count} obispos importados.`;
           if (duplicatesCount > 0) {
               msg = `${result.count} obispos importados, ${duplicatesCount} duplicadas ignoradas.`;
           }

           toast({
               title: "Importación Completada",
               description: msg,
               className: "bg-green-50 border-green-200 text-green-900"
           });
           handleClose();
      } else {
           toast({ title: "Error", description: result.message, variant: "destructive" });
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
      { header: 'Nombre', accessor: 'nombre' },
      { header: 'Apellido', accessor: 'apellido' },
      { header: 'Diócesis', accessor: 'diocesis' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Obispos">
        <div className="space-y-6 min-w-[600px]">
            <p className="text-gray-900 text-sm">
                Seleccione un archivo JSON con la lista de obispos.
            </p>
            {!preview && !validationResult?.errors?.length && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" id="obispos-upload" />
                    <label htmlFor="obispos-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-[#4B7BA7]" />
                        <span className="text-gray-900 font-bold">Seleccionar archivo JSON</span>
                        <span className="text-xs text-gray-700">Formato: {`{ "data": [...] }`}</span>
                    </label>
                </div>
            )}

            {loading && <div className="text-center text-gray-900 font-medium py-4">Procesando archivo...</div>}

            {validationResult && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1 bg-green-50 p-3 rounded border border-green-200">
                             <div className="text-xs text-green-900 uppercase font-bold">Nuevos Registros</div>
                             <div className="text-2xl font-bold text-green-900">{validationResult.count}</div>
                        </div>
                        <div className="flex-1 bg-red-50 p-3 rounded border border-red-200">
                             <div className="text-xs text-red-900 uppercase font-bold">Errores</div>
                             <div className="text-2xl font-bold text-red-900">{validationResult.errors.length}</div>
                        </div>
                        <div className="flex-1 bg-yellow-50 p-3 rounded border border-yellow-200">
                             <div className="text-xs text-yellow-900 uppercase font-bold">Advertencias</div>
                             <div className="text-2xl font-bold text-yellow-900">{validationResult.warnings.length}</div>
                        </div>
                    </div>

                    {validationResult.errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="font-bold text-red-900">Errores encontrados:</span>
                            </div>
                            <ul className="space-y-1">
                                {validationResult.errors.map((err, idx) => (
                                    <li key={idx} className="text-sm text-red-800">{err.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validationResult.warnings.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                <span className="font-bold text-yellow-900">Advertencias:</span>
                            </div>
                            <ul className="space-y-1">
                                {validationResult.warnings.map((warn, idx) => (
                                    <li key={idx} className="text-sm text-yellow-800">{warn.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {preview && preview.length > 0 && (
                        <div>
                            <h4 className="font-bold text-gray-900 mb-2">Vista previa (primeros 5 registros):</h4>
                            <div className="overflow-x-auto">
                                <Table columns={columns} data={preview} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-3 justify-end">
                <Button onClick={handleClose} variant="outline">Cancelar</Button>
                {validationResult && validationResult.count > 0 && (
                    <Button onClick={handleConfirm} disabled={loading} className="bg-[#4B7BA7] hover:bg-[#3a5a7f]">
                        {loading ? 'Importando...' : `Importar ${validationResult.count} registros`}
                    </Button>
                )}
            </div>
        </div>
    </Modal>
  );
};

export default ImportObisposForm;