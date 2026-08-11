import { supabase } from '@/lib/supabaseClient';
import { generateUUID, incrementPaddedValue } from '@/utils/supabaseHelpers';
import { separateNewAndDuplicateDecrees } from '@/utils/decreeJsonMapper';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { obtenerNotasAlMargen, generarNotaAlMargenAnulada, generarNotaAlMargenNuevaPartida } from './marginalNotesService';
import { getParrocoActual, getMisDatosList } from './catalogsService';
import { calculateNextConsecutive } from './sacramentParametersService';
import { saveBaptismToSource } from './sacramentsService';

const safeJsonParse = (str, fallback = []) => {
    if (!str || str === 'undefined' || str === 'null') return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
};

// --- CONCEPTOS DE ANULACIÓN ---
export const getConceptosAnulacion = (parishId) => {
    if (!parishId) return [];
    return safeJsonParse(localStorage.getItem(`conceptosAnulacion_${parishId}`), []);
};

export const getConceptoAnulacion = (id, parishId) => {
    if (!parishId || !id) return null;
    const all = getConceptosAnulacion(parishId);
    return all.find(c => c.id === id) || null;
};

export const addConceptoAnulacion = (item, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const current = getConceptosAnulacion(parishId);
    const newItem = { ...item, tipo: item.tipo || 'porCorreccion', id: generateUUID(), createdAt: new Date().toISOString() };
    const updated = [...current, newItem];
    localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(updated));
    return { success: true, message: "Concepto agregado exitosamente", data: newItem };
};

export const updateConceptoAnulacion = (id, updates, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const current = getConceptosAnulacion(parishId);
    const updated = current.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
    localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(updated));
    return { success: true, message: "Concepto actualizado exitosamente" };
};

export const deleteConceptoAnulacion = (id, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const current = getConceptosAnulacion(parishId);
    const filtered = current.filter(i => i.id !== id);
    localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(filtered));
    return { success: true, message: "Concepto eliminado exitosamente" };
};

// --- DECRETOS DE REPOSICIÓN ---
export const getDecreeReplacementBaptisms = (parishId) => {
    if (!parishId) return [];
    return safeJsonParse(localStorage.getItem(`decreeReplacementBaptism_${parishId}`), []);
};

export const saveDecreeReplacementBaptism = async (decreeData, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const decreeId = decreeData.id || generateUUID();
    const newDecree = { ...decreeData, id: decreeId, createdAt: new Date().toISOString() };

    supabase.from('decretos').insert([{ id: decreeId, parish_id: parishId, tipo: 'reposicion', payload: newDecree }]).then();

    const key = `decreeReplacementBaptism_${parishId}`;
    const current = safeJsonParse(localStorage.getItem(key), []);
    localStorage.setItem(key, JSON.stringify([...current, newDecree]));
    return { success: true, data: newDecree };
};

export const getDecreeReplacements = (parishId) => {
    if (!parishId) return [];
    return safeJsonParse(localStorage.getItem(`decreeReplacements_${parishId}`), []);
};

export const getDecreeReplacementsBySacrament = (sacramentType, parishId) => {
    if (!parishId) return [];
    const all = getDecreeReplacements(parishId);
    if (sacramentType === 'bautismo') {
        const specific = getDecreeReplacementBaptisms(parishId);
        return [...all.filter(d => d.sacrament === 'bautismo' || d.type === 'replacement'), ...specific];
    }
    if (!sacramentType) return all;
    return all.filter(d => d.sacrament === sacramentType);
};

export const getDecreeReplacementByNewBaptismId = (newBaptismIdRepo, parishId) => {
    if (!parishId || !newBaptismIdRepo) return null;
    const all = getDecreeReplacements(parishId);
    const found = all.find(d => d.newBaptismIdRepo === newBaptismIdRepo || d.newPartidaId === newBaptismIdRepo);
    if (found) return found;
    return getDecreeReplacementBaptisms(parishId).find(d => d.newPartidaId === newBaptismIdRepo);
};

export const createDecreeReplacement = async (decreeData, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const key = `decreeReplacements_${parishId}`;
    const current = safeJsonParse(localStorage.getItem(key), []);
    const decreeId = decreeData.id || generateUUID();
    const newDecree = { ...decreeData, id: decreeId, createdAt: new Date().toISOString(), status: 'active' };

    supabase.from('decretos').insert([{ id: decreeId, parish_id: parishId, tipo: 'reposicion', payload: newDecree }]).then();
    
    localStorage.setItem(key, JSON.stringify([...current, newDecree]));
    window.dispatchEvent(new Event('storage'));
    return { success: true, data: newDecree };
};

