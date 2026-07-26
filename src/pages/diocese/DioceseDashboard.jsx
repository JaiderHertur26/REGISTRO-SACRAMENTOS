import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Church, Users, FileText, LayoutDashboard, Database, Plus, Download, Edit, Trash2, Key, ShieldCheck, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateBackup } from '@/lib/backupHelpers';
import Modal from '@/components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import EditParishUserModal from '@/components/modals/EditParishUserModal';
import EditChanceryUserModal from '@/components/modals/EditChanceryUserModal';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';

const DioceseDashboard = () => {
  const { data, getParishUsers, getChanceryUsers, deleteUser } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();

  const [modalState, setModalState] = useState({
      createEnv: false,
      editParish: false,
      editChancery: false,
      password: false
  });
  
  const [selectedUser, setSelectedUser] = useState(null);

  const [envFormData, setEnvFormData] = useState({ name: '', city: '', type: 'PARISH' });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingEnvironments, setPendingEnvironments] = useState([]);

  // 🚀 CONEXIÓN A SUPABASE PARA LEER TOKENS
  useEffect(() => {
      const fetchPendingTokens = async () => {
          if (!user?.id) return;
          try {
              const { data: tokens, error } = await supabase
                  .from('pending_tokens')
                  .select('*')
                  .eq('created_by', user.id);
                  
              if (error) throw error;
              
              if (tokens) {
                  const formattedTokens = tokens.map(item => ({
                      id: item.id,
                      token: item.token,
                      ...item.payload,
                      date: new Date(item.created_at).toLocaleDateString()
                  }));
                  setPendingEnvironments(formattedTokens);
              }
          } catch (error) {
              console.error("Error cargando tokens:", error);
          }
      };
      fetchPendingTokens();
  }, [user]);

  const menuItems = [
    { label: 'Dashboard', path: '/diocese/dashboard', icon: LayoutDashboard },
    { label: 'Organización Eclesiástica', path: '/diocese/ecclesiastical', icon: Church },
    { label: 'Backups', path: '/backups', icon: Database },
  ];

  const safeParishes = data.parishes || [];
  const safeVicariates = data.vicariates || [];
  const safeDeaneries = data.deaneries || [];
  const safeSacraments = data.sacraments || [];

  const dioceseParishes = safeParishes.filter(p => p.dioceseId === user?.dioceseId);
  const dioceseVicariates = safeVicariates.filter(v => v.dioceseId === user?.dioceseId);
  const dioceseSacraments = safeSacraments.filter(s => s.dioceseId === user?.dioceseId);
  
  const parishUsers = getParishUsers(user?.dioceseId);
  const chanceryUsers = getChanceryUsers(user?.dioceseId);

  const stats = [
    { label: 'Entornos Activos', value: parishUsers.length + chanceryUsers.length, icon: ShieldCheck, color: 'bg-green-600' },
    { label: 'Total Parroquias', value: dioceseParishes.length, icon: Church, color: 'bg-blue-600' },
    { label: 'Total Vicarías', value: dioceseVicariates.length, icon: Users, color: 'bg-indigo-600' },
    { label: 'Total Sacramentos', value: dioceseSacraments.length, icon: FileText, color: 'bg-purple-600' },
  ];

  const safeString = (val) => {
      if (typeof val === 'string') return val;
      if (typeof val === 'object' && val !== null) return val.name || val.label || '';
      return String(val || '');
  };

  // 🚀 CONEXIÓN A SUPABASE PARA GENERAR TOKENS
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
              dioceseId: user.dioceseId
          };

          const { data: savedToken, error } = await supabase
              .from('pending_tokens')
              .insert([{
                  token: newToken,
                  type: envFormData.type,
                  payload: payloadData,
                  created_by: user.id
              }])
              .select()
              .single();

          if (error) throw error;

          const newEnv = {
              id: savedToken.id,
              token: savedToken.token,
              ...savedToken.payload,
              date: new Date(savedToken.created_at).toLocaleDateString()
          };

          setPendingEnvironments(prev => [...prev, newEnv]);
          setGeneratedCode(newToken);
          toast({ title: "Entorno Creado", description: "Código de activación guardado en la nube.", variant: "success" });

      } catch (error) {
          console.error("Error creando token:", error);
          toast({ title: "Error", description: "Fallo de conexión con la nube.", variant: "destructive" });
      } finally {
          setIsGenerating(false);
      }
  };

  const handleDeletePending = async (id) => {
      if(window.confirm("¿Revocar este código de activación?")) {
          try {
              const { error } = await supabase.from('pending_tokens').delete().eq('id', id);
              if (error) throw error;
              
              setPendingEnvironments(prev => prev.filter(d => d.id !== id));
              toast({ title: "Revocado", description: "El código ha sido eliminado.", variant: "success" });
          } catch (error) {
              toast({ title: "Error", description: "No se pudo borrar.", variant: "destructive" });
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

  const columnsPendingEnvs = [
      { header: 'Tipo', render: (row) => row.type === 'PARISH' ? 'Parroquia' : 'Cancillería' },
      { header: 'Nombre Asignado', accessor: 'name' },
      { header: 'Código de Activación', render: (row) => <span className="font-mono font-bold text-blue-600 tracking-wider">{row.token}</span> },
      { header: 'Estado', render: () => <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold">Esperando</span> },
      { header: 'Acción', render: (row) => <Button size="sm" variant="ghost" onClick={() => handleDeletePending(row.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button> }
  ];

  const columnsParishUsers = [
    { header: 'Usuario / Email', render: (row) => <div><div className="font-bold">{row.username}</div><div className="text-xs text-gray-500">{row.email}</div></div> },
    { header: 'Parroquia', render: (row) => safeString(row.parishName) },
    { header: 'Estado', render: () => <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Activo</span> },
    {
        header: 'Acciones',
        render: (row) => (
          <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(row); setModalState(prev => ({...prev, editParish: true})); }} title="Editar">
                  <Edit className="w-4 h-4 text-blue-600" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(row); setModalState(prev => ({...prev, password: true})); }} title="Cambiar Contraseña">
                  <Key className="w-4 h-4 text-orange-500" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(row.id)} title="Eliminar">
                  <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
          </div>
        )
      }
  ];

  const handleDeleteUser = (id) => {
    if (window.confirm('¿Está seguro de eliminar este usuario? Perderá acceso al sistema.')) {
        deleteUser(id);
        toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado correctamente.' });
    }
  };

  const handleBackup = () => {
    generateBackup(data, user);
    toast({ title: 'Backup Generado', description: 'La descarga comenzará automáticamente.' });
  };

  return (
    <DashboardLayout menuItems={menuItems} entityName={user?.dioceseName}>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black text-gray-900 tracking-tight">Panel de Gestión Diocesana</h1>
           <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-2">{safeString(user?.dioceseName)}</p>
        </div>
        <Button variant="outline" onClick={handleBackup} className="gap-2 rounded-2xl h-12 px-6">
            <Download className="w-4 h-4 text-blue-600" /> Exportar Backup Total
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all flex items-center gap-5">
            <div className={`p-4 rounded-2xl ${stat.color} bg-opacity-10 shadow-inner`}>
              <stat.icon className={`w-7 h-7 ${stat.color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-3xl font-black text-gray-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-blue-100 p-8 mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-bl-[100%] z-0"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center">
            <div>
                <h2 className="text-xl font-black text-[#2C3E50] flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
                    Asignación de Nuevos Entornos
                </h2>
                <p className="text-sm text-gray-600 font-medium mt-2 max-w-2xl">
                    Para dar de alta a una nueva Parroquia o Cancillería, genere un <strong>Código de Activación</strong>. 
                    El encargado utilizará este código en la pantalla de inicio para crear su propia contraseña segura.
                </p>
            </div>
            <Button onClick={() => setModalState(prev => ({...prev, createEnv: true}))} className="gap-2 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-black uppercase tracking-widest text-[10px] px-6 py-6 rounded-2xl mt-4 md:mt-0 shadow-xl shadow-yellow-900/10">
                <Plus className="w-4 h-4" /> Generar Código
            </Button>
        </div>

        {pendingEnvironments.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-100">
                <h3 className="font-black text-gray-400 mb-4 text-[10px] uppercase tracking-[0.2em]">Entornos Esperando Activación</h3>
                <Table columns={columnsPendingEnvs} data={pendingEnvironments} className="border-none shadow-none" />
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-black text-[#2C3E50] text-xl tracking-tight">Parroquias Activas</h3>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mt-1">Usuarios que ya activaron su cuenta</p>
                </div>
            </div>
            <Table columns={columnsParishUsers} data={parishUsers} className="border-none shadow-none" />
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-black text-[#2C3E50] text-xl tracking-tight">Cancillería Activa</h3>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mt-1">Usuarios del tribunal diocesano</p>
                </div>
            </div>
            <Table columns={columnsParishUsers} data={chanceryUsers} className="border-none shadow-none" /> 
          </div>
      </div>

      <Modal 
        isOpen={modalState.createEnv} 
        onClose={resetEnvModal} 
        title={generatedCode ? "¡Código Generado!" : "Nuevo Entorno Seguro"}
      >
        <div className="w-full max-w-md mx-auto p-2">
            <AnimatePresence mode="wait">
                {!generatedCode ? (
                    <motion.form 
                        key="form"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onSubmit={handleCreateEnvironment} 
                        className="space-y-4 pt-2"
                    >
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo de Entidad</label>
                            <select 
                                className="w-full px-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                value={envFormData.type}
                                onChange={(e) => setEnvFormData({...envFormData, type: e.target.value})}
                            >
                                <option value="PARISH">Parroquia</option>
                                <option value="CHANCERY">Cancillería Diocesana</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nombre Oficial</label>
                            <input 
                                type="text" required
                                className="w-full pl-4 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                placeholder={envFormData.type === 'PARISH' ? "Ej: Parroquia San Judas" : "Ej: Cancillería Principal"}
                                value={envFormData.name}
                                onChange={(e) => setEnvFormData({...envFormData, name: e.target.value})}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ubicación / Ciudad</label>
                            <input 
                                type="text" required
                                className="w-full pl-4 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                placeholder="Ej: Barranquilla"
                                value={envFormData.city}
                                onChange={(e) => setEnvFormData({...envFormData, city: e.target.value})}
                            />
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-[11px] text-blue-800 mt-4 font-medium leading-relaxed">
                            Al hacer clic en guardar, se creará un <strong>Código Único</strong>. El encargado de esta entidad no necesitará que usted le cree una contraseña; él mismo la configurará usando dicho código.
                        </div>

                        <div className="pt-6 flex justify-end gap-3 border-t border-gray-100">
                            <Button type="button" variant="outline" onClick={resetEnvModal} className="w-1/3 py-6 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
                            <Button type="submit" className="w-2/3 py-6 rounded-xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/10" disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Generar Código'}
                            </Button>
                        </div>
                    </motion.form>
                ) : (
                    <motion.div 
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="py-6 text-center space-y-8"
                    >
                        <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto border border-green-100">
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                        </div>
                        
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{envFormData.name}</h3>
                            <p className="text-gray-500 mt-2 text-sm font-medium">El entorno está listo para ser reclamado.</p>
                        </div>

                        <div className="bg-gray-50 p-8 rounded-2xl border-2 border-dashed border-[#4B7BA7] relative">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 text-[10px] font-black text-[#4B7BA7] uppercase tracking-[0.2em] rounded-full border border-[#4B7BA7]">
                                Código de Activación
                            </span>
                            <p className="text-4xl font-mono font-black text-[#2C3E50] tracking-widest">{generatedCode}</p>
                        </div>

                        <p className="text-[11px] text-gray-500 font-medium">
                            Copie este código y envíeselo al Párroco o Encargado. Lo necesitará para crear su cuenta en la pantalla principal.
                        </p>

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
            <EditParishUserModal 
                isOpen={modalState.editParish}
                onClose={() => setModalState(prev => ({...prev, editParish: false}))}
                user={selectedUser}
                dioceseId={user.dioceseId}
                onSuccess={() => setSelectedUser(null)}
            />
            <EditChanceryUserModal 
                isOpen={modalState.editChancery}
                onClose={() => setModalState(prev => ({...prev, editChancery: false}))}
                user={selectedUser}
                dioceseId={user.dioceseId}
                onSuccess={() => setSelectedUser(null)}
            />
            <ChangePasswordModal 
                isOpen={modalState.password}
                onClose={() => setModalState(prev => ({...prev, password: false}))}
                user={selectedUser}
            />
        </>
      )}
    </DashboardLayout>
  );
};

export default DioceseDashboard;