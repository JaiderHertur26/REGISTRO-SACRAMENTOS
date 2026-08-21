import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import Table from '@/components/ui/Table';
import { Search, Printer, Loader2, BookMarked, BookOpen } from 'lucide-react';
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

    // Estados de impresión
    const [isBookModalOpen, setIsBookModalOpen] = useState(false);
    const [availableBooks, setAvailableBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState('');
    const [parishInfo, setParishInfo] = useState({});

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
                    Libro: raw.Libro || '---',
                    folio: raw.folio || r.folio || '---',
                    numero: raw.numero || r.number || '---'
                };
            });

            // Ordenar alfabéticamente
            sanitizedData.sort((a, b) => {
                const nameA = `${a.apellidos || ''} ${a.nombres || ''}`.trim().toUpperCase();
                const nameB = `${b.apellidos || ''} ${b.nombres || ''}`.trim().toUpperCase();
                return nameA.localeCompare(nameB);
            });

            setRecords(sanitizedData);
            setFilteredRecords(sanitizedData);

            // Libros disponibles
            const books = [...new Set(sanitizedData.map(r => r.Libro).filter(val => val !== '---'))].sort((a, b) => Number(a) - Number(b));
            setAvailableBooks(books);
            if (books.length > 0) setSelectedBook(books[0]);

        } catch (err) {
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

    const dataToPrint = selectedBook 
        ? records.filter(r => String(r.Libro) === String(selectedBook)) 
        : records;

    // 🚀 LA SOLUCIÓN DEFINITIVA DE IMPRESIÓN (Totalmente síncrona)
    const handlePrintClick = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Indice_Bautismos_Libro_${selectedBook || 'Todos'}`,
        onAfterPrint: () => setIsBookModalOpen(false) // Cierra el cuadro automáticamente al terminar
    });

    const columns = [
        { header: 'Apellidos y Nombres', render: (row) => <span className="font-bold text-gray-800">{row.apellidos} {row.nombres}</span> },
        { header: 'Libro', render: (row) => <span className="font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">{row.Libro}</span> },
        { header: 'Folio', render: (row) => <span className="font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">{row.folio}</span> },
        { header: 'Acta / Número', render: (row) => <span className="font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">{row.numero}</span> },
        { header: 'Fecha de Bautismo', render: (row) => <span className="text-gray-500 font-medium">{row.fechaSacramento || '---'}</span> },
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet><title>Índice de Bautismos</title></Helmet>

            <div className="max-w-6xl mx-auto py-8 px-4">
                {/* Header Limpio */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-blue-50 p-4 rounded-2xl text-[#4B7BA7]">
                            <BookMarked className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 font-serif tracking-tight">Índice del Libro</h1>
                            <p className="text-gray-500 font-medium text-xs uppercase tracking-widest mt-1">Búsqueda y Generación de Índice</p>
                        </div>
                    </div>

                    <Button 
                        onClick={() => setIsBookModalOpen(true)} 
                        className="bg-[#D4AF37] hover:bg-[#C4A027] text-white px-8 py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-yellow-900/10 transition-all active:scale-95 w-full md:w-auto"
                    >
                        <Printer className="w-4 h-4 mr-2" /> Imprimir Índice
                    </Button>
                </div>

                {/* Buscador Limpio */}
                <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100 mb-8 flex items-center">
                    <div className="pl-6 pr-2 py-2 text-gray-400">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="BUSCAR APELLIDOS, NOMBRES O NÚMERO DE LIBRO..."
                        className="w-full bg-transparent border-none text-sm font-bold text-gray-700 uppercase tracking-wide px-4 py-4 outline-none focus:ring-0 placeholder:text-gray-300"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Tabla Limpia */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="py-32 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 animate-spin text-[#4B7BA7] mb-4" />
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Sincronizando Índice...</p>
                        </div>
                    ) : filteredRecords.length > 0 ? (
                        <Table columns={columns} data={filteredRecords} className="border-none" />
                    ) : (
                        <div className="py-32 flex flex-col items-center justify-center text-center">
                            <BookOpen className="w-16 h-16 text-gray-200 mb-4" />
                            <p className="text-gray-400 font-bold uppercase text-sm tracking-widest">Sin Resultados</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Elegante de Impresión */}
            <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="Configuración de Impresión">
                <div className="space-y-6 py-4">
                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                        <p className="text-xs text-blue-800 font-medium leading-relaxed">
                            Seleccione el número de libro que desea imprimir. El sistema organizará y estructurará los registros alfabéticamente de forma automática.
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seleccionar Libro</label>
                        <select
                            className="w-full p-4 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none transition-all cursor-pointer"
                            value={selectedBook}
                            onChange={(e) => setSelectedBook(e.target.value)}
                        >
                            {availableBooks.length === 0 && <option value="">NO HAY LIBROS DISPONIBLES</option>}
                            {availableBooks.map(b => (
                                <option key={b} value={b}>LIBRO {b}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <Button variant="ghost" onClick={() => setIsBookModalOpen(false)} className="px-6 py-6 rounded-xl font-bold text-gray-500 uppercase text-[10px] tracking-widest hover:bg-gray-100">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handlePrintClick}
                            disabled={!selectedBook}
                            className="bg-[#4B7BA7] hover:bg-[#3a5f8a] text-white px-8 py-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/20"
                        >
                            <Printer className="w-4 h-4 mr-2" /> Ejecutar Impresión
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* 🚀 LA MAGIA: EL COMPONENTE ESTÁ RENDERIZADO PERO FUERA DE PANTALLA, NO USAMOS DISPLAY: NONE */}
            <div className="absolute opacity-0 pointer-events-none overflow-hidden h-0 w-0" style={{ left: '-9999px', top: '-9999px' }}>
                <div ref={printRef}>
                    <BaptismIndexPrintTemplate
                        data={dataToPrint}
                        parishInfo={parishInfo}
                        bookNumber={selectedBook}
                    />
                </div>
            </div>

        </DashboardLayout>
    );
};

export default BaptismIndexPage;