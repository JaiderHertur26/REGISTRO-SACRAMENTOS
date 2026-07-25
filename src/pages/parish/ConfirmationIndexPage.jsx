import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import Table from '@/components/ui/Table';
import { Search, Printer, FileText, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Modal } from '@/components/ui/Modal';
import ConfirmationIndexPrintTemplate from '@/components/ConfirmationIndexPrintTemplate';
import { Helmet } from 'react-helmet';

const ConfirmationIndexPage = () => {
  const { user } = useAuth();
  const { getMisDatosList, getConfirmations } = useAppData();
  const { toast } = useToast();
  
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [availableBooks, setAvailableBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState('');
  const [printData, setPrintData] = useState([]);
  const [parishInfo, setParishInfo] = useState({});
  const [currentPrintFilter, setCurrentPrintFilter] = useState(null);

  useEffect(() => {
    if (user?.parishId) {
      loadData();
      loadParishInfo();
    }
  }, [user]);

  useEffect(() => {
    filterAndSortRecords();
  }, [searchTerm, records]);

  const loadData = () => {
    setLoading(true);
    try {
      const allRecords = getConfirmations(user.parishId);
      
      const sorted = [...allRecords].sort((a, b) => {
        const bookA = parseInt(a.book_number || 0);
        const bookB = parseInt(b.book_number || 0);
        if (bookA !== bookB) return bookA - bookB;

        const pageA = parseInt(a.page_number || 0);
        const pageB = parseInt(b.page_number || 0);
        if (pageA !== pageB) return pageA - pageB;

        const entryA = parseInt(a.entry_number || 0);
        const entryB = parseInt(b.entry_number || 0);
        if (entryA !== entryB) return entryA - entryB;

        return new Date(a.sacramentDate) - new Date(b.sacramentDate);
      });

      setRecords(sorted);
      const books = [...new Set(sorted.map(r => r.book_number).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
      setAvailableBooks(books);

    } catch (error) {
      console.error("Error loading confirmations:", error);
      toast({ title: "Error", description: "No se pudieron cargar los registros.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadParishInfo = () => {
    try {
        const misDatos = getMisDatosList(user.parishId);
        // Extract first record or empty
        const data = (misDatos && misDatos.length > 0) ? misDatos[0] : {};
        
        // Build specific object structure requested: { nombre, ciudad, diocesis }
        // extracting specifically "Nombre" (capitalized) from data as requested
        setParishInfo({
            nombre: data.Nombre || user.parishName || 'PARROQUIA',
            ciudad: data.Ciudad || data.ciudad || 'CIUDAD',
            diocesis: data.Diócesis || data.diocesis || user.dioceseName || 'DIÓCESIS'
        });
    } catch (err) {
        console.error("Error loading parish info:", err);
        setParishInfo({
            nombre: user.parishName || 'PARROQUIA',
            ciudad: 'CIUDAD',
            diocesis: user.dioceseName || 'DIÓCESIS'
        });
    }
  };

  const filterAndSortRecords = () => {
    let filtered = records;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        (r.firstName || '').toLowerCase().includes(term) ||
        (r.lastName || '').toLowerCase().includes(term) ||
        String(r.book_number || '').includes(term)
      );
    }
    setFilteredRecords(filtered);
  };

  const handlePrint = (bookNumber = null) => {
    let dataToPrint = records;
    if (bookNumber) {
        dataToPrint = records.filter(r => String(r.book_number) === String(bookNumber));
        setCurrentPrintFilter(bookNumber);
    } else {
        setCurrentPrintFilter(null);
    }
    setPrintData(dataToPrint);

    setTimeout(() => {
         const printContent = document.getElementById('confirmation-index-print');
         if (!printContent) return;
         
         const printWindow = window.open('', '', 'height=600,width=800');
         printWindow.document.write('<html><head><title>Índice de Confirmaciones</title>');
         printWindow.document.write('<style>@page { size: letter; margin: 0.5in; } body { margin: 0; } .print-container { width: 100%; } table { page-break-inside: auto; } tr { page-break-inside: avoid; page-break-after: auto; } thead { display: table-header-group; } tfoot { display: table-footer-group; }</style>');
         printWindow.document.write('</head><body>');
         printWindow.document.write(printContent.innerHTML);
         printWindow.document.write('</body></html>');
         printWindow.document.close();
         printWindow.focus();
         setTimeout(() => {
             printWindow.print();
             printWindow.close();
         }, 500);
    }, 100);
  };

  const openBookModal = () => {
      setSelectedBook(availableBooks[0] || '');
      setIsBookModalOpen(true);
  };

  const columns = [
    { header: 'Libro', accessor: 'book_number', className: "w-16 font-mono font-bold" },
    { header: 'Folio', accessor: 'page_number', className: "w-16 font-mono" },
    { header: 'Número', accessor: 'entry_number', className: "w-16 font-mono" },
    { header: 'Apellidos', accessor: 'lastName', className: "font-semibold" },
    { header: 'Nombres', accessor: 'firstName' },
    { 
        header: 'Fecha Celebración', 
        render: (row) => row.sacramentDate ? new Date(row.sacramentDate).toLocaleDateString() : '-' 
    },
  ];

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <Helmet>
        <title>Índice de Confirmaciones - Eclesia Digital</title>
        <meta name="description" content="Índice general de registros de confirmación de la parroquia." />
      </Helmet>

      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#4B7BA7] font-serif">Índice de Confirmaciones</h1>
          <p className="text-gray-600 mt-1">Listado general ordenado por ubicación en libros.</p>
        </div>
        <div className="flex gap-2">
            <div className="bg-white px-3 py-1 rounded-full border border-gray-200 text-sm font-medium text-gray-600 shadow-sm flex items-center">
                <FileText className="w-4 h-4 mr-2 text-blue-500" />
                Total: {records.length}
            </div>
            <div className="bg-white px-3 py-1 rounded-full border border-gray-200 text-sm font-medium text-gray-600 shadow-sm flex items-center">
                <Filter className="w-4 h-4 mr-2 text-green-500" />
                Libros: {availableBooks.length}
            </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
         <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
                type="text" 
                placeholder="Buscar por nombre, apellido o libro..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none text-gray-900 placeholder:text-gray-400 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         <div className="flex gap-2 w-full md:w-auto">
             <Button variant="outline" onClick={() => openBookModal()} className="flex-1 md:flex-none gap-2">
                 <Printer className="w-4 h-4" /> Imprimir por Libro
             </Button>
             <Button onClick={() => handlePrint(null)} className="flex-1 md:flex-none gap-2 bg-[#4B7BA7] hover:bg-[#3a6288]">
                 <Printer className="w-4 h-4" /> Imprimir General
             </Button>
         </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <Table columns={columns} data={filteredRecords} />
        {filteredRecords.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-500">
                No se encontraron registros.
            </div>
        )}
        {loading && (
            <div className="text-center py-10 text-gray-500">Cargando registros...</div>
        )}
      </div>

      <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="Seleccionar Libro">
           <div className="space-y-4">
               <p className="text-sm text-gray-600">Seleccione el número de libro que desea imprimir.</p>
               <select 
                  className="w-full p-2 border border-gray-300 rounded-md text-gray-900"
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
               >
                   {availableBooks.length === 0 && <option value="">No hay libros disponibles</option>}
                   {availableBooks.map(b => (
                       <option key={b} value={b}>Libro {b}</option>
                   ))}
               </select>
               <div className="flex justify-end gap-2 pt-4">
                   <Button variant="outline" onClick={() => setIsBookModalOpen(false)}>Cancelar</Button>
                   <Button 
                       onClick={() => {
                           setIsBookModalOpen(false);
                           handlePrint(selectedBook);
                       }}
                       disabled={!selectedBook}
                   >
                       Imprimir
                   </Button>
               </div>
           </div>
      </Modal>

      <div id="confirmation-index-print" className="hidden">
           <ConfirmationIndexPrintTemplate 
               data={printData} 
               parishInfo={parishInfo} 
               filterBook={currentPrintFilter}
           />
      </div>

    </DashboardLayout>
  );
};

export default ConfirmationIndexPage;