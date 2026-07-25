import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppData } from '@/context/AppDataContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Edit, Trash2, Printer, AlertCircle } from 'lucide-react';

const BaptismDetailPage = () => {
  const { baptismPartidaId } = useParams();
  const navigate = useNavigate();
  const { data, deleteBaptism } = useAppData();
  const { toast } = useToast();
  const [baptism, setBaptism] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("Loading BaptismDetailPage with ID:", baptismPartidaId);
    
    if (!baptismPartidaId) {
      console.error("No baptismPartidaId provided in URL");
      setError("Error: ID de partida no encontrado");
      return;
    }

    if (data && data.baptisms) {
      const found = data.baptisms.find(b => b.id === baptismPartidaId);
      if (found) {
        console.log("Baptism record found:", found);
        setBaptism(found);
        setError(null);
      } else {
        console.warn(`Baptism record with ID ${baptismPartidaId} not found in data.baptisms`);
        setError("Error: Partida de bautismo no encontrada");
        setBaptism(null);
      }
    }
  }, [baptismPartidaId, data]);

  const handleDelete = () => {
    if (window.confirm('¿Está seguro de que desea eliminar este registro de bautismo? Esta acción no se puede deshacer.')) {
      deleteBaptism(baptismPartidaId);
      toast({
        title: "Registro Eliminado",
        description: "El registro de bautismo ha sido eliminado exitosamente.",
      });
      navigate('/parroquia/bautismo/partidas');
    }
  };

  const handlePrint = () => {
    // This assumes a print route exists or triggers a print dialog
    navigate(`/baptism/print/${baptismPartidaId}`);
  };

  if (error || !baptism) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error de Carga</h2>
          <p className="text-gray-600 mb-6 text-center max-w-md">
            {error || 'Cargando información...'}
          </p>
          <Button onClick={() => navigate('/parroquia/bautismo/partidas')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver a la Lista
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Detalles de Partida de Bautismo</title>
        <meta name="description" content="Detalles de partida de bautismo" />
      </Helmet>

      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/parroquia/bautismo/partidas')}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Detalles de Bautismo</h1>
                  <p className="text-gray-600 mt-1">{baptism.firstName} {baptism.lastName}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handlePrint}
                  className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Comprobante
                </Button>
                <Button
                  onClick={handleDelete}
                  variant="outline"
                  className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between pb-4 border-b">
                <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${
                  baptism.status === 'seated'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  Estado: {baptism.status === 'seated' ? 'Asentada' : 'Pendiente'}
                </span>
                {baptism.status === 'seated' && (
                  <div className="text-sm font-mono text-gray-600">
                    Libro: {baptism.bookNumber} | Folio: {baptism.folioNumber} | No: {baptism.baptismNumber}
                  </div>
                )}
              </div>

              {/* Baptism Data */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-1">1. Información del Bautismo</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Fecha de Bautismo</p>
                    <p className="text-gray-900 font-medium">{baptism.baptismDate ? new Date(baptism.baptismDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Hora</p>
                    <p className="text-gray-900 font-medium">{baptism.baptismTime || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Parroquia</p>
                    <p className="text-gray-900 font-medium">{baptism.parish || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ministro Celebrante</p>
                    <p className="text-gray-900 font-medium">{baptism.celebrantMinister || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Baptized Person */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-1">2. Datos del Bautizado(a)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Nombre Completo</p>
                    <p className="text-gray-900 font-medium">{baptism.firstName} {baptism.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Sexo</p>
                    <p className="text-gray-900 font-medium">{baptism.sex === 'M' ? 'Masculino' : baptism.sex === 'F' ? 'Femenino' : baptism.sex || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de Nacimiento</p>
                    <p className="text-gray-900 font-medium">{baptism.birthDate ? new Date(baptism.birthDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Documento / CUI</p>
                    <p className="text-gray-900 font-medium">{baptism.document || 'N/A'}</p>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <p className="text-sm text-gray-500">Lugar de Nacimiento</p>
                    <p className="text-gray-900 font-medium">
                      {[baptism.birthCity, baptism.birthMunicipality, baptism.birthDepartment, baptism.birthCountry]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Parents */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-1">3. Datos de los Padres</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Padre</p>
                    <p className="text-gray-900 font-medium">{baptism.fatherName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Madre</p>
                    <p className="text-gray-900 font-medium">{baptism.motherName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado Civil</p>
                    <p className="text-gray-900 font-medium">{baptism.parentsMaritalStatus || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Teléfono</p>
                    <p className="text-gray-900 font-medium">{baptism.parentsPhone || 'N/A'}</p>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <p className="text-sm text-gray-500">Dirección</p>
                    <p className="text-gray-900 font-medium">{baptism.parentsAddress || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Godparents */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-1">4. Padrinos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Padrino</p>
                    <p className="text-gray-900 font-medium">{baptism.godfatherName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Madrina</p>
                    <p className="text-gray-900 font-medium">{baptism.godmotherName || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-1">5. Información Adicional</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Notas Marginales / Observaciones</p>
                    <p className="text-gray-900 font-medium whitespace-pre-wrap bg-gray-50 p-3 rounded border mt-1">
                      {baptism.observations || 'Sin observaciones registradas.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-sm text-gray-500">Registrado por</p>
                      <p className="text-gray-900 font-medium">{baptism.registeringUser || 'Sistema'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Fecha de Registro en Sistema</p>
                      <p className="text-gray-900 font-medium">{baptism.createdAt ? new Date(baptism.createdAt).toLocaleString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </>
  );
};

export default BaptismDetailPage;