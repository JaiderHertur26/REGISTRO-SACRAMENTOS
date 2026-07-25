import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Upload, FileJson, AlertCircle, CheckCircle, 
    Save, Info, Loader2, ArrowRight, RefreshCcw 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext'; 
import { useAppData } from '@/context/AppDataContext'; 
import { supabase } from '@/lib/supabaseClient'; 
import { generateUUID } from '@/utils/supabaseHelpers'; 
import Table from '@/components/ui/Table';

const DecreeJsonImporter = ({ sacramentType = 'bautismo' }) => {
    const { toast } = useToast();
    const { user } = useAuth(); 
    const { getMisDatosList, getConceptosAnulacion } = useAppData(); 
    
    const [file, setFile] = useState(null);
    const [records, setRecords] = useState([]);
    const [validationStats, setValidationStats] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importComplete, setImportComplete] = useState(false);

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        const fileName = selectedFile.name.toUpperCase();
        if (!fileName.includes('ANULACION')) {
            toast({ title: "Nombre incorrecto", description: "El archivo debe contener 'ANULACION' en su nombre.", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                const data = Array.isArray(json) ? json : (json.data || []);
                
                if (data.length === 0) throw new Error("El archivo está vacío.");

                const processed = data.map((item, index) => {
                    const isReposicion = String(item.codiconcep) === '005';
                    // Validación básica
                    const hasNewData = item.newlib && item.newfol && item.newnum;
                    const hasOrigData = item.libro && item.folio && item.numero;
                    const hasDecree = item.decreto && item.fecha;

                    return {
                        ...item,
                        id: index,
                        isReposicion,
                        isValid: isReposicion ? (hasNewData && hasDecree) : (hasNewData && hasOrigData && hasDecree),
                        error: !hasDecree ? "Falta No. Decreto/Fecha" : !hasNewData ? "Falta ubicación nueva" : ""
                    };
                });

                setRecords(processed);
                setValidationStats({
                    total: processed.length,
                    valid: processed.filter(r => r.isValid).length,
                    invalid: processed.filter(r => !r.isValid).length,
                    reposiciones: processed.filter(r => r.isReposicion).length,
                    correcciones: processed.filter(r => !r.isReposicion).length
                });
                setFile(selectedFile);
            } catch (error) {
                toast({ title: "Error de lectura", description: error.message, variant: "destructive" });
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
        if (!records.length) return;
        setIsProcessing(true);
        const parishId = user?.parishId;

        try {
            const parishInfo = getMisDatosList(parishId)[0] || {};
            const parishLabel = `${parishInfo.nombre || 'PARROQUIA'} - ${parishInfo.ciudad || ''}`.toUpperCase();
            const catalogoConceptos = getConceptosAnulacion(parishId);

            // Descargar base actual para cruce rápido
            const { data: allBaptisms } = await supabase.from('baptisms').select('id, book_number, page_number, entry_number, raw_data').eq('parish_id', parishId);

            let correctionsHistory = JSON.parse(localStorage.getItem(`baptismCorrections_${parishId}`) || '[]');
            let repositionHistory = JSON.parse(localStorage.getItem(`decreeReplacementBaptism_${parishId}`) || '[]');
            let count = 0;

            for (const item of records.filter(r => r.isValid)) {
                const sNewL = String(item.newlib).padStart(4, '0');
                const sNewF = String(item.newfol).padStart(4, '0');
                const sNewN = String(item.newnum).padStart(4, '0');
                
                const newRec = allBaptisms.find(b => b.book_number === sNewL && b.page_number === sNewF && b.entry_number === sNewN);
                if (!newRec) continue;

                const conceptoObj = catalogoConceptos.find(c => String(c.codigo) === String(item.codiconcep));
                const conceptoText = conceptoObj ? conceptoObj.concepto.toUpperCase() : "SOLICITUD DE PARTE";

                if (item.isReposicion) {
                    // --- MODO REPOSICIÓN (005) ---
                    const noteRepo = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${item.decreto} DE FECHA ${item.fecha}, DEBIDO A LA ${conceptoText} DEL ORIGINAL.`;
                    
                    const newRaw = { 
                        ...newRec.raw_data, 
                        isSupplementary: true, 
                        creadoPorDecreto: true, 
                        replacementDecreeRef: item.decreto,
                        notaMarginal: noteRepo 
                    };

                    await supabase.from('baptisms').update({ raw_data: newRaw }).eq('id', newRec.id);

                    repositionHistory.push({
                        id: generateUUID(),
                        decreeNumber: item.decreto,
                        decreeDate: item.fecha,
                        conceptoAnulacionId: item.codiconcep,
                        targetName: `${newRaw.nombres || newRaw.firstName || ''} ${newRaw.apellidos || newRaw.lastName || ''}`.trim().toUpperCase(),
                        newPartidaId: newRec.id,
                        newPartidaSummary: { book: sNewL, page: sNewF, entry: sNewN },
                        type: 'replacement',
                        createdAt: new Date().toISOString()
                    });

                } else {
                    // --- MODO CORRECCIÓN (OTROS) ---
                    const sOldL = String(item.libro).padStart(4, '0');
                    const sOldF = String(item.folio).padStart(4, '0');
                    const sOldN = String(item.numero).padStart(4, '0');

                    const origRec = allBaptisms.find(b => b.book_number === sOldL && b.page_number === sOldF && b.entry_number === sOldN);
                    
                    if (origRec) {
                        const noteAnulada = `PARTIDA ANULADA POR DECRETO NO. ${item.decreto} DEL ${item.fecha}. VER SUPLETORIO L.${sNewL} F.${sNewF} N.${sNewN}`;
                        const noteNueva = `ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NO. ${item.decreto} DEL ${item.fecha}. ANULA LA PARTIDA L.${sOldL} F.${sOldF} N.${sOldN}`;

                        // Update Original
                        const origRaw = { ...origRec.raw_data, isAnnulled: true, status: 'anulada', notaMarginal: noteAnulada };
                        await supabase.from('baptisms').update({ status: 'anulada', raw_data: origRaw }).eq('id', origRec.id);

                        // Update Nueva
                        const newRaw = { ...newRec.raw_data, isSupplementary: true, creadoPorDecreto: true, correctionDecreeRef: item.decreto, notaMarginal: noteNueva };
                        await supabase.from('baptisms').update({ raw_data: newRaw }).eq('id', newRec.id);

                        correctionsHistory.push({
                            id: generateUUID(),
                            decreeNumber: item.decreto,
                            decreeDate: item.fecha,
                            conceptoAnulacionId: item.codiconcep,
                            originalPartidaId: origRec.id,
                            newPartidaId: newRec.id,
                            targetName: `${origRaw.nombres || origRaw.firstName || ''} ${origRaw.apellidos || origRaw.lastName || ''}`.trim().toUpperCase(),
                            parroquia: parishLabel,
                            originalPartidaSummary: { ...origRaw, book: sOldL, page: sOldF, entry: sOldN },
                            newPartidaSummary: { ...newRaw, book: sNewL, page: sNewF, entry: sNewN },
                            type: 'correction',
                            createdAt: new Date().toISOString()
                        });
                    }
                }
                count++;
            }

            // Guardar ambos historiales
            localStorage.setItem(`baptismCorrections_${parishId}`, JSON.stringify(correctionsHistory));
            localStorage.setItem(`decreeReplacementBaptism_${parishId}`, JSON.stringify(repositionHistory));
            
            window.dispatchEvent(new Event('storage'));
            setImportComplete(true);
            toast({ title: "Proceso Exitoso", description: `Se aplicaron ${count} decretos (Reposiciones y Correcciones) en la Nube.`, className: "bg-green-50 text-green-900" });

        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const columns = [
        { 
            header: 'Tipo', 
            render: r => r.isReposicion ? 
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">REPOSICIÓN</span> : 
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">CORRECCIÓN</span> 
        },
        { header: 'No. Decreto', accessor: 'decreto' },
        { header: 'Ubicación Nueva (Destino)', render: r => <span className="font-mono text-blue-600 font-bold">{r.newlib}/{r.newfol}/{r.newnum}</span> },
        { header: 'Original (Afectada)', render: r => r.isReposicion ? <span className="text-gray-400 italic">No aplica</span> : <span className="font-mono">{r.libro}/{r.folio}/{r.numero}</span> },
        { header: 'Estado', render: r => r.isValid ? <CheckCircle className="w-4 h-4 text-green-500"/> : <AlertCircle className="w-4 h-4 text-red-500" title={r.error}/> }
    ];

    return (
        <div className="bg-white border rounded-3xl p-8 space-y-8 shadow-sm">
            <div className="flex items-center gap-4 border-b pb-6">
                <div className="bg-[#4B7BA7] p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20">
                    <RefreshCcw className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Importador Inteligente de Decretos</h2>
                    <p className="text-gray-500 text-sm font-medium uppercase tracking-widest text-[10px]">Cruce masivo de anulaciones y reposiciones</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Zona de Carga */}
                <div className="lg:col-span-1">
                    <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-gray-200 rounded-[2rem] cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-all group">
                        <div className="flex flex-col items-center justify-center text-center p-6">
                            {isProcessing ? <Loader2 className="w-12 h-12 mb-4 text-[#4B7BA7] animate-spin" /> : <Upload className="w-12 h-12 mb-4 text-gray-300 group-hover:text-blue-500 transition-colors" />}
                            <p className="text-sm font-black text-gray-700 uppercase tracking-widest">{isProcessing ? 'Sincronizando...' : 'Subir ANULACION.json'}</p>
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Detecta automáticamente códigos 005 (Reposición)</p>
                        </div>
                        <input type="file" className="hidden" accept=".json" onChange={handleFileChange} disabled={isProcessing} />
                    </label>
                </div>

                {/* Estadísticas */}
                <div className="lg:col-span-2 space-y-6">
                    {validationStats ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="Total" val={validationStats.total} color="gray" />
                            <StatCard label="Válidos" val={validationStats.valid} color="green" />
                            <StatCard label="Reposiciones" val={validationStats.reposiciones} color="amber" />
                            <StatCard label="Correcciones" val={validationStats.correcciones} color="blue" />
                        </div>
                    ) : (
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                            <Info className="w-6 h-6 text-blue-500 shrink-0 mt-1" />
                            <p className="text-sm text-blue-700 leading-relaxed">
                                <strong>Instrucciones:</strong> El archivo debe contener los campos de ubicación original y nueva. Si el código de concepto es <strong>005</strong>, el sistema entenderá que es una <strong>Reposición</strong> y solo buscará la partida nueva para inyectar la nota técnica.
                            </p>
                        </div>
                    )}

                    {validationStats && validationStats.valid > 0 && (
                        <Button 
                            onClick={handleImport} 
                            disabled={isProcessing || importComplete}
                            className="w-full py-8 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-blue-900/10 transition-all transform active:scale-95"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                            Procesar {validationStats.valid} Decretos en la Nube
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabla de Vista Previa */}
            {records.length > 0 && (
                <div className="border border-gray-100 rounded-3xl overflow-hidden bg-gray-50/50">
                    <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-2">
                        <FileJson className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vista previa de transacciones</span>
                    </div>
                    <Table columns={columns} data={records.slice(0, 10)} className="bg-transparent" />
                    {records.length > 10 && (
                        <div className="p-4 text-center text-[10px] font-bold text-gray-400 uppercase italic">
                            ... y otros {records.length - 10} decretos más
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Componente Interno para los contadores
const StatCard = ({ label, val, color }) => {
    const colors = {
        gray: "bg-gray-50 border-gray-200 text-gray-700",
        green: "bg-green-50 border-green-200 text-green-700",
        amber: "bg-amber-50 border-amber-200 text-amber-700",
        blue: "bg-blue-50 border-blue-200 text-blue-700"
    };
    return (
        <div className={`p-4 rounded-2xl border ${colors[color]} text-center shadow-sm`}>
            <span className="block text-2xl font-black">{val}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </div>
    );
};

export default DecreeJsonImporter;