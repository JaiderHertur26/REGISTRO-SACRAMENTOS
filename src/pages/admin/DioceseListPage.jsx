import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import Table from '@/components/ui/Table';
import DetailsModal from '@/components/modals/DetailsModal';
import { Eye } from 'lucide-react';

const DioceseListPage = () => {
  const { data } = useAppData();
  const [selectedDiocese, setSelectedDiocese] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const columns = [
    { header: 'Nombre', accessor: 'name' },
    { 
        header: 'Tipo', 
        render: (row) => (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.type === 'archdiocese' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {row.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
            </span>
        ) 
    },
    { header: 'Obispo', accessor: 'bishop' },
    { header: 'Ciudad', accessor: 'city' },
    { header: 'País', accessor: 'country' }
  ];

  const handleAction = (type, row) => {
    if (type === 'view') {
      setSelectedDiocese(row);
      setIsDetailsModalOpen(true);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-[#2C3E50]">Listado de Diócesis</h1>
            <p className="text-gray-500 mt-1">Directorio nacional de jurisdicciones eclesiásticas</p>
        </div>
      </div>

      <Table 
        columns={columns} 
        data={data.dioceses || []} 
        actions={[
            { 
                type: 'view', 
                label: (
                    <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span>Ver Detalles</span>
                    </div>
                ),
                className: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            }
        ]}
        onAction={handleAction}
      />
      
      <DetailsModal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
        data={selectedDiocese}
      />
    </DashboardLayout>
  );
};

export default DioceseListPage;