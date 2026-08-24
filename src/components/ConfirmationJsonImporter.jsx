import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Upload, CheckCircle2, AlertTriangle, XCircle, 
    Loader2, Database, FileJson, Info, LayoutList, FileText
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';
import Table from '@/components/ui/Table';
import { cn } from '@/lib/utils';

// 🚀 FUNCIÓN LIMPIADORA DE TÍTULOS
const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|EXCMO\.?\s*|SACERDOTE\s*)/ig, '').trim();
};

// 🚀 FUNCIÓN PURIFICADORA INTERNA
const purificarRegistroConfirmacion = (obj) => {
    const cleaned = { ...obj };
    for (const key in cleaned) {
        if (typeof cleaned[key] === 'string') {
            cleaned[key] = cleaned[key].trim().toUpperCase();
            if (cleaned[key] === 'NULL' || cleaned[key] === 'UNDEFINED' || cleaned[key] === '') {
                cleaned[key] = '';
            }
        }
    }
    // Formato estricto a 4 dígitos
    if (cleaned.Libro && !isNaN(cleaned.Libro)) cleaned.Libro = String(cleaned.Libro).padStart(4, '0');
    if (cleaned.folio && !isNaN(cleaned.folio)) cleaned.folio = String(cleaned.folio).padStart(4, '0');
    if (cleaned.numero && !isNaN(cleaned.numero)) cleaned.numero = String(cleaned.numero).padStart(4, '0');
    return cleaned;
};

