import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Table from '@/components/ui/Table';
import DetailsModal from '@/components/modals/DetailsModal';
import { Eye, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const DioceseListPage = () => {
  const [dioceses, setDioceses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiocese, setSelectedDiocese] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    const fetchDioceses = async () => {
      try {
        const { data, error } = await supabase
            .from('dioceses')
            .select('*')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        // Mapeamos los datos y asignamos el país por defecto
        const formattedData = data.map(d => ({
            ...d,
            country: d.country || 'Colombia' 
        }));
        
        setDioceses(formattedData || []);
      } catch (error) {
        console.error('Error al cargar diócesis de la nube:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDioceses();
  }, []);

  const filteredDioceses = dioceses.filter(d => 
    (d.name && d.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (d.city && d.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const columns = [
    { header: 'Nombre', accessor: 'name' },
    { 
        header: 'Tipo', 
        render: (row) => (
            <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${row.type === 'archdiocese' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {row.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
            </span>
        ) 
    },
    { header: 'Obispo/Arzobispo', render: (row) => <span className="font-medium text-gray-700">{row.bishop || 'No registrado'}</span> },
    { header: 'Ciudad', render: (row) => <span className="font-medium text-gray-600">{row.city || '---'}</span> },
    { header: 'País', render: (row) => <span className="text-gray-500 font-bold">{row.country}</span> }
  ];

  const handleAction = (type, row) => {
    if (type === 'view') {
      setSelectedDiocese(row);
      setIsDetailsModalOpen(true);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-black text-[#2C3E50] tracking-tight">Listado de Jurisdicciones</h1>
            <p className="text-gray-500 mt-1 text-xs font-bold uppercase tracking-widest">Directorio nacional de diócesis y arquidiócesis</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
          <div className="flex justify-end mb-6">
              <div className="relative w-full md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                      type="text" 
                      placeholder="Buscar jurisdicción..." 
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 bg-gray-50 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D4AF37] transition-all font-medium"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          {isLoading ? (
              <div className="flex flex-col justify-center items-center py-20">
                  <Loader2 className="w-10 h-10 text-[#4B7BA7] animate-spin mb-4" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronizando con Supabase...</span>
              </div>
          ) : (
              <Table 
                columns={columns} 
                data={filteredDioceses} 
                actions={[
                    { 
                        type: 'view', 
                        label: (
                            <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                <span>Ver Detalles</span>
                            </div>
                        ),
                        className: "text-[#4B7BA7] hover:text-[#3A6286] hover:bg-blue-50 font-bold text-xs"
                    }
                ]}
                onAction={handleAction}
                className="border-none"
              />
          )}
      </div>
      
      <DetailsModal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
        data={selectedDiocese}
      />
    </DashboardLayout>
  );
};

export default DioceseListPage;