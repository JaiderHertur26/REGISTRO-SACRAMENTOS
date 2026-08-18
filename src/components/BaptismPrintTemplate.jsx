import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';

const BaptismPrintTemplate = forwardRef(({ data, parroquiaInfo }, ref) => {
  const { getParrocos } = useAppData();

  if (!data) return null;

  const raw = data.raw_data || data;
  const header = parroquiaInfo || data.parroquiaInfo || {};

  const formatData = (val) => {
    if (!val || val === '---' || String(val).trim() === '') return '';
    return String(val).trim().toUpperCase();
  };

  const diocesis = formatData(header.diocesis || 'DIÓCESIS');
  const parroquia = formatData(header.nombre || 'PARROQUIA');
  const ciudad = formatData(header.ciudad || 'CIUDAD');
  const region = formatData(header.region || '');

  let ubicacionFinal = ciudad;
  const ciudadNorm = ciudad.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const regionNorm = region.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (region && !ciudadNorm.includes(regionNorm)) {
    ubicacionFinal += `, ${region}`;
  }
  if (!ubicacionFinal.includes('COLOMBIA')) {
    ubicacionFinal += ' - COLOMBIA';
  }

  const libro = formatData(String(raw.Libro || raw.numeroLibro || '0').padStart(4, '0'));
  const folio = formatData(String(raw.folio || '0').padStart(4, '0'));
  const acta = formatData(String(raw.numero || raw.numeroActa || '0').padStart(4, '0'));

  // Formateador de Fechas Inteligente (Asegura que siempre diga "EL ...")
  const formatFecha = (dStr) => {
    if (!dStr || dStr === '---' || dStr.trim() === '') return '';
    try {
        let res = convertDateToSpanishText(dStr).toUpperCase();
        if (!res.startsWith('EL ')) res = 'EL ' + res;
        return res;
    } catch(e) {
        return String(dStr).toUpperCase();
    }
  };

  const fechaBautismo = formatFecha(raw.fechaSacramento);
  const nombresYApellidos = `${formatData(raw.nombres)} ${formatData(raw.apellidos)}`.trim();
  const fechaNacimiento = formatFecha(raw.fechaNacimiento);
  const lugarNacimiento = formatData(raw.lugarNacimiento);
  const padre = formatData(raw.nombrePadre);
  const madre = formatData(raw.nombreMadre);
  const tipoUnion = formatData(raw.tipoUnionPadres);
  const abuelosPaternos = formatData(raw.abuelosPaternos);
  const abuelosMaternos = formatData(raw.abuelosMaternos);
  const padrinos = formatData(raw.padrinos);
  
  // 🧠 Limpieza de Títulos Redundantes
  const cleanTitle = (nameStr) => nameStr.replace(/^(PBRO\.?|PADRE|FRAY|MONS\.?)\s+/i, '').trim();

  // Párroco Actual (El que firma el papel hoy en la parte inferior)
  const getPárrocoActual = () => {
    const pId = raw.parishId || raw.parish_id || header.entity_id || header.id;
    if (pId && getParrocos) {
      const listaSacerdotes = getParrocos(pId) || [];
      const sacerdoteActual = listaSacerdotes.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
      if (sacerdoteActual) return `${sacerdoteActual.nombre} ${sacerdoteActual.apellido || ''}`.trim();
    }
    return header.parroco || header.canciller || 'PÁRROCO ENCARGADO';
  };
  
  let parrocoFirma = formatData(getPárrocoActual());
  parrocoFirma = cleanTitle(parrocoFirma);

  let ministro = formatData(raw.ministro);
  if (ministro) ministro = `PBRO. ${cleanTitle(ministro)}`;

  // 🚀 INTELIGENCIA "DOY FE"
  let daFeRaw = formatData(raw.daFe);
  let daFe = '';
  if (!daFeRaw || daFeRaw.includes("ENCARGADO") || daFeRaw === "---") {
      daFe = `PBRO. ${parrocoFirma}`;
  } else {
      daFe = `PBRO. ${cleanTitle(daFeRaw)}`;
  }

  // 🧠 Limpieza Inteligente de Notas Marginales Antiguas
  const noteTextRaw = raw.notaMarginal || '';
  let finalNote = formatData(noteTextRaw);
  
  finalNote = finalNote.replace(/LA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '').trim();
  finalNote = finalNote.replace(/ESTA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '').trim();
  finalNote = finalNote.replace(/SE EXPIDE EN.*/i, '').trim();
  finalNote = finalNote.replace(/ES COPIA FIEL.*/i, '').trim();
  
  if (!finalNote || finalNote === '---') {
      finalNote = "SIN NOTAS MARGINALES DE MATRIMONIO U OTRAS HASTA LA FECHA.";
  }

  // FECHA DE EXPEDICIÓN CONVERTIDA A LETRAS PERFECTAS
  const getFechaExpedicion = () => {
    const date = new Date();
    const dia = date.getDate();
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const anio = date.getFullYear();

    const dias = ['UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UN'];
    
    const anios = {
        2024: 'DOS MIL VEINTICUATRO',
        2025: 'DOS MIL VEINTICINCO',
        2026: 'DOS MIL VEINTISÉIS',
        2027: 'DOS MIL VEINTISIETE',
        2028: 'DOS MIL VEINTIOCHO',
        2029: 'DOS MIL VEINTINUEVE',
        2030: 'DOS MIL TREINTA'
    };

    const diaLetras = dias[dia - 1] || dia;
    const anioLetras = anios[anio] || anio;

    return `${diaLetras} DE ${meses[date.getMonth()]} DE ${anioLetras}`;
  };

  const telefono = formatData(header.telefono || '');
  const email = header.email ? header.email.toLowerCase().trim() : '';

  const LinedRow = ({ label, value }) => (
      <div style={{ display: 'flex', borderBottom: '1.5px solid #000', minHeight: '30px', boxSizing: 'border-box' }}>
          <div style={{ padding: '4px 10px', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap', borderRight: '1.5px solid #000', width: '180px', display: 'flex', alignItems: 'center', backgroundColor: '#fbfbfb' }}>
              {label}
          </div>
          <div style={{ padding: '4px 10px', fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center' }}>
              {value}
          </div>
      </div>
  );

  return (
    // CANDADO DE 1 SOLA PÁGINA (height: '11in' y overflow: 'hidden')
    <div ref={ref} style={{
        width: '8.5in', height: '11in', padding: '0.6in 0.8in', color: '#000', backgroundColor: 'white', 
        boxSizing: 'border-box', margin: '0 auto', display: 'flex', flexDirection: 'column', position: 'relative',
        overflow: 'hidden'
    }}>
        <style dangerouslySetInnerHTML={{__html: `
            @media print {
                @page { size: letter portrait; margin: 0; }
                body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        `}} />

        {/* 1. ENCABEZADO INSTITUCIONAL */}
        <div style={{ textAlign: 'center', marginBottom: '20px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>{diocesis}</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{parroquia}</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{ubicacionFinal}</div>
        </div>

        {/* PREÁMBULO LEGAL */}
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', marginBottom: '12px', lineHeight: '1.6' }}>
            El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa un acta que a la letra dice:
        </div>

        {/* CAJA DE REGISTRO (DISEÑO TABULAR OFICIAL) */}
        <div style={{ border: '1.5px solid black', borderRadius: '4px', width: '100%', overflow: 'hidden' }}>
            
            <div style={{ display: 'flex', borderBottom: '1.5px solid black', backgroundColor: '#f4f4f5' }}>
                <div style={{ flex: 1, padding: '6px 12px', borderRight: '1.5px solid black', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>LIBRO:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{libro}</span>
                </div>
                <div style={{ flex: 1, padding: '6px 12px', borderRight: '1.5px solid black', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>FOLIO:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{folio}</span>
                </div>
                <div style={{ flex: 1, padding: '6px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>NÚMERO:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{acta}</span>
                </div>
            </div>

            <LinedRow label="BAUTIZADO(A):" value={nombresYApellidos} />
            <LinedRow label="FECHA DE BAUTISMO:" value={fechaBautismo} />
            <LinedRow label="FECHA DE NACIMIENTO:" value={fechaNacimiento} />
            <LinedRow label="LUGAR DE NACIMIENTO:" value={lugarNacimiento} />
            <LinedRow label="PADRE:" value={padre} />
            <LinedRow label="MADRE:" value={madre} />
            <LinedRow label="TIPO DE UNIÓN:" value={tipoUnion} />
            <LinedRow label="ABUELOS PATERNOS:" value={abuelosPaternos} />
            <LinedRow label="ABUELOS MATERNOS:" value={abuelosMaternos} />
            <LinedRow label="PADRINOS:" value={padrinos} />
            <LinedRow label="MINISTRO:" value={ministro} />
            <LinedRow label="DOY FE:" value={daFe} />

            {/* ANOTACIONES MARGINALES */}
            <div style={{ padding: '8px 12px', minHeight: '60px', backgroundColor: '#fff' }}>
                <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif', display: 'block', marginBottom: '6px' }}>ANOTACIONES MARGINALES:</span>
                <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{finalNote}</span>
            </div>
        </div>

        {/* PÁRRAFO DE CERTIFICACIÓN FINAL */}
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', lineHeight: '1.6', marginTop: '15px' }}>
            Es copia fiel del original. Se expide en <strong>{ciudad.toUpperCase()}</strong> el día <strong>{getFechaExpedicion()}</strong>.
        </div>

        {/* 5. ZONA DE FIRMAS (Centrada y empujada siempre al final) */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', fontFamily: 'Arial, sans-serif', paddingBottom: '10px', paddingTop: '80px' }}>
            
            {/* Firma del Párroco */}
            <div style={{ textAlign: 'center', width: '320px' }}>
                <div style={{ borderTop: '1.5px solid black', width: '100%', marginBottom: '8px' }}></div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>PBRO. {parrocoFirma}</div>
                <div style={{ fontSize: '12px', marginTop: '3px' }}>PÁRROCO</div>
            </div>
        </div>

        {/* 6. PIE DE PÁGINA INSTITUCIONAL (Footer) */}
        <div style={{ paddingTop: '12px', textAlign: 'center', fontSize: '10px', color: '#555', borderTop: '1.5px solid #eee', fontFamily: 'Arial, sans-serif' }}>
            {header.direccion && header.direccion !== '---' && <span>{header.direccion.toUpperCase()}</span>}
            {telefono && telefono !== '---' && <span> • TEL: {telefono}</span>}
            {email && <span> • {email}</span>}
        </div>

    </div>
  );
});

BaptismPrintTemplate.displayName = 'BaptismPrintTemplate';
export default BaptismPrintTemplate;