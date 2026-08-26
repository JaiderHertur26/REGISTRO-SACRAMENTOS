import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Importamos los archivos independientes
import BaptismCorrectionTab from './BaptismCorrectionTab';
import ConfirmationCorrectionTab from './ConfirmationCorrectionTab';

const CorreccionDecretosPage = () => {
  const { user } = useAuth();
  const { getMisDatosList } = useAppData();
  const navigate = useNavigate();

  // Obtenemos los datos de la parroquia para el subtítulo
  const misDatos = user?.parishId ? getMisDatosList(user.parishId) : [];
  const parishLabel = misDatos?.length > 0 
    ? `${misDatos[0].nombre} - ${misDatos[0].ciudad}` 
    : `${user?.parishName || 'Parroquia'} - ${user?.city || ''}`;

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
      <div className="max-w-6xl mx-auto pb-24 pt-6">
        
        {/* ENCABEZADO Y BOTÓN DE REGRESAR */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-gray-900 font-serif">Crear Decreto de Corrección</h1>
              <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest">{parishLabel}</p>
            </div>
          </div>
        </div>

        {/* CONTENEDOR DE PESTAÑAS */}
        <Tabs defaultValue="bautizos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-10 bg-gray-100 p-1 rounded-2xl h-14">
            <TabsTrigger value="bautizos" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#4B7BA7] data-[state=active]:shadow-sm transition-all">
              Bautizos
            </TabsTrigger>
            <TabsTrigger value="confirmaciones" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm transition-all">
              Confirmaciones
            </TabsTrigger>
            <TabsTrigger value="matrimonios" disabled className="opacity-30 rounded-xl font-bold uppercase text-[10px] tracking-widest">
              Matrimonios
            </TabsTrigger>
          </TabsList>

          {/* CONTENIDO INDEPENDIENTE DE BAUTIZO */}
          <TabsContent value="bautizos" className="space-y-8 animate-in fade-in duration-500">
            <BaptismCorrectionTab />
          </TabsContent>

          {/* CONTENIDO INDEPENDIENTE DE CONFIRMACIÓN */}
          <TabsContent value="confirmaciones" className="space-y-8 animate-in fade-in duration-500">
            <ConfirmationCorrectionTab />
          </TabsContent>
        </Tabs>

      </div>
    </DashboardLayout>
  );
};

export default CorreccionDecretosPage;