export const updateDecreeReplacement = async (decreeId, updatedData, parishId) => {
    try {
        if (!parishId) return { success: false, message: "Falta ID de parroquia" };
        const key = `decreeReplacements_${parishId}`;
        let current = safeJsonParse(localStorage.getItem(key), []);
        const index = current.findIndex(d => d.id === decreeId);
        if (index === -1) return { success: false, message: "Decreto no encontrado" };
        
        current[index] = { ...current[index], ...updatedData, updatedAt: new Date().toISOString() };
        localStorage.setItem(key, JSON.stringify(current));
        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Actualizado exitosamente." };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const deleteDecreeReplacement = async (decreeId, parishId) => {
    try {
        if (!parishId) return { success: true };
        const key = `decreeReplacements_${parishId}`;
        let current = safeJsonParse(localStorage.getItem(key), []);
        localStorage.setItem(key, JSON.stringify(current.filter(d => d.id !== decreeId)));
        await supabase.from('decretos').delete().eq('id', decreeId);
        window.dispatchEvent(new Event('storage'));
        return { success: true };
    } catch (error) {
        return { success: true };
    }
};

// --- DECRETOS DE CORRECCIÓN ---
export const getBaptismCorrections = (parishId) => {
    if (!parishId) return [];
    return safeJsonParse(localStorage.getItem(`baptismCorrections_${parishId}`), []);
};

export const deleteBaptismCorrection = async (id, parishId) => {
    try {
        if (!parishId) return { success: true };
        const key = `baptismCorrections_${parishId}`;
        let corrections = safeJsonParse(localStorage.getItem(key), []);
        localStorage.setItem(key, JSON.stringify(corrections.filter(c => c.id !== id)));
        await supabase.from('decretos').delete().eq('id', id);
        window.dispatchEvent(new Event('storage'));
        return { success: true };
    } catch (e) {
        return { success: true };
    }
};

export const createBaptismCorrection = async (decreeData, originalPartidaId, newPartidaData, parishId) => {
    try {
        if (!parishId) return { success: false, message: "Falta ID de parroquia" };
        
        const baptismsKey = `baptisms_${parishId}`;
        let baptisms = safeJsonParse(localStorage.getItem(baptismsKey), []);
        
        const originalIndex = baptisms.findIndex(b => b.id === originalPartidaId);
        if (originalIndex === -1) return { success: false, message: "Partida original no encontrada" };
        const originalPartida = baptisms[originalIndex];
        
        let params = safeJsonParse(localStorage.getItem(`baptismParameters_${parishId}`), {});
        if (!params.suplementarioLibro) params = { ...params, suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 };
        
        const parrocoActivo = getParrocoActual(parishId);
        const nombreSacerdote = parrocoActivo ? `${parrocoActivo.nombre || ''} ${parrocoActivo.apellido || ''}`.trim().toUpperCase() : 'PÁRROCO ENCARGADO';
        
        const decretoObj = { numero: decreeData.decreeNumber, fecha: decreeData.decreeDate, oficina: 'CANCILLERÍA' };
        const partidaNuevaObj = { libro: String(params.suplementarioLibro).padStart(4, '0'), folio: String(params.suplementarioFolio).padStart(4, '0'), numero: String(params.suplementarioNumero).padStart(4, '0') };
        const partidaAnuladaObj = { libro: String(originalPartida.book_number || originalPartida.Libro).padStart(4, '0'), folio: String(originalPartida.page_number || originalPartida.folio).padStart(4, '0'), numero: String(originalPartida.entry_number || originalPartida.numero).padStart(4, '0') };

        const notaAnulada = generarNotaAlMargenAnulada(partidaNuevaObj, decretoObj, parishId);
        const notaNueva = generarNotaAlMargenNuevaPartida(partidaAnuladaObj, decretoObj, nombreSacerdote, parishId);

        const updatedOriginalRaw = {
            ...originalPartida,
            isAnnulled: true, status: 'anulada', estado: 'anulada',
            annulmentDecree: decreeData.decreeNumber, annulmentDate: decreeData.decreeDate,
            conceptoAnulacionId: decreeData.conceptoAnulacionId,
            tipoNotaAlMargen: 'porCorreccion.anulada', 
            notaMarginal: notaAnulada, marginNote: notaAnulada,
            updatedAt: new Date().toISOString()
        };
        baptisms[originalIndex] = updatedOriginalRaw;
        
        const newPartidaId = generateUUID();
        const newPartidaRaw = {
            ...newPartidaData,
            id: newPartidaId, parishId,
            book_number: partidaNuevaObj.libro, page_number: partidaNuevaObj.folio, entry_number: partidaNuevaObj.numero,
            status: 'seated', isSupplementary: true, creadoPorDecreto: true, hasDecree: true,
            correctionDecreeRef: decreeData.decreeNumber, conceptoAnulacionId: decreeData.conceptoAnulacionId,
            tipoNotaAlMargen: 'porCorreccion.nuevaPartida', 
            notaMarginal: notaNueva, marginNote: notaNueva,
            createdAt: new Date().toISOString()
        };
        baptisms.push(newPartidaRaw);
        
        params.suplementarioNumero = incrementPaddedValue(params.suplementarioNumero || '0');
        localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(params));
        localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(baptisms));
        
        try {
            await saveBaptismToSource(updatedOriginalRaw, parishId, updatedOriginalRaw.status);
            await saveBaptismToSource(newPartidaRaw, parishId, newPartidaRaw.status);
        } catch(e) {}
        
        const decreeId = generateUUID();
        const decreeRecord = {
            id: decreeId, ...decreeData, originalPartidaId, newPartidaId: newPartidaId,
            originalPartidaSummary: { ...updatedOriginalRaw, book: updatedOriginalRaw.book_number, page: updatedOriginalRaw.page_number, entry: updatedOriginalRaw.entry_number },
            newPartidaSummary: { ...newPartidaRaw, book: newPartidaRaw.book_number, page: newPartidaRaw.page_number, entry: newPartidaRaw.entry_number },
            createdAt: new Date().toISOString()
        };

        const correctionsKey = `baptismCorrections_${parishId}`;
        let corrections = safeJsonParse(localStorage.getItem(correctionsKey), []);
        corrections.push(decreeRecord);
        localStorage.setItem(correctionsKey, JSON.stringify(corrections));
        
        try {
           await supabase.from('decretos').insert([{ id: decreeId, parish_id: parishId, tipo: 'correccion', payload: decreeRecord }]);
        } catch(e) {}

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto ejecutado y respaldado con notas.", data: decreeRecord };
    } catch (e) {
        return { success: false, message: e.message };
    }
};

