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
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
};

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

  // --- ENTIDADES DIOCESANAS Y USUARIOS ---
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

  // --- NOTIFICACIONES PARROQUIALES ---
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

        // --- SACRAMENTOS (BAUTISMO) ---
        purificarRegistroBautismo: SacramentsService.purificarRegistroBautismo,
        saveBaptismToSource: SacramentsService.saveBaptismToSource,
        guardarEnPermanentes: SacramentsService.saveBaptismToSource,
        getBaptisms: SacramentsService.getBaptisms,
        getPendingBaptisms: SacramentsService.getPendingBaptisms,
        fetchBaptismsFromSource: SacramentsService.fetchBaptismsFromSource,
        seatBaptism: SacramentsService.seatBaptism,
        seatMultipleBaptisms: SacramentsService.seatMultipleBaptisms,
        validateBaptismNumbers: SacramentsService.validateBaptismNumbers,

        // --- SACRAMENTOS (CONFIRMACIÓN & MATRIMONIO) ---
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

        // --- PARÁMETROS SACRAMENTALES ---
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

        // --- NOTAS MARGINALES ---
        obtenerNotasAlMargen: NotesService.obtenerNotasAlMargen,
        saveNotasAlMargen: NotesService.saveNotasAlMargen,
        generarNotaAlMargenAnulada: NotesService.generarNotaAlMargenAnulada,
        generarNotaAlMargenNuevaPartida: NotesService.generarNotaAlMargenNuevaPartida,
        generarNotaAlMargenEstandar: NotesService.generarNotaAlMargenEstandar,
        actualizarNotaAlMargenCorreccion: NotesService.actualizarNotaAlMargenCorreccion,
        actualizarNotaAlMargenReposicion: NotesService.actualizarNotaAlMargenReposicion,
        actualizarNotaAlMargenEstandar: NotesService.actualizarNotaAlMargenEstandar,

        // --- CATÁLOGOS Y AUXILIARES ---
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
        getIglesias: CatalogsService.getIglesias,
        getIglesiasList: CatalogsService.getIglesiasList,
        addIglesia: CatalogsService.addIglesia,
        updateIglesia: CatalogsService.updateIglesia,
        deleteIglesia: CatalogsService.deleteIglesia,
        getObispos: CatalogsService.getObispos,
        addObispo: CatalogsService.addObispo,
        updateObispo: CatalogsService.updateObispo,
        deleteObispo: CatalogsService.deleteObispo,
        getCiudadesList: CatalogsService.getCiudadesList,
        addCiudad: CatalogsService.addCiudad,
        updateCiudad: CatalogsService.updateCiudad,
        deleteCiudad: CatalogsService.deleteCiudad,
        importCiudades: CatalogsService.importCiudades,
        getPaises: CatalogsService.getPaises,
        getParroquiasExternas: CatalogsService.getParroquiasExternas,

        // --- MEMBRETES (MIS DATOS) ---
        getMisDatosList: CatalogsService.getMisDatosList,
        addMisDatosRecord: CatalogsService.addMisDatosRecord,
        updateMisDatosRecord: CatalogsService.updateMisDatosRecord,
        deleteMisDatosRecord: CatalogsService.deleteMisDatosRecord,
        addMisDatos: CatalogsService.addMisDatosRecord,
        updateMisDatos: CatalogsService.updateMisDatosRecord,
        deleteMisDatos: CatalogsService.deleteMisDatosRecord,

        // --- DECRETOS Y CANCILLERÍA ---
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

        // --- ENTIDADES DIOCESANAS & USUARIOS ---
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

        // --- NOTIFICACIONES PARROQUIALES ---
        getParishNotifications,
        createNotification,
        updateNotificationStatus,
        deleteNotification,
        addNotificationToParish: (pId, notif) => createNotification({ ...notif, parish_id: pId }),

        // --- NOTIFICACIONES MATRIMONIALES ---
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

        // --- RESPALDOS ---
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