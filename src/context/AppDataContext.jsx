import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateUUID, validateJSONStructure, incrementPaddedValue } from '@/utils/supabaseHelpers';
import { separateNewAndDuplicateConfirmations } from '@/utils/confirmationJsonMapper';
import { separateNewAndDuplicateDecrees } from '@/utils/decreeJsonMapper';
import { logAuthEvent } from '@/utils/authLogger';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { supabase } from '@/lib/supabaseClient';

// --- UTILIDADES EXTRAÍDAS ---
import * as ParamsHelper from '@/utils/sacramentSettingsHelpers';
import * as AuxCRUDHelper from '@/utils/auxiliaryCrudHelpers';
import * as BaptismHelper from '@/utils/baptismAndDecreeHelpers';

// --- UTILIDADES DE RESPALDO Y NOTIFICACIONES ---
import { generateBackupChecksum, validateBackupStructure, calculateBackupSize, validateBackupIntegrity, downloadBackupFile } from '@/utils/universalBackupHelpers';
import { saveBackupToLocalStorage, getBackupsFromLocalStorage, deleteBackupFromLocalStorage, getBackupFromLocalStorage } from '@/utils/universalBackupStorage';
import { saveDocumento, getAllDocumentos, getAllAvisos, updateAvisoStatus } from '@/utils/matrimonialNotificationStorage';
import { guardarNotificacionMatrimonial } from '@/utils/matrimonialNotificationHelpers';
import { obtenerAvisosParroquia, marcarAvisoComoVisto as marcarAvisoHelper } from '@/utils/matrimonialNotificationAvisoHelpers';
import { obtenerDocumentosParroquia, obtenerParroquiasReceptoras } from '@/utils/matrimonialNotificationDocumentHelpers';

