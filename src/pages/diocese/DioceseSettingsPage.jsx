import React, { useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, Upload, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';

const DioceseSettingsPage = () => {
  const { user } = useAuth();
  const { generateDioceseBackup, restoreDioceseBackup } = useAppData();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  const handleDownloadBackup = async () => {
    setLoadingBackup(true);
    try {
      const backupData = await generateDioceseBackup(user.dioceseId);
      const fileName = `respaldo_diocesis_${user.dioceseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Respaldo Generado",
        description: "El archivo de seguridad se ha descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el respaldo.",
        variant: "destructive"
      });
      console.error(error);
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      toast({
        title: "Archivo Inválido",
        description: "Por favor selecciona un archivo .json válido.",
        variant: "destructive"
      });
      return;
    }

    if (!confirm("ADVERTENCIA: Restaurar un respaldo reemplazará los datos actuales de Vicarías, Decanatos y Parroquias. ¿Deseas continuar?")) {
        event.target.value = null; // Reset input
        return;
    }

    setLoadingRestore(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        const result = await restoreDioceseBackup(user.dioceseId, backupData);
        
        if (result.success) {
            toast({
                title: "Restauración Exitosa",
                description: result.message,
            });
        }
      } catch (error) {
        toast({
            title: "Error de Restauración",
            description: error.message || "El archivo de respaldo está corrupto o no corresponde a esta diócesis.",
            variant: "destructive"
        });
      } finally {
        setLoadingRestore(false);
        if (fileInputRef.current) fileInputRef.current.value = null;
      }
    };

    reader.readAsText(file);
  };

  return (
    <>
      <Helmet>
        <title>{'Diocese Settings'}</title>
        <meta name="description" content="Manage diocese backup and security settings" />
      </Helmet>

      <DashboardLayout entityName={user.dioceseName}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-8"
        >
          <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#2C3E50]">Configuración y Seguridad</h1>
              <p className="text-gray-500">Administra las copias de seguridad de tu diócesis.</p>
          </div>

          {/* Security Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-800">Respaldo y Seguridad</h2>
              </div>
              
              <div className="p-6 space-y-8">
                  {/* Subsection 1: Generate Backup */}
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-100">
                      <div>
                          <h3 className="font-semibold text-blue-900 mb-1">Generar Archivo de Seguridad</h3>
                          <p className="text-sm text-blue-700 max-w-xl">
                              Descarga un respaldo completo (formato JSON) que incluye todas tus Vicarías, Decanatos, Parroquias y Usuarios asociados. Guarda este archivo en un lugar seguro.
                          </p>
                      </div>
                      <Button 
                          onClick={handleDownloadBackup} 
                          disabled={loadingBackup}
                          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[180px]"
                      >
                          {loadingBackup ? 'Generando...' : (
                              <>
                                  <Download className="w-4 h-4 mr-2" /> Descargar Respaldo
                              </>
                          )}
                      </Button>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Subsection 2: Restore Backup */}
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between p-4 rounded-lg bg-orange-50 border border-orange-100">
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-orange-900">Restaurar desde Archivo</h3>
                              <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-medium">Zona de Peligro</span>
                          </div>
                          <p className="text-sm text-orange-800 max-w-xl mb-2">
                              Carga un archivo de seguridad generado previamente para restaurar toda la estructura de tu diócesis.
                          </p>
                          <div className="flex items-start gap-2 text-xs text-orange-700 bg-white/50 p-2 rounded border border-orange-200">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>
                                  <strong>Importante:</strong> Esta acción sobrescribirá la información actual de vicarías, decanatos y parroquias. Asegúrate de tener un respaldo reciente antes de continuar.
                              </span>
                          </div>
                      </div>
                      <div>
                          <input 
                              type="file" 
                              ref={fileInputRef}
                              accept=".json"
                              onChange={handleFileChange}
                              className="hidden"
                          />
                          <Button 
                              onClick={handleRestoreClick} 
                              disabled={loadingRestore}
                              variant="destructive"
                              className="bg-orange-600 hover:bg-orange-700 text-white min-w-[180px]"
                          >
                              {loadingRestore ? 'Restaurando...' : (
                                  <>
                                      <Upload className="w-4 h-4 mr-2" /> Restaurar Datos
                                  </>
                              )}
                          </Button>
                      </div>
                  </div>
              </div>
          </section>

        </motion.div>
      </DashboardLayout>
    </>
  );
};

export default DioceseSettingsPage;