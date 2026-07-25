import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { obtenerDocumentoRelacionado, obtenerParroquiaEmisoraInfo } from '@/utils/matrimonialNotificationAvisoHelpers';
import { convertDateToSpanishTextNatural } from '@/utils/dateTimeFormatters';

const TablaAvisos = ({ avisos, onViewAviso, onMarkAsViewed, onDeleteAviso, currentParishName }) => {
    
    // Sort logic: Pendientes first, then by date descending
    const sortedAvisos = [...avisos].sort((a, b) => {
        const isAPending = a.status === 'pendiente';
        const isBPending = b.status === 'pendiente';
        
        if (isAPending && !isBPending) return -1;
        if (!isAPending && isBPending) return 1;
        
        // Both have same status, sort by date desc
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const formatShortDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr));
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-center">Estado</th>
                            <th className="px-4 py-3">Fecha Creación</th>
                            <th className="px-4 py-3">Parroquia Origen</th>
                            <th className="px-4 py-3">Parroquia Destino</th>
                            <th className="px-4 py-3">Cónyuge</th>
                            <th className="px-4 py-3">Fecha Matrimonio</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sortedAvisos.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                    No se encontraron avisos que coincidan con los criterios.
                                </td>
                            </tr>
                        ) : (
                            sortedAvisos.map((aviso) => {
                                const isPending = aviso.status === 'pendiente';
                                const documento = obtenerDocumentoRelacionado(aviso.documentoId);
                                const parroquiaInfo = documento ? obtenerParroquiaEmisoraInfo(documento.parishId) : null;
                                
                                const emisorName = parroquiaInfo ? parroquiaInfo.name : 'Desconocida';
                                const spouseName = documento?.spouseName || '-';
                                const marriageDate = documento?.marriageDate ? formatShortDate(documento.marriageDate) : '-';
                                const creationDate = formatShortDate(aviso.createdAt);
                                
                                return (
                                    <tr key={aviso.id} className={`${isPending ? 'bg-amber-50/30 hover:bg-amber-100/50' : 'bg-white hover:bg-gray-50'} transition-colors group`}>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center">
                                                {isPending ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                        <Circle className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                        Pendiente
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                                                        Procesado
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{creationDate}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900 line-clamp-1" title={emisorName}>{emisorName}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 line-clamp-1" title={currentParishName || 'Mi Parroquia'}>
                                            {currentParishName || 'Mi Parroquia'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-800 line-clamp-1" title={spouseName}>{spouseName}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{marriageDate}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => onViewAviso(aviso)}
                                                    className="flex items-center gap-1 h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                    title="Ver detalles"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Ver</span>
                                                </Button>
                                                
                                                {isPending && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => onMarkAsViewed(aviso)}
                                                        className="flex items-center gap-1 h-8 text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200"
                                                        title="Marcar como procesado"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}

                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => onDeleteAviso(aviso)}
                                                    className="flex items-center gap-1 h-8 text-red-500 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200"
                                                    title="Eliminar aviso"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TablaAvisos;