const ConfirmationJsonImporter = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { getParrocos } = useAppData();
    const fileInputRef = useRef(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [fileType, setFileType] = useState(null); // 🚀 GUARDA SI ES 'CONFIRMA' o 'INSCONFI'
    
    const [parrocoActual, setParrocoActual] = useState('');
    const [listaSacerdotes, setListaSacerdotes] = useState([]);

    const parishId = user?.parish_id || user?.parishId;

    // --- 1. CARGAR HISTORIAL DE PÁRROCOS ---
    useEffect(() => {
        if (parishId) {
            const parrocos = getParrocos(parishId) || [];
            setListaSacerdotes(parrocos);
            
            const actual = parrocos.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
            if (actual) {
                setParrocoActual(cleanTitle(`${actual.nombre} ${actual.apellido || ''}`).toUpperCase());
            } else {
                setParrocoActual('PÁRROCO ENCARGADO');
            }
        }
    }, [parishId, getParrocos]);

    // --- 2. MÁQUINA DEL TIEMPO: BUSCADOR HISTÓRICO EXACTO ---
    const getHistoricalPriest = (dateString) => {
        if (!dateString || listaSacerdotes.length === 0) return null;
        
        const dStr = dateString.includes('T') ? dateString : `${dateString}T12:00:00`;
        const searchDate = new Date(dStr);
        if (isNaN(searchDate.getTime())) return null;

        const found = listaSacerdotes.find(s => {
            if (!s.fechaIngreso && !s.fechaNombramiento) return false;
            const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
            const inicio = new Date(iStr);
            const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
            return searchDate >= inicio && searchDate <= fin;
        });

        if (found) return cleanTitle(`${found.nombre} ${found.apellido || ''}`).toUpperCase();
        return null;
    };

    // --- 3. PROCESAMIENTO Y LECTURA INTELIGENTE DEL ARCHIVO ---
    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        // 🚀 IDENTIFICADOR DEL ARCHIVO EXACTO
        const fileName = selectedFile.name.toUpperCase();
        let detectedType = null;
        
        // Bloqueo Inteligente de nombres de archivo
        if (fileName === 'CONFIRMA.JSON') {
            detectedType = 'CONFIRMA';
        } else if (fileName === 'INSCONFI.JSON') {
            detectedType = 'INSCONFI';
        } else {
            toast({ 
                title: "Archivo No Permitido", 
                description: `El archivo "${selectedFile.name}" no es válido. Renómbralo a CONFIRMA.json o INSCONFI.json`, 
                variant: "destructive" 
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setFileType(detectedType);
        setIsProcessing(true);
        setValidationResult(null);
        setImportComplete(false);

        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                const rawData = Array.isArray(json) ? json : (json.data || []);
                
                if (rawData.length === 0) throw new Error("El archivo no contiene registros válidos para procesar.");

                let existingKeys = new Set();
                
                // 🚀 CARGA DE DUPLICADOS DEPENDIENDO DEL ARCHIVO
                if (detectedType === 'CONFIRMA') {
                    // Busca duplicados en el Libro Oficial
                    const { data: existingData, error: dbError } = await supabase
                        .from('confirmations')
                        .select('book_number, folio, number')
                        .eq('parish_id', parishId);

                    if (dbError) throw new Error("Fallo de conexión con la Base de Datos Central.");
                    
                    (existingData || []).forEach(b => {
                        const l = String(b.book_number || '').padStart(4, '0');
                        const f = String(b.folio || '').padStart(4, '0');
                        const n = String(b.number || '').padStart(4, '0');
                        existingKeys.add(`LFN-${l}-${f}-${n}`);
                    });
                } else if (detectedType === 'INSCONFI') {
                    // Busca duplicados en la Cola de Espera / Boletas Emitidas
                    const { data: pendingData, error: pError } = await supabase
                        .from('pending_confirmations')
                        .select('numero_registro, raw_data')
                        .eq('parish_id', parishId);

                    if (pError) throw new Error("Fallo de conexión al buscar inscripciones previas.");

                    (pendingData || []).forEach(p => {
                        if (p.numero_registro) {
                            existingKeys.add(`REG-${p.numero_registro}`);
                        }
                        // Escudo adicional: Buscar por Nombre y Apellido
                        const raw = typeof p.raw_data === 'string' ? JSON.parse(p.raw_data) : (p.raw_data || {});
                        const n = String(raw.NOMBRES || raw.nombres || '').trim().toUpperCase();
                        const a = String(raw.APELLIDOS || raw.apellidos || '').trim().toUpperCase();
                        if (n && a) {
                            existingKeys.add(`NAME-${n}-${a}`);
                        }
                    });
                }

                const processed = [];
                const errors = [];
                const warnings = [];
                const internalKeys = new Set();
                let validCount = 0;

                rawData.forEach((item, index) => {
                    const rowNum = index + 1;
                    
                    // 🚀 Analiza REPORTADO (O SENTADO como fallback por compatibilidad)
                    const isReportado = item["REPORTADO"] === true || String(item["REPORTADO"]).toUpperCase() === 'TRUE' || item["SENTADO"] === true || String(item["SENTADO"]).toUpperCase() === 'TRUE';
                    const destinoStr = detectedType === 'CONFIRMA' ? 'oficial' : (isReportado ? 'boleta' : 'cola');
                    
                    const mappedItem = {
                        numeroRegistro: item["Nº REGISTRO PREVIO"] || item.numeroRegistro || '',
                        fechaInscripcion: item["FECHA DE INSCRIPCIÓN"] || item.fechaInscripcion || '',
                        Libro: item["LIBRO"] || item.Libro || item.libro || '---',
                        folio: item["FOLIO"] || item.folio || '---',
                        numero: item["NÚMERO"] || item.numero || item.numeroActa || '---',
                        fechaSacramento: item["FECHA DE CONFIRMACIÓN"] || item.fechaSacramento || '',
                        lugarSacramento: item["LUGAR DE CONFIRMACION"] || item["LUGAR"] || item.lugarSacramento || '',
                        apellidos: item["APELLIDOS"] || item.apellidos || '',
                        nombres: item["NOMBRES"] || item.nombres || '',
                        fechaNacimiento: item["FECHA DE NACIMIENTO"] || item.fechaNacimiento || '',
                        edad: item["EDAD"] || item.edad || '',
                        sexo: item["SEXO"] || item.sexo || '',
                        codigoBautizo: item["CODIGO DE BAUTIZO"] || item.codigoBautizo || '',
                        lugarBautismo: item["LUGAR DE BAUTISMO"] || item.lugarBautismo || '',
                        libroBautismo: item["LIBRO DE BAUTIZO"] || item.libroBautismo || '',
                        folioBautismo: item["FOLIO DE BAUTIZO"] || item.folioBautismo || '',
                        numeroBautismo: item["NÚMERO DE BAUTIZO"] || item.numeroBautismo || '',
                        nombrePadre: item["NOMBRE DEL PADRE"] || item.nombrePadre || '',
                        nombreMadre: item["NOMBRE DE LA MADRE"] || item.nombreMadre || '',
                        padrinos: item["PADRINO / MADRINA"] || item.padrinos || '',
                        direccion: item["DIRECCION"] || item.direccion || '',
                        responsable: item["RESPONSABLE"] || item.responsable || '',
                        ministro: item["MINISTRO"] || item.ministro || '',
                        daFe: item["DA FE"] || item.daFe || '',
                        notaMarginal: item["NOTAS MARGINALES"] || item.notaMarginal || '',
                        reportado: isReportado
                    };

                    const sacerdoteEpoca = getHistoricalPriest(mappedItem.fechaSacramento);

                    // Reparación del Ministro
                    let minClean = cleanTitle(mappedItem.ministro);
                    if (!minClean || minClean === '---' || !isNaN(Number(minClean))) {
                        mappedItem.ministro = sacerdoteEpoca || '';
                    } else {
                        let original = String(mappedItem.ministro).toUpperCase();
                        if (original.includes('PBRO') || original.includes('PADRE') || original.includes('FRAY') || original.includes('SACERDOTE')) {
                            mappedItem.ministro = `PBRO. ${minClean}`;
                        } else {
                            mappedItem.ministro = `MONS. ${minClean}`;
                        }
                    }

                    // Reparación de Da Fe
                    let rawDaFe = String(mappedItem.daFe).trim();
                    if (!rawDaFe || rawDaFe === '---' || rawDaFe.includes('ENCARGADO') || !isNaN(Number(rawDaFe))) {
                        rawDaFe = sacerdoteEpoca || parrocoActual;
                    } else {
                        rawDaFe = cleanTitle(rawDaFe).toUpperCase();
                    }

                    mappedItem.daFe = rawDaFe !== 'EL PÁRROCO' ? `PBRO. ${rawDaFe}` : rawDaFe;

                    const cleanItem = purificarRegistroConfirmacion(mappedItem);
                    
                    // Restaurar metadatos cruciales
                    cleanItem.reportado = isReportado;
                    cleanItem.destino = destinoStr;
                    cleanItem.rawOriginal = item;

                    const nombreConfirmado = `${cleanItem.nombres} ${cleanItem.apellidos}`.trim();

                    if (!cleanItem.nombres || !cleanItem.apellidos) {
                        errors.push(`Fila ${rowNum}: Faltan Nombres o Apellidos críticos.`);
                    } else if (detectedType === 'CONFIRMA') {
                        // 🚀 REGLAS DE DUPLICADOS PARA CONFIRMA.JSON
                        const keyConfirmaciones = `LFN-${cleanItem.Libro}-${cleanItem.folio}-${cleanItem.numero}`;
                        
                        if (cleanItem.Libro === '0000' || !cleanItem.Libro || cleanItem.Libro === '---') {
                            errors.push(`Fila ${rowNum}: Faltan datos críticos (Libro/Folio).`);
                        } else if (existingKeys.has(keyConfirmaciones)) {
                            warnings.push(`Fila ${rowNum}: Omitido "${nombreConfirmado}" (El acta L:${cleanItem.Libro} F:${cleanItem.folio} N:${cleanItem.numero} ya existe en la Nube).`);
                        } else if (internalKeys.has(keyConfirmaciones)) {
                            warnings.push(`Fila ${rowNum}: Omitido "${nombreConfirmado}" (Acta repetida dentro de este mismo archivo).`);
                        } else {
                            processed.push(cleanItem);
                            internalKeys.add(keyConfirmaciones);
                            validCount++;
                        }
                    } else if (detectedType === 'INSCONFI') {
                        // 🚀 REGLAS DE DUPLICADOS PARA INSCONFI.JSON
                        const keyReg = `REG-${cleanItem.numeroRegistro}`;
                        const keyName = `NAME-${cleanItem.nombres}-${cleanItem.apellidos}`;
                        
                        const isDupeInDB = (cleanItem.numeroRegistro && existingKeys.has(keyReg)) || existingKeys.has(keyName);
                        const isDupeInFile = (cleanItem.numeroRegistro && internalKeys.has(keyReg)) || internalKeys.has(keyName);

                        if (isDupeInDB) {
                            warnings.push(`Fila ${rowNum}: Omitido "${nombreConfirmado}" (Esta inscripción ya fue subida a la Nube previamente).`);
                        } else if (isDupeInFile) {
                            warnings.push(`Fila ${rowNum}: Omitido "${nombreConfirmado}" (Inscripción repetida dentro de este mismo archivo).`);
                        } else {
                            processed.push(cleanItem);
                            if (cleanItem.numeroRegistro) internalKeys.add(keyReg);
                            internalKeys.add(keyName);
                            validCount++;
                        }
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

    // --- 4. INYECCIÓN BIFURCADA (MAGIA TRIFÁSICA) ---
    const handleImport = async () => {
        if (!validationResult || validationResult.dataToImport.length === 0) return;
        setIsProcessing(true);

        const cleanDate = (d) => (d && String(d).trim() !== '' && String(d).trim() !== '---') ? d : null;

        try {
            const batchSize = 200;

            if (fileType === 'CONFIRMA') {
                // 🚀 ARCHIVO: CONFIRMA.json -> VA A LA TABLA OFICIAL PERMANENTE
                const dbRecords = validationResult.dataToImport.map(item => {
                    const { rawOriginal, destino, reportado, ...cleanMappedData } = item;
                    
                    return {
                        id: generateUUID(),
                        parish_id: parishId,
                        book_number: item.Libro,
                        folio: item.folio,
                        number: item.numero,
                        numero_registro: item.numeroRegistro || null,
                        status: 'seated', 
                        celebration_date: cleanDate(item.fechaSacramento),
                        lugar_bautismo: item.lugarBautismo || null,
                        apellidos: item.apellidos || null,
                        nombres: item.nombres || null,
                        sexo: item.sexo || null,
                        fecha_nacimiento: cleanDate(item.fechaNacimiento),
                        nombre_padre: item.nombrePadre || null,
                        nombre_madre: item.nombreMadre || null,
                        padrinos: item.padrinos || null,
                        ministro: item.ministro || null,
                        da_fe: item.daFe || null,
                        nota_marginal: item.notaMarginal || null,
                        // Fusión para el respaldo histórico
                        raw_data: { ...rawOriginal, ...cleanMappedData }, 
                        created_at: new Date().toISOString()
                    };
                });

                for (let i = 0; i < dbRecords.length; i += batchSize) {
                    const batch = dbRecords.slice(i, i + batchSize);
                    const { error } = await supabase.from('confirmations').insert(batch);
                    if (error) throw error;
                }

                toast({ 
                    title: "¡Importación de Libros Exitosa!", 
                    description: `${dbRecords.length} Actas Viejas inyectadas directamente en la Base Permanente.`, 
                    className: "bg-green-50 border-green-200 text-green-900" 
                });

            } else if (fileType === 'INSCONFI') {
                // 🚀 ARCHIVO: INSCONFI.json -> VA A LA TABLA DE ESPERA (Boletas o Cola)
                const pendingRecords = validationResult.dataToImport.map(item => {
                    const { rawOriginal, destino, reportado, ...cleanMappedData } = item;
                    
                    return {
                        id: generateUUID(),
                        parish_id: parishId,
                        // Fusión para que el Ticket pueda leer los datos mapeados en minúscula
                        raw_data: { ...rawOriginal, ...cleanMappedData }, 
                        status: item.destino === 'boleta' ? 'seated' : 'pending',
                        reportado: item.reportado, 
                        created_at: item.rawOriginal["FECHA DE INSCRIPCIÓN"] ? new Date(item.rawOriginal["FECHA DE INSCRIPCIÓN"]).toISOString() : new Date().toISOString()
                    };
                });

                for (let i = 0; i < pendingRecords.length; i += batchSize) {
                    const batch = pendingRecords.slice(i, i + batchSize);
                    const { error } = await supabase.from('pending_confirmations').insert(batch);
                    if (error) throw error;
                }

                const totalReported = pendingRecords.filter(r => r.reportado).length;
                const totalQueue = pendingRecords.length - totalReported;

                toast({ 
                    title: "¡Inscripciones Procesadas!", 
                    description: `${totalReported} a Boletas Emitidas y ${totalQueue} a la Cola de Espera.`, 
                    className: "bg-green-50 border-green-200 text-green-900" 
                });
            }

            setImportComplete(true);

        } catch (err) {
            toast({ title: "Fallo de Inyección", description: err.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const resetImporter = () => {
        setValidationResult(null);
        setFileType(null);
        setImportComplete(false);
    };

    const getColumnsByType = () => {
        if (fileType === 'CONFIRMA') {
            return [
                { header: 'Destino', render: () => <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-2 py-1 rounded uppercase flex items-center w-max gap-1"><Database className="w-3 h-3"/>Libro Oficial</span> },
                { header: 'Confirmado', render: r => <span className="font-bold uppercase text-slate-800">{r.apellidos} {r.nombres}</span> },
                { header: 'Ubicación (L:F:N)', render: r => <span className="font-mono text-red-600 font-black">{r.Libro}:{r.folio}:{r.numero}</span> }
            ];
        } else {
            return [
                { header: 'Destino', render: r => r.destino === 'boleta' ? <span className="bg-red-100 text-red-700 font-black text-[9px] px-2 py-1 rounded uppercase flex items-center w-max gap-1"><FileText className="w-3 h-3"/>Boleta Emitida</span> : <span className="bg-amber-100 text-amber-700 font-black text-[9px] px-2 py-1 rounded uppercase flex items-center w-max gap-1"><LayoutList className="w-3 h-3"/>A la Cola</span> },
                { header: 'Confirmado', render: r => <span className="font-bold uppercase text-slate-800">{r.apellidos} {r.nombres}</span> },
                { header: 'Nº Registro', render: r => <span className="font-mono text-red-600 font-black">#{r.numeroRegistro || 'S/N'}</span> }
            ];
        }
    };

    const hasErrors = validationResult?.errors?.length > 0;
    const canConfirm = validationResult && validationResult.count > 0 && !hasErrors && !isProcessing && !importComplete;

    const totalOficial = validationResult ? validationResult.dataToImport.filter(i => i.destino === 'oficial').length : 0;
    const totalBoletas = validationResult ? validationResult.dataToImport.filter(i => i.destino === 'boleta').length : 0;
    const totalCola = validationResult ? validationResult.dataToImport.filter(i => i.destino === 'cola').length : 0;

    return (
        <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-12 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-[#D4AF37]"></div>

            <div className="flex flex-col xl:flex-row gap-10 items-start">
                
                <div className="w-full xl:w-1/3">
                    <label className={cn(
                        "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all relative overflow-hidden",
                        validationResult ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-gray-50 hover:bg-red-50/50 hover:border-red-600"
                    )}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><FileJson className="w-40 h-40" /></div>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10 text-center px-4">
                            {isProcessing ? (
                                <Loader2 className="w-12 h-12 mb-4 text-red-600 animate-spin" />
                            ) : validationResult ? (
                                <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                            ) : (
                                <Upload className="w-12 h-12 mb-4 text-gray-400 group-hover:text-red-600" />
                            )}
                            
                            <p className="text-sm font-black text-gray-700 uppercase tracking-tight">
                                {isProcessing ? 'Procesando Archivo...' : validationResult ? 'Archivo Cargado' : 'Seleccionar JSON'}
                            </p>
                            {!validationResult && !isProcessing && (
                                <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest leading-relaxed">
                                    Formatos admitidos: <br/><span className="text-red-600">CONFIRMA.json</span> o <span className="text-red-600">INSCONFI.json</span>
                                </p>
                            )}
                        </div>
                        <input type="file" className="hidden" accept=".json" onChange={handleFileChange} disabled={isProcessing} ref={fileInputRef} />
                    </label>
                </div>

                <div className="w-full xl:w-2/3 space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-50 p-2 rounded-xl"><Database className="w-5 h-5 text-red-600" /></div>
                            <div>
                                <h3 className="font-black text-gray-900 uppercase text-sm tracking-widest">Motor de Inyección</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">
                                    {fileType === 'CONFIRMA' ? 'Inyección Directa a Libros Físicos' : fileType === 'INSCONFI' ? 'Enrutador de Inscripciones de Despacho' : 'Sincronización Inteligente'}
                                </p>
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
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">El sistema detectará el tipo de archivo por su nombre y lo enrutará.</p>
                        </div>
                    )}

                    {validationResult && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* ESTADÍSTICAS DINÁMICAS SEGÚN EL ARCHIVO */}
                            {fileType === 'CONFIRMA' ? (
                                <div className="grid grid-cols-3 gap-4">
                                    <StatCard label="Libro Oficial" val={totalOficial} color="emerald" />
                                    <StatCard label="Errores" val={validationResult.errors.length} color="red" />
                                    <StatCard label="Omitidos" val={validationResult.warnings.length} color="amber" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <StatCard label="Boletas Listas" val={totalBoletas} color="red" />
                                    <StatCard label="A La Cola" val={totalCola} color="amber" />
                                    <StatCard label="Errores" val={validationResult.errors.length} color="red" />
                                    <StatCard label="Omitidos" val={validationResult.warnings.length} color="amber" />
                                </div>
                            )}

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
                                    className="w-full py-8 bg-gradient-to-r from-red-600 to-[#8b0000] hover:shadow-xl text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all transform active:scale-95 disabled:opacity-50"
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Database className="w-5 h-5 mr-3" />}
                                    {isProcessing ? 'Inyectando a la Nube...' : importComplete ? 'Importación Finalizada' : `Procesar e Inyectar ${validationResult.count} Registros`}
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
                            <Info className="w-4 h-4 text-red-600" /> Vista Previa de Asignación Automática (Top 5)
                        </span>
                    </div>
                    <div className="border border-gray-100 rounded-b-3xl overflow-hidden bg-white shadow-sm">
                        <Table columns={getColumnsByType()} data={validationResult.dataToImport.slice(0, 5)} />
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, val, color }) => {
    const colors = {
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
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

export default ConfirmationJsonImporter;