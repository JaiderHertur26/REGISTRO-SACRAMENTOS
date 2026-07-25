import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import { Church, Users, User, FileText, LayoutDashboard, Database, Plus, Search, Edit, Trash2, Settings as SettingsIcon, Eye, ShieldCheck, CheckCircle2, Copy, Activity, MapPin, Map, Landmark } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import EditDioceseArchdioceseModal from '@/components/modals/EditDioceseArchdioceseModal';
import DetailsModal from '@/components/modals/DetailsModal';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import UniversalBackupManager from '@/components/UniversalBackupManager';
import { motion, AnimatePresence } from 'framer-motion';

// IMPORTANTE: Conectamos este panel a Supabase
import { supabase } from '@/lib/supabaseClient';

const AdminGeneralDashboard = () => {
  const { data, deleteDioceseArchdiocese } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDiocese, setSelectedDiocese] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [activeSection, setActiveSection] = useState('dashboard');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [envFormData, setEnvFormData] = useState({ 
      name: '', city: '', type: 'diocese', bishop: '', auxiliaryBishop: '',
      provinciaEclesiastica: '', jurisdiccionEclesiastica: ''
  });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingDioceses, setPendingDioceses] = useState([]);

  // --- 1. CARGAR TOKENS DESDE LA NUBE ---
  useEffect(() => {
      const fetchPendingTokens = async () => {
          try {
              const { data: tokens, error } = await supabase
                  .from('pending_tokens')
                  .select('*')
                  .eq('type', 'DIOCESE'); // Solo traemos los de nivel diocesano
                  
              if (error) throw error;
              
              if (tokens) {
                  // Formateamos para que la UI lo lea igual que antes
                  const formattedTokens = tokens.map(item => ({
                      id: item.id,
                      token: item.token,
                      ...item.payload, // Extraemos los datos del formulario (name, city, etc)
                      date: new Date(item.created_at).toLocaleDateString()
                  }));
                  setPendingDioceses(formattedTokens);
              }
          } catch (error) {
              console.error("Error cargando tokens:", error);
          }
      };
      fetchPendingTokens();
  }, []);

  const menuItems = [
    { label: 'Dashboard', path: '#', icon: LayoutDashboard, onClick: () => setActiveSection('dashboard') },
    { label: 'Copia de Seguridad Universal', path: '#', icon: Database, onClick: () => setActiveSection('backup') },
    { label: 'Diócesis/Arquidiócesis', path: '/admin/dioceses', icon: Church },
    { label: 'Ajustes', path: '/admin/settings', icon: SettingsIcon },
  ];

  const safeDioceses = data.dioceses || [];
  const safeUsers = data.users || [];
  const safeParishes = data.parishes || [];
  const safeSacraments = data.sacraments || [];

  const stats = [
    { label: 'Diócesis Activas', value: safeDioceses.length, icon: Church, color: 'bg-blue-600', text: 'text-blue-700' },
    { label: 'Total Parroquias', value: safeParishes.length, icon: Church, color: 'bg-indigo-600', text: 'text-indigo-700' },
    { label: 'Total Sacramentos', value: safeSacraments.length, icon: FileText, color: 'bg-green-600', text: 'text-green-700' },
    { label: 'Total Usuarios', value: safeUsers.length, icon: Users, color: 'bg-purple-600', text: 'text-purple-700' },
  ];

  const filteredDioceses = safeDioceses.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.city && d.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const dioceseTableData = filteredDioceses.map(diocese => {
    const adminUser = safeUsers.find(u => u.dioceseId === diocese.id && u.role === ROLE_TYPES.DIOCESE);
    let displayUsername = 'Sin asignar';
    if (adminUser) {
        if (typeof adminUser.username === 'object' && adminUser.username !== null) {
            displayUsername = adminUser.username.name || adminUser.username.username || 'Usuario';
        } else {
            displayUsername = adminUser.username;
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

  // --- 2. GENERAR Y GUARDAR TOKEN EN LA NUBE ---
  const handleGenerateToken = async (e) => {
      e.preventDefault();
      setIsGenerating(true);

      const cleanName = envFormData.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const prefix = envFormData.type === 'archdiocese' ? 'a.' : 'd.';
      const newToken = `${prefix}${cleanName}.${randomDigits}`;

      // Empaquetamos la información que requiere el token
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
          // Insertamos en Supabase
          const { data: savedToken, error } = await supabase
              .from('pending_tokens')
              .insert([{
                  token: newToken,
                  type: 'DIOCESE',
                  payload: payloadData,
                  created_by: user.id
              }])
              .select()
              .single();

          if (error) throw error;

          // Actualizamos la UI local
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
          console.error("Error guardando token en la nube:", error);
          toast({ title: "Error", description: "No se pudo conectar con el servidor.", variant: "destructive" });
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

  // --- 3. ELIMINAR TOKEN DE LA NUBE ---
  const handleDeletePending = async (id) => {
      if(confirm("¿Revocar este código de activación de la base de datos?")) {
          try {
              const { error } = await supabase.from('pending_tokens').delete().eq('id', id);
              if (error) throw error;
              
              setPendingDioceses(prev => prev.filter(d => d.id !== id));
              toast({ title: "Revocado", description: "El código ha sido eliminado de la nube.", variant: "success" });
          } catch (error) {
              console.error("Error borrando token:", error);
              toast({ title: "Error", description: "No se pudo borrar de la nube.", variant: "destructive" });
          }
      }
  };

  const columnsDioceses = [
    { header: 'Nombre', accessor: 'name' },
    { 
        header: 'Tipo', 
        render: (row) => (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.type === 'archdiocese' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {row.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
            </span>
        ) 
    },
    { header: 'Obispo/Arzobispo', render: (row) => row.bishop || 'No registrado' },
    { header: 'Usuario Vinculado', render: (row) => <span className="font-mono text-xs">{row.username}</span> },
    {
        header: 'Acciones',
        render: (row) => (
            <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" title="Ver Detalles" onClick={() => handleDetails(row)}>
                    <Eye className="w-4 h-4 text-gray-600" />
                </Button>
                <Button size="sm" variant="ghost" title="Editar" onClick={() => handleEdit(row)}>
                    <Edit className="w-4 h-4 text-blue-700" />
                </Button>
                <Button size="sm" variant="ghost" title="Eliminar" onClick={() => handleDeleteDiocese(row)}>
                    <Trash2 className="w-4 h-4 text-red-700" />
                </Button>
            </div>
        )
    }
  ];

  return (
    <DashboardLayout menuItems={menuItems} entityName="Administración General">
      
      {activeSection === 'dashboard' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#111111] flex items-center gap-2">
                 <ShieldCheck className="w-8 h-8 text-[#D4AF37]" /> Panel Root
              </h1>
              <p className="text-gray-500 mt-1">Control Maestro Global del Sistema</p>
            </div>
            <Button 
              variant="outline" 
              className="md:hidden flex items-center gap-2 border-blue-200 text-blue-700 bg-blue-50"
              onClick={() => setActiveSection('backup')}
            >
              <Database className="w-4 h-4" /> Gestión de Backups
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
                  <stat.icon className={`w-6 h-6 ${stat.text}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#111111]">{stat.value}</p>
                  <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ENTORNOS DIOCESANOS PENDIENTES */}
          {pendingDioceses.length > 0 && (
              <div className="mb-8 border border-amber-200 bg-amber-50/40 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-amber-100/60 p-4 border-b border-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-amber-700" />
                          <h3 className="font-bold text-amber-900">Nuevas Jurisdicciones - En la Nube</h3>
                      </div>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {pendingDioceses.map(env => (
                          <div key={env.id} className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm relative group">
                              <span className={`absolute top-3 right-8 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${env.type === 'archdiocese' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {env.type === 'archdiocese' ? 'Arqui.' : 'Diócesis'}
                              </span>
                              <h4 className="font-bold text-gray-900 pr-16 truncate">{env.name}</h4>
                              <p className="text-xs text-gray-500 mb-4">{env.city} • Creado: {env.date}</p>
                              <div className="bg-gray-50 p-2 rounded border border-dashed border-gray-300 flex justify-between items-center">
                                  <code className="text-base font-bold text-[#4B7BA7] tracking-wider">{env.token}</code>
                                  <button onClick={() => copyToClipboard(env.token)} className="text-gray-400 hover:text-[#D4AF37] transition-colors" title="Copiar">
                                      <Copy className="w-5 h-5" />
                                  </button>
                              </div>
                              <button 
                                  onClick={() => handleDeletePending(env.id)}
                                  className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h3 className="font-bold text-[#111111] text-lg">Jurisdicciones Activas</h3>
                    <p className="text-xs text-gray-500">Diócesis y Arquidiócesis vinculadas a un usuario en el sistema.</p>
                </div>
                
                <div className="flex flex-1 md:flex-none gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar Diócesis..." 
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-bold whitespace-nowrap shadow-md">
                        <Plus className="w-4 h-4" /> Crear Nuevo Entorno
                    </Button>
                </div>
            </div>
            
            <Table columns={columnsDioceses} data={dioceseTableData} />
          </div>
        </motion.div>
      )}

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
                                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Tipo</label>
                                  <select 
                                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none font-medium"
                                      value={envFormData.type}
                                      onChange={(e) => setEnvFormData({...envFormData, type: e.target.value})}
                                  >
                                      <option value="diocese">Diócesis</option>
                                      <option value="archdiocese">Arquidiócesis</option>
                                  </select>
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre de la Jurisdicción</label>
                              <div className="relative">
                                  <Church className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                      placeholder="Ej: Arquidiócesis de Barranquilla"
                                      value={envFormData.name}
                                      onChange={(e) => setEnvFormData({...envFormData, name: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Ciudad Principal</label>
                              <div className="relative">
                                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                      placeholder="Ej: Barranquilla"
                                      value={envFormData.city}
                                      onChange={(e) => setEnvFormData({...envFormData, city: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                              <div className="col-span-2 md:col-span-1 space-y-1">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Provincia Eclesiástica</label>
                                  <div className="relative">
                                      <Map className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                      <input 
                                          type="text" required
                                          className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs"
                                          placeholder="Ej: Barranquilla"
                                          value={envFormData.provinciaEclesiastica}
                                          onChange={(e) => setEnvFormData({...envFormData, provinciaEclesiastica: e.target.value})}
                                      />
                                  </div>
                              </div>
                              <div className="col-span-2 md:col-span-1 space-y-1">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Jurisdicción</label>
                                  <div className="relative">
                                      <Landmark className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                      <input 
                                          type="text" required
                                          className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs"
                                          placeholder="Ej: Diócesis Sufragánea"
                                          value={envFormData.jurisdiccionEclesiastica}
                                          onChange={(e) => setEnvFormData({...envFormData, jurisdiccionEclesiastica: e.target.value})}
                                      />
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Obispo Titular</label>
                              <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                      placeholder="Ej: Mons. Pablo Emiro Salas"
                                      value={envFormData.bishop}
                                      onChange={(e) => setEnvFormData({...envFormData, bishop: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Obispo Auxiliar (Opcional)</label>
                              <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text"
                                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                      placeholder="Ej: Mons. Edgar Mejía"
                                      value={envFormData.auxiliaryBishop}
                                      onChange={(e) => setEnvFormData({...envFormData, auxiliaryBishop: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                              <Button type="button" variant="outline" onClick={resetEnvModal} className="w-1/3">Cancelar</Button>
                              <Button type="submit" className="w-2/3 bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-bold" disabled={isGenerating}>
                                  {isGenerating ? 'Enviando a la Nube...' : 'Generar Código'}
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
                              <p className="text-gray-500 mt-1 text-sm">Entorno creado y guardado en Supabase. Envíe este código al Administrador Diocesano.</p>
                          </div>

                          <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-[#D4AF37] relative">
                              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                                  Código de Activación
                              </span>
                              <p className="text-3xl font-mono font-black text-[#2C3E50] tracking-widest">{generatedCode}</p>
                          </div>

                          <div className="pt-4 flex flex-col gap-2 border-t border-gray-100">
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

      <EditDioceseArchdioceseModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} diocese={selectedDiocese} />
      <DetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} data={selectedDiocese} />
      
    </DashboardLayout>
  );
};

export default AdminGeneralDashboard;