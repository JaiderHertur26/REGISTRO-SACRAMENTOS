import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient'; // <-- IMPORTANTE: NUBE
import { Button } from '@/components/ui/button';
import Table from '@/components/ui/Table';
import { Search, Printer, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Modal } from '@/components/ui/Modal';
import BaptismIndexPrintTemplate from '@/components/BaptismIndexPrintTemplate';
import { Helmet } from 'react-helmet';
import { useReactToPrint } from 'react-to-print';

const BaptismIndexPage = () => {
    const { user } = useAuth();
    const { getMisDatosList } = useAppData();
    const { toast } = useToast();

    const [records, setRecords] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Printing states
    const [isBookModalOpen, setIsBookModalOpen] = useState(false);
    const [availableBooks, setAvailableBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState('');
    const [printData, setPrintData] = useState([]);
    const [parishInfo, setParishInfo] = useState({});
    const [currentPrintFilter, setCurrentPrintFilter] = useState(null);

    const printRef = useRef();

    useEffect(() => {
        if (user?.parishId) {
            const misDatos = getMisDatosList(user.parishId);
            if (misDatos && misDatos.length > 0) setParishInfo(misDatos[0]);
            fetchCloudRecords();
        }
    }, [user]);

    const fetchCloudRecords = async () => {
        setLoading(true);
        try {
            // Descargar todos los registros de la parroquia desde la Nube
            const { data, error } = await supabase
                .from('baptisms')
                .select('raw_data, book_number, page_number, entry_number, status')
                .eq('parish_id', user.parishId)
                .in('status', ['seated', 'confirmed', 'anulada']); // Incluir anuladas para el índice histórico

            if (error) throw error;

            const sanitizedData = data.map(r => ({
                ...r.raw_data,
                book_number: r.book_number,
                page_number: r.page_number,
                entry_number: r.entry_number,
                status: r.status
            }));

            // Ordenar alfabéticamente por Apellidos y Nombres (Requisito para Índices)
            sanitizedData.sort((a, b) => {
                const nameA = `${a.apellidos || a.lastName || ''} ${a.nombres || a.firstName || ''}`.trim().toUpperCase();
                const nameB = `${b.apellidos || b.lastName || ''} ${b.nombres || b.firstName || ''}`.trim().toUpperCase();
                return nameA.localeCompare(nameB);
            });

            setRecords(sanitizedData);
            setFilteredRecords(sanitizedData);

            // Extraer los libros únicos disponibles
            const books = [...new Set(sanitizedData.map(r => r.book_number || r.libro).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
            setAvailableBooks(books);
            if (books.length > 0) setSelectedBook(books[0]);

        } catch (err) {
            console.error("Error fetching for index:", err);
            toast({ title: "Error", description: "No se pudo cargar el índice desde la Nube.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!searchTerm) {
            setFilteredRecords(records);
            return;
        }
        const term = searchTerm.toLowerCase();
        const filtered = records.filter(r => {
            const fullName = `${r.apellidos || r.lastName || ''} ${r.nombres || r.firstName || ''}`.toLowerCase();
            return fullName.includes(term) || String(r.book_number).includes(term);
        });
        setFilteredRecords(filtered);
    }, [searchTerm, records]);

    // Lógica de Impresión
    const handlePrintAction = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Indice_Bautismos_Libro_${currentPrintFilter || 'Todos'}`
    });

    const handlePrint = (bookFilter = null) => {
        setCurrentPrintFilter(bookFilter);
        let dataToPrint = records;
        if (bookFilter) {
            dataToPrint = records.filter(r => String(r.book_number || r.libro) === String(bookFilter));
        }
        setPrintData(dataToPrint);

        // Dar tiempo a que el DOM oculto se actualice antes de abrir la ventana de impresión
        setTimeout(() => {
            handlePrintAction();
        }, 500);
    };

    const columns = [
        { header: 'Apellidos y Nombres', render: (row) => <span className="font-bold uppercase text-gray-900">{row.apellidos || row.lastName} {row.nombres || row.firstName}</span> },
        { header: 'Libro', render: (row) => <span className="font-mono text-gray-700">{row.book_number || row.libro || '-'}</span> },
        { header: 'Folio', render: (row) => <span className="font-mono text-gray-700">{row.page_number || row.folio || '-'}</span> },
        { header: 'Número', render: (row) => <span className="font-mono text-gray-700">{row.entry_number || row.numero || '-'}</span> },
        { header: 'Fecha Bautismo', render: (row) => <span className="text-gray-600">{row.fechaSacramento || row.sacramentDate || '-'}</span> },
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet><title>Índice de Bautismos</title></Helmet>

            <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#4B7BA7] font-serif">Índice del Libro de Bautismos</h1>
                    <p className="text-gray-600 mt-1">Consulte e imprima el índice alfabético leyendo directamente de la Nube.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsBookModalOpen(true)} className="bg-[#4B7BA7] hover:bg-[#3a5f8a] text-white shadow-sm">
                        <Printer className="w-4 h-4 mr-2" /> Imprimir Índice por Libro
                    </Button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                <div className="relative max-w-2xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por apellidos o número de libro..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#4B7BA7] outline-none transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mb-4" />
                        <p className="text-gray-500 font-medium">Generando índice desde la Nube...</p>
                    </div>
                ) : (
                    <Table columns={columns} data={filteredRecords} />
                )}
            </div>

            <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="Imprimir Índice">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Seleccione el número de libro que desea imprimir. El sistema organizará los registros alfabéticamente.</p>
                    <select
                        className="w-full p-3 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-[#4B7BA7] outline-none"
                        value={selectedBook}
                        onChange={(e) => setSelectedBook(e.target.value)}
                    >
                        {availableBooks.length === 0 && <option value="">No hay libros disponibles en la Nube</option>}
                        {availableBooks.map(b => (
                            <option key={b} value={b}>Libro {b}</option>
                        ))}
                    </select>
                    <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                        <Button variant="outline" onClick={() => setIsBookModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={() => {
                                setIsBookModalOpen(false);
                                handlePrint(selectedBook);
                            }}
                            disabled={!selectedBook}
                            className="bg-[#D4AF37] hover:bg-[#C4A027] text-white"
                        >
                            <Printer className="w-4 h-4 mr-2" /> Imprimir Libro {selectedBook}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* HIDDEN PRINT TEMPLATE */}
            <div className="hidden">
                <div ref={printRef}>
                    <BaptismIndexPrintTemplate
                        data={printData}
                        parishInfo={parishInfo}
                        filterBook={currentPrintFilter}
                    />
                </div>
            </div>

        </DashboardLayout>
    );
};

export default BaptismIndexPage;