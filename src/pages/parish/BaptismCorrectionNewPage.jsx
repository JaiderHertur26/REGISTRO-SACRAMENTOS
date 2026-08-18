import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, AlertCircle, CheckCircle2, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import { marginalNotesEngine } from '@/utils/marginalNotesEngine'; // 🚀 IMPORTAMOS EL CEREBRO

const BaptismCorrectionNewPage = () => {
  const { user } = useAuth();
  const {
    getConfirmations,
    getMatrimonios,
    createBaptismCorrection,
    getParrocoActual,
    getMisDatosList
  } = useAppData();
  const { toast } = useToast();
  const navigate = useNavigate();

  // --- STATE MANAGEMENT ---
  const [isLoading, setIsLoading] = useState(false);
  const [cloudParams, setCloudParams] = useState({});

  // --- BAPTISM STATE ---
  const [decreeData, setDecreeData] = useState({
    parroquia: '',
    numeroDeDecreto: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    conceptoAnulacion: '',
    nombreBautizado: '',
    Libro: '',
    folio: '',
    numero: ''
  });

  const [foundRecord, setFoundRecord] = useState(null);
  const [searchMessage, setSearchMessage] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  const [newPartida, setNewPartida] = useState({
    lugarBautismo: '',
    fechaSacramento: '',
    apellidos: '',
    nombres: '',
    fechaNacimiento: '',
    lugarNacimiento: '',
    sexo: '', 
    nombrePadre: '',
    nombreMadre: '',
    tipoUnionPadres: '', 
    abuelosPaternos: '',
    abuelosMaternos: '',
    padrinos: '',
    ministro: '',
    daFe: '',
    observaciones: ''
  });

  // --- CONFIRMATION STATE ---
  const [confDecreeData, setConfDecreeData] = useState({
    parroquia: '', decreeNumber: '', decreeDate: new Date().toISOString().split('T')[0],
    conceptoAnulacionId: '', targetName: '', book: '', page: '', entry: ''
  });

  const [confFoundRecord, setConfFoundRecord] = useState(null);
  const [confSearchMessage, setConfSearchMessage] = useState(null);
  const [confSuggestions, setConfSuggestions] = useState([]);
  const [showConfSuggestions, setShowConfSuggestions] = useState(false);
  const confWrapperRef = useRef(null);

  const [newConfPartida, setNewConfPartida] = useState({
    sacramentDate: '', firstName: '', lastName: '', birthDate: '',
    lugarNacimientoDetalle: '', lugarConfirmacion: '', fatherName: '', motherName: '',
    padrino: '', madrina: '', minister: '', ministerFaith: ''
  });

  // --- MARRIAGE STATE ---
  const [marDecreeData, setMarDecreeData] = useState({
    parroquia: '', decreeNumber: '', decreeDate: new Date().toISOString().split('T')[0],
    conceptoAnulacionId: '', targetName: '', book: '', page: '', entry: ''
  });

  const [marFoundRecord, setMarFoundRecord] = useState(null);
  const [marSearchMessage, setMarSearchMessage] = useState(null);
  const [marSuggestions, setMarSuggestions] = useState([]);
  const [showMarSuggestions, setShowMarSuggestions] = useState(false);
  const marWrapperRef = useRef(null);

  const [newMarPartida, setNewMarPartida] = useState({
    sacramentDate: '', lugarMatrimonio: '', husbandName: '', husbandSurname: '',
    husbandBirthDate: '', husbandPlaceOfBirth: '', husbandFather: '', husbandMother: '',
    wifeName: '', wifeSurname: '', wifeBirthDate: '', wifePlaceOfBirth: '',
    wifeFather: '', wifeMother: '', witnesses: '', minister: '', ministerFaith: ''
  });

  const [conceptos, setConceptos] = useState([]);
  const [activePriest, setActivePriest] = useState(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const initializeData = async () => {
      if (!user) return;

      try {
        if (user.parishId) {
          const misDatos = getMisDatosList(user.parishId);
          let parishLabel = '';

          if (misDatos && misDatos.length > 0) {
            const dato = misDatos[0];
            const nombre = dato.nombre || user.parishName || 'Parroquia';
            const ciudad = dato.ciudad || user.city || 'Ciudad';
            parishLabel = `${nombre} - ${ciudad}`;
          } else {
            parishLabel = `${user.parishName || 'Parroquia'} - ${user.city || 'Ciudad'}`;
          }

          setDecreeData(prev => ({ ...prev, parroquia: parishLabel }));
          setConfDecreeData(prev => ({ ...prev, parroquia: parishLabel }));
          setMarDecreeData(prev => ({ ...prev, parroquia: parishLabel }));

          const priest = getParrocoActual(user.parishId);
          if (priest) {
            const priestName = `${priest.nombre} ${priest.apellido || ''}`.trim();
            setActivePriest(priestName);
            setNewPartida(prev => ({ ...prev, daFe: priestName }));
            setNewConfPartida(prev => ({ ...prev, ministerFaith: priestName }));
            setNewMarPartida(prev => ({ ...prev, ministerFaith: priestName }));
          }

          const { data: paramsData } = await supabase
            .from('parish_parameters')
            .select('bautizos_params')
            .eq('parish_id', user.parishId)
            .maybeSingle();

          if (paramsData && paramsData.bautizos_params) {
            setCloudParams(paramsData.bautizos_params);
          }
        }

        let targetDioceseId = user.dioceseId || user.diocese_id;

        if (!targetDioceseId && user.parishId) {
          const { data: parishData } = await supabase
            .from('parishes')
            .select('diocese_id')
            .eq('id', user.parishId)
            .single();
          if (parishData) targetDioceseId = parishData.diocese_id;
        }

        if (!targetDioceseId) {
          console.warn("⚠️ No se pudo determinar la diócesis de la parroquia.");
          setConceptos([]);
          return;
        }

        const { data, error } = await supabase
          .from('conceptos_anulacion')
          .select(`id, codigo, concepto, tipo, chancelleries!inner ( diocese_id )`)
          .eq('chancelleries.diocese_id', targetDioceseId)
          .ilike('tipo', 'porCorreccion')
          .order('codigo', { ascending: true });

        if (error) throw error;

        setConceptos(data || []);

      } catch (error) {
        console.error("❌ Error general al inicializar:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los conceptos de corrección.",
          variant: "destructive"
        });
      }
    };

    initializeData();
  }, [user, getParrocoActual, getMisDatosList, toast]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
      if (confWrapperRef.current && !confWrapperRef.current.contains(event.target)) setShowConfSuggestions(false);
      if (marWrapperRef.current && !marWrapperRef.current.contains(event.target)) setShowMarSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, confWrapperRef, marWrapperRef]);

  const getSafeValue = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
  };

  const handleDecreeChange = async (e) => {
    const { name, value } = e.target;
    setDecreeData(prev => ({ ...prev, [name]: value }));

    if (['Libro', 'folio', 'numero'].includes(name)) {
      setFoundRecord(null);
      setSearchMessage(null);
    }

    if (name === 'nombreBautizado') {
      if (value.length > 2) {
        try {
          const { data, error } = await supabase
            .from('baptisms')
            .select('*')
            .eq('parish_id', user?.parishId)
            .ilike('first_name', `%${value}%`)
            .limit(5);

          if (error) throw error;

          const mappedSuggestions = data.map(dbRecord => ({
            ...dbRecord.raw_data,
            id: dbRecord.id,
            firstName: dbRecord.first_name,
            lastName: dbRecord.last_name
          }));

          setSuggestions(mappedSuggestions);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Error buscando sugerencias:", error);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  const handleSuggestionClick = (record) => {
    const fullName = `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`;
    setDecreeData(prev => ({ ...prev, nombreBautizado: fullName }));
    setShowSuggestions(false);
  };

  const handleNewPartidaChange = (e) => {
    const { name, value } = e.target;
    setNewPartida(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = async () => {
    const { Libro, folio, numero } = decreeData;
    if (!Libro || !folio || !numero) {
      setSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." });
      return;
    }

    setIsLoading(true);
    setSearchMessage(null);
    setFoundRecord(null);

    try {
      const formattedBook = String(Libro).padStart(4, '0');
      const formattedPage = String(folio).padStart(4, '0');
      const formattedEntry = String(numero).padStart(4, '0');

      const { data: dbRecord, error } = await supabase
        .from('baptisms')
        .select('*')
        .eq('parish_id', user?.parishId)
        .eq('book_number', formattedBook)
        .eq('page_number', formattedPage)
        .eq('entry_number', formattedEntry)
        .maybeSingle();

      if (error) throw error;

      if (dbRecord) {
        if (dbRecord.status === 'anulada') {
          setSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA." });
        } else {
          const found = { ...dbRecord.raw_data, id: dbRecord.id, status: dbRecord.status };

          setFoundRecord(found);
          setSearchMessage({ type: 'success', text: "Partida encontrada exitosamente." });

          const foundName = `${dbRecord.first_name || found.nombres || ''} ${dbRecord.last_name || found.apellidos || ''}`.trim();
          if (!decreeData.nombreBautizado) setDecreeData(prev => ({ ...prev, nombreBautizado: foundName }));

          const rawSex = String(dbRecord.gender || getSafeValue(found, 'sex', 'sexo', 'genero')).toUpperCase();
          let mappedSex = '';
          if (rawSex === '2' || rawSex === 'FEMENINO' || rawSex === 'F') mappedSex = 'FEMENINO';
          else if (rawSex === '1' || rawSex === 'MASCULINO' || rawSex === 'M') mappedSex = 'MASCULINO';

          const rawUnion = String(dbRecord.tipo_union_padres || getSafeValue(found, 'tipoUnionPadres', 'tipohijo') || '').toUpperCase();
          let mappedUnion = '';
          if (rawUnion === '1' || rawUnion.includes('CATÓLICO') || rawUnion.includes('CATOLICO')) mappedUnion = 'MATRIMONIO CATÓLICO';
          else if (rawUnion === '2' || rawUnion.includes('CIVIL')) mappedUnion = 'MATRIMONIO CIVIL';
          else if (rawUnion === '3' || rawUnion.includes('LIBRE')) mappedUnion = 'UNIÓN LIBRE';
          else if (rawUnion === '4' || rawUnion.includes('SOLTERA')) mappedUnion = 'MADRE SOLTERA';
          else if (rawUnion === '5' || rawUnion.includes('OTRO')) mappedUnion = 'OTRO CASO';
          else mappedUnion = rawUnion;

          setNewPartida(prev => ({
            ...prev,
            nombres: dbRecord.first_name || getSafeValue(found, 'firstName', 'nombres'),
            apellidos: dbRecord.last_name || getSafeValue(found, 'lastName', 'apellidos'),
            fechaSacramento: dbRecord.sacrament_date || getSafeValue(found, 'sacramentDate', 'fechaSacramento', 'fecbau'),
            fechaNacimiento: dbRecord.birth_date || getSafeValue(found, 'birthDate', 'fechaNacimiento', 'fecnac'),
            lugarNacimiento: dbRecord.birth_place || getSafeValue(found, 'lugarNacimientoDetalle', 'lugarNacimiento', 'lugarn', 'lugnac'),
            lugarBautismo: dbRecord.sacrament_place || getSafeValue(found, 'lugarBautismo', 'lugbau', 'lugarBautismoDetalle'),
            sexo: mappedSex,
            nombrePadre: dbRecord.father_name || getSafeValue(found, 'fatherName', 'nombrePadre', 'padre'),
            nombreMadre: dbRecord.mother_name || getSafeValue(found, 'motherName', 'nombreMadre', 'madre'),
            tipoUnionPadres: mappedUnion,
            abuelosPaternos: getSafeValue(found, 'paternalGrandparents', 'abuelosPaternos', 'abuepat'),
            abuelosMaternos: getSafeValue(found, 'maternalGrandparents', 'abuelosMaternos', 'abuemat'),
            padrinos: dbRecord.godparents || (Array.isArray(found.godparents) ? found.godparents.map(g => g.name).join(', ') : getSafeValue(found, 'godparents', 'padrinos')),
            ministro: dbRecord.minister || getSafeValue(found, 'minister', 'ministro'),
            daFe: prev.daFe || getSafeValue(found, 'ministerFaith', 'daFe', 'dafe'),
            observaciones: ''
          }));
        }
      } else {
        setSearchMessage({ type: 'error', text: "No se encontró ninguna partida con esos datos en la nube." });
      }
    } catch (error) {
      console.error("Error en búsqueda:", error);
      setSearchMessage({ type: 'error', text: "Ocurrió un error conectando con la base de datos." });
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    if (!decreeData.numeroDeDecreto || !decreeData.fechaEmision || !decreeData.conceptoAnulacion || !decreeData.nombreBautizado || !foundRecord) return false;
    const required = ['fechaSacramento', 'nombres', 'apellidos', 'fechaNacimiento', 'lugarNacimiento', 'nombrePadre', 'nombreMadre', 'ministro', 'daFe'];
    return required.every(field => newPartida[field]);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({ title: "Error de Validación", description: "Complete todos los campos requeridos.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
        // 🚀 VALIDACIÓN DE DUPLICIDAD DE NÚMERO DE DECRETO
        const { data: existingDecree, error: checkError } = await supabase
            .from('decretos')
            .select('id')
            .eq('tipo', 'correccion')
            .contains('payload', { decreeNumber: decreeData.numeroDeDecreto })
            .maybeSingle();

        if (checkError) throw new Error("Error validando el número de decreto.");

        if (existingDecree) {
            setIsLoading(false);
            toast({ 
                title: "Número de Decreto Duplicado", 
                description: `El decreto número ${decreeData.numeroDeDecreto} ya se encuentra registrado en el sistema. Por favor, asigne un número diferente.`, 
                variant: "destructive" 
            });
            return;
        }

        const supletorioLibro = cloudParams.suplementarioLibro || 1;
        const supletorioFolio = cloudParams.suplementarioFolio || 1;
        const supletorioNumero = cloudParams.suplementarioNumero || 1;

        // 🧠 LLAMADA AL MOTOR INTELIGENTE PARA NOTA ANULADA
        const noteAnulada = marginalNotesEngine.forAnnulledCorrection(user?.parishId, {
            numeroDecreto: decreeData.numeroDecreto,
            fechaDecreto: decreeData.fechaEmision,
            libroNuevo: supletorioLibro,
            folioNuevo: supletorioFolio,
            numeroNuevo: supletorioNumero
        });

        // 🧠 LLAMADA AL MOTOR INTELIGENTE PARA NOTA NUEVA (SUPLETORIA)
        const notaSupletoriaFinal = marginalNotesEngine.forNewCorrection(user?.parishId, {
            numeroDecreto: decreeData.numeroDecreto,
            fechaDecreto: decreeData.fechaEmision,
            libroAnulada: decreeData.Libro,
            folioAnulada: decreeData.folio,
            numeroAnulada: decreeData.numero,
            ministro: newPartida.daFe
        });

        const partidaToSave = {
          ...newPartida,
          Libro: String(supletorioLibro).padStart(4, '0'),
          folio: String(supletorioFolio).padStart(4, '0'),
          numero: String(supletorioNumero).padStart(4, '0'),
          book_number: String(supletorioLibro).padStart(4, '0'),
          page_number: String(supletorioFolio).padStart(4, '0'),
          entry_number: String(supletorioNumero).padStart(4, '0'),

          firstName: newPartida.nombres, lastName: newPartida.apellidos,
          fecbau: newPartida.fechaSacramento,
          fecnac: newPartida.fechaNacimiento,
          lugarn: newPartida.lugarNacimiento, lugarNacimientoDetalle: newPartida.lugarNacimiento,
          lugarBautismoDetalle: newPartida.lugarBautismo,
          sex: newPartida.sexo,
          padre: newPartida.nombrePadre, fatherName: newPartida.nombrePadre,
          madre: newPartida.nombreMadre, motherName: newPartida.nombreMadre,
          abuepat: newPartida.abuelosPaternos, paternalGrandparents: newPartida.abuelosPaternos,
          abuemat: newPartida.abuelosMaternos, maternalGrandparents: newPartida.abuelosMaternos,
          godparents: newPartida.padrinos, tipohijo: newPartida.tipoUnionPadres,
          minister: newPartida.ministro, dafe: newPartida.daFe, ministerFaith: newPartida.daFe,
          anulado: false, estado: 'permanente', status: 'seated',
          notaMarginal: notaSupletoriaFinal
        };

        const payloadDecree = {
          decreeNumber: decreeData.numeroDeDecreto,
          decreeDate: decreeData.fechaEmision,
          conceptoAnulacionId: decreeData.conceptoAnulacion,
          targetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(),
          observaciones: newPartida.observaciones,
          
          fechaSacramento: newPartida.fechaSacramento,
          sexo: newPartida.sexo,
          fechaNacimiento: newPartida.fechaNacimiento,
          lugarNacimiento: newPartida.lugarNacimiento,
          nombrePadre: newPartida.nombrePadre,
          nombreMadre: newPartida.nombreMadre,
          tipoUnionPadres: newPartida.tipoUnionPadres,
          abuelosPaternos: newPartida.abuelosPaternos,
          abuelosMaternos: newPartida.abuelosMaternos,
          padrinos: newPartida.padrinos
        };

        const result = await createBaptismCorrection(
          payloadDecree,
          foundRecord.id,
          partidaToSave,
          user?.parishId
        );

        // 🚀 Aplicamos la nota de anulación al localStorage para inmediatez
        const baptismsKey = `baptisms_${user?.parishId}`;
        let allBaptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
        const originalIndex = allBaptisms.findIndex(b => b.id === foundRecord.id);
        if (originalIndex !== -1) {
          allBaptisms[originalIndex].notaMarginal = noteAnulada;
          localStorage.setItem(baptismsKey, JSON.stringify(allBaptisms));
        }

        setIsLoading(false);

        if (result.success) {
          toast({ title: "Éxito", description: "Decreto guardado correctamente.", className: "bg-green-50 border-green-200 text-green-900" });
          navigate('/parroquia/decretos/ver-correcciones');
        } else {
          throw new Error(result.message || "Error al guardar el decreto.");
        }
    } catch (error) {
        setIsLoading(false);
        console.error("Error al guardar:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ... rest of the code (ConfDecreeChange, handleNewMarPartidaChange, etc)
  const handleConfDecreeChange = (e) => {
    const { name, value } = e.target;
    setConfDecreeData(prev => ({ ...prev, [name]: value }));

    if (['book', 'page', 'entry'].includes(name)) {
      setConfFoundRecord(null);
      setConfSearchMessage(null);
    }

    if (name === 'targetName') {
      if (value.length > 2) {
        const allConfirmations = getConfirmations(user?.parishId);
        const filtered = allConfirmations.filter(c => {
          const fullName = `${c.firstName || ''} ${c.lastName || ''} ${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
          return fullName.includes(value.toLowerCase());
        }).slice(0, 5);
        setConfSuggestions(filtered);
        setShowConfSuggestions(true);
      } else {
        setConfSuggestions([]);
        setShowConfSuggestions(false);
      }
    }
  };

  const handleConfSuggestionClick = (record) => {
    const fullName = `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`;
    setConfDecreeData(prev => ({ ...prev, targetName: fullName }));
    setShowConfSuggestions(false);
  };

  const handleNewConfPartidaChange = (e) => {
    const { name, value } = e.target;
    setNewConfPartida(prev => ({ ...prev, [name]: value }));
  };

  const handleConfSearch = () => {
    const { book, page, entry } = confDecreeData;
    if (!book || !page || !entry) {
      setConfSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." });
      return;
    }

    setIsLoading(true);
    setConfSearchMessage(null);
    setConfFoundRecord(null);

    setTimeout(() => {
      const allConfirmations = getConfirmations(user?.parishId);
      const found = allConfirmations.find(c =>
        String(c.book_number || c.libro) === String(book) &&
        String(c.page_number || c.folio) === String(page) &&
        String(c.entry_number || c.numeroActa || c.numero) === String(entry)
      );

      if (found) {
        if (found.status === 'anulada' || found.estado === 'anulada') {
          setConfSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA." });
        } else {
          setConfFoundRecord(found);
          setConfSearchMessage({ type: 'success', text: "Partida encontrada exitosamente." });

          const foundName = `${found.firstName || found.nombres || ''} ${found.lastName || found.apellidos || ''}`.trim();
          if (!confDecreeData.targetName) setConfDecreeData(prev => ({ ...prev, targetName: foundName }));

          setNewConfPartida(prev => ({
            ...prev,
            firstName: getSafeValue(found, 'firstName', 'nombres'),
            lastName: getSafeValue(found, 'lastName', 'apellidos'),
            sacramentDate: getSafeValue(found, 'sacramentDate', 'feccof', 'fechaConfirmacion'),
            birthDate: getSafeValue(found, 'birthDate', 'fecnac', 'fechaNacimiento'),
            lugarNacimientoDetalle: getSafeValue(found, 'placeOfBirth', 'lugarNacimiento', 'lugarn'),
            lugarConfirmacion: getSafeValue(found, 'lugarConfirmacion', 'parroquia', 'parishName'),
            fatherName: getSafeValue(found, 'fatherName', 'padre'),
            motherName: getSafeValue(found, 'motherName', 'madre'),
            padrino: getSafeValue(found, 'padrino', 'godfather'),
            madrina: getSafeValue(found, 'madrina', 'godmother'),
            minister: getSafeValue(found, 'minister', 'ministro'),
            ministerFaith: prev.ministerFaith || getSafeValue(found, 'ministerFaith', 'dafe', 'daFe'),
          }));
        }
      } else {
        setConfSearchMessage({ type: 'error', text: "No se encontró ninguna partida con esos datos." });
      }
      setIsLoading(false);
    }, 300);
  };

  const handleMarDecreeChange = (e) => {
    const { name, value } = e.target;
    setMarDecreeData(prev => ({ ...prev, [name]: value }));

    if (['book', 'page', 'entry'].includes(name)) {
      setMarFoundRecord(null);
      setMarSearchMessage(null);
    }

    if (name === 'targetName') {
      if (value.length > 2) {
        const allMatrimonios = getMatrimonios(user?.parishId);
        const filtered = allMatrimonios.filter(m => {
          const husbandFull = `${m.husbandName || ''} ${m.husbandSurname || ''}`.toLowerCase();
          const wifeFull = `${m.wifeName || ''} ${m.wifeSurname || ''}`.toLowerCase();
          const query = value.toLowerCase();
          return husbandFull.includes(query) || wifeFull.includes(query);
        }).slice(0, 5);
        setMarSuggestions(filtered);
        setShowMarSuggestions(true);
      } else {
        setMarSuggestions([]);
        setShowMarSuggestions(false);
      }
    }
  };

  const handleMarSuggestionClick = (record) => {
    const label = `${record.husbandName} ${record.husbandSurname} & ${record.wifeName} ${record.wifeSurname}`;
    setMarDecreeData(prev => ({ ...prev, targetName: label }));
    setShowMarSuggestions(false);
  };

  const handleNewMarPartidaChange = (e) => {
    const { name, value } = e.target;
    setNewMarPartida(prev => ({ ...prev, [name]: value }));
  };

  const handleMarSearch = () => {
    const { book, page, entry } = marDecreeData;
    if (!book || !page || !entry) {
      setMarSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." });
      return;
    }

    setIsLoading(true);
    setMarSearchMessage(null);
    setMarFoundRecord(null);

    setTimeout(() => {
      const allMatrimonios = getMatrimonios(user?.parishId);
      const found = allMatrimonios.find(m =>
        String(m.book_number || m.libro) === String(book) &&
        String(m.page_number || m.folio) === String(page) &&
        String(m.entry_number || m.numeroActa || m.numero) === String(entry)
      );

      if (found) {
        if (found.status === 'anulada' || found.estado === 'anulada') {
          setMarSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA." });
        } else {
          setMarFoundRecord(found);
          setMarSearchMessage({ type: 'success', text: "Partida encontrada exitosamente." });

          const foundName = `${found.husbandName} ${found.husbandSurname} & ${found.wifeName} ${found.wifeSurname}`;
          if (!marDecreeData.targetName) setMarDecreeData(prev => ({ ...prev, targetName: foundName }));

          setNewMarPartida(prev => ({
            ...prev,
            sacramentDate: getSafeValue(found, 'sacramentDate', 'fechaCelebracion', 'fecha'),
            lugarMatrimonio: getSafeValue(found, 'lugarMatrimonio', 'parroquia', 'parishName'),
            husbandName: getSafeValue(found, 'husbandName', 'esposoNombres'),
            husbandSurname: getSafeValue(found, 'husbandSurname', 'esposoApellidos'),
            husbandBirthDate: getSafeValue(found, 'husbandBirthDate', 'esposoFechaNacimiento'),
            husbandPlaceOfBirth: getSafeValue(found, 'husbandPlaceOfBirth', 'esposoLugarNacimiento'),
            husbandFather: getSafeValue(found, 'husbandFather', 'esposoPadre'),
            husbandMother: getSafeValue(found, 'husbandMother', 'esposoMadre'),
            wifeName: getSafeValue(found, 'wifeName', 'esposaNombres'),
            wifeSurname: getSafeValue(found, 'wifeSurname', 'esposaApellidos'),
            wifeBirthDate: getSafeValue(found, 'wifeBirthDate', 'esposaFechaNacimiento'),
            wifePlaceOfBirth: getSafeValue(found, 'wifePlaceOfBirth', 'esposaLugarNacimiento'),
            wifeFather: getSafeValue(found, 'wifeFather', 'esposaPadre'),
            wifeMother: getSafeValue(found, 'wifeMother', 'esposaMadre'),
            witnesses: getSafeValue(found, 'witnesses', 'testigos'),
            minister: getSafeValue(found, 'minister', 'ministro'),
            ministerFaith: prev.ministerFaith || getSafeValue(found, 'ministerFaith', 'dafe', 'daFe'),
          }));
        }
      } else {
        setMarSearchMessage({ type: 'error', text: "No se encontró ninguna partida con esos datos." });
      }
      setIsLoading(false);
    }, 300);
  };

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
      <div className="max-w-6xl mx-auto pb-24">

        {/* CABECERA */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-full"><ArrowLeft /></Button>
            <div>
              <h1 className="text-3xl font-black text-gray-900 font-serif">Crear Decreto de Corrección</h1>
              <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest">{decreeData.parroquia}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="bautizos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-10 bg-gray-100 p-1 rounded-2xl h-14">
            <TabsTrigger value="bautizos" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Bautizos</TabsTrigger>
            <TabsTrigger value="confirmaciones" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Confirmaciones</TabsTrigger>
            <TabsTrigger value="matrimonios" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Matrimonios</TabsTrigger>
          </TabsList>

          {/* ================== TAB BAUTIZOS ================== */}
          <TabsContent value="bautizos" className="space-y-8 animate-in fade-in duration-500">

            {/* SECCIÓN 1: DATOS DEL DECRETO */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4" /> 01. Información del Decreto</h3>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Número de Decreto</label>
                  <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} placeholder="Ej: 024-2025" className="py-6 font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha de Emisión</label>
                  <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} className="py-6" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Concepto de Corrección</label>
                  <select
                    name="conceptoAnulacion"
                    value={decreeData.conceptoAnulacion}
                    onChange={handleDecreeChange}
                    className="w-full h-[50px] px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-sm font-bold text-gray-700"
                  >
                    <option value="">SELECCIONE...</option>
                    {conceptos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                  </select>
                </div>
              </div>

              {/* BÚSQUEDA DE PARTIDA ORIGINAL EN SUPABASE */}
              <div className="mx-8 mb-8 p-8 bg-[#4B7BA7]/5 rounded-3xl border border-[#4B7BA7]/10">
                <h4 className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest mb-6">Localizar Partida Original para Anulación</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="md:col-span-2 relative" ref={wrapperRef}>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nombre Bautizado</label>
                    <Input name="nombreBautizado" value={decreeData.nombreBautizado} onChange={handleDecreeChange} placeholder="Búsqueda por nombre en Nube..." autoComplete="off" />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                        {suggestions.map((record, idx) => (
                          <div key={idx} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700" onClick={() => handleSuggestionClick(record)}>
                            {record.firstName || record.nombres} {record.lastName || record.apellidos}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Libro</label><Input name="Libro" value={decreeData.Libro} onChange={handleDecreeChange} className="bg-white text-center font-mono" /></div>
                  <div className="space-y-1"><label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Folio</label><Input name="folio" value={decreeData.folio} onChange={handleDecreeChange} className="bg-white text-center font-mono" /></div>
                  <div className="space-y-1 flex gap-2">
                    <div className="flex-1"><label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Número</label><Input name="numero" value={decreeData.numero} onChange={handleDecreeChange} className="bg-white text-center font-mono" /></div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSearch} disabled={isLoading} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white h-[45px] rounded-xl font-bold uppercase tracking-widest text-[10px] px-8">
                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <><Search className="w-4 h-4 mr-2" /> Buscar Partida en Nube</>}
                  </Button>
                </div>
                {searchMessage && (
                  <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${searchMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                    {searchMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {searchMessage.text.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: FORMULARIO DE NUEVA PARTIDA */}
            <div className={`bg-white rounded-3xl border border-gray-200 shadow-sm transition-all duration-500 ${!foundRecord ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <div className="bg-gray-50 px-8 py-4 border-b border-gray-200">
                <h3 className="text-xs font-black text-green-600 uppercase tracking-widest flex items-center gap-2"><UserPlus className="w-4 h-4" /> 02. Datos Corregidos para el Libro Supletorio</h3>
              </div>

              <div className="p-10 space-y-10">
                {/* Datos Básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Apellidos</label><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-800" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Nombres</label><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-800" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Bautismo</label><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChange} className="uppercase" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Bautismo</label><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChange} className="py-6" /></div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Sexo</label>
                    <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChange} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl text-sm font-bold bg-gray-50 uppercase">
                      <option value="">SELECCIONE...</option>
                      <option value="MASCULINO">MASCULINO</option>
                      <option value="FEMENINO">FEMENINO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">F. Nacimiento</label><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChange} /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Lugar Nacimiento</label><Input name="lugarNacimiento" value={newPartida.lugarNacimiento} onChange={handleNewPartidaChange} className="uppercase" /></div>
                </div>

                {/* Filiación */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
                  <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Información del Padre</p>
                    <Input name="nombrePadre" placeholder="Nombre completo" value={newPartida.nombrePadre} onChange={handleNewPartidaChange} className="bg-white uppercase font-bold" />
                  </div>
                  <div className="bg-pink-50/50 p-6 rounded-3xl border border-pink-100 space-y-4">
                    <p className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Información de la Madre</p>
                    <Input name="nombreMadre" placeholder="Nombre completo" value={newPartida.nombreMadre} onChange={handleNewPartidaChange} className="bg-white uppercase font-bold" />
                  </div>
                </div>

                {/* Abuelos y Union */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Paternos</label><Input name="abuelosPaternos" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChange} className="uppercase" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Abuelos Maternos</label><Input name="abuelosMaternos" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChange} className="uppercase" /></div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Unión</label>
                    <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChange} className="w-full h-[45px] px-4 border border-gray-200 rounded-xl text-sm font-bold bg-gray-50 uppercase">
                      <option value="">SELECCIONE...</option>
                      <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                      <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                      <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                      <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                      <option value="OTRO CASO">OTRO CASO</option>
                    </select>
                  </div>
                </div>

                {/* Padrinos y Ministro */}
                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Padrinos</label><Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChange} className="py-6 font-bold uppercase" /></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-10">
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Sacerdote Celebrante</label><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChange} className="py-6 uppercase font-black text-blue-900" placeholder="NOMBRE DEL MINISTRO" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase">Da Fe (Firma)</label><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChange} className="py-6 uppercase font-bold text-gray-500 bg-gray-50" /></div>
                </div>

                <div className="space-y-2 border-t pt-10">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Observaciones del Decreto (Opcional)</label>
                  <textarea
                    name="observaciones"
                    value={newPartida.observaciones}
                    onChange={handleNewPartidaChange}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 uppercase font-bold text-gray-700 bg-amber-50"
                    placeholder="ESCRIBA AQUÍ LAS OBSERVACIONES PARA EL DECRETO (ESTO NO SE IMPRIMIRÁ EN LA PARTIDA)..."
                  />
                </div>
              </div>
            </div>

            {/* BOTÓN DE GUARDADO FLOTANTE DENTRO DEL CONTENEDOR */}
            <div className="fixed bottom-8 right-8 z-50">
              <Button
                onClick={handleSave}
                disabled={!foundRecord || isLoading}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:shadow-2xl hover:shadow-green-500/40 text-white px-12 py-8 rounded-full font-black uppercase tracking-widest text-xs shadow-xl transition-all transform active:scale-95 flex items-center gap-3"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-6 h-6" /> Ejecutar Decreto y Guardar</>}
              </Button>
            </div>
          </TabsContent>

          {/* Confirmaciones y Matrimonios */}
          <TabsContent value="confirmaciones">
            <div className="p-20 text-center text-gray-400 italic">Módulo de Corrección de Confirmaciones bajo construcción con el Cerebro Global...</div>
          </TabsContent>

          <TabsContent value="matrimonios">
            <div className="p-20 text-center text-gray-400 italic">Módulo de Corrección de Matrimonios bajo construcción con el Cerebro Global...</div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default BaptismCorrectionNewPage;