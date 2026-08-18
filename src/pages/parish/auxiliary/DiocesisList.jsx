import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient'; 
import { Pencil, Trash2, Plus, Search, Upload, Loader2 } from 'lucide-react';
import ImportDiocesisForm from '@/components/modals/ImportDiocesisForm';

const DiocesisList = () => {
    const { user } = useAuth();
    const { getDiocesis, addDiocesis, updateDiocesis, deleteDiocesis } = useAppData();
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [isLoading, setIsLoading] = useState(true); 

    const [formData, setFormData] = useState({ nombre: '', codigo: '', region: '', descripcion: '' });

    const loadData = async () => {
        const contextId = user?.parishId || user?.dioceseId;
        if (!contextId) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('diocesis')
                .select('*')
                .eq('parish_id', contextId)
                .order('nombre', { ascending: true });

            if (error) throw error;
            setItems(data || []);
            localStorage.setItem(`diocesis_${contextId}`, JSON.stringify(data || []));
        } catch (error) {
            console.error("Error cargando diócesis:", error);
            setItems(getDiocesis(contextId)); 
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.parishId, user?.dioceseId]);

    const handleOpenModal = (item = null) => {
        if (item) {
            setCurrentItem(item);
            setFormData({ ...item });
        } else {
            setCurrentItem(null);
            setFormData({ nombre: '', codigo: '', region: '', descripcion: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.nombre) {
            toast({ title: 'Error', description: 'El nombre es requerido.', variant: 'destructive' });
            return;
        }

        // 🚀 BLOQUEO DE DUPLICADOS MANUALES
        const isDuplicate = items.some(i => 
            i.id !== currentItem?.id && // Si estamos editando, ignoramos el mismo registro
            (
                (formData.codigo && i.codigo && String(i.codigo).toLowerCase() === String(formData.codigo).toLowerCase()) ||
                (String(i.nombre).toLowerCase() === String(formData.nombre).toLowerCase())
            )
        );

        if (isDuplicate) {
            toast({ title: 'Duplicado', description: 'El nombre o código de la Diócesis ya existe en el sistema.', variant: 'destructive' });
            return;
        }

        const contextId = user?.parishId || user?.dioceseId;
        setIsLoading(true);

        if (currentItem) {
            await updateDiocesis(currentItem.id, formData, contextId);
            toast({ title: 'Éxito', description: 'Diócesis actualizada exitosamente.', className: "bg-green-50 border-green-200 text-green-900" });
        } else {
            await addDiocesis(formData, contextId);
            toast({ title: 'Éxito', description: 'Diócesis agregada exitosamente.', className: "bg-green-50 border-green-200 text-green-900" });
        }
        
        setIsModalOpen(false);
        await loadData(); 
    };

    const handleDelete = async (item) => {
        if (window.confirm('¿Está seguro de eliminar esta diócesis?')) {
            setIsLoading(true);
            const contextId = user?.parishId || user?.dioceseId;
            await deleteDiocesis(item.id, contextId);
            toast({ title: 'Eliminado', description: 'Registro eliminado exitosamente.', className: "bg-green-50 border-green-200 text-green-900" });
            await loadData(); 
        }
    };

    const filteredItems = items.filter(i => 
        (i.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const headers = ["Nombre", "Código", "Región", "Descripción"];

    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
                <div className="relative w-full lg:w-1/3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input 
                        placeholder="Buscar diócesis..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-full"
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="text-sm text-gray-500 font-medium hidden sm:block mr-2">
                        Total: <span className="text-[#111111] font-bold">{filteredItems.length}</span> registros
                    </div>

                    <Button 
                        onClick={() => setIsImportOpen(true)} 
                        variant="outline"
                        className="flex-1 lg:flex-none border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" /> Importar JSON
                    </Button>

                    <Button 
                        onClick={() => handleOpenModal()} 
                        className="flex-1 lg:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Agregar Diócesis
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs uppercase bg-[#D4AF37] text-[#111111] font-bold">
                            <tr>
                                <th className="px-4 py-3 sticky left-0 bg-[#D4AF37] z-10 w-24 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Acciones</th>
                                {headers.map((header, idx) => (
                                    <th key={idx} className="px-4 py-3 border-l border-[#C4A027]">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={headers.length + 1} className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                                        <p className="text-xs font-bold text-gray-500 uppercase">Sincronizando con Supabase...</p>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={headers.length + 1} className="px-6 py-12 text-center text-gray-500 italic">
                                        No hay diócesis registradas o que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, index) => (
                                    <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2 sticky left-0 bg-white border-r border-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="flex items-center gap-1 justify-center">
                                                {/* 🚀 BOTONES PROTEGIDOS CONTRA EVENT BUBBLING */}
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenModal(item); }}
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(item); }}
                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 font-bold text-[#111111]">{item.nombre}</td>
                                        <td className="px-4 py-2 font-mono text-gray-600">{item.codigo}</td>
                                        <td className="px-4 py-2">{item.region}</td>
                                        <td className="px-4 py-2 max-w-[200px] truncate" title={item.descripcion}>{item.descripcion}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentItem ? 'Editar Diócesis' : 'Nueva Diócesis'}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Nombre *</label>
                        <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Diócesis de Sonsón Rionegro" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">Código</label>
                            <Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} placeholder="Ej: DSR" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">Región</label>
                            <Input value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} placeholder="Ej: Antioquia" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Descripción</label>
                        <Input value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} className="bg-[#4B7BA7] text-white">Guardar</Button>
                    </div>
                </div>
            </Modal>

            {isImportOpen && (
                <ImportDiocesisForm 
                    isOpen={isImportOpen} 
                    existingItems={items} // 🚀 Pasamos los datos reales
                    onClose={() => {
                        setIsImportOpen(false);
                        loadData();
                    }} 
                />
            )}
        </div>
    );
};

export default DiocesisList;