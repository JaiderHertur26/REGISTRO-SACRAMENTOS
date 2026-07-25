import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight, 
    CheckCircle2, 
    LogOut,
    Heart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MatrimonioSeatIndividualPage = () => {
    const { user } = useAuth();
    const { getPendingMatrimonios, getNextMatrimonioNumbers, seatMatrimonio } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [pending, setPending] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [nextNumbers, setNextNumbers] = useState(null);

    const loadData = async () => {
        setLoading(true);
        const records = await getPendingMatrimonios(user?.parishId);
        setPending(records);
        setNextNumbers(getNextMatrimonioNumbers(user?.parishId));
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [user?.parishId]);

    const currentRecord = pending[currentIndex];

    const handleConfirm = async () => {
        if (!currentRecord) return;
        
        const result = await seatMatrimonio(currentRecord.id, user?.parishId);
        
        if (result.success) {
            toast({
                title: "Registro Asentado",
                description: result.message,
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-900"
            });
            const newRecords = await getPendingMatrimonios(user?.parishId);
            setPending(newRecords);
            setNextNumbers(getNextMatrimonioNumbers(user?.parishId));
            
            if (currentIndex >= newRecords.length) {
                setCurrentIndex(Math.max(0, newRecords.length - 1));
            }
        } else {
             toast({
                title: "Error",
                description: result.message,
                variant: "destructive"
            });
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando registros pendientes...</div>;

    if (pending.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-semibold mb-2">¡Todo al día!</h2>
                <p>No hay matrimonios pendientes de registro.</p>
                <Button variant="outline" className="mt-6" onClick={() => navigate('/parroquia/matrimonio/sentar-registros')}>
                    Volver
                </Button>
            </div>
        );
    }

    const Field = ({ label, value }) => (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
            <p className="text-gray-900 font-medium text-sm truncate">{value || '---'}</p>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                 <div className="flex items-center gap-3">
                     <div className="bg-[#D4AF37]/10 p-2 rounded-lg text-[#D4AF37]">
                         <Heart className="w-5 h-5" />
                     </div>
                     <div>
                         <h2 className="text-lg font-bold text-gray-800">
                             Matrimonio {currentIndex + 1} de {pending.length}
                         </h2>
                         <p className="text-xs text-gray-500">Revise los datos antes de asentar.</p>
                     </div>
                 </div>

                 <div className="flex items-center gap-2">
                     <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(0)} disabled={currentIndex === 0}>
                         <ChevronsLeft className="w-4 h-4" />
                     </Button>
                     <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}>
                         <ChevronLeft className="w-4 h-4" />
                     </Button>
                     <span className="text-sm font-medium text-gray-600 px-2 min-w-[3rem] text-center">
                         {currentIndex + 1} / {pending.length}
                     </span>
                     <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(prev => Math.min(pending.length - 1, prev + 1))} disabled={currentIndex === pending.length - 1}>
                         <ChevronRight className="w-4 h-4" />
                     </Button>
                     <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(pending.length - 1)} disabled={currentIndex === pending.length - 1}>
                         <ChevronsRight className="w-4 h-4" />
                     </Button>
                 </div>
            </div>

            {/* Form Content */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Section 1: Numeración */}
                <div className="col-span-full mb-2">
                    <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">Datos de Registro (Asignación Automática)</h3>
                    <div className="grid grid-cols-3 gap-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <Field label="Libro" value={String(nextNumbers?.book || '1').padStart(4, '0')} />
                        <Field label="Folio" value={String(nextNumbers?.page || '1').padStart(4, '0')} />
                        <Field label="Número" value={String(nextNumbers?.entry || '1').padStart(4, '0')} />
                    </div>
                </div>

                {/* Section 2: Contrayentes */}
                <div className="col-span-full md:col-span-2 lg:col-span-4">
                     <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider mb-3 border-b border-gray-100 pb-1 mt-2">Contrayentes</h3>
                </div>
                <div className="col-span-2">
                    <h4 className="text-xs font-bold uppercase mb-2 text-blue-800">Novio</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Nombres" value={currentRecord.groomName} />
                        <Field label="Apellidos" value={currentRecord.groomSurname} />
                        <div className="col-span-2"><Field label="Padres" value={`${currentRecord.groomFather || ''} y ${currentRecord.groomMother || ''}`} /></div>
                    </div>
                </div>
                <div className="col-span-2">
                    <h4 className="text-xs font-bold uppercase mb-2 text-pink-800">Novia</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Nombres" value={currentRecord.brideName} />
                        <Field label="Apellidos" value={currentRecord.brideSurname} />
                         <div className="col-span-2"><Field label="Padres" value={`${currentRecord.brideFather || ''} y ${currentRecord.brideMother || ''}`} /></div>
                    </div>
                </div>
                
                {/* Section 3: Celebración */}
                <div className="col-span-full md:col-span-2 lg:col-span-4 mt-2">
                     <h3 className="text-sm font-bold text-[#4B7BA7] uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">Celebración y Testigos</h3>
                </div>
                <Field label="Fecha Matrimonio" value={currentRecord.sacramentDate} />
                <Field label="Lugar" value={currentRecord.place || user?.parishName} />
                <div className="col-span-2">
                    <Field label="Ministro" value={currentRecord.minister} />
                </div>
                <div className="col-span-full">
                    <Field label="Testigos" value={currentRecord.witnesses?.map(w => w.name).join(', ') || '---'} />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                <Button variant="outline" className="gap-2 text-gray-600" onClick={() => navigate('/parroquia/dashboard')}>
                    <LogOut className="w-4 h-4" /> Salir
                </Button>
                <Button className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white gap-2 px-8 shadow-md transition-all hover:translate-y-[-1px]" onClick={handleConfirm}>
                    <CheckCircle2 className="w-4 h-4" /> Registrar y Siguiente
                </Button>
            </div>
        </div>
    );
};

export default MatrimonioSeatIndividualPage;