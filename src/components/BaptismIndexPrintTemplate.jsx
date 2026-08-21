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
                /* RESET Y CONFIGURACIÓN BÁSICA */
                .print-container {
                    font-family: 'Arial', sans-serif;
                    background-color: white;
                    color: #000;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                }

                /* CONFIGURACIÓN DE PÁGINA (MÁRGENES FÍSICOS) */
                @page {
                    size: letter;
                    margin: 15mm; /* Márgenes físicos reales para evitar cortes */
                }

                @media print {
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    /* REPETICIÓN DE CABECERAS Y PIES DE PÁGINA */
                    .print-table {
                        width: 100%;
                    }
                    .print-table thead {
                        display: table-header-group; /* Repite la cabecera en cada página */
                    }
                    .print-table tbody {
                        display: table-row-group;
                    }
                    .print-table tfoot {
                        display: table-footer-group; /* Repite el pie en cada página */
                    }
                    
                    /* EVITAR CORTES EN MEDIO DE LAS FILAS */
                    .print-table tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print-table td, .print-table th {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }

                /* CABECERA ECLESIÁSTICA (AHORA DENTRO DEL THEAD) */
                .header-cell {
                    border: none !important;
                    background: white !important;
                    padding: 0 0 15px 0 !important;
                }
                .print-diocese {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 13pt;
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-align: center;
                }
                .print-parish {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 16pt;
                    font-weight: 900;
                    margin: 4px 0;
                    text-align: center;
                }
                .print-location {
                    font-size: 9pt;
                    color: #444;
                    text-align: center;
                }
                .print-title {
                    text-align: center;
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 12pt;
                    font-weight: bold;
                    border-bottom: 2px solid #000;
                    margin-top: 15px;
                    padding-bottom: 8px;
                    letter-spacing: 1.5px;
                }

                /* TABLA PRINCIPAL */
                .print-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9pt;
                }
                .header-row th {
                    border: 1px solid #000;
                    border-top: 2px solid #000; /* Separador fuerte */
                    border-bottom: 2px solid #000;
                    padding: 8px 4px;
                    background-color: #eaeaea !important;
                    font-weight: bold;
                    text-align: center;
                    text-transform: uppercase;
                    font-size: 8.5pt;
                }
                .print-table td {
                    border: 1px solid #444; /* Borde ligeramente más suave para el cuerpo */
                    padding: 6px 5px;
                    vertical-align: middle;
                    line-height: 1.2;
                }
                
                /* FILAS CEBRADAS */
                .print-table tbody tr:nth-child(even) td {
                    background-color: #f9f9f9 !important;
                }

                /* CELDAS ESPECÍFICAS */
                .col-center { text-align: center; }
                .col-number { width: 4%; font-weight: bold; text-align: center; font-size: 8pt; }
                .col-titular { width: 33%; }
                .col-padres { width: 39%; font-size: 8pt; color: #222; }
                .col-ref { width: 8%; font-family: 'Courier New', Courier, monospace; font-size: 9.5pt; text-align: center; font-weight: bold; }

                .text-bold { font-weight: bold; font-size: 9.5pt; color: #000; }
                .text-muted { font-size: 8.5pt; color: #444; margin-top: 2px; }

                /* ESTADO ANULADO */
                .row-anulada td {
                    background-color: #fff0f0 !important;
                    color: #777;
                }
                .badge-anulada {
                    display: inline-block;
                    background-color: #d32f2f !important;
                    color: white !important;
                    font-size: 6pt;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-weight: bold;
                    margin-left: 6px;
                    vertical-align: middle;
                }
                
                /* FOOTER DE PÁGINA */
                .footer-cell {
                    border: none !important;
                    background: white !important;
                    padding-top: 15px !important;
                    text-align: right !important;
                    font-size: 7.5pt !important;
                    color: #666 !important;
                    font-style: italic;
                }
            `}</style>
            
            <table className="print-table">
                <thead>
                    {/* 🚀 CABECERA QUE SE REPITE INTELIGENTEMENTE EN CADA PÁGINA */}
                    <tr>
                        <th colSpan="6" className="header-cell">
                            <div className="print-diocese">{diocesis}</div>
                            <div className="print-parish">{nombreParroquia}</div>
                            <div className="print-location">{ubicacionHeader}</div>
                            <div className="print-title">
                                ÍNDICE GENERAL DE BAUTISMOS {bookNumber ? `• LIBRO ${bookNumber}` : ''}
                            </div>
                        </th>
                    </tr>
                    {/* TÍTULOS DE COLUMNAS */}
                    <tr className="header-row">
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
                        
                        // Capturando el libro con 'L' mayúscula para evitar celdas en blanco
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
                                    <div style={{ marginBottom: '2px' }}><strong>P:</strong> {padre}</div>
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
                            <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#888', fontStyle: 'italic', fontSize: '10pt' }}>
                                NO SE ENCONTRARON REGISTROS ASENTADOS PARA GENERAR EL ÍNDICE
                            </td>
                        </tr>
                    )}
                </tbody>

                <tfoot>
                    <tr>
                        <td colSpan="6" className="footer-cell">
                            Índice generado por el Sistema SacramentumRegistry • {new Date().toLocaleDateString('es-CO')}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
});

BaptismIndexPrintTemplate.displayName = 'BaptismIndexPrintTemplate';
export default BaptismIndexPrintTemplate;