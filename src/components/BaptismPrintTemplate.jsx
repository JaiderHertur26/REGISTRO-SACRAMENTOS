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

  const fechaBautismo = convertDateToSpanishText(raw.fechaSacramento).toUpperCase();
  const nombresYApellidos = `${formatData(raw.nombres)} ${formatData(raw.apellidos)}`;
  const fechaNacimiento = convertDateToSpanishText(raw.fechaNacimiento).toUpperCase();
  const lugarNacimiento = formatData(raw.lugarNacimiento);
  const padre = formatData(raw.nombrePadre);
  const madre = formatData(raw.nombreMadre);
  const tipoUnion = formatData(raw.tipoUnionPadres);
  const abuelosPaternos = formatData(raw.abuelosPaternos);
  const abuelosMaternos = formatData(raw.abuelosMaternos);
  const padrinos = formatData(raw.padrinos);
  const ministro = formatData(raw.ministro);
  const daFe = formatData(raw.daFe);

  // 🧠 Limpieza Inteligente de Notas Marginales Antiguas
  const noteTextRaw = raw.notaMarginal || '';
  let finalNote = formatData(noteTextRaw);
  
  // Si la base de datos trae pegada la certificación antigua por error, la podamos para no duplicar textos.
  finalNote = finalNote.replace(/LA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '').trim();
  finalNote = finalNote.replace(/SE EXPIDE EN.*/i, '').trim();
  
  if (!finalNote || finalNote === '---') {
      finalNote = "SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.";
  }

  // Párroco Actual (El que firma el papel hoy)
  const getPárrocoActual = () => {
    const pId = raw.parishId || raw.parish_id || header.entity_id || header.id;
    if (pId && getParrocos) {
      const listaSacerdotes = getParrocos(pId) || [];
      const sacerdoteActual = listaSacerdotes.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
      if (sacerdoteActual) return `${sacerdoteActual.nombre} ${sacerdoteActual.apellido || ''}`.trim();
    }
    return header.parroco || header.canciller || 'PÁRROCO ENCARGADO';
  };
  const parrocoFirma = formatData(getPárrocoActual());

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

  return (
    <div ref={ref} style={{
        width: '8.5in', minHeight: '11in', padding: '0.8in', color: '#000', backgroundColor: 'white', 
        boxSizing: 'border-box', margin: '0 auto', display: 'flex', flexDirection: 'column', position: 'relative'
    }}>
        {/* ESTILOS DE IMPRESIÓN (SIN FONDOS ABSOLUTOS QUE ROMPAN TEXTO) */}
        <style dangerouslySetInnerHTML={{__html: `
            @media print {
                @page { size: letter portrait; margin: 0; }
                body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            .lined-row {
                display: flex;
                align-items: flex-start;
                border-bottom: 1.5px solid black;
                padding: 6px 8px;
                min-height: 30px;
                box-sizing: border-box;
                page-break-inside: avoid;
            }
            .lined-label {
                font-weight: bold;
                font-size: 12px;
                font-family: Arial, sans-serif;
                margin-right: 8px;
                white-space: nowrap;
                flex-shrink: 0;
                padding-top: 2px;
            }
            .lined-value {
                font-family: "Courier New", Courier, monospace;
                font-size: 14px;
                font-weight: bold;
                text-transform: uppercase;
                word-break: break-word;
                padding-top: 1px;
            }
        `}} />

        {/* 1. ENCABEZADO INSTITUCIONAL */}
        <div style={{ textAlign: 'center', marginBottom: '30px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{diocesis}</div>
            <div style={{ fontSize: '18px', fontWeight: '900', marginTop: '4px' }}>{parroquia}</div>
            <div style={{ fontSize: '12px', marginTop: '2px', color: '#333' }}>{ubicacionFinal}</div>
        </div>

        {/* 2. PREÁMBULO LEGAL */}
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', marginBottom: '15px', lineHeight: '1.6' }}>
            El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa un acta que a la letra dice:
        </div>

        {/* 3. CAJA DE REGISTRO (HOJA DE CUADERNO FLEXIBLE Y DINÁMICA) */}
        <div style={{ border: '1.5px solid black', borderBottom: 'none', width: '100%', marginBottom: '20px' }}>
            
            {/* FILA DE UBICACIÓN */}
            <div style={{ display: 'flex', borderBottom: '1.5px solid black', backgroundColor: '#f9f9f9' }}>
                <div style={{ flex: 1, padding: '6px 8px', borderRight: '1.5px solid black', display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>LIBRO:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{libro}</span>
                </div>
                <div style={{ flex: 1, padding: '6px 8px', borderRight: '1.5px solid black', display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>FOLIO:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{folio}</span>
                </div>
                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>NÚMERO:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{acta}</span>
                </div>
            </div>

            <div className="lined-row">
                <span className="lined-label">BAUTIZADO(A):</span>
                <span className="lined-value">{nombresYApellidos}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">FECHA DE BAUTISMO:</span>
                <span className="lined-value">{fechaBautismo}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">FECHA DE NACIMIENTO:</span>
                <span className="lined-value">{fechaNacimiento}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">LUGAR DE NACIMIENTO:</span>
                <span className="lined-value">{lugarNacimiento}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">PADRE:</span>
                <span className="lined-value">{padre}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">MADRE:</span>
                <span className="lined-value">{madre}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">TIPO DE UNIÓN:</span>
                <span className="lined-value">{tipoUnion}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">ABUELOS PATERNOS:</span>
                <span className="lined-value">{abuelosPaternos}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">ABUELOS MATERNOS:</span>
                <span className="lined-value">{abuelosMaternos}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">PADRINOS:</span>
                <span className="lined-value">{padrinos}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">MINISTRO:</span>
                <span className="lined-value">{ministro}</span>
            </div>
            <div className="lined-row">
                <span className="lined-label">PÁRROCO QUE DA FE:</span>
                <span className="lined-value">{daFe}</span>
            </div>

            {/* ANOTACIONES MARGINALES (Caja expandible natural) */}
            <div style={{ borderBottom: '1.5px solid black', padding: '10px 8px', minHeight: '60px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'Arial, sans-serif', display: 'block', marginBottom: '6px' }}>ANOTACIONES MARGINALES:</span>
                <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{finalNote}</span>
            </div>
        </div>

        {/* 4. PÁRRAFO DE CERTIFICACIÓN FINAL */}
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', lineHeight: '1.6', marginTop: '10px' }}>
            LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN <strong>{ciudad.toUpperCase()}</strong> EL DÍA <strong>{getFechaExpedicion()}</strong>.
        </div>

        {/* 5. ZONA DE FIRMAS Y SELLOS */}
        <div style={{ marginTop: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontFamily: 'Arial, sans-serif' }}>
            
            {/* Sello Físico */}
            <div style={{ width: '110px', height: '110px', border: '1.5px dashed #ccc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyItems: 'center', color: '#ccc', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                <span style={{margin: 'auto'}}>SELLO<br/>PARROQUIAL</span>
            </div>

            {/* Firma del Párroco */}
            <div style={{ textAlign: 'center', width: '280px' }}>
                <div style={{ borderTop: '1.5px solid black', width: '100%', marginBottom: '6px' }}></div>
                <div style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>PBRO. {parrocoFirma}</div>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>PÁRROCO</div>
            </div>
        </div>

        {/* 6. PIE DE PÁGINA INSTITUCIONAL (Footer) */}
        <div style={{ marginTop: 'auto', paddingTop: '15px', textAlign: 'center', fontSize: '10px', color: '#555', borderTop: '1.5px solid #eee', fontFamily: 'Arial, sans-serif' }}>
            {header.direccion && header.direccion !== '---' && <span>{header.direccion.toUpperCase()}</span>}
            {telefono && telefono !== '---' && <span> • TEL: {telefono}</span>}
            {email && <span> • {email}</span>}
        </div>

    </div>
  );
});

BaptismPrintTemplate.displayName = 'BaptismPrintTemplate';
export default BaptismPrintTemplate;