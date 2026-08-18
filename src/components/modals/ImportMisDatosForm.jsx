import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import ImportarMisDatosModal from './ImportarMisDatosModal';

// 🚀 RECIBIMOS existingItems DE LA BD REAL
const ImportMisDatosForm = ({ isOpen, onClose, existingItems = [] }) => {
  const { user } = useAuth();
  const { importMisDatos } = useAppData(); 
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  const [newRecords, setNewRecords] = useState([]);
  const [duplicates, setDuplicates] = useState([]);

  const normalizeItem = (item) => {
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
            
            if (!json.data && !Array.isArray(json)) {
                throw new Error("El formato JSON debe contener una propiedad 'data' que sea un array.");
            }
            
            const rawData = Array.isArray(json) ? json : json.data;
            
            const newRecs = [];
            const dups = [];

            // 🚀 DOBLE FILTRO DE MEMORIA PARA EL JSON
            const codigosEnArchivo = new Set();
            const nitsEnArchivo = new Set();
            const nombresEnArchivo = new Set();

            rawData.forEach((item, index) => {
                const normalized = normalizeItem(item);
                
                if (!normalized.idcod && !normalized.nombre) {
                    return; // Skip vacíos
                }

                const nombreLower = normalized.nombre.toLowerCase();
                const idcodLower = normalized.idcod.toLowerCase();
                const nitLower = normalized.nronit.toLowerCase();

                // 1. Validar contra Base de Datos
                const isDuplicateDB = existingItems.some(ex => {
                    const idcodMatch = ex.idcod && normalized.idcod && String(ex.idcod).toLowerCase() === idcodLower;
                    const nitMatch = ex.nronit && normalized.nronit && String(ex.nronit).toLowerCase() === nitLower;
                    const nameMatch = ex.nombre && String(ex.nombre).toLowerCase() === nombreLower;
                    
                    return idcodMatch || nitMatch || (normalized.idcod === '' && normalized.nronit === '' && nameMatch);
                });

                // 2. Validar contra duplicados en el mismo archivo JSON
                const isDuplicateFile = 
                    (idcodLower && codigosEnArchivo.has(idcodLower)) || 
                    (nitLower && nitsEnArchivo.has(nitLower)) || 
                    (nombreLower && nombresEnArchivo.has(nombreLower));
                
                if (isDuplicateDB || isDuplicateFile) {
                    dups.push(normalized);
                } else {
                    if (idcodLower) codigosEnArchivo.add(idcodLower);
                    if (nitLower) nitsEnArchivo.add(nitLower);
                    if (nombreLower) nombresEnArchivo.add(nombreLower);
                    
                    newRecs.push(normalized);
                }
            });

            setNewRecords(newRecs);
            setDuplicates(dups);
            
            setShowSummaryModal(true);

        } catch (err) {
            toast({ title: "Error de Validación", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
            e.target.value = ''; 
        }
    };
    reader.readAsText(selectedFile);
  };

  // 🚀 CORRECCIÓN: Se agregó async/await para garantizar la respuesta de Supabase
  const handleConfirmImport = async () => {
      setLoading(true);
      
      try {
          const contextId = user?.parishId || user?.dioceseId;
          
          if (!contextId) {
             throw new Error("ID de entidad no detectado.");
          }

          // 🚀 AWAIT CRÍTICO PARA ESPERAR A LA NUBE
          const result = await importMisDatos(newRecords, contextId);

          if (result.success) {
               toast({
                   title: "Importación Completada",
                   description: result.message,
                   className: "bg-green-50 border-green-200 text-green-900"
               });
               setShowSummaryModal(false);
               onClose();
          } else {
               throw new Error(result.message);
          }
      } catch (err) {
          console.error(err);
          toast({ title: "Error en la Nube", description: err.message, variant: "destructive" });
      } finally {
          setLoading(false);
      }
  };

  return (
    <>
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Mis Datos">
            <div className="space-y-6 min-w-[500px]">
                <p className="text-[#111111] text-sm">
                    Seleccione un archivo JSON para importar al catálogo de Mis Datos.
                </p>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50 hover:bg-gray-100 transition-colors group relative overflow-hidden">
                    <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleFileChange} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        disabled={loading}
                    />
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8 text-[#4B7BA7]" />
                        </div>
                        <div>
                            <span className="text-[#111111] font-bold block">Seleccionar archivo JSON</span>
                            <span className="text-xs text-gray-500 mt-1 block">Formato requerido: {`{ "data": [...] }`}</span>
                        </div>
                    </div>
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