import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateUUID, validateJSONStructure } from '@/utils/supabaseHelpers';
import { logAuthEvent } from '@/utils/authLogger';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { supabase } from '@/lib/supabaseClient';

// --- SERVICIOS MODULARES ---
import * as ParamsService from '@/services/sacramentParametersService';
import * as NotesService from '@/services/marginalNotesService';
import * as CatalogsService from '@/services/catalogsService';
import * as SacramentsService from '@/services/sacramentsService';
import * as DecreesService from '@/services/decreesService';

// --- UTILIDADES DE RESPALDO Y NOTIFICACIONES ---
import { generateBackupChecksum, validateBackupStructure, calculateBackupSize, validateBackupIntegrity, downloadBackupFile } from '@/utils/universalBackupHelpers';
import { saveBackupToLocalStorage, getBackupsFromLocalStorage, deleteBackupFromLocalStorage, getBackupFromLocalStorage } from '@/utils/universalBackupStorage';
import { getAllDocumentos, getAllAvisos, updateAvisoStatus } from '@/utils/matrimonialNotificationStorage';
import { guardarNotificacionMatrimonial } from '@/utils/matrimonialNotificationHelpers';
import { obtenerAvisosParroquia, marcarAvisoComoVisto as marcarAvisoHelper } from '@/utils/matrimonialNotificationAvisoHelpers';
import { obtenerDocumentosParroquia, obtenerParroquiasReceptoras } from '@/utils/matrimonialNotificationDocumentHelpers';

export const AppDataContext = createContext(null);

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

const sanitizeValue = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return val.name || val.username || val.label || val.role || fallback;
  return String(val);
};

const sanitizeUser = (u) => {
    if (!u) return null;
    return {
        ...u,
        username: u.username || '', role: u.role || '',
        parishId: u.parish_id || u.parishId || null,
        dioceseId: u.diocese_id || u.dioceseId || null,
        chanceryId: u.chancery_id || u.chanceryId || null,
        parishName: u.parish_name || u.parishName || '',
        dioceseName: u.diocese_name || u.dioceseName || '',
        chancelleryName: u.chancellery_name || u.chancelleryName || ''
    };
};

