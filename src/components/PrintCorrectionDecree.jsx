import React, { forwardRef, useState, useEffect } from 'react';
import { convertDateToSpanishTextNatural } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient'; 

const PrintCorrectionDecree = forwardRef(({ decreeData }, ref) => {
  const { getParrocos, getMisDatosList } = useAppData();
  const { user: authUser } = useAuth(); 

  const [chanceryData, setChanceryData] = useState({});
  const [targetParishInfo, setTargetParishInfo] = useState({ name: '', city: '', priest: '' });

  useEffect(() => {
      let isMounted = true;

      const fetchDataFromCloud = async () => {
          try {
              let chanceryIdToUse = authUser?.chanceryId || authUser?.chancery_id;

              if (!chanceryIdToUse) {
                  let dioceseId = authUser?.dioceseId || authUser?.diocese_id;
                  if (!dioceseId && authUser?.parishId) {
                      const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', authUser.parishId).single();
                      if (pData) dioceseId = pData.diocese_id;
                  }
                  if (dioceseId) {
                      const { data: chanceryRecord } = await supabase.from('chancelleries').select('id').eq('diocese_id', dioceseId).maybeSingle();
                      if (chanceryRecord) chanceryIdToUse = chanceryRecord.id;
                  }
              }

              if (chanceryIdToUse) {
                  const { data: misDatosCancilleria } = await supabase.from('mis_datos').select('payload').eq('entity_id', chanceryIdToUse).maybeSingle();
                  if (misDatosCancilleria && misDatosCancilleria.payload && isMounted) {
                      let p = misDatosCancilleria.payload;
                      if (typeof p === 'string') p = JSON.parse(p);
                      if (Array.isArray(p)) p = p[0];
                      setChanceryData(p || {});
                  }
              }

              let pId = decreeData?.targetParishId || decreeData?.parish_id || authUser?.parishId;

              if (pId) {
                  const { data: parishMisDatos } = await supabase.from('mis_datos').select('payload').eq('entity_id', pId).maybeSingle();
                  let pName = ''; let pCity = '';
                  if (parishMisDatos && parishMisDatos.payload) {
                      let p = parishMisDatos.payload;
                      if (typeof p === 'string') p = JSON.parse(p);
                      if (Array.isArray(p)) p = p[0]; p = p || {};
                      pName = p.nombre || ''; pCity = p.ciudad || '';
                  }

                  const { data: parrocosData } = await supabase.from('parrocos').select('payload').eq('parish_id', pId);
                  let pPriest = '';
                  if (parrocosData && parrocosData.length > 0) {
                      const activePriestRow = parrocosData.find(row => {
                          let p = row.payload; if (typeof p === 'string') p = JSON.parse(p);
                          return String(p.estado) === '1' || String(p.Estado) === '1';
                      });
                      if (activePriestRow) {
                          let p = activePriestRow.payload; if (typeof p === 'string') p = JSON.parse(p);
                          pPriest = `${p.nombre || p.nombres || ''} ${p.apellido || p.apellidos || ''}`.trim();
                      }
                  }

                  if (isMounted) setTargetParishInfo({ name: pName.toUpperCase(), city: pCity.toUpperCase(), priest: pPriest.toUpperCase() });
              }
          } catch (err) { console.error("Error buscando datos en Supabase:", err); }
      };

      if (decreeData) fetchDataFromCloud();
      return () => { isMounted = false; };
  }, [authUser, decreeData]);

  if (!decreeData) return null;

  const {
    decreeNumber, decreeDate, parroquia, 
    baptismData = {}, originalPartidaSummary = {}, newPartidaSummary = {}, newData = {},
    isMasterCopy, targetParishName, nombreSacerdoteDestino, observaciones 
  } = decreeData;

  const misDatosList = authUser?.parishId ? getMisDatosList(authUser.parishId) : [];
  const misDatosParroquia = misDatosList[0] || {}; 

  const orgData = {
    name: chanceryData.nombreCancilleria || chanceryData.nombre || 'CURIA ARZOBISPAL - CANCILLERÍA',
    address: chanceryData.direccion || '[Dirección no configurada]',
    phone: chanceryData.telefono || '[Teléfono no configurado]',
    city: chanceryData.ciudad || 'BARRANQUILLA',
    email: chanceryData.email || '[Email no configurado]'
  };

  const cancillerName = chanceryData.canciller || chanceryData.parroco || 'CANCILLER DIOCESANO';
  const cancillerCargo = chanceryData.cargo || 'CANCILLER DIOCESANO';

  let finalTargetParishName = targetParishInfo.name || '[NOMBRE PARROQUIA]';
  let finalTargetCity = targetParishInfo.city || 'BARRANQUILLA';
  let nombreDaFeFinal = targetParishInfo.priest || 'PÁRROCO ENCARGADO';

  if (!targetParishInfo.name) {
      if (isMasterCopy && targetParishName) {
          const parts = targetParishName.split('-');
          finalTargetParishName = parts[0]?.trim() || finalTargetParishName;
          finalTargetCity = parts[1]?.trim() || finalTargetCity;
          nombreDaFeFinal = nombreSacerdoteDestino || nombreDaFeFinal;
      } else {
          const [parishNameFromDecree, parishCityFromDecree] = (parroquia || '').split('-').map(s => s.trim());
          finalTargetParishName = parishNameFromDecree || misDatosParroquia.nombre || authUser?.parishName || finalTargetParishName;
          finalTargetCity = parishCityFromDecree || misDatosParroquia.ciudad || finalTargetCity;
          
          const parrocos = (authUser?.parishId && typeof getParrocos === 'function') ? getParrocos(authUser.parishId) : [];
          const parrocoActivo = parrocos.find(p => String(p.estado || p.Estado || '').toUpperCase() === '1');
          if (parrocoActivo) nombreDaFeFinal = `${parrocoActivo.nombre || ''} ${parrocoActivo.apellido || ''}`.trim();
      }
  }

  const getVal = (key) => newPartidaSummary[key] || decreeData[key] || newData[key] || baptismData[key] || '';

  const oldName = (decreeData.targetName || `${originalPartidaSummary.nombres || originalPartidaSummary.firstName || ''} ${originalPartidaSummary.apellidos || originalPartidaSummary.lastName || ''}`).trim().toUpperCase() || '---';
  const oldBook = String(originalPartidaSummary.book || originalPartidaSummary.book_number || originalPartidaSummary.Libro || '---').padStart(4, '0');
  const oldPage = String(originalPartidaSummary.page || originalPartidaSummary.page_number || originalPartidaSummary.folio || '---').padStart(4, '0');
  const oldEntry = String(originalPartidaSummary.entry || originalPartidaSummary.entry_number || originalPartidaSummary.numero || '---').padStart(4, '0');

  const newBook = String(newPartidaSummary.book || newPartidaSummary.book_number || newPartidaSummary.Libro || '---').padStart(4, '0');
  const newPage = String(newPartidaSummary.page || newPartidaSummary.page_number || newPartidaSummary.folio || '---').padStart(4, '0');
  const newEntry = String(newPartidaSummary.entry || newPartidaSummary.entry_number || newPartidaSummary.numero || '---').padStart(4, '0');

  const baptismRecord = {
    fechaSacramento: getVal('fechaSacramento'), 
    nombres: getVal('nombres') || getVal('firstName'),
    apellidos: getVal('apellidos') || getVal('lastName'),
    fechaNacimiento: getVal('fechaNacimiento') || getVal('birthDate'), 
    lugarNacimiento: getVal('lugarNacimiento'), 
    nombrePadre: getVal('nombrePadre') || getVal('fatherName'),
    nombreMadre: getVal('nombreMadre') || getVal('motherName'),
    tipoUnionPadresRaw: getVal('tipoUnionPadres'),
    sexoRaw: getVal('sexo'),
    abuelosPaternos: getVal('abuelosPaternos'),
    abuelosMaternos: getVal('abuelosMaternos'),
    padrinos: getVal('padrinos'),
    ministro: getVal('ministro'),
    // 🚀 LA MAGIA ESTÁ AQUÍ: Lee el DA FE inyectado por el importador masivo
    daFe: getVal('daFe') || getVal('dafe') || getVal('ministerFaith') || nombreDaFeFinal
  };

  const unionTypeMap = { '1': 'Matrimonio Católico', '2': 'Matrimonio Civil', '3': 'Unión Libre', '4': 'Madre Soltera', '5': 'Otro' };
  baptismRecord.tipoUnionPadres = unionTypeMap[String(baptismRecord.tipoUnionPadresRaw)] || baptismRecord.tipoUnionPadresRaw || 'Otro';
  baptismRecord.sexo = (String(baptismRecord.sexoRaw) === '1' || String(baptismRecord.sexoRaw).toUpperCase() === 'MASCULINO' || String(baptismRecord.sexoRaw).toUpperCase() === 'M') ? 'Masculino' : 'Femenino';
  
  const formattedDate = decreeDate ? convertDateToSpanishTextNatural(decreeDate) : '---';

  const DataRow = ({ label, value, bold }) => (
    <div className="flex items-end mb-[2px]">
      <span className="font-semibold text-black uppercase tracking-wider text-[8pt] w-36 shrink-0">{label}:</span>
      <span className={`font-mono flex-1 border-b border-dotted border-gray-500 pl-2 uppercase text-[8.5pt] leading-tight text-black ${bold ? 'font-bold' : ''}`}>
        {value || '\u00A0'}
      </span>
    </div>
  );

  return (
    <div id="printable-content" ref={ref} className="bg-white text-black font-serif mx-auto box-border flex flex-col justify-between p-8 min-h-[279.4mm] w-[215.9mm] shadow-xl print:shadow-none print:p-0 print:m-0 print:w-[215.9mm] print:h-[279.4mm] print:overflow-hidden">
      <style>{`
        @media print {
          @page { margin: 0; size: letter; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          body * { visibility: hidden; }
          #printable-content, #printable-content * { visibility: visible; }
          #printable-content { position: absolute; left: 0; top: 0; width: 215.9mm; height: 279.4mm; padding: 10mm 15mm !important; box-sizing: border-box; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
        }
      `}</style>

      <div className="w-full flex-1 flex flex-col">
          <div className="text-center mb-3 relative border-b border-black pb-2 shrink-0">
            <h1 className="text-[12pt] font-extrabold uppercase tracking-widest mb-0.5 text-black">Arquidiócesis de Barranquilla</h1>
            <h2 className="text-[9pt] font-semibold uppercase tracking-widest text-black">Oficina de Cancillería</h2>
            <div className="mt-2 inline-block border-2 border-black px-3 py-1 bg-gray-50 print:bg-gray-100">
               <span className="font-bold uppercase tracking-wider text-[10pt] text-black">Decreto de Corrección de Partida</span>
            </div>
            <div className="absolute right-0 top-0 text-[6pt] font-mono text-black font-bold text-right leading-tight">
              CÓDIGO: CAL-ODC-021<br/>VERSIÓN: 001
            </div>
          </div>

          <div className="flex justify-between items-end mb-3 shrink-0">
            <div className="w-2/3 text-justify text-[9.5pt] pr-4 text-black">
               <p>Al Señor Cura Párroco de la Parroquia <strong>{finalTargetParishName}</strong>, de <span className="uppercase font-semibold">{finalTargetCity}</span>.</p>
            </div>
            <div className="w-1/3 text-right border-2 border-black p-1.5 bg-gray-50 print:bg-gray-100">
              <div className="font-bold text-[6.5pt] uppercase tracking-widest text-black">Decreto Número</div>
              <div className="font-mono text-lg font-bold tracking-wider text-black leading-none my-1">{decreeNumber || '---'}</div>
              <div className="font-bold text-[6.5pt] uppercase tracking-widest text-black border-t border-black pt-0.5">Fecha de Emisión</div>
              <div className="font-mono text-[7.5pt] uppercase font-semibold text-black">{formattedDate}</div>
            </div>
          </div>

          <div className="mb-2 text-[9pt] text-black shrink-0">
            <p className="text-justify leading-snug">
              Por el presente documento, el Gobierno de la Arquidiócesis ordena y autoriza la anulación de la Partida de BAUTISMO correspondiente a:
            </p>
            <div className="text-center mt-1">
                <span className="font-bold text-[11pt] text-red-700 print:text-black uppercase tracking-wider border-b border-black inline-block min-w-[70%] pb-0.5">{oldName}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-2 border border-black pb-1.5 pt-1.5 bg-gray-50 print:bg-gray-100 p-1.5 rounded shrink-0">
              <div className="text-center"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Libro a Anular</span><span className="font-mono font-bold text-[10pt] text-black">{oldBook}</span></div>
              <div className="text-center border-l border-r border-black"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Folio a Anular</span><span className="font-mono font-bold text-[10pt] text-black">{oldPage}</span></div>
              <div className="text-center"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Número a Anular</span><span className="font-mono font-bold text-[10pt] text-black">{oldEntry}</span></div>
            </div>
          </div>

          <div className="mb-2 border-t-2 border-black pt-2 relative mt-2 flex-1 flex flex-col">
            <div className="text-center font-bold text-[8pt] tracking-widest uppercase text-black mb-2">
              Detalles Corregidos a Asentar en el Libro Supletorio
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-2 border border-black pb-1.5 pt-1.5 bg-white p-1.5 rounded shrink-0">
              <div className="text-center"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Libro Nuevo</span><span className="font-mono font-bold text-[10pt] text-black">{newBook}</span></div>
              <div className="text-center border-l border-r border-black"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Folio Nuevo</span><span className="font-mono font-bold text-[10pt] text-black">{newPage}</span></div>
              <div className="text-center"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Número Nuevo</span><span className="font-mono font-bold text-[10pt] text-black">{newEntry}</span></div>
            </div>

            <div className="flex flex-col flex-1 justify-between pt-1">
              <DataRow label="Fecha de Bautismo" value={baptismRecord.fechaSacramento} />
              <DataRow label="Nombres" value={baptismRecord.nombres} bold />
              <DataRow label="Apellidos" value={baptismRecord.apellidos} bold />
              <DataRow label="Fecha Nacimiento" value={baptismRecord.fechaNacimiento} />
              <DataRow label="Lugar Nacimiento" value={baptismRecord.lugarNacimiento} />
              <DataRow label="Padre" value={baptismRecord.nombrePadre} />
              <DataRow label="Madre" value={baptismRecord.nombreMadre} />
              <div className="flex w-full">
                <div className="w-[55%] flex items-end pr-1">
                    <span className="font-semibold text-black uppercase tracking-wider text-[8pt] w-36 shrink-0">Tipo de Unión:</span>
                    <span className="font-mono flex-1 border-b border-dotted border-gray-500 pl-1 uppercase text-[8.5pt] text-black">{baptismRecord.tipoUnionPadres}</span>
                </div>
                <div className="w-[45%] flex items-end pl-1">
                    <span className="font-semibold text-black uppercase tracking-wider text-[8pt] w-12 shrink-0">Sexo:</span>
                    <span className="font-mono flex-1 border-b border-dotted border-gray-500 pl-1 uppercase text-[8.5pt] text-black">{baptismRecord.sexo}</span>
                </div>
              </div>
              <DataRow label="Abuelos Paternos" value={baptismRecord.abuelosPaternos} />
              <DataRow label="Abuelos Maternos" value={baptismRecord.abuelosMaternos} />
              <DataRow label="Padrinos" value={baptismRecord.padrinos} />
              <DataRow label="Ministro" value={baptismRecord.ministro} />
              <DataRow label="Da Fe" value={baptismRecord.daFe} />
            </div>
          </div>

          <div className="mb-2 relative border border-black p-2 bg-gray-50 print:bg-gray-100 mt-2 shrink-0">
             <div className="absolute -top-2.5 left-4 bg-gray-50 print:bg-gray-100 px-2 font-bold text-[7pt] tracking-widest uppercase border border-black border-b-0 text-black">
              Disposición y Nota Marginal
            </div>
            
            <p className="font-mono text-[8pt] leading-tight text-justify mt-1 text-black font-semibold uppercase">
              ANULADA POR DECRETO NO. {decreeNumber || '___'} DE FECHA {decreeDate || '___'}. PASA AL LIBRO SUPLETORIO: LIBRO {newBook}, FOLIO {newPage}, NÚMERO {newEntry}.
            </p>

            {observaciones && (
              <p className="font-mono text-[8pt] leading-tight text-justify mt-1.5 text-black font-bold uppercase border-t border-gray-400 border-dashed pt-1.5">
                 OBSERVACIÓN: {observaciones}
              </p>
            )}
          </div>

          <p className="text-[7pt] text-black text-justify px-2 leading-tight shrink-0">
            <strong>NOTA IMPORTANTE:</strong> Favor confirmar el recibo del decreto al correo oficial: <strong>{orgData.email}</strong>. El despacho parroquial deberá tener el cuidado de asentar al margen del libro original la anotación correspondiente.
          </p>
      </div>

      <div className="w-full shrink-0 pt-2">
          <div className="flex justify-between items-end px-12 mb-3">
            <div className="text-center w-5/12">
              <div className="border-t border-black pt-1 font-bold uppercase text-[8pt] tracking-wide text-black">
                {cancillerName}
              </div>
              <div className="text-[6.5pt] font-bold text-black uppercase tracking-widest mt-0.5">
                 {cancillerCargo}
              </div>
            </div>
            <div className="text-center w-1/3">
              <div className="h-20 w-20 border-2 border-dotted border-black rounded-full mx-auto flex items-center justify-center text-black text-[8px] font-bold uppercase tracking-widest text-center leading-tight p-1">
                Sello<br/>Cancillería
              </div>
            </div>
          </div>

          <div className="w-full text-center text-[7pt] text-black border-t border-black pt-1.5">
            <p className="font-extrabold uppercase tracking-widest mb-0.5">{orgData.name}</p>
            <p className="font-medium">{orgData.address} • Tel: {orgData.phone} • {orgData.city}, COLOMBIA</p>
            <p className="font-medium">{orgData.website ? `${orgData.website} • ` : ''}{orgData.email !== '[Email no configurado]' ? `E-mail: ${orgData.email}` : ''}</p>
          </div>
      </div>
    </div>
  );
});

PrintCorrectionDecree.displayName = 'PrintCorrectionDecree';
export default PrintCorrectionDecree;