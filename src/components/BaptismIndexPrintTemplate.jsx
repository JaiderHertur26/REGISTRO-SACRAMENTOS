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
    
    let ubicacionHeader = [ciudad, departamento].filter(Boolean).join(', ');
    if (ubicacionHeader && !ubicacionHeader.includes('COLOMBIA')) {
        ubicacionHeader += ' - COLOMBIA';
    }

    // --- 4. ORDENAMIENTO ALFABÉTICO ESTRICTO ---
    const sortedData = [...dataSource].sort((a, b) => {
        const nameA = `${a.apellidos || a.raw_data?.apellidos || ''} ${a.nombres || a.raw_data?.nombres || ''}`.trim().toLowerCase();
        const nameB = `${b.apellidos || b.raw_data?.apellidos || ''} ${b.nombres || b.raw_data?.nombres || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const formatNumber = (val) => {
        if (val === undefined || val === null || val === '') return '---';
        const str = String(val).trim();
        if (str === '0' || str === '---' || str === '-') return '---';
        if (isNaN(str)) return str;
        return str.padStart(4, '0');
    };

    // 🚀 EXTRACCIÓN ROBUSTA DE PADRES (Cubre Supabase columnas y raw_data)
    const getParentName = (record, type) => {
        const raw = record.raw_data || {};
        if (type === 'father') {
            const val = record.nombre_padre || raw.nombre_padre || raw.nombrePadre || raw.padre || raw.fatherName || raw.father_name;
            return val && String(val).trim() !== '' ? String(val).trim().toUpperCase() : '---';
        } else {
            const val = record.nombre_madre || raw.nombre_madre || raw.nombreMadre || raw.madre || raw.motherName || raw.mother_name;
            return val && String(val).trim() !== '' ? String(val).trim().toUpperCase() : '---';
        }
    };

    return (
        <div ref={ref} className="print-container">
            <style type="text/css" media="print, screen">{`
                html, body, #root, .print-container {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: visible !important;
                    background-color: white !important;
                }

                .print-container {
                    font-family: 'Times New Roman', Times, serif;
                    color: #000;
                    width: 100%;
                    margin: 0;
                    padding: 10mm;
                    box-sizing: border-box;
                }

                @page {
                    size: letter portrait;
                    margin: 12mm; 
                }

                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    tr { 
                        page-break-inside: avoid !important; 
                        break-inside: avoid !important;
                    }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }

                /* MEMBRETE INSTITUCIONAL FUERA DE LA TABLA (NO SE DUPLICA) */
                .print-header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 3px double #000;
                    padding-bottom: 12px;
                }
                .print-diocese {
                    font-size: 13pt;
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .print-parish {
                    font-size: 16pt;
                    font-weight: 900;
                    margin: 4px 0;
                    text-transform: uppercase;
                }
                .print-location {
                    font-size: 9.5pt;
                    font-family: 'Arial', sans-serif;
                    color: #222;
                }
                .print-title {
                    font-size: 12pt;
                    font-weight: bold;
                    margin-top: 12px;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                }

                /* MARCO EXTERIOR Y TABLA */
                .table-wrapper {
                    border: 2px solid #000;
                    width: 100%;
                }

                .print-table {
                    width: 100%;
                    border-collapse: collapse;
                    border-spacing: 0;
                    font-family: 'Arial', sans-serif;
                    font-size: 9pt;
                }
                
                .header-row th {
                    border: 1px solid #000;
                    border-bottom: 2px solid #000;
                    padding: 8px 6px;
                    background-color: #eaeaea !important;
                    font-weight: 900;
                    text-align: center;
                    text-transform: uppercase;
                    font-size: 8pt;
                }
                
                .print-table td {
                    border: 1px solid #000;
                    padding: 6px 6px;
                    vertical-align: middle;
                    line-height: 1.2;
                }
                
                .print-table tbody tr:nth-child(even) td {
                    background-color: #fcfcfc !important;
                }

                .col-number { width: 5%; font-weight: bold; text-align: center; font-size: 8pt; }
                .col-titular { width: 32%; }
                .col-padres { width: 41%; font-size: 8pt; }
                .col-ref { width: 7%; font-family: 'Courier New', Courier, monospace; font-size: 9.5pt; text-align: center; font-weight: bold; }

                .text-bold { font-weight: 900; font-size: 9.5pt; color: #000; }
                .text-muted { font-size: 8.5pt; color: #333; margin-top: 2px; }

                .row-anulada td { color: #555; }
                .badge-anulada {
                    display: inline-block;
                    background-color: #000 !important;
                    color: white !important;
                    font-size: 5.5pt;
                    padding: 1px 4px;
                    border-radius: 2px;
                    font-weight: bold;
                    margin-left: 6px;
                    vertical-align: text-bottom;
                    letter-spacing: 0.5px;
                }
                
                .footer-cell {
                    border: none !important;
                    background: white !important;
                    padding-top: 15px !important;
                    text-align: right !important;
                    font-size: 7.5pt !important;
                    color: #555 !important;
                    font-style: italic;
                    font-family: 'Times New Roman', Times, serif;
                }
            `}</style>
            
            {/* MEMBRETE FIJO (SOLO APARECE AL INICIO DE LA PRIMERA PÁGINA O LIMPIO) */}
            <div className="print-header">
                <div className="print-diocese">{diocesis}</div>
                <div className="print-parish">{nombreParroquia}</div>
                <div className="print-location">{ubicacionHeader}</div>
                <div className="print-title">
                    ÍNDICE GENERAL DE BAUTISMOS {bookNumber ? `• LIBRO ${bookNumber.padStart(4, '0')}` : ''}
                </div>
            </div>

            <div className="table-wrapper">
                <table className="print-table">
                    <thead>
                        {/* 🚀 SOLO LOS TÍTULOS DE LAS COLUMNAS SE REPETIRÁN EN CADA HOJA NUEVA */}
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

                            const apellidos = safeFormat(record.apellidos || record.raw_data?.apellidos || record.lastName || '');
                            const nombres = safeFormat(record.nombres || record.raw_data?.nombres || record.firstName || '');
                            
                            const padre = safeFormat(getParentName(record, 'father'));
                            const madre = safeFormat(getParentName(record, 'mother'));
                            
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
        </div>
    );
});

BaptismIndexPrintTemplate.displayName = 'BaptismIndexPrintTemplate';
export default BaptismIndexPrintTemplate;