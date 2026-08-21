import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Upload, FileJson, AlertCircle, CheckCircle, 
    Database, ServerCrash, HelpCircle, X, Loader2, RefreshCcw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext'; 
import { useAppData } from '@/context/AppDataContext'; 
import { supabase } from '@/lib/supabaseClient'; 
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { marginalNotesEngine } from '@/utils/marginalNotesEngine';
import Table from '@/components/ui/Table';

const DecreeJsonImporter = () => {
    const { toast } = useToast();
    const { user } = useAuth(); 
    const { getMisDatosList, getParrocoActual } = useAppData(); 
    
    const [file, setFile] = useState(null);
    const [records, setRecords] = useState([]);
    const [validationStats, setValidationStats] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [showHelp, setShowHelp] = useState(false);

    const fileInputRef = useRef(null);

    const pad = (num) => String(num || '').trim().padStart(4, '0');

    // 🚀 TRADUCTORES DE CÓDIGOS HEREDADOS (DBF a TEXTO FORMAL)
    const parseSex = (val) => {
        const v = String(val).trim();
        if (v === '1') return 'MASCULINO';
        if (v === '2') return 'FEMENINO';
        return val || '';
    };

    const parseUnion = (val) => {
        const v = String(val).trim();
        if (v === '1') return 'MATRIMONIO CATÓLICO';
        if (v === '2') return 'MATRIMONIO CIVIL';
        if (v === '3') return 'UNIÓN LIBRE';
        if (v === '4') return 'MADRE SOLTERA';
        if (v === '5') return 'OTRO CASO';
        return val || '';
    };

    const extractField = (item, possibleKeys) => {
        for (let key of possibleKeys) {
            if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') return String(item[key]).trim();
            if (item[key.toUpperCase()] !== undefined && item[key.toUpperCase()] !== null && String(item[key.toUpperCase()]).trim() !== '') return String(item[key.toUpperCase()]).trim();
        }
        return null;
    };

    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                const data = Array.isArray(json) ? json : (json.data || []);
                if (data.length === 0) throw new Error("El archivo JSON está vacío.");

                setIsProcessing(true);
                const parishId = user?.parishId || user?.parish_id;

                const { data: allBaptisms, error: bapError } = await supabase
                    .from('baptisms')
                    .select('id, book_number, folio, number, raw_data, nombres, apellidos, da_fe')
                    .eq('parish_id', parishId);
                
                if (bapError) throw bapError;

                const findBaptism = (targetL, targetF, targetN) => {
                    const padL = pad(targetL); const padF = pad(targetF); const padN = pad(targetN);
                    
                    return allBaptisms.find(b => {
                        const raw = typeof b.raw_data === 'string' ? JSON.parse(b.raw_data) : (b.raw_data || {});
                        const bL = pad(b.book_number || raw.Libro || raw.libro || raw.book_number);
                        const bF = pad(b.folio || raw.folio || raw.page_number);
                        const bN = pad(b.number || raw.numero || raw.numeroActa || raw.entry_number);
                        return bL === padL && bF === padF && bN === padN;
                    });
                };

                const processed = data.map((item, index) => {
                    const decreto = extractField(item, ['decreto']);
                    const fecha = extractField(item, ['fecha']);
                    const codConcepto = extractField(item, ['codiconcep', 'codigo']);
                    
                    const oldLib = extractField(item, ['libro']);
                    const oldFol = extractField(item, ['folio']);
                    const oldNum = extractField(item, ['numero']);
                    
                    const newLib = extractField(item, ['newlib']);
                    const newFol = extractField(item, ['newfol']);
                    const newNum = extractField(item, ['newnum']);

                    const observaciones = extractField(item, ['observacio', 'observaciones']);
                    const dafeLegacy = extractField(item, ['dafe', 'ministro']);

                    const isReposicion = ['005', '001'].includes(codConcepto); 
                    
                    let errorMsg = "";
                    let isValid = true;
                    let origRec = null;
                    let newRec = null;

                    if (!decreto || !fecha) { errorMsg = "Falta No. Decreto o Fecha."; isValid = false; }
                    else if (!newLib || !newFol || !newNum) { errorMsg = "Falta ubicación supletoria (NEWLIB/NEWFOL/NEWNUM)."; isValid = false; }
                    else if (!isReposicion && (!oldLib || !oldFol || !oldNum)) { errorMsg = "Corrección requiere ubicación original completa."; isValid = false; }

                    if (isValid) {
                        newRec = findBaptism(newLib, newFol, newNum);
                        if (!newRec) {
                            errorMsg = `Partida supletoria (L:${pad(newLib)} F:${pad(newFol)} N:${pad(newNum)}) no migrada aún a la Nube.`;
                            isValid = false;
                        } else if (!isReposicion) {
                            origRec = findBaptism(oldLib, oldFol, oldNum);
                            if (!origRec) {
                                errorMsg = `Partida original (L:${pad(oldLib)} F:${pad(oldFol)} N:${pad(oldNum)}) no encontrada.`;
                                isValid = false;
                            }
                        }
                    }

                    return {
                        ...item, id: index, isReposicion,
                        decreto_clean: decreto, fecha_clean: fecha, cod_clean: codConcepto,
                        observaciones_clean: observaciones, dafe_clean: dafeLegacy,
                        sNewL: pad(newLib), sNewF: pad(newFol), sNewN: pad(newNum),
                        sOldL: pad(oldLib), sOldF: pad(oldFol), sOldN: pad(oldNum),
                        isValid, error: errorMsg,
                        _origRec: origRec, _newRec: newRec 
                    };
                });

                setRecords(processed);
                setValidationStats({
                    total: processed.length,
                    valid: processed.filter(r => r.isValid).length,
                    invalid: processed.filter(r => !r.isValid).length,
                    reposiciones: processed.filter(r => r.isValid && r.isReposicion).length,
                    correcciones: processed.filter(r => r.isValid && !r.isReposicion).length
                });
                setFile(selectedFile);
                setImportComplete(false);
                setProgress({ current: 0, total: 0 });

            } catch (error) {
                toast({ title: "Error Estructural", description: "Fallo al validar los datos contra la base de datos.", variant: "destructive" });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
        const validRecords = records.filter(r => r.isValid);
        if (!validRecords.length) return;
        
        setIsProcessing(true);
        const parishId = user?.parishId || user?.parish_id;
        const targetDioceseId = user?.dioceseId || user?.diocese_id;

        try {
            const parishInfo = getMisDatosList(parishId)[0] || {};
            const parishLabel = `${parishInfo.nombre || 'PARROQUIA'} - ${parishInfo.ciudad || ''}`.toUpperCase();

            const currentPriestObj = getParrocoActual(parishId);
            const defaultPriest = currentPriestObj 
                ? `PBRO. ${currentPriestObj.nombre} ${currentPriestObj.apellido || ''}`.trim().toUpperCase() 
                : 'EL PÁRROCO';

            const { data: allBaptisms, error: bapError } = await supabase
                .from('baptisms')
                .select('id, book_number, folio, number, raw_data, nombres, apellidos, da_fe, celebration_date, fecha_nacimiento, lugar_nacimiento, nombre_padre, nombre_madre, tipo_union_padres, abuelos_paternos, abuelos_maternos, padrinos, ministro')
                .eq('parish_id', parishId);
            
            if (bapError) throw bapError;

            const { data: catalogoConceptos } = await supabase
                .from('conceptos_anulacion')
                .select('id, codigo, concepto')
                .eq('diocese_id', targetDioceseId);

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < validRecords.length; i++) {
                const item = validRecords[i];
                setProgress({ current: i + 1, total: validRecords.length });

                try {
                    const conceptoObj = catalogoConceptos?.find(c => String(c.codigo) === item.cod_clean);
                    const conceptoId = conceptoObj ? conceptoObj.id : null;
                    const conceptoText = conceptoObj ? conceptoObj.concepto.toUpperCase() : "SOLICITUD DE PARTE";
                    const fechaTexto = convertDateToSpanishText(item.fecha_clean).replace(/^EL\s+/i, '').toUpperCase();

                    const newRec = item._newRec;
                    const origRec = item._origRec;

                    const rawNew = typeof newRec.raw_data === 'string' ? JSON.parse(newRec.raw_data) : (newRec.raw_data || {});
                    const rawOrig = origRec ? (typeof origRec.raw_data === 'string' ? JSON.parse(origRec.raw_data) : (origRec.raw_data || {})) : null;

                    const targetName = `${newRec.nombres || ''} ${newRec.apellidos || ''}`.trim().toUpperCase();

                    // 1. FIRMA INTELIGENTE
                    let validDaFe = defaultPriest;
                    const dbDafe = newRec.da_fe || rawNew?.daFe || rawNew?.dafe;
                    
                    if (dbDafe && isNaN(Number(String(dbDafe).trim()))) validDaFe = String(dbDafe).trim().toUpperCase();
                    else if (item.dafe_clean && isNaN(Number(String(item.dafe_clean).trim()))) validDaFe = String(item.dafe_clean).trim().toUpperCase();
                    if (!validDaFe.startsWith('PBRO') && validDaFe !== 'EL PÁRROCO') validDaFe = `PBRO. ${validDaFe}`;

                    // 🚀 2. EXTRACCIÓN DE DATOS COMPLETOS PARA EL PDF DEL DECRETO
                    const pdfData = {
                        fechaSacramento: rawNew.fechaSacramento || rawNew.fecbau || newRec.celebration_date || '',
                        sexo: parseSex(rawNew.sexo || rawNew.sex),
                        fechaNacimiento: rawNew.fechaNacimiento || rawNew.fecnac || newRec.fecha_nacimiento || '',
                        lugarNacimiento: rawNew.lugarNacimiento || rawNew.lugarn || newRec.lugar_nacimiento || '',
                        nombrePadre: rawNew.nombrePadre || rawNew.padre || newRec.nombre_padre || '',
                        nombreMadre: rawNew.nombreMadre || rawNew.madre || newRec.nombre_madre || '',
                        tipoUnionPadres: parseUnion(rawNew.tipoUnionPadres || rawNew.tipohijo || newRec.tipo_union_padres),
                        abuelosPaternos: rawNew.abuelosPaternos || rawNew.abuepat || newRec.abuelos_paternos || '',
                        abuelosMaternos: rawNew.abuelosMaternos || rawNew.abuemat || newRec.abuelos_maternos || '',
                        padrinos: rawNew.padrinos || newRec.padrinos || '',
                        ministro: (rawNew.ministro || newRec.ministro || '').toUpperCase(),
                        daFe: validDaFe
                    };

                    if (item.isReposicion) {
                        const noteRepo = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${item.decreto_clean.toUpperCase()} DE FECHA ${fechaTexto}, MOTIVO: ${conceptoText}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.`;
                        
                        const newUpdateData = { 
                            ...rawNew, isSupplementary: true, creadoPorDecreto: true, 
                            replacementDecreeRef: item.decreto_clean, notaMarginal: noteRepo, daFe: validDaFe 
                        };

                        await supabase.from('baptisms').update({ raw_data: newUpdateData, nota_marginal: noteRepo, da_fe: validDaFe }).eq('id', newRec.id);

                        const payloadDecree = {
                            decreeNumber: item.decreto_clean, numeroDecreto: item.decreto_clean, decreeDate: item.fecha_clean,
                            conceptoAnulacionId: conceptoId, causa: conceptoText, targetName: targetName,
                            observaciones: item.observaciones_clean || '', newPartidaId: newRec.id,
                            ...pdfData, // 🚀 INYECTAMOS LOS DATOS DEL PDF
                            datosNuevaPartida: { ...newUpdateData, book: item.sNewL, page: item.sNewF, entry: item.sNewN },
                            newPartidaSummary: { book: item.sNewL, page: item.sNewF, entry: item.sNewN, nombres: newRec.nombres, apellidos: newRec.apellidos }
                        };
                        
                        await supabase.from('decretos').insert([{ parish_id: parishId, tipo: 'reposicion', payload: payloadDecree }]);

                    } else {
                        const noteAnulada = marginalNotesEngine.forAnnulledCorrection(parishId, {
                            numeroDecreto: item.decreto_clean, fechaDecreto: item.fecha_clean,
                            libroNuevo: item.sNewL, folioNuevo: item.sNewF, numeroNuevo: item.sNewN
                        });

                        const noteNueva = marginalNotesEngine.forNewCorrection(parishId, {
                            numeroDecreto: item.decreto_clean, fechaDecreto: item.fecha_clean,
                            libroAnulada: item.sOldL, folioAnulada: item.sOldF, numeroAnulada: item.sOldN, ministro: validDaFe
                        });

                        const origUpdate = { ...rawOrig, isAnnulled: true, anulado: true, status: 'anulada', notaMarginal: noteAnulada };
                        await supabase.from('baptisms').update({ status: 'anulada', nota_marginal: noteAnulada, raw_data: origUpdate }).eq('id', origRec.id);

                        const newUpdate = { ...rawNew, isSupplementary: true, creadoPorDecreto: true, correctionDecreeRef: item.decreto_clean, notaMarginal: noteNueva, daFe: validDaFe };
                        await supabase.from('baptisms').update({ nota_marginal: noteNueva, raw_data: newUpdate, da_fe: validDaFe }).eq('id', newRec.id);

                        const payloadDecree = {
                            decreeNumber: item.decreto_clean, decreeDate: item.fecha_clean, conceptoAnulacionId: conceptoId,
                            targetName: `${origRec.nombres || ''} ${origRec.apellidos || ''}`.trim().toUpperCase(),
                            newTargetName: targetName, parroquia: parishLabel,
                            observaciones: item.observaciones_clean || '',
                            ...pdfData, // 🚀 INYECTAMOS LOS DATOS DEL PDF
                            originalPartidaId: origRec.id, newPartidaId: newRec.id,
                            originalPartidaSummary: { book: item.sOldL, page: item.sOldF, entry: item.sOldN, nombres: origRec.nombres, apellidos: origRec.apellidos },
                            newPartidaSummary: { book: item.sNewL, page: item.sNewF, entry: item.sNewN, nombres: newRec.nombres, apellidos: newRec.apellidos }
                        };

                        await supabase.from('decretos').insert([{ parish_id: parishId, tipo: 'correccion', payload: payloadDecree }]);
                    }
                    successCount++;
                } catch (err) {
                    item.error = "Fallo de comunicación en la inyección";
                    item.isValid = false;
                    errorCount++;
                }
            }

            setRecords([...records]);
            setImportComplete(true);

            if (errorCount === 0) {
                toast({ title: "Inyección Exitosa", description: `Se procesaron ${successCount} decretos perfectamente en la Nube.`, className: "bg-green-50 text-green-900 border-green-200" });
            } else {
                toast({ title: "Proceso Parcial", description: `Se inyectaron ${successCount} decretos. Hubo ${errorCount} errores de red. Revise la tabla.`, variant: "destructive" });
            }

        } catch (error) {
            toast({ title: "Error Crítico", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const columns = [
        { 
            header: 'Tipo', 
            render: r => r.isReposicion ? 
                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[9px] font-black tracking-widest border border-amber-200">REPOSICIÓN</span> : 
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[9px] font-black tracking-widest border border-blue-200">CORRECCIÓN</span> 
        },
        { header: 'No. Decreto', render: r => <span className="font-mono font-bold text-slate-700">{r.decreto_clean || '---'}</span> },
        { header: 'Ubicación Supletoria', render: r => <span className="font-mono text-[#4B7BA7] font-bold bg-blue-50 px-2 py-1 rounded">L:{r.sNewL || '-'} F:{r.sNewF || '-'} N:{r.sNewN || '-'}</span> },
        { header: 'Original (Afectada)', render: r => r.isReposicion ? <span className="text-slate-400 italic text-xs">No aplica</span> : <span className="font-mono text-red-500 font-bold bg-red-50 px-2 py-1 rounded">L:{r.sOldL || '-'} F:{r.sOldF || '-'} N:{r.sOldN || '-'}</span> },
        { 
            header: 'Validación en Nube', 
            render: r => r.isValid ? 
                <div className="flex items-center gap-1 text-green-600"><CheckCircle className="w-4 h-4"/><span className="text-[10px] font-bold">APTO</span></div> : 
                <div className="flex items-center gap-1 text-red-500"><ServerCrash className="w-4 h-4"/><span className="text-[9px] font-bold truncate max-w-[200px]" title={r.error}>{r.error}</span></div> 
        }
    ];

    return (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 space-y-10 shadow-sm relative">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
                <div className="flex items-center gap-5">
                    <div className="bg-gradient-to-br from-[#4B7BA7] to-[#2C3E50] p-4 rounded-2xl text-white shadow-lg shadow-blue-900/20">
                        <Database className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight font-serif">Motor de Inyección Masiva</h2>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Sincronización de Decretos Históricos</p>
                    </div>
                </div>
                
                <Button 
                    variant="outline" 
                    onClick={() => setShowHelp(true)}
                    className="rounded-xl border-blue-200 text-blue-600 font-bold uppercase text-[10px] tracking-widest hover:bg-blue-50 h-12 px-6"
                >
                    <HelpCircle className="w-4 h-4 mr-2" /> Ver Formato JSON Esperado
                </Button>
            </div>

            {showHelp && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-10 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Estructura del Archivo JSON (ANULACIO.DBF)</h3>
                        <Button variant="ghost" onClick={() => setShowHelp(false)} className="rounded-full p-2"><X className="w-6 h-6" /></Button>
                    </div>
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Exporta tu tabla de transacciones de anulaciones a JSON. El sistema buscará las columnas oficiales de tu base de datos anterior:
                    </p>
                    <div className="bg-slate-900 text-green-400 p-6 rounded-2xl font-mono text-sm overflow-auto flex-1 shadow-inner">
                        <pre>
{`{
  "data": [
    {
      "DECRETO": "015-2023",
      "FECHA": "2023-05-10",
      "CODICONCEP": "002",
      
      // Partida Original (Afectada)
      "LIBRO": "0001",
      "FOLIO": "0504",
      "NUMERO": "1007",
      
      // Partida Nueva (Supletoria)
      "NEWLIB": "0004",
      "NEWFOL": "0026",
      "NEWNUM": "0026",

      // Opcionales que el sistema leerá si existen
      "OBSERVACIO": "Anotaciones adicionales...",
      "DAFE": "PBRO. JUAN PEREZ"
    }
  ]
}`}
                        </pre>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setShowHelp(false)} className="bg-slate-800 text-white font-bold uppercase text-xs px-8 py-6 rounded-xl">Entendido</Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                <div className="xl:col-span-1">
                    <label className="flex flex-col items-center justify-center w-full h-[280px] border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer bg-slate-50 hover:bg-blue-50 hover:border-[#4B7BA7]/40 transition-all duration-300 group relative overflow-hidden">
                        
                        {isProcessing && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                <Loader2 className="w-12 h-12 text-[#4B7BA7] animate-spin mb-4" />
                                <span className="font-black text-[#4B7BA7] uppercase tracking-widest text-[10px]">
                                    {progress.total > 0 ? `Procesando ${progress.current} de ${progress.total}` : 'Leyendo y Validando Nube...'}
                                </span>
                                {progress.total > 0 && (
                                    <div className="w-1/2 bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <div className="bg-[#4B7BA7] h-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center text-center p-8">
                            <Upload className="w-14 h-14 mb-5 text-slate-300 group-hover:text-[#4B7BA7] transition-colors" />
                            <p className="text-sm font-black text-slate-700 uppercase tracking-widest">
                                {file ? file.name : 'Subir Archivo JSON'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-3 font-medium leading-relaxed max-w-[200px]">
                                Selecciona el archivo JSON con la exportación de tu tabla ANULACIO.
                            </p>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} disabled={isProcessing} />
                    </label>
                </div>

                <div className="xl:col-span-2 space-y-8 flex flex-col justify-center">
                    {validationStats ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="Total Leídos" val={validationStats.total} color="slate" />
                            <StatCard label="Aptos Inyección" val={validationStats.valid} color="green" />
                            <StatCard label="Errores" val={validationStats.invalid} color="red" />
                            <StatCard label="Decretos Válidos" val={validationStats.reposiciones + validationStats.correcciones} color="blue" />
                        </div>
                    ) : (
                        <div className="bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100 flex items-start gap-5 h-full">
                            <AlertCircle className="w-8 h-8 text-blue-500 shrink-0" />
                            <div className="space-y-2">
                                <h4 className="font-black text-blue-900 uppercase text-xs tracking-widest">Protección de Datos Activa</h4>
                                <p className="text-xs text-blue-800/80 leading-relaxed font-medium">
                                    El motor cruzará la información con la Nube de inmediato. Si los folios originales o supletorios declarados en el JSON no existen en la base de datos de Supabase, bloqueará ese registro para evitar corrupciones.
                                </p>
                            </div>
                        </div>
                    )}

                    {validationStats && validationStats.valid > 0 && (
                        <div className="flex gap-4">
                            <Button 
                                onClick={() => { setFile(null); setRecords([]); setValidationStats(null); fileInputRef.current.value = null; }}
                                disabled={isProcessing}
                                className="h-16 px-8 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-widest text-[10px] transition-all"
                            >
                                <RefreshCcw className="w-4 h-4 mr-2" /> Borrar
                            </Button>
                            <Button 
                                onClick={handleImport} 
                                disabled={isProcessing || importComplete}
                                className="flex-1 h-16 rounded-2xl bg-gradient-to-r from-[#4B7BA7] to-[#2C3E50] hover:scale-[1.01] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-blue-900/10 transition-all active:scale-95"
                            >
                                {importComplete ? (
                                    <><CheckCircle className="w-5 h-5 mr-3 text-green-400" /> Inyección Finalizada</>
                                ) : (
                                    <><Database className="w-5 h-5 mr-3" /> Iniciar Inyección de {validationStats.valid} Decretos</>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {records.length > 0 && (
                <div className="border border-slate-100 rounded-[2rem] overflow-hidden bg-slate-50/50 shadow-inner">
                    <div className="px-8 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <FileJson className="w-5 h-5 text-[#4B7BA7]" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pre-Validación en Tiempo Real</span>
                        </div>
                        {validationStats?.invalid > 0 && (
                            <span className="bg-red-50 text-red-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-100">
                                {validationStats.invalid} Errores de Cruce Detectados
                            </span>
                        )}
                    </div>
                    
                    <div className="max-h-[500px] overflow-auto custom-scrollbar">
                        <Table columns={columns} data={records} className="bg-transparent" />
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, val, color }) => {
    const colors = {
        slate: "bg-slate-50 border-slate-200 text-slate-700",
        green: "bg-emerald-50 border-emerald-200 text-emerald-700",
        amber: "bg-amber-50 border-amber-200 text-amber-700",
        blue: "bg-blue-50 border-blue-200 text-blue-700",
        red: "bg-red-50 border-red-200 text-red-700"
    };
    return (
        <div className={`p-6 rounded-[2rem] border ${colors[color]} text-center shadow-sm flex flex-col justify-center items-center h-32`}>
            <span className="block text-4xl font-black mb-2">{val}</span>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">{label}</span>
        </div>
    );
};

export default DecreeJsonImporter;