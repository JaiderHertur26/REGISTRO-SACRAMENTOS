import { generateUUID } from '@/utils/supabaseHelpers';

const getAuxData = (key, contextId) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
};

const saveAuxData = (key, contextId, data) => {
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

export const getDiocesis = (parishId) => genericAuxCRUD('diocesis', parishId).get();
export const addDiocesis = (item, parishId) => genericAuxCRUD('diocesis', parishId).add(item);
export const updateDiocesis = (id, item, parishId) => genericAuxCRUD('diocesis', parishId).update(id, item);
export const deleteDiocesis = (id, parishId) => genericAuxCRUD('diocesis', parishId).delete(id);

export const getIglesiasList = (parishId) => JSON.parse(localStorage.getItem(`iglesias_${parishId}`) || '[]');
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

export const getCiudadesList = (contextId) => JSON.parse(localStorage.getItem(`ciudades_${contextId}`) || '[]');
export const addCiudad = (item, contextId) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    const list = getCiudadesList(contextId);
    const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
    localStorage.setItem(`ciudades_${contextId}`, JSON.stringify([...list, newItem]));
    return { success: true, message: "Ciudad agregada" };
};
export const updateCiudad = (id, updates, contextId) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    const list = getCiudadesList(contextId);
    const updated = list.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
    localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(updated));
    return { success: true, message: "Ciudad actualizada" };
};
export const deleteCiudad = (id, contextId) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    const list = getCiudadesList(contextId);
    const filtered = list.filter(i => i.id !== id);
    localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(filtered));
    return { success: true, message: "Ciudad eliminada" };
};

export const importCiudades = (jsonData, contextId, append = false) => {
    if (!contextId) return { success: false, message: "No se especificó el ID de contexto." };
    try {
        const key = `ciudades_${contextId}`;
        const currentData = append ? JSON.parse(localStorage.getItem(key) || '[]') : [];
        const newItems = jsonData.data.map(item => ({
            id: generateUUID(), nombre: (item.data || item.nombre || '').trim(),
            source: item.source || 'import', count: item.count || 0, weight: item.weight || 0, createdAt: new Date().toISOString()
        })).filter(item => item.nombre);
        localStorage.setItem(key, JSON.stringify([...currentData, ...newItems]));
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: e.message };
    }
};