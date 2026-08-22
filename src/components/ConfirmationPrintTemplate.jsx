import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { formatPersonData } from '@/utils/formatPersonData';

const ConfirmationPrintTemplate = forwardRef((props, ref) => {
    const { user } = useAuth();
    const { getParrocos, obtenerNotasAlMargen, getMisDatosList } = useAppData() || {};
    const dataSource = props.data || props || {};

    // --- 1. EXTRACTOR DE IDENTIDAD ---
    const getSafeParishId = () => {
        if (dataSource.parishId) return dataSource.parishId;
        if (user?.parishId) return user.parishId;
        try { return JSON.parse(localStorage.getItem('user') || '{}').parishId; } catch (e) { return null; }
    };
    const safeParishId = getSafeParishId();

    // --- 2. BUSCADOR DEFINITIVO ---
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

    // --- 3. FUNCIONES DE FORMATEO Y LIMPIEZA ---
    const formatDateText = (d) => {
        try { return (!d || d === '---' || d === '') ? '---' : convertDateToSpanishText(d).toUpperCase(); } 
        catch (e) { return d ? String(d).toUpperCase() : '---'; }
    };

    const clean = (val) => {
        if (!val) return '';
        const s = String(val).toUpperCase().trim();
        return ['CIUDAD', 'DESCONOCIDA', 'UNDEFINED', 'NULL', 'N/A'].includes(s) ? '' : s;
    };

    // --- 4. PROCESAMIENTO DE MEMBRETE Y PIE ---
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

    // --- 5. DATOS DEL SACRAMENTO ---
    const libro = dataSource.numeroLibro || dataSource.libro || dataSource.book_number || dataSource.Libro || '---';
    const folio = dataSource.folio || dataSource.page_number || '---';
    const numero = dataSource.numeroActa || dataSource.numero || dataSource.entry_number || '---';

    let rawLugarConfirmacion = dataSource.lugarConfirmacion || dataSource.lugarConfirmacionDetalle || dataSource.sacramentPlace || dataSource.lugarSacramento || '';
    if (!rawLugarConfirmacion || rawLugarConfirmacion === '---') rawLugarConfirmacion = nombreParroquia;

    const lugarConfirmacion = formatPersonData(rawLugarConfirmacion);
    const fechaConfirmacion = dataSource.fechaSacramento || dataSource.fechaConfirmacion || dataSource.sacramentDate || '';
    const apellidos = formatPersonData(dataSource.apellidos || dataSource.lastName || '');
    const nombres = formatPersonData(dataSource.nombres || dataSource.firstName || '');
    const fechaNacimiento = dataSource.fechaNacimiento || dataSource.birthDate || '';

    let sexo = dataSource.sexo || dataSource.sex || '---';
    const strSex = String(sexo).toUpperCase().trim();
    if (strSex === '1' || strSex.includes('MASC') || strSex === 'M') sexo = 'MASCULINO';
    else if (strSex === '2' || strSex.includes('FEM') || strSex === 'F') sexo = 'FEMENINO';

    const padre = formatPersonData(dataSource.nombrePadre || dataSource.fatherName || dataSource.padre || '---');
    const madre = formatPersonData(dataSource.nombreMadre || dataSource.motherName || dataSource.madre || '---');
    const padrinos = formatPersonData(dataSource.padrinos || dataSource.godparents || '---');

    const lugarNacimiento = formatPersonData(dataSource.lugarNacimiento || dataSource.birthPlace || '');

    // Bautismo de Origen
    const lugarBautismo = formatPersonData(dataSource.lugarBautismo || dataSource.baptismPlace || '');
    let datosBautismo = '';
    // 🚀 CAMBIO APLICADO AQUÍ: Mostramos las palabras completas
    if (dataSource.libroBautismo || dataSource.folioBautismo || dataSource.numeroBautismo) {
        datosBautismo = `LIBRO: ${dataSource.libroBautismo || '---'}   FOLIO: ${dataSource.folioBautismo || '---'}   NÚMERO: ${dataSource.numeroBautismo || '---'}`;
    }

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

    const cleanTitle = (nameStr) => {
        if (!nameStr) return '';
        return nameStr.replace(/^(EXCMO\.?\s*|MONS\.?\s*|PBRO\.?\s*|PADRE\s*|FRAY\s*|SACERDOTE\s*)/i, '').trim();
    };

    let parrocoFirma = cleanTitle(props.parrocoNombre || nombreParrocoActivo);

    const ministroStr = resolvePriestName(dataSource.ministro || dataSource.minister || '---', false) || '---';
    let daFeStr = resolvePriestName(dataSource.daFe || dataSource.ministerFaith || dataSource.dafe || '---', true);
    if (!daFeStr || daFeStr === '---') daFeStr = parrocoFirma;

    let ministro = formatPersonData(ministroStr);
    if (ministro && ministro !== '---') {
        if (!ministro.includes('MONS') && !ministro.includes('EXCMO') && !ministro.includes('PBRO')) {
            ministro = `MONS. ${cleanTitle(ministro)}`;
        }
    }
    
    const daFe = `PBRO. ${cleanTitle(daFeStr)}`;

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
        return `${dias[dia - 1]} DE ${meses[mes - 1]} DE ${getAnioLetras(anio)}`;
    };

    // =========================================================================
    // LÓGICA DE NOTAS MARGINALES
    // =========================================================================
    const notasConfig = typeof obtenerNotasAlMargen === 'function' ? obtenerNotasAlMargen(safeParishId) : null;
    let rawMarginText = dataSource.notaMarginal || dataSource.marginNote || dataSource.notaAlMargen || dataSource.observaciones || "";

    if (!rawMarginText || String(rawMarginText).trim() === "") {
        rawMarginText = "SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.";
    } else {
        // Limpiamos textos redundantes antiguos
        rawMarginText = rawMarginText.replace(/LA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '').trim();
        rawMarginText = rawMarginText.replace(/ESTA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '').trim();
        rawMarginText = rawMarginText.replace(/SE EXPIDE EN.*/i, '').trim();
        rawMarginText = rawMarginText.replace(/ES COPIA FIEL.*/i, '').trim();
    }
    
    let finalNote = String(rawMarginText).replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras()).toUpperCase();
    if (!finalNote) finalNote = "SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.";

    const getText = (v) => (!v || v === '---') ? '---' : formatPersonData(v).toUpperCase();

    const styles = {
        page: { width: '8.5in', minHeight: '11in', padding: '0.6in 0.8in', fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', lineHeight: '1.2', color: '#000', display: 'flex', flexDirection: 'column', backgroundColor: 'white', boxSizing: 'border-box' },
        header: { textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '25px', lineHeight: '1.4', fontFamily: 'Arial, sans-serif' },
        title: { textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '10px', letterSpacing: '2px', fontFamily: 'Arial, sans-serif' },
        bookSection: { display: 'flex', borderBottom: '1.5px solid black', backgroundColor: '#f4f4f5', marginBottom: '10px', fontFamily: 'Arial, sans-serif' },
        bodySection: { display: 'flex', flexDirection: 'column' },
        signatureSection: { marginTop: '50px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', pageBreakInside: 'avoid', fontFamily: 'Arial, sans-serif' },
        footer: { marginTop: 'auto', textAlign: 'center', fontSize: '10px', paddingTop: '15px', lineHeight: '1.4', borderTop: '1px solid #eee', fontFamily: 'Arial, sans-serif' }
    };

    const LinedRow = ({ label, value }) => (
        <div style={{ display: 'flex', borderBottom: '1.5px solid #000', minHeight: '30px', boxSizing: 'border-box' }}>
            <div style={{ padding: '4px 10px', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap', borderRight: '1.5px solid #000', width: '180px', display: 'flex', alignItems: 'center', backgroundColor: '#fbfbfb', fontFamily: 'Arial, sans-serif' }}>
                {label}
            </div>
            <div style={{ padding: '4px 10px', fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center' }}>
                {value}
            </div>
        </div>
    );

    return (
        <div ref={ref} style={styles.page}>
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}} />

            <div style={styles.header}>
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>{diocesis}</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{nombreParroquia}</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{ubicacionHeader}</div>
            </div>

            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', marginBottom: '12px', lineHeight: '1.6' }}>
                El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa un acta que a la letra dice:
            </div>

            <div style={{ border: '1.5px solid black', borderRadius: '4px', width: '100%', overflow: 'hidden' }}>
                
                <div style={styles.bookSection}>
                    <div style={{ flex: 1, padding: '6px 12px', borderRight: '1.5px solid black', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px' }}>LIBRO:</span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{libro}</span>
                    </div>
                    <div style={{ flex: 1, padding: '6px 12px', borderRight: '1.5px solid black', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px' }}>FOLIO:</span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{folio}</span>
                    </div>
                    <div style={{ flex: 1, padding: '6px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px' }}>NÚMERO:</span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{numero}</span>
                    </div>
                </div>

                <div style={styles.bodySection}>
                    <LinedRow label="CONFIRMADO(A):" value={getText(nombresYApellidos)} />
                    <LinedRow label="FECHA CONFIRMACIÓN:" value={formatDateText(fechaConfirmacion)} />
                    <LinedRow label="LUGAR CONFIRMACIÓN:" value={getText(lugarConfirmacion)} />
                    <LinedRow label="FECHA NACIMIENTO:" value={formatDateText(fechaNacimiento)} />
                    {lugarNacimiento && <LinedRow label="LUGAR NACIMIENTO:" value={getText(lugarNacimiento)} />}
                    <LinedRow label="PADRE:" value={getText(padre)} />
                    <LinedRow label="MADRE:" value={getText(madre)} />
                    <LinedRow label="BAUTIZADO(A) EN:" value={getText(lugarBautismo)} />
                    {datosBautismo && <LinedRow label="DATOS BAUTISMO:" value={datosBautismo} />}
                    <LinedRow label="PADRINO O MADRINA:" value={getText(padrinos)} />
                    <LinedRow label="MINISTRO:" value={getText(ministro)} />
                    <LinedRow label="DOY FE:" value={getText(daFe)} />
                </div>

                <div style={{ padding: '8px 12px', minHeight: '60px', backgroundColor: '#fff' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif', display: 'block', marginBottom: '6px' }}>ANOTACIONES MARGINALES:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{finalNote}</span>
                </div>
            </div>

            {/* Espacio adicional solicitado por el usuario */}
            {props.incluirNotaAdicional && (
                <div style={{ marginTop: '20px', width: '100%' }}>
                    <div style={{ borderBottom: '1px solid black', width: '100%', marginBottom: '25px', marginTop: '25px' }}></div>
                    <div style={{ borderBottom: '1px solid black', width: '100%', marginBottom: '25px' }}></div>
                </div>
            )}

            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', lineHeight: '1.6', marginTop: '15px' }}>
                Es copia fiel del original. Se expide en <strong>{ciudad.toUpperCase()}</strong> el día <strong>{getFechaHoyLetras()}</strong>.
            </div>

            <div style={styles.signatureSection}>
                <div style={{ textAlign: 'center', width: '320px' }}>
                    <div style={{ borderTop: '1.5px solid black', width: '100%', marginBottom: '8px' }}></div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>PBRO. {parrocoFirma}</div>
                    <div style={{ fontSize: '12px', marginTop: '3px', textTransform: 'uppercase' }}>{props.cargo || 'PÁRROCO'}</div>
                </div>
            </div>

            <div style={styles.footer}>
                {footerText && <div>{footerText}</div>}
                {email && <div>{email}</div>}
            </div>
        </div>
    );
});

ConfirmationPrintTemplate.displayName = 'ConfirmationPrintTemplate';
export default ConfirmationPrintTemplate;