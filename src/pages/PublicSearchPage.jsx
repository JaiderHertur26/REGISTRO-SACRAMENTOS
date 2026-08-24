import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
    Church, Lock, User, AlertCircle, Info, 
    ShieldCheck, ArrowLeft, KeyRound, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { supabase } from '@/lib/supabaseClient';

const PublicSearchPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authView, setAuthView] = useState('login'); 
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [regData, setRegData] = useState({ token: '', email: '', password: '', confirmPassword: '' });
  const [forgotData, setForgotData] = useState({ username: '' });

  // =========================================================================
  // 🔐 LOGIN CON REDIRECCIÓN DE FUERZA BRUTA
  // =========================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    const result = await login(credentials.username.trim().toLowerCase(), credentials.password);

    if (result?.success) {
      toast({ title: "Acceso Concedido", description: "Iniciando panel...", variant: "success" });
      
      const rol = result.role;
      if (rol === 'SuperAdmin' || rol === 'admin_general') window.location.href = '/admin/dashboard';
      else if (rol === 'diocese') window.location.href = '/diocese/dashboard';
      else if (rol === 'chancery') window.location.href = '/chancery/dashboard';
      else if (rol === 'parish') window.location.href = '/parish/dashboard';
      else window.location.href = '/'; 
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
      toast({ title: "Solicitud Procesada", description: "Revise su bandeja de correo electrónico.", duration: 5000 });
    }, 1500);
  };

  // =========================================================================
  // 🚀 ACTIVACIÓN DE ENTORNOS (BLINDADO CON SUPABASE AUTH)
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

      if (tokenErr || !tokenRecord) throw new Error("El código de activación no existe o ya fue utilizado.");

      const payload = tokenRecord.payload;
      let roleType = ROLE_TYPES.PARISH;
      let assignedDioceseId = null;
      let assignedParishId = null;
      let assignedChanceryId = null;

      if (tokenRecord.type === 'DIOCESE') {
        roleType = ROLE_TYPES.DIOCESE;
        const { data: newDiocese, error: dErr } = await supabase.from('dioceses').insert([{
            name: payload.name, 
            type: payload.type || 'diocese', 
            city: payload.city, 
            bishop: payload.bishop,
            auxiliary_bishop: payload.auxiliaryBishop, 
            provincia_eclesiastica: payload.provinciaEclesiastica,
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

      const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: emailToSave,
          password: regData.password,
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error("No se pudo crear el usuario en el sistema de seguridad.");

      const { error: profErr } = await supabase.from('user_profiles').insert([{
          auth_user_id: authData.user.id,
          email: emailToSave,
          username: tokenToFind, 
          role: roleType,
          diocese_id: assignedDioceseId,
          parish_id: assignedParishId,
          chancery_id: assignedChanceryId,
          status: 'ACTIVE'
      }]);

      if (profErr) throw profErr;

      await supabase.from('pending_tokens').delete().eq('id', tokenRecord.id);

      toast({ title: "¡Entorno Activado!", description: "Configurando bóveda segura...", variant: "success" });
      
      const autoLoginResult = await login(emailToSave, regData.password);
      
      if (autoLoginResult && autoLoginResult.success) {
          const rol = autoLoginResult.role;
          if (rol === 'diocese') window.location.href = '/diocese/dashboard';
          else if (rol === 'chancery') window.location.href = '/chancery/dashboard';
          else if (rol === 'parish') window.location.href = '/parish/dashboard';
          else window.location.href = '/'; 
      } else {
          toast({ title: "Registro Exitoso", description: "Por favor, inicia sesión con tus nuevas credenciales." });
          setAuthView('login');
      }

    } catch (err) {
      toast({ title: "Fallo en Activación", description: err.message, variant: "destructive" });
    } finally {
      setRegLoading(false);
    }
  };

  // --- RENDERIZADORES DE UI ---
  const renderLogin = () => (
    <motion.form key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Registrado</label>
            <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                <input type="email" required value={credentials.username} onChange={e => setCredentials({...credentials, username: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-700" placeholder="admin@ejemplo.com" />
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
            Usa el código de activación para habilitar tu despacho. El email que coloques será tu nuevo usuario.
        </div>
        <input type="text" required placeholder="CÓDIGO DE ACTIVACIÓN" value={regData.token} onChange={e => setRegData({...regData, token: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        <input type="email" required placeholder="NUEVO EMAIL DE ACCESO" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        <div className="grid grid-cols-2 gap-3">
            <input type="password" required placeholder="CLAVE" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-[#D4AF37]" />
            <input type="password" required placeholder="REPETIR" value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        </div>
        <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => setAuthView('login')} variant="ghost" className="rounded-2xl px-4 font-black uppercase text-[10px]"><ArrowLeft className="w-5 h-5"/></Button>
            <Button disabled={regLoading} className="flex-1 py-7 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-widest text-[10px]">
                {regLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Activar Entorno'}
            </Button>
        </div>
    </motion.form>
  );

  const renderForgot = () => (
    <motion.form key="forgot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleForgot} className="space-y-4 text-center">
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 inline-block mb-4"><KeyRound className="w-8 h-8 text-amber-600" /></div>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Recuperar Acceso</h3>
        <p className="text-[11px] text-gray-400 uppercase font-bold tracking-tight mb-4">Ingresa tu email para recibir un enlace seguro.</p>
        <input type="email" required placeholder="EMAIL REGISTRADO" value={forgotData.username} onChange={e => setForgotData({username: e.target.value})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex gap-2 text-left">
          <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-600"><strong>¿Problemas urgentes?</strong> Su superior jerárquico puede asignarle una contraseña temporal.</p>
        </div>
        <Button disabled={forgotLoading} className="w-full py-7 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px]">{forgotLoading ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Enviar Instrucciones'}</Button>
        <button type="button" onClick={() => setAuthView('login')} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:underline mt-4 block mx-auto">Volver al inicio</button>
    </motion.form>
  );

  return (
    <div className="min-h-screen lg:h-screen w-full bg-slate-50 flex flex-col lg:flex-row lg:overflow-hidden font-sans">
      <Helmet><title>Acceso Seguro | Eclesia Digital</title></Helmet>

      {/* PANEL LATERAL (LOGIN) */}
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

      {/* PANEL PRINCIPAL (PORTADA INSTITUCIONAL) */}
      <main className="flex-1 w-full h-full relative bg-gradient-to-br from-[#2C3E50] to-[#1A252F] flex items-center justify-center p-12 overflow-hidden">
          {/* Decoración de fondo */}
          <Church className="absolute -bottom-20 -right-20 w-[600px] h-[600px] text-white opacity-5 rotate-12" />
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#D4AF37] via-[#4B7BA7] to-[#D4AF37]"></div>

          <div className="relative z-10 text-center max-w-3xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                  <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6">
                      Plataforma Eclesial <br/><span className="text-[#D4AF37]">Unificada</span>
                  </h1>
                  <p className="text-lg text-slate-300 font-medium leading-relaxed mb-10 max-w-2xl mx-auto">
                      Sistema integral y seguro para la gestión de archivos parroquiales, emisión de actas sacramentales y control diocesano.
                  </p>
              </motion.div>
          </div>
      </main>
    </div>
  );
};

// Puedes cambiarle el nombre interno o dejarlo así si en tu App.jsx está importado como PublicSearchPage
export default PublicSearchPage;