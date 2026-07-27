import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import * as ParamsHelper from '@/utils/sacramentSettingsHelpers';
import * as AuxCRUDHelper from '@/utils/auxiliaryCrudHelpers';
import { separateNewAndDuplicateBaptisms } from '@/utils/baptismJsonMapper';

// ============================================================================
// 1. HELPERS INTERNOS
// ============================================================================
const getNombreSacerdote = (parishId) => {
    if (!parishId) return 'PÁRROCO ENCARGADO';
    const lista = AuxCRUDHelper.getObispos(parishId) || [];
    const actual = lista.find(p => String(p.estado) === "1" || String(p.estado).toUpperCase() === 'ACTIVO');
    return actual ? `${actual.nombre || ''} ${actual.apellido || ''}`.trim().toUpperCase() : 'PÁRROCO ENCARGADO';
};

// ============================================================================
// 2. LECTURA Y PURIFICACIÓN DE BAUTISMOS
// ============================================================================
export const getBaptisms = (parishId) => {
    if (!parishId) return [];
    try {
        const raw = localStorage.getItem(`baptisms_${parishId}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(b => b && b.id && (b.nombres || b.firstName || b.apellidos || b.lastName));
    } catch (error) { return []; }
};

export const getConfirmedBaptisms = (parishId) => getBaptisms(parishId).filter(b => b.status === 'confirmed' || b.status === 'seated');

export const getPendingBaptisms = async (parishId) => {
    if (!parishId) return [];
    try {
        const raw = localStorage.getItem(`pendingBaptisms_${parishId}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(b => b && b.id && (b.nombres || b.firstName || b.apellidos || b.lastName));
    } catch (error) { return []; }
};

export const validateBaptismNumbers = async (libro, folio, numero, parishId) => {
    const list = getBaptisms(parishId);
    const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
    if (exists) return { valid: false, message: "Ya existe un registro con esta numeración." };
    return { valid: true };
};

export const purificarRegistroBautismo = (raw, parishId) => {
    if (!raw) return null;
    const config = ParamsHelper.obtenerNotasAlMargen(parishId) || {};
    
    const identityId = raw.tipoIdentidad || raw.identityId || 'id_estandar';
    let notaCalculada = "";
    switch (identityId) {
        case 'id_anulada_correccion': notaCalculada = config.porCorreccion?.anulada || "ANULADA POR CORRECCIÓN."; break;
        case 'id_creada_correccion': notaCalculada = config.porCorreccion?.nuevaPartida || "CREADA POR CORRECCIÓN."; break;
        case 'id_creada_reposicion': notaCalculada = config.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || "CREADA POR REPOSICIÓN."; break;
        case 'id_notaMatrimonio': notaCalculada = config.porNotificacionMatrimonial?.textoParaPartidaOriginal || "CONTRAJO MATRIMONIO."; break;
        default: notaCalculada = raw.notaMarginal || config.estandar || "ES COPIA FIEL DEL ORIGINAL."; break;
    }

    const getFechaHoyLetras = () => {
        try { return convertDateToSpanishText(new Date().toISOString().split('T')[0]).replace(/^EL\s+/i, '').toUpperCase(); } 
        catch (e) { return "FECHA ACTUAL"; }
    };
    const notaFinalConFecha = notaCalculada.replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras()).toUpperCase();

    return {
        id: raw.id || generateUUID(), parishId: parishId, tipoIdentidad: identityId,
        Libro: String(raw.Libro || '0').padStart(4, '0'), folio: String(raw.folio || '0').padStart(4, '0'), numero: String(raw.numero || '0').padStart(4, '0'),
        lugarBautismo: String(raw.lugarBautismo || '---').trim().toUpperCase(), fechaSacramento: raw.fechaSacramento || '---',
        apellidos: String(raw.apellidos || '').trim().toUpperCase(), nombres: String(raw.nombres || '').trim().toUpperCase(),
        fechaNacimiento: raw.fechaNacimiento || '---', lugarNacimiento: String(raw.lugarNacimiento || '---').trim().toUpperCase(),
        sexo: String(raw.sexo || 'MASCULINO').toUpperCase(),
        nombrePadre: String(raw.nombrePadre || '---').trim().toUpperCase(), nombreMadre: String(raw.nombreMadre || '---').trim().toUpperCase(),
        tipoUnionPadres: String(raw.tipoUnionPadres || '---').trim().toUpperCase(),
        abuelosPaternos: String(raw.abuelosPaternos || '---').trim().toUpperCase(), abuelosMaternos: String(raw.abuelosMaternos || '---').trim().toUpperCase(),
        padrinos: String(raw.padrinos || '---').trim().toUpperCase(), ministro: String(raw.ministro || '---').trim().toUpperCase(),
        daFe: getNombreSacerdote(parishId), notaMarginal: notaFinalConFecha,
        status: raw.status || raw.estado || 'seated', updatedAt: new Date().toISOString()
    };
};

export const saveBaptismToSource = async (data, parishId, mode) => {
    const purificado = purificarRegistroBautismo(data, parishId);
    try {
        const cleanDate = (d) => (d && String(d).trim() !== '' && d !== '---') ? d : null;
        const dbRecord = {
            id: purificado.id, parish_id: parishId, book_number: purificado.Libro, page_number: purificado.folio, entry_number: purificado.numero,
            first_name: purificado.nombres, last_name: purificado.apellidos, gender: purificado.sexo,
            birth_date: cleanDate(purificado.fechaNacimiento), sacrament_date: cleanDate(purificado.fechaSacramento),
            minister: purificado.ministro, father_name: purificado.nombrePadre, mother_name: purificado.nombreMadre,
            tipo_union_padres: String(purificado.tipoUnionPadres || '1'), status: purificado.status, margin_note: purificado.notaMarginal, raw_data: purificado 
        };

        const { error } = await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
        if (error) throw error;

        const storageKey = `baptisms_${parishId}`;
        const currentLocal = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedLocal = [...currentLocal.filter(b => b.id !== purificado.id), purificado];

        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(updatedLocal));
        window.dispatchEvent(new Event('storage'));
        return { success: true, id: purificado.id };
    } catch (e) { return { success: false, message: e.message }; }
};

