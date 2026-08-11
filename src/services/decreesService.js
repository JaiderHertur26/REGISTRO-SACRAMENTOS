import { supabase } from '@/lib/supabaseClient';
import { generateUUID, incrementPaddedValue } from '@/utils/supabaseHelpers';
import { separateNewAndDuplicateDecrees } from '@/utils/decreeJsonMapper';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { obtenerNotasAlMargen, generarNotaAlMargenAnulada, generarNotaAlMargenNuevaPartida } from './marginalNotesService';
import { getParrocoActual, getMisDatosList } from './catalogsService';
import { calculateNextConsecutive } from './sacramentParametersService';
import { saveBaptismToSource } from './sacramentsService';

// --- CONCEPTOS DE ANULACIÓN ---
export const getConceptosAnulacion = (parishId) => {
    if (!parishId) return [];
    const key = `conceptosAnulacion_${parishId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
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
    return JSON.parse(localStorage.getItem(`decreeReplacementBaptism_${parishId}`) || '[]');
};

export const saveDecreeReplacementBaptism = async (decreeData, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const decreeId = decreeData.id || generateUUID();
    const newDecree = { ...decreeData, id: decreeId, createdAt: new Date().toISOString() };

    supabase.from('decretos').insert([{ id: decreeId, parish_id: parishId, tipo: 'reposicion', payload: newDecree }]).then();

    const key = `decreeReplacementBaptism_${parishId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...current, newDecree]));
    return { success: true, data: newDecree };
};

export const getDecreeReplacements = (parishId) => {
    if (!parishId) return [];
    const key = `decreeReplacements_${parishId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
};

export const getDecreeReplacementsBySacrament = (sacramentType, parishId) => {
    if (!parishId) return [];
    const key = `decreeReplacements_${parishId}`;
    const all = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (sacramentType === 'bautismo') {
        const specific = getDecreeReplacementBaptisms(parishId);
        return [...all.filter(d => d.sacrament === 'bautismo' || d.type === 'replacement'), ...specific];
    }
    if (!sacramentType) return all;
    return all.filter(d => d.sacrament === sacramentType);
};

export const getDecreeReplacementByNewBaptismId = (newBaptismIdRepo, parishId) => {
    if (!parishId || !newBaptismIdRepo) return null;
    const key = `decreeReplacements_${parishId}`;
    const all = JSON.parse(localStorage.getItem(key) || '[]');
    const found = all.find(d => d.newBaptismIdRepo === newBaptismIdRepo || d.newPartidaId === newBaptismIdRepo);
    if (found) return found;
    
    const specific = getDecreeReplacementBaptisms(parishId);
    return specific.find(d => d.newPartidaId === newBaptismIdRepo);
};

export const createDecreeReplacement = async (decreeData, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    const key = `decreeReplacements_${parishId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    
    const decreeId = decreeData.id || generateUUID();
    const newDecree = { ...decreeData, id: decreeId, createdAt: new Date().toISOString(), status: 'active' };

    supabase.from('decretos').insert([{ id: decreeId, parish_id: parishId, tipo: 'reposicion', payload: newDecree }]).then();
    
    const updated = [...current, newDecree];
    localStorage.setItem(key, JSON.stringify(updated));
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
                raw.replacementDecreeRef = decNum;
                raw.decreeNumber = decNum;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', newId);
            }
        }

        if (origId) {
            const { data: origData } = await supabase.from('baptisms').select('raw_data').eq('id', origId).single();
            if (origData && origData.raw_data) {
                let raw = origData.raw_data;
                raw.annulmentDecree = decNum;
                raw.annulmentDate = decDate;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', origId);
            }
        }

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto de reposición y partidas actualizadas en la Nube." };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const deleteDecreeReplacement = async (decreeId, parishId) => {
    try {
        if (!parishId) return { success: true };
        
        const specificKey = `decreeReplacementBaptism_${parishId}`;
        const key = `decreeReplacements_${parishId}`;
        
        let specific = JSON.parse(localStorage.getItem(specificKey) || '[]');
        let current = JSON.parse(localStorage.getItem(key) || '[]');
        
        const decreeToDelete = current.find(d => d.id === decreeId) || specific.find(d => d.id === decreeId);
        
        if (specific.some(d => d.id === decreeId)) {
            localStorage.setItem(specificKey, JSON.stringify(specific.filter(d => d.id !== decreeId)));
        }
        const updated = current.filter(d => d.id !== decreeId);
        localStorage.setItem(key, JSON.stringify(updated));

        if (!decreeToDelete) {
            window.dispatchEvent(new Event('storage'));
            return { success: true };
        }

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
             const filteredParishR = parishReplacements.filter(c => String(c.decreeNumber || c.numeroDecreto) !== decNum);
             localStorage.setItem(parishReplacementsKey, JSON.stringify(filteredParishR));
        }
        
        try {
            await supabase.from('decretos').delete().eq('id', decreeId);
            if (decreeToDelete.newPartidaId) {
                await supabase.from('baptisms').delete().eq('id', decreeToDelete.newPartidaId);
            }
        } catch (cloudErr) {}

        window.dispatchEvent(new Event('storage'));
        return { success: true };
    } catch (error) {
        window.dispatchEvent(new Event('storage'));
        return { success: true };
    }
};

