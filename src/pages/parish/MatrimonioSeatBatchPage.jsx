import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MatrimonioSeatBatchPage = () => {
    const { user } = useAuth();
    const { getPendingMatrimonios, seatMultipleMatrimonios } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [pending, setPending] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        const records = await getPendingMatrimonios(user?.parishId);
        setPending(records);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [user?.parishId]);

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds(pending.map(b => b.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBatchConfirm = async () => {
        if (selectedIds.length === 0) return;
        
        const result = await seatMultipleMatrimonios(selectedIds, user?.parishId);
        
        if (result.success) {
            toast({
                title: "Lote Procesado",
                description: result.message,
                variant: "success",
                className: "bg-green-50 border-green-200 text-green-900"
            });
            setSelectedIds([]);
            loadData();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando registros...</div>;

    if (pending.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Sin Pendientes</h2>
                <p>No hay inscripciones pendientes para procesar en lote.</p>
                <Button variant="outline" className="mt-6" onClick={() => navigate('/parroquia/dashboard')}>
                    Volver al Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600 uppercase tracking-wider text-xs">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                    checked={selectedIds.length === pending.length && pending.length > 0}
                                    className="w-4 h-4 rounded border-gray-300 text-[#4B7BA7] focus:ring-[#4B7BA7]"
                                />
                            </th>
                            <th className="px-6 py-4">Novio</th>
                            <th className="px-6 py-4">Novia</th>
                            <th className="px-6 py-4">Fecha Matrimonio</th>
                            <th className="px-6 py-4 text-center">Seleccionar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pending.map((item, index) => (
                            <tr 
                                key={item.id} 
                                className={`transition-colors cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                onClick={() => toggleSelection(item.id)}
                            >
                                <td className="px-6 py-4 text-center text-gray-400 font-mono text-xs">
                                    {index + 1}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {item.groomName} {item.groomSurname}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {item.brideName} {item.brideSurname}
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                    {item.sacramentDate}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => {}} 
                                        className="w-4 h-4 rounded border-gray-300 text-[#4B7BA7] focus:ring-[#4B7BA7]"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-gray-50 border-t border-gray-200 p-4 md:px-6 md:py-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#4B7BA7]"></span>
                            <span>Seleccionadas: <strong>{selectedIds.length}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
                            <span>Total: <strong>{pending.length}</strong></span>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                        <Button variant="outline" className="flex-1 md:flex-none gap-2" onClick={() => navigate('/parroquia/dashboard')}>
                            <X className="w-4 h-4" /> Cancelar
                        </Button>
                        <Button 
                            className="flex-1 md:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white gap-2 shadow-md"
                            disabled={selectedIds.length === 0}
                            onClick={handleBatchConfirm}
                        >
                            <CheckCircle2 className="w-4 h-4" /> Registrar Selección
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MatrimonioSeatBatchPage;