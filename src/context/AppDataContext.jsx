import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateUUID, validateJSONStructure, incrementPaddedValue } from '@/utils/supabaseHelpers';
import { separateNewAndDuplicateConfirmations } from '@/utils/confirmationJsonMapper';
import { separateNewAndDuplicateBaptisms } from '@/utils/baptismJsonMapper';
import { separateNewAndDuplicateDecrees } from '@/utils/decreeJsonMapper';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { updateBaptismPartidaMarginalNote } from '@/utils/updateBaptismPartidaMarginalNote.js';
import { logAuthEvent } from '@/utils/authLogger';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { supabase } from '@/lib/supabaseClient';

// --- UTILIDADES DE RESPALDO Y NOTIFICACIONES ---
import { generateBackupChecksum, validateBackupStructure, calculateBackupSize, validateBackupIntegrity, downloadBackupFile } from '@/utils/universalBackupHelpers';
import { saveBackupToLocalStorage, getBackupsFromLocalStorage, deleteBackupFromLocalStorage, getBackupFromLocalStorage } from '@/utils/universalBackupStorage';
import { saveDocumento, getAllDocumentos, getAllAvisos, updateAvisoStatus } from '@/utils/matrimonialNotificationStorage';
import { guardarNotificacionMatrimonial } from '@/utils/matrimonialNotificationHelpers';
import { obtenerAvisosParroquia, marcarAvisoComoVisto as marcarAvisoHelper } from '@/utils/matrimonialNotificationAvisoHelpers';
import { obtenerDocumentosParroquia, obtenerParroquiasReceptoras } from '@/utils/matrimonialNotificationDocumentHelpers';

export const AppDataContext = createContext(null);

// ============================================================================
// 1. CONSTANTES GLOBALES Y VALORES POR DEFECTO
// ============================================================================
const DEFAULT_NOTAS_MARGINALES = {
    porCorreccion: {
        anulada: "SIN NOTA MARGINAL DE MATRIMONIO HASTA LA FECHA. PARTIDA ANULADA POR DECRETO DE CORRECCIÓN DE BAUTISMO EL [FECHA_DECRETO]. DECRETO NRO. [NUMERO_DECRETO]. VÉASE EN EL LIBRO: [LIBRO_NUEVA], FOLIO: [FOLIO_NUEVA], NÚMERO: [NUMERO_PARTIDA_NUEVA]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................",
        nuevaPartida: "SIN NOTA MARGINAL DE MATRIMONIO HASTA LA FECHA. ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [NOMBRE_SACERDOTE]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION]....................................."
    },
    porReposicion: {
        nuevaPartidaCreada: {
            textoParaNuevaPartida: "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NRO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], DEBIDO A LA PÉRDIDA O DETERIORO DEL ORIGINAL. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION]....................................."
        }
    },
    porNotificacionMatrimonial: {
        textoParaPartidaOriginal: "EL [FECHA_NOTIFICACION], SE RECIBIÓ NOTIFICACIÓN DE MATRIMONIO CELEBRADO EL DÍA [FECHA_MATRIMONIO] EN LA PARROQUIA [PARROQUIA_MATRIMONIO], DIÓCESIS DE [DIOCESIS_MATRIMONIO], CON [NOMBRE_CONYUGE]. REGISTRADO EN EL LIBRO [LIBRO_MAT], FOLIO [FOLIO_MAT], NÚMERO [NUMERO_MAT]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION]....................................."
    },
    estandar: "SIN NOTA MARGINAL DE MATRIMONIO HASTA LA FECHA. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION]....................................."
};