export const saveBaptism = async (newPartidaData, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const finalRecord = { ...newPartidaData, id: newPartidaData.id || generateUUID(), status: newPartidaData.status || 'seated', createdAt: new Date().toISOString() };
    if (finalRecord.type === "replacement" || finalRecord.createdByDecree === "replacement") {
        if (finalRecord.marginNote) finalRecord.notaMarginal = finalRecord.marginNote.text || finalRecord.marginNote;
    }
    return await saveBaptismToSource(finalRecord, parishId, finalRecord.status);
};

export const seatBaptism = async (originalId, parishId, updates = {}) => {
    try {
        const pending = await getPendingBaptisms(parishId);
        const record = pending.find(r => r.id === originalId);
        if (!record) return { success: false, message: "Registro no encontrado en pendientes." };
        
        const params = JSON.parse(localStorage.getItem(`baptismParameters_${parishId}`) || '{}');
        const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
        const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
        const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

        const fechaReal = updates.fechaSacramento || updates.sacramentDate || updates.fechaBautismo || record.fechaSacramento || record.sacramentDate || record.fechaBautismo || record.fecbau || record.sacrament_date || '';

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let safeId = record.id;
        if (!uuidRegex.test(safeId)) safeId = generateUUID();

        const finalRecord = { 
            ...record, ...updates, id: safeId, status: 'seated', estado: 'Activo',
            book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado,
            libro: libroAsignado, folio: folioAsignado, numero: numeroAsignado, numeroActa: numeroAsignado,
            fechaSacramento: fechaReal, sacramentDate: fechaReal, fechaBautismo: fechaReal, fecbau: fechaReal
        };
        
        const cleanDate = (d) => (d && typeof d === 'string' && d.trim() !== '') ? d : null;

        const dbRecord = {
            id: safeId, parish_id: parishId, book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado,
            first_name: String(finalRecord.firstName || finalRecord.nombres || ''), last_name: String(finalRecord.lastName || finalRecord.apellidos || ''),
            gender: String(finalRecord.sex || finalRecord.sexo || ''), birth_date: cleanDate(finalRecord.birthDate || finalRecord.fechaNacimiento),
            sacrament_date: cleanDate(fechaReal), minister: String(finalRecord.minister || finalRecord.ministro || ''),
            father_name: String(finalRecord.fatherName || finalRecord.nombrePadre || ''), mother_name: String(finalRecord.motherName || finalRecord.motherName || ''),
            tipo_union_padres: String(finalRecord.tipoUnionPadres || finalRecord.tipo_union_padres || '1'), status: 'seated',
            margin_note: String(finalRecord.marginNote || finalRecord.notaMarginal || finalRecord.notaAlMargen || ''), raw_data: finalRecord 
        };

        const { error } = await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
        if (error) throw error;

        const newPending = pending.filter(r => r.id !== originalId);
        localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(newPending));
        
        const list = getBaptisms(parishId).filter(b => b.id !== finalRecord.id);
        const newList = [...list, finalRecord];
        localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(newList));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(newList));

        const nextConsecutivos = ParamsHelper.calculateNextConsecutive(
            params.ordinarioNumero || 1, params.ordinarioFolio || 1, params.ordinarioLibro || 1, params.ordinarioPartidas || 2, params.ordinarioRestartNumber
        );

        localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify({ 
            ...params, ordinarioNumero: nextConsecutivos.numero, ordinarioFolio: nextConsecutivos.folio, ordinarioLibro: nextConsecutivos.libro
        }));
        
        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Registro asentado y guardado en la Nube correctamente." };
    } catch (err) { return { success: false, message: "Error interno: " + err.message }; }
};

export const seatMultipleBaptisms = async (ids, parishId) => {
    try {
        const pending = await getPendingBaptisms(parishId);
        const recordsToSeat = pending.filter(r => ids.includes(r.id));
        if (recordsToSeat.length === 0) return { success: false, message: "No hay registros seleccionados para asentar." };

        let params = JSON.parse(localStorage.getItem(`baptismParameters_${parishId}`) || '{}');
        let currentLibro = parseInt(params.ordinarioLibro || 1);
        let currentFolio = parseInt(params.ordinarioFolio || 1);
        let currentNumero = parseInt(params.ordinarioNumero || 1);
        const maxPartidas = parseInt(params.ordinarioPartidas || 2);

        const dbRecords = [];
        recordsToSeat.forEach(record => {
            const sLibro = String(currentLibro).padStart(4, '0');
            const sFolio = String(currentFolio).padStart(4, '0');
            const sNumero = String(currentNumero).padStart(4, '0');

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            let safeId = record.id;
            if (!uuidRegex.test(safeId)) safeId = generateUUID();

            const finalRecord = {
                ...record, id: safeId, status: 'seated', estado: 'Activo',
                book_number: sLibro, page_number: sFolio, entry_number: sNumero,
                libro: sLibro, folio: sFolio, numero: sNumero, numeroActa: sNumero,
            };

            const cleanDate = (d) => (d && typeof d === 'string' && d.trim() !== '') ? d : null;
            dbRecords.push({
                id: safeId, parish_id: parishId, book_number: sLibro, page_number: sFolio, entry_number: sNumero,
                first_name: String(finalRecord.firstName || finalRecord.nombres || ''), last_name: String(finalRecord.lastName || finalRecord.apellidos || ''),
                gender: String(finalRecord.sex || finalRecord.sexo || ''), birth_date: cleanDate(finalRecord.birthDate || finalRecord.fechaNacimiento),
                sacrament_date: cleanDate(finalRecord.sacramentDate || finalRecord.fechaSacramento || finalRecord.fechaBautismo || finalRecord.fecbau),
                minister: String(finalRecord.minister || finalRecord.ministro || ''), father_name: String(finalRecord.fatherName || finalRecord.nombrePadre || ''),
                mother_name: String(finalRecord.motherName || finalRecord.nombreMadre || ''), tipo_union_padres: String(finalRecord.tipoUnionPadres || finalRecord.tipo_union_padres || '1'),
                status: 'seated', raw_data: finalRecord
            });

            if (currentNumero % maxPartidas === 0) currentFolio++;
            currentNumero++;
        });

        const { error } = await supabase.from('baptisms').upsert(dbRecords, { onConflict: 'id' });
        if (error) throw error;

        params.ordinarioLibro = currentLibro; params.ordinarioFolio = currentFolio; params.ordinarioNumero = currentNumero;
        localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(params));

        const newPending = pending.filter(r => !ids.includes(r.id));
        localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(newPending));

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: `¡Se asentaron ${dbRecords.length} registros en la Nube correctamente!` };
    } catch (error) { return { success: false, message: "Error conectando a la Nube: " + error.message }; }
};

