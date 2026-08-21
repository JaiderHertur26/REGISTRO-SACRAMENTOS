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

    // --- 4. ORDENAMIENTO ALFABÉTICO ESTRICTO (Leyendo de Supabase Correctamente) ---
    const sortedData = [...dataSource].sort((a, b) => {
        const nameA = `${a.apellidos || a.raw_data?.apellidos || ''} ${a.nombres || a.raw_data?.nombres || ''}`.trim().toLowerCase();
        const nameB = `${b.apellidos || b.raw_data?.apellidos || ''} ${b.nombres || b.raw_data?.nombres || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
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
            {/* 🚀 INYECCIÓN DE ESTILOS PROFESIONALES EXCLUSIVOS PARA IMPRESIÓN MULTI-PÁGINA */}
            <style type="text/css" media="print, screen">{`
                /* RESET Y CONFIGURACIÓN BÁSICA QUE ROMPE LÍMITES DE ALTURA */
                html, body, #root, .print-container {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: visible !important;
                    background-color: white !important;
                }

                .print-container {
                    font-family: 'Times New Roman', Times, serif; /* Tipografía oficial eclesiástica */
                    color: #000;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                }

                /* CONFIGURACIÓN DE PÁGINA (MÁRGENES FÍSICOS REQUERIDOS PARA IMPRESIÓN FORMAL) */
                @page {
                    size: letter portrait;
                    margin: 15mm; 
                }

                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    /* EVITAR CORTES DE TABLA Y ROMPIMIENTOS DE BORDES */
                    table { page-break-inside: auto; }
                    tr { 
                        page-break-inside: avoid !important; 
                        page-break-after: auto !important;
                        break-inside: avoid !important;
                    }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }

                /* CABECERA ECLESIÁSTICA (DENTRO DEL THEAD PARA QUE SE REPITA) */
                .header-cell {
                    border: none !important;
                    background: white !important;
                    padding: 0 0 20px 0 !important;
                }
                .print-diocese {
                    font-size: 14pt;
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-align: center;
                }
                .print-parish {
                    font-size: 18pt;
                    font-weight: 900;
                    margin: 4px 0;
                    text-align: center;
                }
                .print-location {
                    font-size: 10pt;
                    font-family: 'Arial', sans-serif;
                    color: #333;
                    text-align: center;
                }
                .print-title {
                    text-align: center;
                    font-size: 14pt;
                    font-weight: bold;
                    border-bottom: 3px double #000;
                    margin-top: 15px;
                    padding-bottom: 8px;
                    letter-spacing: 1.5px;
                }

                /* DISEÑO DE LA TABLA ESTILO LIBRO CONTABLE */
                .print-table {
                    width: 100%;
                    border-collapse: collapse; /* Evita bordes dobles */
                    border-spacing: 0;
                    font-family: 'Arial', sans-serif; /* Arial para los datos es más legible */
                    font-size: 9pt;
                }
                
                .header-row th {
                    border: 1px solid #000;
                    border-top: 2px solid #000;
                    border-bottom: 2px solid #000;
                    padding: 10px 6px;
                    background-color: #f4f4f5 !important;
                    font-weight: 900;
                    text-align: center;
                    text-transform: uppercase;
                    font-size: 8pt;
                }
                
                .print-table td {
                    border: 1px solid #000; /* Borde estricto para evitar cortes */
                    padding: 8px 6px;
                    vertical-align: middle;
                    line-height: 1.3;
                }
                
                /* FILAS CEBRADAS SUAVES PARA LECTURA */
                .print-table tbody tr:nth-child(even) td {
                    background-color: #fafafa !important;
                }

                /* CELDAS ESPECÍFICAS */
                .col-number { width: 4%; font-weight: bold; text-align: center; font-size: 8pt; }
                .col-titular { width: 34%; }
                .col-padres { width: 38%; font-size: 8pt; }
                .col-ref { width: 8%; font-family: 'Courier New', Courier, monospace; font-size: 10pt; text-align: center; font-weight: bold; }

                .text-bold { font-weight: 900; font-size: 10pt; color: #000; letter-spacing: -0.5px; }
                .text-muted { font-size: 9pt; color: #333; margin-top: 2px; }

                /* ESTADO ANULADO / DECRETO */
                .row-anulada td {
                    color: #777;
                }
                .badge-anulada {
                    display: inline-block;
                    background-color: #000 !important;
                    color: white !important;
                    font-size: 6pt;
                    padding: 2px 5px;
                    border-radius: 2px;
                    font-weight: bold;
                    margin-left: 6px;
                    vertical-align: text-bottom;
                    letter-spacing: 1px;
                }
                
                /* FOOTER DE PÁGINA */
                .footer-cell {
                    border: none !important;
                    background: white !important;
                    padding-top: 20px !important;
                    text-align: right !important;
                    font-size: 8pt !important;
                    color: #555 !important;
                    font-style: italic;
                    font-family: 'Times New Roman', Times, serif;
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
                                ÍNDICE GENERAL DE BAUTISMOS {bookNumber ? `• LIBRO ${bookNumber.padStart(4, '0')}` : ''}
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

                        // 🚀 LECTURA DIRECTA DEL ESQUEMA DE SUPABASE (CON FALLBACK AL RAW_DATA)
                        const apellidos = safeFormat(record.apellidos || record.raw_data?.apellidos || record.lastName || '');
                        const nombres = safeFormat(record.nombres || record.raw_data?.nombres || record.firstName || '');
                        const padre = safeFormat(record.nombre_padre || record.raw_data?.nombrePadre || record.raw_data?.padre || record.fatherName || '---');
                        const madre = safeFormat(record.nombre_madre || record.raw_data?.nombreMadre || record.raw_data?.madre || record.motherName || '---');
                        
                        const book = formatNumber(record.book_number || record.Libro || record.raw_data?.Libro || record.libro);
                        const page = formatNumber(record.folio || record.raw_data?.folio || record.page_number);
                        const entry = formatNumber(record.number || record.numero || record.raw_data?.numero || record.raw_data?.numeroActa);
                        
                        const isAnulada = record.status === 'anulada' || record.raw_data?.isAnnulled || record.raw_data?.estado === 'anulada';

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

                <tfoot>
                    <tr>
                        <td colSpan="6" className="footer-cell">
                            Índice Generado Oficialmente por el Sistema Eclesia Digital • {new Date().toLocaleDateString('es-CO')}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
});

BaptismIndexPrintTemplate.displayName = 'BaptismIndexPrintTemplate';
export default BaptismIndexPrintTemplate;