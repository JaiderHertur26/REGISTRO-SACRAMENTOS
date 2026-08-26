import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, FileText, UserPlus, AlertCircle, CheckCircle2, Search, Loader2, Droplet, Users, PenTool } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { marginalNotesEngine } from '@/utils/marginalNotesEngine'; 
import { calculateNextConsecutive } from '@/services/sacramentParametersService';

const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|EXCMO\.?\s*|SACERDOTE\s*)/i, '').trim();
};

const ConfirmationCorrectionTab = () => {
  const { user } = useAuth();
  const { getParrocoActual, getMisDatosList, getParrocos } = useAppData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [cloudParams, setCloudParams] = useState({});
  const [conceptos, setConceptos] = useState([]);
  
  const [listaSacerdotes, setListaSacerdotes] = useState([]);
  const [sacerdotePorDefecto, setSacerdotePorDefecto] = useState('');

  const [decreeData, setDecreeData] = useState({
    parroquia: '', numeroDeDecreto: '', fechaEmision: new Date().toISOString().split('T')[0],
    conceptoAnulacion: '', nombreConfirmado: '', Libro: '', folio: '', numero: ''
  });

  const [foundRecord, setFoundRecord] = useState(null);
  const [searchMessage, setSearchMessage] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  const [newPartida, setNewPartida] = useState({
    fechaSacramento: '', lugarSacramento: '', apellidos: '', nombres: '', 
    sexo: '', fechaNacimiento: '', edad: '', nombrePadre: '', nombreMadre: '', 
    lugarBautismo: '', libroBautismo: '', folioBautismo: '', numeroBautismo: '',
    padrinos: '', ministro: '', daFe: '', observaciones: ''
  });

  useEffect(() => {
    const initializeData = async () => {
      if (!user) return;
      try {
        if (user.parishId) {
          const misDatos = getMisDatosList(user.parishId);
          let parishLabel = misDatos?.length > 0 ? `${misDatos[0].nombre} - ${misDatos[0].ciudad}` : `${user.parishName} - ${user.city}`;
          setDecreeData(prev => ({ ...prev, parroquia: parishLabel }));

          const parrocos = getParrocos(user.parishId) || [];
          setListaSacerdotes(parrocos);

          const priest = getParrocoActual(user.parishId);
          if (priest) {
              const defPriest = `${priest.nombre} ${priest.apellido || ''}`.trim().toUpperCase();
              setSacerdotePorDefecto(defPriest);
              setNewPartida(prev => ({ ...prev, daFe: defPriest }));
          }

          const { data: paramsData } = await supabase.from('parish_parameters').select('confirmaciones_params').eq('parish_id', user.parishId).maybeSingle();
          if (paramsData && paramsData.confirmaciones_params) setCloudParams(paramsData.confirmaciones_params);
        }

        let targetDioceseId = user.dioceseId || user.diocese_id;
        if (!targetDioceseId && user.parishId) {
          const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', user.parishId).single();
          if (pData) targetDioceseId = pData.diocese_id;
        }

        if (targetDioceseId) {
          const { data } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', targetDioceseId).order('codigo', { ascending: true });
          if (data) setConceptos(data.filter(c => c.tipo === 'porCorreccion' || (c.concepto && c.concepto.toLowerCase().includes('correcc'))));
        }
      } catch (error) { console.error("Error inicializando:", error); }
    };
    initializeData();
  }, [user, getParrocoActual, getMisDatosList, getParrocos]);

  useEffect(() => {
      if (decreeData.fechaEmision && listaSacerdotes.length > 0) {
          const dStr = decreeData.fechaEmision.includes('T') ? decreeData.fechaEmision : `${decreeData.fechaEmision}T12:00:00`;
          const fechaSac = new Date(dStr);
          
          if (!isNaN(fechaSac.getTime())) {
              const sacerdoteEpoca = listaSacerdotes.find(s => {
                  if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                  const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                  const inicio = new Date(iStr);
                  const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                  return fechaSac >= inicio && fechaSac <= fin;
              });

              if (sacerdoteEpoca) {
                  const histPriest = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
                  setNewPartida(prev => ({ ...prev, daFe: histPriest }));
              } else {
                  setNewPartida(prev => ({ ...prev, daFe: sacerdotePorDefecto }));
              }
          }
      }
  }, [decreeData.fechaEmision, listaSacerdotes, sacerdotePorDefecto]);

  useEffect(() => {
      if (newPartida.fechaNacimiento && newPartida.fechaSacramento) {
          const birthStr = newPartida.fechaNacimiento.includes('T') ? newPartida.fechaNacimiento : `${newPartida.fechaNacimiento}T12:00:00`;
          const confStr = newPartida.fechaSacramento.includes('T') ? newPartida.fechaSacramento : `${newPartida.fechaSacramento}T12:00:00`;
          const birth = new Date(birthStr);
          const conf = new Date(confStr);
          if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
              let age = conf.getFullYear() - birth.getFullYear();
              const m = conf.getMonth() - birth.getMonth();
              if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) age--;
              if (age >= 0 && newPartida.edad !== age.toString()) {
                  setNewPartida(prev => ({ ...prev, edad: age.toString() }));
              }
          }
      }
  }, [newPartida.fechaNacimiento, newPartida.fechaSacramento]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleDecreeChange = async (e) => {
    const { name, value } = e.target;
    setDecreeData(prev => ({ ...prev, [name]: value }));

    if (['Libro', 'folio', 'numero'].includes(name)) { setFoundRecord(null); setSearchMessage(null); }

    if (name === 'nombreConfirmado' && value.length > 2) {
        try {
          const { data } = await supabase.from('confirmations').select('*').eq('parish_id', user?.parishId).ilike('nombres', `%${value}%`).limit(5);
          if (data) {
            setSuggestions(data.map(d => ({ ...d.raw_data, id: d.id, firstName: d.nombres, lastName: d.apellidos })));
            setShowSuggestions(true);
          }
        } catch (error) { setSuggestions([]); setShowSuggestions(false); }
    } else if (name === 'nombreConfirmado') { setSuggestions([]); setShowSuggestions(false); }
  };

  const handleSuggestionClick = (record) => {
    setDecreeData(prev => ({ ...prev, nombreConfirmado: `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`.trim() }));
    setShowSuggestions(false);
  };

  const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleNewPartidaChangeUpper = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));

  const handleSearch = async () => {
    const { Libro, folio, numero } = decreeData;
    if (!Libro || !folio || !numero) { setSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." }); return; }

    setIsLoading(true); setSearchMessage(null); setFoundRecord(null);

    try {
      const { data: dbRecord, error } = await supabase.from('confirmations').select('*').eq('parish_id', user?.parishId)
        .eq('book_number', String(Libro).padStart(4, '0')).eq('folio', String(folio).padStart(4, '0')).eq('number', String(numero).padStart(4, '0')).maybeSingle();

      if (error) throw error;

      if (dbRecord) {
        if (dbRecord.status === 'anulada') {
          setSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA." });
        } else {
          const raw = dbRecord.raw_data || {};
          const found = { ...raw, id: dbRecord.id, status: dbRecord.status };
          setFoundRecord(found);
          setSearchMessage({ type: 'success', text: "Partida de confirmación encontrada exitosamente." });
          if (!decreeData.nombreConfirmado) setDecreeData(prev => ({ ...prev, nombreConfirmado: `${dbRecord.nombres} ${dbRecord.apellidos}` }));
          
          setNewPartida(prev => ({
            ...prev,
            nombres: dbRecord.nombres || raw.nombres || '', 
            apellidos: dbRecord.apellidos || raw.apellidos || '',
            fechaSacramento: dbRecord.celebration_date || raw.fechaSacramento || '', 
            lugarSacramento: raw.lugarSacramento || '',
            sexo: dbRecord.sexo || raw.sexo || '', 
            fechaNacimiento: dbRecord.fecha_nacimiento || raw.fechaNacimiento || '',
            edad: raw.edad || '',
            nombrePadre: dbRecord.nombre_padre || raw.nombrePadre || '', 
            nombreMadre: dbRecord.nombre_madre || raw.nombreMadre || '',
            lugarBautismo: dbRecord.lugar_bautismo || raw.lugarBautismo || '',
            libroBautismo: raw.libroBautismo || '',
            folioBautismo: raw.folioBautismo || '',
            numeroBautismo: raw.numeroBautismo || '',
            padrinos: dbRecord.padrinos || raw.padrinos || '',
            ministro: dbRecord.ministro || raw.ministro || '',
          }));
        }
      } else { setSearchMessage({ type: 'error', text: "No se encontró ninguna confirmación en la nube." }); }
    } catch (error) { setSearchMessage({ type: 'error', text: "Error conectando con la base de datos." }); } 
    finally { setIsLoading(false); }
  };

  const validateForm = () => {
    if (!decreeData.numeroDeDecreto || !decreeData.conceptoAnulacion || !foundRecord) return false;
    return ['fechaSacramento', 'nombres', 'apellidos'].every(field => newPartida[field]);
  };

  const handleSave = async () => {
    if (!validateForm()) { toast({ title: "Validación", description: "Complete todos los campos requeridos.", variant: "destructive" }); return; }
    setIsLoading(true);

    try {
        const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'correccion')
            .eq('parish_id', user.parishId).contains('payload', { decreeNumber: decreeData.numeroDeDecreto }).maybeSingle();

        if (existingDecree) {
            setIsLoading(false);
            toast({ title: "Decreto Duplicado", description: `El decreto ${decreeData.numeroDeDecreto} ya existe.`, variant: "destructive" }); return;
        }

        const supletorioLibro = cloudParams.suplementarioLibro || 1;
        const supletorioFolio = cloudParams.suplementarioFolio || 1;
        const supletorioNumero = cloudParams.suplementarioNumero || 1;

        let finalDaFe = cleanTitle(newPartida.daFe);
        finalDaFe = finalDaFe !== 'EL PÁRROCO' ? `PBRO. ${finalDaFe}` : finalDaFe;

        const noteAnulada = marginalNotesEngine.forAnnulledCorrection(user?.parishId, {
            numeroDecreto: decreeData.numeroDeDecreto, fechaDecreto: decreeData.fechaEmision,
            libroNuevo: supletorioLibro, folioNuevo: supletorioFolio, numeroNuevo: supletorioNumero
        });

        const notaSupletoriaFinal = marginalNotesEngine.forNewCorrection(user?.parishId, {
            numeroDecreto: decreeData.numeroDeDecreto, fechaDecreto: decreeData.fechaEmision,
            libroAnulada: decreeData.Libro, folioAnulada: decreeData.folio, numeroAnulada: decreeData.numero, ministro: finalDaFe
        });

        const partidaToSave = {
          ...newPartida,
          daFe: finalDaFe, 
          Libro: String(supletorioLibro).padStart(4, '0'), folio: String(supletorioFolio).padStart(4, '0'), numero: String(supletorioNumero).padStart(4, '0'),
          book_number: String(supletorioLibro).padStart(4, '0'), page_number: String(supletorioFolio).padStart(4, '0'), entry_number: String(supletorioNumero).padStart(4, '0'),
          anulado: false, estado: 'permanente', status: 'seated', notaMarginal: notaSupletoriaFinal
        };

        const payloadDecree = {
          decreeNumber: decreeData.numeroDeDecreto, 
          decreeDate: decreeData.fechaEmision,
          conceptoAnulacionId: decreeData.conceptoAnulacion, 
          observaciones: newPartida.observaciones,
          targetName: decreeData.nombreConfirmado, 
          newTargetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(), 
          
          fechaSacramento: newPartida.fechaSacramento,
          sexo: newPartida.sexo,
          fechaNacimiento: newPartida.fechaNacimiento,
          nombrePadre: newPartida.nombrePadre,
          nombreMadre: newPartida.nombreMadre,
          padrinos: newPartida.padrinos,
          ministro: newPartida.ministro,
          daFe: finalDaFe, dafe: finalDaFe, da_fe: finalDaFe, ministerFaith: finalDaFe,

          originalPartidaId: foundRecord.id,
          originalPartidaSummary: { 
              book: decreeData.Libro, page: decreeData.folio, entry: decreeData.numero,
              nombres: foundRecord.nombres || foundRecord.first_name || '', apellidos: foundRecord.apellidos || foundRecord.last_name || '',
              daFe: finalDaFe, dafe: finalDaFe
          },
          newPartidaSummary: { 
              book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero,
              nombres: newPartida.nombres, apellidos: newPartida.apellidos,
              daFe: finalDaFe, dafe: finalDaFe
          }
        };

        await supabase.from('confirmations').update({ 
            status: 'anulada', nota_marginal: noteAnulada, da_fe: finalDaFe,
            raw_data: { ...foundRecord, notaMarginal: noteAnulada, anulado: true, status: 'anulada', daFe: finalDaFe, dafe: finalDaFe } 
        }).eq('id', foundRecord.id);

        const siguientesSupletorios = calculateNextConsecutive(
            cloudParams.suplementarioNumero, cloudParams.suplementarioFolio,
            cloudParams.suplementarioLibro, cloudParams.suplementarioPartidas, cloudParams.suplementarioReiniciar
        );

        const newParams = { 
            ...cloudParams, 
            suplementarioNumero: siguientesSupletorios.numero,
            suplementarioFolio: siguientesSupletorios.folio,
            suplementarioLibro: siguientesSupletorios.libro
        };

        await supabase.from('parish_parameters').upsert({ 
            parish_id: user.parishId, confirmaciones_params: newParams 
        }, { onConflict: 'parish_id' });

        const { data: newConf, error: errConf } = await supabase.from('confirmations').insert([{
            parish_id: user.parishId,
            book_number: String(supletorioLibro).padStart(4, '0'), folio: String(supletorioFolio).padStart(4, '0'), number: String(supletorioNumero).padStart(4, '0'),
            celebration_date: newPartida.fechaSacramento || null, nombres: newPartida.nombres, apellidos: newPartida.apellidos, sexo: newPartida.sexo,
            fecha_nacimiento: newPartida.fechaNacimiento || null, lugar_bautismo: newPartida.lugarBautismo,
            nombre_padre: newPartida.nombrePadre, nombre_madre: newPartida.nombreMadre,
            padrinos: newPartida.padrinos,
            ministro: newPartida.ministro, da_fe: finalDaFe, status: 'seated', nota_marginal: notaSupletoriaFinal,
            raw_data: partidaToSave
        }]).select('id').single();

        if (errConf) throw errConf;

        payloadDecree.newPartidaId = newConf.id;
        await supabase.from('decretos').insert([{ parish_id: user.parishId, tipo: 'correccion', payload: payloadDecree }]);

        setIsLoading(false);
        toast({ title: "Éxito", description: "Decreto guardado y partida de confirmación supletoria creada.", className: "bg-green-50 text-green-900 border-green-200" });
        navigate('/parroquia/decretos/ver-correcciones');
        
    } catch (error) {
        setIsLoading(false); console.error("Error al guardar:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1";
  const inputClass = "h-11 w-full px-4 py-2 text-sm text-gray-900 font-bold border border-gray-200 rounded-xl focus:ring-4 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all bg-gray-50/50 focus:bg-white uppercase shadow-sm";

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-red-50 px-8 py-4 border-b border-red-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-red-600" /><h3 className="text-xs font-black text-red-700 uppercase tracking-widest">01. Información del Decreto (Confirmación)</h3>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">Número de Decreto</label>
            <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} placeholder="Ej: 024-2025" className="py-6 font-bold focus:border-red-500 focus:ring-red-500/20" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">Fecha de Emisión</label>
            <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} className="py-6 focus:border-red-500 focus:ring-red-500/20" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">Concepto</label>
            <select name="conceptoAnulacion" value={decreeData.conceptoAnulacion} onChange={handleDecreeChange} className="w-full h-[50px] px-4 border border-gray-200 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-red-500/20 bg-white text-gray-700">
              <option value="">SELECCIONE...</option>
              {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
            </select>
          </div>
        </div>

        <div className="mx-8 mb-8 p-8 bg-red-50/50 rounded-3xl border border-red-100">
          <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-6 flex items-center gap-2"><Search className="w-3 h-3" /> Localizar Partida Original para Anulación</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2 relative" ref={wrapperRef}>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nombre Confirmado</label>
              <Input name="nombreConfirmado" value={decreeData.nombreConfirmado} onChange={handleDecreeChange} autoComplete="off" className="focus:border-red-500 focus:ring-red-500/20" />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                  {suggestions.map((r, i) => <div key={i} className="px-4 py-2 hover:bg-red-50 cursor-pointer text-sm font-bold text-gray-700" onClick={() => handleSuggestionClick(r)}>{r.firstName} {r.lastName}</div>)}
                </div>
              )}
            </div>
            <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Libro</label><Input name="Libro" value={decreeData.Libro} onChange={handleDecreeChange} className="text-center font-mono font-bold focus:border-red-500 focus:ring-red-500/20" /></div>
            <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Folio</label><Input name="folio" value={decreeData.folio} onChange={handleDecreeChange} className="text-center font-mono font-bold focus:border-red-500 focus:ring-red-500/20" /></div>
            <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Número</label><Input name="numero" value={decreeData.numero} onChange={handleDecreeChange} className="text-center font-mono font-bold focus:border-red-500 focus:ring-red-500/20" /></div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSearch} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] px-8 shadow-lg shadow-red-900/20">
              {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <><Search className="w-4 h-4 mr-2" /> Buscar en Nube</>}
            </Button>
          </div>
          {searchMessage && (
            <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex gap-2 ${searchMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {searchMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {searchMessage.text.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className={`bg-white rounded-3xl border border-gray-200 shadow-sm transition-all duration-500 ${!foundRecord ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
        <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-green-600" /><h3 className="text-xs font-black text-green-600 uppercase tracking-widest">02. Datos Corregidos para Libro Supletorio</h3>
        </div>
        <div className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2"><label className={labelClass}>Apellidos</label><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" /></div>
            <div className="space-y-2"><label className={labelClass}>Nombres</label><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                  <label className={labelClass}>Sexo</label>
                  <select name="sexo" required value={newPartida.sexo} onChange={handleNewPartidaChangeRaw} className={inputClass}>
                      <option value="">SELECCIONE...</option>
                      <option value="MASCULINO">MASCULINO</option>
                      <option value="FEMENINO">FEMENINO</option>
                  </select>
              </div>
              <div><label className={labelClass}>Fecha de Nacimiento</label><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChangeRaw} className="py-6" /></div>
              <div>
                  <label className={labelClass}>Edad Conf.</label>
                  <div className="relative">
                      <Input type="number" name="edad" value={newPartida.edad} onChange={handleNewPartidaChangeRaw} className="py-6 pr-12" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">AÑOS</span>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
              <div className="space-y-2"><label className={labelClass}>Fecha Confirmación</label><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChangeRaw} className="py-6" /></div>
              <div className="space-y-2"><label className={labelClass}>Parroquia / Lugar de Celebración</label><Input name="lugarSacramento" value={newPartida.lugarSacramento} onChange={handleNewPartidaChangeUpper} className="py-6" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Información del Padre</p>
              <Input name="nombrePadre" value={newPartida.nombrePadre} onChange={handleNewPartidaChangeUpper} className="bg-white font-bold" />
            </div>
            <div className="bg-pink-50/50 p-6 rounded-3xl border border-pink-100 space-y-4">
              <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Información de la Madre</p>
              <Input name="nombreMadre" value={newPartida.nombreMadre} onChange={handleNewPartidaChangeUpper} className="bg-white font-bold" />
            </div>
          </div>

          <div className="space-y-6 border-t pt-10">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Droplet className="w-3.5 h-3.5 text-[#D4AF37]"/> Registro de Bautismo Origen</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className={labelClass}>Lugar y Parroquia de Bautismo</label><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChangeUpper} className="py-6" placeholder="EJ: PARROQUIA SAN JUAN BAUTISTA" /></div>
              </div>
              <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div><label className={labelClass}>Libro Baut.</label><Input name="libroBautismo" value={newPartida.libroBautismo} onChange={handleNewPartidaChangeRaw} className="text-center font-mono py-6" /></div>
                  <div><label className={labelClass}>Folio Baut.</label><Input name="folioBautismo" value={newPartida.folioBautismo} onChange={handleNewPartidaChangeRaw} className="text-center font-mono py-6" /></div>
                  <div><label className={labelClass}>Acta Baut.</label><Input name="numeroBautismo" value={newPartida.numeroBautismo} onChange={handleNewPartidaChangeRaw} className="text-center font-mono py-6" /></div>
              </div>
          </div>

          <div className="space-y-2 border-t pt-10">
              <label className={labelClass}><Users className="w-3.5 h-3.5 inline mb-0.5 text-gray-400 mr-1"/> Padrinos</label>
              <Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold" placeholder="NOMBRES SEPARADOS POR COMAS" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
            <div className="space-y-2"><label className={labelClass}><PenTool className="w-3.5 h-3.5 inline mb-0.5 text-red-400 mr-1"/> Ministro (Obispo / Delegado)</label><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChangeUpper} className="py-6 font-black text-red-900 border-l-8 border-l-red-600" /></div>
            <div className="space-y-2"><label className={labelClass}>Da Fe (Párroco)</label><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChangeUpper} className="py-6 font-bold text-gray-500 bg-gray-50" /></div>
          </div>

          <div className="space-y-2 border-t pt-10">
            <label className={labelClass}>Observaciones del Decreto (Opcional)</label>
            <textarea name="observaciones" value={newPartida.observaciones} onChange={handleNewPartidaChangeUpper} rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-red-500/20 uppercase font-bold text-gray-700 bg-amber-50" placeholder="OBSERVACIONES PARA EL DECRETO (ESTO NO SE IMPRIMIRÁ EN LA PARTIDA)..." />
          </div>
        </div>
      </div>

      {/* BOTÓN FLOTANTE */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button onClick={handleSave} disabled={!foundRecord || isLoading} className="bg-gradient-to-r from-green-600 to-green-700 hover:shadow-2xl text-white px-12 py-8 rounded-full font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
          {isLoading ? <Loader2 className="animate-spin w-5 h-5 mr-3" /> : <Save className="w-6 h-6 mr-3" />} Ejecutar Decreto en la Nube
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationCorrectionTab;