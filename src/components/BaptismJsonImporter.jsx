import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Upload, CheckCircle2, AlertTriangle, XCircle, 
    Loader2, Database, FileJson, Info 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';
import Table from '@/components/ui/Table';
import { cn } from '@/lib/utils';

// 🚀 FUNCIÓN LIMPIADORA DE TÍTULOS (Normaliza la Base de Datos)
const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?|PADRE|FRAY|MONS\.?)\s+/i, '').trim();
};

const BaptismJsonImporter = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { getParrocos, purificarRegistroBautismo } = useAppData();
    const fileInputRef = useRef(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    
    const [parrocoActual, setParrocoActual] = useState('');
    const [listaSacerdotes, setListaSacerdotes] = useState([]);
    const [diccionarioDaFe, setDiccionarioDaFe] = useState({});

    const parishId = user?.parish_id || user?.parishId;

    // --- 1. CARGAR HISTORIAL DE PÁRROCOS Y CREAR DICCIONARIOS ---
    useEffect(() => {
        if (parishId) {
            const parrocos = getParrocos(parishId) || [];
            setListaSacerdotes(parrocos);
            
            // A. Buscar Párroco Actual (Limpiando el título)
            const actual = parrocos.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
            if (actual) {
                setParrocoActual(cleanTitle(`${actual.nombre} ${actual.apellido || ''}`).toUpperCase());
            } else {
                setParrocoActual('PÁRROCO ENCARGADO');
            }

            // B. Generar Diccionario de Códigos (Orden cronológico)
            const sortedParrocos = [...parrocos].sort((a, b) => {
                const dateA = new Date(a.fechaIngreso || a.fechaNombramiento || '1900-01-01');
                const dateB = new Date(b.fechaIngreso || b.fechaNombramiento || '1900-01-01');
                return dateA - dateB;
            });

            const map = {};
            sortedParrocos.forEach((p, index) => {
                const code = String(index + 1).padStart(4, '0');
                // Guardamos el nombre puro sin el "PBRO." quemado
                map[code] = cleanTitle(`${p.nombre} ${p.apellido || ''}`).toUpperCase();
            });
            
            setDiccionarioDaFe(map);
        }
    }, [parishId, getParrocos]);

    // --- 2. PROCESAMIENTO, TRADUCCIÓN Y LÓGICA DE BAPTISM CELEBRATED ---
    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        setIsProcessing(true);
        setValidationResult(null);
        setImportComplete(false);

        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                const rawData = Array.isArray(json) ? json : (json.data || []);
                
                if (rawData.length === 0) throw new Error("El archivo no contiene registros válidos en la llave 'data'.");

                const { data: existingData, error: dbError } = await supabase
                    .from('baptisms')
                    .select('book_number, folio, number')
                    .eq('parish_id', parishId);

                if (dbError) throw new Error("Fallo de conexión con la Base de Datos Central.");

                const existingKeys = new Set((existingData || []).map(b => 
                    `${String(b.book_number).padStart(4, '0')}-${String(b.folio).padStart(4, '0')}-${String(b.number).padStart(4, '0')}`
                ));

                const processed = [];
                const errors = [];
                const warnings = [];
                const internalKeys = new Set();
                let validCount = 0;

                rawData.forEach((item, index) => {
                    const rowNum = index + 1;
                    
                    // TRADUCTOR UNIVERSAL DE LLAVES
                    const mappedItem = {
                        Libro: item["LIBRO N°"] || item.Libro || item.libro || '',
                        folio: item["FOLIO N°"] || item.folio || '',
                        numero: item["NÚMERO N°"] || item.numero || item.numeroActa || '',
                        fechaSacramento: item["FECHA DEL BAUTISMO"] || item.fechaSacramento || '',
                        lugarBautismo: item["LUGAR DE BAUTISMO"] || item.lugarBautismo || '',
                        apellidos: item["APELLIDOS"] || item.apellidos || '',
                        nombres: item["NOMBRES"] || item.nombres || '',
                        fechaNacimiento: item["FECHA DE NACIMIENTO"] || item.fechaNacimiento || '',
                        lugarNacimiento: item["LUGAR DE NACIMIENTO"] || item.lugarNacimiento || '',
                        sexo: item["SEXO"] || item.sexo || '',
                        tipoUnionPadres: item["TIPO DE UNIÓN"] || item.tipoUnionPadres || '',
                        nombrePadre: item["NOMBRE DE PADRE"] || item.nombrePadre || '',
                        cedulaPadre: item["CÉDULA DE PADRE"] || item.cedulaPadre || '',
                        nombreMadre: item["NOMBRE DE MADRE"] || item.nombreMadre || '',
                        cedulaMadre: item["CÉDULA DE MADRE"] || item.cedulaMadre || '',
                        abuelosPaternos: item["ABUELOS PATERNOS"] || item.abuelosPaternos || '',
                        abuelosMaternos: item["ABUELOS MATERNOS"] || item.abuelosMaternos || '',
                        padrinos: item["PADRINOS"] || item.padrinos || '',
                        ministro: item["MINISTRO"] || item.ministro || '',
                        daFe: item["DA FE"] || item.daFe || '',
                        notaMarginal: item["NOTAS MARGINALES"] || item.notaMarginal || ''
                    };

                    // 🚀 INTELIGENCIA: AUTO-COMPLETAR MINISTRO HISTÓRICO
                    if (!mappedItem.ministro || mappedItem.ministro === '---') {
                        if (mappedItem.fechaSacramento && listaSacerdotes.length > 0) {
                            const fechaBautismo = new Date(mappedItem.fechaSacramento);
                            const ministroHistorico = listaSacerdotes.find(s => {
                                const inicio = new Date(s.fechaIngreso || s.fechaNombramiento || '1900-01-01');
                                const fin = s.fechaSalida ? new Date(s.fechaSalida) : new Date();
                                return fechaBautismo >= inicio && fechaBautismo <= fin;
                            });
                            if (ministroHistorico) {
                                mappedItem.ministro = cleanTitle(`${ministroHistorico.nombre} ${ministroHistorico.apellido || ''}`).toUpperCase();
                            }
                        }
                    } else {
                        // Si ya trae ministro, lo purificamos
                        mappedItem.ministro = cleanTitle(mappedItem.ministro).toUpperCase();
                    }

                    // Purificación Estándar
                    const cleanItem = purificarRegistroBautismo(mappedItem);

                    // 🚀 INTELIGENCIA "DA FE" CON DICCIONARIO
                    const rawDaFe = String(mappedItem.daFe).trim();
                    let finalDaFe = parrocoActual; 

                    if (/^\d+$/.test(rawDaFe)) {
                        if (diccionarioDaFe[rawDaFe]) finalDaFe = diccionarioDaFe[rawDaFe];
                    } else if (rawDaFe && rawDaFe !== '---' && !rawDaFe.includes('ENCARGADO')) {
                        finalDaFe = cleanTitle(rawDaFe).toUpperCase();
                    }
                    cleanItem.daFe = finalDaFe;

                    const key = `${cleanItem.Libro}-${cleanItem.folio}-${cleanItem.numero}`;
                    const nombreBautizado = `${cleanItem.nombres} ${cleanItem.apellidos}`.trim();

                    if (!cleanItem.nombres || !cleanItem.apellidos || cleanItem.Libro === '0000') {
                        errors.push(`Fila ${rowNum}: Faltan datos críticos (Nombres, Apellidos o Libro).`);
                    } else if (existingKeys.has(key)) {
                        warnings.push(`Fila ${rowNum}: Omitido "${nombreBautizado}" (El acta L:${cleanItem.Libro} F:${cleanItem.folio} N:${cleanItem.numero} ya existe).`);
                    } else if (internalKeys.has(key)) {
                        warnings.push(`Fila ${rowNum}: Omitido "${nombreBautizado}" (Acta duplicada dentro del archivo).`);
                    } else {
                        processed.push(cleanItem);
                        internalKeys.add(key);
                        validCount++;
                    }
                });

                setValidationResult({ dataToImport: processed, count: validCount, errors, warnings });

            } catch (err) {
                toast({ title: "Error Estructural", description: err.message, variant: "destructive" });
                setValidationResult({ dataToImport: [], count: 0, errors: [err.message], warnings: [] });
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(selectedFile);
    };

    // --- 3. INYECCIÓN MASIVA A LA NUBE (MAPEADO AL ESQUEMA EXACTO) ---
    const handleImport = async () => {
        if (!validationResult || validationResult.dataToImport.length === 0) return;
        setIsProcessing(true);

        const cleanDate = (d) => (d && String(d).trim() !== '' && String(d).trim() !== '---') ? d : null;

        try {
            // 🚀 ESTRUCTURA 100% FIEL A TU BASE DE DATOS
            const dbRecords = validationResult.dataToImport.map(item => ({
                id: generateUUID(),
                parish_id: parishId,
                book_number: item.Libro,
                folio: item.folio,
                number: item.numero,
                numero_registro: item.numeroRegistro || null,
                status: 'seated', 
                celebration_date: cleanDate(item.fechaSacramento),
                hora_sacramento: item.horaSacramento || null,
                lugar_bautismo: item.lugarBautismo || null,
                apellidos: item.apellidos || null,
                nombres: item.nombres || null,
                sexo: item.sexo || null,
                fecha_nacimiento: cleanDate(item.fechaNacimiento),
                lugar_nacimiento: item.lugarNacimiento || null,
                nuip: item.nuip || null,
                serial_registro: item.serialRegistro || null,
                oficina_registro: item.oficinaRegistro || null,
                fecha_expedicion_registro: cleanDate(item.fechaExpedicionRegistro),
                tipo_union_padres: item.tipoUnionPadres || null,
                nombre_padre: item.nombrePadre || null,
                cedula_padre: item.cedulaPadre || null,
                nombre_madre: item.nombreMadre || null,
                cedula_madre: item.cedulaMadre || null,
                abuelos_paternos: item.abuelosPaternos || null,
                abuelos_maternos: item.abuelosMaternos || null,
                padrinos: item.padrinos || null,
                ministro: item.ministro || null,
                da_fe: item.daFe || null,
                direccion: item.direccion || null,
                nota_marginal: item.notaMarginal || null,
                raw_data: item, 
                created_at: new Date().toISOString()
            }));

            const batchSize = 200;
            for (let i = 0; i < dbRecords.length; i += batchSize) {
                const batch = dbRecords.slice(i, i + batchSize);
                const { error } = await supabase.from('baptisms').insert(batch);
                if (error) throw error;
            }

            toast({ 
                title: "¡Importación Exitosa!", 
                description: `${dbRecords.length} registros inyectados en la Base de Datos Permanente.`, 
                className: "bg-green-50 border-green-200 text-green-900" 
            });
            
            setImportComplete(true);

        } catch (err) {
            toast({ title: "Fallo de Inyección", description: err.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const resetImporter = () => {
        setValidationResult(null);
        setImportComplete(false);
    };

    const columns = [
        { header: 'Ubicación (L:F:N)', render: r => <span className="font-mono text-[#4B7BA7] font-black">{r.Libro}:{r.folio}:{r.numero}</span> },
        { header: 'Bautizado', render: r => <span className="font-bold uppercase text-slate-800">{r.apellidos} {r.nombres}</span> },
        { header: 'Párroco Da Fe', render: r => <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded">{r.daFe}</span> },
        { header: 'Ministro', render: r => <span className="text-[10px] font-bold text-gray-500 uppercase">{r.ministro || '---'}</span> }
    ];

    const hasErrors = validationResult?.errors?.length > 0;
    const canConfirm = validationResult && validationResult.count > 0 && !hasErrors && !isProcessing && !importComplete;

    return (
        <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-12 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] to-[#D4AF37]"></div>

            <div className="flex flex-col xl:flex-row gap-10 items-start">
                
                <div className="w-full xl:w-1/3">
                    <label className={cn(
                        "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all relative overflow-hidden",
                        validationResult ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-gray-50 hover:bg-blue-50/50 hover:border-[#4B7BA7]"
                    )}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><FileJson className="w-40 h-40" /></div>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10 text-center px-4">
                            {isProcessing ? (
                                <Loader2 className="w-12 h-12 mb-4 text-[#4B7BA7] animate-spin" />
                            ) : validationResult ? (
                                <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                            ) : (
                                <Upload className="w-12 h-12 mb-4 text-gray-400 group-hover:text-[#4B7BA7]" />
                            )}
                            
                            <p className="text-sm font-black text-gray-700 uppercase tracking-tight">
                                {isProcessing ? 'Procesando Archivo...' : validationResult ? 'Archivo Cargado' : 'Seleccionar JSON'}
                            </p>
                            {!validationResult && !isProcessing && (
                                <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest">
                                    El sistema traducirá códigos de párroco y depurará la información.
                                </p>
                            )}
                        </div>
                        <input type="file" className="hidden" accept=".json" onChange={handleFileChange} disabled={isProcessing} ref={fileInputRef} />
                    </label>
                </div>

                <div className="w-full xl:w-2/3 space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-xl"><Database className="w-5 h-5 text-[#4B7BA7]" /></div>
                            <div>
                                <h3 className="font-black text-gray-900 uppercase text-sm tracking-widest">Motor de Inyección (Bautismos)</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Sincronización Directa a Base de Datos Permanente</p>
                            </div>
                        </div>
                        {validationResult && (
                            <Button variant="ghost" onClick={resetImporter} className="text-gray-400 hover:text-gray-700 text-xs font-black uppercase">
                                Cargar Otro Archivo
                            </Button>
                        )}
                    </div>

                    {!validationResult && !isProcessing && (
                        <div className="py-12 text-center bg-slate-50/50 rounded-[2rem] border border-slate-100">
                            <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Esperando archivo para auditoría de datos...</p>
                        </div>
                    )}

                    {validationResult && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-3 gap-4">
                                <StatCard label="Listos" val={validationResult.count} color="green" />
                                <StatCard label="Errores" val={validationResult.errors.length} color="red" />
                                <StatCard label="Omitidos" val={validationResult.warnings.length} color="amber" />
                            </div>

                            {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {validationResult.errors.length > 0 && (
                                        <AlertBox title="Errores Críticos" list={validationResult.errors} type="error" />
                                    )}
                                    {validationResult.warnings.length > 0 && (
                                        <AlertBox title="Duplicados Omitidos" list={validationResult.warnings} type="warning" />
                                    )}
                                </div>
                            )}

                            {!hasErrors && validationResult.count > 0 && (
                                <Button 
                                    onClick={handleImport} 
                                    disabled={!canConfirm} 
                                    className="w-full py-8 bg-gradient-to-r from-[#4B7BA7] to-[#3A6286] hover:shadow-xl text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all transform active:scale-95 disabled:opacity-50"
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Database className="w-5 h-5 mr-3" />}
                                    {isProcessing ? 'Inyectando a la Nube...' : importComplete ? 'Importación Finalizada' : `Inyectar ${validationResult.count} Registros Permanentes`}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {validationResult?.count > 0 && (
                <div className="mt-10 pt-8 border-t border-gray-100 animate-in fade-in duration-700">
                    <div className="bg-gray-50/50 px-6 py-4 rounded-t-3xl border border-b-0 border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Info className="w-4 h-4 text-[#4B7BA7]" /> Vista Previa de Purificación (Top 5)
                        </span>
                    </div>
                    <div className="border border-gray-100 rounded-b-3xl overflow-hidden bg-white shadow-sm">
                        <Table columns={columns} data={validationResult.dataToImport.slice(0, 5)} />
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, val, color }) => {
    const colors = {
        green: "bg-green-50 border-green-100 text-green-700",
        red: "bg-red-50 border-red-100 text-red-700",
        amber: "bg-amber-50 border-amber-100 text-amber-700"
    };
    return (
        <div className={cn("p-5 rounded-3xl border text-center shadow-sm", colors[color])}>
            <div className="text-3xl font-black leading-none mb-1 tracking-tighter">{val}</div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">{label}</div>
        </div>
    );
};

const AlertBox = ({ title, list, type }) => {
    const isError = type === 'error';
    return (
        <div className={cn("rounded-3xl border p-5 max-h-48 overflow-y-auto custom-scrollbar shadow-sm", isError ? "bg-red-50/50 border-red-100" : "bg-amber-50/50 border-amber-100")}>
            <div className="flex items-center gap-2 mb-3">
                {isError ? <XCircle className="w-5 h-5 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                <span className={cn("text-[10px] font-black uppercase tracking-widest", isError ? "text-red-800" : "text-amber-800")}>{title}</span>
            </div>
            <ul className="space-y-2">
                {list.map((msg, i) => (
                    <li key={i} className={cn("text-[10px] font-bold leading-tight border-b pb-2", isError ? "text-red-600 border-red-100/50" : "text-amber-700 border-amber-100/50")}>• {msg}</li>
                ))}
            </ul>
        </div>
    );
};

export default BaptismJsonImporter;