export const addBaptismsFromJSON = async (baptismRecords, preFiltered, parishId) => {
    try {
        if (!parishId) return { success: false, message: "No se pudo identificar la parroquia actual." };
        const storageKey = `baptisms_${parishId}`;
        const currentRecords = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        let recordsToAdd = [];
        let ignoredCount = 0;
        let duplicateDetails = [];

        if (preFiltered) {
            recordsToAdd = baptismRecords;
        } else {
            const { newBaptisms, duplicateBaptisms } = separateNewAndDuplicateBaptisms(baptismRecords, currentRecords);
            recordsToAdd = newBaptisms;
            ignoredCount = duplicateBaptisms.length;
            duplicateDetails = duplicateBaptisms;
        }

        if (recordsToAdd.length > 0) {
            const updatedRecords = [...currentRecords, ...recordsToAdd];
            localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
        }

        return { 
            success: true, message: `${recordsToAdd.length} registros importados correctamente.`,
            addedCount: recordsToAdd.length, ignoredCount, addedRecords: recordsToAdd, ignoredRecords: duplicateDetails
        };
    } catch (error) { return { success: false, message: error.message }; }
};

export const searchBaptismGlobal = (book, page, entry, dioceseId, dataParishes) => {
    if (!dioceseId) return null;
    const parishes = dataParishes.filter(p => p.dioceseId === dioceseId);
    let foundRecord = null;
    let targetParishId = null;
    for (const parish of parishes) {
        const records = getBaptisms(parish.id) || [];
        const match = records.find(b => String(b.book_number || b.libro) === String(book) && String(b.page_number || b.folio) === String(page) && String(b.entry_number || b.numero) === String(entry));
        if (match) { foundRecord = match; targetParishId = parish.id; break; }
    }
    return foundRecord ? { record: foundRecord, parishId: targetParishId } : null;
};


// ============================================================================
// 3. GESTIÓN DE DECRETOS Y REPOSICIONES
// ============================================================================
export const getBaptismCorrections = (parishId) => parishId ? JSON.parse(localStorage.getItem(`baptismCorrections_${parishId}`) || '[]') : [];

export const deleteBaptismCorrection = async (id, parishId) => {
    try {
        if (!parishId) return { success: true };
        const correctionsKey = `baptismCorrections_${parishId}`;

        let corrections = JSON.parse(localStorage.getItem(correctionsKey) || '[]');
        const decreeToDelete = corrections.find(c => c.id === id);

        localStorage.setItem(correctionsKey, JSON.stringify(corrections.filter(c => c.id !== id)));

        if (!decreeToDelete) { window.dispatchEvent(new Event('storage')); return { success: true }; }

        const decNum = String(decreeToDelete.numeroDecreto || decreeToDelete.decreeNumber || '');
        const targetParish = decreeToDelete.targetParishId || parishId;
        const baptismsKey = `baptisms_${targetParish}`;

        let baptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
        let params = JSON.parse(localStorage.getItem(`baptismParameters_${targetParish}`) || '{}');
        let deletedCount = 0;

        baptisms = baptisms.filter(b => {
            const isCreatedByThis = (b.correctionDecreeRef === decNum || b.replacementDecreeRef === decNum || b.decreeNumber === decNum) && (b.creadoPorDecreto || b.isSupplementary);
            if (isCreatedByThis) deletedCount++;
            return !isCreatedByThis;
        });

        baptisms = baptisms.map(b => {
            if (b.annulmentDecree === decNum) {
                const newB = { ...b, status: 'seated', estado: 'seated', updatedAt: new Date().toISOString() };
                delete newB.isAnnulled; delete newB.anulado; delete newB.annulmentDecree; delete newB.annulmentDate;
                delete newB.conceptoAnulacionId; delete newB.tipoNotaAlMargen; delete newB.notaMarginal; delete newB.marginNote;
                return newB;
            }
            return b;
        });

        if (deletedCount > 0) {
            let currentNum = parseInt(params.suplementarioNumero || '1', 10);
            if (currentNum > deletedCount) {
                const paddedLength = String(params.suplementarioNumero || '').length || 1;
                params.suplementarioNumero = String(currentNum - deletedCount).padStart(paddedLength, '0');
                localStorage.setItem(`baptismParameters_${targetParish}`, JSON.stringify(params));
            }
        }

        localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
        localStorage.setItem(`baptismPartidas_${targetParish}`, JSON.stringify(baptisms));

        if (decreeToDelete.isMasterCopy && decreeToDelete.targetParishId) {
            const parishCorrectionsKey = `baptismCorrections_${decreeToDelete.targetParishId}`;
            let parishCorrections = JSON.parse(localStorage.getItem(parishCorrectionsKey) || '[]');
            localStorage.setItem(parishCorrectionsKey, JSON.stringify(parishCorrections.filter(c => String(c.decreeNumber || c.numeroDecreto) !== decNum)));
        }

        try {
            await supabase.from('decretos').delete().eq('id', id);
            if (decreeToDelete.newPartidaId) await supabase.from('baptisms').delete().eq('id', decreeToDelete.newPartidaId);
        } catch (cloudErr) {}

        window.dispatchEvent(new Event('storage'));
        return { success: true };
    } catch (e) { window.dispatchEvent(new Event('storage')); return { success: true }; }
};

