import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutList, BookOpenCheck } from 'lucide-react';
import MatrimonioSeatIndividualPage from './MatrimonioSeatIndividualPage';
import MatrimonioSeatBatchPage from './MatrimonioSeatBatchPage';

const MatrimonioSeatPage = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState('individual'); // 'individual' or 'batch'

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <h1 className="text-2xl font-bold text-[#2C3E50] font-serif bg-clip-text text-transparent bg-gradient-to-r from-[#2C3E50] to-[#4B7BA7]">
                Registro de Nuevos Matrimonios
            </h1>
           <p className="text-gray-500 text-sm mt-1">Asiente las partidas pendientes en los libros parroquiales.</p>
        </div>

        {/* Toggle Switch */}
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center">
            <button
                onClick={() => setMode('individual')}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    mode === 'individual' 
                        ? "bg-[#4B7BA7] text-white shadow-sm" 
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
            >
                <BookOpenCheck className="w-4 h-4" />
                Registrar Uno por Uno
            </button>
            <button
                onClick={() => setMode('batch')}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    mode === 'batch' 
                        ? "bg-[#4B7BA7] text-white shadow-sm" 
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
            >
                <LayoutList className="w-4 h-4" />
                Registrar por Lote
            </button>
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="min-h-[500px]">
        {mode === 'individual' ? <MatrimonioSeatIndividualPage /> : <MatrimonioSeatBatchPage />}
      </div>
    </DashboardLayout>
  );
};

export default MatrimonioSeatPage;