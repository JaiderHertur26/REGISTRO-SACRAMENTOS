import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';
import { Download, Upload, Shield, AlertTriangle, LayoutDashboard, Users, Church, Database, Settings as SettingsIcon } from 'lucide-react';

const SettingsPage = () => {
  const { generateSecurityBackup, restoreSecurityBackup } = useAppData();
  const { toast } = useToast();
  const [restoring, setRestoring] = useState(false);

  const menuItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Gestionar Usuarios', path: '/admin/users/diocese', icon: Users },
    { label: 'Diócesis/Arquidiócesis', path: '/admin/dioceses', icon: Church },
    { label: 'Backups Globales', path: '/backups', icon: Database },
    { label: 'Ajustes', path: '/admin/settings', icon: SettingsIcon },
  ];

  const handleGenerateBackup = () => {
    try {
        const backupData = generateSecurityBackup();
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `sacramentum_backup_${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({ title: 'Backup generado', description: 'El archivo de seguridad se ha descargado correctamente.' });
    } catch (e) {
        toast({ title: 'Error', description: 'No se pudo generar el backup.', variant: 'destructive' });
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
        toast({ title: 'Formato inválido', description: 'Por favor seleccione un archivo JSON.', variant: 'destructive' });
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            confirmRestore(json);
        } catch (error) {
            toast({ title: 'Error de lectura', description: 'El archivo está corrupto o no es un JSON válido.', variant: 'destructive' });
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const confirmRestore = (data) => {
    if (window.confirm('¿Deseas restaurar desde este archivo? Se sobrescribirán las Diócesis/Arquidiócesis existentes y sus usuarios administradores.')) {
        setRestoring(true);
        setTimeout(() => {
            const result = restoreSecurityBackup(data);
            if (result.success) {
                toast({ title: 'Restauración completa', description: 'El sistema ha sido restaurado exitosamente.' });
                // Optional: Force reload to ensure all states update
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast({ title: 'Error de restauración', description: result.error, variant: 'destructive' });
            }
            setRestoring(false);
        }, 1000);
    }
  };

  return (
    <DashboardLayout menuItems={menuItems} entityName="Ajustes del Sistema">
      <div className="mb-8">
         <h1 className="text-3xl font-bold text-[#2C3E50]">Ajustes de Administración</h1>
         <p className="text-gray-500 mt-1">Configuración general y seguridad del sistema.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-[#2C3E50] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#D4AF37]" />
                Seguridad y Respaldo
            </h2>
        </div>
        
        <div className="p-6 space-y-8">
            {/* Generate Section */}
            <div>
                <h3 className="text-md font-semibold text-[#2C3E50] mb-2">Respaldo de Seguridad</h3>
                <p className="text-sm text-gray-600 mb-4 max-w-2xl">
                    Crea un respaldo de seguridad de las Diócesis/Arquidiócesis creadas. Este respaldo 
                    <span className="font-bold text-amber-600"> NO incluye </span> 
                    los datos creados dentro de cada Diócesis/Arquidiócesis (como sacramentos o parroquias), 
                    solo la estructura administrativa.
                </p>
                <Button onClick={handleGenerateBackup} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <Download className="w-4 h-4" />
                    Generar Archivo de Seguridad
                </Button>
            </div>

            <div className="border-t border-gray-100 pt-6"></div>

            {/* Restore Section */}
            <div>
                <h3 className="text-md font-semibold text-[#2C3E50] mb-2">Restaurar desde Archivo</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-3 max-w-2xl">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                        Advertencia: Esta acción sobrescribirá la configuración actual de Diócesis y Arquidiócesis. 
                        Asegúrese de tener un respaldo actual antes de proceder.
                    </p>
                </div>
                
                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        id="restore-file"
                        accept=".json"
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={restoring}
                    />
                    <Button 
                        onClick={() => document.getElementById('restore-file').click()} 
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={restoring}
                    >
                        <Upload className="w-4 h-4" />
                        {restoring ? 'Restaurando...' : 'Seleccionar Archivo para Restaurar'}
                    </Button>
                </div>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;