// ============================================================================
// 2. UTILIDADES DE SANITIZACIÓN E INICIALIZACIÓN
// ============================================================================
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
          const notasConfig = obtenerNotasAlMargen(parishId);
          let template = notasConfig.porNotificacionMatrimonial?.textoParaPartidaOriginal || "EL [FECHA_NOTIFICACION], SE RECIBIÓ NOTIFICACIÓN DE MATRIMONIO CELEBRADO EL DÍA [FECHA_MATRIMONIO] EN LA PARROQUIA [PARROQUIA_MATRIMONIO], DIÓCESIS DE [DIOCESIS_MATRIMONIO], CON [NOMBRE_CONYUGE]. REGISTRADO EN EL LIBRO [LIBRO_MAT], FOLIO [FOLIO_MAT], NÚMERO [NUMERO_MAT]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
          
          const formatF = (f) => f ? convertDateToSpanishText(f).replace(/^EL\s+/i, '') : '___';
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
              await saveBaptismToSource(baptisms[index], parishId, baptisms[index].status);
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

  const getDocumentosParroquia = (parishId) => {
      const allDocs = JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]');
      return obtenerDocumentosParroquia(parishId, allDocs);
  };

  const getParroquiasReceptoras = (parishId) => {
      const docs = getDocumentosParroquia(parishId);
      const parishes = JSON.parse(localStorage.getItem('parishes') || '[]');
      return obtenerParroquiasReceptoras(docs, parishes);
  };

  const obtenerNotificacionesMatrimoniales = (parishId) => {
      const res = getAllDocumentos(parishId);
      return res.success ? res.data : [];
  };

  const obtenerAvisosNotificacion = (parishId) => {
      const res = getAllAvisos(parishId);
      return res.success ? res.data : [];
  };
  
  const getAvisosParroquia = (parishId) => {
      return obtenerAvisosParroquia(parishId);
  };

  const cargarAvisosParroquia = (parishId) => {
      const list = obtenerAvisosParroquia(parishId);
      setMatrimonialNotificationAvisos(list);
      return list;
  };

  const marcarAvisoComoVisto = (avisoId, userId) => {
      const res = marcarAvisoHelper(avisoId, userId || (currentUser?.id || currentUser?.username));
      if (res.success) {
          loadMatrimonialData();
          if (currentUser?.parishId) cargarAvisosParroquia(currentUser.parishId);
      }
      return res;
  };

  const getMatrimonialDocumentByBaptismPartidaId = (baptismPartidaId) => {
      if (!baptismPartidaId) return null;
      const allDocs = JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]');
      return allDocs.find(d => String(d.baptismPartidaId) === String(baptismPartidaId)) || null;
  };

  const deleteNotificacionMatrimonial = (documentoId) => {
      try {
          const allDocs = JSON.parse(localStorage.getItem('matrimonialNotifications') || '[]');
          const filteredDocs = allDocs.filter(d => d.id !== documentoId);
          localStorage.setItem('matrimonialNotifications', JSON.stringify(filteredDocs));
          setMatrimonialNotifications(filteredDocs);
          return { success: true };
      } catch (error) {
          console.error("Error deleting matrimonial notification:", error);
          return { success: false, message: error.message };
      }
  };

  const createVicary = async (vicaryData) => {
      try {
          const { data: newVicary, error } = await supabase
              .from('vicarias')
              .insert([{ diocese_id: vicaryData.dioceseId, name: vicaryData.name, vicar_name: vicaryData.vicarioName || '' }])
              .select().single();

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
          const { data: newDecanate, error } = await supabase
              .from('decanatos')
              .insert([{ vicaria_id: decanateData.vicaryId, name: decanateData.name, dean_name: decanateData.decanName || '' }])
              .select().single();

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
      const updated = [...current, newChancery];
      saveData('chancelleries', updated);
      return { success: true, data: newChancery };
  };

  const createDiocese = (dioceseData) => {
      const current = JSON.parse(localStorage.getItem('dioceses') || '[]');
      const newDiocese = { ...dioceseData, type: 'diocese', id: generateUUID(), createdAt: new Date().toISOString() };
      const updated = [...current, newDiocese];
      saveData('dioceses', updated);
      return { success: true, data: newDiocese };
  };

  const createArchdiocese = (archdioceseData) => {
      const current = JSON.parse(localStorage.getItem('dioceses') || '[]');
      const newArchdiocese = { ...archdioceseData, type: 'archdiocese', id: generateUUID(), createdAt: new Date().toISOString() };
      const updated = [...current, newArchdiocese];
      saveData('dioceses', updated);
      return { success: true, data: newArchdiocese };
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
      const checksum = generateBackupChecksum(content.data);
      const sizeBytes = calculateBackupSize(content);
      const finalBackupObject = {
        metadata: { id: backupId, name: backupName, description: backupDescription, versionApp: '1.0.0', createdAt: now, totalRegistros: totalRecords, sizeBytes: sizeBytes },
        checksum: checksum, data: backupPayload
      };
      const result = saveBackupToLocalStorage(finalBackupObject);
      return result;
    } catch (error) { return { success: false, message: error.message }; }
  };

  const getUniversalBackups = () => getBackupsFromLocalStorage();
  
  const restoreUniversalBackup = async (backupId) => {
    try {
      const backup = getBackupFromLocalStorage(backupId);
      if (!backup) return { success: false, message: "Backup not found." };
      const isValid = validateBackupIntegrity(backup, backup.checksum);
      if (!isValid) return { success: false, message: "Backup integrity check failed. Data might be corrupted." };
      const structCheck = validateBackupStructure(backup);
      if (!structCheck.isValid) return { success: false, message: `Invalid backup structure. Missing: ${structCheck.missingKeys.join(', ')}` };
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
      const filename = `UniversalBackup_${backup.metadata.name.replace(/\s+/g, '_')}_${backup.metadata.createdAt.split('T')[0]}.json`;
      downloadBackupFile(backup, filename);
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  };
  
  const importUniversalBackup = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          const structCheck = validateBackupStructure(json);
          if (!structCheck.isValid) { resolve({ success: false, message: "Invalid file format." }); return; }
          if (!validateBackupIntegrity(json, json.checksum)) { resolve({ success: false, message: "File checksum mismatch. Data corrupted." }); return; }
          json.metadata.id = generateUUID(); 
          json.metadata.name = `${json.metadata.name} (Importado)`;
          const saveRes = saveBackupToLocalStorage(json);
          resolve(saveRes);
        } catch (err) { resolve({ success: false, message: "Error parsing JSON file." }); }
      };
      reader.onerror = () => reject({ success: false, message: "File read error" });
      reader.readAsText(file);
    });
  };
  
  const getUniversalBackupInfo = (backupId) => {
    const backup = getBackupFromLocalStorage(backupId);
    return backup ? backup.metadata : null;
  };
  
  const obtenerNotasAlMargen = (parishId) => {
      if (!parishId) return DEFAULT_NOTAS_MARGINALES;
      const key = `notasAlMargen_${parishId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
          try {
              const storedData = JSON.parse(stored);
              const defaultData = DEFAULT_NOTAS_MARGINALES;
              return {
                  ...defaultData, ...storedData,
                  porCorreccion: { ...defaultData.porCorreccion, ...(storedData.porCorreccion || {}) },
                  porReposicion: { 
                      ...defaultData.porReposicion, ...(storedData.porReposicion || {}),
                      nuevaPartidaCreada: { ...defaultData.porReposicion.nuevaPartidaCreada, ...(storedData.porReposicion?.nuevaPartidaCreada || {}) }
                  },
                  porNotificacionMatrimonial: { ...defaultData.porNotificacionMatrimonial, ...(storedData.porNotificacionMatrimonial || {}) }
              };
          } catch (e) { return DEFAULT_NOTAS_MARGINALES; }
      }
      return DEFAULT_NOTAS_MARGINALES;
  };

  const getAuxData = (key, contextId) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  };

  const getParrocos = (parishId) => {
      const storageKey = parishId ? `parrocos_${parishId}` : 'parrocos';
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
  };

  const purificarRegistroBautismo = (raw) => {
      if (!raw) return null;

      const pId = raw.parishId || raw.parish_id || currentUser?.parishId;
      const config = obtenerNotasAlMargen(pId) || {};
      
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
          try {
              const hoy = new Date().toISOString().split('T')[0];
              return convertDateToSpanishText(hoy).replace(/^EL\s+/i, '').toUpperCase();
          } catch (e) { return "FECHA ACTUAL"; }
      };
      const notaFinalConFecha = notaCalculada.replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras()).toUpperCase();

      const getNombreParrocoActual = () => {
          if (!pId) return '---';
          const lista = getParrocos(pId) || [];
          const actual = lista.find(p => String(p.estado) === '1');
          return actual ? `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase() : 'PÁRROCO ENCARGADO';
      };

      return {
          id: raw.id || generateUUID(),
          parishId: pId,
          tipoIdentidad: identityId,
          Libro: String(raw.Libro || '0').padStart(4, '0'),
          folio: String(raw.folio || '0').padStart(4, '0'),
          numero: String(raw.numero || '0').padStart(4, '0'),
          lugarBautismo: String(raw.lugarBautismo || '---').trim().toUpperCase(),
          fechaSacramento: raw.fechaSacramento || '---',
          apellidos: String(raw.apellidos || '').trim().toUpperCase(),
          nombres: String(raw.nombres || '').trim().toUpperCase(),
          fechaNacimiento: raw.fechaNacimiento || '---',
          lugarNacimiento: String(raw.lugarNacimiento || '---').trim().toUpperCase(),
          sexo: String(raw.sexo || 'MASCULINO').toUpperCase(),
          nombrePadre: String(raw.nombrePadre || '---').trim().toUpperCase(),
          nombreMadre: String(raw.nombreMadre || '---').trim().toUpperCase(),
          tipoUnionPadres: String(raw.tipoUnionPadres || '---').trim().toUpperCase(),
          abuelosPaternos: String(raw.abuelosPaternos || '---').trim().toUpperCase(),
          abuelosMaternos: String(raw.abuelosMaternos || '---').trim().toUpperCase(),
          padrinos: String(raw.padrinos || '---').trim().toUpperCase(),
          ministro: String(raw.ministro || '---').trim().toUpperCase(),
          daFe: getNombreParrocoActual(),
          notaMarginal: notaFinalConFecha,
          status: raw.status || raw.estado || 'seated',
          updatedAt: new Date().toISOString()
      };
  };

  const saveBaptismToSource = async (data, parishId, mode) => {
      const purificado = purificarRegistroBautismo(data);
      const targetParishId = parishId || purificado.parishId;

      try {
          const cleanDate = (d) => (d && String(d).trim() !== '' && d !== '---') ? d : null;

          const dbRecord = {
              id: purificado.id, parish_id: targetParishId,
              book_number: purificado.Libro, page_number: purificado.folio, entry_number: purificado.numero,
              first_name: purificado.nombres, last_name: purificado.apellidos, gender: purificado.sexo,
              birth_date: cleanDate(purificado.fechaNacimiento), sacrament_date: cleanDate(purificado.fechaSacramento),
              minister: purificado.ministro, father_name: purificado.nombrePadre, mother_name: purificado.nombreMadre,
              tipo_union_padres: String(purificado.tipoUnionPadres || '1'), status: purificado.status,
              margin_note: purificado.notaMarginal, raw_data: purificado 
          };

          const { error } = await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
          if (error) throw error;

          const storageKey = `baptisms_${targetParishId}`;
          const currentLocal = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const updatedLocal = [...currentLocal.filter(b => b.id !== purificado.id), purificado];

          localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
          localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(updatedLocal));

          window.dispatchEvent(new Event('storage'));
          return { success: true, id: purificado.id };
      } catch (e) {
          console.error("Error en saveBaptismToSource:", e);
          return { success: false, message: e.message };
      }
  };

  const guardarEnPermanentes = saveBaptismToSource;

  const getVicaries = () => JSON.parse(localStorage.getItem('vicariates') || '[]');
  const getDecanates = () => JSON.parse(localStorage.getItem('deaneries') || '[]');
  const getChanceries = () => JSON.parse(localStorage.getItem('chancelleries') || '[]');
  const getDioceses = () => JSON.parse(localStorage.getItem('dioceses') || '[]').filter(d => d.type === 'diocese');
  const getArchdioceses = () => JSON.parse(localStorage.getItem('dioceses') || '[]').filter(d => d.type === 'archdiocese');

  const createItem = (collection, itemData) => {
      const current = JSON.parse(localStorage.getItem(collection) || '[]');
      const newItem = { ...itemData, id: generateUUID(), createdAt: new Date().toISOString() };
      const updated = [...current, newItem];
      saveData(collection, updated);
      return { success: true, data: newItem };
  };

  const getConceptosAnulacion = (parishId) => {
      if (!parishId) return [];
      const key = `conceptosAnulacion_${parishId}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
  };

  const getConceptoAnulacion = (id, parishId) => {
      const contextId = parishId || currentUser?.parishId;
      if (!contextId || !id) return null;
      const all = getConceptosAnulacion(contextId);
      return all.find(c => c.id === id) || null;
  };

  const addConceptoAnulacion = (item, parishId) => {
      if (!parishId) return { success: false, message: "Falta ID de parroquia" };
      const current = getConceptosAnulacion(parishId);
      const newItem = { ...item, tipo: item.tipo || 'porCorreccion', id: generateUUID(), createdAt: new Date().toISOString() };
      const updated = [...current, newItem];
      localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(updated));
      return { success: true, message: "Concepto agregado exitosamente", data: newItem };
  };

  const updateConceptoAnulacion = (id, updates, parishId) => {
      if (!parishId) return { success: false, message: "Falta ID de parroquia" };
      const current = getConceptosAnulacion(parishId);
      const updated = current.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
      localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(updated));
      return { success: true, message: "Concepto actualizado exitosamente" };
  };

  const deleteConceptoAnulacion = (id, parishId) => {
      if (!parishId) return { success: false, message: "Falta ID de parroquia" };
      const current = getConceptosAnulacion(parishId);
      const filtered = current.filter(i => i.id !== id);
      localStorage.setItem(`conceptosAnulacion_${parishId}`, JSON.stringify(filtered));
      return { success: true, message: "Concepto eliminado exitosamente" };
  };

  const getDecreeReplacementBaptisms = (parishId) => {
    if (!parishId) return [];
    return JSON.parse(localStorage.getItem(`decreeReplacementBaptism_${parishId}`) || '[]');
  };

  const saveDecreeReplacementBaptism = async (decreeData, parishId) => {
    const contextId = parishId || currentUser?.parishId;
    if (!contextId) return { success: false, message: "Falta ID de parroquia" };
    
    const decreeId = decreeData.id || generateUUID();
    const newDecree = { ...decreeData, id: decreeId, createdAt: new Date().toISOString() };

    supabase.from('decretos').insert([{ id: decreeId, parish_id: contextId, tipo: 'reposicion', payload: newDecree }]).then();

    const key = `decreeReplacementBaptism_${contextId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...current, newDecree]));
    return { success: true, data: newDecree };
  };

  const saveBaptism = async (newPartidaData, parishId) => {
      const contextId = parishId || currentUser?.parishId;
      if (!contextId) return { success: false, message: "Falta ID de parroquia" };
      
      const finalRecord = { ...newPartidaData, id: newPartidaData.id || generateUUID(), status: newPartidaData.status || 'seated', createdAt: new Date().toISOString() };
      
      if (finalRecord.type === "replacement" || finalRecord.createdByDecree === "replacement") {
          if (finalRecord.marginNote) { finalRecord.notaMarginal = finalRecord.marginNote.text || finalRecord.marginNote; }
      }
      return await saveBaptismToSource(finalRecord, contextId, finalRecord.status);
  };

  const getDecreeReplacementsBySacrament = (sacramentType, parishId) => {
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
  
  const getDecreeReplacements = (parishId) => {
      if (!parishId) return [];
      const key = `decreeReplacements_${parishId}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
  };

  const getDecreeReplacementByNewBaptismId = (newBaptismIdRepo, parishId) => {
      if (!parishId || !newBaptismIdRepo) return null;
      const key = `decreeReplacements_${parishId}`;
      const all = JSON.parse(localStorage.getItem(key) || '[]');
      const found = all.find(d => d.newBaptismIdRepo === newBaptismIdRepo || d.newPartidaId === newBaptismIdRepo);
      if (found) return found;
      
      const specific = getDecreeReplacementBaptisms(parishId);
      return specific.find(d => d.newPartidaId === newBaptismIdRepo);
  };

  const createDecreeReplacement = async (decreeData, parishId) => {
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
  
  const saveDecreeReplacement = createDecreeReplacement;

  const updateDecreeReplacement = async (decreeId, updatedData, parishId) => {
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

  const deleteDecreeReplacement = async (decreeId, parishId) => {
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
          } catch (cloudErr) {
              console.warn("Detalle en la nube al borrar reposición (ignorado)");
          }

          window.dispatchEvent(new Event('storage'));
          return { success: true };
      } catch (error) {
          window.dispatchEvent(new Event('storage'));
          return { success: true };
      }
  };
  
  const getParishNotifications = (parishId) => {
    if (!parishId) return [];
    return parishNotifications[parishId] || [];
  };

  const createNotification = (notificationData) => {
    const { parish_id, parishId } = notificationData;
    const targetId = parish_id || parishId;
    
    if (!targetId) return { success: false, message: "Parish ID missing for notification" };

    const newNotification = {
        id: generateUUID(),
        createdAt: new Date().toISOString(),
        status: 'unread',
        ...notificationData,
        decree_id: notificationData.decree_id || notificationData.decreeId,
        decree_type: notificationData.decree_type || notificationData.type,
        parish_id: targetId
    };
    
    if (!newNotification.message) {
         const messageTemplates = {
            correction: 'Cancillería acaba de crear un Decreto de Corrección que afecta una de sus partidas.',
            replacement: 'Cancillería acaba de crear un Decreto de Reposición para su parroquia.'
         };
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
  
  const addNotificationToParish = (parishId, notificationData) => createNotification({ ...notificationData, parish_id: parishId });
  
  const updateNotificationStatus = (notificationId, status) => {
      let updated = false;
      const allNotifications = { ...parishNotifications };
      
      Object.keys(allNotifications).forEach(pId => {
          const list = allNotifications[pId];
          const index = list.findIndex(n => n.id === notificationId);
          if (index !== -1) {
              list[index] = { ...list[index], status: status, updatedAt: new Date().toISOString() };
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

  const saveNotasAlMargen = (notes, parishId) => {
      if (!parishId) return;
      localStorage.setItem(`notasAlMargen_${parishId}`, JSON.stringify(notes));
  };
  
  const generarNotaAlMargenAnulada = (partidaNueva, decreto, parishId) => {
      const notes = obtenerNotasAlMargen(parishId);
      
      let template = notes?.porCorreccion?.anulada;
      if (!template || template.trim() === '') {
          template = "SIN NOTA MARGINAL DE MATRIMONIO HASTA LA FECHA. PARTIDA ANULADA POR DECRETO DE CORRECCIÓN DE BAUTISMO EL [FECHA_DECRETO]. DECRETO NRO. [NUMERO_DECRETO]. VÉASE EN EL LIBRO: [LIBRO_NUEVA], FOLIO: [FOLIO_NUEVA], NÚMERO: [NUMERO_PARTIDA_NUEVA]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
      }

      const fechaDecreto = decreto?.fecha ? convertDateToSpanishText(decreto.fecha).replace(/^EL\s+/i, '') : "__________";
      const fechaExpedicion = convertDateToSpanishText(new Date().toISOString()).replace(/^EL\s+/i, '');

      return template
          .replace(/\[FECHA_DECRETO\]/g, fechaDecreto)
          .replace(/\[NUMERO_DECRETO\]/g, decreto?.numero || "___")
          .replace(/\[LIBRO_NUEVA\]/g, String(partidaNueva?.libro || "___").padStart(4, '0'))
          .replace(/\[FOLIO_NUEVA\]/g, String(partidaNueva?.folio || "___").padStart(4, '0'))
          .replace(/\[NUMERO_PARTIDA_NUEVA\]/g, String(partidaNueva?.numero || "___").padStart(4, '0'))
          .replace(/\[FECHA_EXPEDICION\]/g, fechaExpedicion);
  };

  const generarNotaAlMargenNuevaPartida = (partidaAnulada, decreto, sacerdote, parishId) => {
      const notes = obtenerNotasAlMargen(parishId);
      
      let template = notes?.porCorreccion?.nuevaPartida;
      if (!template || template.trim() === '') {
          template = "SIN NOTA MARGINAL DE MATRIMONIO HASTA LA FECHA. ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [NOMBRE_SACERDOTE]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
      }

      const fechaDecreto = decreto?.fecha ? convertDateToSpanishText(decreto.fecha).replace(/^EL\s+/i, '') : "__________";
      const fechaExpedicion = convertDateToSpanishText(new Date().toISOString()).replace(/^EL\s+/i, '');
      let nombreSacerdote = typeof sacerdote === 'string' ? sacerdote.toUpperCase() : "___";

      return template
          .replace(/\[NUMERO_DECRETO\]/g, decreto?.numero || "___")
          .replace(/\[FECHA_DECRETO\]/g, fechaDecreto)
          .replace(/\[OFICINA_DECRETO\]/g, (decreto?.oficina || "CANCILLERÍA").toUpperCase())
          .replace(/\[LIBRO_ANULADA\]/g, String(partidaAnulada?.libro || "___").padStart(4, '0'))
          .replace(/\[FOLIO_ANULADA\]/g, String(partidaAnulada?.folio || "___").padStart(4, '0'))
          .replace(/\[NUMERO_PARTIDA_ANULADA\]/g, String(partidaAnulada?.numero || "___").padStart(4, '0'))
          .replace(/\[NOMBRE_SACERDOTE\]/g, nombreSacerdote)
          .replace(/\[FECHA_EXPEDICION\]/g, fechaExpedicion);
  };

  const generarNotaAlMargenEstandar = (parishId) => {
      const notes = obtenerNotasAlMargen(parishId);
      return notes?.estandar || "";
  };
  
  const actualizarNotaAlMargenCorreccion = (anulada, nuevaPartida, parishId) => {
      const current = obtenerNotasAlMargen(parishId);
      const updated = {
          ...current,
          porCorreccion: {
              anulada: anulada || current.porCorreccion.anulada,
              nuevaPartida: nuevaPartida || current.porCorreccion.nuevaPartida
          }
      };
      saveNotasAlMargen(updated, parishId);
      return { success: true, message: "Notas de corrección actualizadas." };
  };

  const actualizarNotaAlMargenReposicion = (nuevaPartida, parishId) => {
      const current = obtenerNotasAlMargen(parishId);
      const updated = {
          ...current,
          porReposicion: {
              nuevaPartida: nuevaPartida || current.porReposicion.nuevaPartida,
              nuevaPartidaCreada: {
                  textoParaNuevaPartida: nuevaPartida || current.porReposicion.nuevaPartidaCreada?.textoParaNuevaPartida
              }
          }
      };
      saveNotasAlMargen(updated, parishId);
      return { success: true, message: "Nota de reposición actualizada." };
  };

  const actualizarNotaAlMargenEstandar = (texto, parishId) => {
      const current = obtenerNotasAlMargen(parishId);
      const updated = { ...current, estandar: texto || "" };
      saveNotasAlMargen(updated, parishId);
      return { success: true, message: "Nota estándar actualizada." };
  };

  const getBaptismCorrections = (parishId) => {
      if (!parishId) return [];
      const key = `baptismCorrections_${parishId}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
  };

    const deleteBaptismCorrection = async (id, parishId) => {
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
            } catch (cloudErr) {
                console.warn("Ignorado error de nube al borrar decreto");
            }

            window.dispatchEvent(new Event('storage'));
            return { success: true };
        } catch (e) {
            window.dispatchEvent(new Event('storage'));
            return { success: true };
        }
    };

  const createBaptismCorrection = async (decreeData, originalPartidaId, newPartidaData, parishId) => {
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
        
        const origLibro = String(originalPartida.book_number || originalPartida.libro || originalPartida.Libro || '').padStart(4, '0');
        const origFolio = String(originalPartida.page_number || originalPartida.folio || '').padStart(4, '0');
        const origNumero = String(originalPartida.entry_number || originalPartida.numero || originalPartida.numeroActa || '').padStart(4, '0');
        const partidaAnuladaObj = { libro: origLibro, folio: origFolio, numero: origNumero };

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
        } catch(e) { console.warn("Fallo menor al subir a la nube:", e); }
        
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

  const updateBaptismCorrection = async (id, updatedData, parishId) => {
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
          console.error("Error updating baptism correction:", e);
          return { success: false, message: e.message };
      }
  };

  const getDecrees = (parishId, sacramentType) => {
      if (!parishId || !sacramentType) return [];
      const key = `decrees_${sacramentType}_${parishId}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
  };

  const addDecreesFromJSON = async (decreeRecords, sacramentType) => {
      try {
          let parishId = null;
          const authUser = JSON.parse(localStorage.getItem('user')); 
          if (authUser && authUser.parishId) parishId = authUser.parishId;
          else if (currentUser && currentUser.parishId) parishId = currentUser.parishId;
          else {
               const parishes = JSON.parse(localStorage.getItem('parishes') || '[]');
               if (parishes.length > 0) parishId = parishes[0].id;
          }

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
          console.error("Error adding decrees:", error);
          return { success: false, message: error.message };
      }
  };

  const processBaptismDecreeBatch = async (decreesBatch, targetParishId) => {
        try {
            const baptismsKey = `baptisms_${targetParishId}`;
            const correctionsKey = `baptismCorrections_${targetParishId}`;
            const replacementsKey = `decreeReplacementBaptism_${targetParishId}`; 
            
            let allBaptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
            let existingCorrections = JSON.parse(localStorage.getItem(correctionsKey) || '[]');
            let existingReplacements = JSON.parse(localStorage.getItem(replacementsKey) || '[]');
            
            const parrocoActivo = getParrocoActual(targetParishId);
            const nombreSacerdote = parrocoActivo ? `${parrocoActivo.nombre || ''} ${parrocoActivo.apellido || ''}`.trim() : 'PÁRROCO ENCARGADO';
            const notasConfig = obtenerNotasAlMargen(targetParishId);

            const normalizeNum = (num) => String(num || '').trim().replace(/^0+/, '') || '0';

            const getNum = (val) => {
                if (val == null || val === '') return null;
                const parsed = parseInt(String(val).replace(/\D/g, ''), 10);
                return isNaN(parsed) ? null : parsed;
            };

            const isSameNum = (val1, val2) => {
                const n1 = getNum(val1);
                const n2 = getNum(val2);
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

                if (existsInCorrections || existsInReplacements) {
                    duplicateCount++;
                    return; 
                }

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

                let notaAnuladaOficial = generarNotaAlMargenAnulada(partidaNuevaObj, decretoObj, targetParishId);
                let notaNuevaOficial = generarNotaAlMargenNuevaPartida(partidaAnuladaObj, decretoObj, nombreSacerdote, targetParishId);
                
                let templateRepo = notasConfig?.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || notasConfig?.porReposicion?.nuevaPartida;
                
                if (!templateRepo || templateRepo.trim() === '') {
                    templateRepo = "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NRO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], DEBIDO A LA PÉRDIDA O DETERIORO DEL ORIGINAL. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
                }

                const fechaDecretoText = convertDateToSpanishText(decDate).replace(/^EL\s+/i, '');
                const fechaExpedicionText = convertDateToSpanishText(new Date().toISOString()).replace(/^EL\s+/i, '');

                let notaReposicion = templateRepo
                    .replace(/\[NUMERO_DECRETO\]/g, rawDecNum || '___')
                    .replace(/\[FECHA_DECRETO\]/g, fechaDecretoText)
                    .replace(/\[FECHA_EXPEDICION\]/g, fechaExpedicionText);

                if (decObs) {
                    notaAnuladaOficial += ` OBSERVACIONES: ${decObs}`;
                    notaNuevaOficial += ` OBSERVACIONES: ${decObs}`;
                    notaReposicion += ` OBSERVACIONES: ${decObs}`;
                }

                allBaptisms = allBaptisms.map(b => {
                    const isOrig = isSameNum(b.libro || b.book_number, origLib) &&
                                   isSameNum(b.folio || b.page_number, origFol) &&
                                   isSameNum(b.numero || b.entry_number, origNum);

                    const isNew = isSameNum(b.libro || b.book_number, newLib) &&
                                  isSameNum(b.folio || b.page_number, newFol) &&
                                  isSameNum(b.numero || b.entry_number, newNum);

                    if (isOrig) {
                        originalFound = true;
                        if (!fullOriginalSnapshot) {
                            fullOriginalSnapshot = { ...b };
                            originalNames.nombres = b.nombres || b.firstName || '';
                            originalNames.apellidos = b.apellidos || b.lastName || '';
                        }
                        
                        const updatedOrig = {
                            ...b,
                            isAnnulled: true,
                            status: 'anulada',
                            estado: 'anulada',
                            annulmentDecree: rawDecNum,
                            annulmentDate: decDate,
                            conceptoAnulacionId: decConcept,
                            tipoNotaAlMargen: isReposicion ? 'porReposicion.anulada' : 'porCorreccion.anulada',
                            notaMarginal: isReposicion ? 'PARTIDA ANULADA POR REPOSICIÓN.' : notaAnuladaOficial,
                            marginNote: isReposicion ? 'PARTIDA ANULADA POR REPOSICIÓN.' : notaAnuladaOficial,
                            updatedAt: new Date().toISOString()
                        };
                        changedRecordsForSupabase.push(updatedOrig);
                        return updatedOrig;
                    }

                    if (isNew) {
                        newFound = true;
                        if (!fullNewSnapshot) fullNewSnapshot = { ...b };
                        if (!originalFound) {
                            originalNames.nombres = b.nombres || b.firstName || '';
                            originalNames.apellidos = b.apellidos || b.lastName || '';
                        }
                        const updatedNew = {
                            ...b,
                            isSupplementary: true,
                            creadoPorDecreto: true,
                            hasDecree: true,
                            numeroDecreto: rawDecNum,
                            decreeNumber: rawDecNum,
                            correctionDecreeRef: rawDecNum,
                            replacementDecreeRef: isReposicion ? rawDecNum : undefined,
                            tipoNotaAlMargen: isReposicion ? 'porReposicion.nuevaPartida' : 'porCorreccion.nuevaPartida',
                            notaMarginal: isReposicion ? notaReposicion : notaNuevaOficial,
                            marginNote: isReposicion ? notaReposicion : notaNuevaOficial,
                            updatedAt: new Date().toISOString()
                        };
                        changedRecordsForSupabase.push(updatedNew);
                        return updatedNew;
                    }

                    return b;
                });

                if (newFound || originalFound) {
                    const decreeRecord = {
                        id: `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        type: isReposicion ? "replacement" : "correction",
                        sacrament: "bautismo",
                        numeroDecreto: rawDecNum,
                        decreeNumber: rawDecNum,
                        fechaDecreto: decDate,
                        decreeDate: decDate,
                        conceptoAnulacionId: decConcept,
                        errorEncontrado: decObs || (isReposicion ? 'Reposición Importada' : 'Corrección Importada'),
                        correccionRealizada: `L:${newLib} F:${newFol} N:${newNum}`,
                        nombres: originalNames.nombres,
                        apellidos: originalNames.apellidos,
                        targetName: `${originalNames.nombres} ${originalNames.apellidos}`.trim() || 'Sin Nombre',
                        observations: decObs,
                        originalPartidaId: fullOriginalSnapshot ? fullOriginalSnapshot.id : "unknown",
                        originalPartidaSummary: fullOriginalSnapshot ? { ...fullOriginalSnapshot } : null,
                        newPartidaSummary: { book: newLib, page: newFol, entry: newNum }, 
                        datosNuevaPartida: fullNewSnapshot || fullOriginalSnapshot || null, 
                        status: 'active',
                        createdAt: new Date().toISOString()
                    };

                    if (isReposicion) {
                        existingReplacements.push(decreeRecord);
                    } else {
                        existingCorrections.push(decreeRecord);
                    }
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
                    id: newItem.id, 
                    parish_id: targetParishId,
                    book_number: String(newItem.book_number || newItem.libro || ''),
                    page_number: String(newItem.page_number || newItem.folio || ''),
                    entry_number: String(newItem.entry_number || newItem.numero || ''),
                    first_name: String(newItem.firstName || newItem.nombres || ''),
                    last_name: String(newItem.lastName || newItem.apellidos || ''),
                    gender: String(newItem.sex || newItem.sexo || ''),
                    birth_date: cleanDate(newItem.birthDate || newItem.fechaNacimiento),
                    sacrament_date: cleanDate(newItem.sacramentDate || newItem.fechaSacramento),
                    minister: String(newItem.minister || newItem.ministro || ''),
                    father_name: String(newItem.fatherName || newItem.nombrePadre || ''),
                    mother_name: String(newItem.motherName || newItem.nombreMadre || ''),
                    status: newItem.status,
                    margin_note: String(newItem.marginNote || newItem.notaMarginal || ''),
                    raw_data: newItem
                }));
                
                await supabase.from('baptisms').upsert(dbRecords, { onConflict: 'id' });
            }

            window.dispatchEvent(new Event('storage'));

            let finalMessage = `Se procesaron y clasificaron ${processedCount} decretos correctamente.`;
            if (duplicateCount > 0) {
                finalMessage += ` Se omitieron ${duplicateCount} decretos que ya existían (número duplicado).`;
            }

            return { success: true, message: finalMessage };

        } catch (error) {
            console.error("Error en processBaptismDecreeBatch:", error);
            return { success: false, message: error.message };
        }
    };

  const createChanceryCorrection = async (decreeData, originalPartidaId, newPartidaData, targetParishId, chanceryId) => {
        try {
            if (!targetParishId || !chanceryId) {
                return { success: false, message: "Faltan identificadores de parroquia o cancillería." };
            }

            const numDecretoABuscar = String(decreeData.decreeNumber || decreeData.numeroDecreto).trim();
            let isDuplicate = false;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.includes('baptismCorrections') || key.includes('decrees_correction') || key.includes('decreeCorrection')) {
                    try {
                        const records = JSON.parse(localStorage.getItem(key) || '[]');
                        if (Array.isArray(records) && records.some(r => String(r.numeroDecreto || r.decreeNumber).trim() === numDecretoABuscar)) {
                            isDuplicate = true;
                            break;
                        }
                    } catch(e) {}
                }
            }

            if (isDuplicate) {
                return { 
                    success: false, 
                    message: `Operación denegada: El Decreto No. ${numDecretoABuscar} ya fue registrado previamente en el sistema.` 
                };
            }

            const chanceryCorrectionsKey = `baptismCorrections_${chanceryId}`;
            let chanceryCorrections = JSON.parse(localStorage.getItem(chanceryCorrectionsKey) || '[]');

            const parish = data.parishes.find(p => p.id === targetParishId);
            const parishMisDatos = getMisDatosList(targetParishId)[0] || {};
            const targetParishName = (parishMisDatos.nombre || parish?.name || 'PARROQUIA DESTINO').toUpperCase();
            const targetParishCity = (parishMisDatos.ciudad || parish?.city || 'CIUDAD').toUpperCase();
            const parishLabel = `${targetParishName} - ${targetParishCity}`;

            const parrocoActivo = getParrocoActual(targetParishId);
            const nombreSacerdoteDestino = parrocoActivo
                ? `${parrocoActivo.nombre || ''} ${parrocoActivo.apellido || ''}`.trim().toUpperCase()
                : 'PÁRROCO ENCARGADO';

            const baptismsKey = `baptisms_${targetParishId}`;
            let baptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
            const originalIndex = baptisms.findIndex(b => b.id === originalPartidaId);

            if (originalIndex === -1) return { success: false, message: "Partida original no encontrada en la parroquia." };
            const originalPartida = baptisms[originalIndex];

            const decretoObj = {
                numero: decreeData.decreeNumber,
                fecha: decreeData.decreeDate,
                oficina: decreeData.parroquia || 'CANCILLERÍA'
            };
            const partidaNuevaObj = {
                libro: newPartidaData.book || newPartidaData.numeroLibro,
                folio: newPartidaData.page || newPartidaData.folio,
                numero: newPartidaData.entry || newPartidaData.numeroActa
            };
            const partidaAnuladaObj = {
                libro: originalPartida.book_number || originalPartida.libro,
                folio: originalPartida.page_number || originalPartida.folio,
                numero: originalPartida.entry_number || originalPartida.numero
            };

            const notaAnulada = generarNotaAlMargenAnulada(partidaNuevaObj, decretoObj, targetParishId);
            const notaNueva = generarNotaAlMargenNuevaPartida(partidaAnuladaObj, decretoObj, nombreSacerdoteDestino, targetParishId);

            baptisms[originalIndex] = {
                ...originalPartida,
                isAnnulled: true, status: 'anulada', estado: 'anulada',
                annulmentDecree: decreeData.decreeNumber, annulmentDate: decreeData.decreeDate,
                conceptoAnulacionId: decreeData.conceptoAnulacionId,
                notaMarginal: notaAnulada, marginNote: notaAnulada,
                updatedAt: new Date().toISOString()
            };

            let params = JSON.parse(localStorage.getItem(`baptismParameters_${targetParishId}`) || '{}');
            if (!params.suplementarioLibro) params = { ...params, suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 };

            const newPartida = {
                ...newPartidaData,
                id: generateUUID(), parishId: targetParishId,
                book_number: newPartidaData.book || params.suplementarioLibro,
                page_number: newPartidaData.page || params.suplementarioFolio,
                entry_number: newPartidaData.entry || params.suplementarioNumero,
                status: 'seated', isSupplementary: true, creadoPorDecreto: true, hasDecree: true,
                correctionDecreeRef: decreeData.decreeNumber,
                notaMarginal: notaNueva, marginNote: notaNueva,
                createdAt: new Date().toISOString()
            };
            baptisms.push(newPartida);

            localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
            localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(baptisms));
            
            const nextSupletorio = calculateNextConsecutive(
                params.suplementarioNumero || 1, 
                params.suplementarioFolio || 1, 
                params.suplementarioLibro || 1, 
                params.suplementarioPartidas || 2, 
                params.suplementarioReiniciar
            );

            localStorage.setItem(`baptismParameters_${targetParishId}`, JSON.stringify({ 
                ...params, 
                suplementarioNumero: nextSupletorio.numero,
                suplementarioFolio: nextSupletorio.folio,
                suplementarioLibro: nextSupletorio.libro
            }));
            
            const commonDecreeInfo = {
                ...decreeData,
                type: 'correction',
                sacrament: 'bautismo',
                originalPartidaId,
                newPartidaId: newPartida.id,
                nombreSacerdoteDestino, 
                targetParishId,
                targetParishName: parishLabel,
                originalPartidaSummary: { ...originalPartida, book: partidaAnuladaObj.libro, page: partidaAnuladaObj.folio, entry: partidaAnuladaObj.numero },
                newPartidaSummary: { ...newPartida, book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number },
                targetName: decreeData.targetName || `${originalPartida.nombres || originalPartida.firstName || ''} ${originalPartida.apellidos || originalPartida.lastName || ''}`.trim(),
                createdAt: new Date().toISOString()
            };

            const parishDecreesKey = `baptismCorrections_${targetParishId}`;
            let parishDecrees = JSON.parse(localStorage.getItem(parishDecreesKey) || '[]');
            parishDecrees.push({ ...commonDecreeInfo, id: generateUUID(), parroquia: parishLabel });
            localStorage.setItem(parishDecreesKey, JSON.stringify(parishDecrees));

            const chanceryDecreeRecord = {
                ...commonDecreeInfo,
                id: generateUUID(),
                isMasterCopy: true
            };
            chanceryCorrections.push(chanceryDecreeRecord);
            localStorage.setItem(chanceryCorrectionsKey, JSON.stringify(chanceryCorrections));

            window.dispatchEvent(new Event('storage'));
            return { success: true, message: "Decreto emitido y vinculado correctamente.", data: chanceryDecreeRecord };
        } catch (e) {
            console.error("Error en createChanceryCorrection:", e);
            return { success: false, message: e.message };
        }
    };

  const createChanceryReplacement = async (decreeData, newPartidaData, targetParishId, chanceryId) => {
      try {
        if (!targetParishId || !chanceryId) return { success: false, message: "Faltan identificadores." };

        const numDecretoABuscar = String(decreeData.numeroDecreto || decreeData.decreeNumber).trim();
        let isDuplicate = false;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('decreeReplacement') || key.includes('decrees_replacement')) {
                try {
                    const records = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(records) && records.some(r => String(r.numeroDecreto || r.decreeNumber).trim() === numDecretoABuscar)) {
                        isDuplicate = true;
                        break;
                    }
                } catch(e) {}
            }
        }
        if (isDuplicate) {
            return { 
                success: false, 
                message: `Operación denegada: El Decreto de Reposición No. ${numDecretoABuscar} ya fue registrado previamente en el sistema.` 
            };
        }

        const chanceryReplacementsKey = `decreeReplacementBaptism_${chanceryId}`;
        let chanceryReplacements = JSON.parse(localStorage.getItem(chanceryReplacementsKey) || '[]');
        const todosConceptos = getConceptosAnulacion(chanceryId) || [];
        const conceptoReal = todosConceptos.find(c => String(c.id) === String(decreeData.conceptoAnulacionId));
        const nombreConceptoText = conceptoReal ? conceptoReal.concepto : 'DECRETO DE REPOSICIÓN DE BAUTISMO';

        const parish = data.parishes.find(p => p.id === targetParishId);
        const parishMisDatos = getMisDatosList(targetParishId)[0] || {};
        const targetParishName = (parishMisDatos.nombre || parish?.name || 'PARROQUIA DESTINO').toUpperCase();
        const targetParishCity = (parishMisDatos.ciudad || parish?.city || 'CIUDAD').toUpperCase();
        const parishLabel = `${targetParishName} - ${targetParishCity}`;
        const parrocoActivo = getParrocoActual(targetParishId);
        const nombreSacerdoteDestino = parrocoActivo ? `${parrocoActivo.nombre || ''} ${parrocoActivo.apellido || ''}`.trim().toUpperCase() : 'PÁRROCO ENCARGADO';

        const baptismsKey = `baptisms_${targetParishId}`;
        let baptisms = JSON.parse(localStorage.getItem(baptismsKey) || '[]');
        let params = JSON.parse(localStorage.getItem(`baptismParameters_${targetParishId}`) || '{}');
        if (!params.suplementarioLibro) params = { ...params, suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1 };

        const notasConfig = obtenerNotasAlMargen(targetParishId);
        let template = notasConfig?.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || notasConfig?.porReposicion?.nuevaPartida;
        if (!template || template.trim() === '') {
            template = "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NRO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], DEBIDO A LA PÉRDIDA O DETERIORO DEL ORIGINAL. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA EL DÍA [FECHA_EXPEDICION].....................................";
        }
        const fechaDecretoText = convertDateToSpanishText(decreeData.fechaDecreto || decreeData.decreeDate).replace(/^EL\s+/i, '');
        const fechaExpedicionText = convertDateToSpanishText(new Date().toISOString()).replace(/^EL\s+/i, '');
        const notaReposicion = template
            .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDecreto || decreeData.decreeNumber || '___')
            .replace(/\[FECHA_DECRETO\]/g, fechaDecretoText)
            .replace(/\[FECHA_EXPEDICION\]/g, fechaExpedicionText);

        const newPartidaId = generateUUID();
        const newPartida = {
          id: newPartidaId, 
          parishId: targetParishId,
          book_number: newPartidaData.numeroLibro || params.suplementarioLibro,
          page_number: newPartidaData.folio || params.suplementarioFolio,
          entry_number: newPartidaData.numeroActa || params.suplementarioNumero,
          nombres: newPartidaData.firstName,
          apellidos: newPartidaData.lastName,
          fechaNacimiento: newPartidaData.birthDate,
          lugarNacimiento: newPartidaData.lugarNacimientoDetalle,
          fechaSacramento: newPartidaData.sacramentDate,
          lugarBautismo: newPartidaData.lugarBautismo,
          nombrePadre: newPartidaData.fatherName,
          cedulaPadre: newPartidaData.ceduPadre,
          nombreMadre: newPartidaData.motherName,
          cedulaMadre: newPartidaData.ceduMadre,
          tipoUnionPadres: parseInt(newPartidaData.tipoUnionPadres) || 1,
          sexo: newPartidaData.sex,
          abuelosPaternos: newPartidaData.paternalGrandparents,
          abuelosMaternos: newPartidaData.maternalGrandparents,
          padrinos: newPartidaData.godparents,
          ministro: newPartidaData.minister,
          daFe: newPartidaData.ministerFaith || nombreSacerdoteDestino,
          serialRegistro: newPartidaData.serialRegCivil,
          nuip: newPartidaData.nuipNuit,
          oficinaRegistro: newPartidaData.oficinaRegistro,
          fechaExpedicionRegistro: newPartidaData.fechaExpedicion,
          status: 'seated', 
          estado: 'Activo', 
          isSupplementary: true, 
          creadoPorDecreto: true, 
          hasDecree: true,
          correctionDecreeRef: decreeData.numeroDecreto,
          replacementDecreeRef: decreeData.numeroDecreto,
          notaMarginal: notaReposicion, 
          marginNote: notaReposicion,
          createdAt: new Date().toISOString()
        };
        baptisms.push(newPartida);
        localStorage.setItem(baptismsKey, JSON.stringify(baptisms));
        localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(baptisms));
        try {
            await saveBaptismToSource(newPartida, targetParishId, newPartida.status);
        } catch(e) {}
        const nextSupletorio = calculateNextConsecutive(
            params.suplementarioNumero || 1, 
            params.suplementarioFolio || 1, 
            params.suplementarioLibro || 1, 
            params.suplementarioPartidas || 2, 
            params.suplementarioReiniciar
        );
        localStorage.setItem(`baptismParameters_${targetParishId}`, JSON.stringify({ 
            ...params, 
            suplementarioNumero: nextSupletorio.numero,
            suplementarioFolio: nextSupletorio.folio,
            suplementarioLibro: nextSupletorio.libro
        }));
        const fullName = `${newPartida.nombres || ''} ${newPartida.apellidos || ''}`.trim().toUpperCase();
        const commonDecreeInfo = {
          ...decreeData,
          decreeNumber: decreeData.numeroDecreto,
          decreeDate: decreeData.fechaDecreto,    
          type: 'replacement', 
          sacrament: 'bautismo',
          newPartidaId: newPartida.id, 
          nombreSacerdoteDestino, 
          targetParishId, 
          targetParishName: parishLabel,
          targetName: fullName, 
          nombres: newPartida.nombres, 
          apellidos: newPartida.apellidos,
          concepto: nombreConceptoText, 
          causa: nombreConceptoText,    
          estado: 'Activo',             
          status: 'Activo',             
          newPartidaSummary: { book: newPartida.book_number, page: newPartida.page_number, entry: newPartida.entry_number },
          datosNuevaPartida: newPartida,
          createdAt: new Date().toISOString()
        };
        const parishReplacementsKey = `decreeReplacementBaptism_${targetParishId}`;
        let parishReplacements = JSON.parse(localStorage.getItem(parishReplacementsKey) || '[]');
        parishReplacements.push({ ...commonDecreeInfo, id: generateUUID(), parroquia: parishLabel });
        localStorage.setItem(parishReplacementsKey, JSON.stringify(parishReplacements));
        const chanceryDecreeRecord = { ...commonDecreeInfo, id: generateUUID(), isMasterCopy: true };
        chanceryReplacements.push(chanceryDecreeRecord);
        localStorage.setItem(chanceryReplacementsKey, JSON.stringify(chanceryReplacements));
        try {
            await supabase.from('decretos').insert([{ id: chanceryDecreeRecord.id, parish_id: targetParishId, tipo: 'reposicion', payload: chanceryDecreeRecord }]);
        } catch(e) {}
        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Decreto emitido y partida supletoria generada.", data: chanceryDecreeRecord };
      } catch (e) {
        console.error(e);
        return { success: false, message: e.message };
      }
  };

  // --- MÉTODOS Y STUBS FALTANTES RESTAURADOS PARA EVITAR CRASH ---
  const validateMatrimonioNumbers = async (libro, folio, numero, parishId) => {
      const list = getMatrimonios(parishId);
      const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
      if (exists) return { valid: false, message: "Numeración duplicada" };
      return { valid: true };
  };

  const validateConfirmationNumbers = async (libro, folio, numero, parishId) => {
      const list = getConfirmations(parishId);
      const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
      if (exists) return { valid: false, message: "Numeración duplicada" };
      return { valid: true };
  };

  const importDiocesis = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const importIglesias = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const importObispos = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const importMisDatos = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const importMisDatosLegacy = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const importPaises = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const importParroquiasExternas = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const importDeaths = async () => ({ success: true, message: "Operación Legacy ignorada" });
  const fetchCatalogsFromSource = async () => [];

  const getPaises = (parishId) => getAuxData('paises', parishId);
  const getParroquiasExternas = (parishId) => getAuxData('parroquias_externas', parishId);

  return (
    <AppDataContext.Provider value={{
        data,
        validateJSONStructure,
        purificarRegistroBautismo,
        guardarEnPermanentes,     
        getBaptisms, 
        getPendingBaptisms, 
        saveBaptismToSource,
        validateBaptismNumbers,
        seatBaptism,
        importBaptisms,
        addBaptismsFromJSON,
        seatMultipleBaptisms,
        getNextBaptismNumbers,
        getBaptismCorrections,
        createBaptismCorrection,
        deleteBaptismCorrection,
        updateBaptismCorrection,
        processBaptismDecreeBatch,
        getDecreeReplacementsBySacrament,
        getDecreeReplacementBaptisms,
        createDecreeReplacement,
        saveDecreeReplacementBaptism,
        updateDecreeReplacement,
        deleteDecreeReplacement,
        getDecreeReplacementByNewBaptismId,
        saveDecreeReplacement,
        saveBaptism,
        searchBaptismGlobal,
        createChanceryCorrection,
        createChanceryReplacement,
        createVicary,
        createDecanate, addDecanate: createDecanate,
        deleteVicary,
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
        getConceptosAnulacion,
        getConceptoAnulacion,
        addConceptoAnulacion,
        updateConceptoAnulacion,
        deleteConceptoAnulacion,
        getAnnulmentConcepts: getConceptosAnulacion,
        createAnnulmentConcept: addConceptoAnulacion,
        editAnnulmentConcept: updateConceptoAnulacion,
        deleteAnnulmentConcept: deleteConceptoAnulacion,
        getMisDatosList,
        addMisDatosRecord, 
        updateMisDatosRecord, 
        deleteMisDatosRecord,
        addMisDatos: addMisDatosRecord, 
        updateMisDatos: updateMisDatosRecord, 
        deleteMisDatos: deleteMisDatosRecord,
        getParrocos,
        getParrocoActual, 
        addParroco, 
        updateParroco, 
        deleteParroco, 
        actualizarParrocoActual, 
        actualizarEstadoParrocos: actualizarParrocoActual,
        importParrocos, // <-- Agregada
        obtenerNotasAlMargen,
        generarNotaAlMargenAnulada,
        generarNotaAlMargenNuevaPartida,
        generarNotaAlMargenEstandar,
        actualizarNotaAlMargenCorreccion,
        actualizarNotaAlMargenReposicion,
        actualizarNotaAlMargenEstandar,
        getBaptismParameters,
        saveBaptismParameters,
        getDecrees,
        addDecreesFromJSON,
        getParishNotifications,
        createNotification,
        updateNotificationStatus,
        deleteNotification,
        addNotificationToParish,
        createUniversalBackup,
        getUniversalBackups,
        restoreUniversalBackup,
        deleteUniversalBackup,
        exportUniversalBackup,
        importUniversalBackup,
        getUniversalBackupInfo,
        matrimonialNotifications,
        matrimonialNotificationAvisos,
        guardarNotificacionMatrimonial: handleGuardarNotificacionMatrimonial,
        obtenerNotificacionesMatrimoniales,
        obtenerAvisosNotificacion,
        obtenerAvisosParroquia: getAvisosParroquia,
        cargarAvisosParroquia,
        marcarAvisoComoVisto,
        marcarAvisoComoVistoAntiguo: updateAvisoStatus, 
        deleteNotificacionMatrimonial,
        getDocumentosParroquia,
        getParroquiasReceptoras,
        getMatrimonialDocumentByBaptismPartidaId,
        getMatrimonios, getPendingMatrimonios, saveMatrimonioToSource, seatMatrimonio, seatMultipleMatrimonios, validateMatrimonioNumbers, getNextMatrimonioNumbers, getMatrimonioParameters, updateMatrimonioParameters, resetMatrimonioParameters,
        importMarriages,
        getConfirmations, getPendingConfirmations, saveConfirmationToSource, seatConfirmation, seatMultipleConfirmations, validateConfirmationNumbers, getNextConfirmationNumbers, getConfirmationParameters, updateConfirmationParameters, resetConfirmationParameters,
        importConfirmations, addConfirmationsFromJSON,
        importDiocesis, importIglesias, importObispos, importParrocos, importMisDatos, importMisDatosLegacy, importCiudades, importPaises, importParroquiasExternas,
        getDiocesis, addDiocesis, updateDiocesis, deleteDiocesis,
        getIglesias, getIglesiasList, addIglesia, updateIglesia, deleteIglesia,
        getObispos, addObispo, updateObispo, deleteObispo,
        getCiudadesList, addCiudad, updateCiudad, deleteCiudad, 
        getPaises, getParroquiasExternas,
        importDeaths,
        fetchCatalogsFromSource,
        validateUserCredentials,
        saveData,
        getVicariesByDiocese,
        user: currentUser
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