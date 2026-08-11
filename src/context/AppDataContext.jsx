import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateUUID, validateJSONStructure } from '@/utils/supabaseHelpers';
import { logAuthEvent } from '@/utils/authLogger';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { supabase } from '@/lib/supabaseClient';

// --- SERVICIOS AUXILIARES MODULARES ---
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
                  
                  const { data: pbData } = await supabase.from('pending_baptisms').select('*').eq('parish_id', entityId);
                  if (pbData) {
                      const cloudPending = pbData.map(pb => ({ ...pb.raw_data, id: pb.id, status: 'pending' }));
                      localStorage.setItem(`pendingBaptisms_${entityId}`, JSON.stringify(cloudPending));
                  }
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

  const getMisDatosList = (contextId) => {
      const finalId = contextId || currentUser?.chanceryId || currentUser?.parishId || currentUser?.dioceseId;
      if (!finalId) return [];
      const match = (data.misDatos || []).find(md => String(md.entity_id) === String(finalId));
      if (!match) return [];
      let rawPayload = match.payload;
      if (typeof rawPayload === 'string') {
          try { rawPayload = JSON.parse(rawPayload); } catch(e) { rawPayload = {}; }
      }
      if (Array.isArray(rawPayload)) rawPayload = rawPayload[0] || {};
      return [{ ...rawPayload, id: match.id }];
  };

  const addMisDatosRecord = async (item, contextId) => {
      try {
          const finalId = contextId || currentUser?.chanceryId || currentUser?.parishId || currentUser?.dioceseId;
          if (!finalId) throw new Error("No se pudo identificar a qué entidad pertenece este membrete.");
          const cleanPayload = Array.isArray(item) ? item[0] : item;
          const { data: saved, error } = await supabase.from('mis_datos').insert([{ entity_id: finalId, payload: cleanPayload }]).select().single();
          if (error) throw error;
          setData(prev => ({ ...prev, misDatos: [...(prev.misDatos || []), saved] }));
          return { success: true, message: "Registro guardado en la nube" };
      } catch (error) { 
          return { success: false, message: error.message }; 
      }
  };

  const updateMisDatosRecord = async (id, updates, contextId) => {
      try {
          const currentRecord = (data.misDatos || []).find(md => md.id === id);
          if (!currentRecord) throw new Error("Registro no encontrado en memoria");
          let oldPayload = currentRecord.payload;
          if (typeof oldPayload === 'string') oldPayload = JSON.parse(oldPayload);
          if (Array.isArray(oldPayload)) oldPayload = oldPayload[0] || {};
          const cleanUpdates = Array.isArray(updates) ? updates[0] : updates;
          const updatedPayload = { ...oldPayload, ...cleanUpdates };
          const { error } = await supabase.from('mis_datos').update({ payload: updatedPayload }).eq('id', id);
          if (error) throw error;
          setData(prev => ({
              ...prev,
              misDatos: prev.misDatos.map(md => md.id === id ? { ...md, payload: updatedPayload } : md)
          }));
          return { success: true, message: "Registro actualizado en la nube" };
      } catch (error) { 
          return { success: false, message: error.message }; 
      }
  };

  const deleteMisDatosRecord = async (id) => {
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
    if (!foundUser) return null;
    return sanitizeUser(foundUser);
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
        getMisDatosList,
        addMisDatosRecord,
        updateMisDatosRecord,
        deleteMisDatosRecord,
        addMisDatos: addMisDatosRecord,
        updateMisDatos: updateMisDatosRecord,
        deleteMisDatos: deleteMisDatosRecord,

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

        // --- NOTIFICACIONES MATRIMONIALES ---
        matrimonialNotifications,
        matrimonialNotificationAvisos,
        guardarNotificacionMatrimonial,
        obtenerNotificacionesMatrimoniales: getAllDocumentos,
        obtenerAvisosNotificacion: getAllAvisos,
        obtenerAvisosParroquia,
        cargarAvisosParroquia: obtenerAvisosParroquia,
        marcarAvisoComoVisto: (avisoId, userId) => marcarAvisoHelper(avisoId, userId || currentUser?.id),
        getDocumentosParroquia: (pId) => obtenerDocumentosParroquia(pId, JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]')),
        getParroquiasReceptoras: (pId) => obtenerParroquiasReceptoras(obtenerDocumentosParroquia(pId, JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]')), JSON.parse(localStorage.getItem('parishes') || '[]')),

        // --- RESPALDOS UNIVERSALES ---
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