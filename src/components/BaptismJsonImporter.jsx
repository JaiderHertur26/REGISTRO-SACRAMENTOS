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

const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
};

// 🚀 Utilidad para asegurar el mismo formato de Libro/Folio/Numero al comparar con la DB
const padDbValue = (val) => {
    if (val === null || val === undefined) return '---';
    const str = String(val).trim();
    return (str !== '' && !isNaN(str)) ? str.padStart(4, '0') : (str || '---');
};

const BaptismJsonImporter = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { getParrocos, purificarRegistroBautismo } = useAppData();
    const fileInputRef = useRef(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [fileType, setFileType] = useState(null); // 🚀 GUARDA SI ES 'BAUTIZOS' o 'INSBAUTI'
    
    const [parrocoActual, setParrocoActual] = useState('');
    const [listaSacerdotes, setListaSacerdotes] = useState([]);

    const parishId = user?.parish_id || user?.parishId;

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

    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        // 🚀 1. IDENTIFICADOR DEL ARCHIVO
        const fileName = selectedFile.name.toUpperCase();
        let detectedType = null;
        
        if (fileName.includes('BAUTIZOS')) {
            detectedType = 'BAUTIZOS';
        } else if (fileName.includes('INSBAUTI')) {
            detectedType = 'INSBAUTI';
        } else {
            toast({ 
                title: "Archivo No Permitido", 
                description: `El archivo "${selectedFile.name}" no es válido. Renómbralo a BAUTIZOS.json o INSBAUTI.json`, 
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
                
                if (rawData.length === 0) throw new Error("El archivo no contiene registros válidos.");

                let existingKeys = new Set();
                let existingInsbautiKeys = new Set();
                
                // 🚀 BUSCAMOS DUPLICADOS EN LA BASE DE DATOS SEGÚN EL TIPO DE ARCHIVO
                if (detectedType === 'BAUTIZOS') {
                    const { data: existingData, error: dbError } = await supabase
                        .from('baptisms')
                        .select('book_number, folio, number')
                        .eq('parish_id', parishId);

                    if (dbError) throw new Error("Fallo de conexión con la Base de Datos Central.");
                    
                    // Aplicamos padDbValue para igualar formato "1" a "0001"
                    existingKeys = new Set((existingData || []).map(b => 
                        `${padDbValue(b.book_number)}-${padDbValue(b.folio)}-${padDbValue(b.number)}`
                    ));
                } else if (detectedType === 'INSBAUTI') {
                    // Validamos con la tabla de espera para no subir INSBAUTI duplicados
                    const { data: existingData, error: dbError } = await supabase
                        .from('pending_baptisms')
                        .select('raw_data')
                        .eq('parish_id', parishId);

                    if (dbError) throw new Error("Fallo de conexión con la Base de Datos de Espera.");

                    existingInsbautiKeys = new Set((existingData || []).map(b => {
                        const raw = b.raw_data || {};
                        return raw.numeroRegistro || `${raw.nombres}-${raw.apellidos}`;
                    }));
                }

                const processed = [];
                const errors = [];
                const warnings = [];
                const internalKeys = new Set();
                let validCount = 0;

                rawData.forEach((item, index) => {
                    const rowNum = index + 1;
                    
                    // Verificamos si dice true. Si no existe, es false.
                    const isReportado = item["REPORTADO"] === true || String(item["REPORTADO"]).toUpperCase() === 'TRUE';
                    const destinoStr = detectedType === 'BAUTIZOS' ? 'oficial' : (isReportado ? 'boleta' : 'cola');

                    const mappedItem = {
                        numeroRegistro: item["Nº REGISTRO PREVIO"] || item.numeroRegistro || '',
                        fechaInscripcion: item["FECHA DE INSCRIPCION"] || item.fechaInscripcion || '',
                        Libro: item["LIBRO N°"] || item["LIBRO"] || item.Libro || item.libro || '---',
                        folio: item["FOLIO N°"] || item["FOLIO"] || item.folio || '---',
                        numero: item["NÚMERO N°"] || item["NÚMERO"] || item.numero || item.numeroActa || '---',
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
                        direccion: item["DIRECCION"] || item.direccion || '',
                        responsable: item["RESPONSABLE"] || item.responsable || '',
                        ministro: item["MINISTRO"] || item.ministro || '',
                        daFe: item["DA FE"] || item.daFe || '',
                        serialRegistro: item["REGISTRO CIVIL"] || item.serialRegistro || '',
                        nuip: item["NUIP"] || item.nuip || '',
                        oficinaRegistro: item["NOTARIA"] || item.oficinaRegistro || '',
                        fechaExpedicionRegistro: item["FECHA DE REGISTRO"] || item.fechaExpedicionRegistro || '',
                        notaMarginal: item["NOTAS MARGINALES"] || item.notaMarginal || ''
                    };

                    const sacerdoteEpoca = getHistoricalPriest(mappedItem.fechaSacramento);

                    if (!mappedItem.ministro || mappedItem.ministro === '---' || !isNaN(Number(mappedItem.ministro))) {
                        mappedItem.ministro = sacerdoteEpoca || '';
                    } else {
                        mappedItem.ministro = cleanTitle(mappedItem.ministro).toUpperCase();
                    }

                    let rawDaFe = String(mappedItem.daFe).trim();
                    if (!rawDaFe || rawDaFe === '---' || rawDaFe.includes('ENCARGADO') || !isNaN(Number(rawDaFe))) {
                        rawDaFe = mappedItem.ministro || sacerdoteEpoca || parrocoActual;
                    } else {
                        rawDaFe = cleanTitle(rawDaFe).toUpperCase();
                    }

                    mappedItem.daFe = rawDaFe !== 'EL PÁRROCO' ? `PBRO. ${rawDaFe}` : rawDaFe;
                    if (mappedItem.ministro && mappedItem.ministro !== 'EL PÁRROCO') {
                        mappedItem.ministro = `PBRO. ${mappedItem.ministro}`;
                    }

                    const cleanItem = purificarRegistroBautismo(mappedItem);
                    
                    // Restaurar los valores y el JSON crudo original
                    cleanItem.reportado = isReportado;
                    cleanItem.destino = destinoStr;
                    cleanItem.rawOriginal = item;

                    const keyBautizos = `${cleanItem.Libro}-${cleanItem.folio}-${cleanItem.numero}`;
                    const keyInsbauti = cleanItem.numeroRegistro || `${cleanItem.nombres}-${cleanItem.apellidos}`;
                    const nombreBautizado = `${cleanItem.nombres} ${cleanItem.apellidos}`.trim();

                    if (!cleanItem.nombres || !cleanItem.apellidos) {
                        errors.push(`Fila ${rowNum}: Faltan Nombres o Apellidos críticos.`);
                    } else if (detectedType === 'BAUTIZOS') {
                        // REGLAS BAUTIZOS (Libro Oficial)
                        if (cleanItem.Libro === '0000' || !cleanItem.Libro || cleanItem.Libro === '---') {
                            errors.push(`Fila ${rowNum}: Faltan datos críticos (Libro/Folio).`);
                        } else if (existingKeys.has(keyBautizos) || internalKeys.has(keyBautizos)) {
                            warnings.push(`Fila ${rowNum}: Omitido "${nombreBautizado}" (El acta L:${cleanItem.Libro} F:${cleanItem.folio} N:${cleanItem.numero} ya existe en el sistema o archivo).`);
                        } else {
                            processed.push(cleanItem);
                            internalKeys.add(keyBautizos);
                            validCount++;
                        }
                    } else if (detectedType === 'INSBAUTI') {
                        // REGLAS INSBAUTI (Inscripciones de Despacho) - ¡AHORA VALIDA CON BD!
                        if (internalKeys.has(keyInsbauti) || existingInsbautiKeys.has(keyInsbauti)) {
                            warnings.push(`Fila ${rowNum}: Omitido "${nombreBautizado}" (La inscripción ya existe en la base de datos o está duplicada en este archivo).`);
                        } else {
                            processed.push(cleanItem);
                            internalKeys.add(keyInsbauti);
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

    // --- 4. INYECCIÓN BIFURCADA SEGÚN EL ARCHIVO ---
    const handleImport = async () => {
        if (!validationResult || validationResult.dataToImport.length === 0) return;
        setIsProcessing(true);

        const cleanDate = (d) => (d && String(d).trim() !== '' && String(d).trim() !== '---') ? d : null;

        try {
            const batchSize = 200;

            if (fileType === 'BAUTIZOS') {
                // 🚀 ARCHIVO: BAUTIZOS.json -> VA A LA TABLA OFICIAL PERMANENTE
                const dbRecords = validationResult.dataToImport.map(item => {
                    // Extraemos las variables internas para que no ensucien la BD
                    const { rawOriginal, destino, reportado, hasReportadoKey, ...cleanMappedData } = item;
                    
                    return {
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
                        // 🚀 SOLUCIÓN MAGISTRAL: Fusionamos el Excel Original CON las variables limpias en minúscula
                        raw_data: { ...rawOriginal, ...cleanMappedData }, 
                        created_at: new Date().toISOString()
                    };
                });

                for (let i = 0; i < dbRecords.length; i += batchSize) {
                    const batch = dbRecords.slice(i, i + batchSize);
                    const { error } = await supabase.from('baptisms').insert(batch);
                    if (error) throw error;
                }

                toast({ 
                    title: "¡Importación de Libros Exitosa!", 
                    description: `${dbRecords.length} Actas Viejas inyectadas directamente en la Base Permanente.`, 
                    className: "bg-green-50 border-green-200 text-green-900" 
                });

            } else if (fileType === 'INSBAUTI') {
                // 🚀 ARCHIVO: INSBAUTI.json -> VA A LA TABLA DE ESPERA (Boletas o Cola)
                const pendingRecords = validationResult.dataToImport.map(item => {
                    const { rawOriginal, destino, reportado, hasReportadoKey, ...cleanMappedData } = item;
                    
                    return {
                        id: generateUUID(),
                        parish_id: parishId,
                        // 🚀 SOLUCIÓN MAGISTRAL: Fusionamos para que el Ticket pueda leer los datos en minúscula
                        raw_data: { ...rawOriginal, ...cleanMappedData }, 
                        status: item.destino === 'boleta' ? 'seated' : 'pending',
                        reportado: item.reportado, 
                        created_at: item.rawOriginal["FECHA DE INSCRIPCION"] ? new Date(item.rawOriginal["FECHA DE INSCRIPCION"]).toISOString() : new Date().toISOString()
                    };
                });

                for (let i = 0; i < pendingRecords.length; i += batchSize) {
                    const batch = pendingRecords.slice(i, i + batchSize);
                    const { error } = await supabase.from('pending_baptisms').insert(batch);
                    if (error) throw error;
                }

                const totalReported = pendingRecords.filter(r => r.reportado).length;
                const totalQueue = pendingRecords.length - totalReported;

                toast({ 
                    title: "¡Inscripciones Procesadas!", 
                    description: `${totalReported} generarán Boletas y ${totalQueue} fueron a la Cola.`, 
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
        if (fileType === 'BAUTIZOS') {
            return [
                { header: 'Destino', render: () => <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-2 py-1 rounded uppercase flex items-center w-max gap-1"><Database className="w-3 h-3"/>Libro Oficial</span> },
                { header: 'Bautizado', render: r => <span className="font-bold uppercase text-slate-800">{r.apellidos} {r.nombres}</span> },
                { header: 'Ubicación (L:F:N)', render: r => <span className="font-mono text-[#4B7BA7] font-black">{r.Libro}:{r.folio}:{r.numero}</span> }
            ];
        } else {
            return [
                { header: 'Destino', render: r => r.destino === 'boleta' ? <span className="bg-blue-100 text-blue-700 font-black text-[9px] px-2 py-1 rounded uppercase flex items-center w-max gap-1"><FileText className="w-3 h-3"/>Boleta Emitida</span> : <span className="bg-amber-100 text-amber-700 font-black text-[9px] px-2 py-1 rounded uppercase flex items-center w-max gap-1"><LayoutList className="w-3 h-3"/>A la Cola</span> },
                { header: 'Bautizado', render: r => <span className="font-bold uppercase text-slate-800">{r.apellidos} {r.nombres}</span> },
                { header: 'Nº Registro', render: r => <span className="font-mono text-[#4B7BA7] font-black">#{r.numeroRegistro || 'S/N'}</span> }
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
                                <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest leading-relaxed">
                                    Formatos admitidos: <br/><span className="text-[#4B7BA7]">BAUTIZOS.json</span> o <span className="text-[#4B7BA7]">INSBAUTI.json</span>
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
                                <h3 className="font-black text-gray-900 uppercase text-sm tracking-widest">Motor de Inyección</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">
                                    {fileType === 'BAUTIZOS' ? 'Inyección Directa a Libros Físicos' : fileType === 'INSBAUTI' ? 'Enrutador de Inscripciones de Despacho' : 'Sincronización Inteligente'}
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
                            {fileType === 'BAUTIZOS' ? (
                                <div className="grid grid-cols-3 gap-4">
                                    <StatCard label="Libro Oficial" val={totalOficial} color="emerald" />
                                    <StatCard label="Errores" val={validationResult.errors.length} color="red" />
                                    <StatCard label="Omitidos" val={validationResult.warnings.length} color="amber" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <StatCard label="Boletas Listas" val={totalBoletas} color="blue" />
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
                                    className="w-full py-8 bg-gradient-to-r from-[#4B7BA7] to-[#3A6286] hover:shadow-xl text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all transform active:scale-95 disabled:opacity-50"
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
                            <Info className="w-4 h-4 text-[#4B7BA7]" /> Vista Previa de Asignación (Top 5)
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
        blue: "bg-blue-50 border-blue-100 text-[#4B7BA7]",
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