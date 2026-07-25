import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';

const BaptismPrintTemplate = forwardRef(({ data, parroquiaInfo }, ref) => {
  const { getParrocos } = useAppData();

  if (!data) return null;

  // 🚀 LECTURA DIRECTA
  const raw = data.raw_data || data;

  // =========================================================================
  // 🧠 RESOLUCIÓN DE DATOS INSTITUCIONALES (MEMBRETE)
  // =========================================================================
  const header = parroquiaInfo || data.parroquiaInfo || {};

  const formatData = (val) => {
    if (!val || val === '---' || String(val).trim() === '') return '---';
    return String(val).trim().toUpperCase();
  };

  const diocesis = formatData(header.diocesis || 'DIÓCESIS');
  const parroquia = formatData(header.nombre || 'PARROQUIA');
  const ciudad = formatData(header.ciudad || 'CIUDAD');
  const region = formatData(header.region || '');

  let ubicacionFinal = ciudad;
  const ciudadNorm = ciudad.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const regionNorm = region.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (region !== '---' && region !== '' && !ciudadNorm.includes(regionNorm)) {
    ubicacionFinal += `, ${region}`;
  }

  if (!ubicacionFinal.includes('COLOMBIA')) {
    ubicacionFinal += ' - COLOMBIA';
  }

  const footerParts = [];
  if (header.direccion && header.direccion !== '---') footerParts.push(formatData(header.direccion));
  if (header.telefono && header.telefono !== '---') footerParts.push(`TEL: ${formatData(header.telefono)}`);
  if (ubicacionFinal) footerParts.push(ubicacionFinal);
  const footerText = footerParts.join(' - ');
  const emailText = header.email ? header.email.toLowerCase().trim() : '';

  // =========================================================================
  // 📅 FORMATEADORES DE FECHA
  // =========================================================================
  const getFechaHoyLetras = () => {
    const date = new Date();
    const dia = date.getDate();
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const anio = date.getFullYear();

    const dias = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UN'];

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

    return `${dias[dia - 1]} DE ${meses[date.getMonth()]} DEL AÑO ${getAnioLetras(anio)}`;
  };

  const formatDateText = (dStr) => {
    try {
      if (!dStr || dStr === '---' || dStr.trim() === '') return '---';
      return convertDateToSpanishText(dStr).toUpperCase();
    } catch (e) {
      return String(dStr).toUpperCase();
    }
  };

  const getPárrocoActivo = () => {
    const pId = raw.parishId || raw.parish_id || header.entity_id || header.id;
    if (pId && getParrocos) {
      const listaSacerdotes = getParrocos(pId) || [];
      const sacerdoteActual = listaSacerdotes.find(p => String(p.estado) === '1');
      if (sacerdoteActual) return `${sacerdoteActual.nombre} ${sacerdoteActual.apellido || ''}`.trim();
    }
    return header.parroco || header.canciller || 'PÁRROCO ENCARGADO';
  };

  // =========================================================================
  // 📜 MAPEO EXACTO DE CAMPOS
  // =========================================================================
  const libro = formatData(String(raw.Libro || raw.numeroLibro || raw.book_number || '0').padStart(4, '0'));
  const folio = formatData(String(raw.folio || raw.page_number || '0').padStart(4, '0'));
  const acta = formatData(String(raw.numero || raw.numeroActa || raw.entry_number || '0').padStart(4, '0'));

  const fechaBautismo = formatDateText(raw.fechaSacramento || raw.sacramentDate);
  const nombresYApellidos = `${formatData(raw.nombres || raw.firstName)} ${formatData(raw.apellidos || raw.lastName)}`;
  const fechaNacimiento = formatDateText(raw.fechaNacimiento || raw.birthDate);
  const lugarNacimiento = formatData(raw.lugarNacimiento || raw.placeOfBirth);
  const padre = formatData(raw.nombrePadre || raw.fatherName);
  const madre = formatData(raw.nombreMadre || raw.motherName);
  const tipoUnion = formatData(raw.tipoUnionPadres || raw.tipo_union_padres || raw.parentalUnion);
  const abuelosPaternos = formatData(raw.abuelosPaternos || raw.paternalGrandparents);
  const abuelosMaternos = formatData(raw.abuelosMaternos || raw.maternalGrandparents);
  const padrinos = formatData(raw.padrinos || raw.godparents);
  const ministro = formatData(raw.ministro || raw.minister);
  const daFe = formatData(getPárrocoActivo());

  const noteTextRaw = raw.notaMarginal || raw.margin_note || raw.marginNote || '';
  let finalNote = formatData(noteTextRaw);
  if (finalNote !== '---') {
      finalNote = finalNote.replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras());
  }

  // =========================================================================
  // 🎨 DISEÑO ESTRUCTURAL: HOJA DE CUADERNO PERFECTA CON GROSORES UNIFICADOS
  // =========================================================================
  const rowHeight = 32; 

  const styles = {
    page: { 
      width: '8.5in', 
      height: '11in', 
      padding: '0.6in 0.8in', 
      color: '#000', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: 'white', 
      boxSizing: 'border-box', 
      margin: '0 auto', 
      overflow: 'hidden' 
    },
    headerInstitutional: { 
      textAlign: 'center', 
      fontWeight: 'bold', 
      fontSize: '14px', 
      marginBottom: '15px', 
      lineHeight: '1.4', 
      fontFamily: 'sans-serif' 
    },
    middleCenteringContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center', 
      width: '100%'
    },
    formBodyBox: { 
      position: 'relative', // Necesario para anclar la capa de fondo real
      border: '1.5px solid black', 
      borderBottom: 'none', // La última línea del fondo cierra la caja
      width: '100%',
      boxSizing: 'border-box'
    },
    signatureSection: { 
      marginTop: '40px', 
      textAlign: 'center', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      fontFamily: 'sans-serif' 
    },
    footer: { 
      marginTop: '15px', 
      textAlign: 'center', 
      fontSize: '10px', 
      paddingTop: '15px', 
      borderTop: '1.5px solid #eee', 
      color: '#666', 
      fontFamily: 'sans-serif' 
    }
  };

  // Componente que usa bordes reales para que no haya grosores disparejos
  const LinedRow = ({ label, value }) => (
    <div style={{ minHeight: `${rowHeight}px`, padding: '0 8px', boxSizing: 'border-box' }}>
      <span style={{ fontWeight: 'bold', fontSize: '12px', marginRight: '8px', lineHeight: `${rowHeight}px`, fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '15px', textTransform: 'uppercase', lineHeight: `${rowHeight}px`, wordBreak: 'break-word' }}>
        {value !== '---' ? value : ''}
      </span>
    </div>
  );

  return (
    <div ref={ref} style={styles.page}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: letter portrait; margin: 0; }
          body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
        }
      `}} />

      {/* 1. ENCABEZADO INSTITUCIONAL FIJO ARRIBA */}
      <div style={styles.headerInstitutional}>
        <div>{diocesis}</div>
        <div>{parroquia}</div>
        <div>{ubicacionFinal}</div>
      </div>

      {/* 2. CONTENEDOR QUE CENTRA VERTICALMENTE LA CAJA Y LA FIRMA */}
      <div style={styles.middleCenteringContainer}>
        
        {/* LA CAJA DE LA PARTIDA CON CAPAS */}
        <div style={styles.formBodyBox}>
          
          {/* 🎨 CAPA DE FONDO: LÍNEAS REALES (Soluciona el grosor desigual) */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'hidden' }}>
            {Array.from({ length: 50 }).map((_, i) => (
              <div key={`bg-line-${i}`} style={{ borderBottom: '1.5px solid black', height: `${rowHeight}px`, boxSizing: 'border-box', width: '100%' }} />
            ))}
          </div>

          {/* ✍️ CAPA FRONTAL: LOS DATOS (Flotan sobre las líneas reales) */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
            
            {/* FILA SUPERIOR: LIBRO, FOLIO, NÚMERO */}
            <div style={{ display: 'flex', minHeight: `${rowHeight}px`, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px', marginRight: '8px', lineHeight: `${rowHeight}px`, fontFamily: 'sans-serif' }}>LIBRO:</span>
                <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '15px', lineHeight: `${rowHeight}px`, width: '120px' }}>{libro !== '---' ? libro : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderLeft: '1.5px solid black' }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px', marginRight: '8px', lineHeight: `${rowHeight}px`, fontFamily: 'sans-serif' }}>FOLIO:</span>
                <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '15px', lineHeight: `${rowHeight}px`, width: '120px' }}>{folio !== '---' ? folio : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderLeft: '1.5px solid black', flex: 1 }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px', marginRight: '8px', lineHeight: `${rowHeight}px`, fontFamily: 'sans-serif' }}>NÚMERO:</span>
                <span style={{ flex: 1, fontFamily: '"Courier New", Courier, monospace', fontSize: '15px', lineHeight: `${rowHeight}px` }}>{acta !== '---' ? acta : ''}</span>
              </div>
            </div>

            {/* TÍTULO DE PARROQUIA */}
            <div style={{ display: 'flex', minHeight: `${rowHeight}px`, padding: '0 8px', boxSizing: 'border-box', alignItems: 'center' }}>
              <div style={{ backgroundColor: 'white', padding: '2px 8px 2px 0' }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'sans-serif' }}>
                  REGISTRO DE <span style={{ fontSize: '15px', fontWeight: '900' }}>BAUTISMO</span> DE LA PARROQUIA DE:
                </span>
              </div>
              <div style={{ flex: 1, fontFamily: '"Courier New", Courier, monospace', fontSize: '15px', textTransform: 'uppercase', lineHeight: `${rowHeight}px`, wordBreak: 'break-word' }}>
                {parroquia}
              </div>
            </div>
            
            <LinedRow label="FECHA DEL BAUTISMO:" value={fechaBautismo} />
            <LinedRow label="NOMBRES Y APELLIDOS:" value={nombresYApellidos} />
            <LinedRow label="NACIDO EL DÍA:" value={fechaNacimiento} />
            <LinedRow label="NACIDO EN:" value={lugarNacimiento} />
            <LinedRow label="PADRE:" value={padre} />
            <LinedRow label="MADRE:" value={madre} />
            <LinedRow label="TIPO DE UNIÓN:" value={tipoUnion} />
            <LinedRow label="ABUELOS PATERNOS:" value={abuelosPaternos} />
            <LinedRow label="ABUELOS MATERNOS:" value={abuelosMaternos} />
            <LinedRow label="PADRINOS:" value={padrinos} />
            <LinedRow label="MINISTRO:" value={ministro} />
            <LinedRow label="DOY FE:" value={daFe} />

            {/* ANOTACIONES MARGINALES */}
            <div style={{ padding: '0 8px', boxSizing: 'border-box' }}>
              <span style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '12px', marginRight: '8px', lineHeight: `${rowHeight}px`, fontFamily: 'sans-serif' }}>
                ANOTACIONES MARGINALES:
              </span>
              <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', textTransform: 'uppercase', lineHeight: `${rowHeight}px`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {finalNote !== '---' ? finalNote : ''}
              </span>
            </div>

          </div>
        </div>

        {/* FIRMA Y SELLO */}
        <div style={styles.signatureSection}>
          <div style={{ borderTop: '1.5px solid black', width: '250px', marginBottom: '5px' }}></div>
          <p style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px', fontFamily: '"Courier New", monospace' }}>
            {daFe}
          </p>
          <p style={{ fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px', fontSize: '12px' }}>
            PÁRROCO
          </p>
        </div>

      </div>

      {/* 3. PIE DE PÁGINA INSTITUCIONAL FIJO ABAJO */}
      <div style={styles.footer}>
        {footerText && <div>{footerText}</div>}
        {emailText && <div>{emailText}</div>}
      </div>
    </div>
  );
});

BaptismPrintTemplate.displayName = 'BaptismPrintTemplate';
export default BaptismPrintTemplate;