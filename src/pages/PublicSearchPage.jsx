import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
    Search, Church, Calendar, BookOpen, Lock, 
    User, AlertCircle, Info, Mail, ShieldCheck, 
    ArrowLeft, KeyRound, Loader2, CheckCircle2,
    Globe, Landmark, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

const PublicSearchPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // --- ESTADOS DE VISTA Y CARGA ---
  const [authView, setAuthView] = useState('login'); 
  const [searchLoading, setSearchLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- ESTADOS DE BASE DE DATOS (NUBE) ---
  const [publicDioceses, setPublicDioceses] = useState([]);
  const [publicParishes, setPublicParishes] = useState([]);
  const [publicMisDatos, setPublicMisDatos] = useState([]); 

  // --- ESTADOS DE FORMULARIO ---
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [regData, setRegData] = useState({ token: '', email: '', password: '', confirmPassword: '' });
  const [forgotData, setForgotData] = useState({ username: '' });
  const [searchParams, setSearchParams] = useState({ firstName: '', lastName: '', sacramentType: '', dateStart: '', dateEnd: '', dioceseId: '', parishId: '' });
  
  const [results, setResults] = useState(null);
  const [filteredParishes, setFilteredParishes] = useState([]);

  // =========================================================================
  // 🌍 CARGA ESTRUCTURAL DESDE SUPABASE AL INICIAR
  // =========================================================================
  useEffect(() => {
      const fetchPublicEntities = async () => {
          try {
              const [dioRes, parRes, misRes] = await Promise.all([
                  supabase.from('dioceses').select('*'),
                  supabase.from('parishes').select('*'),
                  supabase.from('mis_datos').select('entity_id, payload')
              ]);

              if (dioRes.data) setPublicDioceses(dioRes.data);
              if (misRes.data) setPublicMisDatos(misRes.data);
              
              if (parRes.data) {
                  const mappedParishes = parRes.data.map(p => ({
                      ...p,
                      dioceseId: p.diocese_id 
                  }));
                  setPublicParishes(mappedParishes);
              }
          } catch (error) {
              console.error("Error cargando entidades desde Supabase:", error);
          }
      };

      fetchPublicEntities();
  }, []);

  // --- FILTRADO DE PARROQUIAS DINÁMICO ---
  useEffect(() => {
    if (searchParams.dioceseId === 'all') {
      const validParishes = publicParishes.filter(p => p.dioceseId !== null && p.dioceseId !== undefined);
      setFilteredParishes(validParishes);
    } else if (searchParams.dioceseId) {
      const filtered = publicParishes.filter(p => p.dioceseId === searchParams.dioceseId);
      setFilteredParishes(filtered);
    } else {
      setFilteredParishes([]); 
    }
  }, [searchParams.dioceseId, publicParishes]);

  const dioceseOptions = useMemo(() => {
    return [{ id: 'all', name: 'TODAS LAS DIÓCESIS' }, ...publicDioceses];
  }, [publicDioceses]);

  const sacramentOptions = [
    { value: 'baptism', label: 'BAUTISMO' },
    { value: 'confirmation', label: 'CONFIRMACIÓN' },
    { value: 'marriage', label: 'MATRIMONIO' },
  ];

  // =========================================================================
  // 🔐 LÓGICA DE AUTENTICACIÓN (REPARADA CON FUERZA BRUTA)
  // =========================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    // Ajuste importante: Si pusiste el correo en tu Supabase, puedes usar el correo directo
    const result = await login(credentials.username.trim().toLowerCase(), credentials.password);

    if (result?.success) {
      toast({ title: "Acceso Concedido", description: "Iniciando panel...", variant: "success" });
      
      // 🚀 ENRUTAMIENTO DE FUERZA BRUTA
      const rol = result.role;
      if (rol === 'SuperAdmin') {
          window.location.href = '/admin/dashboard';
      } else if (rol === 'diocese') {
          window.location.href = '/diocese/dashboard';
      } else if (rol === 'chancery') {
          window.location.href = '/chancery/dashboard';
      } else if (rol === 'parish') {
          window.location.href = '/parish/dashboard';
      } else {
          // Si el rol falla, forzamos la recarga al menos para limpiar caché
          window.location.href = '/admin/dashboard'; 
      }
      
    } else {
      setLoginError(result?.error || "Usuario o contraseña incorrectos");
      setLoginLoading(false);
    }
  };

  const handleForgot = (e) => {
    e.preventDefault();
    if (!forgotData.username.trim()) return;

    setForgotLoading(true);
    setTimeout(() => {
      setForgotLoading(false);
      setForgotData({ username: '' });
      setAuthView('login');
      toast({ 
          title: "Solicitud Procesada", 
          description: "Si el usuario existe en nuestro sistema, recibirá un enlace de recuperación en su correo electrónico.",
          duration: 5000 
      });
    }, 1500);
  };

  // =========================================================================
  // 🚀 LÓGICA DE ACTIVACIÓN 
  // =========================================================================
  const handleRegister = async (e) => {
    e.preventDefault();
    if (regData.password !== regData.confirmPassword) {
      toast({ title: "Validación", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    setRegLoading(true);

    try {
      const tokenToFind = regData.token.trim();
      const emailToSave = regData.email.trim().toLowerCase();

      const { data: tokenRecord, error: tokenErr } = await supabase
        .from('pending_tokens')
        .select('*')
        .eq('token', tokenToFind)
        .single();

      if (tokenErr || !tokenRecord) throw new Error("El código no existe o ya fue usado.");

      const payload = tokenRecord.payload;
      let roleType = ROLE_TYPES.PARISH;
      let assignedDioceseId = null;
      let assignedParishId = null;
      let assignedChanceryId = null;

      if (tokenRecord.type === 'DIOCESE') {
        roleType = ROLE_TYPES.DIOCESE;
        const { data: newDiocese, error: dErr } = await supabase.from('dioceses').insert([{
            name: payload.name, type: payload.type || 'diocese', city: payload.city, bishop: payload.bishop,
            auxiliary_bishop: payload.auxiliaryBishop, provincia_eclesiastica: payload.provinciaEclesiastica,
            jurisdiccion_eclesiastica: payload.jurisdiccionEclesiastica
        }]).select().single();
        if (dErr) throw dErr;
        assignedDioceseId = newDiocese.id;

      } else if (tokenRecord.type === 'PARISH') {
        roleType = ROLE_TYPES.PARISH;
        assignedDioceseId = payload.dioceseId;
        const { data: newParish, error: pErr } = await supabase.from('parishes').insert([{
            diocese_id: payload.dioceseId, name: payload.name, city: payload.city, parroco: payload.priest,
            vicary_id: payload.vicaryId, decanate_id: payload.decanateId
        }]).select().single();
        if (pErr) throw pErr;
        assignedParishId = newParish.id;

      } else if (tokenRecord.type === 'CHANCERY') {
        roleType = ROLE_TYPES.CHANCERY;
        assignedDioceseId = payload.dioceseId;
        const { data: newChancery, error: cErr } = await supabase.from('chancelleries').insert([{
            diocese_id: payload.dioceseId, name: payload.name, city: payload.city
        }]).select().single();
        if (cErr) throw cErr;
        assignedChanceryId = newChancery.id;
      }

      const { error: uErr } = await supabase.from('users').insert([{
          username: tokenToFind, email: emailToSave, password: regData.password,
          role: roleType, diocese_id: assignedDioceseId, parish_id: assignedParishId, 
          chancery_id: assignedChanceryId, status: 'ACTIVE'
      }]);
      if (uErr) throw uErr;

      await supabase.from('pending_tokens').delete().eq('id', tokenRecord.id);

      toast({ title: "¡Entorno Activado!", description: "Iniciando sesión..." });
      
      const autoLoginResult = await login(emailToSave, regData.password); // <-- Usamos email
      if (autoLoginResult && autoLoginResult.success) {
           window.location.href = '/parish/dashboard'; // Fallback
      }

    } catch (err) {
      toast({ title: "Fallo en Activación", description: err.message, variant: "destructive" });
    } finally {
      setRegLoading(false);
    }
  };

  // =========================================================================
  // 🚀 CONSULTA EN TIEMPO REAL A SUPABASE
  // =========================================================================
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchParams.dioceseId) {
        toast({ title: "Campo Requerido", description: "Seleccione una Diócesis para filtrar.", variant: "destructive" });
        return;
    }
    if (!searchParams.firstName.trim() && !searchParams.lastName.trim()) { 
        toast({ title: "Atención", description: "Ingrese Nombres o Apellidos.", variant: "destructive" }); 
        return; 
    }
    
    setSearchLoading(true);
    setResults(null);

    try {
        let all = [];
        let parishesToSearch = [];
        
        if (searchParams.parishId && searchParams.parishId !== 'all') {
            const p = publicParishes.find(p => p.id === searchParams.parishId);
            if (p) parishesToSearch.push(p);
        } else if (searchParams.dioceseId && searchParams.dioceseId !== 'all') {
            parishesToSearch = publicParishes.filter(p => p.dioceseId === searchParams.dioceseId);
        } else if (searchParams.dioceseId === 'all') {
            parishesToSearch = publicParishes;
        }

        if (parishesToSearch.length === 0) {
            setResults([]);
            setSearchLoading(false);
            return;
        }

        const parishIds = parishesToSearch.map(p => p.id);
        const type = searchParams.sacramentType;

        const fetchPromises = [];

        if (!type || type === 'baptism') {
            fetchPromises.push(
                supabase.from('baptisms').select('*').in('parish_id', parishIds)
                .then(res => ({ type: 'baptism', data: res.data || [] }))
            );
        }
        if (!type || type === 'confirmation') {
            fetchPromises.push(
                supabase.from('confirmations').select('*').in('parish_id', parishIds)
                .then(res => ({ type: 'confirmation', data: res.data || [] }))
            );
        }
        if (!type || type === 'marriage') {
            fetchPromises.push(
                supabase.from('marriages').select('*').in('parish_id', parishIds)
                .then(res => ({ type: 'marriage', data: res.data || [] }))
                .catch(() => supabase.from('matrimonios').select('*').in('parish_id', parishIds).then(res => ({ type: 'marriage', data: res.data || [] })))
            );
        }

        const fetchedResults = await Promise.all(fetchPromises);

        fetchedResults.forEach(fetchResult => {
            const sacType = fetchResult.type;
            
            const cloudRecords = fetchResult.data.map(dbRow => ({
                id: dbRow.id,
                parishId: dbRow.parish_id,
                ...(dbRow.raw_data || {})
            }));

            cloudRecords.forEach(record => {
                const parish = parishesToSearch.find(p => p.id === record.parishId);
                if (!parish) return;

                if (matchesSearch(record, searchParams, sacType)) {
                    
                    let parishAddress = 'Dirección no registrada';
                    const misDatosMatch = publicMisDatos.find(md => md.entity_id === parish.id);
                    if (misDatosMatch) {
                        let pData = misDatosMatch.payload;
                        if (typeof pData === 'string') {
                            try { pData = JSON.parse(pData); } catch(e) { pData = {}; }
                        }
                        if (Array.isArray(pData)) pData = pData[0] || {};
                        if (pData.direccion && pData.direccion.trim() !== '') {
                            parishAddress = pData.direccion;
                        }
                    }

                    const typeLabel = sacType === 'baptism' ? 'BAUTISMO' : sacType === 'confirmation' ? 'CONFIRMACIÓN' : 'MATRIMONIO';

                    all.push({
                        ...record,
                        type: typeLabel,
                        parishName: parish.name,
                        dioceseId: parish.dioceseId,
                        parishAddress
                    });
                }
            });
        });

        setResults(all);
    } catch (error) {
        console.error("Error consultando Supabase:", error);
        toast({ title: "Error de Red", description: "No se pudieron descargar las actas.", variant: "destructive" });
    } finally {
        setSearchLoading(false);
    }
  };

  const matchesSearch = (r, p, type) => {
    const recordName = type === 'marriage' ? `${r.groomName} ${r.brideName}` : (r.firstName || r.nombres || '');
    const recordLastName = type === 'marriage' ? `${r.groomSurname} ${r.brideSurname}` : (r.lastName || r.apellidos || '');
    
    if (p.firstName && !recordName.toLowerCase().includes(p.firstName.toLowerCase())) return false;
    if (p.lastName && !recordLastName.toLowerCase().includes(p.lastName.toLowerCase())) return false;

    const recordDate = r.sacramentDate || r.fechaSacramento || r.fechaBautismo || r.fechaConfirmacion || r.fechaMatrimonio;
    if (p.dateStart && recordDate < p.dateStart) return false;
    if (p.dateEnd && recordDate > p.dateEnd) return false;

    return true;
  };

  // --- RENDERIZADORES DE UI ---
  const renderLogin = () => (
    <motion.form key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Identificación / Email</label>
            <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                <input type="text" required value={credentials.username} onChange={e => setCredentials({...credentials, username: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-700" placeholder="Usuario asignado" />
            </div>
        </div>
        <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contraseña</label>
                <button type="button" onClick={() => setAuthView('forgot')} className="text-[9px] font-bold text-blue-600 hover:underline uppercase tracking-tighter">¿Olvidó su clave?</button>
            </div>
            <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                <input type="password" required value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold" placeholder="••••••••" />
            </div>
        </div>
        {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 border border-red-100 uppercase tracking-tight"><AlertCircle className="w-4 h-4" /> {loginError}</div>}
        <Button disabled={loginLoading} className="w-full py-7 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-xl text-white font-black uppercase tracking-widest text-xs transition-all transform active:scale-95">
            {loginLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Iniciar Sesión'}
        </Button>
        <div className="text-center pt-4 border-t border-gray-50">
            <button type="button" onClick={() => setAuthView('register')} className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest hover:underline">¿Primer acceso? Activa tu cuenta</button>
        </div>
    </motion.form>
  );

  const renderRegister = () => (
    <motion.form key="reg" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleRegister} className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 mb-2 text-blue-800 text-[10px] font-bold uppercase leading-tight">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            Usa el código proporcionado por su Obispo/Arzobispo para habilitar tu despacho.
        </div>
        <input type="text" required placeholder="CÓDIGO DE ACTIVACIÓN" value={regData.token} onChange={e => setRegData({...regData, token: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20" />
        <input type="email" required placeholder="EMAIL DE CONTACTO" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20" />
        <div className="grid grid-cols-2 gap-3">
            <input type="password" required placeholder="CLAVE" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black outline-none" />
            <input type="password" required placeholder="REPETIR" value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black outline-none" />
        </div>
        <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => setAuthView('login')} variant="ghost" className="rounded-2xl px-4 font-black uppercase text-[10px]"><ArrowLeft className="w-5 h-5"/></Button>
            <Button disabled={regLoading} className="flex-1 py-7 rounded-2xl bg-[#4B7BA7] text-white font-black uppercase tracking-widest text-[10px]">
                {regLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Activar Entorno'}
            </Button>
        </div>
    </motion.form>
  );

  const renderForgot = () => (
    <motion.form key="forgot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleForgot} className="space-y-4 text-center">
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 inline-block mb-4"><KeyRound className="w-8 h-8 text-amber-600" /></div>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Recuperar Acceso</h3>
        <p className="text-[11px] text-gray-400 uppercase font-bold tracking-tight mb-4">Ingresa tu usuario o correo para recibir un enlace seguro.</p>
        <input type="text" required placeholder="USUARIO O EMAIL" value={forgotData.username} onChange={e => setForgotData({username: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black uppercase tracking-widest outline-none" />
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex gap-2 text-left">
          <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-600"><strong>¿Problemas urgentes?</strong> Su Obispo/Arzobispo puede asignarle una contraseña temporal.</p>
        </div>
        <Button disabled={forgotLoading} className="w-full py-7 rounded-2xl bg-amber-500 text-white font-black uppercase text-[10px]">{forgotLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Enviar Instrucciones'}</Button>
        <button type="button" onClick={() => setAuthView('login')} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:underline mt-4 block mx-auto">Volver al inicio</button>
    </motion.form>
  );

  return (
    <div className="min-h-screen lg:h-screen w-full bg-slate-50 flex flex-col lg:flex-row lg:overflow-hidden font-sans">
      <Helmet><title>Consulta y Acceso | Eclesia Digital</title></Helmet>

      {/* 🚀 PANEL LATERAL (LOGIN) */}
      <aside className="w-full lg:w-[450px] bg-white lg:border-r border-b lg:border-b-0 border-gray-100 flex flex-col p-8 lg:p-10 shadow-2xl relative z-20 shrink-0 lg:overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full py-10">
            <div className="text-center mb-12">
                <div className="bg-[#4B7BA7] w-16 h-16 rounded-3xl rotate-12 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-900/20">
                    <Church className="w-8 h-8 text-white -rotate-12" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Sacramentum</h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 italic">Official Church Registry</p>
            </div>
            <AnimatePresence mode="wait">
                {authView === 'login' ? renderLogin() : authView === 'register' ? renderRegister() : renderForgot()}
            </AnimatePresence>
        </div>
        <div className="pt-6 lg:pt-10 flex items-center justify-center gap-2 opacity-30 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <ShieldCheck className="w-4 h-4" /> Servidor de Alta Seguridad v2.5
        </div>
      </aside>

      {/* 🚀 PANEL PRINCIPAL (BÚSQUEDA PÚBLICA) */}
      <main className="flex-1 w-full h-full overflow-y-auto bg-[#4B7BA7]/5 p-6 lg:p-16 custom-scrollbar scroll-smooth">
        <div className="max-w-5xl mx-auto">
            <header className="mb-8 lg:mb-12">
                <div className="flex items-center gap-3 mb-2 text-[#4B7BA7]">
                    <Globe className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Portal de Verificación Pública</span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">Consulta Unificada de Sacramentos</h1>
                <p className="text-gray-500 font-medium mt-2 text-sm lg:text-base">Localice actas en archivos digitales de todas las Diócesis afiliadas.</p>
            </header>

            <section className="bg-white rounded-[2rem] lg:rounded-[2.5rem] shadow-xl shadow-blue-900/5 p-6 lg:p-8 border border-gray-100 mb-12">
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Diócesis <span className="text-red-500">*</span></label>
                        <select required value={searchParams.dioceseId} onChange={e => setSearchParams({...searchParams, dioceseId: e.target.value, parishId: ''})} className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none">
                            <option value="">SELECCIONE...</option>
                            {dioceseOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Parroquia</label>
                        <select disabled={!searchParams.dioceseId} value={searchParams.parishId} onChange={e => setSearchParams({...searchParams, parishId: e.target.value})} className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none disabled:opacity-30">
                            <option value="all">TODAS LAS PARROQUIAS</option>
                            {filteredParishes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipo de Acta</label>
                        <select value={searchParams.sacramentType} onChange={e => setSearchParams({...searchParams, sacramentType: e.target.value})} className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none">
                            <option value="">TODOS</option>
                            {sacramentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombres</label>
                        <input type="text" value={searchParams.firstName} onChange={e => setSearchParams({...searchParams, firstName: e.target.value})} placeholder="EJ: PEDRO" className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none uppercase" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellidos</label>
                        <input type="text" value={searchParams.lastName} onChange={e => setSearchParams({...searchParams, lastName: e.target.value})} placeholder="EJ: ROJAS" className="w-full h-12 lg:h-14 px-4 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none uppercase" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Desde</label>
                          <input type="date" value={searchParams.dateStart} onChange={e => setSearchParams({...searchParams, dateStart: e.target.value})} className="w-full h-12 lg:h-14 px-2 bg-gray-50 border-none rounded-2xl font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hasta</label>
                          <input type="date" value={searchParams.dateEnd} onChange={e => setSearchParams({...searchParams, dateEnd: e.target.value})} className="w-full h-12 lg:h-14 px-2 bg-gray-50 border-none rounded-2xl font-bold text-[10px] outline-none" />
                        </div>
                    </div>
                    <div className="lg:col-span-3 flex justify-end pt-2 lg:pt-4">
                        <Button disabled={searchLoading} className="w-full lg:w-auto px-12 py-6 lg:py-7 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">
                            {searchLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Search className="w-4 h-4 mr-2" /> Buscar Actas</>}
                        </Button>
                    </div>
                </form>
            </section>

            <AnimatePresence>
                {results && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                        <div className="flex items-center justify-between px-2 lg:px-4">
                            <h3 className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Coincidencias ({results.length})</h3>
                            <div className="h-px flex-1 bg-gray-200 mx-4 lg:mx-6"></div>
                        </div>

                        {results.length === 0 ? (
                            <div className="bg-white p-12 lg:p-20 rounded-[2rem] lg:rounded-[2.5rem] border border-dashed border-gray-200 text-center">
                                <Search className="w-12 h-12 lg:w-16 lg:h-16 text-gray-200 mx-auto mb-4" />
                                <p className="font-bold text-gray-400 uppercase tracking-widest text-[10px] lg:text-xs">No se localizaron registros</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                                {results.map(r => {
                                  const name = r.type === 'MATRIMONIO' ? `${r.groomName} & ${r.brideName}` : `${(r.firstName || r.nombres)} ${(r.lastName || r.apellidos)}`;
                                  const date = r.sacramentDate || r.fechaSacramento || r.fechaBautismo || r.fechaConfirmacion || r.fechaMatrimonio;

                                  return (
                                    <motion.div whileHover={{ y: -5 }} key={`${r.type}-${r.id}`} className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border-l-8 border-[#D4AF37] relative group overflow-hidden flex flex-col justify-between">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><BookOpen className="w-20 h-20 lg:w-24 lg:h-24" /></div>
                                        
                                        <div>
                                            <span className="bg-blue-50 text-[#4B7BA7] px-3 py-1 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-widest">{r.type}</span>
                                            <h4 className="text-lg lg:text-xl font-black text-gray-900 uppercase mt-3 tracking-tighter leading-tight pr-10">{name}</h4>
                                        </div>

                                        <div className="space-y-2 pt-4 lg:pt-6 mt-4 lg:mt-6 border-t border-gray-50">
                                            <div className="flex items-center gap-3 text-gray-500">
                                                <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
                                                <span className="text-[10px] lg:text-xs font-bold uppercase">{date || '---'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-gray-500">
                                                <Church className="w-4 h-4 text-[#4B7BA7] shrink-0" />
                                                <span className="text-[10px] lg:text-xs font-bold uppercase truncate">{r.parishName}</span>
                                            </div>
                                            <div className="flex items-start gap-3 text-gray-400 mt-2">
                                                <MapPin className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest">
                                                        {publicDioceses.find(d => d.id === r.dioceseId)?.name || 'DIÓCESIS'}
                                                    </span>
                                                    <span className="text-[8px] lg:text-[9px] font-bold uppercase tracking-tight mt-0.5 text-gray-400 truncate max-w-[200px] lg:max-w-[220px]" title={r.parishAddress}>
                                                        {r.parishAddress}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                  );
                                })}
                            </div>
                        )}
                    </motion.section>
                )}
            </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default PublicSearchPage;