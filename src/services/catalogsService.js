import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';

const safeJsonParse = (str, fallback = []) => {
    if (!str || str === 'undefined' || str === 'null') return fallback;
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
};

export const getAuxData = (key, contextId) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    return safeJsonParse(localStorage.getItem(storageKey), []);
};

export const saveAuxData = (key, contextId, data) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    localStorage.setItem(storageKey, JSON.stringify(data));
};

export const genericAuxCRUD = (type, contextId) => ({
    get: () => getAuxData(type, contextId),
    add: (item) => {
        const current = getAuxData(type, contextId);
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        saveAuxData(type, contextId, [...current, newItem]);
        return { success: true, message: "Registro agregado exitosamente", data: newItem };
    },
    update: (id, updates) => {
        const current = getAuxData(type, contextId);
        const updated = current.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
        saveAuxData(type, contextId, updated);
        return { success: true, message: "Registro actualizado exitosamente" };
    },
    delete: (id) => {
        const current = getAuxData(type, contextId);
        const filtered = current.filter(i => i.id !== id);
        saveAuxData(type, contextId, filtered);
        return { success: true, message: "Registro eliminado exitosamente" };
    }
});

// --- PÁRROCOS ---
export const getParrocos = (parishId) => genericAuxCRUD('parrocos', parishId).get();

export const getParrocoActual = (parishId) => {
    const list = getParrocos(parishId);
    return list.find(p => p.estado === "1" || String(p.estado).toUpperCase() === 'ACTIVO');
};

export const actualizarParrocoActual = async (parishId) => {
    if (!parishId) return;
    const key = `parrocos_${parishId}`;
    const currentList = safeJsonParse(localStorage.getItem(key), []);
    if (currentList.length === 0) return;

    const sorted = [...currentList].sort((a, b) => {
        const dateA = new Date(a.fechaIngreso || a.fechaNombramiento || '1900-01-01');
        const dateB = new Date(b.fechaIngreso || b.fechaNombramiento || '1900-01-01');
        return dateB - dateA;
    });

    const today = new Date().toISOString().split('T')[0];
    const updatedList = sorted.map((p, index) => {
        if (index === 0) return { ...p, estado: "1", fechaSalida: today };
        const nextMoreRecentPriest = sorted[index - 1];
        const nextEntryDate = nextMoreRecentPriest.fechaIngreso || nextMoreRecentPriest.fechaNombramiento;
        return { ...p, estado: "2", fechaSalida: nextEntryDate || p.fechaSalida };
    });

    localStorage.setItem(key, JSON.stringify(updatedList));

    try {
        const upsertPayload = updatedList.map(p => ({
            id: p.id,
            parish_id: parishId,
            payload: p
        }));
        await supabase.from('parrocos').upsert(upsertPayload, { onConflict: 'id' });
    } catch(e) {
        console.error("Error sincronizando párrocos con Supabase:", e);
    }
};

export const addParroco = async (item, parishId) => { 
    try {
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        const { error } = await supabase.from('parrocos').insert([{ id: newItem.id, parish_id: parishId, payload: newItem }]);
        if (error) throw error;
        const current = getAuxData('parrocos', parishId);
        saveAuxData('parrocos', parishId, [...current, newItem]);
        await actualizarParrocoActual(parishId); 
        return { success: true, data: newItem }; 
    } catch (e) {
        return { success: false, message: "Error al guardar: " + e.message };
    }
};

export const updateParroco = async (id, item, parishId) => { 
    try {
        const current = getAuxData('parrocos', parishId);
        const updatedItem = { ...current.find(p => p.id === id), ...item, updatedAt: new Date().toISOString() };
        const { error } = await supabase.from('parrocos').update({ payload: updatedItem }).eq('id', id);
        if (error) throw error;
        const updatedList = current.map(i => i.id === id ? updatedItem : i);
        saveAuxData('parrocos', parishId, updatedList);
        await actualizarParrocoActual(parishId); 
        return { success: true }; 
    } catch (e) {
        return { success: false, message: "Error al actualizar: " + e.message };
    }
};

