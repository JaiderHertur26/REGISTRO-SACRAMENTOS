import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, ArrowLeft, FileText, UserPlus, Printer } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import PrintCorrectionDecree from '@/components/PrintCorrectionDecree';

const EditDecreeCorrectionPage = () => {
    const { user } = useAuth();
    const { getBaptismCorrections, updateBaptismCorrection } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const correctionId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [decreeData, setDecreeData] = useState({});
    const [newPartida, setNewPartida] = useState({});
    
    // Print logic
    const componentRef = useRef();
    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Decreto_${decreeData.decreeNumber || 'SinNumero'}`
    });

    useEffect(() => {
        if (!user || !correctionId) return;
        loadData();
    }, [user, correctionId]);

    const loadData = () => {
        const corrections = getBaptismCorrections(user?.parishId || user?.dioceseId);
        const found = corrections.find(c => c.id === correctionId);
        
        if (found) {
            setDecreeData({
                id: found.id,
                parroquia: found.parroquia,
                ciudad: found.ciudad,
                decreeNumber: found.decreeNumber,
                decreeDate: found.decreeDate,
                originalPartidaSummary: found.originalPartidaSummary,
                baptismData: found.baptismData || {} 
            });
            setNewPartida(found.newPartidaSummary || {}); 
        } else {
            toast({ title: "Error", description: "Decreto no encontrado", variant: "destructive" });
            navigate('/chancery/decree-correction');
        }
        setLoading(false);
    };

    const handleSave = () => {
        if (!decreeData.decreeNumber) {
            toast({ title: "Error", description: "Número de decreto requerido", variant: "destructive" });
            return;
        }

        const updatedData = {
            ...decreeData,
            newPartidaSummary: { ...newPartida },
            baptismData: { ...decreeData.baptismData, ...newPartida }
        };

        const result = updateBaptismCorrection(correctionId, updatedData, user?.parishId || user?.dioceseId);
        if (result.success) {
            setDecreeData(updatedData);
            toast({ title: "Éxito", description: "Corrección actualizada." });
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    };

    if (loading) return <div>Cargando...</div>;

    const printData = {
        ...decreeData,
        baptismData: { 
            ...decreeData.baptismData, 
            ...newPartida
        }
    };

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
             <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/chancery/decree-correction')} className="p-0 hover:bg-transparent">
                        <ArrowLeft className="w-6 h-6 text-gray-500" />
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-900 font-serif">Editar Decreto de Corrección</h1>
                </div>
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir Decreto
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Decree Info */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                         <FileText className="w-5 h-5 text-blue-600" />
                         <h3 className="font-bold text-gray-800">Datos del Decreto</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">No. Decreto</label>
                                <Input value={decreeData.decreeNumber} onChange={(e) => setDecreeData({...decreeData, decreeNumber: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha</label>
                                <Input type="date" value={decreeData.decreeDate} onChange={(e) => setDecreeData({...decreeData, decreeDate: e.target.value})} />
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded border">
                            <h4 className="font-bold text-gray-700 text-sm mb-2">Partida Anulada (Lectura)</h4>
                            <p className="text-sm"><strong>Nombre:</strong> {decreeData.originalPartidaSummary?.firstName} {decreeData.originalPartidaSummary?.lastName}</p>
                            <p className="text-sm"><strong>Ref:</strong> L:{decreeData.originalPartidaSummary?.book} F:{decreeData.originalPartidaSummary?.page} N:{decreeData.originalPartidaSummary?.entry}</p>
                        </div>
                    </div>
                </div>

                {/* New Partida Form */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                     <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                        <UserPlus className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-gray-800">Datos de la Nueva Partida</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nombres</label><Input value={newPartida.firstName || ''} onChange={e => setNewPartida({...newPartida, firstName: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Apellidos</label><Input value={newPartida.lastName || ''} onChange={e => setNewPartida({...newPartida, lastName: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha Nac.</label><Input type="date" value={newPartida.birthDate || ''} onChange={e => setNewPartida({...newPartida, birthDate: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha Bautismo</label><Input type="date" value={newPartida.sacramentDate || ''} onChange={e => setNewPartida({...newPartida, sacramentDate: e.target.value})} /></div>
                         {/* Other fields simplified for brevity but matching structure of NewPage */}
                         <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Padre</label><Input value={newPartida.fatherName || ''} onChange={e => setNewPartida({...newPartida, fatherName: e.target.value})} /></div>
                         <div><label className="block text-xs font-bold text-gray-600 uppercase mb-1">Madre</label><Input value={newPartida.motherName || ''} onChange={e => setNewPartida({...newPartida, motherName: e.target.value})} /></div>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-4">
                 <Button variant="outline" onClick={() => navigate('/chancery/decree-correction')}>Cancelar</Button>
                 <Button onClick={handleSave} className="bg-blue-600 text-white"><Save className="w-4 h-4 mr-2" /> Guardar Cambios</Button>
            </div>

            {/* Hidden Print Template */}
            <div style={{ display: 'none' }}>
                <PrintCorrectionDecree ref={componentRef} decreeData={printData} />
            </div>
        </DashboardLayout>
    );
};

export default EditDecreeCorrectionPage;