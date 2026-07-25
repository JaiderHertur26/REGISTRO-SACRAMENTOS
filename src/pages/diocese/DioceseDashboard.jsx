import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Church, Users, FileText, LayoutDashboard, Database, Plus, Download, Mail, Edit, Trash2, Key, ShieldCheck, CheckCircle2, Clock, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateBackup } from '@/lib/backupHelpers';
import Modal from '@/components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';
// Tus modales antiguos se mantienen para edición, pero la creación ahora es un proceso de "Generación de Token"
import EditParishUserModal from '@/components/modals/EditParishUserModal';
import EditChanceryUserModal from '@/components/modals/EditChanceryUserModal';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';

const DioceseDashboard = () => {
  const { data, getParishUsers, getChanceryUsers, deleteUser } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();

  const [modalState, setModalState] = useState({
      createEnv: false, // Nuevo modal unificado para crear entornos con Token
      editParish: false,
      editChancery: false,
      password: false
  });
  
  const [selectedUser, setSelectedUser] = useState(null);

  // --- NUEVO ESTADO PARA LA CREACIÓN DE ENTORNOS (TOKENS) ---
  const [envFormData, setEnvFormData] = useState({ name: '', city: '', type: 'PARISH' });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingEnvironments, setPendingEnvironments] = useState([]); // Entornos creados que aún no se activan

  useEffect(() => {
      // Cargar entornos pendientes simulados desde localStorage
      const saved = JSON.parse(localStorage.getItem(`diocese_pending_envs_${user?.dioceseId}`) || '[]');
      setPendingEnvironments(saved);
  }, [user?.dioceseId]);

  const menuItems = [
    { label: 'Dashboard', path: '/diocese/dashboard', icon: LayoutDashboard },
    { label: 'Organización Eclesiástica', path: '/diocese/ecclesiastical', icon: Church }, // Redirige a tu otra página
    { label: 'Backups', path: '/backups', icon: Database },
  ];

  const safeParishes = data.parishes || [];
  const safeVicariates = data.vicariates || [];
  const safeDeaneries = data.deaneries || [];
  const safeSacraments = data.sacraments || [];

  const dioceseParishes = safeParishes.filter(p => p.dioceseId === user.dioceseId);
  const dioceseVicariates = safeVicariates.filter(v => v.dioceseId === user.dioceseId);
  const dioceseDeaneries = safeDeaneries.filter(d => {
    const vicariate = safeVicariates.find(v => v.id === d.vicariateId);
    return vicariate && vicariate.dioceseId === user.dioceseId;
  });
  const dioceseSacraments = safeSacraments.filter(s => s.dioceseId === user.dioceseId);
  
  // Usuarios ya ACTIVOS (los que ya usaron el token y tienen cuenta real)
  const parishUsers = getParishUsers(user.dioceseId);
  const chanceryUsers = getChanceryUsers(user.dioceseId);

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

  // --- FUNCIONES PARA LA CREACIÓN DE ENTORNOS (TOKEN) ---
  const handleCreateEnvironment = (e) => {
      e.preventDefault();
      setIsGenerating(true);

      setTimeout(() => {
          // Generar Token
          const cleanName = envFormData.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
          const randomDigits = Math.floor(100 + Math.random() * 900);
          const prefix = envFormData.type === 'PARISH' ? 'p.' : 'c.';
          const newToken = `${prefix}${cleanName}.${randomDigits}`;

          const newEnv = {
              id: Date.now().toString(),
              name: envFormData.name,
              city: envFormData.city,
              type: envFormData.type,
              token: newToken,
              createdAt: new Date().toISOString()
          };

          const updatedEnvs = [...pendingEnvironments, newEnv];
          setPendingEnvironments(updatedEnvs);
          localStorage.setItem(`diocese_pending_envs_${user?.dioceseId}`, JSON.stringify(updatedEnvs));
          
          setGeneratedCode(newToken);
          setIsGenerating(false);
          toast({ title: "Entorno Creado", description: "Código de activación generado con éxito.", variant: "success" });
      }, 1000);
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

  // --- COLUMNAS DE TABLAS ---
  const columnsPendingEnvs = [
      { header: 'Tipo', render: (row) => row.type === 'PARISH' ? 'Parroquia' : 'Cancillería' },
      { header: 'Nombre Asignado', accessor: 'name' },
      { header: 'Código de Activación', render: (row) => <span className="font-mono font-bold text-blue-600">{row.token}</span> },
      { header: 'Estado', render: () => <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">Esperando Activación</span> }
  ];

  const columnsParishUsers = [
    { header: 'Usuario / Email', render: (row) => <div><div className="font-bold">{row.username}</div><div className="text-xs text-gray-500">{row.email}</div></div> },
    { header: 'Parroquia', render: (row) => safeString(row.parishName) },
    { header: 'Estado', render: () => <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Activo</span> },
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
    <DashboardLayout menuItems={menuItems} entityName={user.dioceseName}>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-[#2C3E50]">Panel de Gestión Diocesana</h1>
           <p className="text-gray-500 mt-1">{safeString(user.dioceseName)}</p>
        </div>
        <Button variant="outline" onClick={handleBackup} className="gap-2">
            <Download className="w-4 h-4" /> Backup Total
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
              <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* --- SECCIÓN DE CREACIÓN DE ENTORNOS (NUEVO FLUJO) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full z-0"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-[#2C3E50] flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    Asignación de Nuevos Entornos
                </h2>
                <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                    Para dar de alta a una nueva Parroquia o Cancillería, genere un <strong>Código de Activación</strong>. 
                    El encargado utilizará este código en la pantalla de inicio para crear su propia contraseña segura.
                </p>
            </div>
            <Button onClick={() => setModalState(prev => ({...prev, createEnv: true}))} className="gap-2 bg-[#D4AF37] hover:bg-[#B4932A] text-gray-900 font-bold mt-4 md:mt-0 shadow-md">
                <Plus className="w-4 h-4" /> Generar Código de Activación
            </Button>
        </div>

        {pendingEnvironments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wider">Entornos Esperando Activación</h3>
                <Table columns={columnsPendingEnvs} data={pendingEnvironments} />
            </div>
        )}
      </div>

      {/* --- TABLAS DE USUARIOS YA ACTIVOS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-[#2C3E50] text-lg">Parroquias Activas</h3>
                    <p className="text-xs text-gray-500">Usuarios que ya activaron su cuenta</p>
                </div>
            </div>
            <Table columns={columnsParishUsers} data={parishUsers} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-[#2C3E50] text-lg">Cancillería Activa</h3>
                    <p className="text-xs text-gray-500">Usuarios del tribunal diocesano</p>
                </div>
            </div>
            <Table columns={columnsParishUsers} data={chanceryUsers} /> {/* Reutilizamos las mismas columnas porque la estructura de Auth es igual */}
          </div>
      </div>

      {/* --- MODAL PARA CREAR ENTORNO Y GENERAR TOKEN --- */}
      <Modal 
        isOpen={modalState.createEnv} 
        onClose={resetEnvModal} 
        title={generatedCode ? "¡Código Generado!" : "Nuevo Entorno Seguro"}
      >
        <div className="w-full max-w-md mx-auto">
            <AnimatePresence mode="wait">
                {!generatedCode ? (
                    <motion.form 
                        key="form"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onSubmit={handleCreateEnvironment} 
                        className="space-y-4 pt-2"
                    >
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Tipo de Entidad</label>
                            <select 
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none bg-white"
                                value={envFormData.type}
                                onChange={(e) => setEnvFormData({...envFormData, type: e.target.value})}
                            >
                                <option value="PARISH">Parroquia</option>
                                <option value="CHANCERY">Cancillería Diocesana</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Nombre Oficial</label>
                            <input 
                                type="text" required
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                placeholder={envFormData.type === 'PARISH' ? "Ej: Parroquia San Judas" : "Ej: Cancillería Principal"}
                                value={envFormData.name}
                                onChange={(e) => setEnvFormData({...envFormData, name: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Ubicación / Ciudad</label>
                            <input 
                                type="text" required
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                placeholder="Ej: Barranquilla"
                                value={envFormData.city}
                                onChange={(e) => setEnvFormData({...envFormData, city: e.target.value})}
                            />
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-xs text-blue-800 mt-4">
                            Al hacer clic en guardar, se creará un <strong>Código Único</strong>. El encargado de esta entidad no necesitará que usted le cree una contraseña; él mismo la configurará usando dicho código.
                        </div>

                        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                            <Button type="button" variant="outline" onClick={resetEnvModal}>Cancelar</Button>
                            <Button type="submit" className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-bold" disabled={isGenerating}>
                                {isGenerating ? 'Generando...' : 'Generar Código'}
                            </Button>
                        </div>
                    </motion.form>
                ) : (
                    <motion.div 
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="py-4 text-center space-y-6"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{envFormData.name}</h3>
                            <p className="text-gray-500 mt-1">El entorno está listo para ser reclamado.</p>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-[#4B7BA7] relative">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-xs font-bold text-[#4B7BA7] uppercase tracking-wider">
                                Código de Activación
                            </span>
                            <p className="text-3xl font-mono font-black text-gray-900 tracking-widest">{generatedCode}</p>
                        </div>

                        <p className="text-sm text-gray-600">
                            Copie este código y envíeselo al Párroco o Encargado. Lo necesitará para crear su cuenta en la pantalla principal.
                        </p>

                        <div className="pt-4 flex flex-col gap-3 border-t border-gray-100">
                            <Button onClick={() => copyToClipboard(generatedCode)} className="w-full bg-[#D4AF37] hover:bg-[#B4932A] text-gray-900 font-bold">
                                <Copy className="w-4 h-4 mr-2" /> Copiar Código
                            </Button>
                            <Button variant="outline" onClick={resetEnvModal} className="w-full">
                                Cerrar
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </Modal>

      {/* --- MODALES DE EDICIÓN MANTENIDOS POR COMPATIBILIDAD --- */}
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