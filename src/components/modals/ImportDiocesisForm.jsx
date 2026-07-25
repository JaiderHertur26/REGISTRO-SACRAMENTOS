import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const ImportDiocesisForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importDiocesis, validateJSONStructure, getDiocesis } = useAppData();
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
            const existingData = getDiocesis(user?.parishId);
            const errors = [];
            const warnings = [];
            let validCount = 0;

            json.data.forEach((item, index) => {
                const idx = index + 1;
                const nombre = (item.Nombre || item.nombre || '').trim();
                const codigo = (item.Codigo || item.codigo || '').toString().trim();

                if (!nombre || !codigo) {
                    errors.push({ index: idx, message: `Fila ${idx}: Código y Nombre son requeridos.` });
                    return;
                }

                const isDuplicate = existingData.some(ex => ex.nombre.toLowerCase() === nombre.toLowerCase());
                
                if (isDuplicate) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Diócesis duplicada "${nombre}" (será ignorada).` });
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

      const existingData = getDiocesis(user?.parishId);
      const originalCount = jsonContent.data.length;
      
      const filteredData = jsonContent.data.filter(item => {
          const nombre = (item.Nombre || item.nombre || '').trim().toLowerCase();
          return !existingData.some(ex => ex.nombre.toLowerCase() === nombre);
      });

      const duplicatesCount = originalCount - filteredData.length;
      
      let result;
      if (filteredData.length > 0) {
          const filteredJson = { ...jsonContent, data: filteredData };
          result = importDiocesis(filteredJson, user?.parishId, false);
      } else {
          result = { success: true, count: 0 };
      }

      setLoading(false);

      if (result.success) {
           let msg = `${result.count} diócesis importadas.`;
           if (duplicatesCount > 0) {
               msg = `${result.count} diócesis importadas, ${duplicatesCount} duplicadas ignoradas.`;
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
      { header: 'Código', accessor: 'codigo' },
      { header: 'Nombre', accessor: 'nombre' },
      { header: 'Dirección', accessor: 'direccion' },
      { header: 'Teléfono', accessor: 'telefono' },
      { header: 'Email', accessor: 'email' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Diócesis">
        <div className="space-y-6 min-w-[700px]">
            <p className="text-gray-900 text-sm">
                Seleccione un archivo JSON con la lista de diócesis.
            </p>
            {!preview && !validationResult?.errors?.length && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" id="diocesis-upload" />
                    <label htmlFor="diocesis-upload" className="cursor-pointer flex flex-col items-center gap-2">
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
                             <div className="text-xs text-red-900 uppercase font-bold">Errores Bloqueantes</div>
                             <div className="text-2xl font-bold text-red-900">{validationResult.errors?.length || 0}</div>
                        </div>
                        <div className="flex-1 bg-yellow-50 p-3 rounded border border-yellow-200">
                             <div className="text-xs text-yellow-900 uppercase font-bold">Duplicados (Ignorados)</div>
                             <div className="text-2xl font-bold text-yellow-900">{validationResult.warnings?.length || 0}</div>
                        </div>
                    </div>

                    {preview && preview.length > 0 && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-900 border-b border-gray-200">
                                VISTA PREVIA (Primeros 5)
                            </div>
                            <Table columns={columns} data={preview} />
                        </div>
                    )}

                     {validationResult.errors && validationResult.errors.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200 max-h-40 overflow-y-auto">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-red-800 mb-2">
                                <XCircle className="w-4 h-4" /> Errores
                            </h4>
                            <ul className="list-disc list-inside text-xs text-red-800 space-y-1">
                                {validationResult.errors.map((err, idx) => (
                                    <li key={idx}>{err.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validationResult.warnings && validationResult.warnings.length > 0 && (
                         <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 max-h-40 overflow-y-auto">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-yellow-800 mb-2">
                                <AlertTriangle className="w-4 h-4" /> Advertencias
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

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={handleClose} className="text-gray-900 border-gray-300">
                    <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    disabled={!validationResult || validationResult.errors?.length > 0}
                    className="bg-[#D4AF37] hover:bg-[#C4A027] text-white disabled:bg-gray-300"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Importación
                </Button>
            </div>
        </div>
    </Modal>
  );
};

export default ImportDiocesisForm;