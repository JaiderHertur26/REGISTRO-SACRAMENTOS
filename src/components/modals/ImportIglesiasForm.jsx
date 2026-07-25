import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const ImportIglesiasForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importIglesias, validateJSONStructure, getIglesiasList } = useAppData();
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
            const existingData = getIglesiasList(user?.parishId);
            const errors = [];
            const warnings = [];
            let validCount = 0;

            json.data.forEach((item, index) => {
                const idx = index + 1;
                const nombre = (item.Nombre || item.nombre || '').trim();
                const codigo = (item.Codigo || item.codigo || '').toString().trim();

                // Removed blocking validation for required fields as requested
                // We now allow incomplete records, only checking for duplicates

                const isDuplicate = existingData.some(ex => 
                    (codigo && ex.codigo === codigo) || 
                    (nombre && ex.nombre.toLowerCase() === nombre.toLowerCase())
                );
                
                if (isDuplicate) {
                    warnings.push({ index: idx, message: `Fila ${idx}: Iglesia duplicada (Código: ${codigo} / Nombre: ${nombre}).` });
                } else {
                    validCount++;
                }
            });

            setValidationResult({ count: validCount, errors, warnings });
            setPreview(json.data.slice(0, 5));
        } catch (err) {
            toast({ title: "Error de Estructura", description: err.message, variant: "destructive" });
            setValidationResult({ count: 0, errors: [{ message: err.message }], warnings: [] });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = () => {
      if (!jsonContent || !jsonContent.data || !validationResult) return;
      
      setLoading(true);

      const existingData = getIglesiasList(user?.parishId);
      const originalCount = jsonContent.data.length;
      
      // Filter out duplicates (based on codigo or nombre)
      const filteredData = jsonContent.data.filter(item => {
          const nombre = (item.Nombre || item.nombre || '').trim().toLowerCase();
          const codigo = (item.Codigo || item.codigo || '').toString().trim();
          
          const exists = existingData.some(ex => 
              (codigo && ex.codigo === codigo) || 
              (nombre && ex.nombre.toLowerCase() === nombre)
          );
          return !exists;
      });

      const duplicatesCount = originalCount - filteredData.length;
      
      let result;
      if (filteredData.length > 0) {
          // Pass only filtered (new) records
          result = importIglesias({ data: filteredData }, user?.parishId, false);
      } else {
          result = { success: true, count: 0, message: "No hay registros nuevos para importar." };
      }

      setLoading(false);

      if (result.success) {
           let msg = `${result.count} iglesias importadas.`;
           if (duplicatesCount > 0) {
               msg = `${result.count} iglesias importadas, ${duplicatesCount} duplicadas ignoradas.`;
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
      { header: 'Código', accessor: (row) => row.Codigo || row.codigo },
      { header: 'Nombre', accessor: (row) => row.Nombre || row.nombre },
      { header: 'Ciudad', accessor: (row) => row.Ciudad || row.ciudad || '-' },
      { header: 'Teléfono', accessor: (row) => row.Telefono || row.telefono || '-' },
  ];

  const hasErrors = validationResult?.errors?.length > 0;
  const hasWarnings = validationResult?.warnings?.length > 0;
  const canConfirm = validationResult && !hasErrors;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Iglesias">
        <div className="space-y-6 min-w-[700px]">
            <p className="text-gray-900 text-sm">
                Seleccione un archivo JSON con la lista de iglesias para validar e importar.
                Las filas con errores <strong>no se importarán</strong>. Los duplicados se ignorarán automáticamente.
            </p>
            {!preview && !hasErrors && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" id="iglesias-upload" />
                    <label htmlFor="iglesias-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-[#4B7BA7]" />
                        <span className="text-gray-900 font-bold">Seleccionar archivo JSON</span>
                        <span className="text-xs text-gray-700">Formato: {`{ "data": [{ "codigo": "...", "nombre": "..." }] }`}</span>
                    </label>
                </div>
            )}

            {loading && <div className="text-center text-gray-900 font-medium py-4">Procesando archivo...</div>}

            {validationResult && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1 bg-green-50 p-3 rounded border border-green-200">
                             <div className="text-xs text-green-900 uppercase font-bold">Nuevos Registros (Válidos)</div>
                             <div className="text-2xl font-bold text-green-900">{validationResult.count || 0}</div>
                        </div>
                        <div className="flex-1 bg-red-50 p-3 rounded border border-red-200">
                             <div className="text-xs text-red-900 uppercase font-bold">Errores (Bloqueantes)</div>
                             <div className="text-2xl font-bold text-red-900">{validationResult.errors?.length || 0}</div>
                        </div>
                        <div className="flex-1 bg-yellow-50 p-3 rounded border border-yellow-200">
                             <div className="text-xs text-yellow-900 uppercase font-bold">Duplicados (Se ignorarán)</div>
                             <div className="text-2xl font-bold text-yellow-900">{validationResult.warnings?.length || 0}</div>
                        </div>
                    </div>

                    {preview && preview.length > 0 && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-900 border-b border-gray-200">
                                VISTA PREVIA (Primeros 5 del archivo)
                            </div>
                            <Table columns={columns} data={preview} />
                        </div>
                    )}

                    {hasErrors && (
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200 max-h-40 overflow-y-auto">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-red-800 mb-2">
                                <XCircle className="w-4 h-4" /> Errores Bloqueantes
                            </h4>
                            <ul className="list-disc list-inside text-xs text-red-800 space-y-1">
                                {validationResult.errors.map((err, idx) => (
                                    <li key={idx}>{err.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {hasWarnings && (
                         <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 max-h-40 overflow-y-auto">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-yellow-800 mb-2">
                                <AlertTriangle className="w-4 h-4" /> Advertencias (Duplicados)
                            </h4>
                            <p className="text-xs text-yellow-800 mb-2 italic">Estos registros ya existen en el sistema y no serán importados.</p>
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
                    disabled={!canConfirm}
                    className="bg-[#D4AF37] hover:bg-[#C4A027] text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> 
                    {hasWarnings ? 'Confirmar (Ignorar Duplicados)' : 'Confirmar Importación'}
                </Button>
            </div>
        </div>
    </Modal>
  );
};

export default ImportIglesiasForm;