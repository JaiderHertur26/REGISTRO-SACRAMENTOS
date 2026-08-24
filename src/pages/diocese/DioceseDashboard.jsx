import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Church, Users, FileText, LayoutDashboard, Database, Plus, Download, Edit, Trash2, Key, ShieldCheck, CheckCircle2, Copy, Loader2, MapPin, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateBackup } from '@/lib/backupHelpers';
import Modal from '@/components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';

import EditParishUserModal from '@/components/modals/EditParishUserModal';
import EditChanceryUserModal from '@/components/modals/EditChanceryUserModal';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';

const DioceseDashboard = () => {
  const { data } = useAppData(); 
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState({ createEnv: false, editParish: false, editChancery: false, password: false });
  const [selectedUser, setSelectedUser] = useState(null);

  // Estados Cloud-Native
  const [realDioceseName, setRealDioceseName] = useState('Cargando Jurisdicción...');
  const [stats, setStats] = useState({ envs: 0, parishes: 0, vicariates: 0, sacraments: 0 });
  const [parishUsers, setParishUsers] = useState([]);
  const [chanceryUsers, setChanceryUsers] = useState([]);
  const [pendingEnvironments, setPendingEnvironments] = useState([]);
  
  const [envFormData, setEnvFormData] = useState({ name: '', city: '', type: 'PARISH' });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Adaptador Universal
  const currentDioceseId = user?.diocese_id || user?.dioceseId;

  useEffect(() => {
      const fetchDashboardData = async () => {
          if (!currentDioceseId) {
             setIsLoading(false);
             return;
          }
          
          setIsLoading(true);

          try {
              // 1. Obtener Nombre Real de la Diócesis
              const { data: dioData } = await supabase.from('dioceses').select('name').eq('id', currentDioceseId).single();
              if (dioData) setRealDioceseName(dioData.name);

              // 2. Cargar Tokens Pendientes
              const { data: tokens } = await supabase.from('pending_tokens').select('*').eq('created_by', user.id);
              if (tokens) {
                  setPendingEnvironments(tokens.map(item => ({
                      id: item.id, token: item.token, ...item.payload,
                      date: new Date(item.created_at).toLocaleDateString()
                  })));
              }

              // 3. Cargar Estructura (Parroquias y Vicarías)
              const { data: parishes } = await supabase.from('parishes').select('*').eq('diocese_id', currentDioceseId);
              const { count: vCount } = await supabase.from('vicarias').select('*', { count: 'exact', head: true }).eq('diocese_id', currentDioceseId);

              // 4. Cargar Perfiles de Usuarios
              const { data: profiles } = await supabase.from('user_profiles').select('*').eq('diocese_id', currentDioceseId);

              // 5. Calcular Sacramentos 
              let sCount = 0;
              if (parishes && parishes.length > 0) {
                  const pIds = parishes.map(p => p.id);
                  const [bRes, cRes, mRes1, mRes2] = await Promise.all([
                      supabase.from('baptisms').select('*', { count: 'exact', head: true }).in('parish_id', pIds),
                      supabase.from('confirmations').select('*', { count: 'exact', head: true }).in('parish_id', pIds),
                      supabase.from('marriages').select('*', { count: 'exact', head: true }).in('parish_id', pIds),
                      supabase.from('matrimonios').select('*', { count: 'exact', head: true }).in('parish_id', pIds)
                  ]);
                  sCount = (bRes.count || 0) + (cRes.count || 0) + (mRes1.count || 0) + (mRes2.count || 0);
              }

              // 6. Mapear Usuarios
              const pUsers = [];
              const cUsers = [];
              
              (profiles || []).forEach(p => {
                  const roleUpper = p.role?.toUpperCase();
                  if (roleUpper === 'PARISH') {
                      pUsers.push({
                          ...p,
                          username: p.email || p.username,
                          parishName: parishes?.find(par => par.id === p.parish_id)?.name || 'Parroquia no asignada'
                      });
                  } else if (roleUpper === 'CHANCERY') {
                      cUsers.push({
                          ...p,
                          username: p.email || p.username,
                          parishName: 'Tribunal / Cancillería'
                      });
                  }
              });

              setParishUsers(pUsers);
              setChanceryUsers(cUsers);
              setStats({
                  envs: pUsers.length + cUsers.length,
                  parishes: parishes?.length || 0,
                  vicariates: vCount || 0,
                  sacraments: sCount
              });

          } catch (error) {
              console.error("Fallo al sincronizar datos:", error);
          } finally {
              setIsLoading(false);
          }
      };

      fetchDashboardData();
  }, [user, currentDioceseId]);

  const handleCreateEnvironment = async (e) => {
      e.preventDefault();
      setIsGenerating(true);

      try {
          const cleanName = envFormData.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
          const randomDigits = Math.floor(100 + Math.random() * 900);
          const prefix = envFormData.type === 'PARISH' ? 'p.' : 'c.';
          const newToken = `${prefix}${cleanName}.${randomDigits}`;

          const payloadData = {
              name: envFormData.name,
              city: envFormData.city,
              type: envFormData.type,
              dioceseId: currentDioceseId
          };

          const { data: savedToken, error } = await supabase
              .from('pending_tokens')
              .insert([{ token: newToken, type: envFormData.type, payload: payloadData, created_by: user.id }])
              .select().single();

          if (error) throw error;

          const newEnv = {
              id: savedToken.id, token: savedToken.token, ...savedToken.payload,
              date: new Date(savedToken.created_at).toLocaleDateString()
          };

          setPendingEnvironments(prev => [...prev, newEnv]);
          setGeneratedCode(newToken);
          toast({ title: "Entorno Creado", description: "Código de activación guardado en la nube.", variant: "success" });

      } catch (error) {
          toast({ title: "Error", description: "Fallo de conexión con la nube.", variant: "destructive" });
      } finally {
          setIsGenerating(false);
      }
  };

  const handleDeletePending = async (id) => {
      if(window.confirm("¿Revocar este código de activación de la base de datos?")) {
          try {
              const { error } = await supabase.from('pending_tokens').delete().eq('id', id);
              if (error) throw error;
              setPendingEnvironments(prev => prev.filter(d => d.id !== id));
              toast({ title: "Revocado", description: "El código ha sido eliminado.", variant: "success" });
          } catch (error) {
              toast({ title: "Error", description: "No se pudo borrar de la nube.", variant: "destructive" });
          }
      }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('¿Está seguro de revocar el acceso a este usuario? Perderá acceso al sistema.')) {
        try {
            const { error } = await supabase.from('user_profiles').delete().eq('id', id);
            if (error) throw error;
            
            setParishUsers(prev => prev.filter(u => u.id !== id));
            setChanceryUsers(prev => prev.filter(u => u.id !== id));
            setStats(prev => ({ ...prev, envs: prev.envs - 1 }));
            toast({ title: 'Usuario eliminado', description: 'El acceso ha sido revocado de la base de datos.', variant: 'success' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar el usuario.', variant: 'destructive' });
        }
    }
  };

  const resetEnvModal = () => {
      setModalState(prev => ({ ...prev, createEnv: false }));
      setGeneratedCode(null);
      setEnvFormData({ name: '', city: '', type: 'PARISH' });
  };

  const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Código copiado al portapapeles.", className: "bg-blue-50 text-blue-800" });
  };

  const menuItems = [
    { label: 'Dashboard', path: '/diocese/dashboard', icon: LayoutDashboard },
    { label: 'Buscador Unificado', path: '/buscar', icon: Search }, // <-- AÑADIDO
    { label: 'Organización Eclesiástica', path: '/diocese/ecclesiastical', icon: Church },
    { label: 'Backups', path: '/backups', icon: Database },
  ];

  const statCards = [
    { label: 'Entornos Activos', value: stats.envs, icon: ShieldCheck, color: 'bg-green-600', text: 'text-green-700' },
    { label: 'Total Parroquias', value: stats.parishes, icon: Church, color: 'bg-blue-600', text: 'text-blue-700' },
    { label: 'Total Vicarías', value: stats.vicariates, icon: Users, color: 'bg-indigo-600', text: 'text-indigo-700' },
    { label: 'Total Sacramentos', value: stats.sacraments, icon: FileText, color: 'bg-purple-600', text: 'text-purple-700' },
  ];

  const columnsPendingEnvs = [
      { header: 'Tipo', render: (row) => row.type === 'PARISH' ? 'Parroquia' : 'Cancillería' },
      { header: 'Nombre Asignado', accessor: 'name' },
      { header: 'Código de Activación', render: (row) => <span className="font-mono font-bold text-[#4B7BA7] bg-blue-50 px-3 py-1 rounded-lg tracking-wider border border-blue-100">{row.token}</span> },
      { header: 'Estado', render: () => <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold">Esperando</span> },
      { header: 'Acción', render: (row) => <Button size="sm" variant="ghost" onClick={() => handleDeletePending(row.id)}><Trash2 className="w-4 h-4 text-red-500 hover:text-red-700 transition-colors" /></Button> }
  ];

  const columnsParishUsers = [
    { header: 'Usuario / Email', render: (row) => <div><div className="font-black text-gray-900">{row.username}</div><div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">{row.email || 'SIN EMAIL'}</div></div> },
    { header: 'Entidad', render: (row) => <span className="font-medium text-gray-600">{row.parishName}</span> },
    { header: 'Estado', render: () => <span className="bg-green-100/50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Activo</span> },
    {
        header: 'Acciones',
        render: (row) => (
          <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(row); setModalState(prev => ({...prev, editParish: row.role?.toUpperCase() === 'PARISH', editChancery: row.role?.toUpperCase() === 'CHANCERY'})); }} title="Editar">
                  <Edit className="w-4 h-4 text-blue-600 hover:text-blue-800" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(row); setModalState(prev => ({...prev, password: true})); }} title="Cambiar Contraseña">
                  <Key className="w-4 h-4 text-orange-500 hover:text-orange-700" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(row.id)} title="Eliminar">
                  <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
              </Button>
          </div>
        )
      }
  ];

  return (
    <DashboardLayout menuItems={menuItems} entityName={realDioceseName}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-10">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-[#2C3E50] tracking-tight">Panel de Gestión Diocesana</h1>
              <p className="text-[#D4AF37] font-black uppercase text-xs tracking-widest mt-1 flex items-center gap-2">
                  <Church className="w-4 h-4" /> {realDioceseName}
              </p>
            </div>
            <Button variant="outline" onClick={() => { generateBackup(data, user); toast({ title: 'Backup Generado', description: 'Descarga en proceso.' }); }} className="gap-2 rounded-2xl h-12 px-6 border-gray-200 text-gray-700 hover:bg-gray-50">
                <Download className="w-4 h-4 text-[#4B7BA7]" /> Exportar Backup
            </Button>
          </div>

          {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-4" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Sincronizando Bóveda...</p>
              </div>
          ) : (
              <>
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    {statCards.map((stat, idx) => (
                      <div key={idx} className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all flex items-center gap-5">
                        <div className={`p-4 rounded-2xl ${stat.color} bg-opacity-10 shadow-inner`}>
                          <stat.icon className={`w-7 h-7 ${stat.text}`} />
                        </div>
                        <div>
                          <p className="text-3xl font-black text-gray-900 tracking-tighter">{stat.value}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-[2.5rem] shadow-sm border border-blue-100/50 p-8 mb-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#4B7BA7]/5 rounded-bl-[100%] z-0 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-[#2C3E50] flex items-center gap-3 tracking-tight">
                                <ShieldCheck className="w-6 h-6 text-[#D4AF37]" /> Asignación de Nuevos Entornos
                            </h2>
                            <p className="text-sm text-gray-500 font-medium mt-2 max-w-2xl leading-relaxed">
                                Para dar de alta a una nueva Parroquia o Cancillería, genere un <strong className="text-gray-700">Código de Activación</strong>. 
                                El encargado utilizará este código en la pantalla de inicio para habilitar su bóveda privada.
                            </p>
                        </div>
                        <Button onClick={() => setModalState(prev => ({...prev, createEnv: true}))} className="gap-2 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-black uppercase tracking-widest text-[10px] px-8 py-6 rounded-2xl mt-6 md:mt-0 shadow-xl shadow-yellow-900/10 active:scale-95 transition-all whitespace-nowrap">
                            <Plus className="w-4 h-4" /> Generar Código
                        </Button>
                    </div>

                    {pendingEnvironments.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-gray-100 relative z-10">
                            <h3 className="font-black text-gray-400 mb-6 text-[10px] uppercase tracking-[0.2em]">Entornos Esperando Activación ({pendingEnvironments.length})</h3>
                            <Table columns={columnsPendingEnvs} data={pendingEnvironments} className="border-none shadow-none" />
                        </div>
                    )}
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="font-black text-[#2C3E50] text-xl tracking-tight">Parroquias Activas</h3>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">Sacerdotes registrados</p>
                            </div>
                        </div>
                        <div className="flex-1">
                            {parishUsers.length === 0 ? (
                                <div className="h-full min-h-[200px] flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                                    <Church className="w-10 h-10 text-gray-300 mb-3" />
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sin parroquias registradas</p>
                                </div>
                            ) : (
                                <Table columns={columnsParishUsers} data={parishUsers} className="border-none shadow-none" />
                            )}
                        </div>
                      </div>

                      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="font-black text-[#2C3E50] text-xl tracking-tight">Cancillería Activa</h3>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">Personal del tribunal</p>
                            </div>
                        </div>
                        <div className="flex-1">
                            {chanceryUsers.length === 0 ? (
                                <div className="h-full min-h-[200px] flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                                    <Users className="w-10 h-10 text-gray-300 mb-3" />
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sin cancilleres registrados</p>
                                </div>
                            ) : (
                                <Table columns={columnsParishUsers} data={chanceryUsers} className="border-none shadow-none" /> 
                            )}
                        </div>
                      </div>
                  </motion.div>
              </>
          )}
      </motion.div>

      <Modal isOpen={modalState.createEnv} onClose={resetEnvModal} title={generatedCode ? "¡Código Generado!" : "Nuevo Entorno Seguro"}>
        <div className="w-full max-w-md mx-auto p-2">
            <AnimatePresence mode="wait">
                {!generatedCode ? (
                    <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleCreateEnvironment} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo de Entidad</label>
                            <select 
                                className="w-full px-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                value={envFormData.type} onChange={(e) => setEnvFormData({...envFormData, type: e.target.value})}
                            >
                                <option value="PARISH">Parroquia</option>
                                <option value="CHANCERY">Cancillería Diocesana</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nombre Oficial</label>
                            <div className="relative">
                                <Church className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" required className="w-full pl-11 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                    placeholder={envFormData.type === 'PARISH' ? "Ej: Parroquia San Judas" : "Ej: Tribunal Eclesiástico"}
                                    value={envFormData.name} onChange={(e) => setEnvFormData({...envFormData, name: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ciudad / Municipio</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" required className="w-full pl-11 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                    placeholder="Ej: Magangué"
                                    value={envFormData.city} onChange={(e) => setEnvFormData({...envFormData, city: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100/50 flex gap-3 mt-4">
                            <ShieldCheck className="w-5 h-5 text-[#4B7BA7] shrink-0" />
                            <p className="text-[10px] text-[#4B7BA7] font-bold leading-relaxed tracking-wide">
                                Al guardar, se creará un <strong className="font-black">Código Único</strong>. El párroco no necesitará que usted le cree una contraseña; él mismo la configurará usando dicho código.
                            </p>
                        </div>
                        <div className="pt-6 flex justify-end gap-3 border-t border-gray-100">
                            <Button type="button" variant="outline" onClick={resetEnvModal} className="w-1/3 py-6 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
                            <Button type="submit" className="w-2/3 py-6 rounded-xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/10" disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Generar Código'}
                            </Button>
                        </div>
                    </motion.form>
                ) : (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-8">
                        <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto border border-green-100">
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{envFormData.name}</h3>
                            <p className="text-gray-500 mt-2 text-sm font-medium">El entorno está listo para ser reclamado.</p>
                        </div>
                        <div className="bg-gray-50 p-8 rounded-2xl border-2 border-dashed border-[#D4AF37] relative">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] rounded-full border border-[#D4AF37]">
                                Código de Activación
                            </span>
                            <p className="text-4xl font-mono font-black text-[#2C3E50] tracking-widest">{generatedCode}</p>
                        </div>
                        <div className="pt-6 flex flex-col gap-3 border-t border-gray-100">
                            <Button onClick={() => copyToClipboard(generatedCode)} className="w-full py-6 rounded-xl bg-[#D4AF37] hover:bg-[#B4932A] text-gray-900 font-black uppercase tracking-widest text-[10px] shadow-lg">
                                <Copy className="w-4 h-4 mr-2" /> Copiar Código
                            </Button>
                            <Button variant="outline" onClick={resetEnvModal} className="w-full py-6 rounded-xl font-black uppercase tracking-widest text-[10px]">
                                Cerrar
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </Modal>

      {selectedUser && (
        <>
            <EditParishUserModal isOpen={modalState.editParish} onClose={() => setModalState(prev => ({...prev, editParish: false}))} user={selectedUser} dioceseId={currentDioceseId} onSuccess={() => setSelectedUser(null)} />
            <EditChanceryUserModal isOpen={modalState.editChancery} onClose={() => setModalState(prev => ({...prev, editChancery: false}))} user={selectedUser} dioceseId={currentDioceseId} onSuccess={() => setSelectedUser(null)} />
            <ChangePasswordModal isOpen={modalState.password} onClose={() => setModalState(prev => ({...prev, password: false}))} user={selectedUser} />
        </>
      )}
    </DashboardLayout>
  );
};

export default DioceseDashboard;