export const createBaptismCorrection = async (decreeData, originalPartidaId, newPartidaData, parishId) => {
    try {
        if (!parishId) return { success: false, message: "Parish ID missing" };
        
        const baptismsKey = `baptisms_${parishId}`;
        let baptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
        
        const originalIndex = baptisms.findIndex(b => b.id === originalPartidaId);
        if (originalIndex === -1) return { success: false, message: "Partida original no encontrada" };
        const originalPartida = baptisms[originalIndex];
        
        let params = JSON.parse(localStorage.getItem(`baptismParameters_${parishId}`) || '{}');
        if (!params.suplementarioLibro) params = { ...params, suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 };
        
        const nombreSacerdote = getNombreSacerdote(parishId);
        const decretoObj = { numero: decreeData.decreeNumber, fecha: decreeData.decreeDate, oficina: 'CANCILLERÍA' };
        const partidaNuevaObj = { libro: String(params.suplementarioLibro).padStart(4, '0'), folio: String(params.suplementarioFolio).padStart(4, '0'), numero: String(params.suplementarioNumero).padStart(4, '0') };
        
        const origLibro = String(originalPartida.book_number || originalPartida.libro || originalPartida.Libro || '').padStart(4, '0');
        const origFolio = String(originalPartida.page_number || originalPartida.folio || '').padStart(4, '0');
        const origNumero = String(originalPartida.entry_number || originalPartida.numero || originalPartida.numeroActa || '').padStart(4, '0');
        const partidaAnuladaObj = { libro: origLibro, folio: origFolio, numero: origNumero };

        const notaAnulada = ParamsHelper.generarNotaAlMargenAnulada(partidaNuevaObj, decretoObj, parishId);
        const notaNueva = ParamsHelper.generarNotaAlMargenNuevaPartida(partidaAnuladaObj, decretoObj, nombreSacerdote, parishId);

        const updatedOriginalRaw = {
            ...originalPartida, isAnnulled: true, status: 'anulada', estado: 'anulada',
            annulmentDecree: decreeData.decreeNumber, annulmentDate: decreeData.decreeDate,
            conceptoAnulacionId: decreeData.conceptoAnulacionId, tipoNotaAlMargen: 'porCorreccion.anulada', 
            notaMarginal: notaAnulada, marginNote: notaAnulada, updatedAt: new Date().toISOString()
        };
        baptisms[originalIndex] = updatedOriginalRaw;
        
        const newPartidaId = generateUUID();
        const newPartidaRaw = {
            ...newPartidaData, id: newPartidaId, parishId,
            book_number: partidaNuevaObj.libro, page_number: partidaNuevaObj.folio, entry_number: partidaNuevaObj.numero,
            status: 'seated', isSupplementary: true, creadoPorDecreto: true, hasDecree: true,
            correctionDecreeRef: decreeData.decreeNumber, conceptoAnulacionId: decreeData.conceptoAnulacionId,
            tipoNotaAlMargen: 'porCorreccion.nuevaPartida', notaMarginal: notaNueva, marginNote: notaNueva,
            createdAt: new Date().toISOString()
        };
        baptisms.push(newPartidaRaw);
        
        const nextSupletorio = ParamsHelper.calculateNextConsecutive(params.suplementarioNumero || 1, params.suplementarioFolio || 1, params.suplementarioLibro || 1, params.suplementarioPartidas || 2, params.suplementarioReiniciar);
        const updatedParams = { ...params, suplementarioNumero: nextSupletorio.numero, suplementarioFolio: nextSupletorio.folio, suplementarioLibro: nextSupletorio.libro };

        localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(updatedParams));
        localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(baptisms));
        
        try { await supabase.from('parish_parameters').upsert({ parish_id: parishId, bautizos_params: updatedParams }, { onConflict: 'parish_id' }); } catch (e) {}
        try { await saveBaptismToSource(updatedOriginalRaw, parishId, updatedOriginalRaw.status); await saveBaptismToSource(newPartidaRaw, parishId, newPartidaRaw.status); } catch(e) {}
        
        const decreeId = generateUUID();
        const decreeRecord = {
            id: decreeId, ...decreeData, type: 'correction', sacrament: 'bautismo', numeroDecreto: decreeData.decreeNumber, fechaDecreto: decreeData.decreeDate,    
            observaciones: decreeData.observaciones, originalPartidaId, newPartidaId: newPartidaId,
            originalPartidaSummary: { ...updatedOriginalRaw, book: origLibro, page: origFolio, entry: origNumero },
            newPartidaSummary: { ...newPartidaRaw, book: partidaNuevaObj.libro, page: partidaNuevaObj.folio, entry: partidaNuevaObj.numero },
            status: 'active', createdAt: new Date().toISOString()
        };

        const correctionsKey = `baptismCorrections_${parishId}`;
        const corrections = JSON.parse(localStorage.getItem(correctionsKey) || '[]');
        corrections.push(decreeRecord);
        localStorage.setItem(correctionsKey, JSON.stringify(corrections));
        
        try { await supabase.from('decretos').insert([{ id: decreeId, parish_id: parishId, tipo: 'correccion', payload: decreeRecord }]); } catch(e) {}

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto ejecutado y respaldado con notas.", data: decreeRecord };
    } catch (e) { return { success: false, message: e.message }; }
};

export const updateBaptismCorrection = async (id, updatedData, parishId) => {
    try {
        const correctionsKey = `baptismCorrections_${parishId}`;
        let corrections = JSON.parse(localStorage.getItem(correctionsKey) || '[]');
        const index = corrections.findIndex(c => c.id === id);
        if (index === -1) return { success: false, message: "Decreto no encontrado" };
        
        const oldDecree = corrections[index];
        const newDecree = { ...oldDecree, ...updatedData, updatedAt: new Date().toISOString() };
        corrections[index] = newDecree;
        localStorage.setItem(correctionsKey, JSON.stringify(corrections));

        const origId = newDecree.originalPartidaId;
        const newId = newDecree.newPartidaId;
        const decNum = newDecree.numeroDecreto || newDecree.decreeNumber;
        const decDate = newDecree.fechaDecreto || newDecree.decreeDate;

        if (origId) {
            const { data: origData } = await supabase.from('baptisms').select('raw_data').eq('id', origId).single();
            if (origData && origData.raw_data) {
                let raw = origData.raw_data;
                raw.annulmentDecree = decNum; raw.annulmentDate = decDate;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', origId);
            }
        }

        if (newId) {
            const { data: newData } = await supabase.from('baptisms').select('raw_data').eq('id', newId).single();
            if (newData && newData.raw_data) {
                let raw = newData.raw_data;
                raw.correctionDecreeRef = decNum; raw.decreeNumber = decNum;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', newId);
            }
        }

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto y partidas actualizados en la Nube." };
    } catch (e) { return { success: false, message: e.message }; }
};

