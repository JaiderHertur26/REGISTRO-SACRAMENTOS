import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import { 
    Church, Users, User, FileText, LayoutDashboard, Database, 
    Plus, Search, Edit, Trash2, Settings as SettingsIcon, 
    Eye, ShieldCheck, CheckCircle2, Copy, Activity, MapPin, 
    Map, Landmark, Download
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import EditDioceseArchdioceseModal from '@/components/modals/EditDioceseArchdioceseModal';
import DetailsModal from '@/components/modals/DetailsModal';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { generateBackup } from '@/lib/backupHelpers'; 

const AdminGeneralDashboard = () => {
  const { data, deleteDioceseArchdiocese } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDiocese, setSelectedDiocese] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [envFormData, setEnvFormData] = useState({ 
      name: '', city: '', type: 'diocese', bishop: '', auxiliaryBishop: '',
      provinciaEclesiastica: '', jurisdiccionEclesiastica: ''
  });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingDioceses, setPendingDioceses] = useState([]);

  // =========================================================================
  // 1. CARGA DE TOKENS DESDE SUPABASE
  // =========================================================================
  useEffect(() => {
      const fetchPendingTokens = async () => {
          try {
              const { data: tokens, error } = await supabase
                  .from('pending_tokens')
                  .select('*')
                  .eq('type', 'DIOCESE');
                  
              if (error) throw error;
              
              if (tokens && Array.isArray(tokens)) {
                  const formattedTokens = tokens.map(item => ({
                      id: item.id,
                      token: item.token,
                      ...item.payload, 
                      date: new Date(item.created_at).toLocaleDateString()
                  }));
                  setPendingDioceses(formattedTokens);
              }
          } catch (error) {
              console.warn("Advertencia de red (Tokens):", error.message || error);
          }
      };
      fetchPendingTokens();
  }, []);

  // =========================================================================
  // 2. MENÚ DE NAVEGACIÓN BLINDADO
  // =========================================================================
  const menuItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Diócesis/Arquidiócesis', path: '/admin/dioceses', icon: Church },
    { label: 'Ajustes', path: '/admin/settings', icon: SettingsIcon },
  ];

  // Prevención de valores nulos
  const safeDioceses = data?.dioceses || [];
  const safeUsers = data?.users || [];
  const safeParishes = data?.parishes || [];
  const safeSacraments = data?.sacraments || [];

  const stats = [
    { label: 'Diócesis Activas', value: safeDioceses.length, icon: Church, color: 'bg-blue-600', text: 'text-blue-700' },
    { label: 'Total Parroquias', value: safeParishes.length, icon: Church, color: 'bg-indigo-600', text: 'text-indigo-700' },
    { label: 'Total Sacramentos', value: safeSacraments.length, icon: FileText, color: 'bg-green-600', text: 'text-green-700' },
    { label: 'Total Usuarios', value: safeUsers.length, icon: Users, color: 'bg-purple-600', text: 'text-purple-700' },
  ];

  const filteredDioceses = safeDioceses.filter(d => 
    (d.name && d.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (d.city && d.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const dioceseTableData = filteredDioceses.map(diocese => {
    const adminUser = safeUsers.find(u => u.dioceseId === diocese.id && u.role === ROLE_TYPES.DIOCESE);
    let displayUsername = 'Sin asignar';
    if (adminUser) {
        if (typeof adminUser.username === 'object' && adminUser.username !== null) {
            displayUsername = adminUser.username.name || adminUser.username.username || 'Usuario';
        } else {
            displayUsername = adminUser.username || adminUser.email || 'Usuario';
        }
    }
    return { ...diocese, username: displayUsername, userId: adminUser ? adminUser.id : null };
  });

  const handleEdit = (diocese) => {
    setSelectedDiocese(diocese);
    setIsEditModalOpen(true);
  };

  const handleDetails = (diocese) => {
    setSelectedDiocese(diocese);
    setIsDetailsModalOpen(true);
  };

  const handleDeleteDiocese = (diocese) => {
    if (window.confirm('¿Deseas eliminar esta Diócesis/Arquidiócesis? Todos sus datos asociados se perderán.')) {
        const result = deleteDioceseArchdiocese(diocese.id);
        if (result.success) toast({ title: 'Eliminado', description: 'La jurisdicción ha sido eliminada.', variant: 'success' });
        else toast({ title: 'Error', description: 'Hubo un error al eliminar.', variant: 'destructive' });
    }
  };

  // =========================================================================
  // 3. GENERACIÓN DE TOKENS (CON MANEJO ESTRICTO DE ERRORES)
  // =========================================================================
  const handleGenerateToken = async (e) => {
      e.preventDefault();
      setIsGenerating(true);

      const cleanName = envFormData.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const prefix = envFormData.type === 'archdiocese' ? 'a.' : 'd.';
      const newToken = `${prefix}${cleanName}.${randomDigits}`;

      const payloadData = {
          name: envFormData.name,
          type: envFormData.type,
          city: envFormData.city,
          bishop: envFormData.bishop,
          auxiliaryBishop: envFormData.auxiliaryBishop,
          provinciaEclesiastica: envFormData.provinciaEclesiastica,
          jurisdiccionEclesiastica: envFormData.jurisdiccionEclesiastica
      };

      try {
          const { data: savedToken, error } = await supabase
              .from('pending_tokens')
              .insert([{
                  token: newToken,
                  type: 'DIOCESE',
                  payload: payloadData,
                  created_by: user?.id || null
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

          setPendingDioceses(prev => [...prev, newEnv]);
          setGeneratedCode(newToken);
          toast({ title: "Código Creado", description: "Guardado exitosamente en la nube.", variant: "success" });

      } catch (error) {
          console.error("Fallo Detallado de Supabase:", error);
          const errorMsg = error.message || error.details || "Verifique que la tabla 'pending_tokens' exista y esté configurada correctamente.";
          toast({ title: "Fallo de Base de Datos", description: errorMsg, variant: "destructive" });
      } finally {
          setIsGenerating(false);
      }
  };

  const resetEnvModal = () => {
      setIsCreateModalOpen(false);
      setGeneratedCode(null);
      setEnvFormData({ name: '', city: '', type: 'diocese', bishop: '', auxiliaryBishop: '', provinciaEclesiastica: '', jurisdiccionEclesiastica: '' }); 
  };

  const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Código copiado al portapapeles.", className: "bg-blue-50 text-blue-800" });
  };

  const handleDeletePending = async (id) => {
      if(window.confirm("¿Revocar este código de activación de la base de datos?")) {
          try {
              const { error } = await supabase.from('pending_tokens').delete().eq('id', id);
              if (error) throw error;
              
              setPendingDioceses(prev => prev.filter(d => d.id !== id));
              toast({ title: "Revocado", description: "El código ha sido eliminado de la nube.", variant: "success" });
          } catch (error) {
              const errorMsg = error.message || "No se pudo borrar de la nube.";
              toast({ title: "Error", description: errorMsg, variant: "destructive" });
          }
      }
  };

  const columnsDioceses = [
    { header: 'Nombre', accessor: 'name' },
    { 
        header: 'Tipo', 
        render: (row) => (
            <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${row.type === 'archdiocese' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {row.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
            </span>
        ) 
    },
    { header: 'Obispo/Arzobispo', render: (row) => <span className="font-medium text-gray-700">{row.bishop || 'No registrado'}</span> },
    { header: 'Usuario Vinculado', render: (row) => <span className="font-mono text-xs text-gray-500">{row.username}</span> },
    {
        header: 'Acciones',
        render: (row) => (
            <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" title="Ver Detalles" onClick={() => handleDetails(row)}>
                    <Eye className="w-4 h-4 text-gray-500 hover:text-gray-900" />
                </Button>
                <Button size="sm" variant="ghost" title="Editar" onClick={() => handleEdit(row)}>
                    <Edit className="w-4 h-4 text-blue-600 hover:text-blue-800" />
                </Button>
                <Button size="sm" variant="ghost" title="Eliminar" onClick={() => handleDeleteDiocese(row)}>
                    <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                </Button>
            </div>
        )
    }
  ];

  return (
    <DashboardLayout menuItems={menuItems} entityName="Administración General">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        
        {/* CABECERA Y BOTÓN DE BACKUP INTEGRADO */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
               <ShieldCheck className="w-8 h-8 text-[#D4AF37]" /> Panel Root
            </h1>
            <p className="text-gray-500 mt-1 uppercase text-xs font-bold tracking-widest">Control Maestro Global del Sistema</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
                toast({ title: 'Generando Backup', description: 'La descarga comenzará automáticamente.' });
                generateBackup(data, user);
            }}
            className="gap-2 border-gray-200 text-gray-700 bg-white rounded-2xl h-12 px-6 hover:bg-gray-50 shadow-sm"
          >
            <Download className="w-4 h-4 text-blue-600" /> Exportar Backup Total
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {stats.map((stat, idx) => (
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
        </div>

        {pendingDioceses.length > 0 && (
            <div className="mb-10 border border-amber-200 bg-amber-50/40 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="bg-amber-100/60 p-6 border-b border-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-amber-700" />
                        <h3 className="font-black text-amber-900 uppercase tracking-widest text-xs">Nuevas Jurisdicciones - En la Nube</h3>
                    </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingDioceses.map(env => (
                        <div key={env.id} className="bg-white p-6 rounded-[1.5rem] border border-amber-200 shadow-sm relative group">
                            <span className={`absolute top-4 right-8 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${env.type === 'archdiocese' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                {env.type === 'archdiocese' ? 'Arqui.' : 'Diócesis'}
                            </span>
                            <h4 className="font-black text-gray-900 pr-16 truncate text-lg tracking-tight">{env.name}</h4>
                            <p className="text-xs text-gray-500 mb-5 font-medium mt-1">{env.city} • Creado: {env.date}</p>
                            <div className="bg-gray-50 p-3 rounded-xl border border-dashed border-gray-300 flex justify-between items-center">
                                <code className="text-base font-black text-[#4B7BA7] tracking-wider">{env.token}</code>
                                <button onClick={() => copyToClipboard(env.token)} className="text-gray-400 hover:text-[#D4AF37] transition-colors" title="Copiar">
                                    <Copy className="w-5 h-5" />
                                </button>
                            </div>
                            <button 
                                onClick={() => handleDeletePending(env.id)}
                                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
              <div>
                  <h3 className="font-black text-gray-900 text-xl tracking-tight">Jurisdicciones Activas</h3>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-1">Diócesis y Arquidiócesis vinculadas a un usuario en el sistema.</p>
              </div>
              
              <div className="flex flex-1 md:flex-none gap-4 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                          type="text" 
                          placeholder="Buscar Diócesis..." 
                          className="w-full pl-11 pr-4 py-3 border border-gray-200 bg-gray-50 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D4AF37] transition-all font-medium"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-black uppercase tracking-widest text-[10px] whitespace-nowrap shadow-xl shadow-yellow-900/10 px-6 py-6 rounded-2xl">
                      <Plus className="w-4 h-4" /> Crear Entorno
                  </Button>
              </div>
          </div>
          
          <Table columns={columnsDioceses} data={dioceseTableData} className="border-none" />
        </div>
      </motion.div>

      <Modal 
          isOpen={isCreateModalOpen} 
          onClose={resetEnvModal} 
          title={generatedCode ? "¡Código Maestro Generado!" : "Asignar Nueva Jurisdicción"}
      >
          <div className="w-full max-w-md mx-auto p-2">
              <AnimatePresence mode="wait">
                  {!generatedCode ? (
                      <motion.form 
                          key="create"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          onSubmit={handleGenerateToken} 
                          className="space-y-4"
                      >
                          <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2 space-y-1">
                                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo</label>
                                  <select 
                                      className="w-full px-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                      value={envFormData.type}
                                      onChange={(e) => setEnvFormData({...envFormData, type: e.target.value})}
                                  >
                                      <option value="diocese">Diócesis</option>
                                      <option value="archdiocese">Arquidiócesis</option>
                                  </select>
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nombre de la Jurisdicción</label>
                              <div className="relative">
                                  <Church className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-11 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                      placeholder="Ej: Arquidiócesis de Barranquilla"
                                      value={envFormData.name}
                                      onChange={(e) => setEnvFormData({...envFormData, name: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ciudad Principal</label>
                              <div className="relative">
                                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-11 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                      placeholder="Ej: Barranquilla"
                                      value={envFormData.city}
                                      onChange={(e) => setEnvFormData({...envFormData, city: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 mt-2">
                              <div className="col-span-2 md:col-span-1 space-y-1">
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Provincia Eclesiástica</label>
                                  <div className="relative">
                                      <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                      <input 
                                          type="text" required
                                          className="w-full pl-9 pr-3 py-3 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs font-bold transition-all"
                                          placeholder="Ej: Barranquilla"
                                          value={envFormData.provinciaEclesiastica}
                                          onChange={(e) => setEnvFormData({...envFormData, provinciaEclesiastica: e.target.value})}
                                      />
                                  </div>
                              </div>
                              <div className="col-span-2 md:col-span-1 space-y-1">
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Jurisdicción</label>
                                  <div className="relative">
                                      <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                      <input 
                                          type="text" required
                                          className="w-full pl-9 pr-3 py-3 border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs font-bold transition-all"
                                          placeholder="Ej: Diócesis Sufragánea"
                                          value={envFormData.jurisdiccionEclesiastica}
                                          onChange={(e) => setEnvFormData({...envFormData, jurisdiccionEclesiastica: e.target.value})}
                                      />
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Obispo Titular</label>
                              <div className="relative">
                                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-11 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                      placeholder="Ej: Mons. Pablo Emiro Salas"
                                      value={envFormData.bishop}
                                      onChange={(e) => setEnvFormData({...envFormData, bishop: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Obispo Auxiliar (Opcional)</label>
                              <div className="relative">
                                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text"
                                      className="w-full pl-11 pr-4 py-3.5 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                                      placeholder="Ej: Mons. Edgar Mejía"
                                      value={envFormData.auxiliaryBishop}
                                      onChange={(e) => setEnvFormData({...envFormData, auxiliaryBishop: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="pt-6 flex justify-end gap-3 border-t border-gray-100">
                              <Button type="button" variant="outline" onClick={resetEnvModal} className="w-1/3 py-6 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
                              <Button type="submit" className="w-2/3 py-6 rounded-xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/10" disabled={isGenerating}>
                                  {isGenerating ? 'Enviando a la Nube...' : 'Generar Código'}
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
                              <p className="text-gray-500 mt-2 text-sm font-medium">Entorno creado y guardado en Supabase. Envíe este código al Administrador Diocesano.</p>
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

      <EditDioceseArchdioceseModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} diocese={selectedDiocese} />
      <DetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} data={selectedDiocese} />
      
    </DashboardLayout>
  );
};

export default AdminGeneralDashboard;