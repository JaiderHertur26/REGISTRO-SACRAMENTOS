import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Loader2, Search, FileText, UserPlus, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const EditDecreeReplacementSheetPage = () => {
    const { user } = useAuth();
    const { getConceptosAnulacion, getMisDatosList, updateDecreeReplacement } = useAppData();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    
    const [activeTab, setActiveTab] = useState("bautismo");
    const [decrees, setDecrees] = useState([]);
    const [selectedDecreeId, setSelectedDecreeId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [conceptos, setConceptos] = useState([]);

    const [decreeData, setDecreeData] = useState({
        parroquia: '',
        decreeNumber: '',
        decreeDate: '',
        targetName: '',
        conceptoAnulacionId: '' 
    });

    const [newPartida, setNewPartida] = useState({
        sacramentDate: '', firstName: '', lastName: '', birthDate: '', lugarNacimientoDetalle: '', lugarBautismo: '',
        fatherName: '', ceduPadre: '', motherName: '', ceduMadre: '', tipoUnionPadres: '1', sex: '1',
        paternalGrandparents: '', maternalGrandparents: '', godparents: '', minister: '', ministerFaith: '',
        serialRegCivil: '', nuipNuit: '', oficinaRegistro: '', fechaExpedicion: '',
        book: '', page: '', entry: '' 
    });

    useEffect(() => {
        const sacramentParam = searchParams.get('sacrament');
        if (sacramentParam && ['bautismo', 'confirmacion', 'matrimonio'].includes(sacramentParam)) {
            setActiveTab(sacramentParam);
        }
    }, [searchParams]);

    // 1. Cargar Decretos (Omnisciente) y Catálogos
    useEffect(() => {
        if (user) {
            loadDecrees();
            
            const entityId = user.dioceseId || user.id;
            const allConcepts = getConceptosAnulacion(entityId);
            setConceptos(allConcepts.filter(c => c.tipo === 'porReposicion' || c.tipo === 'porCorreccion'));

            // Buscar parroquia destino predeterminada (aunque se llenará al seleccionar)
            setDecreeData(prev => ({ ...prev, parroquia: 'SELECCIONE UN DECRETO' }));
        }
    }, [user, activeTab, searchParams]);

    const loadDecrees = () => {
        const allDecreesMap = new Map();

        // Buscador Omnisciente
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('decreeReplacement') || key.includes('decreeReplacements')) {
                try {
                    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(parsed)) {
                        parsed.forEach(decree => {
                            if (!decree.sacrament || decree.sacrament === activeTab || activeTab === "bautismo") {
                                if (!allDecreesMap.has(decree.id) || decree.isMasterCopy) {
                                    allDecreesMap.set(decree.id, decree);
                                }
                            }
                        });
                    }
                } catch (e) {}
            }
        }

        const sortedRecords = Array.from(allDecreesMap.values())
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        setDecrees(sortedRecords);

        const idParam = searchParams.get('id');
        if (idParam && sortedRecords.some(d => d.id === idParam)) {
            setSelectedDecreeId(idParam);
        }
    };

    // 2. Mapeo al seleccionar un decreto
    useEffect(() => {
        if (selectedDecreeId) {
            const decree = decrees.find(d => d.id === selectedDecreeId);
            if (decree) {
                // Concepto Traductor
                const allConcepts = getConceptosAnulacion(user.dioceseId || user.id);
                let conceptIdToSet = decree.conceptoAnulacionId || decree.conceptoId || '';
                const legacyMatch = allConcepts.find(c => String(c.codigo) === String(conceptIdToSet));
                if (legacyMatch && !allConcepts.some(c => c.id === conceptIdToSet)) {
                    conceptIdToSet = legacyMatch.id;
                }

                setDecreeData({
                    parroquia: decree.targetParishName || decree.parroquia || 'DESCONOCIDA',
                    decreeNumber: decree.decreeNumber || decree.numeroDecreto || '',
                    decreeDate: decree.decreeDate || decree.fechaDecreto || '',
                    targetName: decree.targetName || '',
                    conceptoAnulacionId: conceptIdToSet
                });

                const bd = decree.datosNuevaPartida || {};
                const summary = decree.newPartidaSummary || {};

                setNewPartida({
                    sacramentDate: bd.fechaSacramento || bd.sacramentDate || bd.fecbau || summary.sacramentDate || '',
                    lugarBautismo: bd.lugarBautismo || bd.sacramentPlace || bd.lugbau || '',
                    firstName: bd.nombres || bd.firstName || summary.firstName || '',
                    lastName: bd.apellidos || bd.lastName || summary.lastName || '',
                    birthDate: bd.fechaNacimiento || bd.birthDate || bd.fecnac || summary.birthDate || '',
                    lugarNacimientoDetalle: bd.lugarNacimiento || bd.lugarNacimientoDetalle || bd.lugarn || '',
                    fatherName: bd.nombrePadre || bd.fatherName || bd.padre || '',
                    ceduPadre: bd.cedulaPadre || bd.cedupad || bd.ceduPadre || '',
                    motherName: bd.nombreMadre || bd.motherName || bd.madre || '',
                    ceduMadre: bd.cedulaMadre || bd.cedumad || bd.ceduMadre || '',
                    tipoUnionPadres: String(bd.tipoUnionPadres || bd.tipohijo || '1'),
                    sex: String(bd.sexo || bd.sex || '1'),
                    paternalGrandparents: bd.abuelosPaternos || bd.paternalGrandparents || bd.abuepat || '',
                    maternalGrandparents: bd.abuelosMaternos || bd.maternalGrandparents || bd.abuemat || '',
                    godparents: bd.padrinos || bd.godparents || '',
                    minister: bd.minister || bd.ministro || '',
                    ministerFaith: bd.daFe || bd.ministerFaith || bd.dafe || '',
                    serialRegCivil: bd.serialRegistro || bd.serialRegCivil || bd.regciv || '',
                    nuipNuit: bd.nuip || bd.nuipNuit || '',
                    oficinaRegistro: bd.oficinaRegistro || bd.notaria || '',
                    fechaExpedicion: bd.fechaExpedicionRegistro || bd.fechaExpedicion || bd.fecregis || '',
                    book: summary.book || bd.libro || bd.book_number || '',
                    page: summary.page || bd.folio || bd.page_number || '',
                    entry: summary.entry || bd.numero || bd.entry_number || ''
                });
            }
        }
    }, [selectedDecreeId, decrees, user]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!selectedDecreeId) return;
        setIsSubmitting(true);
        
        try {
            const originalDecree = decrees.find(d => d.id === selectedDecreeId);
            const parishIdToUpdate = originalDecree?.targetParishId;

            // Traductor de Fechas a Letras
            const formatFechaLetras = (fechaStr) => {
                if (!fechaStr) return '___';
                const partes = fechaStr.split('-');
                if (partes.length !== 3) return fechaStr;

                const dias = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UN'];
                const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

                const dia = parseInt(partes[2], 10);
                const mes = parseInt(partes[1], 10);
                const anio = parseInt(partes[0], 10);

                const getAnioLetras = (year) => {
                    if (year === 2000) return 'DOS MIL';
                    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
                    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
                    const veintes = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
                    const decenas = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
                    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

                    let res = '';
                    const miles = Math.floor(year / 1000);
                    if (miles === 1) res += 'MIL ';
                    else if (miles === 2) res += 'DOS MIL ';

                    const restMiles = year % 1000;
                    const cents = Math.floor(restMiles / 100);
                    if (cents > 0) res += centenas[cents] + ' ';

                    const decUnits = restMiles % 100;
                    if (decUnits > 0) {
                        if (decUnits < 10) res += unidades[decUnits];
                        else if (decUnits < 20) res += especiales[decUnits - 10];
                        else if (decUnits < 30) res += veintes[decUnits - 20];
                        else {
                            const d = Math.floor(decUnits / 10);
                            const u = decUnits % 10;
                            res += decenas[d];
                            if (u > 0) res += ' Y ' + unidades[u];
                        }
                    }
                    return res.trim();
                };

                return `${dias[dia - 1] || dia} DE ${meses[mes - 1] || mes} DE ${getAnioLetras(anio)}`;
            };

            const conceptoMatch = conceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
            const causaText = conceptoMatch ? conceptoMatch.concepto.toUpperCase() : 'PÉRDIDA/DETERIORO';
            
            const fechaDecretoText = formatFechaLetras(decreeData.decreeDate);
            const fechaExpText = newPartida.fechaExpedicion ? ` SE EXPIDE EL DÍA ${formatFechaLetras(newPartida.fechaExpedicion)}.` : '';
            
            const notaReposicion = `ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${decreeData.decreeNumber || '___'} DE FECHA ${fechaDecretoText}, DEBIDO A LA ${causaText} DEL ORIGINAL.${fechaExpText}`;

            const standardPartidaData = {
                ...newPartida,
                nombres: newPartida.firstName,
                apellidos: newPartida.lastName,
                fechaNacimiento: newPartida.birthDate,
                fecnac: newPartida.birthDate,
                fechaSacramento: newPartida.sacramentDate,
                fecbau: newPartida.sacramentDate,
                lugarNacimiento: newPartida.lugarNacimientoDetalle,
                lugarn: newPartida.lugarNacimientoDetalle,
                nombrePadre: newPartida.fatherName,
                padre: newPartida.fatherName,
                cedulaPadre: newPartida.ceduPadre,
                cedupad: newPartida.ceduPadre,
                nombreMadre: newPartida.motherName,
                madre: newPartida.motherName,
                cedulaMadre: newPartida.ceduMadre,
                cedumad: newPartida.ceduMadre,
                tipoUnionPadres: newPartida.tipoUnionPadres,
                tipohijo: newPartida.tipoUnionPadres,
                sexo: newPartida.sex,
                abuelosPaternos: newPartida.paternalGrandparents,
                abuepat: newPartida.paternalGrandparents,
                abuelosMaternos: newPartida.maternalGrandparents,
                abuemat: newPartida.maternalGrandparents,
                padrinos: newPartida.godparents,
                ministro: newPartida.minister,
                daFe: newPartida.ministerFaith,
                dafe: newPartida.ministerFaith,
                serialRegistro: newPartida.serialRegCivil,
                regciv: newPartida.serialRegCivil,
                nuip: newPartida.nuipNuit,
                oficinaRegistro: newPartida.oficinaRegistro,
                notaria: newPartida.oficinaRegistro,
                fechaExpedicionRegistro: newPartida.fechaExpedicion,
                fecregis: newPartida.fechaExpedicion,
                notaMarginal: notaReposicion,
                notaAlMargen: notaReposicion,
                marginNote: notaReposicion
            };

            const updatedDecree = {
                ...decreeData,
                newPartidaSummary: { book: newPartida.book, page: newPartida.page, entry: newPartida.entry },
                datosNuevaPartida: standardPartidaData,
                targetName: `${newPartida.firstName} ${newPartida.lastName}`.toUpperCase(),
                causa: causaText,
                concepto: causaText
            };

            // 1. Actualizar llave de Cancillería
            const chanceryId = user.dioceseId || user.id;
            const chanceryKey = `decreeReplacementBaptism_${chanceryId}`;
            let chanceryRecords = JSON.parse(localStorage.getItem(chanceryKey) || '[]');
            const cIdx = chanceryRecords.findIndex(r => r.id === selectedDecreeId);
            if (cIdx !== -1) {
                chanceryRecords[cIdx] = { ...chanceryRecords[cIdx], ...updatedDecree };
                localStorage.setItem(chanceryKey, JSON.stringify(chanceryRecords));
            }

            // 2. Actualizar llave de Parroquia
            if (parishIdToUpdate) {
                const parishKey = `decreeReplacementBaptism_${parishIdToUpdate}`;
                let parishRecords = JSON.parse(localStorage.getItem(parishKey) || '[]');
                const pIdx = parishRecords.findIndex(r => r.id === selectedDecreeId);
                if (pIdx !== -1) {
                    parishRecords[pIdx] = { ...parishRecords[pIdx], ...updatedDecree };
                    localStorage.setItem(parishKey, JSON.stringify(parishRecords));
                }

                // 3. Sincronizar Físicamente la Partida
                const registryKey = `baptisms_${parishIdToUpdate}`;
                const allParts = JSON.parse(localStorage.getItem(registryKey) || '[]');
                const partId = originalDecree?.newBaptismIdRepo || originalDecree?.newPartidaId;
                const ptIdx = allParts.findIndex(b => b.id === partId);
                
                if (ptIdx !== -1) {
                    allParts[ptIdx] = { 
                        ...allParts[ptIdx], 
                        ...standardPartidaData,
                        replacementDecreeRef: decreeData.decreeNumber,
                        updatedAt: new Date().toISOString()
                    };
                    localStorage.setItem(registryKey, JSON.stringify(allParts));
                }
            }

            loadDecrees();
            toast({ title: "Guardado Maestro", description: "Decreto actualizado en Cancillería y Parroquia Destino.", className: "bg-green-50 border-green-200 text-green-900" });
        } catch (err) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => navigate('/chancery/decree-replacement')} className="p-0 hover:bg-transparent">
                    <ArrowLeft className="w-6 h-6 text-gray-500" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-serif">Editar Decreto Reposición (Cancillería)</h1>
                    <p className="text-gray-500 text-sm">Modifique el decreto maestro. Los cambios se sincronizarán con la parroquia.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-[calc(100vh-200px)] min-h-[600px] flex gap-6 overflow-hidden">
                {/* SIDEBAR CANCILLERÍA */}
                <div className="w-1/4 border-r border-gray-100 pr-4 flex flex-col h-full">
                    <div className="relative mb-4">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="Buscar por titular..." className="pl-8 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {decrees.filter(d => `${d.targetName} ${d.decreeNumber}`.toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
                            <button key={d.id} onClick={() => setSelectedDecreeId(d.id)} className={cn("w-full text-left p-3 rounded-lg border text-xs transition-all", selectedDecreeId === d.id ? "bg-amber-50 border-amber-200 ring-1 ring-amber-300 shadow-sm" : "bg-white hover:bg-gray-50 border-gray-100")}>
                                <div className="font-bold text-blue-900">{d.decreeNumber || d.numeroDecreto}</div>
                                <div className="truncate font-medium text-gray-600">{d.targetName || 'SIN TITULAR'}</div>
                                <div className="text-[9px] text-purple-600 mt-1 uppercase truncate">{d.targetParishName || d.parroquia || 'LOCAL'}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* FORMULARIO CANCILLERÍA */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                    {!selectedDecreeId ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed rounded-lg bg-gray-50 opacity-60"><FileText className="w-12 h-12 mb-2 opacity-10" /><p className="font-medium">Seleccione un decreto del archivo central</p></div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-8 animate-in fade-in duration-300 pb-10">
                            {/* BLOQUE 1: DECRETO */}
                            <div className="bg-amber-50/50 rounded-lg p-6 border border-amber-100">
                                <h3 className="text-sm font-bold text-amber-800 uppercase mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> 1. Datos del Decreto Maestro</h3>
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="col-span-3"><label className="text-[10px] font-bold text-gray-500 uppercase">Parroquia Destino</label><Input value={decreeData.parroquia} readOnly className="bg-gray-200/50 font-bold text-purple-800" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Número Decreto</label><Input name="decreeNumber" value={decreeData.decreeNumber} onChange={e => setDecreeData({...decreeData, decreeNumber: e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Fecha Emisión</label><Input type="date" name="decreeDate" value={decreeData.decreeDate} onChange={e => setDecreeData({...decreeData, decreeDate: e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Causa / Concepto</label>
                                        <select name="conceptoAnulacionId" value={decreeData.conceptoAnulacionId} onChange={e => setDecreeData({...decreeData, conceptoAnulacionId: e.target.value})} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
                                            <option value="">Seleccionar...</option>
                                            {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 2: PARTIDA */}
                            <div className="bg-white rounded-lg p-6 border-l-4 border-blue-600 shadow-sm border">
                                <h3 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><UserPlus className="w-4 h-4 text-blue-600" /> 2. Datos de la Partida (Sincronizada)</h3>
                                <div className="grid grid-cols-3 gap-6 mb-6 bg-gray-50 p-4 rounded border border-dashed">
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase">Libro</label><Input value={newPartida.book} onChange={e => setNewPartida({...newPartida, book: e.target.value})} className="font-mono text-center font-bold" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase">Folio</label><Input value={newPartida.page} onChange={e => setNewPartida({...newPartida, page: e.target.value})} className="font-mono text-center font-bold" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase">Número</label><Input value={newPartida.entry} onChange={e => setNewPartida({...newPartida, entry: e.target.value})} className="font-mono text-center font-bold" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Nombres</label><Input value={newPartida.firstName} onChange={e => setNewPartida({...newPartida, firstName: e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Apellidos</label><Input value={newPartida.lastName} onChange={e => setNewPartida({...newPartida, lastName: e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Fec. Nacimiento</label><Input type="date" value={newPartida.birthDate} onChange={e => setNewPartida({...newPartida, birthDate: e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Fec. Bautismo</label><Input type="date" value={newPartida.sacramentDate} onChange={e => setNewPartida({...newPartida, sacramentDate: e.target.value})} /></div>
                                    
                                    <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                                        <h4 className="col-span-2 text-[10px] font-bold text-blue-600 uppercase border-b pb-1 mb-2">Padres y Abuelos</h4>
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Padre</label><Input value={newPartida.fatherName} onChange={e => setNewPartida({...newPartida, fatherName: e.target.value})} /></div>
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Cédula Padre</label><Input value={newPartida.ceduPadre} onChange={e => setNewPartida({...newPartida, ceduPadre: e.target.value})} /></div>
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Madre</label><Input value={newPartida.motherName} onChange={e => setNewPartida({...newPartida, motherName: e.target.value})} /></div>
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Cédula Madre</label><Input value={newPartida.ceduMadre} onChange={e => setNewPartida({...newPartida, ceduMadre: e.target.value})} /></div>
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Abuelos Paternos</label><Input value={newPartida.paternalGrandparents} onChange={e => setNewPartida({...newPartida, paternalGrandparents: e.target.value})} /></div>
                                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Abuelos Maternos</label><Input value={newPartida.maternalGrandparents} onChange={e => setNewPartida({...newPartida, maternalGrandparents: e.target.value})} /></div>
                                    </div>
                                    
                                    <div className="col-span-2 grid grid-cols-4 gap-4 bg-gray-100/50 p-4 rounded-lg border border-blue-100">
                                        <h4 className="col-span-4 text-[10px] font-bold text-blue-800 uppercase border-b pb-1">Registro Civil Legal</h4>
                                        <div><label className="text-[9px] font-bold text-gray-500 uppercase">Serial</label><Input value={newPartida.serialRegCivil} onChange={e => setNewPartida({...newPartida, serialRegCivil: e.target.value})} /></div>
                                        <div><label className="text-[9px] font-bold text-gray-500 uppercase">NUIP</label><Input value={newPartida.nuipNuit} onChange={e => setNewPartida({...newPartida, nuipNuit: e.target.value})} /></div>
                                        <div><label className="text-[9px] font-bold text-gray-500 uppercase">Notaría</label><Input value={newPartida.oficinaRegistro} onChange={e => setNewPartida({...newPartida, oficinaRegistro: e.target.value})} /></div>
                                        <div><label className="text-[9px] font-bold text-gray-500 uppercase">Fec. Exp.</label><Input type="date" value={newPartida.fechaExpedicion} onChange={e => setNewPartida({...newPartida, fechaExpedicion: e.target.value})} /></div>
                                    </div>

                                    <div className="col-span-2 flex justify-end gap-4 mt-8 border-t pt-6 bg-white sticky bottom-0">
                                        <div className="flex gap-3">
                                            <Button type="button" variant="outline" onClick={() => navigate('/chancery/decree-replacement')}>Cancelar</Button>
                                            <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-8 shadow-md">
                                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} 
                                                Sincronizar y Guardar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default EditDecreeReplacementSheetPage;