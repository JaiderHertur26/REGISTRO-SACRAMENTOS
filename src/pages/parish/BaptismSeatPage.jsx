import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutList, BookOpenCheck, ArrowLeft, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BaptismSeatIndividualPage from './BaptismSeatIndividualPage';
import BaptismSeatBatchPage from './BaptismSeatBatchPage';

const BaptismSeatPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('individual'); // 'individual' o 'batch'

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                
                {/* 🏛️ ENCABEZADO DE TRABAJO */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div className="flex items-center gap-5">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => navigate('/parroquia/bautismo/base-datos')}
                            className="rounded-2xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 h-12 w-12 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </Button>
                        <div>
                           <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">
                                Asentamiento de Libros
                            </h1>
                           <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                               <Settings2 className="w-3 h-3 text-[#D4AF37]" /> Asignación de Folio y Sello Permanente
                           </p>
                        </div>
                    </div>

                    {/* 🔄 SWITCHER DE MODO (INDIVIDUAL VS LOTE) */}
                    <div className="bg-gray-200/50 p-1.5 rounded-[1.5rem] border border-gray-200 shadow-inner flex items-center gap-1">
                        <button
                            onClick={() => setMode('individual')}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-500",
                                mode === 'individual' 
                                    ? "bg-white text-[#4B7BA7] shadow-xl shadow-blue-900/10 scale-105" 
                                    : "text-gray-500 hover:text-gray-700 hover:bg-white/40"
                            )}
                        >
                            <BookOpenCheck className={cn("w-4 h-4", mode === 'individual' ? "text-[#4B7BA7]" : "text-gray-400")} />
                            Individual
                        </button>
                        <button
                            onClick={() => setMode('batch')}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-500",
                                mode === 'batch' 
                                    ? "bg-white text-[#4B7BA7] shadow-xl shadow-blue-900/10 scale-105" 
                                    : "text-gray-500 hover:text-gray-700 hover:bg-white/40"
                            )}
                        >
                            <LayoutList className={cn("w-4 h-4", mode === 'batch' ? "text-[#4B7BA7]" : "text-gray-400")} />
                            Por Lote
                        </button>
                    </div>
                </div>

                {/* 📝 ÁREA DINÁMICA DE TRABAJO */}
                <div className="relative min-h-[700px]">
                    {/* Contenedor con transición suave para los hijos */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                        {mode === 'individual' ? (
                            <BaptismSeatIndividualPage />
                        ) : (
                            <BaptismSeatBatchPage />
                        )}
                    </div>
                </div>

                {/* 📄 PIE DE PÁGINA DE ESTADO */}
                <div className="mt-12 py-6 border-t border-gray-100 flex justify-between items-center text-[9px] font-black text-gray-300 uppercase tracking-[0.4em]">
                    <span>Control Central de Sacramentos</span>
                    <span>Libros Digitales v3.0</span>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default BaptismSeatPage;