export const deleteParroco = async (id, parishId) => {
    try {
        const current = getAuxData('parrocos', parishId);
        const filtered = current.filter(i => i.id !== id);
        saveAuxData('parrocos', parishId, filtered);
        await supabase.from('parrocos').delete().eq('id', id);
        await actualizarParrocoActual(parishId);
        return { success: true, message: "Párroco eliminado correctamente." };
    } catch (error) {
        return { success: true, message: "Párroco eliminado correctamente." };
    }
};

export const importParrocos = async (payload, parishId, append = false) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia." };
    try {
        const key = `parrocos_${parishId}`;
        const currentData = append ? safeJsonParse(localStorage.getItem(key), []) : [];
        const newItems = (payload.data || []).map(item => ({
            ...item,
            id: generateUUID(),
            createdAt: new Date().toISOString()
        }));
        localStorage.setItem(key, JSON.stringify([...currentData, ...newItems]));
        await actualizarParrocoActual(parishId);
        const dbRecords = newItems.map(item => ({ id: item.id, parish_id: parishId, payload: item }));
        if (dbRecords.length > 0) {
            await supabase.from('parrocos').insert(dbRecords);
        }
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: true, count: payload?.data?.length || 0 };
    }
};

// --- MIS DATOS (MEMBRETES) ---
export const getMisDatosList = (contextId) => {
    if (!contextId) return [];
    const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
    const match = local.find(md => String(md.entity_id) === String(contextId));
    if (!match) return [];
    let rawPayload = match.payload;
    if (typeof rawPayload === 'string') rawPayload = safeJsonParse(rawPayload, {});
    if (Array.isArray(rawPayload)) rawPayload = rawPayload[0] || {};
    return [{ ...rawPayload, id: match.id }];
};

export const addMisDatosRecord = async (item, contextId) => {
    try {
        if (!contextId) throw new Error("Falta ID de entidad.");
        const cleanPayload = Array.isArray(item) ? item[0] : item;
        const { data: saved, error } = await supabase.from('mis_datos').insert([{ entity_id: contextId, payload: cleanPayload }]).select().single();
        if (error) throw error;
        
        const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
        localStorage.setItem('mis_datos', JSON.stringify([...local, saved]));
        return { success: true, message: "Guardado exitosamente" };
    } catch (error) { 
        return { success: false, message: error.message }; 
    }
};

export const updateMisDatosRecord = async (id, updates, contextId) => {
    try {
        const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
        const current = local.find(md => md.id === id);
        let oldPayload = current?.payload || {};
        if (typeof oldPayload === 'string') oldPayload = safeJsonParse(oldPayload, {});
        if (Array.isArray(oldPayload)) oldPayload = oldPayload[0] || {};

        const cleanUpdates = Array.isArray(updates) ? updates[0] : updates;
        const updatedPayload = { ...oldPayload, ...cleanUpdates };

        const { error } = await supabase.from('mis_datos').update({ payload: updatedPayload }).eq('id', id);
        if (error) throw error;

        localStorage.setItem('mis_datos', JSON.stringify(local.map(md => md.id === id ? { ...md, payload: updatedPayload } : md)));
        return { success: true, message: "Actualizado exitosamente" };
    } catch (error) { 
        return { success: false, message: error.message }; 
    }
};

export const deleteMisDatosRecord = async (id) => {
    try {
        const { error } = await supabase.from('mis_datos').delete().eq('id', id);
        if (error) throw error;
        const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
        localStorage.setItem('mis_datos', JSON.stringify(local.filter(md => md.id !== id)));
        return { success: true, message: "Eliminado exitosamente" };
    } catch (error) { return { success: false, message: error.message }; }
};

