import React, { useState } from 'react';
import { X, Save, Tag, ShieldCheck, Info, Loader2, AlertCircle, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient'; // 🚀 IMPORTACIÓN DE SUPABASE

const CreateAnnulmentConceptModal = ({ isOpen, onClose, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();

    const [formData, setFormData] = useState({
        codigo: '',
        concepto: '',
        expide: 'CANCILLERÍA', // Valor por defecto estándar
        tipo: 'porCorreccion'
    });

    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Normalizamos a mayúsculas para mantener el estándar de archivo
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.codigo.trim() || !formData.concepto.trim() || !formData.expide.trim()) {
            toast({
                title: "Campos Incompletos",
                description: "Todos los campos marcados con asterisco son obligatorios.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        try {
            // 🚀 REGLA DE NEGOCIO: Solo Cancillería puede crear
            const chanceryId = user?.chancery_id || user?.chanceryId;

            if (!chanceryId) {
                throw new Error("Acceso Denegado: Solo un usuario de Cancillería puede crear estos conceptos normativos.");
            }

            // 🚀 GUARDADO DIRECTO EN SUPABASE (Con enlace fuerte a chancelleries)
            const { error } = await supabase
                .from('conceptos_anulacion')
                .insert([{
                    chancery_id: chanceryId,
                    codigo: formData.codigo,
                    concepto: formData.concepto,
                    expide: formData.expide,
                    tipo: formData.tipo
                }]);

            if (error) throw error;

            toast({
                title: "Concepto Registrado",
                description: "El catálogo ha sido actualizado en la base de datos de la Cancillería.",
                className: "bg-green-50 border-green-200 text-green-900"
            });

            onSuccess?.(); // Recarga la tabla de atrás
            onClose();
            setFormData({ codigo: '', concepto: '', expide: 'CANCILLERÍA', tipo: 'porCorreccion' });

        } catch (error) {
            console.error("Error guardando concepto:", error);

            // 🚀 MANEJO INTELIGENTE DE ERRORES (Código Postgres para violación de Unique)
            const isDuplicate = error?.code === '23505';

            toast({
                title: isDuplicate ? "Código Duplicado" : "Error de Guardado",
                description: isDuplicate
                    ? `El código "${formData.codigo}" ya existe en el catálogo. Use uno diferente.`
                    : error.message || "No se pudo crear el concepto en la nube.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden relative border border-slate-200"
                    >
                        {/* Header Estilizado */}
                        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-[#4B7BA7] p-2.5 rounded-2xl text-white shadow-lg shadow-blue-900/20">
                                    <Settings2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Nuevo Concepto</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Gestión de Catálogo Normativo</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código ID *</label>
                                    <Input
                                        name="codigo"
                                        value={formData.codigo}
                                        onChange={handleChange}
                                        placeholder="001"
                                        className="py-6 font-mono font-black text-center text-lg border-slate-200 focus:ring-blue-500/10"
                                        required
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entidad Responsable *</label>
                                    <Input
                                        name="expide"
                                        value={formData.expide}
                                        onChange={handleChange}
                                        placeholder="CANCILLERÍA"
                                        className="py-6 font-bold uppercase border-slate-200"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción Legal del Motivo *</label>
                                <Input
                                    name="concepto"
                                    value={formData.concepto}
                                    onChange={handleChange}
                                    placeholder="EJ: ERROR EN LA FILIACIÓN MATERNA"
                                    className="py-6 font-black uppercase border-slate-200 text-slate-800"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría del Trámite *</label>
                                <select
                                    name="tipo"
                                    value={formData.tipo}
                                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                    className="w-full h-[55px] px-4 border border-slate-200 rounded-2xl font-bold text-xs bg-slate-50 uppercase tracking-tighter outline-none focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="porCorreccion">Por Corrección (Decretos ODC)</option>
                                    <option value="porReposicion">Por Reposición (Libros Perdidos)</option>
                                    <option value="porRepeticion">Por Repetición (Duplicidad)</option>
                                    <option value="porNulidad">Por Nulidad (Sacramental)</option>
                                </select>
                            </div>

                            {/* Panel Informativo Dinámico */}
                            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-[1.5rem] flex items-start gap-4">
                                <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] text-blue-800 font-black uppercase tracking-wider mb-1">Destino del Concepto</p>
                                    <p className="text-[11px] text-blue-700/80 font-medium leading-relaxed uppercase">
                                        {formData.tipo === 'porCorreccion' && "Este motivo estará disponible para corregir errores en nombres o fechas en decretos de corrección."}
                                        {formData.tipo === 'porReposicion' && "Este motivo se aplicará a la creación de partidas supletorias por deterioro físico de los libros."}
                                        {formData.tipo === 'porRepeticion' && "Uso reservado para subsanar casos donde una persona fue registrada dos veces."}
                                        {formData.tipo === 'porNulidad' && "Este concepto se vinculará a procesos de anulación de actas matrimoniales."}
                                    </p>
                                </div>
                            </div>

                            {/* Acciones */}
                            <div className="pt-4 flex gap-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onClose}
                                    className="flex-1 py-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 transition-all"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 py-8 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 transition-all transform active:scale-95"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <><Save className="w-4 h-4 mr-2" /> Guardar en Catálogo</>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CreateAnnulmentConceptModal;