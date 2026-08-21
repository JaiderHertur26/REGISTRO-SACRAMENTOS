import React, { forwardRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { formatPersonData } from '@/utils/formatPersonData';

const BaptismIndexPrintTemplate = forwardRef(({ data, parroquiaInfo, bookNumber }, ref) => {
    const { user } = useAuth() || {};
    const { getMisDatosList } = useAppData() || {};
    const dataSource = data || [];

    // --- 1. EXTRACTOR DE IDENTIDAD SEGURO ---
    const getSafeParishId = () => {
        if (user?.parishId) return user.parishId;
        try { return JSON.parse(localStorage.getItem('user') || '{}').parishId; } catch (e) { return null; }
    };
    const safeParishId = getSafeParishId();

    // --- 2. BUSCADOR DEFINITIVO DE MEMBRETE ---
    const getOfficialData = (field, fallback) => {
        try {
            if (parroquiaInfo && parroquiaInfo[field]) return parroquiaInfo[field];

            if (!safeParishId) return fallback;
            let p = null;
            const rawGlobal = localStorage.getItem('mis_datos');
            if (rawGlobal) {
                const allRecords = JSON.parse(rawGlobal);
                const record = allRecords.find(r => r.entity_id === safeParishId);
                if (record && record.payload) p = Array.isArray(record.payload) ? record.payload[0] : record.payload;
            }
            if (!p && typeof getMisDatosList === 'function') {
                const records = getMisDatosList(safeParishId);
                if (records && records.length > 0) p = records[0]['0'] || records[0]; 
            }
            if (!p) return fallback;

            const f = field.toLowerCase();
            const value = p[field] || p[f] || p[field.toUpperCase()] ||
                (f === 'nombre' ? (p.nombre || p.nombreParroquia || p.nombreCancilleria) : null) ||
                (f === 'diocesis' ? (p.diocesis || p.nombreDiocesis || p.diocesis_name) : null) ||
                (f === 'ciudad' ? p.ciudad : null) || (f === 'region' ? p.region : null);

            if (value && String(value).trim() !== '' && String(value).toUpperCase() !== 'DESCONOCIDA') {
                return String(value).trim();
            }
        } catch (e) { console.error("Error leyendo membrete en Índice:", e); }
        return fallback;
    };

    // --- 3. PROCESAMIENTO DE CABECERA OFICIAL ---
    const diocesis = getOfficialData('diocesis', user?.dioceseName || 'DIÓCESIS').toUpperCase();
    const nombreParroquia = getOfficialData('nombre', user?.parishName || 'PARROQUIA').toUpperCase();
    
    const ciudad = getOfficialData('ciudad', '').toUpperCase();
    const departamento = getOfficialData('region', '').toUpperCase();
    
    // Evitar duplicar "Colombia" si la región ya lo trae
    let ubicacionHeader = [ciudad, departamento].filter(Boolean).join(', ');
    if (ubicacionHeader && !ubicacionHeader.includes('COLOMBIA')) {
        ubicacionHeader += ' - COLOMBIA';
    }

    // --- 4. ORDENAMIENTO ALFABÉTICO ESTRICTO ---
    const sortedData = [...dataSource].sort((a, b) => {
        const nameA = `${a.apellidos || a.lastName || ''} ${a.nombres || a.firstName || ''}`.trim().toLowerCase();
        const nameB = `${b.apellidos || b.lastName || ''} ${b.nombres || b.firstName || ''}`.trim().toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    // Formateador robusto para números (Evita que queden en blanco)
    const formatNumber = (val) => {
        if (val === undefined || val === null || val === '') return '---';
        const str = String(val).trim();
        if (str === '0' || str === '---' || str === '-') return '---';
        if (isNaN(str)) return str; // Por si hay folios con letras (Ej: "12B")
        return str.padStart(4, '0');
    };

    return (
        <div ref={ref} className="print-container">
            {/* 🚀 INYECCIÓN DE ESTILOS PROFESIONALES EXCLUSIVOS PARA IMPRESIÓN */}
            <style type="text/css" media="print, screen">{`
                .print-container {
                    padding: 0.8in 0.6in;
                    font-family: 'Arial', sans-serif;
                    background-color: white;
                    color: #000;
                }
                
                /* CABECERA ECLESIÁSTICA */
                .print-header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .print-diocese {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 14pt;
                    font-weight: bold;
                    letter-spacing: 1px;
                }
                .print-parish {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 18pt;
                    font-weight: 900;
                    margin: 5px 0;
                }
                .print-location {
                    font-size: 10pt;
                    color: #444;
                }
                
                /* TÍTULO DEL DOCUMENTO */
                .print-title {
                    text-align: center;
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 14pt;
                    font-weight: bold;
                    border-bottom: 2px solid #000;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    letter-spacing: 2px;
                }

                /* TABLA PRINCIPAL */
                .print-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9.5pt;
                }
                .print-table th {
                    border: 1.5px solid #000;
                    padding: 10px 6px;
                    background-color: #f4f4f4;
                    font-weight: bold;
                    text-align: center;
                    font-size: 9pt;
                    -webkit-print-color-adjust: exact;
                }
                .print-table td {
                    border: 1px solid #666;
                    padding: 8px 6px;
                    vertical-align: middle;
                    line-height: 1.3;
                }
                .print-table tr {
                    page-break-inside: avoid;
                }
                .print-table tr:nth-child(even) {
                    background-color: #fafafa;
                    -webkit-print-color-adjust: exact;
                }
                
                /* CELDAS ESPECÍFICAS */
                .col-center { text-align: center; }
                .col-number { width: 4%; font-weight: bold; text-align: center; }
                .col-titular { width: 33%; }
                .col-padres { width: 39%; font-size: 8.5pt; color: #333; }
                .col-ref { width: 8%; font-family: monospace; font-size: 10pt; text-align: center; font-weight: bold; }
                
                .text-bold { font-weight: bold; font-size: 10.5pt; }
                .text-muted { font-size: 8.5pt; color: #555; margin-top: 2px; }
                
                /* ESTADO ANULADO */
                .row-anulada td {
                    background-color: #ffeaea !important;
                    color: #888;
                    -webkit-print-color-adjust: exact;
                }
                .badge-anulada {
                    display: inline-block;
                    background-color: #e74c3c;
                    color: white;
                    font-size: 7pt;
                    padding: 2px 5px;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-left: 6px;
                    vertical-align: middle;
                }

                /* CONFIGURACIÓN DE PÁGINA */
                @page {
                    size: letter;
                    margin: 0.4in;
                }
                @media print {
                    .print-table thead { display: table-header-group; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
            
            <div className="print-header">
                <div className="print-diocese">{diocesis}</div>
                <div className="print-parish">{nombreParroquia}</div>
                <div className="print-location">{ubicacionHeader}</div>
            </div>
            
            <div className="print-title">
                ÍNDICE GENERAL DE BAUTISMOS {bookNumber ? `• LIBRO ${bookNumber}` : ''}
            </div>

            <table className="print-table">
                <thead>
                    <tr>
                        <th className="col-number">N°</th>
                        <th className="col-titular">APELLIDOS Y NOMBRES</th>
                        <th className="col-padres">PADRES / FILIACIÓN</th>
                        <th className="col-ref">LIBRO</th>
                        <th className="col-ref">FOLIO</th>
                        <th className="col-ref">ACTA</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((record, index) => {
                        const safeFormat = (val) => typeof formatPersonData === 'function' ? formatPersonData(val) : val;

                        const apellidos = safeFormat(record.apellidos || record.lastName || '');
                        const nombres = safeFormat(record.nombres || record.firstName || '');
                        const padre = safeFormat(record.nombrePadre || record.fatherName || record.padre || '---');
                        const madre = safeFormat(record.nombreMadre || record.motherName || record.madre || '---');
                        
                        // 🚀 CORRECCIÓN CLAVE: Agregamos record.Libro con L mayúscula
                        const book = formatNumber(record.Libro || record.book_number || record.libro);
                        const page = formatNumber(record.folio || record.page_number);
                        const entry = formatNumber(record.numero || record.numeroActa || record.entry_number);
                        
                        const isAnulada = record.status === 'anulada' || record.isAnnulled || record.estado === 'anulada';

                        return (
                            <tr key={record.id || index} className={isAnulada ? 'row-anulada' : ''}>
                                <td className="col-number">{index + 1}</td>
                                
                                <td>
                                    <div className="text-bold">
                                        {apellidos}
                                        {isAnulada && <span className="badge-anulada">ANULADA</span>}
                                    </div>
                                    <div className="text-muted">{nombres}</div>
                                </td>
                                
                                <td className="col-padres">
                                    <div style={{ marginBottom: '3px' }}><strong>P:</strong> {padre}</div>
                                    <div><strong>M:</strong> {madre}</div>
                                </td>
                                
                                <td className="col-ref">{book}</td>
                                <td className="col-ref">{page}</td>
                                <td className="col-ref">{entry}</td>
                            </tr>
                        );
                    })}
                    
                    {sortedData.length === 0 && (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '50px', color: '#888', fontStyle: 'italic', fontSize: '11pt' }}>
                                NO SE ENCONTRARON REGISTROS ASENTADOS PARA GENERAR EL ÍNDICE
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #ccc', textAlign: 'right', fontSize: '8pt', color: '#666', fontStyle: 'italic' }}>
                Índice generado por el Sistema SacramentumRegistry • {new Date().toLocaleDateString('es-CO')}
            </div>
        </div>
    );
});

BaptismIndexPrintTemplate.displayName = 'BaptismIndexPrintTemplate';
export default BaptismIndexPrintTemplate;