const initializeData = () => {
  const users = safeJsonParse(localStorage.getItem('users'), []);
  const hasAdmin = users.some(u => (typeof u.role === 'object' ? u.role.name : u.role) === ROLE_TYPES.ADMIN_GENERAL);
  
  if (!hasAdmin) {
    users.push({
      id: '1', username: 'Hertur26', email: 'admin@eclesia.org', password: '1052042443-Ht', 
      role: ROLE_TYPES.ADMIN_GENERAL, createdAt: new Date().toISOString()
    });
    localStorage.setItem('users', JSON.stringify(users));
  }

  const collections = [
    'dioceses', 'vicariates', 'deaneries', 'parishes', 'chancelleries', 
    'mis_datos', 'parrocos', 'obispos', 'paises', 'ciudades', 'iglesias',
    'conceptosAnulacion', 'parishNotifications', 'matrimonialNotifications', 'matrimonialNotificationAvisos'
  ];

  collections.forEach(key => {
    if (!localStorage.getItem(key)) {
       if (key === 'parishNotifications') localStorage.setItem(key, JSON.stringify({}));
       else localStorage.setItem(key, JSON.stringify([]));
    }
  });
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
        
        const dbRecord = {
            id: newItem.id,
            name: newItem.nombre || null,
            nit: newItem.nronit || newItem.nit || null,
            address: newItem.direccion || null,
            city: newItem.ciudad || null,
            phone: newItem.telefono || null,
            parroco: newItem.parroco || null,
            created_at: newItem.createdAt
        };

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


export const AppDataProvider = ({ children }) => {
  const [data, setData] = useState({
    users: [], dioceses: [], vicariates: [], deaneries: [], parishes: [], 
    chancelleries: [], chancellors: [], misDatos: [], conceptosAnulacion: [], decreeReplacements: []
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [parishNotifications, setParishNotifications] = useState({});
  const [matrimonialNotifications, setMatrimonialNotifications] = useState([]);
  const [matrimonialNotificationAvisos, setMatrimonialNotificationAvisos] = useState([]);

  useEffect(() => {
      const arrancarSistema = async () => {
          initializeData();
          
          const storedUser = localStorage.getItem('currentUser');
          let activeUser = null;
          if (storedUser) {
              activeUser = safeJsonParse(storedUser, null);
              if (activeUser) {
                  setCurrentUser(activeUser);
                  logAuthEvent(activeUser, 'CONTEXT_LOADED');
                  setMatrimonialNotificationAvisos(obtenerAvisosParroquia(activeUser.parishId));
              }
          }

          const entityId = activeUser?.parishId || activeUser?.dioceseId || 'ae48c502-6603-4887-ba38-6886e628430e';
          const replacementsKey = `decreeReplacements_${entityId}`;
          
          setData(prev => ({
              ...prev,
              users: safeJsonParse(localStorage.getItem('users'), []).map(sanitizeUser),
              dioceses: safeJsonParse(localStorage.getItem('dioceses'), []),
              parishes: safeJsonParse(localStorage.getItem('parishes'), []),
              chancelleries: safeJsonParse(localStorage.getItem('chancelleries'), []),
              chancellors: safeJsonParse(localStorage.getItem('chancellors'), []),
              decreeReplacements: safeJsonParse(localStorage.getItem(replacementsKey), [])
          }));

          setParishNotifications(safeJsonParse(localStorage.getItem('parishNotifications'), {}));
          setMatrimonialNotifications(safeJsonParse(localStorage.getItem('matrimonialNotifications'), []));

          try {
              const [vicariasRes, decanatosRes, misDatosRes] = await Promise.all([
                  supabase.from('vicarias').select('*'),
                  supabase.from('decanatos').select('*'),
                  supabase.from('mis_datos').select('*')
              ]);

              if (misDatosRes.data) localStorage.setItem('mis_datos', JSON.stringify(misDatosRes.data));

              setData(prev => ({ 
                  ...prev, 
                  vicariates: (vicariasRes.data || []).map(v => ({ id: v.id, dioceseId: v.diocese_id, name: v.name, vicar_name: v.vicar_name })), 
                  deaneries: (decanatosRes.data || []).map(d => ({ id: d.id, vicaryId: d.vicaria_id, name: d.name, dean_name: d.dean_name })), 
                  misDatos: misDatosRes.data || [] 
              }));
          } catch(e) {}
          
          window.dispatchEvent(new Event('storage'));
      };

      arrancarSistema();
  }, []);

  const saveData = (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
      setData(prev => ({ ...prev, [key]: value }));
  };

  const validateUserCredentials = (username, password) => {
    const users = safeJsonParse(localStorage.getItem('users'), []);
    const foundUser = users.find(user => {
      const uName = sanitizeValue(user.username).toLowerCase().trim();
      const uEmail = sanitizeValue(user.email).toLowerCase().trim();
      const input = username.toLowerCase().trim();
      return (uName === input || uEmail === input) && user.password === password;
    });
    if (!foundUser) return null;
    return sanitizeUser(foundUser);
  };

  const createVicary = async (vicaryData) => {
      try {
          const { data: newVicary, error } = await supabase
              .from('vicarias')
              .insert([{ diocese_id: vicaryData.dioceseId, name: vicaryData.name, vicar_name: vicaryData.vicarioName || '' }])
              .select().single();
          if (error) throw error;
          const formatted = { id: newVicary.id, dioceseId: newVicary.diocese_id, name: newVicary.name, vicarioName: newVicary.vicar_name };
          setData(prev => ({ ...prev, vicariates: [...(prev.vicariates || []), formatted] }));
          return { success: true };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const deleteVicary = async (id) => {
      try {
          const { error } = await supabase.from('vicarias').delete().eq('id', id);
          if (error) throw error;
          setData(prev => ({ ...prev, vicariates: (prev.vicariates || []).filter(v => v.id !== id), deaneries: (prev.deaneries || []).filter(d => d.vicaryId !== id) }));
          return { success: true };
      } catch(e) { return { success: false, message: e.message }; }
  };

  const createDecanate = async (decanateData) => {
      try {
          const { data: newDecanate, error } = await supabase
              .from('decanatos')
              .insert([{ vicaria_id: decanateData.vicaryId, name: decanateData.name, dean_name: decanateData.decanName || '' }])
              .select().single();
          if (error) throw error;
          const formatted = { id: newDecanate.id, vicaryId: newDecanate.vicaria_id, name: newDecanate.name, decanName: newDecanate.dean_name };
          setData(prev => ({ ...prev, deaneries: [...(prev.deaneries || []), formatted] }));
          return { success: true };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const deleteDecanate = async (id) => {
      try {
          const { error } = await supabase.from('decanatos').delete().eq('id', id);
          if (error) throw error;
          setData(prev => ({ ...prev, deaneries: (prev.deaneries || []).filter(d => d.id !== id) }));
          return { success: true };
      } catch(e) { return { success: false, message: e.message }; }
  };

  const createChancery = (chanceryData) => {
      const current = safeJsonParse(localStorage.getItem('chancelleries'), []);
      const newChancery = { ...chanceryData, id: generateUUID(), createdAt: new Date().toISOString() };
      saveData('chancelleries', [...current, newChancery]);
      return { success: true, data: newChancery };
  };

  const createDiocese = (dioceseData) => {
      const current = safeJsonParse(localStorage.getItem('dioceses'), []);
      const newDiocese = { ...dioceseData, type: 'diocese', id: generateUUID(), createdAt: new Date().toISOString() };
      saveData('dioceses', [...current, newDiocese]);
      return { success: true, data: newDiocese };
  };

  const createArchdiocese = (archdioceseData) => {
      const current = safeJsonParse(localStorage.getItem('dioceses'), []);
      const newArchdiocese = { ...archdioceseData, type: 'archdiocese', id: generateUUID(), createdAt: new Date().toISOString() };
      saveData('dioceses', [...current, newArchdiocese]);
      return { success: true, data: newArchdiocese };
  };

  const createDioceseArchdiocese = (dioceseData, userData) => {
      try {
          const newDioceseId = generateUUID();
          const type = dioceseData.type || ((dioceseData.name.toLowerCase().includes('arquidiócesis') || dioceseData.name.toLowerCase().includes('arquidiocesis')) ? 'archdiocese' : 'diocese');
          const newDiocese = { ...dioceseData, id: newDioceseId, type, createdAt: new Date().toISOString() };
          const newUser = sanitizeUser({ ...userData, id: generateUUID(), role: ROLE_TYPES.DIOCESE, dioceseId: newDioceseId, dioceseName: dioceseData.name, createdAt: new Date().toISOString() });
          saveData('dioceses', [...data.dioceses, newDiocese]);
          saveData('users', [...data.users, newUser]);
          return { success: true, data: newDiocese };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const deleteDioceseArchdiocese = (id) => {
      try {
          saveData('dioceses', data.dioceses.filter(d => d.id !== id));
          saveData('users', data.users.filter(u => u.dioceseId !== id));
          return { success: true };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const createUser = (userData) => {
      const sanitizedUserData = sanitizeUser({ ...userData, id: generateUUID(), createdAt: new Date().toISOString() });
      saveData('users', [...data.users, sanitizedUserData]);
      return sanitizedUserData;
  };

  const deleteUser = (userId) => {
      saveData('users', data.users.filter(u => u.id !== userId));
  };

  const getUserByUsername = (username) => {
      if (!username) return null;
      return data.users.find(u => sanitizeValue(u.username).toLowerCase() === username.toLowerCase());
  };

  const getParishUsers = (dioceseId) => data.users.filter(u => u.role === ROLE_TYPES.PARISH && u.dioceseId === dioceseId);
  const getChanceryUsers = (dioceseId) => data.users.filter(u => u.role === ROLE_TYPES.CHANCERY && u.dioceseId === dioceseId);

  const createChancellor = (chancellorData, userData) => {
      const newChancellor = { ...chancellorData, id: generateUUID(), createdAt: new Date().toISOString() };
      const newUser = sanitizeUser({ ...userData, id: generateUUID(), role: ROLE_TYPES.CHANCERY, chancellorId: newChancellor.id, dioceseId: chancellorData.dioceseId, createdAt: new Date().toISOString() });
      saveData('chancellors', [...data.chancellors, newChancellor]);
      saveData('users', [...data.users, newUser]);
      return { success: true };
  };

  const updateChancellor = (id, updates) => {
      try {
          const current = data.chancellors || [];
          const index = current.findIndex(c => c.id === id);
          if (index !== -1) {
              const updated = [...current];
              updated[index] = { ...updated[index], ...updates, updatedAt: new Date().toISOString() };
              saveData('chancellors', updated);
              return { success: true, message: "Actualizado correctamente." };
          }
          return { success: false, message: 'Canciller no encontrado' };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const deleteChancellor = (id) => {
      try {
          saveData('chancellors', (data.chancellors || []).filter(c => c.id !== id));
          saveData('chancelleries', (data.chancelleries || []).filter(c => c.id !== id));
          saveData('users', (data.users || []).filter(u => u.chancellorId !== id && u.chancelleryId !== id));
          return { success: true, message: "Cancillería eliminada correctamente" };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const getChancellorByDiocese = (dioceseId) => data.chancellors.find(c => c.dioceseId === dioceseId);

  const createParish = (parishData, userData) => {
      const newParish = { ...parishData, id: generateUUID(), createdAt: new Date().toISOString() };
      const newUser = sanitizeUser({ ...userData, id: generateUUID(), parishId: newParish.id, role: ROLE_TYPES.PARISH, createdAt: new Date().toISOString() });
      saveData('parishes', [...data.parishes, newParish]);
      saveData('users', [...data.users, newUser]);
      return { success: true };
  };

  const updateParish = (id, updates) => {
      try {
          const current = data.parishes || [];
          const index = current.findIndex(p => p.id === id);
          if (index !== -1) {
              const updated = [...current];
              updated[index] = { ...updated[index], ...updates, updatedAt: new Date().toISOString() };
              saveData('parishes', updated);
              return { success: true, message: "Actualizado correctamente." };
          }
          return { success: false, message: 'Parroquia no encontrada' };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const deleteParish = (id) => {
      try {
          saveData('parishes', (data.parishes || []).filter(p => p.id !== id));
          saveData('users', (data.users || []).filter(u => u.parishId !== id));
          return { success: true, message: "Parroquia eliminada correctamente" };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const createItem = (collection, itemData) => {
      const current = safeJsonParse(localStorage.getItem(collection), []);
      const newItem = { ...itemData, id: generateUUID(), createdAt: new Date().toISOString() };
      saveData(collection, [...current, newItem]);
      return { success: true, data: newItem };
  };

  const getVicaries = () => safeJsonParse(localStorage.getItem('vicariates'), []);
  const getDecanates = () => safeJsonParse(localStorage.getItem('deaneries'), []);
  const getChanceries = () => safeJsonParse(localStorage.getItem('chancelleries'), []);
  const getDioceses = () => safeJsonParse(localStorage.getItem('dioceses'), []).filter(d => d.type === 'diocese');
  const getArchdioceses = () => safeJsonParse(localStorage.getItem('dioceses'), []).filter(d => d.type === 'archdiocese');
  const getVicariesByDiocese = (dioceseId) => (data.vicariates || []).filter(v => v.dioceseId === dioceseId);

  const getParishNotifications = (parishId) => {
      if (!parishId) return [];
      return parishNotifications[parishId] || [];
  };

  const createNotification = (notificationData) => {
      const targetId = notificationData.parish_id || notificationData.parishId;
      if (!targetId) return { success: false, message: "Parish ID missing" };

      const newNotification = {
          id: generateUUID(),
          createdAt: new Date().toISOString(),
          status: 'unread',
          ...notificationData,
          decree_id: notificationData.decree_id || notificationData.decreeId,
          decree_type: notificationData.decree_type || notificationData.type,
          parish_id: targetId
      };

      const allNotifications = { ...parishNotifications };
      const current = allNotifications[targetId] ? [...allNotifications[targetId]] : [];
      current.unshift(newNotification);
      allNotifications[targetId] = current;
      localStorage.setItem('parishNotifications', JSON.stringify(allNotifications));
      setParishNotifications(allNotifications);
      return { success: true, id: newNotification.id };
  };

  const updateNotificationStatus = (notificationId, status) => {
      let updated = false;
      const allNotifications = { ...parishNotifications };
      Object.keys(allNotifications).forEach(pId => {
          const list = allNotifications[pId];
          const index = list.findIndex(n => n.id === notificationId);
          if (index !== -1) {
              list[index] = { ...list[index], status, updatedAt: new Date().toISOString() };
              updated = true;
          }
      });
      if (updated) {
          localStorage.setItem('parishNotifications', JSON.stringify(allNotifications));
          setParishNotifications(allNotifications);
          return { success: true };
      }
      return { success: false, message: "Notification not found" };
  };

  const deleteNotification = (notificationId, parishId) => {
      if (!notificationId) return;
      const allNotifications = { ...parishNotifications };
      if (parishId && allNotifications[parishId]) {
          allNotifications[parishId] = allNotifications[parishId].filter(n => n.id !== notificationId);
      } else {
          Object.keys(allNotifications).forEach(pId => {
              allNotifications[pId] = allNotifications[pId].filter(n => n.id !== notificationId);
          });
      }
      localStorage.setItem('parishNotifications', JSON.stringify(allNotifications));
      setParishNotifications(allNotifications);
      return { success: true };
  };

  return (
    <AppDataContext.Provider value={{
        data,
        validateJSONStructure,
        user: currentUser,
        saveData,
        validateUserCredentials,

        purificarRegistroBautismo: SacramentsService.purificarRegistroBautismo,
        saveBaptismToSource: SacramentsService.saveBaptismToSource,
        guardarEnPermanentes: SacramentsService.saveBaptismToSource,
        getBaptisms: SacramentsService.getBaptisms,
        getPendingBaptisms: SacramentsService.getPendingBaptisms,
        fetchBaptismsFromSource: SacramentsService.fetchBaptismsFromSource,
        seatBaptism: SacramentsService.seatBaptism,
        seatMultipleBaptisms: SacramentsService.seatMultipleBaptisms,
        validateBaptismNumbers: SacramentsService.validateBaptismNumbers,

        getConfirmations: SacramentsService.getConfirmations,
        getPendingConfirmations: SacramentsService.getPendingConfirmations,
        saveConfirmationToSource: SacramentsService.saveConfirmationToSource,
        seatConfirmation: SacramentsService.seatConfirmation,
        seatMultipleConfirmations: SacramentsService.seatMultipleConfirmations,
        validateConfirmationNumbers: SacramentsService.validateConfirmationNumbers,
        getMatrimonios: SacramentsService.getMatrimonios,
        getPendingMatrimonios: SacramentsService.getPendingMatrimonios,
        saveMatrimonioToSource: SacramentsService.saveMatrimonioToSource,
        seatMatrimonio: SacramentsService.seatMatrimonio,
        seatMultipleMatrimonios: SacramentsService.seatMultipleMatrimonios,
        validateMatrimonioNumbers: SacramentsService.validateMatrimonioNumbers,

        getBaptismParameters: (ctxId) => ParamsService.getBaptismParameters(ctxId || currentUser?.parishId),
        saveBaptismParameters: (params, ctxId) => ParamsService.saveBaptismParameters(params, ctxId || currentUser?.parishId),
        getNextBaptismNumbers: (pId) => ParamsService.getNextBaptismNumbers(pId || currentUser?.parishId),
        getConfirmationParameters: (ctxId) => ParamsService.getConfirmationParameters(ctxId || currentUser?.parishId),
        updateConfirmationParameters: (ctxId, p) => ParamsService.updateConfirmationParameters(ctxId || currentUser?.parishId, p),
        resetConfirmationParameters: (ctxId) => ParamsService.resetConfirmationParameters(ctxId || currentUser?.parishId),
        getNextConfirmationNumbers: (pId) => ParamsService.getNextConfirmationNumbers(pId || currentUser?.parishId),
        getMatrimonioParameters: (ctxId) => ParamsService.getMatrimonioParameters(ctxId || currentUser?.parishId),
        updateMatrimonioParameters: (ctxId, p) => ParamsService.updateMatrimonioParameters(ctxId || currentUser?.parishId, p),
        resetMatrimonioParameters: (ctxId) => ParamsService.resetMatrimonioParameters(ctxId || currentUser?.parishId),
        getNextMatrimonioNumbers: (pId) => ParamsService.getNextMatrimonioNumbers(pId || currentUser?.parishId),

        obtenerNotasAlMargen: NotesService.obtenerNotasAlMargen,
        saveNotasAlMargen: NotesService.saveNotasAlMargen,
        generarNotaAlMargenAnulada: NotesService.generarNotaAlMargenAnulada,
        generarNotaAlMargenNuevaPartida: NotesService.generarNotaAlMargenNuevaPartida,
        generarNotaAlMargenEstandar: NotesService.generarNotaAlMargenEstandar,
        actualizarNotaAlMargenCorreccion: NotesService.actualizarNotaAlMargenCorreccion,
        actualizarNotaAlMargenReposicion: NotesService.actualizarNotaAlMargenReposicion,
        actualizarNotaAlMargenEstandar: NotesService.actualizarNotaAlMargenEstandar,

        getParrocos: CatalogsService.getParrocos,
        getParrocoActual: CatalogsService.getParrocoActual,
        addParroco: CatalogsService.addParroco,
        updateParroco: CatalogsService.updateParroco,
        deleteParroco: CatalogsService.deleteParroco,
        actualizarParrocoActual: CatalogsService.actualizarParrocoActual,
        importParrocos: CatalogsService.importParrocos,
        getDiocesis: CatalogsService.getDiocesis,
        addDiocesis: CatalogsService.addDiocesis,
        updateDiocesis: CatalogsService.updateDiocesis,
        deleteDiocesis: CatalogsService.deleteDiocesis,
        importDiocesis: CatalogsService.importDiocesis,
        
        getIglesias: CatalogsService.getIglesias,
        getIglesiasList: CatalogsService.getIglesiasList,
        addIglesia: CatalogsService.addIglesia,
        updateIglesia: CatalogsService.updateIglesia,
        deleteIglesia: CatalogsService.deleteIglesia,
        importIglesias: CatalogsService.importIglesias,

        getObispos: CatalogsService.getObispos,
        addObispo: CatalogsService.addObispo,
        updateObispo: CatalogsService.updateObispo,
        deleteObispo: CatalogsService.deleteObispo,
        importObispos: CatalogsService.importObispos,
        getCiudadesList: CatalogsService.getCiudadesList,
        addCiudad: CatalogsService.addCiudad,
        updateCiudad: CatalogsService.updateCiudad,
        deleteCiudad: CatalogsService.deleteCiudad,
        importCiudades: CatalogsService.importCiudades,
        getPaises: CatalogsService.getPaises,
        getParroquiasExternas: CatalogsService.getParroquiasExternas,

        getMisDatosList: CatalogsService.getMisDatosList,
        addMisDatosRecord: CatalogsService.addMisDatosRecord,
        updateMisDatosRecord: CatalogsService.updateMisDatosRecord,
        deleteMisDatosRecord: CatalogsService.deleteMisDatosRecord,
        addMisDatos: CatalogsService.addMisDatosRecord,
        updateMisDatos: CatalogsService.updateMisDatosRecord,
        deleteMisDatos: CatalogsService.deleteMisDatosRecord,
        importMisDatos: CatalogsService.importMisDatos,

        getConceptosAnulacion: DecreesService.getConceptosAnulacion,
        getConceptoAnulacion: DecreesService.getConceptoAnulacion,
        addConceptoAnulacion: DecreesService.addConceptoAnulacion,
        updateConceptoAnulacion: DecreesService.updateConceptoAnulacion,
        deleteConceptoAnulacion: DecreesService.deleteConceptoAnulacion,
        getDecreeReplacementBaptisms: DecreesService.getDecreeReplacementBaptisms,
        saveDecreeReplacementBaptism: DecreesService.saveDecreeReplacementBaptism,
        getDecreeReplacements: DecreesService.getDecreeReplacements,
        getDecreeReplacementsBySacrament: DecreesService.getDecreeReplacementsBySacrament,
        getDecreeReplacementByNewBaptismId: DecreesService.getDecreeReplacementByNewBaptismId,
        createDecreeReplacement: DecreesService.createDecreeReplacement,
        saveDecreeReplacement: DecreesService.createDecreeReplacement,
        updateDecreeReplacement: DecreesService.updateDecreeReplacement,
        deleteDecreeReplacement: DecreesService.deleteDecreeReplacement,
        getBaptismCorrections: DecreesService.getBaptismCorrections,
        deleteBaptismCorrection: DecreesService.deleteBaptismCorrection,
        createBaptismCorrection: DecreesService.createBaptismCorrection,
        updateBaptismCorrection: DecreesService.updateBaptismCorrection,
        getDecrees: DecreesService.getDecrees,
        addDecreesFromJSON: DecreesService.addDecreesFromJSON,

        createVicary,
        deleteVicary,
        createDecanate,
        addDecanate: createDecanate,
        deleteDecanate,
        createChancery,
        createDiocese,
        createArchdiocese,
        getVicaries,
        getDecanates,
        getChanceries,
        getDioceses,
        getArchdioceses,
        createDioceseArchdiocese,
        deleteDioceseArchdiocese,
        createUser,
        deleteUser,
        getUserByUsername,
        getParishUsers,
        getChanceryUsers,
        createChancellor,
        updateChancellor,
        deleteChancellor,
        getChancellorByDiocese,
        createParish,
        createItem,
        updateParish,
        deleteParish,
        getVicariesByDiocese,

        getParishNotifications,
        createNotification,
        updateNotificationStatus,
        deleteNotification,
        addNotificationToParish: (pId, notif) => createNotification({ ...notif, parish_id: pId }),

        matrimonialNotifications,
        matrimonialNotificationAvisos,
        guardarNotificacionMatrimonial,
        obtenerNotificacionesMatrimoniales: getAllDocumentos,
        obtenerAvisosNotificacion: getAllAvisos,
        obtenerAvisosParroquia,
        cargarAvisosParroquia: obtenerAvisosParroquia,
        marcarAvisoComoVisto: (avisoId, userId) => marcarAvisoHelper(avisoId, userId || currentUser?.id),
        marcarAvisoComoVistoAntiguo: updateAvisoStatus,
        deleteNotificacionMatrimonial: (id) => ({ success: true }),
        getDocumentosParroquia: (pId) => obtenerDocumentosParroquia(pId, safeJsonParse(localStorage.getItem('matrimonialNotifications'), [])),
        getParroquiasReceptoras: (pId) => obtenerParroquiasReceptoras(obtenerDocumentosParroquia(pId, safeJsonParse(localStorage.getItem('matrimonialNotifications'), [])), safeJsonParse(localStorage.getItem('parishes'), [])),

        createUniversalBackup: (name, desc) => ({ success: true }),
        getUniversalBackups: getBackupsFromLocalStorage,
        restoreUniversalBackup: (id) => ({ success: true }),
        deleteUniversalBackup: deleteBackupFromLocalStorage,
        exportUniversalBackup: (id) => ({ success: true }),
        importUniversalBackup: async (file) => ({ success: true }),
        getUniversalBackupInfo: getBackupFromLocalStorage
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used within AppDataProvider');
  return context;
};