export const processBaptismDecreeBatch = async (decreesBatch, targetParishId) => {
    try {
        const baptismsKey = `baptisms_${targetParishId}`;
        const correctionsKey = `baptismCorrections_${targetParishId}`;
        const replacementsKey = `decreeReplacementBaptism_${targetParishId}`; 
        
        let allBaptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
        let existingCorrections = JSON.parse(localStorage.getItem(correctionsKey) || '[]');
        let existingReplacements = JSON.parse(localStorage.getItem(replacementsKey) || '[]');
        
        const nombreSacerdote = getNombreSacerdote(targetParishId);
        const notasConfig = ParamsHelper.obtenerNotasAlMargen(targetParishId);

        const normalizeNum = (num) => String(num || '').trim().replace(/^0+/, '') || '0';
        const getNum = (val) => {
            if (val == null || val === '') return null;
            const parsed = parseInt(String(val).replace(/\D/g, ''), 10);
            return isNaN(parsed) ? null : parsed;
        };
        const isSameNum = (val1, val2) => {
            const n1 = getNum(val1); const n2 = getNum(val2);
            return n1 !== null && n2 !== null && n1 === n2;
        };

        let processedCount = 0;
        let duplicateCount = 0;
        const changedRecordsForSupabase = [];

        decreesBatch.forEach(decree => {
            const rawDecNum = String(decree.decreto || decree.decreeNumber || '').trim();
            const normDecNum = normalizeNum(rawDecNum);

            const existsInCorrections = existingCorrections.some(c => normalizeNum(c.numeroDecreto) === normDecNum || normalizeNum(c.decreeNumber) === normDecNum);
            const existsInReplacements = existingReplacements.some(r => normalizeNum(r.numeroDecreto) === normDecNum || normalizeNum(r.decreeNumber) === normDecNum);

            if (existsInCorrections || existsInReplacements) { duplicateCount++; return;  }

            const origLib = decree.libro || (decree.originalData && decree.originalData.libro);
            const origFol = decree.folio || (decree.originalData && decree.originalData.folio);
            const origNum = decree.numero || (decree.originalData && decree.originalData.numero);

            const newLib = decree.newlib || (decree.newData && decree.newData.libro);
            const newFol = decree.newfol || (decree.newData && decree.newData.folio);
            const newNum = decree.newnum || (decree.newData && decree.newData.numero);

            const decDate = decree.fecha || decree.decreeDate;
            const decConcept = String(decree.codiconcep || decree.annulmentConceptCode || '');
            const decObs = decree.observacio || decree.observations || '';
            const isReposicion = decConcept === '005';

            let originalFound = false;
            let newFound = false;
            let originalNames = { nombres: '', apellidos: '' };
            let fullOriginalSnapshot = null;
            let fullNewSnapshot = null;

            const decretoObj = { numero: rawDecNum, fecha: decDate, oficina: 'CANCILLERÍA' };
            const partidaNuevaObj = { libro: newLib, folio: newFol, numero: newNum };
            const partidaAnuladaObj = { libro: origLib, folio: origFol, numero: origNum };

            let notaAnuladaOficial = ParamsHelper.generarNotaAlMargenAnulada(partidaNuevaObj, decretoObj, targetParishId);
            let notaNuevaOficial = ParamsHelper.generarNotaAlMargenNuevaPartida(partidaAnuladaObj, decretoObj, nombreSacerdote, targetParishId);
            
            let templateRepo = notasConfig?.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || notasConfig?.porReposicion?.nuevaPartida;
            if (!templateRepo || templateRepo.trim() === '') {
                templateRepo = "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NRO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], DEBIDO A LA PÉRDIDA O DETERIORO DEL ORIGINAL. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
            }

            const fechaDecretoText = decDate ? convertDateToSpanishText(decDate).replace(/^EL\s+/i, '') : "__________";
            const fechaExpedicionText = convertDateToSpanishText(new Date().toISOString()).replace(/^EL\s+/i, '');

            let notaReposicion = templateRepo.replace(/\[NUMERO_DECRETO\]/g, rawDecNum || '___').replace(/\[FECHA_DECRETO\]/g, fechaDecretoText).replace(/\[FECHA_EXPEDICION\]/g, fechaExpedicionText);

            if (decObs) {
                notaAnuladaOficial += ` OBSERVACIONES: ${decObs}`;
                notaNuevaOficial += ` OBSERVACIONES: ${decObs}`;
                notaReposicion += ` OBSERVACIONES: ${decObs}`;
            }

            allBaptisms = allBaptisms.map(b => {
                const isOrig = isSameNum(b.libro || b.book_number, origLib) && isSameNum(b.folio || b.page_number, origFol) && isSameNum(b.numero || b.entry_number, origNum);
                const isNew = isSameNum(b.libro || b.book_number, newLib) && isSameNum(b.folio || b.page_number, newFol) && isSameNum(b.numero || b.entry_number, newNum);

                if (isOrig) {
                    originalFound = true;
                    if (!fullOriginalSnapshot) {
                        fullOriginalSnapshot = { ...b };
                        originalNames.nombres = b.nombres || b.firstName || '';
                        originalNames.apellidos = b.apellidos || b.lastName || '';
                    }
                    
                    const updatedOrig = {
                        ...b, isAnnulled: true, status: 'anulada', estado: 'anulada', annulmentDecree: rawDecNum, annulmentDate: decDate, conceptoAnulacionId: decConcept,
                        tipoNotaAlMargen: isReposicion ? 'porReposicion.anulada' : 'porCorreccion.anulada', 
                        notaMarginal: isReposicion ? 'PARTIDA ANULADA POR REPOSICIÓN.' : notaAnuladaOficial, marginNote: isReposicion ? 'PARTIDA ANULADA POR REPOSICIÓN.' : notaAnuladaOficial, updatedAt: new Date().toISOString()
                    };
                    changedRecordsForSupabase.push(updatedOrig);
                    return updatedOrig;
                }

                if (isNew) {
                    newFound = true;
                    if (!fullNewSnapshot) fullNewSnapshot = { ...b };
                    if (!originalFound) { originalNames.nombres = b.nombres || b.firstName || ''; originalNames.apellidos = b.apellidos || b.lastName || ''; }
                    const updatedNew = {
                        ...b, isSupplementary: true, creadoPorDecreto: true, hasDecree: true, numeroDecreto: rawDecNum, decreeNumber: rawDecNum, correctionDecreeRef: rawDecNum,
                        replacementDecreeRef: isReposicion ? rawDecNum : undefined, tipoNotaAlMargen: isReposicion ? 'porReposicion.nuevaPartida' : 'porCorreccion.nuevaPartida', 
                        notaMarginal: isReposicion ? notaReposicion : notaNuevaOficial, marginNote: isReposicion ? notaReposicion : notaNuevaOficial, updatedAt: new Date().toISOString()
                    };
                    changedRecordsForSupabase.push(updatedNew);
                    return updatedNew;
                }
                return b;
            });

            if (newFound || originalFound) {
                const decreeRecord = {
                    id: `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, type: isReposicion ? "replacement" : "correction", sacrament: "bautismo", numeroDecreto: rawDecNum, decreeNumber: rawDecNum, fechaDecreto: decDate, decreeDate: decDate, conceptoAnulacionId: decConcept, errorEncontrado: decObs || (isReposicion ? 'Reposición Importada' : 'Corrección Importada'),
                    correccionRealizada: `L:${newLib} F:${newFol} N:${newNum}`, nombres: originalNames.nombres, apellidos: originalNames.apellidos, targetName: `${originalNames.nombres} ${originalNames.apellidos}`.trim() || 'Sin Nombre', observations: decObs, originalPartidaId: fullOriginalSnapshot ? fullOriginalSnapshot.id : "unknown",
                    originalPartidaSummary: fullOriginalSnapshot ? { ...fullOriginalSnapshot } : null, newPartidaSummary: { book: newLib, page: newFol, entry: newNum }, datosNuevaPartida: fullNewSnapshot || fullOriginalSnapshot || null, status: 'active', createdAt: new Date().toISOString()
                };

                if (isReposicion) existingReplacements.push(decreeRecord);
                else existingCorrections.push(decreeRecord);
                processedCount++;
            }
        });

        localStorage.setItem(baptismsKey, JSON.stringify(allBaptisms));
        localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(allBaptisms));
        localStorage.setItem(correctionsKey, JSON.stringify(existingCorrections));
        localStorage.setItem(replacementsKey, JSON.stringify(existingReplacements));
        
        if (changedRecordsForSupabase.length > 0) {
             const cleanDate = (d) => (d && String(d).trim() !== '') ? d : null;
             const dbRecords = changedRecordsForSupabase.map(newItem => ({
                id: newItem.id, parish_id: targetParishId, book_number: String(newItem.book_number || newItem.libro || ''), page_number: String(newItem.page_number || newItem.folio || ''), entry_number: String(newItem.entry_number || newItem.numero || ''),
                first_name: String(newItem.firstName || newItem.nombres || ''), last_name: String(newItem.lastName || newItem.apellidos || ''), gender: String(newItem.sex || newItem.sexo || ''),
                birth_date: cleanDate(newItem.birthDate || newItem.fechaNacimiento), sacrament_date: cleanDate(newItem.sacramentDate || newItem.fechaSacramento || newItem.fechaBautismo || newItem.fecbau), minister: String(newItem.minister || newItem.ministro || ''),
                father_name: String(newItem.fatherName || newItem.nombrePadre || ''), mother_name: String(newItem.motherName || newItem.nombreMadre || ''), tipo_union_padres: String(newItem.tipoUnionPadres || newItem.tipo_union_padres || '1'), status: newItem.status, margin_note: String(newItem.marginNote || newItem.notaMarginal || ''), raw_data: newItem
            }));
            await supabase.from('baptisms').upsert(dbRecords, { onConflict: 'id' });
        }

        window.dispatchEvent(new Event('storage'));
        let finalMessage = `Se procesaron y clasificaron ${processedCount} decretos correctamente.`;
        if (duplicateCount > 0) finalMessage += ` Se omitieron ${duplicateCount} decretos que ya existían (número duplicado).`;

        return { success: true, message: finalMessage };
    } catch (error) { return { success: false, message: error.message }; }
};

export const createChanceryCorrection = async (decreeData, originalPartidaId, newPartidaData, targetParishId, chanceryId) => {
    try {
      if (!targetParishId || !chanceryId) return { success: false, message: "Faltan identificadores." };

      const baptismsKey = `baptisms_${targetParishId}`;
      let baptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');

      const originalIndex = baptisms.findIndex(b => b.id === originalPartidaId);
      if (originalIndex === -1) return { success: false, message: "Partida original no encontrada" };
      const originalPartida = baptisms[originalIndex];

      let params = JSON.parse(localStorage.getItem(`baptismParameters_${targetParishId}`) || '{}');
      if (!params.suplementarioLibro) params = { ...params, suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 };

      const nombreSacerdote = getNombreSacerdote(targetParishId);
      const decretoObj = { numero: decreeData.decreeNumber, fecha: decreeData.decreeDate, oficina: 'CANCILLERÍA' };
      const partidaNuevaObj = { libro: String(params.suplementarioLibro).padStart(4, '0'), folio: String(params.suplementarioFolio).padStart(4, '0'), numero: String(params.suplementarioNumero).padStart(4, '0') };

      const origLibro = String(originalPartida.book_number || originalPartida.libro || originalPartida.Libro || '').padStart(4, '0');
      const origFolio = String(originalPartida.page_number || originalPartida.folio || '').padStart(4, '0');
      const origNumero = String(originalPartida.entry_number || originalPartida.numero || originalPartida.numeroActa || '').padStart(4, '0');
      const partidaAnuladaObj = { libro: origLibro, folio: origFolio, numero: origNumero };

      const notaAnulada = ParamsHelper.generarNotaAlMargenAnulada(partidaNuevaObj, decretoObj, targetParishId);
      const notaNueva = ParamsHelper.generarNotaAlMargenNuevaPartida(partidaAnuladaObj, decretoObj, nombreSacerdote, targetParishId);

      const updatedOriginalRaw = {
        ...originalPartida, isAnnulled: true, status: 'anulada', estado: 'anulada', annulmentDecree: decreeData.decreeNumber, annulmentDate: decreeData.decreeDate, conceptoAnulacionId: decreeData.conceptoAnulacionId, tipoNotaAlMargen: 'porCorreccion.anulada', notaMarginal: notaAnulada, marginNote: notaAnulada, updatedAt: new Date().toISOString()
      };
      baptisms[originalIndex] = updatedOriginalRaw;

      const newPartidaId = generateUUID();
      const newPartidaRaw = {
        ...newPartidaData, id: newPartidaId, parishId: targetParishId, book_number: partidaNuevaObj.libro, page_number: partidaNuevaObj.folio, entry_number: partidaNuevaObj.numero, status: 'seated', isSupplementary: true, creadoPorDecreto: true, hasDecree: true, correctionDecreeRef: decreeData.decreeNumber, conceptoAnulacionId: decreeData.conceptoAnulacionId, tipoNotaAlMargen: 'porCorreccion.nuevaPartida', notaMarginal: notaNueva, marginNote: notaNueva, createdAt: new Date().toISOString()
      };
      baptisms.push(newPartidaRaw);

      const nextSupletorio = ParamsHelper.calculateNextConsecutive(params.suplementarioNumero || 1, params.suplementarioFolio || 1, params.suplementarioLibro || 1, params.suplementarioPartidas || 2, params.suplementarioReiniciar);
      const updatedParams = { ...params, suplementarioNumero: nextSupletorio.numero, suplementarioFolio: nextSupletorio.folio, suplementarioLibro: nextSupletorio.libro };

      localStorage.setItem(`baptismParameters_${targetParishId}`, JSON.stringify(updatedParams));
      localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
      localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(baptisms));

      try { await supabase.from('parish_parameters').upsert({ parish_id: targetParishId, bautizos_params: updatedParams }, { onConflict: 'parish_id' }); } catch (e) {}
      try { await saveBaptismToSource(updatedOriginalRaw, targetParishId, updatedOriginalRaw.status); await saveBaptismToSource(newPartidaRaw, targetParishId, newPartidaRaw.status); } catch (e) {}

      const decreeId = generateUUID();
      const decreeRecord = {
        id: decreeId, ...decreeData, type: 'correction', sacrament: 'bautismo', numeroDecreto: decreeData.decreeNumber, fechaDecreto: decreeData.decreeDate, observaciones: decreeData.observaciones, originalPartidaId, newPartidaId: newPartidaId, targetParishId: targetParishId, targetParishName: decreeData.targetParishName, originalPartidaSummary: { ...updatedOriginalRaw, book: origLibro, page: origFolio, entry: origNumero }, newPartidaSummary: { ...newPartidaRaw, book: partidaNuevaObj.libro, page: partidaNuevaObj.folio, entry: partidaNuevaObj.numero }, status: 'active', createdAt: new Date().toISOString()
      };

      const chanceryCorrectionsKey = `baptismCorrections_${chanceryId}`;
      const chanceryCorrections = JSON.parse(localStorage.getItem(chanceryCorrectionsKey) || '[]');
      chanceryCorrections.push(decreeRecord);
      localStorage.setItem(chanceryCorrectionsKey, JSON.stringify(chanceryCorrections));

      try { await supabase.from('decretos').insert([{ id: decreeId, parish_id: targetParishId, tipo: 'correccion', payload: decreeRecord }]); } catch (e) { }

      window.dispatchEvent(new Event('storage'));
      return { success: true, message: "Decreto ejecutado y respaldado con notas.", data: decreeRecord };
    } catch (e) { return { success: false, message: e.message }; }
};

export const getDecreeReplacementBaptisms = (parishId) => JSON.parse(localStorage.getItem(`decreeReplacementBaptism_${parishId}`) || '[]');

export const saveDecreeReplacementBaptism = async (decreeData, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const decreeId = decreeData.id || generateUUID();
    const newDecree = { ...decreeData, id: decreeId, createdAt: new Date().toISOString() };
    supabase.from('decretos').insert([{ id: decreeId, parish_id: parishId, tipo: 'reposicion', payload: newDecree }]).then();
    const key = `decreeReplacementBaptism_${parishId}`;
    localStorage.setItem(key, JSON.stringify([...JSON.parse(localStorage.getItem(key) || '[]'), newDecree]));
    return { success: true, data: newDecree };
};

export const getDecreeReplacementsBySacrament = (sacramentType, parishId) => {
    if (!parishId) return [];
    const all = JSON.parse(localStorage.getItem(`decreeReplacements_${parishId}`) || '[]');
    if (sacramentType === 'bautismo') return [...all.filter(d => d.sacrament === 'bautismo' || d.type === 'replacement'), ...getDecreeReplacementBaptisms(parishId)];
    if (!sacramentType) return all;
    return all.filter(d => d.sacrament === sacramentType);
};
  
export const getDecreeReplacementByNewBaptismId = (newBaptismIdRepo, parishId) => {
    if (!parishId || !newBaptismIdRepo) return null;
    const all = JSON.parse(localStorage.getItem(`decreeReplacements_${parishId}`) || '[]');
    const found = all.find(d => d.newBaptismIdRepo === newBaptismIdRepo || d.newPartidaId === newBaptismIdRepo);
    if (found) return found;
    return getDecreeReplacementBaptisms(parishId).find(d => d.newPartidaId === newBaptismIdRepo);
};

export const createDecreeReplacement = async (decreeData, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const key = `decreeReplacements_${parishId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    const newDecree = { ...decreeData, id: decreeData.id || generateUUID(), createdAt: new Date().toISOString(), status: 'active' };
    supabase.from('decretos').insert([{ id: newDecree.id, parish_id: parishId, tipo: 'reposicion', payload: newDecree }]).then();
    localStorage.setItem(key, JSON.stringify([...current, newDecree]));
    window.dispatchEvent(new Event('storage'));
    return { success: true, data: newDecree };
};

export const updateDecreeReplacement = async (decreeId, updatedData, parishId) => {
    try {
        if (!parishId) return { success: false, message: "Falta ID de parroquia" };
        const specificKey = `decreeReplacementBaptism_${parishId}`;
        let specific = JSON.parse(localStorage.getItem(specificKey) || '[]');
        let index = specific.findIndex(d => d.id === decreeId);
        let decree = null;

        if (index !== -1) {
            specific[index] = { ...specific[index], ...updatedData, updatedAt: new Date().toISOString() };
            localStorage.setItem(specificKey, JSON.stringify(specific));
            decree = specific[index];
        } else {
            const key = `decreeReplacements_${parishId}`;
            let current = JSON.parse(localStorage.getItem(key) || '[]');
            index = current.findIndex(d => d.id === decreeId);
            if (index === -1) return { success: false, message: "Decreto no encontrado" };
            current[index] = { ...current[index], ...updatedData, updatedAt: new Date().toISOString() };
            localStorage.setItem(key, JSON.stringify(current));
            decree = current[index];
        }

        const newId = decree.newBaptismIdRepo || decree.newPartidaId;
        const origId = decree.originalPartidaId;
        const decNum = decree.numeroDecreto || decree.decreeNumber;
        const decDate = decree.fechaDecreto || decree.decreeDate;

        if (newId) {
            const { data: newData } = await supabase.from('baptisms').select('raw_data').eq('id', newId).single();
            if (newData && newData.raw_data) {
                let raw = newData.raw_data;
                raw.replacementDecreeRef = decNum; raw.decreeNumber = decNum;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', newId);
            }
        }

        if (origId) {
            const { data: origData } = await supabase.from('baptisms').select('raw_data').eq('id', origId).single();
            if (origData && origData.raw_data) {
                let raw = origData.raw_data;
                raw.annulmentDecree = decNum; raw.annulmentDate = decDate;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', origId);
            }
        }

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto de reposición y partidas actualizadas en la Nube." };
    } catch (error) { return { success: false, message: error.message }; }
};

export const deleteDecreeReplacement = async (decreeId, parishId) => {
    try {
        if (!parishId) return { success: true };
        const specificKey = `decreeReplacementBaptism_${parishId}`;
        const key = `decreeReplacements_${parishId}`;
        
        let specific = JSON.parse(localStorage.getItem(specificKey) || '[]');
        let current = JSON.parse(localStorage.getItem(key) || '[]');
        const decreeToDelete = current.find(d => d.id === decreeId) || specific.find(d => d.id === decreeId);
        
        if (specific.some(d => d.id === decreeId)) localStorage.setItem(specificKey, JSON.stringify(specific.filter(d => d.id !== decreeId)));
        localStorage.setItem(key, JSON.stringify(current.filter(d => d.id !== decreeId)));

        if (!decreeToDelete) { window.dispatchEvent(new Event('storage')); return { success: true }; }

        const decNum = String(decreeToDelete.numeroDecreto || decreeToDelete.decreeNumber || '');
        const targetParish = decreeToDelete.targetParishId || parishId;
        const baptismsKey = `baptisms_${targetParish}`;

        let baptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
        let params = JSON.parse(localStorage.getItem(`baptismParameters_${targetParish}`) || '{}');
        let deletedCount = 0;

        baptisms = baptisms.filter(b => {
            const isCreatedByThis = (b.correctionDecreeRef === decNum || b.replacementDecreeRef === decNum || b.decreeNumber === decNum) && (b.creadoPorDecreto || b.isSupplementary);
            if (isCreatedByThis) deletedCount++;
            return !isCreatedByThis;
        });

        baptisms = baptisms.map(b => {
            if (b.annulmentDecree === decNum) {
                const newB = { ...b, status: 'seated', estado: 'seated', updatedAt: new Date().toISOString() };
                delete newB.isAnnulled; delete newB.anulado; delete newB.annulmentDecree; delete newB.annulmentDate;
                delete newB.conceptoAnulacionId; delete newB.tipoNotaAlMargen; delete newB.notaMarginal; delete newB.marginNote;
                return newB;
            }
            return b;
        });

        if (deletedCount > 0) {
            let currentNum = parseInt(params.suplementarioNumero || '1', 10);
            if (currentNum > deletedCount) {
                const paddedLength = String(params.suplementarioNumero || '').length || 1;
                params.suplementarioNumero = String(currentNum - deletedCount).padStart(paddedLength, '0');
                localStorage.setItem(`baptismParameters_${targetParish}`, JSON.stringify(params));
            }
        }

        localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
        localStorage.setItem(`baptismPartidas_${targetParish}`, JSON.stringify(baptisms));

        if (decreeToDelete.isMasterCopy && decreeToDelete.targetParishId) {
             const parishReplacementsKey = `decreeReplacementBaptism_${decreeToDelete.targetParishId}`;
             let parishReplacements = JSON.parse(localStorage.getItem(parishReplacementsKey) || '[]');
             localStorage.setItem(parishReplacementsKey, JSON.stringify(parishReplacements.filter(c => String(c.decreeNumber || c.numeroDecreto) !== decNum)));
        }
        
        try {
            await supabase.from('decretos').delete().eq('id', decreeId);
            if (decreeToDelete.newPartidaId) await supabase.from('baptisms').delete().eq('id', decreeToDelete.newPartidaId);
        } catch (cloudErr) {}

        window.dispatchEvent(new Event('storage'));
        return { success: true };
    } catch (error) { window.dispatchEvent(new Event('storage')); return { success: true }; }
};