export const updateBaptismCorrection = async (id, updatedData, parishId) => {
    try {
        const correctionsKey = `baptismCorrections_${parishId}`;
        let corrections = safeJsonParse(localStorage.getItem(correctionsKey), []);
        const index = corrections.findIndex(c => c.id === id);
        if (index === -1) return { success: false, message: "Decreto no encontrado" };
        
        corrections[index] = { ...corrections[index], ...updatedData, updatedAt: new Date().toISOString() };
        localStorage.setItem(correctionsKey, JSON.stringify(corrections));
        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto actualizado." };
    } catch (e) {
        return { success: false, message: e.message };
    }
};

export const getDecrees = (parishId, sacramentType) => {
    if (!parishId || !sacramentType) return [];
    return safeJsonParse(localStorage.getItem(`decrees_${sacramentType}_${parishId}`), []);
};

export const addDecreesFromJSON = async (decreeRecords, sacramentType) => {
    try {
        const authUser = safeJsonParse(localStorage.getItem('user'), {}); 
        const parishId = authUser.parishId || (safeJsonParse(localStorage.getItem('parishes'), [])[0]?.id);
        if (!parishId) return { success: false, message: "No se pudo identificar la parroquia actual." };

        const storageKey = `decrees_${sacramentType}_${parishId}`;
        const currentRecords = safeJsonParse(localStorage.getItem(storageKey), []);
        const { newDecrees, duplicateDecrees } = separateNewAndDuplicateDecrees(decreeRecords, currentRecords);
        
        if (newDecrees.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify([...currentRecords, ...newDecrees]));
        }

        return { 
            success: true, 
            message: `${newDecrees.length} decretos importados.${duplicateDecrees.length > 0 ? ` Se omitieron ${duplicateDecrees.length} duplicados.` : ''}`,
            addedCount: newDecrees.length,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};