import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { formatPersonData } from '@/utils/formatPersonData';

const MatrimonioPrintTemplate = forwardRef((props, ref) => {
    const { user } = useAuth();
    const { getParrocos, obtenerNotasAlMargen, getMisDatosList } = useAppData() || {};
    const dataSource = props.data || props || {};

    const getSafeParishId = () => {
        if (dataSource.parishId) return dataSource.parishId;
        if (user?.parishId) return user.parishId;
        try { return JSON.parse(localStorage.getItem('user') || '{}').parishId; } catch (e) { return null; }
    };
    const safeParishId = getSafeParishId();

    const getOfficialData = (field, fallback) => {
        try {
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
                (f === 'ciudad' ? p.ciudad : null) || (f === 'direccion' ? p.direccion : null) ||
                (f === 'telefono' ? p.telefono : null) || (f === 'region' ? p.region : null) || (f === 'email' ? p.email : null);

            if (value && String(value).trim() !== '' && String(value).toUpperCase() !== 'DESCONOCIDA') {
                return String(value).trim();
            }
        } catch (e) { console.error("Error leyendo membrete:", e); }
        return fallback;
    };

    const formatDateText = (d) => {
        try { return (!d || d === '---' || d === '') ? '---' : convertDateToSpanishText(d).toUpperCase(); } 
        catch (e) { return d ? String(d).toUpperCase() : '---'; }
    };

    const clean = (val) => {
        if (!val) return '';
        const s = String(val).toUpperCase().trim();
        return ['CIUDAD', 'DESCONOCIDA', 'UNDEFINED', 'NULL', 'N/A'].includes(s) ? '' : s;
    };

    const diocesis = getOfficialData('diocesis', user?.dioceseName || 'DIÓCESIS').toUpperCase();
    const nombreParroquia = getOfficialData('nombre', user?.parishName || 'PARROQUIA').toUpperCase();
    const ciudad = clean(getOfficialData('ciudad', ''));
    const departamento = clean(getOfficialData('region', ''));
    const direccion = clean(getOfficialData('direccion', ''));
    const telefono = clean(getOfficialData('telefono', ''));
    const email = (getOfficialData('email', '')).toLowerCase();

    const partesUbicacion = [ciudad, departamento].filter(Boolean);
    const ubicacionHeader = partesUbicacion.length > 0 ? `${partesUbicacion.join(', ')} - COLOMBIA` : 'COLOMBIA';

    const footerParts = [];
    if (direccion) footerParts.push(direccion);
    if (telefono) footerParts.push(`TEL: ${telefono}`);
    if (ubicacionHeader) footerParts.push(ubicacionHeader);
    const footerText = footerParts.join(' - ');

    // --- DATOS DEL MATRIMONIO ---
    const libro = dataSource.numeroLibro || dataSource.libro || dataSource.book_number || '---';
    const folio = dataSource.folio || dataSource.page_number || '---';
    const numero = dataSource.numeroActa || dataSource.numero || dataSource.entry_number || '---';

    let rawLugarMatrimonio = dataSource.place || dataSource.lugarMatrimonio || '';
    if (!rawLugarMatrimonio || rawLugarMatrimonio === '---') rawLugarMatrimonio = nombreParroquia;

    const lugarMatrimonio = formatPersonData(rawLugarMatrimonio);
    const fechaMatrimonio = dataSource.fechaSacramento || dataSource.sacramentDate || '';
    
    // Datos del Esposo
    const groomName = formatPersonData(dataSource.groomName || '');
    const groomSurname = formatPersonData(dataSource.groomSurname || '');
    const groomFather = formatPersonData(dataSource.groomFather || '---');
    const groomMother = formatPersonData(dataSource.groomMother || '---');

    // Datos de la Esposa
    const brideName = formatPersonData(dataSource.brideName || '');
    const brideSurname = formatPersonData(dataSource.brideSurname || '');
    const brideFather = formatPersonData(dataSource.brideFather || '---');
    const brideMother = formatPersonData(dataSource.brideMother || '---');

    const testigos = formatPersonData(dataSource.witnesses || dataSource.testigos || '---');

    const parrocos = (safeParishId && typeof getParrocos === 'function') ? getParrocos(safeParishId) : [];
    const parrocoActivo = parrocos.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
    const nombreParrocoActivo = parrocoActivo ? `${parrocoActivo.nombre || ''} ${parrocoActivo.apellido || ''}`.trim() : 'PÁRROCO ENCARGADO';
    
    const resolvePriestName = (val, isDaFe = false) => {
        if (!val || val === '---') return null;
        const str = String(val).trim();
        const found = parrocos.find(p => String(p.id) === str || String(p.idcod) === str);
        if (found) return `${found.nombre || found.nombres || ''} ${found.apellido || found.apellidos || ''}`.trim();
        if (/^\d{1,5}$/.test(str) || (str.length === 36 && str.includes('-'))) return isDaFe ? nombreParrocoActivo : '---';
        return str; 
    };

    const ministroStr = resolvePriestName(dataSource.ministro || dataSource.minister || '---', false) || '---';
    let daFeStr = resolvePriestName(dataSource.daFe || dataSource.ministerFaith || dataSource.dafe || '---', true);
    if (!daFeStr || daFeStr === '---') daFeStr = nombreParrocoActivo;

    const ministro = formatPersonData(ministroStr);
    const daFe = formatPersonData(daFeStr);

    const getFechaHoyLetras = () => {
        const date = new Date();
        const dia = date.getDate();
        const mes = date.getMonth() + 1;
        const anio = date.getFullYear();

        const dias = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UN'];
        const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

        const getAnioLetras = (year) => {
            if (year === 2000) return 'DOS MIL';
            const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
            const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
            const veintes = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
            const decenas = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
            const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

            let res = '';
            const miles = Math.floor(year / 1000);
            if (miles === 1) res += 'MIL '; else if (miles === 2) res += 'DOS MIL ';
            const restMiles = year % 1000;
            const cents = Math.floor(restMiles / 100);
            if (cents > 0) res += centenas[cents] + ' ';
            const decUnits = restMiles % 100;
            if (decUnits > 0) {
                if (decUnits < 10) res += unidades[decUnits];
                else if (decUnits < 20) res += especiales[decUnits - 10];
                else if (decUnits < 30) res += veintes[decUnits - 20];
                else {
                    const d = Math.floor(decUnits / 10);
                    const u = decUnits % 10;
                    res += decenas[d];
                    if (u > 0) res += ' Y ' + unidades[u];
                }
            }
            return res.trim();
        };
        return `${dias[dia - 1]} DE ${meses[mes - 1]} DEL AÑO ${getAnioLetras(anio)}`;
    };

    // =========================================================================
    // LÓGICA LIMPIA (CONEXIÓN DIRECTA)
    // =========================================================================
    const notasConfig = typeof obtenerNotasAlMargen === 'function' ? obtenerNotasAlMargen(safeParishId) : null;
    let rawMarginText = dataSource.notaMarginal || dataSource.marginNote || dataSource.notaAlMargen || dataSource.observaciones || "";

    if (!rawMarginText || String(rawMarginText).trim() === "") {
        rawMarginText = notasConfig?.estandar || "LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
    }
    
    const finalNote = String(rawMarginText).replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras()).toUpperCase();
    // =========================================================================

    const getText = (v) => (!v || v === '---') ? '---' : formatPersonData(v).toUpperCase();

    const styles = {
        page: { width: '8.5in', minHeight: '11in', padding: '0.6in 0.8in', fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', lineHeight: '1.2', color: '#000', display: 'flex', flexDirection: 'column', backgroundColor: 'white', boxSizing: 'border-box' },
        header: { textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '25px', lineHeight: '1.4' },
        title: { textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '10px', letterSpacing: '2px' },
        bookSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontWeight: 'bold', marginBottom: '25px', fontSize: '14px' },
        bodySection: { paddingLeft: '0.2in', display: 'flex', flexDirection: 'column' },
        sectionTitle: { fontWeight: 'bold', marginTop: '10px', marginBottom: '5px', fontSize: '13px' },
        signatureSection: { marginTop: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', pageBreakInside: 'avoid' },
        footer: { marginTop: 'auto', textAlign: 'center', fontSize: '10px', paddingTop: '15px', lineHeight: '1.4', borderTop: '1px solid #eee' }
    };

    const Row = ({ label, value }) => (
        <div style={{ display: 'flex', marginBottom: '6px' }}>
            <span style={{ whiteSpace: 'pre' }}>{label.padEnd(18, '.')}: </span>
            <span style={{ marginLeft: '4px' }}>{String(value || '').toUpperCase()}</span>
        </div>
    );

    return (
        <div ref={ref} style={styles.page}>
            <style media="print">{`@page { size: letter; margin: 0; } body { margin: 0; background: white; -webkit-print-color-adjust: exact; }`}</style>
            <div style={styles.header}>
                <div>{diocesis}</div>
                <div>{nombreParroquia}</div>
                <div>{ubicacionHeader}</div>
            </div>
            <div style={styles.title}>PARTIDA DE MATRIMONIO</div>
            <div style={styles.bookSection}>
                <div style={{ textAlign: 'left', whiteSpace: 'pre' }}>
                    <div>LIBRO.............: {String(libro).padStart(4, '0')}</div>
                    <div>FOLIO.............: {String(folio).padStart(4, '0')}</div>
                    <div>NUMERO............: {String(numero).padStart(4, '0')}</div>
                </div>
            </div>
            
            <div style={styles.bodySection}>
                <Row label="LUGAR SACRAMENTO" value={getText(lugarMatrimonio)} />
                <Row label="FECHA SACRAMENTO" value={formatDateText(fechaMatrimonio)} />

                <div style={styles.sectionTitle}>EL ESPOSO:</div>
                <Row label="NOMBRES" value={getText(groomName)} />
                <Row label="APELLIDOS" value={getText(groomSurname)} />
                <Row label="PADRE" value={getText(groomFather)} />
                <Row label="MADRE" value={getText(groomMother)} />

                <div style={styles.sectionTitle}>LA ESPOSA:</div>
                <Row label="NOMBRES" value={getText(brideName)} />
                <Row label="APELLIDOS" value={getText(brideSurname)} />
                <Row label="PADRE" value={getText(brideFather)} />
                <Row label="MADRE" value={getText(brideMother)} />

                <div style={{ marginTop: '10px' }}></div>
                <Row label="TESTIGOS" value={getText(testigos)} />
                <Row label="MINISTRO" value={getText(ministro)} />
                <Row label="DA FE" value={getText(daFe)} />
            </div>

            {finalNote && (
                <div style={{ marginTop: '20px' }}>
                    <div style={{ textAlign: 'center', fontSize: '13px', marginBottom: '8px' }}>- - - - NOTA AL MARGEN - - - -</div>
                    <div style={{ textAlign: 'justify', fontSize: '12px', lineHeight: '1.4', textTransform: 'uppercase' }}>{finalNote}</div>
                </div>
            )}

            <div style={styles.signatureSection}>
                <p className="font-bold uppercase mb-1" style={{ fontSize: '11pt' }}>{daFe.toUpperCase()}</p>
                <div style={{ borderTop: '1px solid black', width: '250px' }}></div>
                <p className="font-bold uppercase mt-1" style={{ fontSize: '10pt' }}>PÁRROCO</p>
            </div>
            
            <div style={styles.footer}>
                {footerText && <div>{footerText}</div>}
                {email && <div>{email}</div>}
            </div>
        </div>
    );
});

MatrimonioPrintTemplate.displayName = 'MatrimonioPrintTemplate';
export default MatrimonioPrintTemplate;