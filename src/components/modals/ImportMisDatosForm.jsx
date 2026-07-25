import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import ImportarMisDatosModal from './ImportarMisDatosModal';

const ImportMisDatosForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importMisDatos, validateJSONStructure, getMisDatosList } = useAppData();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  const [newRecords, setNewRecords] = useState([]);
  const [duplicates, setDuplicates] = useState([]);

  const normalizeItem = (item) => {
    // Standardize keys to lowercase for consistency in storage
    return {
        idcod: (item.Idcod || item.idcod || item.codigo || item.Codigo || '').toString().trim(),
        nombre: (item.Nombre || item.nombre || '').trim(),
        nronit: (item.Nronit || item.nronit || item.nit || item.Nit || '').toString().trim(),
        region: (item.Region || item.region || '').trim(),
        direccion: (item.Direccion || item.direccion || '').trim(),
        ciudad: (item.Ciudad || item.ciudad || '').trim(),
        telefono: (item.Telefono || item.telefono || '').toString().trim(),
        nrofax: (item.Nrofax || item.nrofax || '').toString().trim(),
        email: (item.Email || item.email || '').trim(),
        vicaria: (item.Vicaria || item.vicaria || '').trim(),
        decanato: (item.Decanato || item.decanato || '').trim(),
        diocesis: (item.Diocesis || item.diocesis || '').trim(),
        obispo: (item.Obispo || item.obispo || '').trim(),
        canciller: (item.Canciller || item.canciller || '').trim(),
        serial: (item.Serial || item.serial || '').toString().trim(),
        ruta: (item.Ruta || item.ruta || '').trim()
    };
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setLoading(true);
    setNewRecords([]);
    setDuplicates([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            
            // Basic structure check
            if (!json.data && !Array.isArray(json)) {
                throw new Error("El formato JSON debe contener una propiedad 'data' que sea un array.");
            }
            
            const rawData = Array.isArray(json) ? json : json.data;
            const existingData = getMisDatosList(user?.parishId);
            
            const newRecs = [];
            const dups = [];

            rawData.forEach((item, index) => {
                const normalized = normalizeItem(item);
                
                if (!normalized.idcod && !normalized.nombre) {
                    // Skip empty records
                    return;
                }

                // Duplicate detection logic
                const isDuplicate = existingData.some(ex => {
                    const idcodMatch = ex.idcod && normalized.idcod && ex.idcod === normalized.idcod;
                    const nitMatch = ex.nronit && normalized.nronit && ex.nronit === normalized.nronit;
                    // If no unique IDs, fall back to name exact match
                    const nameMatch = ex.nombre.toLowerCase() === normalized.nombre.toLowerCase();
                    
                    return idcodMatch || nitMatch || (normalized.idcod === '' && normalized.nronit === '' && nameMatch);
                });
                
                if (isDuplicate) {
                    dups.push(normalized);
                } else {
                    newRecs.push(normalized);
                }
            });

            setNewRecords(newRecs);
            setDuplicates(dups);
            
            // Trigger the summary modal
            setShowSummaryModal(true);

        } catch (err) {
            toast({ title: "Error de Validación", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
        }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirmImport = () => {
      setLoading(true);
      const result = importMisDatos(newRecords, user?.parishId);
      setLoading(false);
      setShowSummaryModal(false);

      if (result.success) {
           toast({
               title: "Importación Completada",
               description: result.message,
               variant: "success"
           });
           onClose();
      } else {
           toast({ title: "Error", description: result.message, variant: "destructive" });
      }
  };

  return (
    <>
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Mis Datos">
            <div className="space-y-6 min-w-[500px]">
                <p className="text-[#111111] text-sm">
                    Seleccione un archivo JSON para importar al catálogo de Mis Datos.
                </p>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50 hover:bg-gray-100 transition-colors group">
                    <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleFileChange} 
                        className="hidden" 
                        id="misdatos-upload-main" 
                        disabled={loading}
                    />
                    <label htmlFor="misdatos-upload-main" className="cursor-pointer flex flex-col items-center gap-3">
                        <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8 text-[#4B7BA7]" />
                        </div>
                        <div>
                            <span className="text-[#111111] font-bold block">Seleccionar archivo JSON</span>
                            <span className="text-xs text-gray-500 mt-1 block">Formato requerido: {`{ "data": [...] }`}</span>
                        </div>
                    </label>
                </div>

                {loading && (
                    <div className="flex items-center justify-center gap-2 text-[#111111] font-medium py-2">
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full text-[#D4AF37]"></div>
                        Procesando archivo...
                    </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-800">
                        El sistema detectará automáticamente registros duplicados basándose en el <strong>Código (idcod)</strong> o <strong>NIT</strong>. Los duplicados se mostrarán en un resumen antes de guardar.
                    </p>
                </div>
            </div>
        </Modal>

        {/* Summary Modal */}
        <ImportarMisDatosModal 
            isOpen={showSummaryModal} 
            onClose={() => setShowSummaryModal(false)}
            onConfirm={handleConfirmImport}
            newRecords={newRecords}
            duplicates={duplicates}
        />
    </>
  );
};

export default ImportMisDatosForm;