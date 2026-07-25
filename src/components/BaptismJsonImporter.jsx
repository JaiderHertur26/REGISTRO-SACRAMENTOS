import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Upload, FileJson, CheckCircle, Save, 
    Loader2, AlertTriangle, Info, Database 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';
import Table from '@/components/ui/Table';

const BaptismJsonImporter = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { getParrocos } = useAppData();
    
    const [file, setFile] = useState(null);
    const [recordsToImport, setRecordsToImport] = useState([]); 
    const [duplicateCount, setDuplicateCount] = useState(0); 
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);
    const [parrocoActual, setParrocoActual] = useState('---');

    // --- 1. CARGAR PÁRROCO ACTUAL PARA "DA FE" ---
    useEffect(() => {
        if (user?.parishId) {
            const parrocos = getParrocos(user.parishId) || [];
            const actual = parrocos.find(p => String(p.estado) === '1');
            if (actual) {
                setParrocoActual(`${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase());
            }
        }
    }, [user, getParrocos]);

    // --- 2. PROCESAMIENTO DEL ARCHIVO Y FILTRO DE DUPLICADOS ---
    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        const fileName = selectedFile.name.toUpperCase();
        if (!fileName.includes('BAUTIZOS')) {
            toast({ title: "Archivo incorrecto", description: "El archivo debe contener 'BAUTIZOS' en el nombre.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.data || !Array.isArray(json.data)) throw new Error("Formato JSON inválido");

                // Obtener registros existentes en la Nube para evitar duplicados
                const { data: existingData } = await supabase
                    .from('baptisms')
                    .select('book_number, page_number, entry_number')
                    .eq('parish_id', user.parishId);

                const existingKeys = new Set((existingData || []).map(b => 
                    `${String(b.book_number).padStart(4, '0')}-${String(b.page_number).padStart(4, '0')}-${String(b.entry_number).padStart(4, '0')}`
                ));

                const processed = [];
                let duplicates = 0;

                json.data.forEach(item => {
                    // Mapeo a los campos únicos en español (Ahora con los 3 campos de Registro Civil)
                    const recordMap = {
                        Libro: String(item.libro || item.Libro || '').padStart(4, '0'),
                        folio: String(item.folio || '').padStart(4, '0'),
                        numero: String(item.numero || '').padStart(4, '0'),
                        fechaSacramento: item.fechaSacramento || '',
                        lugarBautismo: (item.lugarBautismo || '').toUpperCase(),
                        apellidos: (item.apellidos || '').toUpperCase(),
                        nombres: (item.nombres || '').toUpperCase(),
                        sexo: (item.sexo || '').toUpperCase(),
                        fechaNacimiento: item.fechaNacimiento || '',
                        lugarNacimiento: (item.lugarNacimiento || '').toUpperCase(),
                        tipoUnionPadres: (item.tipoUnionPadres || '').toUpperCase(),
                        nombrePadre: (item.nombrePadre || '').toUpperCase(),
                        cedulaPadre: item.cedulaPadre || '',
                        nombreMadre: (item.nombreMadre || '').toUpperCase(),
                        cedulaMadre: item.cedulaMadre || '',
                        abuelosPaternos: (item.abuelosPaternos || '').toUpperCase(),
                        abuelosMaternos: (item.abuelosMaternos || '').toUpperCase(),
                        padrinos: (item.padrinos || '').toUpperCase(),
                        ministro: (item.ministro || '').toUpperCase(),
                        daFe: parrocoActual,
                        // 🚀 NUEVOS CAMPOS AGREGADOS
                        serialRegistro: item.serialRegistro || '',
                        nuip: item.nuip || '',
                        oficinaRegistro: item.oficinaRegistro || '',
                        fechaExpedicionRegistro: item.fechaExpedicionRegistro || ''
                    };

                    const key = `${recordMap.Libro}-${recordMap.folio}-${recordMap.numero}`;
                    
                    if (existingKeys.has(key)) {
                        duplicates++;
                    } else {
                        processed.push(recordMap);
                        existingKeys.add(key); 
                    }
                });

                setRecordsToImport(processed);
                setDuplicateCount(duplicates);
                setFile(selectedFile);
                toast({ title: "Validación Completa", description: `${processed.length} registros listos.` });

            } catch (err) {
                toast({ title: "Error", description: "No se pudo procesar el archivo JSON.", variant: "destructive" });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(selectedFile);
    };

    // --- 3. INYECCIÓN MASIVA A PERMANENTES ---
    const handleImport = async () => {
        if (recordsToImport.length === 0) return;
        setIsProcessing(true);

        try {
            const batchSize = 50;
            for (let i = 0; i < recordsToImport.length; i += batchSize) {
                const batch = recordsToImport.slice(i, i + batchSize);
                
                const dbRecords = batch.map(item => ({
                    id: generateUUID(),
                    parish_id: user.parishId,
                    book_number: item.Libro,
                    page_number: item.folio,
                    entry_number: item.numero,
                    first_name: item.nombres,
                    last_name: item.apellidos,
                    gender: item.sexo,
                    birth_date: item.fechaNacimiento || null,
                    sacrament_date: item.fechaSacramento || null,
                    father_name: item.nombrePadre,
                    mother_name: item.nombreMadre,
                    // Sincronizamos también los campos individuales en la BD si existen las columnas
                    serial_registro: item.serialRegistro,
                    nuip: item.nuip,
                    oficina_registro: item.oficinaRegistro,
                    fecha_expedicion_registro: item.fechaExpedicionRegistro,
                    status: 'seated',
                    raw_data: item // Aquí viaja la cápsula completa de 23 campos
                }));

                const { error } = await supabase.from('baptisms').insert(dbRecords);
                if (error) throw error;
            }

            toast({ title: "Importación Exitosa", description: "Datos inyectados en la Base de Datos Permanente.", className: "bg-green-50 border-green-200" });
            setImportComplete(true);
            setRecordsToImport([]);

        } catch (err) {
            toast({ title: "Error de Importación", description: err.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const columns = [
        { header: 'L:F:N', render: r => `${r.Libro}/${r.folio}/${r.numero}` },
        { header: 'Bautizado', render: r => `${r.apellidos}, ${r.nombres}` },
        { header: 'NUIP / Serial', render: r => <span className="text-[10px] font-mono text-gray-500">{r.nuip || '---'} / {r.serialRegistro || '---'}</span> },
        { header: 'Párroco Da Fe', render: () => <span className="text-blue-600 font-bold">{parrocoActual}</span> }
    ];

    return (
        <div className="bg-white border border-gray-100 rounded-[2rem] p-8 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-full md:w-1/3">
                    <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-gray-200 rounded-[2rem] cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-[#4B7BA7] transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isProcessing ? <Loader2 className="w-10 h-10 mb-3 text-[#4B7BA7] animate-spin" /> : <Upload className="w-10 h-10 mb-3 text-gray-300" />}
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">{isProcessing ? 'Procesando...' : 'Cargar BAUTIZOS.json'}</p>
                        </div>
                        <input type="file" className="hidden" accept=".json" onChange={handleFileChange} disabled={isProcessing} />
                    </label>
                </div>

                <div className="w-full md:w-2/3 space-y-4">
                    <div className="flex items-center gap-3 border-b pb-4">
                        <Database className="w-5 h-5 text-[#4B7BA7]" />
                        <h3 className="font-black text-gray-800 uppercase text-sm tracking-widest">Inyección Masiva (23 Campos)</h3>
                    </div>

                    {file ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                                    <span className="block text-2xl font-black text-green-700">{recordsToImport.length}</span>
                                    <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Listos para Inyectar</span>
                                </div>
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                    <span className="block text-2xl font-black text-amber-700">{duplicateCount}</span>
                                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Duplicados Omitidos</span>
                                </div>
                            </div>
                            
                            <Button 
                                onClick={handleImport} 
                                disabled={recordsToImport.length === 0 || isProcessing || importComplete} 
                                className="w-full py-7 bg-[#4B7BA7] hover:bg-[#3A6286] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl"
                            >
                                {isProcessing ? 'Sincronizando con la Nube...' : `Sincronizar ${recordsToImport.length} Registros`}
                            </Button>
                        </div>
                    ) : (
                        <div className="py-10 text-center">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Seleccione el archivo JSON para auditar datos</p>
                        </div>
                    )}
                </div>
            </div>

            {recordsToImport.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-50">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-500" /> Vista Previa del Mapeo de Seguridad
                    </h4>
                    <Table columns={columns} data={recordsToImport.slice(0, 5)} />
                </div>
            )}
        </div>
    );
};

export default BaptismJsonImporter;