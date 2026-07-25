import React, { useState, useEffect, useRef } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Download, Upload, Trash2, RotateCcw, Plus, Info, 
  AlertTriangle, CheckCircle, Database, FileJson, Search 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBackupSize } from '@/utils/universalBackupHelpers';

const UniversalBackupManager = () => {
  const { 
    createUniversalBackup, 
    getUniversalBackups, 
    restoreUniversalBackup, 
    deleteUniversalBackup,
    exportUniversalBackup,
    importUniversalBackup
  } = useAppData();
  
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Form State
  const [newBackupName, setNewBackupName] = useState('');
  const [newBackupDesc, setNewBackupDesc] = useState('');

  // Confirmation States
  const [restoreConfirmId, setRestoreConfirmId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    refreshBackups();
  }, [activeTab]);

  const refreshBackups = () => {
    const list = getUniversalBackups();
    setBackups(list);
  };

  const handleCreate = async () => {
    if (!newBackupName.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    // Slight delay to allow UI to render spinner
    setTimeout(async () => {
      const result = await createUniversalBackup(newBackupName, newBackupDesc);
      setLoading(false);
      
      if (result.success) {
        toast({ title: 'Backup Creado', description: 'Copia de seguridad guardada exitosamente.' });
        setNewBackupName('');
        setNewBackupDesc('');
        setActiveTab('list');
        refreshBackups();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    }, 500);
  };

  const handleDelete = (id) => {
    const result = deleteUniversalBackup(id);
    if (result.success) {
      toast({ title: 'Eliminado', description: 'Backup eliminado correctamente.' });
      setDeleteConfirmId(null);
      refreshBackups();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  const handleRestore = async (id) => {
    setLoading(true);
    setTimeout(async () => {
      const result = await restoreUniversalBackup(id);
      setLoading(false);
      setRestoreConfirmId(null);
      
      if (result.success) {
        toast({ title: 'Restauración Completa', description: 'El sistema ha sido restaurado exitosamente.', variant: 'success' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: 'Error Crítico', description: result.message, variant: 'destructive' });
      }
    }, 500);
  };

  const handleExport = (id) => {
    const result = exportUniversalBackup(id);
    if (result.success) {
      toast({ title: 'Exportado', description: 'Archivo JSON descargado.' });
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await importUniversalBackup(file);
      if (result.success) {
        toast({ title: 'Importado', description: 'Backup importado a la lista local.' });
        refreshBackups();
      } else {
        toast({ title: 'Error de Importación', description: result.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredBackups = backups.filter(b => 
    b.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.metadata.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Copias de Seguridad Universales
          </h2>
          <p className="text-sm text-gray-500">Gestión integral de snapshots del sistema completo.</p>
        </div>
        <div className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
          Local: {backups.length}
        </div>
      </div>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="list">Lista de Backups</TabsTrigger>
            <TabsTrigger value="create">Crear Nuevo</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Buscar backup..." 
                  className="pl-8"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImportFile} 
                  className="hidden" 
                  accept=".json"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  <Upload className="w-4 h-4 mr-2" /> Importar Archivo
                </Button>
              </div>
            </div>

            {filteredBackups.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No hay backups disponibles.</p>
                <Button variant="link" onClick={() => setActiveTab('create')} className="text-blue-600">
                  Crear el primero ahora
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {filteredBackups.map((backup) => (
                    <motion.div 
                      key={backup.metadata.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-800 text-lg">{backup.metadata.name}</h3>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Verificado
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{backup.metadata.description || 'Sin descripción'}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Database className="w-3 h-3" /> {formatBackupSize(backup.metadata.sizeBytes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileJson className="w-3 h-3" /> {backup.metadata.totalRegistros} Registros
                          </span>
                          <span>{new Date(backup.metadata.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {deleteConfirmId === backup.metadata.id ? (
                          <div className="flex items-center gap-2 bg-red-50 p-1 rounded-md animate-in fade-in slide-in-from-right-2">
                            <span className="text-xs text-red-600 font-bold px-2">¿Eliminar?</span>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(backup.metadata.id)}>Sí</Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>No</Button>
                          </div>
                        ) : restoreConfirmId === backup.metadata.id ? (
                          <div className="flex items-center gap-2 bg-orange-50 p-1 rounded-md animate-in fade-in slide-in-from-right-2">
                            <span className="text-xs text-orange-700 font-bold px-2">¿Sobrescribir todo?</span>
                            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleRestore(backup.metadata.id)}>
                              {loading ? '...' : 'Confirmar'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRestoreConfirmId(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleExport(backup.metadata.id)} title="Descargar JSON">
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setRestoreConfirmId(backup.metadata.id)} title="Restaurar Sistema" className="hover:bg-orange-100 hover:text-orange-700">
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleteConfirmId(backup.metadata.id)} title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="create">
            <div className="max-w-xl mx-auto py-8">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex gap-3">
                <Info className="w-6 h-6 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-800">
                  Esta acción creará una instantánea completa de <strong>toda la base de datos local</strong>. 
                  Incluye usuarios, parroquias, sacramentos, decretos y configuraciones.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Backup</label>
                  <Input 
                    placeholder="Ej: Respaldo Mensual Febrero 2026" 
                    value={newBackupName}
                    onChange={e => setNewBackupName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
                  <Input 
                    placeholder="Ej: Antes de la importación masiva..." 
                    value={newBackupDesc}
                    onChange={e => setNewBackupDesc(e.target.value)}
                  />
                </div>

                <div className="pt-4">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg"
                    onClick={handleCreate}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                        Generando Backup...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Crear Copia de Seguridad
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UniversalBackupManager;