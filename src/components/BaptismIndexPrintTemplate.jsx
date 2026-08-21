import React, { forwardRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { formatPersonData } from '@/utils/formatPersonData';

const BaptismIndexPrintTemplate = forwardRef(({ data, parroquiaInfo, bookNumber }, ref) => {
    const { user } = useAuth();
    const { getMisDatosList } = useAppData() || {};
    const dataSource = data || [];

    // --- 1. EXTRACTOR DE IDENTIDAD (Consistencia con el resto de la App) ---
    const getSafeParishId = () => {
        if (user?.parishId) return user.parishId;
        try { return JSON.parse(localStorage.getItem('user') || '{}').parishId; } catch (e) { return null; }
    };
    const safeParishId = getSafeParishId();

    // --- 2. BUSCADOR DEFINITIVO DE MEMBRETE ---
    const getOfficialData = (field, fallback) => {
        try {
            // Si pasaron info por props, tiene prioridad
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

    // --- 3. PROCESAMIENTO DE CABECERA ---
    const diocesis = getOfficialData('diocesis', user?.dioceseName || 'DIÓCESIS').toUpperCase();
    const nombreParroquia = getOfficialData('nombre', user?.parishName || 'PARROQUIA').toUpperCase();
    const ciudad = getOfficialData('ciudad', '').toUpperCase();
    const departamento = getOfficialData('region', '').toUpperCase();
    const ubicacionHeader = [ciudad, departamento].filter(Boolean).join(', ') + ' - COLOMBIA';

    // --- 4. ORDENAMIENTO ALFABÉTICO ESTRICTO ---
    const sortedData = [...dataSource].sort((a, b) => {
        const nameA = `${a.apellidos || a.lastName || ''} ${a.nombres || a.firstName || ''}`.trim().toLowerCase();
        const nameB = `${b.apellidos || b.lastName || ''} ${b.nombres || b.firstName || ''}`.trim().toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    const formatNumber = (val) => {
        if (!val || val === '---' || val === '0' || val === 0) return '-';
        return String(val).trim().padStart(4, '0');
    };

    // --- ESTILOS ---
    const styles = {
        page: { 
            width: '8.5in', 
            minHeight: '11in',
            padding: '0.6in 0.8in', 
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', 
            color: '#000', 
            backgroundColor: 'white',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
        },
        header: { textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '25px', lineHeight: '1.4' },
        title: { 
            textAlign: 'center', 
            fontWeight: '900', 
            fontSize: '18px', 
            marginBottom: '20px', 
            letterSpacing: '2px',
            borderBottom: '2px solid #000',
            paddingBottom: '10px'
        },
        table: { width: '100%', borderCollapse: 'collapse', marginTop: '5px' },
        th: { 
            border: '1px solid #000', 
            padding: '8px 5px', 
            backgroundColor: '#f8f9fa', 
            fontWeight: 'bold', 
            textAlign: 'center', 
            fontSize: '10px',
            textTransform: 'uppercase'
        },
        td: { 
            border: '1px solid #000', 
            padding: '6px 8px', 
            fontSize: '10.5px', 
            textTransform: 'uppercase',
            lineHeight: '1.2'
        },
        tdCenter: { 
            border: '1px solid #000', 
            padding: '6px 4px', 
            fontSize: '10.5px', 
            textAlign: 'center', 
            fontWeight: '600' 
        }
    };

    return (
        <div ref={ref} style={styles.page}>
            <style media="print">{`
                @page { size: letter; margin: 0; }
                body { margin: 0; background: white; -webkit-print-color-adjust: exact; }
                table { page-break-inside: auto; width: 100% !important; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
            `}</style>
            
            <div style={styles.header}>
                <div>{diocesis}</div>
                <div>{nombreParroquia}</div>
                <div style={{ fontSize: '11px', fontWeight: 'normal' }}>{ubicacionHeader}</div>
            </div>
            
            <div style={styles.title}>
                ÍNDICE GENERAL DE BAUTISMOS {bookNumber ? `• LIBRO ${bookNumber}` : ''}
            </div>

            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={{ ...styles.th, width: '40px' }}>N°</th>
                        <th style={styles.th}>APELLIDOS Y NOMBRES</th>
                        <th style={styles.th}>PADRES / FILIACIÓN</th>
                        <th style={{ ...styles.th, width: '55px' }}>LIBRO</th>
                        <th style={{ ...styles.th, width: '55px' }}>FOLIO</th>
                        <th style={{ ...styles.th, width: '55px' }}>ACTA</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((record, index) => {
                        const apellidos = formatPersonData(record.apellidos || record.lastName || '');
                        const nombres = formatPersonData(record.nombres || record.firstName || '');
                        const padre = formatPersonData(record.nombrePadre || record.fatherName || record.padre || '---');
                        const madre = formatPersonData(record.nombreMadre || record.motherName || record.madre || '---');
                        
                        const isAnulada = record.status === 'anulada' || record.isAnnulled || record.estado === 'anulada';

                        return (
                            <tr key={record.id || index} style={{ backgroundColor: isAnulada ? '#f2f2f2' : 'transparent' }}>
                                <td style={styles.tdCenter}>{index + 1}</td>
                                <td style={{ ...styles.td, color: isAnulada ? '#888' : '#000' }}>
                                    <div style={{ fontWeight: 'bold' }}>{apellidos}</div>
                                    <div style={{ fontSize: '9.5px' }}>{nombres}</div>
                                </td>
                                <td style={{ ...styles.td, color: isAnulada ? '#888' : '#333', fontSize: '9px' }}>
                                    <div>P: {padre}</div>
                                    <div>M: {madre}</div>
                                </td>
                                <td style={styles.tdCenter}>{formatNumber(record.book_number || record.libro || record.numeroLibro)}</td>
                                <td style={styles.tdCenter}>{formatNumber(record.page_number || record.folio)}</td>
                                <td style={styles.tdCenter}>{formatNumber(record.entry_number || record.numero || record.numeroActa)}</td>
                            </tr>
                        );
                    })}
                    
                    {sortedData.length === 0 && (
                        <tr>
                            <td colSpan="6" style={{ ...styles.tdCenter, padding: '40px', color: '#999', fontStyle: 'italic' }}>
                                NO SE ENCONTRARON REGISTROS ASENTADOS PARA GENERAR EL ÍNDICE
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div style={{ marginTop: 'auto', paddingTop: '20px', textAlign: 'right', fontSize: '9px', color: '#999', fontStyle: 'italic' }}>
                Documento generado automáticamente por el Sistema SacramentumRegistry • {new Date().toLocaleDateString()}
            </div>
        </div>
    );
});

BaptismIndexPrintTemplate.displayName = 'BaptismIndexPrintTemplate';
export default BaptismIndexPrintTemplate;