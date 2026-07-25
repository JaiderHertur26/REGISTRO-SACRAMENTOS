import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { 
    Upload, CheckCircle2, X, AlertTriangle, 
    Loader2, FileJson, Info, Database 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext'; 
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const ImportBaptismsForm = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    
    const { purificarRegistroBautismo, guardarEnPermanentes, getBaptisms } = useAppData();

    const [loading, setLoading] = useState(false);
    const [validationResult, setValidationResult] = useState(null);

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setLoading(true);
        setValidationResult(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target.result);
                const rawData = Array.isArray(json) ? json : (json.data || []);
                if (rawData.length === 0) throw new Error('El archivo no contiene registros válidos.');

                const entityId = user.parishId || user.dioceseId;
                const existingBaptisms = getBaptisms(entityId);

                // --- LLAVE MAESTRA ANTI-DUPLICADOS (Libro-Folio-Número) ---
                const existingKeys = new Set(existingBaptisms.map(b => 
                    `${String(b.book_number || b.libro || '').padStart(4, '0')}-${String(b.page_number || b.folio || '').padStart(4, '0')}-${String(b.entry_number || b.numero || '').padStart(4, '0')}`
                ));

                const newRecords = [];
                const duplicates = [];
                const internalKeys = new Set();

                // 🧠 PASAMOS CADA REGISTRO POR EL CEREBRO DE PURIFICACIÓN
                rawData.forEach(rawItem => {
                    const cleanItem = purificarRegistroBautismo(rawItem);
                    const key = `${cleanItem.book_number}-${cleanItem.page_number}-${cleanItem.entry_number}`;

                    if (existingKeys.has(key) || internalKeys.has(key)) {
                        duplicates.push(cleanItem);
                    } else {
                        newRecords.push(cleanItem);
                        internalKeys.add(key);
                    }
                });

                setValidationResult({ newRecords, duplicates, total: rawData.length });

            } catch (err) {
                toast({ title: "Archivo Rechazado", description: "El JSON está corrupto o mal estructurado.", variant: "destructive" });
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleConfirm = async () => {
        if (!validationResult?.newRecords.length) return;

        setLoading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            // Guardamos cada registro purificado
            for (const record of validationResult.newRecords) {
                const res = await guardarEnPermanentes(record);
                if (res.success) successCount++;
                else errorCount++;
            }

            toast({ 
                title: "Importación Finalizada", 
                description: `${successCount} registros nuevos inyectados en la Nube. ${errorCount} errores.`,
                className: successCount > 0 ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-900"
            });
            
            window.dispatchEvent(new Event('storage'));
            onClose();
        } catch (error) {
            toast({ title: "Error Crítico", description: "La conexión con el servidor falló.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { header: 'Ubicación (L:F:A)', render: (r) => <span className="font-mono text-[#4B7BA7] font-black">{r.book_number}:{r.page_number}:{r.entry_number}</span> },
        { header: 'Identidad del Sujeto', render: (r) => <span className="font-black uppercase">{r.lastName}, {r.firstName}</span> },
        { header: 'Filiación', render: (r) => <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{r.fatherName} / {r.motherName}</span> },
        { header: 'Fecha C.', render: (r) => <span className="text-[10px] font-bold text-gray-500">{r.sacramentDate || '---'}</span> }
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Carga Masiva de Archivos Históricos">
            <div className="space-y-6 min-w-[900px] p-4">
                
                {/* 1. ZONA DE DROP JSON */}
                {!validationResult && !loading && (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-[3rem] p-24 text-center bg-gray-50 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700"><FileJson className="w-48 h-48" /></div>
                        <Upload className="w-16 h-16 text-gray-300 mx-auto mb-6 group-hover:text-[#4B7BA7] transition-colors" />
                        <p className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-2">Seleccionar Archivo JSON</p>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto font-bold uppercase tracking-widest leading-relaxed">
                            El sistema unificará nombres, fechas, abuelos y notas marginales automáticamente.
                        </p>
                        <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    </div>
                )}

                {/* 2. ESTADO DE ANÁLISIS */}
                {loading && (
                    <div className="py-32 text-center space-y-6">
                        <Loader2 className="w-16 h-16 animate-spin text-[#4B7BA7] mx-auto" />
                        <p className="text-[#4B7BA7] font-black uppercase tracking-[0.3em] text-xs animate-pulse">El Cerebro está purificando los datos...</p>
                    </div>
                )}

                {/* 3. VISTA DE AUDITORÍA */}
                {validationResult && !loading && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="bg-green-50 border border-green-100 p-8 rounded-[2rem] text-center shadow-sm">
                                <p className="text-[10px] font-black text-green-800 uppercase tracking-[0.2em] mb-2">Nuevos para Inyectar</p>
                                <p className="text-5xl font-black text-green-600 tracking-tighter">{validationResult.newRecords.length}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] text-center shadow-sm">
                                <p className="text-[10px] font-black text-amber-800 uppercase tracking-[0.2em] mb-2">Duplicados Omitidos</p>
                                <p className="text-5xl font-black text-amber-600 tracking-tighter">{validationResult.duplicates.length}</p>
                            </div>
                        </div>

                        {validationResult.newRecords.length > 0 ? (
                            <div className="border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm bg-white">
                                <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex items-center gap-3">
                                    <Info className="w-5 h-5 text-[#4B7BA7]" />
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Vista Previa de Purificación</span>
                                </div>
                                <div className="p-2">
                                    <Table columns={columns} data={validationResult.newRecords.slice(0, 5)} className="border-none shadow-none" />
                                </div>
                                {validationResult.newRecords.length > 5 && (
                                    <div className="text-center text-[10px] text-gray-400 py-4 bg-gray-50 font-black uppercase tracking-widest border-t border-gray-100">
                                        ... y otros {validationResult.newRecords.length - 5} registros más en cola.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-amber-50 p-16 rounded-[3rem] border border-amber-100 text-center">
                                <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
                                <p className="text-amber-900 font-black text-xl uppercase tracking-tight mb-2">Archivo Rechazado</p>
                                <p className="text-amber-700 text-sm font-bold">Todos los registros de este archivo ya existen en la base de datos.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. BOTONERA FINAL */}
                <div className="flex justify-end gap-4 pt-8 border-t border-gray-100 mt-8">
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="px-10 py-7 rounded-2xl text-gray-400 font-black uppercase tracking-widest text-[10px] hover:bg-gray-50">
                        Descartar
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={!validationResult?.newRecords.length || loading}
                        className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-12 py-7 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Database className="w-5 h-5 mr-3" />}
                        Inyectar a la Nube
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ImportBaptismsForm;