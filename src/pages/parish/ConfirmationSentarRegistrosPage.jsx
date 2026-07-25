import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import ConfirmationTicket from '@/components/ConfirmationTicket';
import { 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight, 
    Save, 
    LogOut, 
    Printer,
    Users,
    User,
    CheckCircle2
} from 'lucide-react';

// --- HELPER FUNCTIONS ---

const toStorageDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const toInputDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr.split('T')[0];
    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [d, m, y] = dateStr.split('/');
        return `${y}-${m}-${d}`;
    }
    return '';
};

const isDateValid = (dateString) => {
    if (!dateString) return true; 
    const checkStr = toInputDate(dateString) || dateString;
    const [y, m, d] = checkStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return checkDate <= today;
};

// --- LOGIC HELPERS ---

const getPartidaParameters = (entityId) => {
    const key = `confirmationParameters_${entityId}`;
    const params = JSON.parse(localStorage.getItem(key) || '{}');
    return {
        libro: parseInt(params.ordinarioLibro || 1),
        folio: parseInt(params.ordinarioFolio || 1),
        numero: parseInt(params.ordinarioNumero || 1),
        partidasPerFolio: parseInt(params.ordinarioPartidas || 1),
        numeroIncrement: 1 
    };
};

const updatePartidaParameters = (entityId, newLibro, newFolio, newNumero) => {
    const key = `confirmationParameters_${entityId}`;
    const current = JSON.parse(localStorage.getItem(key) || '{}');
    const updated = {
        ...current,
        ordinarioLibro: newLibro,
        ordinarioFolio: newFolio,
        ordinarioNumero: newNumero
    };
    localStorage.setItem(key, JSON.stringify(updated));
};

const calculateNextPartidaValues = (entityId, currentLibro, currentFolio, currentNumero, partidasPerFolio) => {
    const key = `confirmations_${entityId}`;
    const allRecords = JSON.parse(localStorage.getItem(key) || '[]');
    
    const countInFolio = allRecords.filter(r => 
        parseInt(r.book_number) === parseInt(currentLibro) && 
        parseInt(r.page_number) === parseInt(currentFolio)
    ).length;

    let newLibro = currentLibro;
    let newFolio = currentFolio;
    let newNumero = currentNumero + 1; 

    if (countInFolio >= partidasPerFolio) {
        newFolio = currentFolio + 1;
    }

    return { newLibro, newFolio, newNumero };
};


const ConfirmationSentarRegistrosPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState('individual'); // 'individual' | 'batch'
    const [pendingConfirmations, setPendingConfirmations] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [parameters, setParameters] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Ticket Printing States
    const [showTicket, setShowTicket] = useState(false);
    const [ticketData, setTicketData] = useState(null);
    const [parishInfo, setParishInfo] = useState({ name: '', address: '', phone: '', city: '' });

    // Initial Load
    useEffect(() => {
        if (!user?.parishId && !user?.dioceseId) return;
        loadData();
        loadParishData();
    }, [user]);

    const loadParishData = () => {
        if (!user?.parishId) return;
        const misDatosKey = `misDatos_${user.parishId}`;
        let parishNameFound = null;
        try {
            const storedMisDatos = localStorage.getItem(misDatosKey);
            if (storedMisDatos) {
                const parsedData = JSON.parse(storedMisDatos);
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                    parishNameFound = parsedData[0].nombre;
                }
            }
        } catch (error) {
            console.error("Error leyendo Mis Datos:", error);
        }
        if (!parishNameFound) {
            parishNameFound = user.parishName || user.parish_name || '';
        }
        setParishInfo({ name: parishNameFound });
    };

    const loadData = () => {
        setIsLoading(true);
        const entityId = user.parishId || user.dioceseId;
        
        const pendingKey = `pendingConfirmations_${entityId}`;
        const storedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
        
        const sanitizedPending = storedPending.map(b => ({
            ...b,
            ministerFaith: b.ministerFaith || b.minister || '',
            lugarConfirmacionDetalle: b.lugarConfirmacionDetalle || b.lugarConfirmacion || '',
            lugarNacimientoDetalle: b.lugarNacimientoDetalle || b.birthPlace || '',
            sex: b.sex || '',
        }));
        
        setPendingConfirmations(sanitizedPending);

        const currentParams = getPartidaParameters(entityId);
        
        setParameters({
            ordinarioLibro: currentParams.libro,
            ordinarioFolio: currentParams.folio,
            ordinarioNumero: currentParams.numero,
            ordinarioPartidas: currentParams.partidasPerFolio
        });
        setIsLoading(false);
    };

    // --- PRINTING LOGIC ---

    const handlePrintTicketIndividual = () => {
        const currentConf = pendingConfirmations[currentIndex];
        
        if (!currentConf || !currentConf.id) {
            toast({ title: "Error", description: "No hay datos válidos.", variant: "destructive" });
            return;
        }

        const dataToPrint = {
            ...currentConf,
            numero: currentConf.numero || 'PEND',
            inscriptionDate: currentConf.inscriptionDate || new Date().toISOString()
        };

        setTicketData(dataToPrint);
        setShowTicket(true);

        setTimeout(() => {
            window.print();
        }, 500);
    };

    const handlePrintTicketBatch = () => {
        if (selectedIds.length !== 1) {
             toast({ title: "Selección Inválida", description: "Seleccione 1 registro.", variant: "destructive" });
            return;
        }

        const selectedConf = pendingConfirmations.find(b => b.id === selectedIds[0]);

        if (!selectedConf) {
            toast({ title: "Error", description: "Registro no encontrado.", variant: "destructive" });
            return;
        }

        const dataToPrint = {
            ...selectedConf,
            numero: selectedConf.numero || 'PEND',
            inscriptionDate: selectedConf.inscriptionDate || new Date().toISOString()
        };

        setTicketData(dataToPrint);
        setShowTicket(true);

        setTimeout(() => {
            window.print();
        }, 500);
    };


    // --- INDIVIDUAL VIEW LOGIC ---

    const currentConf = pendingConfirmations[currentIndex];

    const handleFormChange = (e) => {
        const { name, value, type } = e.target;
        let finalValue = value;
        
        if (type === 'date') {
            finalValue = toStorageDate(value);
        }

        const updated = [...pendingConfirmations];
        updated[currentIndex] = { ...updated[currentIndex], [name]: finalValue };
        setPendingConfirmations(updated);
        const entityId = user.parishId || user.dioceseId;
        localStorage.setItem(`pendingConfirmations_${entityId}`, JSON.stringify(updated));
    };

    const handleRegisterIndividual = () => {
        if (!currentConf) return;

        if (currentConf.sacramentDate && !isDateValid(currentConf.sacramentDate)) {
             toast({ title: "Error", description: "La fecha de confirmación no puede ser futura.", variant: "destructive" });
             return;
        }
        
        const entityId = user.parishId || user.dioceseId;
        const { libro, folio, numero, partidasPerFolio } = getPartidaParameters(entityId);
        
        const today = new Date();
        const formattedToday = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;

        const newRecord = {
            ...currentConf,
            status: 'celebrated',
            book_number: libro,
            page_number: folio,
            entry_number: numero,
            registrationDate: formattedToday,
            sex: currentConf.sex || 'MASCULINO'
        };

        const finalKey = `confirmations_${entityId}`;
        const currentFinal = JSON.parse(localStorage.getItem(finalKey) || '[]');
        localStorage.setItem(finalKey, JSON.stringify([...currentFinal, newRecord]));

        const { newLibro, newFolio, newNumero } = calculateNextPartidaValues(entityId, libro, folio, numero, partidasPerFolio);

        updatePartidaParameters(entityId, newLibro, newFolio, newNumero);
        
        setParameters({
            ordinarioLibro: newLibro,
            ordinarioFolio: newFolio,
            ordinarioNumero: newNumero,
            ordinarioPartidas: partidasPerFolio
        });

        const updatedPending = pendingConfirmations.filter((_, idx) => idx !== currentIndex);
        localStorage.setItem(`pendingConfirmations_${entityId}`, JSON.stringify(updatedPending));
        setPendingConfirmations(updatedPending);

        toast({ title: "Registro Exitoso", description: `Confirmación registrada: L${libro} F${folio} N${numero}`, className: "bg-green-50 border-green-200 text-green-900" });

        if (currentIndex >= updatedPending.length) {
            setCurrentIndex(Math.max(0, updatedPending.length - 1));
        }
    };

    // --- BATCH VIEW LOGIC ---

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === pendingConfirmations.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingConfirmations.map(b => b.id));
        }
    };

    const handleRegisterBatch = () => {
        if (selectedIds.length === 0) return;

        const selected = pendingConfirmations.filter(b => selectedIds.includes(b.id));

        const entityId = user.parishId || user.dioceseId;
        let { libro, folio, numero, partidasPerFolio } = getPartidaParameters(entityId);
        
        const finalKey = `confirmations_${entityId}`;
        const existingRecords = JSON.parse(localStorage.getItem(finalKey) || '[]');
        
        const today = new Date();
        const formattedToday = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
        
        const newFinalRecords = [];
        const recordsToSave = [...existingRecords];

        selected.forEach(conf => {
            const record = {
                ...conf,
                status: 'celebrated',
                book_number: libro,
                page_number: folio,
                entry_number: numero,
                registrationDate: formattedToday,
                sex: conf.sex || 'MASCULINO'
            };
            
            newFinalRecords.push(record);
            recordsToSave.push(record); 

            numero++; 
            const countInFolio = recordsToSave.filter(r => 
                parseInt(r.book_number) === parseInt(libro) && 
                parseInt(r.page_number) === parseInt(folio)
            ).length;

            if (countInFolio >= partidasPerFolio) {
                folio++;
            }
        });

        localStorage.setItem(finalKey, JSON.stringify(recordsToSave));
        updatePartidaParameters(entityId, libro, folio, numero);
        setParameters({
            ordinarioLibro: libro,
            ordinarioFolio: folio,
            ordinarioNumero: numero,
            ordinarioPartidas: partidasPerFolio
        });

        const updatedPending = pendingConfirmations.filter(b => !selectedIds.includes(b.id));
        localStorage.setItem(`pendingConfirmations_${entityId}`, JSON.stringify(updatedPending));
        setPendingConfirmations(updatedPending);
        setSelectedIds([]);

        toast({ title: "Lote Registrado", description: `Se han asentado ${newFinalRecords.length} registros.`, className: "bg-green-50 border-green-200 text-green-900" });
    };

    if (isLoading) {
        return (
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500">Cargando registros...</p>
                </div>
            </DashboardLayout>
        );
    }

    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-100 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">¡Todo al día!</h3>
            <p className="text-gray-500 mt-2">No hay confirmaciones pendientes para registrar.</p>
        </div>
    );

    return (
        <>
            <div className="print:hidden">
                <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                    {/* Header Area */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-[#4B7BA7] font-serif">Sentar Registros de Confirmación</h1>
                            <p className="text-sm text-gray-600">Gestione y legalice las confirmaciones pendientes.</p>
                        </div>
                        
                        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                            <button
                                onClick={() => setViewMode('individual')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === 'individual' 
                                        ? 'bg-[#4B7BA7] text-white shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <User className="w-4 h-4" />
                                Individual
                            </button>
                            <button
                                onClick={() => setViewMode('batch')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === 'batch' 
                                        ? 'bg-[#4B7BA7] text-white shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                Por Lote
                            </button>
                        </div>
                    </div>

                    {pendingConfirmations.length === 0 ? (
                        <EmptyState />
                    ) : viewMode === 'individual' ? (
                        <div className="space-y-4">
                            {/* Navigation Bar */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={() => setCurrentIndex(0)} disabled={currentIndex === 0}>
                                        <ChevronsLeft className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                </div>
                                <span className="font-mono font-bold text-gray-700">
                                    {currentIndex + 1} / {pendingConfirmations.length}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={() => setCurrentIndex(prev => Math.min(pendingConfirmations.length - 1, prev + 1))} disabled={currentIndex === pendingConfirmations.length - 1}>
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => setCurrentIndex(pendingConfirmations.length - 1)} disabled={currentIndex === pendingConfirmations.length - 1}>
                                        <ChevronsRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Form Content */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                    {/* Auto-assigned fields (Read-Only Preview) */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Libro (Auto)</label>
                                        <div className="p-2 bg-gray-100 rounded border border-gray-200 font-mono text-gray-700">{parameters?.ordinarioLibro}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Folio (Auto)</label>
                                        <div className="p-2 bg-gray-100 rounded border border-gray-200 font-mono text-gray-700">{parameters?.ordinarioFolio}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Número (Auto)</label>
                                        <div className="p-2 bg-gray-100 rounded border border-gray-200 font-mono text-gray-700">{parameters?.ordinarioNumero}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-[#4B7BA7] uppercase">Fecha Confirmación</label>
                                        <Input 
                                            name="sacramentDate" 
                                            type="date"
                                            value={toInputDate(currentConf.sacramentDate)} 
                                            onChange={handleFormChange}
                                            className="border-gray-300 focus:border-[#4B7BA7]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-gray-900 border-b pb-2">Datos del Confirmado</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600">Nombres</label>
                                                <Input name="firstName" value={currentConf.firstName} onChange={handleFormChange} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600">Apellidos</label>
                                                <Input name="lastName" value={currentConf.lastName} onChange={handleFormChange} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600">Fecha Nacimiento</label>
                                                <Input name="birthDate" type="date" value={toInputDate(currentConf.birthDate)} onChange={handleFormChange} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600">Sexo</label>
                                                <select 
                                                    name="sex" 
                                                    value={currentConf.sex || ''} 
                                                    onChange={handleFormChange}
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4B7BA7]"
                                                >
                                                    <option value="MASCULINO">MASCULINO</option>
                                                    <option value="FEMENINO">FEMENINO</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs font-semibold text-gray-600">Lugar Nacimiento</label>
                                                <Input name="lugarNacimientoDetalle" value={currentConf.lugarNacimientoDetalle} onChange={handleFormChange} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-bold text-gray-900 border-b pb-2">Datos de los Padres</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600">Padre</label>
                                                <Input name="fatherName" value={currentConf.fatherName} onChange={handleFormChange} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600">Madre</label>
                                                <Input name="motherName" value={currentConf.motherName} onChange={handleFormChange} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <label className="text-xs font-semibold text-gray-600">Padrinos</label>
                                    <textarea 
                                        name="godparents" 
                                        value={currentConf.godparents || ''} 
                                        onChange={handleFormChange}
                                        className="w-full rounded-md border border-gray-300 p-2 text-sm h-16 resize-none focus:ring-2 focus:ring-[#4B7BA7] outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Ministro</label>
                                            <Input name="minister" value={currentConf.minister} onChange={handleFormChange} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Lugar Confirmación</label>
                                            <Input name="lugarConfirmacionDetalle" value={currentConf.lugarConfirmacionDetalle} onChange={handleFormChange} />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Da Fe (Firma)</label>
                                            <Input 
                                                name="ministerFaith" 
                                                value={currentConf.ministerFaith || ''} 
                                                onChange={handleFormChange}
                                                placeholder="Nombre del párroco"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-4">
                                <Button variant="outline" className="text-gray-600 border-gray-300 hover:bg-gray-100" onClick={() => {/* Handle exit logic */}}>
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Salir
                                </Button>
                                <Button className="bg-[#D4AF37] hover:bg-[#C4A027] text-white font-bold" onClick={handlePrintTicketIndividual}>
                                    <Printer className="w-4 h-4 mr-2" />
                                    Imprimir Boleta
                                </Button>
                                <Button className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white" onClick={handleRegisterIndividual}>
                                    <Save className="w-4 h-4 mr-2" />
                                    Registrar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        // --- BATCH VIEW ---
                        <div className="space-y-4">
                            {/* Counters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
                                    <span className="text-2xl font-bold text-[#4B7BA7]">{selectedIds.length}</span>
                                    <span className="text-xs text-gray-500 uppercase font-semibold">Seleccionadas</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
                                    <span className="text-2xl font-bold text-gray-400">{pendingConfirmations.length - selectedIds.length}</span>
                                    <span className="text-xs text-gray-500 uppercase font-semibold">No Seleccionadas</span>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
                                    <span className="text-2xl font-bold text-gray-900">{pendingConfirmations.length}</span>
                                    <span className="text-xs text-gray-500 uppercase font-semibold">Total</span>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase">
                                            <tr>
                                                <th className="px-6 py-3 w-10">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedIds.length === pendingConfirmations.length && pendingConfirmations.length > 0}
                                                        onChange={toggleSelectAll}
                                                        className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]"
                                                    />
                                                </th>
                                                <th className="px-6 py-3">#</th>
                                                <th className="px-6 py-3">Apellidos</th>
                                                <th className="px-6 py-3">Nombres</th>
                                                <th className="px-6 py-3">Fecha Conf.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pendingConfirmations.map((conf, idx) => (
                                                <tr key={conf.id || idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedIds.includes(conf.id)}
                                                            onChange={() => toggleSelection(conf.id)}
                                                            className="w-4 h-4 text-[#4B7BA7] rounded border-gray-300 focus:ring-[#4B7BA7]"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3 font-mono text-gray-500">{idx + 1}</td>
                                                    <td className="px-6 py-3 font-semibold text-gray-900">{conf.lastName}</td>
                                                    <td className="px-6 py-3 text-gray-700">{conf.firstName}</td>
                                                    <td className="px-6 py-3 text-gray-500">{conf.sacramentDate || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-4">
                                <Button variant="outline" className="text-gray-600" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
                                    Cancelar Selección
                                </Button>
                                <Button 
                                    className="bg-[#D4AF37] hover:bg-[#C4A027] text-white font-bold" 
                                    onClick={handlePrintTicketBatch}
                                    disabled={selectedIds.length !== 1}
                                    title={selectedIds.length !== 1 ? "Seleccione exactamente un registro para imprimir" : "Imprimir Boleta"}
                                >
                                    <Printer className="w-4 h-4 mr-2" />
                                    Imprimir Boleta
                                </Button>
                                <Button 
                                    className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white" 
                                    onClick={handleRegisterBatch}
                                    disabled={selectedIds.length === 0}
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Registrar ({selectedIds.length})
                                </Button>
                            </div>
                        </div>
                    )}
                </DashboardLayout>
            </div>
            
            <div className="hidden print:block">
                 {ticketData && <ConfirmationTicket confirmationData={ticketData} parishInfo={parishInfo} />}
            </div>
        </>
    );
};

export default ConfirmationSentarRegistrosPage;