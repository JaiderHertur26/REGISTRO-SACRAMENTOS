import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileJson, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAppData } from '@/context/AppDataContext';
import { 
    validateMatrimonioStructure, 
    validateMatrimonioData, 
    mapMatrimonioJSON,
    handleMatrimonioImportError
} from '@/utils/matrimonioJsonMapper';
import Table from '@/components/ui/Table';

const MatrimonioJsonImporter = () => {
    const { toast } = useToast();
    
    const [file, setFile] = useState(null);
    const [records, setRecords] = useState([]);
    const [validationStats, setValidationStats] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        // Filename Validation
        const fileName = selectedFile.name.toUpperCase();
        if (fileName !== 'MATRIMON' && fileName !== 'MATRIMON.JSON') {
            toast({
                title: "Nombre de archivo incorrecto",
                description: "El archivo debe llamarse 'MATRIMON' o 'MATRIMON.json'",
                variant: "destructive"
            });
            event.target.value = ''; // Reset input to allow re-selection
            setFile(null);
            return;
        }

        setFile(selectedFile);
        setRecords([]);
        setValidationStats(null);
        setImportComplete(false);
        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                
                // 1. Validate Structure
                const structureCheck = validateMatrimonioStructure(json);
                if (!structureCheck.isValid) {
                    throw new Error(structureCheck.message);
                }

                // 2. Process Records
                const validRecords = [];
                const invalidRecords = [];

                json.data.forEach((item, index) => {
                    const validation = validateMatrimonioData(item);
                    if (validation.isValid) {
                        validRecords.push(item);
                    } else {
                        invalidRecords.push({ ...item, _errors: validation.errors, _index: index + 1 });
                    }
                });

                setRecords(validRecords);
                setValidationStats({
                    total: json.data.length,
                    valid: validRecords.length,
                    invalid: invalidRecords.length,
                    errors: invalidRecords.slice(0, 5) // Store first 5 errors for display
                });

            } catch (error) {
                toast({
                    title: "Error de lectura",
                    description: handleMatrimonioImportError(error),
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
        if (!records.length) return;

        setIsProcessing(true);
        // Identify Parish ID
        let parishId = null;
        const authUser = JSON.parse(localStorage.getItem('user'));
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (authUser && authUser.parishId) {
            parishId = authUser.parishId;
        } else if (currentUser && currentUser.parishId) {
            parishId = currentUser.parishId;
        } else {
             // Fallback
             const parishes = JSON.parse(localStorage.getItem('parishes') || '[]');
             if (parishes.length > 0) parishId = parishes[0].id;
        }

        if (!parishId) {
            toast({ title: "Error", description: "No se identificó la parroquia.", variant: "destructive" });
            setIsProcessing(false);
            return;
        }

        try {
            const mappedRecords = records.map(mapMatrimonioJSON);
            const storageKey = `matrimonios_${parishId}`;
            const currentRecords = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const updatedRecords = [...currentRecords, ...mappedRecords];
            localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
            
            toast({
                title: "Importación Exitosa",
                description: `${mappedRecords.length} registros importados correctamente.`,
                className: "bg-green-50 border-green-200"
            });
            setImportComplete(true);
            setFile(null); // Reset input

        } catch (error) {
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
        { header: 'L/F/N', render: r => `${r.libro}/${r.folio}/${r.numero}` },
        { header: 'Novio', render: r => `${r.novio_apellidos || ''} ${r.novio_nombres || ''}` },
        { header: 'Novia', render: r => `${r.novia_apellidos || ''} ${r.novia_nombres || ''}` },
        { header: 'Fecha', accessor: 'fecmat' }
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
                                    <span className="text-xs text-blue-600 uppercase">Total</span>
                                </div>
                                <div className="bg-green-50 p-2 rounded border border-green-100">
                                    <span className="block text-xl font-bold text-green-700">{validationStats.valid}</span>
                                    <span className="text-xs text-green-600 uppercase">Válidos</span>
                                </div>
                                <div className="bg-red-50 p-2 rounded border border-red-100">
                                    <span className="block text-xl font-bold text-red-700">{validationStats.invalid}</span>
                                    <span className="text-xs text-red-600 uppercase">Inválidos</span>
                                </div>
                            </div>

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

                            <div className="flex gap-3">
                                <Button 
                                    onClick={handleImport} 
                                    disabled={validationStats.valid === 0 || isProcessing || importComplete}
                                    className="bg-[#4B7BA7] hover:bg-[#365d80] text-white w-full"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {isProcessing ? 'Procesando...' : `Importar ${validationStats.valid} Registros`}
                                </Button>
                            </div>
                        </div>
                    )}
                    
                    {importComplete && (
                        <div className="bg-green-50 text-green-800 p-4 rounded-lg flex items-center gap-2 border border-green-200">
                            <CheckCircle className="w-5 h-5" />
                            <div>
                                <p className="font-bold">¡Proceso finalizado!</p>
                                <p className="text-xs">Los registros han sido añadidos a la base de datos local.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Table */}
            {records.length > 0 && (
                <div className="mt-6 border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm">Vista Previa (Primeros 5 registros válidos)</h4>
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

export default MatrimonioJsonImporter;