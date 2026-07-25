import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileJson, AlertCircle, CheckCircle, Save, Ban } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAppData } from '@/context/AppDataContext';
import { 
    validateConfirmationStructure, 
    validateConfirmationData, 
    mapConfirmationJSON,
    handleConfirmationImportError,
    separateNewAndDuplicateConfirmations
} from '@/utils/confirmationJsonMapper';
import Table from '@/components/ui/Table';

const ConfirmationJsonImporter = () => {
    const { addConfirmationsFromJSON, getConfirmations } = useAppData();
    const { toast } = useToast();
    
    const [file, setFile] = useState(null);
    const [records, setRecords] = useState([]); // Stores new/valid mapped records
    const [validationStats, setValidationStats] = useState(null);
    const [duplicateStats, setDuplicateStats] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);

    // Helper to identify parish
    const getParishId = () => {
        const authUser = JSON.parse(localStorage.getItem('user'));
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (authUser && authUser.parishId) return authUser.parishId;
        if (currentUser && currentUser.parishId) return currentUser.parishId;
        const parishes = JSON.parse(localStorage.getItem('parishes') || '[]');
        return parishes.length > 0 ? parishes[0].id : null;
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        // Filename Validation
        const fileName = selectedFile.name.toUpperCase();
        if (fileName !== 'CONFIRMA' && fileName !== 'CONFIRMA.JSON') {
            toast({
                title: "Nombre de archivo incorrecto",
                description: "El archivo debe llamarse 'CONFIRMA' o 'CONFIRMA.json'",
                variant: "destructive"
            });
            event.target.value = ''; // Reset input to allow re-selection
            setFile(null);
            return;
        }

        setFile(selectedFile);
        setRecords([]);
        setValidationStats(null);
        setDuplicateStats(null);
        setImportComplete(false);
        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                console.log("JSON Parse Success, structure:", Object.keys(json));
                
                // 1. Validate Structure
                const structureCheck = validateConfirmationStructure(json);
                if (!structureCheck.isValid) {
                    throw new Error(structureCheck.message);
                }

                // 2. Validate Data & Map valid records
                const validRawRecords = [];
                const invalidRecords = [];

                json.data.forEach((item, index) => {
                    const validation = validateConfirmationData(item);
                    if (validation.isValid) {
                        validRawRecords.push(item);
                    } else {
                        invalidRecords.push({ ...item, _errors: validation.errors, _index: index + 1 });
                    }
                });

                console.log(`Validation results: ${validRawRecords.length} valid, ${invalidRecords.length} invalid`);

                // 3. Map to internal structure
                const mappedRecords = validRawRecords.map(mapConfirmationJSON);
                console.log("Mapped Records Sample:", mappedRecords.slice(0, 1));

                // 4. Duplicate Detection
                const parishId = getParishId();
                if (!parishId) {
                    console.error("Parish ID could not be identified during import prep.");
                    throw new Error("No se pudo identificar la parroquia para verificar duplicados.");
                }

                console.log("Fetching existing confirmations for parish:", parishId);
                const existingRecords = getConfirmations(parishId);
                console.log(`Found ${existingRecords.length} existing records.`);

                const { newRecords, duplicateCount, duplicateDetails } = separateNewAndDuplicateConfirmations(mappedRecords, existingRecords);
                console.log(`Duplication check: ${newRecords.length} new, ${duplicateCount} duplicates.`);

                // Update State
                setRecords(newRecords); // Keep only new records for saving/preview
                setValidationStats({
                    total: json.data.length,
                    valid: validRawRecords.length,
                    invalid: invalidRecords.length,
                    errors: invalidRecords.slice(0, 5)
                });
                setDuplicateStats({
                    count: duplicateCount,
                    details: duplicateDetails
                });

            } catch (error) {
                console.error("File processing error:", error);
                toast({
                    title: "Error de lectura",
                    description: handleConfirmationImportError(error),
                    variant: "destructive"
                });
                setFile(null);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
        if (!records.length) {
            toast({ title: "Atención", description: "No hay registros nuevos para importar.", variant: "warning" });
            return;
        }

        setIsProcessing(true);
        console.log(`Starting import of ${records.length} records...`);

        try {
            // Send only new records to the context
            const result = await addConfirmationsFromJSON(records);
            console.log("Context add result:", result);
            
            if (result.success) {
                let desc = result.message;
                // Add note about duplicates if context didn't already include it, but context does.
                
                toast({
                    title: "Importación Exitosa",
                    description: desc,
                    className: "bg-green-50 border-green-200"
                });
                setImportComplete(true);
                setFile(null); // Reset input
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
             console.error("Import save error:", error);
             toast({
                title: "Error de Importación",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const previewColumns = [
        { header: 'L/F/N', render: r => `${r.book_number}/${r.page_number}/${r.entry_number}` },
        { header: 'Apellidos', accessor: 'lastName' },
        { header: 'Nombres', accessor: 'firstName' },
        { header: 'Fecha Conf.', accessor: 'sacramentDate' }
    ];

    return (
        <div className="bg-white border rounded-lg p-6 space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* File Input Area */}
                <div className="w-full md:w-1/3">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-3 text-gray-400" />
                            <p className="mb-2 text-sm text-gray-500 font-semibold">Click para subir JSON</p>
                            <p className="text-xs text-gray-500">Formato: {`{ "data": [...] }`}</p>
                        </div>
                        <input type="file" className="hidden" accept=".json" onChange={handleFileChange} />
                    </label>
                    
                    {file && (
                        <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                            <FileJson className="w-4 h-4 text-blue-500" />
                            <span className="truncate">{file.name}</span>
                        </div>
                    )}
                </div>

                {/* Status & Action Area */}
                <div className="w-full md:w-2/3 space-y-4">
                    <h3 className="font-bold text-lg text-gray-800 border-b pb-2">Estado de Importación</h3>
                    
                    {!validationStats ? (
                        <p className="text-gray-500 italic text-sm">Seleccione un archivo para validar y previsualizar los datos.</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                    <span className="block text-xl font-bold text-blue-700">{validationStats.total}</span>
                                    <span className="text-xs text-blue-600 uppercase">Total Leídos</span>
                                </div>
                                <div className="bg-green-50 p-2 rounded border border-green-100">
                                    <span className="block text-xl font-bold text-green-700">{records.length}</span>
                                    <span className="text-xs text-green-600 uppercase">Nuevos (Válidos)</span>
                                </div>
                                <div className="bg-red-50 p-2 rounded border border-red-100">
                                    <span className="block text-xl font-bold text-red-700">{validationStats.invalid}</span>
                                    <span className="text-xs text-red-600 uppercase">Datos Inválidos</span>
                                </div>
                            </div>

                            {/* Duplicate Warning */}
                            {duplicateStats && duplicateStats.count > 0 && (
                                <div className="bg-orange-50 p-3 rounded text-xs text-orange-800 border border-orange-200">
                                    <p className="font-bold flex items-center gap-1">
                                        <Ban className="w-3 h-3" /> 
                                        ⊘ Registros duplicados ignorados: {duplicateStats.count}
                                    </p>
                                    <p className="mt-1">Estos registros ya existen en la base de datos (coincidencia de Libro/Folio/Número) y serán omitidos.</p>
                                </div>
                            )}

                            {/* Validation Errors */}
                            {validationStats.invalid > 0 && (
                                <div className="bg-red-50 p-3 rounded text-xs text-red-800 border border-red-100">
                                    <p className="font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Errores detectados (Primeros 5):</p>
                                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                                        {validationStats.errors.map((err, idx) => (
                                            <li key={idx}>Fila {err._index}: {err._errors.join(', ')}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Import Button: Shows count of NEW records only */}
                            <div className="flex gap-3">
                                <Button 
                                    onClick={handleImport} 
                                    disabled={records.length === 0 || isProcessing || importComplete}
                                    className="bg-[#4B7BA7] hover:bg-[#365d80] text-white w-full"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {isProcessing ? 'Procesando...' : `Importar ${records.length} Registros`}
                                </Button>
                            </div>
                        </div>
                    )}
                    
                    {importComplete && (
                        <div className="bg-green-50 text-green-800 p-4 rounded-lg flex items-center gap-2 border border-green-200">
                            <CheckCircle className="w-5 h-5" />
                            <div>
                                <p className="font-bold">¡Proceso finalizado!</p>
                                <p className="text-xs">Los registros nuevos han sido añadidos a la base de datos local.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Table */}
            {records.length > 0 && (
                <div className="mt-6 border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2">
                         <CheckCircle className="w-4 h-4 text-green-600" />
                         Vista Previa: Registros nuevos detectados (Primeros 5)
                    </h4>
                    <Table 
                        columns={previewColumns} 
                        data={records.slice(0, 5)} 
                        className="text-xs"
                    />
                    {records.length > 5 && (
                        <p className="text-center text-xs text-gray-400 mt-2">... y {records.length - 5} más</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConfirmationJsonImporter;