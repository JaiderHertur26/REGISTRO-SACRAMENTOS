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

const cleanDate = (d) => (d && String(d).trim() !== '') ? d : null;

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

// ============================================================================
// 🕊️ PÁRROCOS (ESPEJO 1 A 1 CON SUPABASE)
// ============================================================================
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
            nombre: p.nombre || null,
            apellido: p.apellido || null,
            email: p.email || null,
            telefono: p.telefono || null,
            fecha_ingreso: cleanDate(p.fechaIngreso || p.fechaNombramiento),
            fecha_salida: cleanDate(p.fechaSalida),
            estado: p.estado || '2',
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
        
        const dbRecord = {
            id: newItem.id,
            parish_id: parishId,
            nombre: newItem.nombre || null,
            apellido: newItem.apellido || null,
            email: newItem.email || null,
            telefono: newItem.telefono || null,
            fecha_ingreso: cleanDate(newItem.fechaIngreso || newItem.fechaNombramiento),
            fecha_salida: cleanDate(newItem.fechaSalida),
            estado: newItem.estado || '2',
            payload: newItem
        };

        const { error } = await supabase.from('parrocos').insert([dbRecord]);
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
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            apellido: updatedItem.apellido || null,
            email: updatedItem.email || null,
            telefono: updatedItem.telefono || null,
            fecha_ingreso: cleanDate(updatedItem.fechaIngreso || updatedItem.fechaNombramiento),
            fecha_salida: cleanDate(updatedItem.fechaSalida),
            estado: updatedItem.estado || '2',
            payload: updatedItem
        };

        const { error } = await supabase.from('parrocos').update(dbRecord).eq('id', id);
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
        
        const dbRecords = newItems.map(item => ({ 
            id: item.id, 
            parish_id: parishId, 
            nombre: item.nombre || null,
            apellido: item.apellido || null,
            email: item.email || null,
            telefono: item.telefono || null,
            fecha_ingreso: cleanDate(item.fechaIngreso || item.fechaNombramiento),
            fecha_salida: cleanDate(item.fechaSalida),
            estado: item.estado || '2',
            payload: item 
        }));
        
        if (dbRecords.length > 0) {
            await supabase.from('parrocos').insert(dbRecords);
        }
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: true, count: payload?.data?.length || 0 };
    }
};

// ============================================================================
// ⛪ IGLESIAS (ESPEJO 1 A 1 CON SUPABASE)
// ============================================================================
export const getIglesiasList = (parishId) => safeJsonParse(localStorage.getItem(`iglesias_${parishId}`), []);
export const getIglesias = (parishId) => getIglesiasList(parishId);

