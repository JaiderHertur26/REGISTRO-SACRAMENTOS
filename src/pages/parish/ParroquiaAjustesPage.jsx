import React, { useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Database, FileText, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import ConfirmationJsonImporter from '@/components/ConfirmationJsonImporter';
import BaptismJsonImporter from '@/components/BaptismJsonImporter';
import MatrimonioJsonImporter from '@/components/MatrimonioJsonImporter';
import DecreeJsonImporter from '@/components/DecreeJsonImporter';

// Import Forms
import ImportDiocesisForm from '@/components/modals/ImportDiocesisForm';
import ImportIglesiasForm from '@/components/modals/ImportIglesiasForm';
import ImportObisposForm from '@/components/modals/ImportObisposForm';
import ImportParrocosForm from '@/components/modals/ImportParrocosForm';
import ImportCiudadesForm from '@/components/modals/ImportCiudadesForm';

// Utility functions
import { parseMisDatosJSON, validateMisDatosFile } from '@/utils/misDatosImportValidator';
import { saveMisDatosToLocalStorage } from '@/utils/misDatosStorageHelper';

const ParroquiaAjustesPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef(null);

    // State for the first set of tabs (Catalogs)
    const [catalogImportTab, setCatalogImportTab] = useState('diocesis');
    // State for the second set of tabs (Sacraments)
    const [sacramentImportTab, setSacramentImportTab] = useState('bautizos'); 
    // State for the third set of tabs (Decrees)
    const [decreeImportTab, setDecreeImportTab] = useState('bautizos');

    // Catalog Import Modals
    const [isDiocesisImportOpen, setIsDiocesisImportOpen] = useState(false);
    const [isIglesiasImportOpen, setIsIglesiasImportOpen] = useState(false);
    const [isObisposImportOpen, setIsObisposImportOpen] = useState(false);
    const [isParrocosImportOpen, setIsParrocosImportOpen] = useState(false);
    const [isCiudadesImportOpen, setIsCiudadesImportOpen] = useState(false);

    const handleImportMisDatosClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleImportMisDatos = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const parsedData = parseMisDatosJSON(content);
            const validation = validateMisDatosFile(parsedData);

            if (!validation.isValid) {
                toast({
                    title: "Error de validación",
                    description: validation.errors.join(" "),
                    variant: "destructive"
                });
            } else {
                const entityId = user?.parishId || user?.dioceseId || 'default';
                try {
                    saveMisDatosToLocalStorage(parsedData.data, entityId);
                    toast({
                        title: "¡Importación exitosa!",
                        description: `Datos importados correctamente. Total: ${validation.recordCount} registros.`,
                        className: "bg-green-50 text-green-700"
                    });
                } catch (err) {
                    toast({
                        title: "Error al guardar",
                        description: err.message,
                        variant: "destructive"
                    });
                }
            }
            
            // Clear input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        reader.onerror = () => {
            toast({
                title: "Error de lectura",
                description: "No se pudo leer el archivo seleccionado.",
                variant: "destructive"
            });
        };

        reader.readAsText(file);
    };

    const ImportTabContent = ({ title, description, onClick, buttonText, children }) => (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50 mt-4">
            <h3 className="text-lg font-semibold text-[#111111] mb-2">{title}</h3>
            <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>
            {children || (
                <Button onClick={onClick} className="bg-[#4B7BA7] text-white hover:bg-[#3B6B97]">
                    <Upload className="w-4 h-4 mr-2" /> {buttonText || "Iniciar Importación"}
                </Button>
            )}
        </div>
    );

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[#111111]">Ajustes de Parroquia</h1>
                <p className="text-gray-500 mt-1">Gestión de datos auxiliares, catálogos e importaciones masivas.</p>
            </div>

            <div className="space-y-8">
                {/* SECTION: IMPORTAR CATÁLOGOS Y REGISTROS */}
                <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <FileText className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#111111]">Importar Catálogos y Registros</h2>
                            <p className="text-sm text-gray-500">Carga masiva de datos desde archivos JSON.</p>
                        </div>
                    </div>

                    <Tabs value={catalogImportTab} onValueChange={setCatalogImportTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto mb-6 bg-gray-100/80 p-1">
                            <TabsTrigger value="diocesis">Diócesis</TabsTrigger>
                            <TabsTrigger value="iglesias">Iglesias</TabsTrigger>
                            <TabsTrigger value="obispos">Obispos</TabsTrigger>
                            <TabsTrigger value="parrocos">Párrocos</TabsTrigger>
                            <TabsTrigger value="misdatos">Mis Datos</TabsTrigger>
                            <TabsTrigger value="ciudades">Ciudades</TabsTrigger>
                        </TabsList>

                         <TabsContent value="diocesis">
                            <ImportTabContent 
                                title="Catálogo de Diócesis"
                                description="Importe un archivo JSON con la lista de diócesis. Estructura requerida: nombre, código, región, descripción."
                                onClick={() => setIsDiocesisImportOpen(true)}
                                buttonText="Importar Diócesis"
                            />
                        </TabsContent>
                         <TabsContent value="iglesias">
                            <ImportTabContent 
                                title="Catálogo de Iglesias"
                                description="Importe un archivo JSON con la lista de iglesias. Estructura requerida: nombre, código, diócesis."
                                onClick={() => setIsIglesiasImportOpen(true)}
                                buttonText="Importar Iglesias"
                            />
                        </TabsContent>
                         <TabsContent value="obispos">
                            <ImportTabContent 
                                title="Catálogo de Obispos"
                                description="Importe un archivo JSON con la lista de obispos. Estructura requerida: nombre, apellido, diócesis."
                                onClick={() => setIsObisposImportOpen(true)}
                                buttonText="Importar Obispos"
                            />
                        </TabsContent>
                         <TabsContent value="parrocos">
                            <ImportTabContent 
                                title="Catálogo de Párrocos"
                                description="Importe un archivo JSON con la lista de párrocos. Estructura requerida: nombre, apellido, iglesia."
                                onClick={() => setIsParrocosImportOpen(true)}
                                buttonText="Importar Párrocos"
                            />
                        </TabsContent>
                        <TabsContent value="misdatos">
                            <ImportTabContent 
                                title="Importar Mis Datos"
                                description="Importe un archivo JSON con la lista de sus datos. Estructura requerida: array 'data' con campo 'nombre' obligatorio."
                                onClick={handleImportMisDatosClick}
                                buttonText="Seleccionar Archivo JSON"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImportMisDatos}
                                    accept=".json"
                                    className="hidden"
                                />
                                <Button onClick={handleImportMisDatosClick} className="bg-[#4B7BA7] text-white hover:bg-[#3B6B97]">
                                    <Upload className="w-4 h-4 mr-2" /> Seleccionar Archivo JSON
                                </Button>
                            </ImportTabContent>
                        </TabsContent>
                        <TabsContent value="ciudades">
                            <ImportTabContent 
                                title="Catálogo de Ciudades"
                                description="Importe un archivo JSON con la lista de ciudades. Estructura requerida: data (nombre), source, count, weight."
                                onClick={() => setIsCiudadesImportOpen(true)}
                                buttonText="Importar Ciudades"
                            />
                        </TabsContent>
                    </Tabs>
                </section>

                {/* SECTION: IMPORTAR OTROS SACRAMENTOS (Legacy) */}
                <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
                     <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                            <Database className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#111111]">Importar Otros Sacramentos</h2>
                            <p className="text-sm text-gray-500">Migración de libros sacramentales antiguos.</p>
                        </div>
                    </div>
                    
                    <Tabs value={sacramentImportTab} onValueChange={setSacramentImportTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 h-auto mb-6 bg-gray-100/80 p-1">
                            <TabsTrigger value="bautizos" className="data-[state=active]:text-blue-600 data-[state=active]:font-bold">Bautizos</TabsTrigger>
                            <TabsTrigger value="confirmaciones" className="data-[state=active]:text-red-600 data-[state=active]:font-bold">Confirmaciones</TabsTrigger>
                            <TabsTrigger value="matrimonios" className="data-[state=active]:text-yellow-600 data-[state=active]:font-bold">Matrimonios</TabsTrigger>
                        </TabsList>

                        <TabsContent value="bautizos">
                             <div className="mt-4">
                                <h3 className="text-lg font-semibold text-[#111111] mb-2 px-1">Importar Partidas de Bautismo</h3>
                                <p className="text-sm text-gray-500 max-w-2xl mb-4 px-1">
                                    Utilice esta herramienta para cargar masivamente registros de bautismo desde un archivo JSON estructurado (Legacy).
                                </p>
                                <BaptismJsonImporter />
                            </div>
                        </TabsContent>

                        <TabsContent value="confirmaciones">
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-[#111111] mb-2 px-1">Importar Partidas de Confirmación</h3>
                                <p className="text-sm text-gray-500 max-w-2xl mb-4 px-1">
                                    Utilice esta herramienta para cargar masivamente registros de confirmación desde un archivo JSON estructurado (Legacy).
                                </p>
                                <ConfirmationJsonImporter />
                            </div>
                        </TabsContent>

                        <TabsContent value="matrimonios">
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-[#111111] mb-2 px-1">Importar Partidas de Matrimonio</h3>
                                <p className="text-sm text-gray-500 max-w-2xl mb-4 px-1">
                                    Utilice esta herramienta para cargar masivamente registros de matrimonio desde un archivo JSON estructurado (Legacy).
                                </p>
                                <MatrimonioJsonImporter />
                            </div>
                        </TabsContent>
                    </Tabs>
                </section>

                {/* SECTION: IMPORTAR DECRETOS */}
                <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
                     <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Database className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#111111]">Importar Decretos</h2>
                            <p className="text-sm text-gray-500">Migración de decretos de corrección, reposición y otros.</p>
                        </div>
                    </div>
                    
                    <Tabs value={decreeImportTab} onValueChange={setDecreeImportTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 h-auto mb-6 bg-gray-100/80 p-1">
                            <TabsTrigger value="bautizos" className="data-[state=active]:text-blue-600 data-[state=active]:font-bold">Bautizos</TabsTrigger>
                            <TabsTrigger value="confirmaciones" className="data-[state=active]:text-red-600 data-[state=active]:font-bold">Confirmaciones</TabsTrigger>
                            <TabsTrigger value="matrimonios" className="data-[state=active]:text-yellow-600 data-[state=active]:font-bold">Matrimonios</TabsTrigger>
                        </TabsList>

                        <TabsContent value="bautizos">
                             <div className="mt-4">
                                <h3 className="text-lg font-semibold text-[#111111] mb-2 px-1">Importar Decretos de Bautismo</h3>
                                <p className="text-sm text-gray-500 max-w-2xl mb-4 px-1">
                                    Importación masiva de decretos relacionados con partidas de bautismo.
                                </p>
                                <DecreeJsonImporter sacramentType="baptism" />
                            </div>
                        </TabsContent>

                        <TabsContent value="confirmaciones">
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-[#111111] mb-2 px-1">Importar Decretos de Confirmación</h3>
                                <p className="text-sm text-gray-500 max-w-2xl mb-4 px-1">
                                    Importación masiva de decretos relacionados con partidas de confirmación.
                                </p>
                                <DecreeJsonImporter sacramentType="confirmation" />
                            </div>
                        </TabsContent>

                        <TabsContent value="matrimonios">
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-[#111111] mb-2 px-1">Importar Decretos de Matrimonio</h3>
                                <p className="text-sm text-gray-500 max-w-2xl mb-4 px-1">
                                    Importación masiva de decretos relacionados con partidas de matrimonio.
                                </p>
                                <DecreeJsonImporter sacramentType="matrimonio" />
                            </div>
                        </TabsContent>
                    </Tabs>
                </section>
            </div>

            {/* Modals - Catalogs */}
            <ImportDiocesisForm isOpen={isDiocesisImportOpen} onClose={() => setIsDiocesisImportOpen(false)} />
            <ImportIglesiasForm isOpen={isIglesiasImportOpen} onClose={() => setIsIglesiasImportOpen(false)} />
            <ImportObisposForm isOpen={isObisposImportOpen} onClose={() => setIsObisposImportOpen(false)} />
            <ImportParrocosForm isOpen={isParrocosImportOpen} onClose={() => setIsParrocosImportOpen(false)} />
            <ImportCiudadesForm isOpen={isCiudadesImportOpen} onClose={() => setIsCiudadesImportOpen(false)} />
        </DashboardLayout>
    );
};

export default ParroquiaAjustesPage;