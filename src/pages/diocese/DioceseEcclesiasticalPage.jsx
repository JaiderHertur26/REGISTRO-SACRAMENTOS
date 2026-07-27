import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
    Plus, Edit, Trash2, Eye, User, Home, AlertCircle, ShieldCheck, 
    CheckCircle2, Copy, Network, Building2, Landmark, ChevronRight, 
    LayoutGrid, KeyRound, Church, MapPin, Loader2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Modal from '@/components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';

import { supabase } from '@/lib/supabaseClient';

import CreateVicaryModal from '@/components/modals/CreateVicaryModal';
import CreateDecanateModal from '@/components/modals/CreateDecanateModal';
import EditParishModal from '@/components/modals/EditParishModal';
import EditChancellorModal from '@/components/modals/EditChancellorModal';
import EditVicaryModal from '@/components/modals/EditVicaryModal';
import EditDecanateModal from '@/components/modals/EditDecanateModal';
import DetailsModal from '@/components/modals/DetailsModal';
import ParishDetailsModal from '@/components/modals/ParishDetailsModal';

const DioceseEcclesiasticalPage = () => {
  const { deleteParish, deleteChancellor, deleteVicary, deleteDecanate } = useAppData();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [modals, setModals] = useState({
    createVicary: false, createDecanate: false, editParish: false,
    editChancellor: false, editVicary: false, editDecanate: false,
    details: false, parishDetails: false
  });
  
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [realDioceseName, setRealDioceseName] = useState('Cargando Jurisdicción...');
  const [realChancery, setRealChancery] = useState(null);
  const [realVicaries, setRealVicaries] = useState([]);
  const [realDeaneries, setRealDeaneries] = useState([]);
  const [realParishes, setRealParishes] = useState([]);
  
  const [chancellor, setChancellor] = useState(null);
  const [loadingStructure, setLoadingStructure] = useState(true);

  const [envModal, setEnvModal] = useState({ isOpen: false, type: 'PARISH' }); 
  const [envFormData, setEnvFormData] = useState({ name: '', city: '', vicaryId: '', decanateId: '', priest: '' });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingEnvs, setPendingEnvs] = useState([]);

  // Adaptador Universal
  const currentDioceseId = user?.diocese_id || user?.dioceseId;

  useEffect(() => {
      if (!currentDioceseId) {
          setLoadingStructure(false);
          return;
      }

      const fetchRealStructure = async () => {
          try {
              const { data: dioData } = await supabase.from('dioceses').select('name').eq('id', currentDioceseId).single();
              if (dioData) setRealDioceseName(dioData.name);

              const chanRes = await supabase.from('chancelleries').select('*').eq('diocese_id', currentDioceseId);
              if (chanRes.data && chanRes.data.length > 0) {
                  setRealChancery(chanRes.data[0]);
                  setChancellor(chanRes.data[0]); 
              }

              const vicRes = await supabase.from('vicarias').select('*').eq('diocese_id', currentDioceseId);
              if (vicRes.data) setRealVicaries(vicRes.data);

              const decRes = await supabase.from('decanatos').select('*');
              if (decRes.data) setRealDeaneries(decRes.data);

              const parRes = await supabase.from('parishes').select('*').eq('diocese_id', currentDioceseId);
              if (parRes.data) setRealParishes(parRes.data);

          } catch (error) {
              console.error("Error cargando estructura desde Supabase:", error);
          } finally {
              setLoadingStructure(false);
          }
      };

      const fetchPendingTokens = async () => {
          try {
              const { data: tokens, error } = await supabase.from('pending_tokens').select('*').eq('created_by', user.id); 
              if (error) throw error;
              if (tokens) {
                  const formattedTokens = tokens.map(item => ({
                      id: item.id, token: item.token, type: item.type,
                      ...item.payload, date: new Date(item.created_at).toLocaleDateString()
                  }));
                  setPendingEnvs(formattedTokens);
              }
          } catch (error) {
              console.error("Error cargando tokens:", error);
          }
      };

      fetchRealStructure();
      fetchPendingTokens();
  }, [user, currentDioceseId]);

  if (loading || loadingStructure) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto mb-4" />
            <p className="text-[#4B7BA7] font-black uppercase tracking-widest text-[10px]">Descargando Entidades...</p>
        </div>
      </div>
    );
  }

  const openModal = (name, item = null) => { setSelectedItem(item); setModals(prev => ({ ...prev, [name]: true })); };
  const closeModal = (name) => { setModals(prev => ({ ...prev, [name]: false })); setSelectedItem(null); };

  const vicaries = realVicaries;
  const getDeaneries = (vicaryId) => realDeaneries.filter(d => String(d.vicaria_id) === String(vicaryId) || String(d.vicaryId) === String(vicaryId));
  const getParishesByDecanate = (decanateId) => realParishes.filter(p => String(p.decanate_id) === String(decanateId) || String(p.decanateId) === String(decanateId));
  const getDirectParishes = (vicaryId) => realParishes.filter(p => 
    (String(p.vicary_id) === String(vicaryId) || String(p.vicaryId) === String(vicaryId)) && 
    (!p.decanate_id && !p.decanateId || String(p.decanate_id) === 'null' || String(p.decanateId) === 'null' || p.decanate_id === '')
  );
  const unassignedParishes = realParishes.filter(p => !p.vicary_id && !p.vicaryId && String(p.vicary_id) !== 'null');
  const availableDeaneriesForForm = envFormData.vicaryId ? getDeaneries(envFormData.vicaryId) : [];

  const handleDeleteParish = async (id) => { 
      if (window.confirm('¿Eliminar esta parroquia permanentemente?')) {
          await supabase.from('parishes').delete().eq('id', id);
          setRealParishes(prev => prev.filter(p => p.id !== id));
          if (deleteParish) deleteParish(id);
          toast({ title: "Eliminada", description: "Parroquia eliminada de la nube.", className: "bg-green-50 border-green-200 text-green-700" });
      }
  };
  const handleDeleteChancellor = async (id) => { 
      if (window.confirm('¿Eliminar el canciller permanentemente?')) {
          await supabase.from('chancelleries').delete().eq('id', id);
          setRealChancery(null); setChancellor(null);
          if (deleteChancellor) deleteChancellor(id);
          toast({ title: "Eliminada", description: "Cancillería eliminada de la nube.", className: "bg-green-50 border-green-200 text-green-700" });
      }
  };
  const handleDeleteVicary = async (id) => { 
      if (window.confirm('¿Eliminar esta vicaría permanentemente?')) {
          await supabase.from('vicarias').delete().eq('id', id);
          setRealVicaries(prev => prev.filter(v => v.id !== id));
          if (deleteVicary) deleteVicary(id);
          toast({ title: "Eliminada", description: "Vicaría eliminada de la nube.", className: "bg-green-50 border-green-200 text-green-700" });
      }
  };
  const handleDeleteDecanate = async (id) => { 
      if (window.confirm('¿Eliminar este decanato permanentemente?')) {
          await supabase.from('decanatos').delete().eq('id', id);
          setRealDeaneries(prev => prev.filter(d => d.id !== id));
          if (deleteDecanate) deleteDecanate(id);
          toast({ title: "Eliminado", description: "Decanato eliminado de la nube.", className: "bg-green-50 border-green-200 text-green-700" });
      }
  };

  const handleGenerateToken = async (e) => {
      e.preventDefault();
      setIsGenerating(true);

      const cleanName = envFormData.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
      const randomDigits = Math.floor(100 + Math.random() * 900);
      const prefix = envModal.type === 'PARISH' ? 'p.' : 'c.';
      const newToken = `${prefix}${cleanName}.${randomDigits}`;

      const payloadData = {
          name: envFormData.name, city: envFormData.city, priest: envFormData.priest,
          vicaryId: envFormData.vicaryId, decanateId: envFormData.decanateId, dioceseId: currentDioceseId 
      };

      try {
          const { data: savedToken, error } = await supabase
              .from('pending_tokens')
              .insert([{ token: newToken, type: envModal.type, payload: payloadData, created_by: user.id }])
              .select().single();

          if (error) throw error;

          const newEnv = {
              id: savedToken.id, token: savedToken.token, type: savedToken.type,
              ...savedToken.payload, date: new Date(savedToken.created_at).toLocaleDateString()
          };

          setPendingEnvs(prev => [...prev, newEnv]);
          setGeneratedCode(newToken);
          toast({ title: "Código Generado", description: "El entorno está listo en la nube.", className: "bg-green-50 border-green-200 text-green-700" });

      } catch (error) {
          console.error("Error guardando token:", error);
          toast({ title: "Error", description: "No se pudo generar el código en la nube.", variant: "destructive" });
      } finally {
          setIsGenerating(false);
      }
  };

  const resetEnvModal = () => {
      setEnvModal({ isOpen: false, type: 'PARISH' });
      setGeneratedCode(null);
      setEnvFormData({ name: '', city: '', vicaryId: '', decanateId: '', priest: '' });
  };

  const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Código en portapapeles.", className: "bg-blue-50 text-blue-800" });
  };

  const handleDeletePending = async (id) => {
      if(window.confirm("¿Revocar este código de activación permanentemente?")) {
          try {
              const { error } = await supabase.from('pending_tokens').delete().eq('id', id);
              if (error) throw error;
              setPendingEnvs(prev => prev.filter(d => d.id !== id));
              toast({ title: "Revocado", description: "Código eliminado.", className: "bg-green-50 border-green-200 text-green-700" });
          } catch(err) {
              toast({ title: "Error", description: "No se pudo borrar.", variant: "destructive" });
          }
      }
  };

  const ParishTable = ({ parishes, label = "" }) => {
      if (parishes.length === 0) return null;
      return (
        <div className="bg-white rounded-[1.5rem] overflow-hidden border border-slate-100 shadow-sm mt-4">
            {label && (
                <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <Home className="w-4 h-4 text-[#4B7BA7]" />
                    <span className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">{label}</span>
                </div>
            )}
            <table className="w-full text-sm text-left">
                <thead className="bg-white border-b border-slate-50 text-[9px] uppercase text-slate-400 font-black tracking-widest">
                    <tr>
                        <th className="px-6 py-4">Parroquia Registrada</th>
                        <th className="px-6 py-4">Párroco Asignado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {parishes.map(parish => (
                        <tr key={parish.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tight">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#4B7BA7]">
                                        <Church className="w-4 h-4" />
                                    </div>
                                    {parish.name}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 uppercase">
                                    <User className="w-3 h-3" /> {parish.parroco || 'Sin Asignar'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openModal('parishDetails', parish)} className="p-2 hover:bg-[#D4AF37]/10 rounded-xl text-[#D4AF37] transition-colors"><Eye className="w-4 h-4" /></button>
                                    <button onClick={() => openModal('editParish', parish)} className="p-2 hover:bg-blue-50 rounded-xl text-[#4B7BA7] transition-colors"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteParish(parish.id)} className="p-2 hover:bg-red-50 rounded-xl text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      );
  };

  return (
    <>
      <Helmet><title>Estructura Jurisdiccional | Sacramentum</title></Helmet>

      <DashboardLayout entityName={realDioceseName}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1600px] mx-auto space-y-8 pb-20">
            
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none flex items-center gap-3">
                        <Network className="w-10 h-10 text-[#4B7BA7]" /> Organización Eclesiástica
                    </h1>
                    <p className="text-[#4B7BA7] text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-1">
                        Base de Datos Oficial conectada a Supabase
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button onClick={() => openModal('createVicary')} className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white shadow-xl shadow-slate-900/10 font-black uppercase tracking-widest text-[10px] flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-none">
                    <Network className="w-5 h-5" /> Crear Vicaría
                </Button>
                <Button onClick={() => openModal('createDecanate')} className="h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-900/10 font-black uppercase tracking-widest text-[10px] flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-none">
                    <LayoutGrid className="w-5 h-5" /> Crear Decanato
                </Button>
                <Button onClick={() => setEnvModal({ isOpen: true, type: 'PARISH' })} className="h-16 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white shadow-xl shadow-blue-900/10 font-black uppercase tracking-widest text-[10px] flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-none">
                    <Church className="w-5 h-5" /> Crear Parroquia
                </Button>
                <Button onClick={() => setEnvModal({ isOpen: true, type: 'CHANCERY' })} disabled={!!chancellor} className="h-16 rounded-2xl bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] shadow-xl shadow-yellow-900/10 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none font-black uppercase tracking-widest text-[10px] flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-none">
                    <Building2 className="w-5 h-5" /> {chancellor ? 'Cancillería Activa' : 'Crear Cancillería'}
                </Button>
            </div>

            {realChancery && (
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-yellow-900/5 border border-slate-100 overflow-hidden mb-8">
                    <div className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] p-6 lg:px-10 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-white uppercase tracking-tighter">{realChancery.name}</h3>
                                <p className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-white/70" /> Sede Principal: {realChancery.city || 'No especificada'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => openModal('editChancellor', realChancery)} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteChancellor(realChancery.id)} className="p-3 bg-red-500/30 hover:bg-red-500/50 rounded-xl text-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            )}

            {unassignedParishes.length > 0 && (
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden mb-8 p-6 lg:p-10">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-500" /> 
                        <h4 className="font-black text-slate-700 uppercase tracking-tight">Parroquias sin Vicaría Asignada</h4>
                    </div>
                    <ParishTable parishes={unassignedParishes} />
                </div>
            )}

            <AnimatePresence>
            {pendingEnvs.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-amber-50/50 border border-amber-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="bg-amber-100/50 px-8 py-5 flex items-center justify-between border-b border-amber-200">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-amber-700" />
                            <div>
                                <h3 className="font-black text-amber-900 uppercase tracking-tight text-base">Entornos Pendientes en la Nube</h3>
                                <p className="text-[10px] font-bold text-amber-700/60 uppercase tracking-widest">A la espera de activación por parte del Despacho</p>
                            </div>
                        </div>
                        <span className="bg-white text-amber-800 text-xs font-black px-4 py-2 rounded-xl shadow-sm border border-amber-200">
                            {pendingEnvs.length}
                        </span>
                    </div>
                    
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingEnvs.map(env => (
                            <div key={env.id} className="bg-white p-6 rounded-[2rem] border border-amber-100 shadow-sm relative group hover:shadow-md transition-all">
                                <span className="absolute top-6 right-6 text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-100">
                                    {env.type === 'PARISH' ? 'Parroquia' : 'Cancillería'}
                                </span>
                                
                                <div className="pr-20 mb-4 mt-2">
                                    <h4 className="font-black text-slate-900 uppercase truncate text-lg tracking-tighter">{env.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                                        <MapPin className="w-3 h-3" /> {env.city} • Creado: {env.date}
                                    </p>
                                </div>
                                
                                {env.type === 'PARISH' && env.priest && (
                                     <p className="text-[10px] bg-slate-50 text-blue-700 px-3 py-2 rounded-xl font-bold uppercase tracking-widest flex items-center gap-2 mb-4 border border-slate-100">
                                        <User className="w-3 h-3 text-[#4B7BA7]" /> Pbro. {env.priest}
                                     </p>
                                )}

                                <div className="bg-amber-50/50 p-4 rounded-2xl border border-dashed border-amber-300 flex justify-between items-center mt-2">
                                    <code className="text-sm font-black text-[#4B7BA7] tracking-wider">{env.token}</code>
                                    <button onClick={() => copyToClipboard(env.token)} className="text-gray-400 hover:text-[#D4AF37] transition-all active:scale-95" title="Copiar código">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                <button 
                                    onClick={() => handleDeletePending(env.id)}
                                    className="absolute -top-3 -right-3 bg-white text-gray-300 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-full shadow-lg border border-gray-100 hover:border-red-100 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

            <div className="space-y-8 mt-8">
            {vicaries.length === 0 ? (
                <div className="bg-white p-20 rounded-[2.5rem] border border-dashed border-slate-200 text-center text-slate-500 shadow-sm">
                    <Network className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="font-black text-slate-500 uppercase tracking-widest text-xs">No hay vicarías registradas. Comienza creando una estructura eclesiástica.</p>
                </div>
            ) : (
                vicaries.map(vicary => {
                    const vicaryDeaneries = getDeaneries(vicary.id);
                    const directParishes = getDirectParishes(vicary.id);
                    const hasContent = vicaryDeaneries.length > 0 || directParishes.length > 0;

                    return (
                        <div key={vicary.id} className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
                            <div className="bg-slate-800 p-6 lg:px-10 flex justify-between items-center border-b border-slate-700">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-700 rounded-2xl flex items-center justify-center shadow-sm">
                                        <Network className="w-6 h-6 text-[#D4AF37]" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-2xl text-white uppercase tracking-tighter">{vicary.name}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                                            <User className="w-3 h-3 text-[#D4AF37]" /> Vicario: {vicary.vicar_name || vicary.vicarioName || 'Sin asignar'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openModal('editVicary', vicary)} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-colors shadow-sm"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteVicary(vicary.id)} className="p-3 bg-red-500/20 hover:bg-red-500/40 rounded-xl text-red-300 transition-colors shadow-sm"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="p-6 lg:p-10 bg-white">
                                {!hasContent ? (
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic text-center py-8">No hay decanatos ni parroquias registradas.</p>
                                ) : (
                                    <div className="space-y-10">
                                        {vicaryDeaneries.map(decanate => (
                                            <div key={decanate.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative ml-4 pl-8 before:absolute before:left-0 before:top-10 before:bottom-10 before:w-1 before:bg-slate-100 before:rounded-full hover:border-indigo-100 transition-colors">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                                            <LayoutGrid className="w-5 h-5 text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg leading-none mb-1">{decanate.name}</h4>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                <User className="w-3 h-3" /> Decano: {decanate.dean_name || decanate.decanName || 'Sin asignar'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => openModal('editDecanate', decanate)} className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Edit className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteDecanate(decanate.id)} className="p-2.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                                <ParishTable parishes={getParishesByDecanate(decanate.id)} />
                                            </div>
                                        ))}

                                        {directParishes.length > 0 && (
                                            <div className="bg-blue-50/30 p-6 rounded-[2rem] border border-dashed border-[#4B7BA7]/30 ml-4">
                                                <ParishTable parishes={directParishes} label="Parroquias Sin Decanato Asignado" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
            </div>
        </motion.div>

        <Modal isOpen={envModal.isOpen} onClose={resetEnvModal} title={generatedCode ? "¡Código Generado Exitosamente!" : `Crear Entorno de ${envModal.type === 'PARISH' ? 'Parroquia' : 'Cancillería'}`}>
            <div className="w-full max-w-md mx-auto p-2">
                <AnimatePresence mode="wait">
                    {!generatedCode ? (
                        <motion.form key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleGenerateToken} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Oficial</label>
                                <input 
                                    type="text" required
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                                    placeholder={envModal.type === 'PARISH' ? "Ej: Parroquia San José" : "Ej: Cancillería Principal"}
                                    value={envFormData.name}
                                    onChange={(e) => setEnvFormData({...envFormData, name: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ciudad / Municipio</label>
                                <input 
                                    type="text" required
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                                    placeholder="Ej: Barranquilla"
                                    value={envFormData.city}
                                    onChange={(e) => setEnvFormData({...envFormData, city: e.target.value})}
                                />
                            </div>

                            {envModal.type === 'PARISH' && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Párroco Actual (Opcional)</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input 
                                                type="text"
                                                className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                                                placeholder="Ej: Pbro. Juan Pérez"
                                                value={envFormData.priest}
                                                onChange={(e) => setEnvFormData({...envFormData, priest: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 mt-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vicaría (Opcional)</label>
                                            <select
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs font-bold text-slate-700 bg-white uppercase transition-all"
                                                value={envFormData.vicaryId}
                                                onChange={(e) => setEnvFormData({...envFormData, vicaryId: e.target.value, decanateId: ''})}
                                            >
                                                <option value="">-- No Asignar a Vicaría --</option>
                                                {realVicaries.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                            </select>
                                        </div>
                                        {envFormData.vicaryId && (
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Decanato (Opcional)</label>
                                                <select
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs font-bold text-slate-700 bg-white uppercase transition-all"
                                                    value={envFormData.decanateId}
                                                    onChange={(e) => setEnvFormData({...envFormData, decanateId: e.target.value})}
                                                >
                                                    <option value="">-- Pertenece directo a Vicaría --</option>
                                                    {availableDeaneriesForForm.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={resetEnvModal} className="w-1/3 rounded-xl border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50">Cancelar</Button>
                                <Button type="submit" className="w-2/3 rounded-xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all" disabled={isGenerating}>
                                    {isGenerating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                                    {isGenerating ? 'Generando...' : 'Generar Código'}
                                </Button>
                            </div>
                        </motion.form>
                    ) : (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-8">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-green-200">
                                <CheckCircle2 className="w-10 h-10 text-green-600" />
                            </div>
                            
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{envFormData.name}</h3>
                                <p className="text-slate-500 mt-2 text-xs font-bold uppercase tracking-widest">Entorno creado y vinculado. Envíe este código al encargado.</p>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-300 relative group">
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] border border-[#D4AF37]/20 rounded-full py-1 shadow-sm">
                                    Código de Activación
                                </span>
                                <p className="text-3xl font-mono font-black text-[#2C3E50] tracking-widest select-all">{generatedCode}</p>
                            </div>

                            <div className="pt-4 flex flex-col gap-3 border-t border-slate-100">
                                <Button onClick={() => copyToClipboard(generatedCode)} className="w-full bg-[#D4AF37] hover:bg-[#B4932A] text-white font-black uppercase tracking-widest text-[10px] py-6 rounded-xl shadow-lg active:scale-95 transition-all">
                                    <Copy className="w-4 h-4 mr-2" /> Copiar Código
                                </Button>
                                <Button variant="ghost" onClick={resetEnvModal} className="w-full text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 rounded-xl py-6 border border-transparent hover:border-slate-200">
                                    Cerrar
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Modal>

        {/* 🚀 Pasamos el currentDioceseId a los modales */}
        {modals.createVicary && <CreateVicaryModal isOpen={modals.createVicary} onClose={() => closeModal('createVicary')} dioceseId={currentDioceseId} />}
        {modals.createDecanate && <CreateDecanateModal isOpen={modals.createDecanate} onClose={() => closeModal('createDecanate')} dioceseId={currentDioceseId} />}
        {modals.editParish && <EditParishModal isOpen={modals.editParish} onClose={() => closeModal('editParish')} parish={selectedItem} />}
        {modals.editChancellor && <EditChancellorModal isOpen={modals.editChancellor} onClose={() => closeModal('editChancellor')} chancellor={selectedItem} />}
        {modals.editVicary && <EditVicaryModal isOpen={modals.editVicary} onClose={() => closeModal('editVicary')} vicary={selectedItem} />}
        {modals.editDecanate && <EditDecanateModal isOpen={modals.editDecanate} onClose={() => closeModal('editDecanate')} decanate={selectedItem} />}
        {modals.details && <DetailsModal isOpen={modals.details} onClose={() => closeModal('details')} data={selectedItem} />}
        {modals.parishDetails && <ParishDetailsModal isOpen={modals.parishDetails} onClose={() => closeModal('parishDetails')} parish={selectedItem} />}
      </DashboardLayout>
    </>
  );
};

export default DioceseEcclesiasticalPage;