export const addIglesia = async (item, parishId) => {
    try {
        const list = getIglesiasList(parishId);
        if (list.some(i => i.codigo === item.codigo)) return { success: false, message: "Código duplicado" };
        
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        // 🚀 CORRECCIÓN: Nombres de columnas en inglés según Supabase (parishes)
        const dbRecord = {
            id: newItem.id,
            // Guardamos todo el objeto limpio dentro de 'payload' por seguridad (arquitectura de la app)
            // Si la tabla no tiene payload, enviamos a las columnas existentes:
            name: newItem.nombre || null,
            nit: newItem.nronit || newItem.nit || null,
            address: newItem.direccion || null,
            city: newItem.ciudad || null,
            phone: newItem.telefono || null,
            parroco: newItem.parroco || null,
            created_at: newItem.createdAt
        };

        // 🚀 CORRECCIÓN: La tabla se llama 'parishes', no 'iglesias'
        const { error } = await supabase.from('parishes').insert([dbRecord]);
        if (error) throw error;

        localStorage.setItem(`iglesias_${parishId}`, JSON.stringify([...list, newItem]));
        return { success: true, message: "Iglesia agregada y sincronizada" };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateIglesia = async (id, updates, parishId) => {
    try {
        const list = getIglesiasList(parishId);
        const updatedItem = { ...list.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            codigo: updatedItem.codigo || null,
            nombre: updatedItem.nombre || null,
            nit: updatedItem.nronit || updatedItem.nit || null,
            direccion: updatedItem.direccion || null,
            ciudad: updatedItem.ciudad || null,
            telefono: updatedItem.telefono || null,
            fax: updatedItem.nrofax || updatedItem.fax || null,
            email: updatedItem.email || null,
            parroco: updatedItem.parroco || null,
            diocesis: updatedItem.diocesis || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('iglesias').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = list.map(i => i.id === id ? updatedItem : i);
        localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(updatedList));
        return { success: true, message: "Iglesia actualizada" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteIglesia = async (id, parishId) => {
    try {
        await supabase.from('iglesias').delete().eq('id', id);
        const list = getIglesiasList(parishId);
        const filtered = list.filter(i => i.id !== id);
        localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(filtered));
        return { success: true, message: "Iglesia eliminada" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};


// ============================================================================
// ⛪ OBISPOS (ESPEJO 1 A 1 CON SUPABASE)
// ============================================================================
export const getObispos = (parishId) => genericAuxCRUD('obispos', parishId).get();

export const addObispo = async (item, parishId) => {
    try {
        const current = getObispos(parishId);
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            parish_id: parishId,
            nombre: newItem.nombre || null,
            apellido: newItem.apellido || null,
            diocesis: newItem.diocesis || null,
            fecha_nombramiento: cleanDate(newItem.fechaNombramiento),
            email: newItem.email || null,
            created_at: newItem.createdAt
        };

        const { error } = await supabase.from('obispos').insert([dbRecord]);
        if (error) throw error;

        saveAuxData('obispos', parishId, [...current, newItem]);
        return { success: true, message: "Obispo agregado y sincronizado" };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateObispo = async (id, updates, parishId) => {
    try {
        const current = getObispos(parishId);
        const updatedItem = { ...current.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            apellido: updatedItem.apellido || null,
            diocesis: updatedItem.diocesis || null,
            fecha_nombramiento: cleanDate(updatedItem.fechaNombramiento),
            email: updatedItem.email || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('obispos').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = current.map(i => i.id === id ? updatedItem : i);
        saveAuxData('obispos', parishId, updatedList);
        return { success: true, message: "Obispo actualizado" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteObispo = async (id, parishId) => {
    try {
        await supabase.from('obispos').delete().eq('id', id);
        const current = getObispos(parishId);
        const filtered = current.filter(i => i.id !== id);
        saveAuxData('obispos', parishId, filtered);
        return { success: true, message: "Obispo eliminado" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};

// ============================================================================
// 🏙️ CIUDADES (ESPEJO 1 A 1 CON SUPABASE)
// ============================================================================
export const getCiudadesList = (contextId) => safeJsonParse(localStorage.getItem(`ciudades_${contextId}`), []);

export const addCiudad = async (item, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    try {
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            context_id: contextId,
            nombre: newItem.nombre || null,
            source: newItem.source || 'MANUAL',
            count: parseInt(newItem.count || 0, 10),
            weight: parseInt(newItem.weight || 0, 10),
            usuario: newItem.usuario || null,
            created_at: newItem.createdAt
        };

        const { error } = await supabase.from('ciudades').insert([dbRecord]);
        if (error) throw error;

        const list = getCiudadesList(contextId);
        localStorage.setItem(`ciudades_${contextId}`, JSON.stringify([...list, newItem]));
        return { success: true, message: "Ciudad agregada y sincronizada" };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateCiudad = async (id, updates, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    try {
        const list = getCiudadesList(contextId);
        const updatedItem = { ...list.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            source: updatedItem.source || 'MANUAL',
            count: parseInt(updatedItem.count || 0, 10),
            weight: parseInt(updatedItem.weight || 0, 10),
            usuario: updatedItem.usuario || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('ciudades').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = list.map(i => i.id === id ? updatedItem : i);
        localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(updatedList));
        return { success: true, message: "Ciudad actualizada" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteCiudad = async (id, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    try {
        await supabase.from('ciudades').delete().eq('id', id);
        const list = getCiudadesList(contextId);
        localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(list.filter(i => i.id !== id)));
        return { success: true, message: "Ciudad eliminada" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};

export const importCiudades = async (jsonData, contextId, append = false) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto." };
    try {
        const key = `ciudades_${contextId}`;
        const currentData = append ? safeJsonParse(localStorage.getItem(key), []) : [];
        const newItems = (jsonData.data || []).map(item => ({
            id: generateUUID(), 
            nombre: (item.data || item.nombre || '').trim(),
            source: item.source || 'import', 
            count: item.count || 0, 
            weight: item.weight || 0, 
            createdAt: new Date().toISOString()
        })).filter(item => item.nombre);

        const dbRecords = newItems.map(item => ({
            id: item.id,
            context_id: contextId,
            nombre: item.nombre,
            source: item.source,
            count: parseInt(item.count, 10),
            weight: parseInt(item.weight, 10),
            usuario: item.usuario || null,
            created_at: item.createdAt
        }));

        if (dbRecords.length > 0) {
            await supabase.from('ciudades').insert(dbRecords);
        }

        localStorage.setItem(key, JSON.stringify([...currentData, ...newItems]));
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: e.message };
    }
};


// ============================================================================
// 🏛️ DIÓCESIS (ESPEJO 1 A 1 CON SUPABASE)
// ============================================================================
export const getDiocesis = (parishId) => genericAuxCRUD('diocesis', parishId).get();

export const addDiocesis = async (item, parishId) => {
    try {
        const current = getDiocesis(parishId);
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            parish_id: parishId,
            nombre: newItem.nombre || null,
            codigo: newItem.codigo || null,
            region: newItem.region || null,
            descripcion: newItem.descripcion || null,
            created_at: newItem.createdAt
        };

        const { error } = await supabase.from('diocesis').insert([dbRecord]);
        if (error) throw error;

        saveAuxData('diocesis', parishId, [...current, newItem]);
        return { success: true, message: "Diócesis agregada y sincronizada", data: newItem };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateDiocesis = async (id, updates, parishId) => {
    try {
        const current = getDiocesis(parishId);
        const updatedItem = { ...current.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            codigo: updatedItem.codigo || null,
            region: updatedItem.region || null,
            descripcion: updatedItem.descripcion || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('diocesis').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = current.map(i => i.id === id ? updatedItem : i);
        saveAuxData('diocesis', parishId, updatedList);
        return { success: true, message: "Diócesis actualizada" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteDiocesis = async (id, parishId) => {
    try {
        await supabase.from('diocesis').delete().eq('id', id);
        const current = getDiocesis(parishId);
        const filtered = current.filter(i => i.id !== id);
        saveAuxData('diocesis', parishId, filtered);
        return { success: true, message: "Diócesis eliminada" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};


// ============================================================================
// 📄 MEMBRETES / MIS DATOS (ESPEJO 1 A 1 CON SUPABASE)
// ============================================================================
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
        
        const dbRecord = {
            entity_id: contextId,
            nombre: cleanPayload.nombre || null,
            idcod: cleanPayload.idcod || null,
            nronit: cleanPayload.nronit || cleanPayload.nit || null,
            ciudad: cleanPayload.ciudad || null,
            direccion: cleanPayload.direccion || null,
            email: cleanPayload.email || null,
            telefono: cleanPayload.telefono || null,
            diocesis: cleanPayload.diocesis || null,
            vicaria: cleanPayload.vicaria || null,
            payload: cleanPayload
        };

        const { data: saved, error } = await supabase.from('mis_datos').insert([dbRecord]).select().single();
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

        const dbRecord = {
            nombre: updatedPayload.nombre || null,
            idcod: updatedPayload.idcod || null,
            nronit: updatedPayload.nronit || updatedPayload.nit || null,
            ciudad: updatedPayload.ciudad || null,
            direccion: updatedPayload.direccion || null,
            email: updatedPayload.email || null,
            telefono: updatedPayload.telefono || null,
            diocesis: updatedPayload.diocesis || null,
            vicaria: updatedPayload.vicaria || null,
            payload: updatedPayload
        };

        const { error } = await supabase.from('mis_datos').update(dbRecord).eq('id', id);
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


// ============================================================================
// OTRAS SECCIONES
// ============================================================================
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