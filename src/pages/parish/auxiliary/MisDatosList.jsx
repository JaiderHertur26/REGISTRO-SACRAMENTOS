import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { 
    Pencil, Trash2, Search, Plus, Eye, 
    Eraser, Building2, ShieldCheck, Database, 
    Loader2, Globe, LayoutGrid 
} from 'lucide-react';
import { cn } from '@/lib/utils';

import EditMisDatosFormModal from '@/components/modals/EditMisDatosFormModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import ManualMisDatosModal from '@/components/modals/ManualMisDatosModal';
import ViewMisDatosModal from '@/components/modals/ViewMisDatosModal';

import { 
    getMisDatosFromLocalStorage, 
    saveMisDatosToLocalStorage, 
    clearMisDatosFromLocalStorage 
} from '@/utils/misDatosStorageHelper';

const MisDatosList = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Modal Management
    const [modals, setModals] = useState({
        manual: false,
        view: false,
        edit: false,
        delete: false
    });
    const [selectedRecord, setSelectedRecord] = useState(null);

    const entityId = user?.parishId || user?.dioceseId || 'default';

    // --- 1. CARGA Y SINCRONIZACIÓN CON LA NUBE ---
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Traemos los datos que ya están en Supabase (vía el helper)
            let cloudData = await getMisDatosFromLocalStorage(entityId) || [];
            
            // --- RESCATE DE DATOS LOCALES (MIGRACIÓN) ---
            const savedManualData = localStorage.getItem('misDatos_manual_records');
            if (savedManualData) {
                const manualData = JSON.parse(savedManualData);
                let needsSync = false;
                
                manualData.forEach(manualItem => {
                    if (!cloudData.some(item => item.id === manualItem.id)) {
                        cloudData.push(manualItem);
                        needsSync = true;
                    }
                });
                
                if (needsSync) {
                    await saveMisDatosToLocalStorage(cloudData, entityId);
                }
                localStorage.removeItem('misDatos_manual_records'); // Limpiar rastro local
            }
            
            setItems(cloudData);
        } catch (error) {
            toast({ title: 'Error de Red', description: 'No se pudo conectar con la base de datos.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (entityId) loadData();
    }, [entityId]);

    // --- 2. ACCIONES DE GESTIÓN ---
    const handleSaveManual = async (newData) => {
        setIsLoading(true);
        try {
            const updatedItems = [...items, newData];
            await saveMisDatosToLocalStorage(updatedItems, entityId);
            setItems(updatedItems);
            setModals(m => ({ ...m, manual: false }));
            toast({ title: 'Guardado', description: 'Registro inyectado en la Nube.', className: "bg-green-50 text-green-900 border-green-200" });
        } catch (e) {
            toast({ title: 'Fallo al Guardar', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditSave = async (updatedData) => {
        setIsLoading(true);
        try {
            const newItems = items.map(item => item.id === updatedData.id ? { ...updatedData } : item);
            await saveMisDatosToLocalStorage(newItems, entityId);
            setItems(newItems);
            setModals(m => ({ ...m, edit: false }));
            toast({ title: 'Actualizado', description: 'Cambios sincronizados exitosamente.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!selectedRecord) return;
        setIsDeleting(true);
        try {
            const newItems = items.filter(item => item.id !== selectedRecord.id);
            await saveMisDatosToLocalStorage(newItems, entityId);
            setItems(newItems);
            toast({ title: 'Eliminado', description: 'El registro fue borrado de la Nube.' });
        } finally {
            setIsDeleting(false);
            setSelectedRecord(null);
            setModals(m => ({ ...m, delete: false }));
        }
    };

    // --- 3. FILTRADO ---
    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return items.filter(i => 
            (i.nombre || '').toLowerCase().includes(term) || 
            (i.idcod || '').toLowerCase().includes(term) ||
            (i.nronit || '').toLowerCase().includes(term)
        );
    }, [searchTerm, items]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* CABECERA DE CONTROL */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                    <input 
                        placeholder="Buscar por nombre, NIT o código..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold uppercase tracking-tight outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#4B7BA7] transition-all"
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <Button 
                        variant="ghost"
                        onClick={() => {
                            if(window.confirm("¿Vaciar toda la base de datos de membretes?")) {
                                clearMisDatosFromLocalStorage(entityId);
                                setItems([]);
                            }
                        }}
                        className="text-red-400 hover:text-red-600 font-black uppercase tracking-widest text-[10px]"
                    >
                        <Eraser className="w-4 h-4 mr-2" /> Limpiar Todo
                    </Button>

                    <Button 
                        onClick={() => setModals(m => ({ ...m, manual: true }))} 
                        className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 transition-all transform active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Cargar Registro
                    </Button>
                </div>
            </div>

            {/* TABLA DE MEMBRETES */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px] relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mb-4" />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Sincronizando con Supabase...</p>
                    </div>
                )}

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32 text-center">Acciones</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Identificación / Nombre</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Ubicación</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Contacto</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Jerarquía</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredItems.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan="5" className="py-32 text-center">
                                        <Building2 className="w-16 h-16 mx-auto mb-4 opacity-10 text-gray-400" />
                                        <p className="font-black uppercase tracking-widest text-[10px] text-gray-400">No se encontraron membretes oficiales</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="group hover:bg-blue-50/30 transition-all duration-300">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setSelectedRecord(item); setModals(m => ({ ...m, view: true })); }} className="p-2.5 text-gray-400 hover:text-[#4B7BA7] hover:bg-white rounded-xl transition-all"><Eye className="w-4 h-4" /></button>
                                                <button onClick={() => { setSelectedRecord(item); setModals(m => ({ ...m, edit: true })); }} className="p-2.5 text-[#4B7BA7] hover:bg-white rounded-xl transition-all"><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => { setSelectedRecord(item); setModals(m => ({ ...m, delete: true })); }} className="p-2.5 text-red-400 hover:bg-white rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-gray-900 uppercase text-sm tracking-tight">{item.nombre}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 rounded">ID:{item.idcod || '---'}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">NIT: {item.nronit || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-600 flex items-center gap-1"><Globe className="w-3 h-3" /> {item.ciudad || '---'}</span>
                                                <span className="text-[10px] text-gray-400 uppercase font-medium">{item.direccion || '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                                            {item.email || item.telefono || 'Sin contacto'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-amber-100 p-1.5 rounded-lg text-amber-700"><ShieldCheck className="w-3.5 h-3.5" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-gray-800 uppercase leading-none">{item.diocesis || 'DIÓCESIS'}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">VICARÍA: {item.vicaria || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALES PURIFICADOS */}
            <ManualMisDatosModal 
                isOpen={modals.manual} 
                onClose={() => setModals(m => ({ ...m, manual: false }))} 
                onSave={handleSaveManual} 
            />
            
            <ViewMisDatosModal 
                isOpen={modals.view} 
                onClose={() => setModals(m => ({ ...m, view: false }))} 
                data={selectedRecord} 
            />

            <EditMisDatosFormModal 
                isOpen={modals.edit} 
                onClose={() => setModals(m => ({ ...m, edit: false }))} 
                record={selectedRecord} 
                onSave={handleEditSave} 
                allItems={items} 
            />

            <ConfirmationDialog 
                isOpen={modals.delete} 
                title="¿Eliminar Membrete?"
                message={`Estás a punto de borrar "${selectedRecord?.nombre}". Esto afectará a los documentos generados con este perfil.`}
                onConfirm={handleDeleteConfirm}
                onClose={() => setModals(m => ({ ...m, delete: false }))}
                confirmText={isDeleting ? "Borrando..." : "Eliminar de la Nube"}
                variant="destructive"
            />
        </div>
    );
};

export default MisDatosList;