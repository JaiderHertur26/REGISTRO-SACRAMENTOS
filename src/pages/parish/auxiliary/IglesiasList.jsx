import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

// Modals
import CreateIglesiaModal from '@/components/modals/CreateIglesiaModal';
import EditIglesiaModal from '@/components/modals/EditIglesiaModal';
import DeleteIglesiaModal from '@/components/modals/DeleteIglesiaModal';

const IglesiasList = () => {
    const { user } = useAuth();
    const { getIglesiasList, addIglesia, updateIglesia, deleteIglesia } = useAppData();
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state management
    const [modals, setModals] = useState({
        create: false,
        edit: false,
        delete: false
    });
    const [selectedItem, setSelectedItem] = useState(null);
    
    // Get parishId from User context or fallback to localStorage 'currentParish'
    const getParishId = () => {
        if (user?.parishId) return user.parishId;
        try {
            const stored = localStorage.getItem('currentParish');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.id || parsed;
            }
        } catch (e) {
            console.error("Error parsing currentParish", e);
        }
        return null;
    };

    const parishId = getParishId();

    useEffect(() => {
        if (parishId) {
            loadData();
        }
    }, [parishId]);

    const loadData = () => {
        const data = getIglesiasList(parishId);
        setItems(data);
    };

    // --- Modal Handlers ---

    const handleCreate = (data) => {
        if (!parishId) {
             toast({ title: 'Error', description: 'No se ha identificado la parroquia actual.', variant: 'destructive' });
             return;
        }

        const result = addIglesia(data, parishId);
        if (result.success) {
            toast({ 
                title: 'Éxito', 
                description: result.message, 
                className: "bg-green-50 border-green-200 text-green-900" 
            });
            setModals(prev => ({ ...prev, create: false }));
            loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
        }
    };

    const handleUpdate = (id, data) => {
        const result = updateIglesia(id, data, parishId);
        if (result.success) {
            toast({ 
                title: 'Éxito', 
                description: result.message, 
                className: "bg-green-50 border-green-200 text-green-900" 
            });
            setModals(prev => ({ ...prev, edit: false }));
            loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
        }
    };

    const handleDelete = (id) => {
        const result = deleteIglesia(id, parishId);
        if (result.success) {
            toast({ 
                title: 'Eliminado', 
                description: result.message, 
                className: "bg-green-50 border-green-200 text-green-900" 
            });
            setModals(prev => ({ ...prev, delete: false }));
            loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
        }
    };

    // --- UI Actions ---

    const openEditModal = (item) => {
        setSelectedItem(item);
        setModals(prev => ({ ...prev, edit: true }));
    };

    const openDeleteModal = (item) => {
        setSelectedItem(item);
        setModals(prev => ({ ...prev, delete: true }));
    };

    const filteredItems = items.filter(i => 
        (i.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const headers = [
        "Código", "Nombre", "NIT", "Dirección", "Ciudad", "Teléfono", "Fax", "Email", "Párroco", "Diócesis"
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input 
                        placeholder="Buscar por nombre o código..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 font-medium hidden sm:block">
                        Total: <span className="text-[#111111] font-bold">{filteredItems.length}</span> registros
                    </div>
                    <Button 
                        onClick={() => setModals(prev => ({ ...prev, create: true }))} 
                        className="bg-[#4B7BA7] text-white gap-2 hover:bg-[#3A6286]"
                    >
                        <Plus className="w-4 h-4" /> Agregar Iglesia
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
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={headers.length + 1} className="px-6 py-12 text-center text-gray-500 italic">
                                        No hay iglesias registradas o que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, index) => (
                                    <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2 sticky left-0 bg-white border-r border-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="flex items-center gap-1 justify-center">
                                                <button 
                                                    onClick={() => openEditModal(item)}
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => openDeleteModal(item)}
                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-gray-600">{item.codigo}</td>
                                        <td className="px-4 py-2 font-bold text-[#111111]">{item.nombre}</td>
                                        <td className="px-4 py-2">{item.nronit || item.nit}</td>
                                        <td className="px-4 py-2 max-w-[200px] truncate" title={item.direccion}>{item.direccion}</td>
                                        <td className="px-4 py-2">{item.ciudad}</td>
                                        <td className="px-4 py-2">{item.telefono}</td>
                                        <td className="px-4 py-2">{item.nrofax || item.fax}</td>
                                        <td className="px-4 py-2 text-blue-600">{item.email}</td>
                                        <td className="px-4 py-2">{item.parroco}</td>
                                        <td className="px-4 py-2">{item.diocesis}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateIglesiaModal 
                isOpen={modals.create} 
                onClose={() => setModals(prev => ({ ...prev, create: false }))} 
                onCreate={handleCreate} 
            />

            <EditIglesiaModal 
                isOpen={modals.edit} 
                onClose={() => setModals(prev => ({ ...prev, edit: false }))} 
                onUpdate={handleUpdate}
                item={selectedItem}
            />

            <DeleteIglesiaModal 
                isOpen={modals.delete} 
                onClose={() => setModals(prev => ({ ...prev, delete: false }))} 
                onDelete={handleDelete}
                item={selectedItem}
            />
        </div>
    );
};

export default IglesiasList;