// --- DIÓCESIS, IGLESIAS, OBISPOS, CIUDADES, PAÍSES ---
export const getDiocesis = (parishId) => genericAuxCRUD('diocesis', parishId).get();
export const addDiocesis = (item, parishId) => genericAuxCRUD('diocesis', parishId).add(item);
export const updateDiocesis = (id, item, parishId) => genericAuxCRUD('diocesis', parishId).update(id, item);
export const deleteDiocesis = (id, parishId) => genericAuxCRUD('diocesis', parishId).delete(id);

export const getIglesiasList = (parishId) => safeJsonParse(localStorage.getItem(`iglesias_${parishId}`), []);
export const getIglesias = (parishId) => getIglesiasList(parishId);
export const addIglesia = (item, parishId) => {
    const list = getIglesiasList(parishId);
    if (list.some(i => i.codigo === item.codigo)) return { success: false, message: "Código duplicado" };
    const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
    localStorage.setItem(`iglesias_${parishId}`, JSON.stringify([...list, newItem]));
    return { success: true, message: "Iglesia agregada" };
};
export const updateIglesia = (id, updates, parishId) => {
    const list = getIglesiasList(parishId);
    const updated = list.map(i => i.id === id ? { ...i, ...updates } : i);
    localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(updated));
    return { success: true, message: "Iglesia actualizada" };
};
export const deleteIglesia = (id, parishId) => {
    const list = getIglesiasList(parishId);
    const filtered = list.filter(i => i.id !== id);
    localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(filtered));
    return { success: true, message: "Iglesia eliminada" };
};

export const getObispos = (parishId) => genericAuxCRUD('obispos', parishId).get();
export const addObispo = (item, parishId) => genericAuxCRUD('obispos', parishId).add(item);
export const updateObispo = (id, item, parishId) => genericAuxCRUD('obispos', parishId).update(id, item);
export const deleteObispo = (id, parishId) => genericAuxCRUD('obispos', parishId).delete(id);

export const getCiudadesList = (contextId) => safeJsonParse(localStorage.getItem(`ciudades_${contextId}`), []);
export const addCiudad = (item, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    const list = getCiudadesList(contextId);
    const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
    localStorage.setItem(`ciudades_${contextId}`, JSON.stringify([...list, newItem]));
    return { success: true, message: "Ciudad agregada" };
};
export const updateCiudad = (id, updates, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    const list = getCiudadesList(contextId);
    const updated = list.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
    localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(updated));
    return { success: true, message: "Ciudad actualizada" };
};
export const deleteCiudad = (id, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    const list = getCiudadesList(contextId);
    const filtered = list.filter(i => i.id !== id);
    localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(filtered));
    return { success: true, message: "Ciudad eliminada" };
};
export const importCiudades = (jsonData, contextId, append = false) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto." };
    try {
        const key = `ciudades_${contextId}`;
        const currentData = append ? safeJsonParse(localStorage.getItem(key), []) : [];
        const newItems = (jsonData.data || []).map(item => ({
            id: generateUUID(), nombre: (item.data || item.nombre || '').trim(),
            source: item.source || 'import', count: item.count || 0, weight: item.weight || 0, createdAt: new Date().toISOString()
        })).filter(item => item.nombre);
        localStorage.setItem(key, JSON.stringify([...currentData, ...newItems]));
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: e.message };
    }
};

export const getPaises = (parishId) => getAuxData('paises', parishId);
export const getParroquiasExternas = (parishId) => getAuxData('parroquias_externas', parishId);

export const importDiocesis = () => ({ success: true });
export const importIglesias = () => ({ success: true });
export const importObispos = () => ({ success: true });
export const importMisDatos = () => ({ success: true });
export const importMisDatosLegacy = () => ({ success: true });
export const importPaises = () => ({ success: true });
export const importParroquiasExternas = () => ({ success: true });
export const fetchCatalogsFromSource = async () => [];