// --- DECRETOS DE CORRECCIÓN ---
export const getBaptismCorrections = (parishId) => {
    if (!parishId) return [];
    const key = `baptismCorrections_${parishId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
};

export const deleteBaptismCorrection = async (id, parishId) => {
    try {
        if (!parishId) return { success: true };
        const correctionsKey = `baptismCorrections_${parishId}`;

        let corrections = JSON.parse(localStorage.getItem(correctionsKey) || '[]');
        const decreeToDelete = corrections.find(c => c.id === id);

        const updatedCorrections = corrections.filter(c => c.id !== id);
        localStorage.setItem(correctionsKey, JSON.stringify(updatedCorrections));

        if (!decreeToDelete) {
            window.dispatchEvent(new Event('storage'));
            return { success: true };
        }

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
            const filteredParish = parishCorrections.filter(c => String(c.decreeNumber || c.numeroDecreto) !== decNum);
            localStorage.setItem(parishCorrectionsKey, JSON.stringify(filteredParish));
        }

        try {
            await supabase.from('decretos').delete().eq('id', id);
            if (decreeToDelete.newPartidaId) {
                await supabase.from('baptisms').delete().eq('id', decreeToDelete.newPartidaId);
            }
        } catch (cloudErr) {}

        window.dispatchEvent(new Event('storage'));
        return { success: true };
    } catch (e) {
        window.dispatchEvent(new Event('storage'));
        return { success: true };
    }
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
        
        const parrocoActivo = getParrocoActual(parishId);
        const nombreSacerdote = parrocoActivo ? `${parrocoActivo.nombre || ''} ${parrocoActivo.apellido || ''}`.trim().toUpperCase() : 'PÁRROCO ENCARGADO';
        
        const decretoObj = { numero: decreeData.decreeNumber, fecha: decreeData.decreeDate, oficina: 'CANCILLERÍA' };
        const partidaNuevaObj = { libro: String(params.suplementarioLibro).padStart(4, '0'), folio: String(params.suplementarioFolio).padStart(4, '0'), numero: String(params.suplementarioNumero).padStart(4, '0') };
        const partidaAnuladaObj = { libro: String(originalPartida.book_number || originalPartida.libro).padStart(4, '0'), folio: String(originalPartida.page_number || originalPartida.folio).padStart(4, '0'), numero: String(originalPartida.entry_number || originalPartida.numero).padStart(4, '0') };

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
        let corrections = JSON.parse(localStorage.getItem(correctionsKey) || '[]');
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
                raw.annulmentDecree = decNum;
                raw.annulmentDate = decDate;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', origId);
            }
        }

        if (newId) {
            const { data: newData } = await supabase.from('baptisms').select('raw_data').eq('id', newId).single();
            if (newData && newData.raw_data) {
                let raw = newData.raw_data;
                raw.correctionDecreeRef = decNum;
                raw.decreeNumber = decNum;
                if (updatedData.conceptoAnulacionId) raw.conceptoAnulacionId = updatedData.conceptoAnulacionId;
                await supabase.from('baptisms').update({ raw_data: raw }).eq('id', newId);
            }
        }

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto y partidas actualizados en la Nube." };
    } catch (e) {
        return { success: false, message: e.message };
    }
};

export const getDecrees = (parishId, sacramentType) => {
    if (!parishId || !sacramentType) return [];
    const key = `decrees_${sacramentType}_${parishId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
};

export const addDecreesFromJSON = async (decreeRecords, sacramentType) => {
    try {
        const authUser = JSON.parse(localStorage.getItem('user') || '{}'); 
        const parishId = authUser.parishId || (JSON.parse(localStorage.getItem('parishes') || '[]')[0]?.id);
        if (!parishId) return { success: false, message: "No se pudo identificar la parroquia actual para la importación." };

        const storageKey = `decrees_${sacramentType}_${parishId}`;
        const currentRecords = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const { newDecrees, duplicateDecrees } = separateNewAndDuplicateDecrees(decreeRecords, currentRecords);
        
        if (newDecrees.length > 0) {
            const updatedRecords = [...currentRecords, ...newDecrees];
            localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
        }

        return { 
            success: true, 
            message: `${newDecrees.length} decretos importados correctamente.${duplicateDecrees.length > 0 ? ` Se ignoraron ${duplicateDecrees.length} duplicados.` : ''}`,
            addedCount: newDecrees.length,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};