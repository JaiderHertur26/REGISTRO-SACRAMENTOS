import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { motion } from 'framer-motion';

import AnnulmentConceptsTab from './AnnulmentConceptsTab';
import MarginalNotesTab from './MarginalNotesTab';

const AnnulmentConceptsPage = () => {
  const { user } = useAuth();
  const { obtenerNotificacionesMatrimoniales } = useAppData();
  
  const [activeTab, setActiveTab] = useState("conceptos");
  const [selectedConceptData, setSelectedConceptData] = useState(null);
  const [documentosNotificacion, setDocumentosNotificacion] = useState([]);

  // Fetch matrimonial notification documents to make them accessible to MarginalNotesTab
  useEffect(() => {
      if (user?.parishId) {
          const docs = obtenerNotificacionesMatrimoniales(user.parishId);
          setDocumentosNotificacion(docs || []);
      }
  }, [user, obtenerNotificacionesMatrimoniales]);

  const handleSelectConcept = (concept) => {
      setSelectedConceptData(concept);
      setActiveTab("notas"); // Automatically switch to the Notes tab
  };
  
  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-[#4B7BA7] font-serif">Conceptos de Anulación</h1>
            <p className="text-gray-600 mt-1">Gestione los motivos estandarizados y las notas marginales para los decretos.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md mb-8 bg-white border border-gray-200 p-1 rounded-lg">
                <TabsTrigger value="conceptos" className="data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white">
                    Conceptos de Anulación
                </TabsTrigger>
                <TabsTrigger value="notas" className="data-[state=active]:bg-[#4B7BA7] data-[state=active]:text-white">
                    Notas Al Margen
                </TabsTrigger>
            </TabsList>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <TabsContent value="conceptos">
                    <AnnulmentConceptsTab onSelectConcept={handleSelectConcept} />
                </TabsContent>

                <TabsContent value="notas">
                    <MarginalNotesTab 
                        selectedConceptData={selectedConceptData}
                        documentos={documentosNotificacion}
                    />
                </TabsContent>
            </motion.div>
        </Tabs>
    </DashboardLayout>
  );
};

export default AnnulmentConceptsPage;