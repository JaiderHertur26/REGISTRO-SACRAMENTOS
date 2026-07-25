import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/use-toast';
import { Plus, ShieldCheck, CheckCircle2, Copy, Church, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ParishListPage = () => {
  const { data } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados para el nuevo flujo de creación (Tokens)
  const [formData, setFormData] = useState({ name: '', city: '', address: '' });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingParishes, setPendingParishes] = useState([]);

  // Parroquias ya existentes en la base de datos (Activas)
  const safeParishes = data.parishes || [];
  const activeParishes = safeParishes.filter(p => p.dioceseId === user.dioceseId);

  // Cargar parroquias pendientes de activación
  useEffect(() => {
      const saved = JSON.parse(localStorage.getItem(`pending_parishes_${user?.dioceseId}`) || '[]');
      setPendingParishes(saved);
  }, [user?.dioceseId]);

  // Manejador para crear la parroquia y generar el código
  const handleCreateParish = (e) => {
      e.preventDefault();
      setIsGenerating(true);

      setTimeout(() => {
          // Generar Token de Activación seguro
          const cleanName = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
          const randomDigits = Math.floor(100 + Math.random() * 900);
          const newToken = `p.${cleanName}.${randomDigits}`;

          const newParish = {
              id: Date.now().toString(),
              name: formData.name,
              city: formData.city,
              address: formData.address,
              token: newToken,
              status: 'ESPERANDO ACTIVACIÓN',
              createdAt: new Date().toISOString()
          };

          const updatedPending = [...pendingParishes, newParish];
          setPendingParishes(updatedPending);
          localStorage.setItem(`pending_parishes_${user?.dioceseId}`, JSON.stringify(updatedPending));
          
          setGeneratedCode(newToken);
          setIsGenerating(false);
          toast({ title: "Código Generado", description: "Entorno parroquial preparado exitosamente.", variant: "success" });
      }, 1200);
  };

  const resetModal = () => {
      setIsModalOpen(false);
      setGeneratedCode(null);
      setFormData({ name: '', city: '', address: '' });
  };

  const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Código copiado al portapapeles.", className: "bg-blue-50 text-blue-800" });
  };

  // Columnas para las tablas
  const columnsActive = [
    { header: 'Nombre de Parroquia', accessor: 'name' },
    { header: 'Ciudad', accessor: 'city' },
    { header: 'Dirección', accessor: 'address' },
    { header: 'Estado', render: () => <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Activa</span> }
  ];

  const columnsPending = [
    { header: 'Nombre de Parroquia', accessor: 'name' },
    { header: 'Ciudad', accessor: 'city' },
    { header: 'Código de Activación', render: (row) => <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{row.token}</span> },
    { header: 'Estado', render: () => <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">Esperando Registro</span> }
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-[#2C3E50] flex items-center gap-2">
                <Church className="w-6 h-6 text-[#4B7BA7]" />
                Parroquias Diocesanas
            </h1>
            <p className="text-gray-600 mt-1">Gestione las parroquias y genere sus códigos de acceso.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-bold shadow-md">
          <Plus className="w-4 h-4" /> Nuevo Entorno Parroquial
        </Button>
      </div>

      {/* SECCIÓN DE PARROQUIAS PENDIENTES DE ACTIVACIÓN */}
      {pendingParishes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full z-0"></div>
              <div className="relative z-10 mb-4">
                  <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5" />
                      Parroquias Esperando Activación
                  </h2>
                  <p className="text-sm text-amber-700">Entregue los códigos a los párrocos para que activen sus cuentas en la pantalla de inicio.</p>
              </div>
              <div className="relative z-10">
                  <Table columns={columnsPending} data={pendingParishes} />
              </div>
          </div>
      )}

      {/* SECCIÓN DE PARROQUIAS ACTIVAS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-[#2C3E50] mb-4">Parroquias Activas ({activeParishes.length})</h2>
          <Table 
            columns={columnsActive} 
            data={activeParishes}
            actions={[{ type: 'edit', label: 'Editar' }, { type: 'delete', label: 'Eliminar', variant: 'danger' }]}
            onAction={() => {}} 
          />
      </div>

      {/* MODAL MAGICO: GENERADOR DE TOKEN */}
      <Modal 
          isOpen={isModalOpen} 
          onClose={resetModal} 
          title={generatedCode ? "¡Código Generado Exitosamente!" : "Crear Entorno Parroquial"}
      >
          <div className="w-full max-w-md mx-auto p-2">
              <AnimatePresence mode="wait">
                  {!generatedCode ? (
                      <motion.form 
                          key="create"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          onSubmit={handleCreateParish} 
                          className="space-y-4"
                      >
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-3 mb-2">
                              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                              <p className="text-xs text-blue-800 leading-relaxed">
                                  El sistema no pedirá contraseña. Generará un <strong>Código de Activación</strong> que el párroco usará para registrarse él mismo.
                              </p>
                          </div>

                          <div className="space-y-1">
                              <label className="text-sm font-bold text-gray-700">Nombre de la Parroquia</label>
                              <div className="relative">
                                  <Church className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                      placeholder="Ej: Parroquia San José"
                                      value={formData.name}
                                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="space-y-1">
                              <label className="text-sm font-bold text-gray-700">Ciudad / Municipio</label>
                              <div className="relative">
                                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input 
                                      type="text" required
                                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                      placeholder="Ej: Barranquilla"
                                      value={formData.city}
                                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                              <Button type="button" variant="outline" onClick={resetModal} className="w-1/3">Cancelar</Button>
                              <Button type="submit" className="w-2/3 bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-bold" disabled={isGenerating}>
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
                              <h3 className="text-xl font-bold text-gray-900">{formData.name}</h3>
                              <p className="text-gray-500 mt-1 text-sm">Entorno creado. Envíe este código al párroco.</p>
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
                              <Button variant="outline" onClick={resetModal} className="w-full">
                                  Cerrar
                              </Button>
                          </div>
                      </motion.div>
                  )}
              </AnimatePresence>
          </div>
      </Modal>

    </DashboardLayout>
  );
};

export default ParishListPage;