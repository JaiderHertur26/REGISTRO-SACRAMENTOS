import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Search, Info, Loader2, FileX2 } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const BusquedaPartidaBautismo = ({ onPartidaSelected }) => {
    const { data } = useAppData();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [searchScope, setSearchScope] = useState('diocese'); 
    const [selectedDiocese, setSelectedDiocese] = useState('');
    const [searchMode, setSearchMode] = useState('bfn'); 
    
    const [book, setBook] = useState('');
    const [folio, setFolio] = useState('');
    const [number, setNumber] = useState('');
    
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const allDiocesesSorted = [...(data.dioceses || [])].sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
    });

    useEffect(() => {
        if (user && user.dioceseId) {
            setSelectedDiocese(user.dioceseId);
        }
    }, [user]);

    const isSearchDisabled = searchMode === 'bfn' 
        ? (!book && !folio && !number) 
        : (!firstName && !lastName);

    const handleSearch = () => {
        if (isSearchDisabled) {
            toast({
                title: "Atención",
                description: "Por favor, ingrese al menos un criterio de búsqueda.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setSelectedRow(null);
        onPartidaSelected(null);
        setResults([]);

        setTimeout(() => {
            try {
                let allBaptisms = [];
                let keysToSearch = [];
                
                if (searchScope === 'all') {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('baptisms_')) {
                            keysToSearch.push(key);
                        }
                    }
                } else {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('baptisms_')) {
                            keysToSearch.push(key);
                        }
                    }
                }

                keysToSearch.forEach(key => {
                    const parishId = key.replace('baptisms_', '');
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (Array.isArray(parsed)) {
                                const enriched = parsed
                                    .filter(p => p && p.id && (p.nombres || p.firstName || p.apellidos || p.lastName))
                                    .map(p => ({ ...p, _parishId: parishId }));
                                allBaptisms = [...allBaptisms, ...enriched];
                            }
                        } catch (e) {
                            console.error("Error parsing baptisms for key", key, e);
                        }
                    }
                });

                let filtered = allBaptisms;
                if (searchMode === 'bfn') {
                    if (book) filtered = filtered.filter(b => String(b.book_number || b.book || '') === String(book));
                    if (folio) filtered = filtered.filter(b => String(b.page_number || b.page || '') === String(folio));
                    if (number) filtered = filtered.filter(b => String(b.entry_number || b.entry || '') === String(number));
                } else {
                    if (firstName) filtered = filtered.filter(b => (b.nombres || b.firstName || '').toLowerCase().includes(firstName.toLowerCase()));
                    if (lastName) filtered = filtered.filter(b => (b.apellidos || b.lastName || '').toLowerCase().includes(lastName.toLowerCase()));
                }

                setResults(filtered || []);
            } catch (error) {
                console.error("Search failed:", error);
                toast({
                    title: "Error de búsqueda",
                    description: "Ocurrió un error al buscar las partidas. Intente nuevamente.",
                    variant: "destructive"
                });
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);
    };

    const selectRow = (partida) => {
        setSelectedRow(partida);
    };

    const confirmSelection = () => {
        if (selectedRow) {
            const parish = data.parishes.find(p => p.id === selectedRow._parishId);
            const enriched = { 
                ...selectedRow, 
                parishId: selectedRow._parishId, 
                parishName: parish?.name || 'Parroquia Desconocida' 
            };
            onPartidaSelected(enriched);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-[#4B7BA7] font-serif mb-2 flex items-center gap-2">
                <Search className="w-5 h-5" /> Búsqueda de Partida de Bautismo
            </h2>
            <p className="text-sm text-gray-500 mb-6">
                Localice el registro sacramental en el archivo digital de la Diócesis.
            </p>
            
            <div className="mb-6 space-y-4">
                <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="radio" 
                            name="scope" 
                            value="diocese" 
                            checked={searchScope === 'diocese'} 
                            onChange={() => setSearchScope('diocese')} 
                            className="w-4 h-4 text-blue-600" 
                        />
                        <span className="text-gray-700">Todas las parroquias de una diócesis</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="radio" 
                            name="scope" 
                            value="all" 
                            checked={searchScope === 'all'} 
                            onChange={() => setSearchScope('all')} 
                            className="w-4 h-4 text-blue-600" 
                        />
                        <span className="text-gray-700">Todas las diócesis</span>
                    </label>
                </div>

                {searchScope === 'diocese' && (
                    <div className="w-full md:w-1/2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Diócesis / Arquidiócesis</label>
                        <Select 
                            value={selectedDiocese} 
                            onChange={(e) => setSelectedDiocese(e.target.value)}
                            options={allDiocesesSorted.map(d => ({ value: d.id, label: d.name }))}
                            placeholder="Seleccione una diócesis o arquidiócesis"
                        />
                    </div>
                )}
            </div>

            <div className="border-t border-gray-200 my-6"></div>

            <div className="mb-6">
                <div className="flex gap-4 mb-4">
                    <Button 
                        variant={searchMode === 'bfn' ? 'default' : 'outline'} 
                        onClick={() => setSearchMode('bfn')} 
                        className="flex-1"
                    >
                        Buscar por Libro / Folio / Número
                    </Button>
                    <Button 
                        variant={searchMode === 'name' ? 'default' : 'outline'} 
                        onClick={() => setSearchMode('name')} 
                        className="flex-1"
                    >
                        Buscar por Nombres y Apellidos
                    </Button>
                </div>

                {searchMode === 'bfn' ? (
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Libro</label>
                            <Input value={book} onChange={(e) => setBook(e.target.value)} type="number" />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Folio</label>
                            <Input value={folio} onChange={(e) => setFolio(e.target.value)} type="number" />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                            <Input value={number} onChange={(e) => setNumber(e.target.value)} type="number" />
                        </div>
                        <Button 
                            onClick={handleSearch} 
                            disabled={isLoading || isSearchDisabled}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2 w-full md:w-auto min-w-[120px]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 
                            {isLoading ? 'Buscando...' : 'Buscar'}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                        <Button 
                            onClick={handleSearch} 
                            disabled={isLoading || isSearchDisabled}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2 w-full md:w-auto min-w-[120px]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 
                            {isLoading ? 'Buscando...' : 'Buscar'}
                        </Button>
                    </div>
                )}
            </div>

            {hasSearched && !isLoading && (
                <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-700">Resultados ({results ? results.length : 0})</h3>
                    </div>
                    {!results || results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                            <FileX2 className="w-10 h-10 mb-2 text-gray-300" />
                            <p>No se encontraron registros que coincidan con la búsqueda.</p>
                            <p className="text-sm mt-1">Verifique los datos e intente nuevamente.</p>
                        </div>
                    ) : (
                        <div className="max-h-[300px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-4 py-3">Nombre</th>
                                        <th className="px-4 py-3">Parroquia</th>
                                        <th className="px-4 py-3">L / F / N</th>
                                        <th className="px-4 py-3">Fecha Bautismo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, idx) => {
                                        const parish = data.parishes.find(p => p.id === r._parishId);
                                        const parishName = parish ? parish.name : 'Desconocida';
                                        
                                        return (
                                            <tr 
                                                key={r.id || idx} 
                                                onClick={() => selectRow(r)} 
                                                className={`cursor-pointer border-b last:border-b-0 hover:bg-blue-50 transition-colors ${selectedRow?.id === r.id ? 'bg-blue-100' : 'bg-white'}`}
                                            >
                                                <td className="px-4 py-3 font-medium text-gray-900">{r.firstName || r.nombres} {r.lastName || r.apellidos}</td>
                                                <td className="px-4 py-3 text-gray-600">{parishName}</td>
                                                <td className="px-4 py-3 font-mono text-gray-600">
                                                    {r.book_number || r.book || '-'} / {r.page_number || r.page || '-'} / {r.entry_number || r.entry || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{r.sacramentDate || r.fecbau || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {selectedRow && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex-1 w-full">
                        <h4 className="text-blue-800 font-bold mb-2 flex items-center gap-2">
                            <Info className="w-4 h-4"/> Partida Seleccionada
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-blue-600 block text-xs uppercase font-bold">Persona</span> 
                                <span className="font-medium text-gray-900">{selectedRow.firstName || selectedRow.nombres} {selectedRow.lastName || selectedRow.apellidos}</span>
                            </div>
                            <div>
                                <span className="text-blue-600 block text-xs uppercase font-bold">Ubicación</span> 
                                <span className="font-medium text-gray-900">
                                    Libro {selectedRow.book_number || selectedRow.book || '-'} Folio {selectedRow.page_number || selectedRow.page || '-'} Número {selectedRow.entry_number || selectedRow.entry || '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-blue-600 block text-xs uppercase font-bold">Padres</span> 
                                <span className="font-medium text-gray-900">{selectedRow.fatherName || selectedRow.padre || '-'} / {selectedRow.motherName || selectedRow.madre || '-'}</span>
                            </div>
                        </div>
                    </div>
                    <Button onClick={confirmSelection} className="bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] whitespace-nowrap w-full lg:w-auto font-medium">
                        Continuar con esta partida
                    </Button>
                </div>
            )}
        </div>
    );
};

export default BusquedaPartidaBautismo;