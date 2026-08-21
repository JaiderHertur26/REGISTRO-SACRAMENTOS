import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
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
        if (user?.parishId || user?.parish_id) {
            const currentId = user.parishId || user.parish_id;
            const misDatos = getMisDatosList(currentId);
            if (misDatos && misDatos.length > 0) setParishInfo(misDatos[0]);
            fetchCloudRecords(currentId);
        }
    }, [user, getMisDatosList]);

    const fetchCloudRecords = async (parishId) => {
        setLoading(true);
        try {
            // 🚀 LECTURA SEGURA ALINEADA CON EL CSV: 
            // Solo pedimos las columnas físicas que existen (id, status, folio, number) y nuestro JSON maestro (raw_data).
            const { data, error } = await supabase
                .from('baptisms')
                .select('id, raw_data, status, folio, number')
                .eq('parish_id', parishId)
                .in('status', ['seated', 'confirmed', 'anulada']);

            if (error) throw error;

            const sanitizedData = data.map(r => {
                const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : (r.raw_data || {});
                return {
                    ...raw,
                    id: r.id,
                    status: r.status,
                    // Garantizamos que use nuestro lenguaje (Libro, folio, numero)
                    Libro: raw.Libro || '---',
                    folio: raw.folio || r.folio || '---',
                    numero: raw.numero || r.number || '---'
                };
            });

            // Ordenar alfabéticamente por Apellidos y Nombres
            sanitizedData.sort((a, b) => {
                const nameA = `${a.apellidos || ''} ${a.nombres || ''}`.trim().toUpperCase();
                const nameB = `${b.apellidos || ''} ${b.nombres || ''}`.trim().toUpperCase();
                return nameA.localeCompare(nameB);
            });

            setRecords(sanitizedData);
            setFilteredRecords(sanitizedData);

            // Extraer los libros únicos disponibles basándonos exclusivamente en "Libro"
            const books = [...new Set(sanitizedData.map(r => r.Libro).filter(val => val !== '---'))].sort((a, b) => Number(a) - Number(b));
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
            const fullName = `${r.apellidos || ''} ${r.nombres || ''}`.toLowerCase();
            return fullName.includes(term) || String(r.Libro).includes(term);
        });
        setFilteredRecords(filtered);
    }, [searchTerm, records]);

    // 🚀 CORRECCIÓN AQUÍ: Se agrega el callback onAfterPrint
    const handlePrintAction = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Indice_Bautismos_Libro_${currentPrintFilter || 'Todos'}`,
        onAfterPrint: () => {
            // Cerramos el modal solo después de que se termine/cancele la impresión
            setIsBookModalOpen(false);
        }
    });

    const handlePrint = (bookFilter = null) => {
        setCurrentPrintFilter(bookFilter);
        let dataToPrint = records;
        if (bookFilter) {
            dataToPrint = records.filter(r => String(r.Libro) === String(bookFilter));
        }
        setPrintData(dataToPrint);

        // Aumentamos levemente el timeout para asegurar que React termine de pasar los props
        setTimeout(() => {
            handlePrintAction();
        }, 800);
    };

    // 🚀 DICCIONARIO APLICADO A LA TABLA
    const columns = [
        { header: 'Apellidos y Nombres', render: (row) => <span className="font-bold uppercase text-gray-900">{row.apellidos} {row.nombres}</span> },
        { header: 'Libro', render: (row) => <span className="font-mono text-gray-700">{row.Libro}</span> },
        { header: 'Folio', render: (row) => <span className="font-mono text-gray-700">{row.folio}</span> },
        { header: 'Número', render: (row) => <span className="font-mono text-gray-700">{row.numero}</span> },
        { header: 'Fecha Bautismo', render: (row) => <span className="text-gray-600">{row.fechaSacramento || '-'}</span> },
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
                                // 🚀 CORRECCIÓN AQUÍ: NO CERRAMOS EL MODAL TODAVÍA. 
                                // Se cerrará solo gracias al 'onAfterPrint' cuando se abra el menú de impresión.
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
                        bookNumber={currentPrintFilter} // <-- Ajusté el nombre de prop para que coincida con el componente hijo (antes era filterBook)
                    />
                </div>
            </div>

        </DashboardLayout>
    );
};

export default BaptismIndexPage;