export const AppDataContext = createContext(null);

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
  const users = JSON.parse(localStorage.getItem('users') || '[]');
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
              activeUser = JSON.parse(storedUser);
              setCurrentUser(activeUser);
              logAuthEvent(activeUser, 'CONTEXT_LOADED');
              setMatrimonialNotificationAvisos(obtenerAvisosParroquia(activeUser.parishId));
          }

          const entityId = activeUser?.parishId || activeUser?.dioceseId;
          const replacementsKey = entityId ? `decreeReplacements_${entityId}` : 'decreeReplacements';
          
          setData(prev => ({
              ...prev,
              users: JSON.parse(localStorage.getItem('users') || '[]').map(sanitizeUser),
              dioceses: JSON.parse(localStorage.getItem('dioceses') || '[]'),
              parishes: JSON.parse(localStorage.getItem('parishes') || '[]'),
              chancelleries: JSON.parse(localStorage.getItem('chancelleries') || '[]'),
              chancellors: JSON.parse(localStorage.getItem('chancellors') || '[]'),
              decreeReplacements: JSON.parse(localStorage.getItem(replacementsKey) || '[]')
          }));

          setParishNotifications(JSON.parse(localStorage.getItem('parishNotifications') || '{}'));
          setMatrimonialNotifications(JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]'));

          try {
              const [vicariasRes, decanatosRes, misDatosRes] = await Promise.all([
                  supabase.from('vicarias').select('*'),
                  supabase.from('decanatos').select('*'),
                  supabase.from('mis_datos').select('*')
              ]);

              if (misDatosRes.data) localStorage.setItem('mis_datos', JSON.stringify(misDatosRes.data));

              setData(prev => ({ 
                  ...prev, 
                  vicariates: (vicariasRes.data || []).map(v => ({ id: v.id, dioceseId: v.diocese_id, name: v.name, vicarioName: v.vicar_name })), 
                  deaneries: (decanatosRes.data || []).map(d => ({ id: d.id, vicaryId: d.vicaria_id, name: d.name, decanName: d.dean_name })), 
                  misDatos: misDatosRes.data || [] 
              }));
          } catch(e) { console.warn("Error sincronizando estructura global:", e); }

          if (entityId) {
              try {
                  const { data: bData } = await supabase.from('baptisms').select('*').eq('parish_id', entityId);
                  if (bData) {
                      const cloudBaptisms = bData.map(b => ({ ...b.raw_data, id: b.id, status: b.status, marginNote: b.margin_note }));
                      localStorage.setItem(`baptisms_${entityId}`, JSON.stringify(cloudBaptisms));
                      localStorage.setItem(`baptismPartidas_${entityId}`, JSON.stringify(cloudBaptisms));
                  }
                  
                  const { data: pData } = await supabase.from('parrocos').select('*').eq('parish_id', entityId);
                  if (pData && pData.length > 0) {
                      localStorage.setItem(`parrocos_${entityId}`, JSON.stringify(pData.map(d => ({ ...d.payload, id: d.id }))));
                  }

                  const { data: dData } = await supabase.from('decretos').select('*').eq('parish_id', entityId);
                  if (dData && dData.length > 0) {
                      localStorage.setItem(`baptismCorrections_${entityId}`, JSON.stringify(dData.filter(d => d.tipo === 'correccion').map(d => ({ ...d.payload, id: d.id }))));
                      localStorage.setItem(`decreeReplacementBaptism_${entityId}`, JSON.stringify(dData.filter(d => d.tipo === 'reposicion').map(d => ({ ...d.payload, id: d.id }))));
                  }
                  
                  const localCorrections = JSON.parse(localStorage.getItem(`baptismCorrections_${entityId}`) || '[]');
                  const localReplacements = JSON.parse(localStorage.getItem(`decreeReplacementBaptism_${entityId}`) || '[]');
                  const dbInsert = [];
                  localCorrections.forEach(d => dbInsert.push({ id: d.id, parish_id: entityId, tipo: 'correccion', payload: d }));
                  localReplacements.forEach(d => dbInsert.push({ id: d.id, parish_id: entityId, tipo: 'reposicion', payload: d }));
                  if (dbInsert.length > 0) await supabase.from('decretos').upsert(dbInsert, { onConflict: 'id' });

              } catch(e) { console.warn("Sincronización parroquial offline:", e); }
          }
          
          window.dispatchEvent(new Event('storage'));
      };

      arrancarSistema();
  }, []);

  const saveData = (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
      setData(prev => ({ ...prev, [key]: value }));
  };

  const loadMatrimonialData = () => {
      setMatrimonialNotifications(JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]'));
      setMatrimonialNotificationAvisos(JSON.parse(localStorage.getItem('matrimonialNotificationAvisos') || '[]'));
  };

  const asentarNotaMarginalBautismo = async (partidaId, documentoMatrimonio, parishId) => {
      try {
          if (!partidaId || !parishId) return;
          const notasConfig = ParamsHelper.obtenerNotasAlMargen(parishId);
          let template = notasConfig.porNotificacionMatrimonial?.textoParaPartidaOriginal || "EL [FECHA_NOTIFICACION], SE RECIBIÓ NOTIFICACIÓN DE MATRIMONIO CELEBRADO EL DÍA [FECHA_MATRIMONIO] EN LA PARROQUIA [PARROQUIA_MATRIMONIO], DIÓCESIS DE [DIOCESIS_MATRIMONIO], CON [NOMBRE_CONYUGE]. REGISTRADO EN EL LIBRO [LIBRO_MAT], FOLIO [FOLIO_MAT], NÚMERO [NUMERO_MAT]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
          
          const formatF = (f) => f ? f.replace(/^EL\s+/i, '') : '___';
          const conyuge = documentoMatrimonio.tipoFormulario === 'externo' 
             ? (documentoMatrimonio.conyugeNombre || '---') 
             : `${documentoMatrimonio.esposo?.nombres || ''} ${documentoMatrimonio.esposo?.apellidos || ''} Y ${documentoMatrimonio.esposa?.nombres || ''} ${documentoMatrimonio.esposa?.apellidos || ''}`;
          
          const textNota = template
             .replace(/\[FECHA_NOTIFICACION\]/g, formatF(documentoMatrimonio.fechaNotificacion))
             .replace(/\[FECHA_MATRIMONIO\]/g, formatF(documentoMatrimonio.fechaMatrimonio))
             .replace(/\[PARROQUIA_MATRIMONIO\]/g, documentoMatrimonio.parroquiaMatrimonio || '___')
             .replace(/\[DIOCESIS_MATRIMONIO\]/g, documentoMatrimonio.diocesisMatrimonio || '___')
             .replace(/\[NOMBRE_CONYUGE\]/g, conyuge.toUpperCase())
             .replace(/\[LIBRO_MAT\]/g, documentoMatrimonio.libro || '___')
             .replace(/\[FOLIO_MAT\]/g, documentoMatrimonio.folio || '___')
             .replace(/\[NUMERO_MAT\]/g, documentoMatrimonio.numero || '___')
             .replace(/\[FECHA_EXPEDICION\]/g, formatF(new Date().toISOString()));

          const baptismsKey = `baptisms_${parishId}`;
          let baptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
          const index = baptisms.findIndex(b => b.id === partidaId);
          
          if (index !== -1) {
              baptisms[index] = { ...baptisms[index], notaMarginal: textNota, marginNote: textNota, updatedAt: new Date().toISOString() };
              localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
              localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(baptisms));
              await BaptismHelper.saveBaptismToSource(baptisms[index], parishId, baptisms[index].status);
              window.dispatchEvent(new Event('storage'));
          }
      } catch (error) { console.error("Error asentando nota marginal:", error); }
  };

  const handleGuardarNotificacionMatrimonial = (documento) => {
     const result = guardarNotificacionMatrimonial(documento);
     if (result.success && documento.baptismPartidaId && currentUser?.parishId) {
         asentarNotaMarginalBautismo(documento.baptismPartidaId, documento, currentUser.parishId);
     }
     if (result.success) loadMatrimonialData();
     return result;
  };

  const obtenerNotificacionesMatrimoniales = (parishId) => { const res = getAllDocumentos(parishId); return res.success ? res.data : []; };
  const obtenerAvisosNotificacion = (parishId) => { const res = getAllAvisos(parishId); return res.success ? res.data : []; };
  const cargarAvisosParroquia = (parishId) => { const list = obtenerAvisosParroquia(parishId); setMatrimonialNotificationAvisos(list); return list; };

  const marcarAvisoComoVisto = (avisoId, userId) => {
      const res = marcarAvisoHelper(avisoId, userId || (currentUser?.id || currentUser?.username));
      if (res.success) {
          loadMatrimonialData();
          if (currentUser?.parishId) cargarAvisosParroquia(currentUser.parishId);
      }
      return res;
  };

  const deleteNotificacionMatrimonial = (documentoId) => {
      try {
          const allDocs = JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]');
          const filteredDocs = allDocs.filter(d => d.id !== documentoId);
          localStorage.setItem('matrimonialNotifications', JSON.stringify(filteredDocs));
          setMatrimonialNotifications(filteredDocs);
          return { success: true };
      } catch (error) { return { success: false, message: error.message }; }
  };

  // ==========================================================
  // FUNCIONES DE ESTRUCTURA DIOCESANA (Restauradas)
  // ==========================================================
  const createVicary = async (vicaryData) => {
      try {
          const { data: newVicary, error } = await supabase.from('vicarias').insert([{ diocese_id: vicaryData.dioceseId, name: vicaryData.name, vicar_name: vicaryData.vicarioName || '' }]).select().single();
          if (error) throw error;
          const formattedVicary = { id: newVicary.id, dioceseId: newVicary.diocese_id, name: newVicary.name, vicarioName: newVicary.vicar_name };
          setData(prev => ({ ...prev, vicariates: [...(prev.vicariates || []), formattedVicary] }));
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
          const { data: newDecanate, error } = await supabase.from('decanatos').insert([{ vicaria_id: decanateData.vicaryId, name: decanateData.name, dean_name: decanateData.decanName || '' }]).select().single();
          if (error) throw error;
          const formattedDecanate = { id: newDecanate.id, vicaryId: newDecanate.vicaria_id, name: newDecanate.name, decanName: newDecanate.dean_name };
          setData(prev => ({ ...prev, deaneries: [...(prev.deaneries || []), formattedDecanate] }));
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
      const current = JSON.parse(localStorage.getItem('chancelleries') || '[]');
      const newChancery = { ...chanceryData, id: generateUUID(), createdAt: new Date().toISOString() };
      saveData('chancelleries', [...current, newChancery]);
      return { success: true, data: newChancery };
  };

  const createDiocese = (dioceseData) => {
      const current = JSON.parse(localStorage.getItem('dioceses') || '[]');
      const newDiocese = { ...dioceseData, type: 'diocese', id: generateUUID(), createdAt: new Date().toISOString() };
      saveData('dioceses', [...current, newDiocese]);
      return { success: true, data: newDiocese };
  };

  const createArchdiocese = (archdioceseData) => {
      const current = JSON.parse(localStorage.getItem('dioceses') || '[]');
      const newArchdiocese = { ...archdioceseData, type: 'archdiocese', id: generateUUID(), createdAt: new Date().toISOString() };
      saveData('dioceses', [...current, newArchdiocese]);
      return { success: true, data: newArchdiocese };
  };

  const createDioceseArchdiocese = (dioceseData, userData) => {
    try {
        const newDioceseId = generateUUID();
        let type = dioceseData.type || ((dioceseData.name.toLowerCase().includes('arquidiócesis') || dioceseData.name.toLowerCase().includes('arquidiocesis')) ? 'archdiocese' : 'diocese');
        const newDiocese = { ...dioceseData, id: newDioceseId, type: type, createdAt: new Date().toISOString() };
        const newUser = sanitizeUser({ ...userData, id: generateUUID(), role: ROLE_TYPES.DIOCESE, dioceseId: newDioceseId, dioceseName: dioceseData.name, createdAt: new Date().toISOString() });
        const updatedDioceses = [...data.dioceses, newDiocese];
        const updatedUsers = [...data.users, newUser];
        saveData('dioceses', updatedDioceses);
        saveData('users', updatedUsers);
        return { success: true, data: newDiocese };
    } catch (error) { return { success: false, message: error.message }; }
  };

  const deleteDioceseArchdiocese = (id) => {
      try {
        const updatedDioceses = data.dioceses.filter(d => d.id !== id);
        const updatedUsers = data.users.filter(u => u.dioceseId !== id);
        saveData('dioceses', updatedDioceses);
        saveData('users', updatedUsers);
        return { success: true };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const createUser = (userData) => {
      const sanitizedUserData = sanitizeUser({ ...userData, id: generateUUID(), createdAt: new Date().toISOString() });
      saveData('users', [...data.users, sanitizedUserData]);
      return sanitizedUserData;
  };

  const deleteUser = (userId) => { saveData('users', data.users.filter(u => u.id !== userId)); };

  const getUserByUsername = (username) => {
    if (!username) return null;
    return data.users.find(u => {
        const uName = sanitizeValue(u.username).toLowerCase().trim();
        const uEmail = sanitizeValue(u.email).toLowerCase().trim();
        const input = username.toLowerCase().trim();
        return (uName === input || uEmail === input);
    });
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
          let currentChancellors = data.chancellors || [];
          let index = currentChancellors.findIndex(c => c.id === id);
          if (index !== -1) {
              const updated = [...currentChancellors];
              updated[index] = { ...updated[index], ...updates, updatedAt: new Date().toISOString() };
              saveData('chancellors', updated);
              return { success: true, message: "Actualizado correctamente." };
          }
          let currentChancelleries = data.chancelleries || [];
          let indexLegacy = currentChancelleries.findIndex(c => c.id === id);
          if (indexLegacy !== -1) {
              const updatedLegacy = [...currentChancelleries];
              updatedLegacy[indexLegacy] = { ...updatedLegacy[indexLegacy], ...updates, updatedAt: new Date().toISOString() };
              saveData('chancelleries', updatedLegacy);
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
          let index = (data.parishes || []).findIndex(p => p.id === id);
          if (index !== -1) {
              const updated = [...data.parishes];
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

  const getConceptosAnulacion = (parishId) => JSON.parse(localStorage.getItem(`conceptosAnulacion_${parishId}`) || '[]');
  const getConceptoAnulacion = (id, parishId) => {
      const contextId = parishId || currentUser?.parishId;
      if (!contextId || !id) return null;
      return getConceptosAnulacion(contextId).find(c => c.id === id) || null;
  };
  const addConceptoAnulacion = (item, parishId) => {
      if (!parishId) return { success: false, message: "Falta ID de parroquia" };
      const current = getConceptosAnulacion(parishId);
      const newItem = { ...item, tipo: item.tipo || 'porCorreccion', id: generateUUID(), createdAt: new Date().toISOString() };
      localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify([...current, newItem]));
      return { success: true, message: "Concepto agregado", data: newItem };
  };
  const updateConceptoAnulacion = (id, updates, parishId) => {
      if (!parishId) return { success: false, message: "Falta ID de parroquia" };
      const updated = getConceptosAnulacion(parishId).map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
      localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(updated));
      return { success: true, message: "Concepto actualizado" };
  };
  const deleteConceptoAnulacion = (id, parishId) => {
      if (!parishId) return { success: false, message: "Falta ID de parroquia" };
      localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(getConceptosAnulacion(parishId).filter(i => i.id !== id)));
      return { success: true, message: "Concepto eliminado" };
  };

  const createUniversalBackup = async (backupName, backupDescription = '') => {
    try {
      const keysToBackup = [
        'dioceses', 'vicariates', 'deaneries', 'parishes', 
        'chancelleries', 'sacraments', 'communications', 'catalogs',
        'diocesis', 'iglesias', 'obispos', 'parrocos', 'ciudades', 'paises', 'parroquias_externas', 'mis_datos',
        'chancellors', 'users', 'parishNotifications',
        'matrimonialNotifications', 'matrimonialNotificationAvisos'
      ];
      const dynamicKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key.startsWith('baptisms_') || key.startsWith('confirmations_') || key.startsWith('matrimonios_') ||
          key.startsWith('pendingBaptisms_') || key.startsWith('pendingConfirmations_') || key.startsWith('pendingMatrimonios_') ||
          key.startsWith('baptismParameters_') || key.startsWith('confirmationParameters_') || key.startsWith('matrimonioParameters_') ||
          key.startsWith('baptismCorrections_') || key.startsWith('conceptosAnulacion_') || key.startsWith('notasAlMargen_') ||
          key.startsWith('decreeReplacements_') || key.startsWith('decreeReplacementBaptism_') || key.startsWith('parrocos_') || key.startsWith('obispos_')
        ) { dynamicKeys.push(key); }
      }
      const allKeys = [...new Set([...keysToBackup, ...dynamicKeys])];
      const backupPayload = {};
      let totalRecords = 0;
      allKeys.forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            backupPayload[key] = parsed;
            if (Array.isArray(parsed)) totalRecords += parsed.length;
          }
        } catch (e) {}
      });
      const backupId = generateUUID();
      const now = new Date().toISOString();
      const content = { data: backupPayload };
      const finalBackupObject = {
        metadata: { id: backupId, name: backupName, description: backupDescription, versionApp: '1.0.0', createdAt: now, totalRegistros: totalRecords, sizeBytes: calculateBackupSize(content) },
        checksum: generateBackupChecksum(content.data), data: backupPayload
      };
      return saveBackupToLocalStorage(finalBackupObject);
    } catch (error) { return { success: false, message: error.message }; }
  };

  const getUniversalBackups = () => getBackupsFromLocalStorage();
  const restoreUniversalBackup = async (backupId) => {
    try {
      const backup = getBackupFromLocalStorage(backupId);
      if (!backup) return { success: false, message: "Backup not found." };
      if (!validateBackupIntegrity(backup, backup.checksum)) return { success: false, message: "Backup corrupted." };
      const structCheck = validateBackupStructure(backup);
      if (!structCheck.isValid) return { success: false, message: `Invalid structure.` };
      const dataKeys = Object.keys(backup.data);
      dataKeys.forEach(key => localStorage.removeItem(key));
      dataKeys.forEach(key => { localStorage.setItem(key, JSON.stringify(backup.data[key])); });
      return { success: true, message: "System restored successfully." };
    } catch (error) { return { success: false, message: error.message }; }
  };
  const deleteUniversalBackup = (backupId) => deleteBackupFromLocalStorage(backupId);
  const exportUniversalBackup = (backupId) => {
    const backup = getBackupFromLocalStorage(backupId);
    if (!backup) return { success: false, message: "Backup not found." };
    try {
      downloadBackupFile(backup, `UniversalBackup_${backup.metadata.name.replace(/\s+/g, '_')}_${backup.metadata.createdAt.split('T')[0]}.json`);
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  };
  const importUniversalBackup = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          if (!validateBackupStructure(json).isValid) { resolve({ success: false, message: "Invalid format." }); return; }
          if (!validateBackupIntegrity(json, json.checksum)) { resolve({ success: false, message: "Data corrupted." }); return; }
          json.metadata.id = generateUUID(); 
          json.metadata.name = `${json.metadata.name} (Importado)`;
          resolve(saveBackupToLocalStorage(json));
        } catch (err) { resolve({ success: false, message: "Parse error." }); }
      };
      reader.onerror = () => reject({ success: false, message: "File read error" });
      reader.readAsText(file);
    });
  };

  const getMisDatosList = (contextId) => {
      const finalId = contextId || currentUser?.chanceryId || currentUser?.parishId || currentUser?.dioceseId;
      if (!finalId) return [];
      const match = (data.misDatos || []).find(md => String(md.entity_id) === String(finalId));
      if (!match) return [];
      let rawPayload = match.payload;
      if (typeof rawPayload === 'string') { try { rawPayload = JSON.parse(rawPayload); } catch(e) { rawPayload = {}; } }
      if (Array.isArray(rawPayload)) rawPayload = rawPayload[0] || {};
      return [{ ...rawPayload, id: match.id }];
  };

  const addMisDatosRecord = async (item, contextId) => {
      try {
          const finalId = contextId || currentUser?.chanceryId || currentUser?.parishId || currentUser?.dioceseId;
          if (!finalId) throw new Error("Entidad desconocida.");
          const cleanPayload = Array.isArray(item) ? item[0] : item;
          const { data: saved, error } = await supabase.from('mis_datos').insert([{ entity_id: finalId, payload: cleanPayload }]).select().single();
          if (error) throw error;
          setData(prev => ({ ...prev, misDatos: [...(prev.misDatos || []), saved] }));
          return { success: true, message: "Registro guardado en la nube" };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const updateMisDatosRecord = async (id, updates, contextId) => {
      try {
          const currentRecord = (data.misDatos || []).find(md => md.id === id);
          if (!currentRecord) throw new Error("Registro no encontrado");
          let oldPayload = currentRecord.payload;
          if (typeof oldPayload === 'string') oldPayload = JSON.parse(oldPayload);
          if (Array.isArray(oldPayload)) oldPayload = oldPayload[0] || {};
          let cleanUpdates = Array.isArray(updates) ? updates[0] : updates;
          const updatedPayload = { ...oldPayload, ...cleanUpdates };
          const { error } = await supabase.from('mis_datos').update({ payload: updatedPayload }).eq('id', id);
          if (error) throw error;
          setData(prev => ({ ...prev, misDatos: prev.misDatos.map(md => md.id === id ? { ...md, payload: updatedPayload } : md) }));
          return { success: true, message: "Registro actualizado en la nube" };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const deleteMisDatosRecord = async (id, contextId) => {
       try {
           const { error } = await supabase.from('mis_datos').delete().eq('id', id);
           if (error) throw error;
           setData(prev => ({ ...prev, misDatos: (prev.misDatos || []).filter(md => md.id !== id) }));
           return { success: true, message: "Registro eliminado de la nube" };
       } catch (error) { return { success: false, message: error.message }; }
  };

  const validateUserCredentials = (username, password) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const foundUser = users.find(user => {
      const uName = sanitizeValue(user.username).toLowerCase().trim();
      const uEmail = sanitizeValue(user.email).toLowerCase().trim();
      const input = username.toLowerCase().trim();
      return (uName === input || uEmail === input) && user.password === password;
    });
    return foundUser ? sanitizeUser(foundUser) : null;
  };

  const importConfirmations = async (json, parishId, preview) => {
      if (preview) return { success: true, count: json.data.length, records: json.data.map(r => ({ ...r, id: generateUUID() })), errors: [] };
      const current = JSON.parse(localStorage.getItem(`confirmations_${parishId}`) || '[]');
      const newRecords = json.data.map(r => ({ ...r, id: generateUUID(), status: 'confirmed' }));
      localStorage.setItem(`confirmations_${parishId}`, JSON.stringify([...current, ...newRecords]));
      return { success: true, message: `${newRecords.length} confirmaciones importadas.` };
  };

  const addConfirmationsFromJSON = async (confirmationRecords) => {
      try {
          let parishId = null;
          const authUser = JSON.parse(localStorage.getItem('user')); 
          if (authUser && authUser.parishId) parishId = authUser.parishId;
          else if (currentUser && currentUser.parishId) parishId = currentUser.parishId;
          else { const parishes = JSON.parse(localStorage.getItem('parishes') || '[]'); if (parishes.length > 0) parishId = parishes[0].id; }
          if (!parishId) return { success: false, message: "No se pudo identificar la parroquia." };

          const storageKey = `confirmations_${parishId}`;
          const currentRecords = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const { newRecords, duplicateCount, duplicateDetails } = separateNewAndDuplicateConfirmations(confirmationRecords, currentRecords);
          
          if (newRecords.length > 0) localStorage.setItem(storageKey, JSON.stringify([...currentRecords, ...newRecords]));
          return { success: true, message: `${newRecords.length} registros importados.`, addedCount: newRecords.length, duplicateCount, duplicateDetails };
      } catch (error) { return { success: false, message: error.message }; }
  };

  const importMarriages = async (json, parishId, preview) => {
      if (preview) return { success: true, count: json.data.length, records: json.data.map(r => ({ ...r, id: generateUUID() })), errors: [] };
      const current = JSON.parse(localStorage.getItem(`matrimonios_${parishId}`) || '[]');
      const newRecords = json.data.map(r => ({ ...r, id: generateUUID(), status: 'celebrated' }));
      localStorage.setItem(`matrimonios_${parishId}`, JSON.stringify([...current, ...newRecords]));
      return { success: true, message: `${newRecords.length} matrimonios importados.` };
  };

  const getConfirmations = (parishId) => JSON.parse(localStorage.getItem(`confirmations_${parishId}`) || '[]');
  const getPendingConfirmations = async (parishId) => JSON.parse(localStorage.getItem(`pendingConfirmations_${parishId}`) || '[]');
  const saveConfirmationToSource = async (data, parishId, mode) => {
      const storageKey = mode === 'celebrated' ? `confirmations_${parishId}` : `pendingConfirmations_${parishId}`;
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const newItem = { ...data, id: generateUUID(), status: mode === 'celebrated' ? 'confirmed' : 'pending', createdAt: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify([...list, newItem]));
      return { success: true, id: newItem.id };
  };

  const seatConfirmation = async (id, parishId) => {
      const pending = await getPendingConfirmations(parishId);
      const record = pending.find(r => r.id === id);
      if (!record) return { success: false, message: "Registro no encontrado" };
      
      const params = ParamsHelper.getConfirmationParameters(parishId);
      const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
      const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
      const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

      const finalRecord = { ...record, status: 'celebrated', book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado };
      
      localStorage.setItem(`confirmations_${parishId}`, JSON.stringify([...getConfirmations(parishId), finalRecord]));
      localStorage.setItem(`pendingConfirmations_${parishId}`, JSON.stringify(pending.filter(r => r.id !== id)));
      
      const nextConsecutivos = ParamsHelper.calculateNextConsecutive(params.ordinarioNumero || 1, params.ordinarioFolio || 1, params.ordinarioLibro || 1, params.ordinarioPartidas || 2, params.ordinarioRestartNumber);
      ParamsHelper.updateConfirmationParameters(parishId, { ...params, ordinarioNumero: nextConsecutivos.numero, ordinarioFolio: nextConsecutivos.folio, ordinarioLibro: nextConsecutivos.libro });
      return { success: true, message: "Asentado exitosamente" };
  };

  const seatMultipleConfirmations = async (ids, parishId) => {
      let count = 0;
      for (const id of ids) { const res = await seatConfirmation(id, parishId); if (res.success) count++; }
      return { success: true, message: `${count} registros asentados.` };
  };

  const getMatrimonios = (parishId) => JSON.parse(localStorage.getItem(`matrimonios_${parishId}`) || '[]');
  const getPendingMatrimonios = async (parishId) => JSON.parse(localStorage.getItem(`pendingMatrimonios_${parishId}`) || '[]');
  const saveMatrimonioToSource = async (data, parishId, mode) => {
      const storageKey = mode === 'celebrated' ? `matrimonios_${parishId}` : `pendingMatrimonios_${parishId}`;
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const newItem = { ...data, id: generateUUID(), status: mode === 'celebrated' ? 'celebrated' : 'pending', createdAt: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify([...list, newItem]));
      return { success: true, id: newItem.id };
  };

  const seatMatrimonio = async (id, parishId) => {
      const pending = await getPendingMatrimonios(parishId);
      const record = pending.find(r => r.id === id);
      if (!record) return { success: false, message: "Registro no encontrado" };
      
      const params = ParamsHelper.getMatrimonioParameters(parishId);
      const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
      const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
      const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

      const finalRecord = { ...record, status: 'celebrated', book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado };
      
      localStorage.setItem(`matrimonios_${parishId}`, JSON.stringify([...getMatrimonios(parishId), finalRecord]));
      localStorage.setItem(`pendingMatrimonios_${parishId}`, JSON.stringify(pending.filter(r => r.id !== id)));
      
      const nextConsecutivos = ParamsHelper.calculateNextConsecutive(params.ordinarioNumero || 1, params.ordinarioFolio || 1, params.ordinarioLibro || 1, params.ordinarioPartidas || 1, params.ordinarioRestartNumber);
      ParamsHelper.updateMatrimonioParameters(parishId, { ...params, ordinarioNumero: nextConsecutivos.numero, ordinarioFolio: nextConsecutivos.folio, ordinarioLibro: nextConsecutivos.libro });
      return { success: true, message: "Asentado exitosamente" };
  };

  const seatMultipleMatrimonios = async (ids, parishId) => {
      let count = 0;
      for (const id of ids) { const res = await seatMatrimonio(id, parishId); if (res.success) count++; }
      return { success: true, message: `${count} registros asentados.` };
  };

  const createNotification = (notificationData) => {
    const targetId = notificationData.parish_id || notificationData.parishId;
    if (!targetId) return { success: false, message: "Parish ID missing for notification" };

    const newNotification = {
        id: generateUUID(), createdAt: new Date().toISOString(), status: 'unread', ...notificationData,
        decree_id: notificationData.decree_id || notificationData.decreeId, decree_type: notificationData.decree_type || notificationData.type,
        parish_id: targetId
    };
    
    if (!newNotification.message) {
         const messageTemplates = { correction: 'Cancillería acaba de crear un Decreto de Corrección que afecta una de sus partidas.', replacement: 'Cancillería acaba de crear un Decreto de Reposición para su parroquia.' };
         newNotification.message = messageTemplates[newNotification.decree_type] || 'Nueva notificación de Cancillería.';
    }

    const allNotifications = { ...parishNotifications };
    const currentParishNotifs = allNotifications[targetId] ? [...allNotifications[targetId]] : [];
    
    currentParishNotifs.unshift(newNotification);
    allNotifications[targetId] = currentParishNotifs;
    
    localStorage.setItem('parishNotifications', JSON.stringify(allNotifications));
    setParishNotifications(allNotifications);
    return { success: true, id: newNotification.id };
  };

  const updateNotificationStatus = async (notificationId, status) => {
      let updated = false;
      const newNotifications = {};
      
      Object.keys(parishNotifications).forEach(pId => {
          const list = parishNotifications[pId];
          const index = list.findIndex(n => n.id === notificationId);
          if (index !== -1) {
              newNotifications[pId] = list.map(n => n.id === notificationId ? { ...n, status: status, updatedAt: new Date().toISOString() } : n);
              updated = true;
          } else {
              newNotifications[pId] = [...list];
          }
      });
      
      if (updated) {
          localStorage.setItem('parishNotifications', JSON.stringify(newNotifications));
          setParishNotifications(newNotifications);
          window.dispatchEvent(new Event('storage'));
          return { success: true };
      }
      return { success: false, message: "Notification not found" };
  };

  const deleteNotification = async (notificationId, parishId) => {
    if (!notificationId) return;
    const allNotifications = { ...parishNotifications };
    
    if (parishId && allNotifications[parishId]) {
        allNotifications[parishId] = allNotifications[parishId].filter(n => n.id !== notificationId);
    } else {
        Object.keys(allNotifications).forEach(pId => { allNotifications[pId] = allNotifications[pId].filter(n => n.id !== notificationId); });
    }

    localStorage.setItem('parishNotifications', JSON.stringify(allNotifications));
    setParishNotifications(allNotifications);
    window.dispatchEvent(new Event('storage'));
    return { success: true };
  };

  const addNotificationToParish = (parishId, notificationData) => createNotification({ ...notificationData, parish_id: parishId });
  const createNotificationFacade = (notificationData) => createNotification({ ...notificationData, parish_id: notificationData.parishId || notificationData.parish_id });

  return (
    <AppDataContext.Provider value={{
        data, validateJSONStructure,
        createItem, saveData, validateUserCredentials, user: currentUser,
        // --- FACADE COMPLETA BAUTISMOS Y DECRETOS ---
        purificarRegistroBautismo: (raw) => BaptismHelper.purificarRegistroBautismo(raw, currentUser?.parishId),
        saveBaptismToSource: (d, pId, m) => BaptismHelper.saveBaptismToSource(d, pId || currentUser?.parishId, m),
        guardarEnPermanentes: (d, pId, m) => BaptismHelper.saveBaptismToSource(d, pId || currentUser?.parishId, m),
        saveBaptism: (d, pId) => BaptismHelper.saveBaptism(d, pId || currentUser?.parishId),
        getBaptisms: (pId) => BaptismHelper.getBaptisms(pId || currentUser?.parishId),
        getConfirmedBaptisms: (pId) => BaptismHelper.getConfirmedBaptisms(pId || currentUser?.parishId),
        getPendingBaptisms: (pId) => BaptismHelper.getPendingBaptisms(pId || currentUser?.parishId),
        validateBaptismNumbers: (l, f, n, pId) => BaptismHelper.validateBaptismNumbers(l, f, n, pId || currentUser?.parishId),
        seatBaptism: (id, pId, u) => BaptismHelper.seatBaptism(id, pId || currentUser?.parishId, u),
        seatMultipleBaptisms: (ids, pId) => BaptismHelper.seatMultipleBaptisms(ids, pId || currentUser?.parishId),
        importBaptisms: async () => ({ success: true }),
        addBaptismsFromJSON: (records, preFiltered) => BaptismHelper.addBaptismsFromJSON(records, preFiltered, currentUser?.parishId),
        searchBaptismGlobal: (b, p, e, dId) => BaptismHelper.searchBaptismGlobal(b, p, e, dId || currentUser?.dioceseId, data.parishes),
        
        getBaptismCorrections: (pId) => BaptismHelper.getBaptismCorrections(pId || currentUser?.parishId),
        deleteBaptismCorrection: (id, pId) => BaptismHelper.deleteBaptismCorrection(id, pId || currentUser?.parishId),
        createBaptismCorrection: (d, o, n, pId) => BaptismHelper.createBaptismCorrection(d, o, n, pId || currentUser?.parishId),
        updateBaptismCorrection: (id, u, pId) => BaptismHelper.updateBaptismCorrection(id, u, pId || currentUser?.parishId),
        processBaptismDecreeBatch: (b, pId) => BaptismHelper.processBaptismDecreeBatch(b, pId || currentUser?.parishId),
        getDecreeReplacementBaptisms: (pId) => BaptismHelper.getDecreeReplacementBaptisms(pId || currentUser?.parishId),
        saveDecreeReplacementBaptism: (d, pId) => BaptismHelper.saveDecreeReplacementBaptism(d, pId || currentUser?.parishId),
        getDecreeReplacementsBySacrament: (s, pId) => BaptismHelper.getDecreeReplacementsBySacrament(s, pId || currentUser?.parishId),
        getDecreeReplacementByNewBaptismId: (n, pId) => BaptismHelper.getDecreeReplacementByNewBaptismId(n, pId || currentUser?.parishId),
        createDecreeReplacement: (d, pId) => BaptismHelper.createDecreeReplacement(d, pId || currentUser?.parishId),
        saveDecreeReplacement: (d, pId) => BaptismHelper.createDecreeReplacement(d, pId || currentUser?.parishId),
        updateDecreeReplacement: (id, u, pId) => BaptismHelper.updateDecreeReplacement(id, u, pId || currentUser?.parishId),
        deleteDecreeReplacement: (id, pId) => BaptismHelper.deleteDecreeReplacement(id, pId || currentUser?.parishId),
        createChanceryCorrection: (d, o, n, pId, cId) => BaptismHelper.createChanceryCorrection(d, o, n, pId, cId || currentUser?.chanceryId),
        createChanceryReplacement: async () => ({ success: false, message: "Módulo en desarrollo" }),

        // --- FACADE DE EXTRACCIONES MENORES ---
        getDiocesis: (id) => AuxCRUDHelper.getDiocesis(id || currentUser?.parishId),
        addDiocesis: (item, id) => AuxCRUDHelper.addDiocesis(item, id || currentUser?.parishId),
        updateDiocesis: (id, item, pId) => AuxCRUDHelper.updateDiocesis(id, item, pId || currentUser?.parishId),
        deleteDiocesis: (id, pId) => AuxCRUDHelper.deleteDiocesis(id, pId || currentUser?.parishId),
        getIglesiasList: (id) => AuxCRUDHelper.getIglesiasList(id || currentUser?.parishId),
        addIglesia: (item, id) => AuxCRUDHelper.addIglesia(item, id || currentUser?.parishId),
        updateIglesia: (id, item, pId) => AuxCRUDHelper.updateIglesia(id, item, pId || currentUser?.parishId),
        deleteIglesia: (id, pId) => AuxCRUDHelper.deleteIglesia(id, pId || currentUser?.parishId),
        getObispos: (id) => AuxCRUDHelper.getObispos(id || currentUser?.parishId),
        addObispo: (item, id) => AuxCRUDHelper.addObispo(item, id || currentUser?.parishId),
        updateObispo: (id, item, pId) => AuxCRUDHelper.updateObispo(id, item, pId || currentUser?.parishId),
        deleteObispo: (id, pId) => AuxCRUDHelper.deleteObispo(id, pId || currentUser?.parishId),
        getCiudadesList: (id) => AuxCRUDHelper.getCiudadesList(id || currentUser?.parishId),
        addCiudad: (item, id) => AuxCRUDHelper.addCiudad(item, id || currentUser?.parishId),
        updateCiudad: (id, item, pId) => AuxCRUDHelper.updateCiudad(id, item, pId || currentUser?.parishId),
        deleteCiudad: (id, pId) => AuxCRUDHelper.deleteCiudad(id, pId || currentUser?.parishId),
        importCiudades: (json, id, append) => AuxCRUDHelper.importCiudades(json, id || currentUser?.parishId, append),
        
        getParrocos: (id) => AuxCRUDHelper.getObispos(id || currentUser?.parishId),
        getParrocoActual: (id) => AuxCRUDHelper.getObispos(id || currentUser?.parishId).find(p => p.estado === "1" || String(p.estado).toUpperCase() === 'ACTIVO'),
        addParroco: (item, id) => AuxCRUDHelper.addObispo(item, id || currentUser?.parishId),
        updateParroco: (id, item, pId) => AuxCRUDHelper.updateObispo(id, item, pId || currentUser?.parishId),
        deleteParroco: (id, pId) => AuxCRUDHelper.deleteObispo(id, pId || currentUser?.parishId),

        obtenerNotasAlMargen: (id) => ParamsHelper.obtenerNotasAlMargen(id || currentUser?.parishId),
        saveNotasAlMargen: (notes, id) => ParamsHelper.saveNotasAlMargen(notes, id || currentUser?.parishId),
        generarNotaAlMargenAnulada: ParamsHelper.generarNotaAlMargenAnulada,
        generarNotaAlMargenNuevaPartida: ParamsHelper.generarNotaAlMargenNuevaPartida,
        actualizarNotaAlMargenCorreccion: (a, n, id) => ParamsHelper.actualizarNotaAlMargenCorreccion(a, n, id || currentUser?.parishId),
        actualizarNotaAlMargenReposicion: (n, id) => ParamsHelper.actualizarNotaAlMargenReposicion(n, id || currentUser?.parishId),
        
        getBaptismParameters: (id) => ParamsHelper.getBaptismParameters(id || currentUser?.parishId),
        saveBaptismParameters: (params, id) => ParamsHelper.saveBaptismParameters(params, id || currentUser?.parishId),
        getNextBaptismNumbers: (id) => ParamsHelper.getNextBaptismNumbers(id || currentUser?.parishId),
        getConfirmationParameters: (id) => ParamsHelper.getConfirmationParameters(id || currentUser?.parishId),
        updateConfirmationParameters: (id, params) => ParamsHelper.updateConfirmationParameters(id || currentUser?.parishId, params),
        getNextConfirmationNumbers: (id) => ParamsHelper.getNextConfirmationNumbers(id || currentUser?.parishId),
        getMatrimonioParameters: (id) => ParamsHelper.getMatrimonioParameters(id || currentUser?.parishId),
        updateMatrimonioParameters: (id, params) => ParamsHelper.updateMatrimonioParameters(id || currentUser?.parishId, params),
        getNextMatrimonioNumbers: (id) => ParamsHelper.getNextMatrimonioNumbers(id || currentUser?.parishId),

        // --- JERARQUÍA RESTAURADA (LAS QUE FALTABAN) ---
        createVicary, deleteVicary, createDecanate, deleteDecanate, createChancery,
        createDiocese, createArchdiocese, getVicaries: () => data.vicariates, getDecanates: () => data.deaneries,
        getChanceries: () => data.chancelleries, getDioceses: () => data.dioceses.filter(d => d.type === 'diocese'),
        getArchdioceses: () => data.dioceses.filter(d => d.type === 'archdiocese'),
        createDioceseArchdiocese, deleteDioceseArchdiocese, createUser, deleteUser, getUserByUsername,
        getParishUsers, getChanceryUsers, createChancellor, updateChancellor, deleteChancellor,
        getChancellorByDiocese, createParish, updateParish, deleteParish,
        getConceptosAnulacion, getConceptoAnulacion, addConceptoAnulacion, updateConceptoAnulacion, deleteConceptoAnulacion,
        getMisDatosList, addMisDatosRecord, updateMisDatosRecord, deleteMisDatosRecord,
        
        // --- RESPALDOS ---
        createUniversalBackup, getUniversalBackups, restoreUniversalBackup, deleteUniversalBackup, exportUniversalBackup, importUniversalBackup,
        
        // --- NOTIFICACIONES MATRIMONIALES ---
        matrimonialNotifications, matrimonialNotificationAvisos, guardarNotificacionMatrimonial: handleGuardarNotificacionMatrimonial,
        obtenerNotificacionesMatrimoniales, obtenerAvisosNotificacion, obtenerAvisosParroquia: obtenerAvisosParroquia, cargarAvisosParroquia, marcarAvisoComoVisto,
        deleteNotificacionMatrimonial, getDocumentosParroquia, getParroquiasReceptoras,
        getParishNotifications: (id) => parishNotifications[id || currentUser?.parishId] || [],
        createNotification: createNotificationFacade,
        updateNotificationStatus, deleteNotification, addNotificationToParish,
        
        // --- CONFIRMACIONES Y MATRIMONIOS ---
        getMatrimonios, getPendingMatrimonios, saveMatrimonioToSource, seatMatrimonio, seatMultipleMatrimonios,
        importConfirmations, addConfirmationsFromJSON, getConfirmations, getPendingConfirmations, saveConfirmationToSource, seatConfirmation, seatMultipleConfirmations,
        getVicariesByDiocese: (id) => data.vicariates.filter(v => v.dioceseId === id)
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