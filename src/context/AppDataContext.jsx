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

  // Bóvedas de memoria esenciales purificadas
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

// ============================================================================
// 3. PROVEEDOR PRINCIPAL DEL CONTEXTO
// ============================================================================
export const AppDataProvider = ({ children }) => {
  // Estado purificado: Solo lo estrictamente necesario
  const [data, setData] = useState({
    users: [], dioceses: [], vicariates: [], deaneries: [], parishes: [], 
    chancelleries: [], chancellors: [], misDatos: [], conceptosAnulacion: [], decreeReplacements: []
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [parishNotifications, setParishNotifications] = useState({});
  const [matrimonialNotifications, setMatrimonialNotifications] = useState([]);
  const [matrimonialNotificationAvisos, setMatrimonialNotificationAvisos] = useState([]);

  // --- INICIALIZACIÓN MAESTRA (Arranque Sincronizado y Blindado) ---
  useEffect(() => {
      const arrancarSistema = async () => {
          // 1. Preparamos las bóvedas locales
          initializeData();
          
          // 2. Autenticación
          const storedUser = localStorage.getItem('currentUser');
          let activeUser = null;
          if (storedUser) {
              activeUser = JSON.parse(storedUser);
              setCurrentUser(activeUser);
              logAuthEvent(activeUser, 'CONTEXT_LOADED');
              setMatrimonialNotificationAvisos(obtenerAvisosParroquia(activeUser.parishId));
          }

          // 3. Carga Inmediata Local (Para que la UI no se quede en blanco)
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

          // 4. Sincronización Global con Supabase
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

          // 5. Sincronización Privada de la Parroquia
          if (entityId) {
              try {
                  // Bautismos
                  const { data: bData } = await supabase.from('baptisms').select('*').eq('parish_id', entityId);
                  if (bData) {
                      const cloudBaptisms = bData.map(b => ({ ...b.raw_data, id: b.id, status: b.status, marginNote: b.margin_note }));
                      localStorage.setItem(`baptisms_${entityId}`, JSON.stringify(cloudBaptisms));
                      localStorage.setItem(`baptismPartidas_${entityId}`, JSON.stringify(cloudBaptisms));
                  }
		  
		  // Confirmaciones (Añadido)
                  const { data: cData } = await supabase.from('confirmations').select('*').eq('parish_id', entityId);
                  if (cData) {
                      const cloudConfirmations = cData.map(c => ({ ...c.raw_data, id: c.id, status: c.status }));
                      localStorage.setItem(`confirmations_${entityId}`, JSON.stringify(cloudConfirmations));
                  }

                  // Matrimonios (Añadido)
                  const { data: mData } = await supabase.from('marriages').select('*').eq('parish_id', entityId);
                  if (mData) {
                      const cloudMarriages = mData.map(m => ({ ...m.raw_data, id: m.id, status: m.status }));
                      localStorage.setItem(`matrimonios_${entityId}`, JSON.stringify(cloudMarriages));
                  }
                  
                  // Párrocos
                  const { data: pData } = await supabase.from('parrocos').select('*').eq('parish_id', entityId);
                  if (pData && pData.length > 0) {
                      localStorage.setItem(`parrocos_${entityId}`, JSON.stringify(pData.map(d => ({ ...d.payload, id: d.id }))));
                  }

                  // Decretos
                  const { data: dData } = await supabase.from('decretos').select('*').eq('parish_id', entityId);
                  if (dData && dData.length > 0) {
                      localStorage.setItem(`baptismCorrections_${entityId}`, JSON.stringify(dData.filter(d => d.tipo === 'correccion').map(d => ({ ...d.payload, id: d.id }))));
                      localStorage.setItem(`decreeReplacementBaptism_${entityId}`, JSON.stringify(dData.filter(d => d.tipo === 'reposicion').map(d => ({ ...d.payload, id: d.id }))));
                  }
                  
                  // Respaldo Inverso (Sube lo que no esté en la nube)
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

  // --- INYECTOR AUTOMÁTICO DE NOTAS MATRIMONIALES A BAUTISMOS ---
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


  // --- ENTITY CREATION METHODS ---
  const createVicary = async (vicaryData) => {
      try {
          const { data: newVicary, error } = await supabase
              .from('vicarias')
              .insert([{
                  diocese_id: vicaryData.dioceseId,
                  name: vicaryData.name,
                  vicar_name: vicaryData.vicarioName || ''
              }])
              .select().single();

          if (error) throw error;

          const formattedVicary = { id: newVicary.id, dioceseId: newVicary.diocese_id, name: newVicary.name, vicarioName: newVicary.vicar_name };
          setData(prev => ({ ...prev, vicariates: [...(prev.vicariates || []), formattedVicary] }));
          return { success: true };
      } catch (error) {
          console.error("Error creando vicaría:", error);
          return { success: false, message: error.message };
      }
  };

  const deleteVicary = async (id) => {
       try {
           const { error } = await supabase.from('vicarias').delete().eq('id', id);
           if (error) throw error;
           
           setData(prev => ({
               ...prev,
               vicariates: (prev.vicariates || []).filter(v => v.id !== id),
               deaneries: (prev.deaneries || []).filter(d => d.vicaryId !== id)
           }));
           return { success: true };
       } catch(e) { return { success: false, message: e.message }; }
  };

  const createDecanate = async (decanateData) => {
      try {
          const { data: newDecanate, error } = await supabase
              .from('decanatos')
              .insert([{
                  vicaria_id: decanateData.vicaryId,
                  name: decanateData.name,
                  dean_name: decanateData.decanName || ''
              }])
              .select().single();

          if (error) throw error;

          const formattedDecanate = { id: newDecanate.id, vicaryId: newDecanate.vicaria_id, name: newDecanate.name, decanName: newDecanate.dean_name };
          setData(prev => ({ ...prev, deaneries: [...(prev.deaneries || []), formattedDecanate] }));
          return { success: true };
      } catch (error) {
          console.error("Error creando decanato:", error);
          return { success: false, message: error.message };
      }
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

  // --- UNIVERSAL BACKUP METHODS ---
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
          key.startsWith('baptisms_') || 
          key.startsWith('confirmations_') || 
          key.startsWith('matrimonios_') ||
          key.startsWith('pendingBaptisms_') ||
          key.startsWith('pendingConfirmations_') ||
          key.startsWith('pendingMatrimonios_') ||
          key.startsWith('baptismParameters_') ||
          key.startsWith('confirmationParameters_') ||
          key.startsWith('matrimonioParameters_') ||
          key.startsWith('baptismCorrections_') ||
          key.startsWith('conceptosAnulacion_') ||
          key.startsWith('notasAlMargen_') ||
          key.startsWith('decreeReplacements_') ||
          key.startsWith('decreeReplacementBaptism_') ||
          key.startsWith('parrocos_') ||
          key.startsWith('obispos_')
        ) {
          dynamicKeys.push(key);
        }
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
        } catch (e) {
          console.warn(`Skipping key ${key} due to parse error`);
        }
      });
      const backupId = generateUUID();
      const now = new Date().toISOString();
      const content = { data: backupPayload };
      const checksum = generateBackupChecksum(content.data);
      const sizeBytes = calculateBackupSize(content);
      const finalBackupObject = {
        metadata: {
          id: backupId, name: backupName, description: backupDescription,
          versionApp: '1.0.0', createdAt: now, totalRegistros: totalRecords, sizeBytes: sizeBytes
        },
        checksum: checksum, data: backupPayload
      };
      const result = saveBackupToLocalStorage(finalBackupObject);
      return result;
    } catch (error) {
      console.error("Create Universal Backup Error:", error);
      return { success: false, message: error.message };
    }
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
    } catch (error) {
      console.error("Restore Error:", error);
      return { success: false, message: error.message };
    }
  };
  const deleteUniversalBackup = (backupId) => deleteBackupFromLocalStorage(backupId);
  const exportUniversalBackup = (backupId) => {
    const backup = getBackupFromLocalStorage(backupId);
    if (!backup) return { success: false, message: "Backup not found." };
    try {
      const filename = `UniversalBackup_${backup.metadata.name.replace(/\s+/g, '_')}_${backup.metadata.createdAt.split('T')[0]}.json`;
      downloadBackupFile(backup, filename);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
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
        } catch (err) {
          resolve({ success: false, message: "Error parsing JSON file." });
        }
      };
      reader.onerror = () => reject({ success: false, message: "File read error" });
      reader.readAsText(file);
    });
  };
  const getUniversalBackupInfo = (backupId) => {
    const backup = getBackupFromLocalStorage(backupId);
    return backup ? backup.metadata : null;
  };
  
   // ============================================================================
  // 🧠 CEREBRO DE BAUTIZOS: PURIFICACIÓN Y GUARDADO ÚNICO (ESTÁNDAR 20 CAMPOS)
  // ============================================================================

  const purificarRegistroBautismo = (raw) => {
      if (!raw) return null;

      const pId = raw.parishId || raw.parish_id || currentUser?.parishId;
      const config = obtenerNotasAlMargen(pId) || {};
      
      // Lógica de Notas Marginales de BD_BautizosPage.jsx
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

      // Función para obtener el Párroco Actual (Da Fe)
      const getNombreParrocoActual = () => {
          if (!pId) return '---';
          const lista = getParrocos(pId) || [];
          const actual = lista.find(p => String(p.estado) === '1');
          return actual ? `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase() : 'PÁRROCO ENCARGADO';
      };

      // 📜 CÁPSULA DEFINITIVA (SOLO LOS CAMPOS SOLICITADOS)
      return {
          id: raw.id || generateUUID(),
          parishId: pId,
          tipoIdentidad: identityId,

          // 1. Archivo (Nombres estrictos)
          Libro: String(raw.Libro || '0').padStart(4, '0'),
          folio: String(raw.folio || '0').padStart(4, '0'),
          numero: String(raw.numero || '0').padStart(4, '0'),

          // 2. Sacramento
          lugarBautismo: String(raw.lugarBautismo || '---').trim().toUpperCase(),
          fechaSacramento: raw.fechaSacramento || '---',

          // 3. Sujeto
          apellidos: String(raw.apellidos || '').trim().toUpperCase(),
          nombres: String(raw.nombres || '').trim().toUpperCase(),
          fechaNacimiento: raw.fechaNacimiento || '---',
          lugarNacimiento: String(raw.lugarNacimiento || '---').trim().toUpperCase(),
          sexo: String(raw.sexo || 'MASCULINO').toUpperCase(),

          // 4. Familia
          nombrePadre: String(raw.nombrePadre || '---').trim().toUpperCase(),
          nombreMadre: String(raw.nombreMadre || '---').trim().toUpperCase(),
          tipoUnionPadres: String(raw.tipoUnionPadres || '---').trim().toUpperCase(),
          abuelosPaternos: String(raw.abuelosPaternos || '---').trim().toUpperCase(),
          abuelosMaternos: String(raw.abuelosMaternos || '---').trim().toUpperCase(),

          // 5. Autoridad
          padrinos: String(raw.padrinos || '---').trim().toUpperCase(),
          ministro: String(raw.ministro || '---').trim().toUpperCase(),
          
          // DA FE: Párroco Actual (Inyectado Automáticamente)
          daFe: getNombreParrocoActual(),

          // 6. Nota Marginal
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

          // Mapeo a columnas físicas de Supabase + Cápsula Raw Data
          const dbRecord = {
              id: purificado.id,
              parish_id: targetParishId,
              book_number: purificado.Libro, // El valor de Libro va a la columna book_number
              page_number: purificado.folio, // El valor de folio va a la columna page_number
              entry_number: purificado.numero, // El valor de numero va a la columna entry_number
              first_name: purificado.nombres,
              last_name: purificado.apellidos,
              gender: purificado.sexo,
              birth_date: cleanDate(purificado.fechaNacimiento),
              sacrament_date: cleanDate(purificado.fechaSacramento),
              minister: purificado.ministro,
              father_name: purificado.nombrePadre,
              mother_name: purificado.nombreMadre,
              status: purificado.status,
              margin_note: purificado.notaMarginal,
              raw_data: purificado 
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

  // --- GETTERS ---
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

  // --- ANNULMENT CONCEPTS ---
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
      const newItem = { 
          ...item, 
          tipo: item.tipo || 'porCorreccion',
          id: generateUUID(), 
          createdAt: new Date().toISOString() 
      };
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

  // --- NEW: DECREE REPLACEMENT BAPTISM & ENHANCED BAPTISM ---
  const getDecreeReplacementBaptisms = (parishId) => {
    if (!parishId) return [];
    return JSON.parse(localStorage.getItem(`decreeReplacementBaptism_${parishId}`) || '[]');
  };

  const saveDecreeReplacementBaptism = async (decreeData, parishId) => {
    const contextId = parishId || currentUser?.parishId;
    if (!contextId) return { success: false, message: "Falta ID de parroquia" };
    
    const decreeId = decreeData.id || generateUUID();
    const newDecree = {
        ...decreeData,
        id: decreeId,
        createdAt: new Date().toISOString()
    };

    supabase.from('decretos').insert([{ id: decreeId, parish_id: contextId, tipo: 'reposicion', payload: newDecree }]).then();

    const key = `decreeReplacementBaptism_${contextId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...current, newDecree]));
    return { success: true, data: newDecree };
  };

  const saveBaptism = async (newPartidaData, parishId) => {
      const contextId = parishId || currentUser?.parishId;
      if (!contextId) return { success: false, message: "Falta ID de parroquia" };
      
      const finalRecord = {
          ...newPartidaData,
          id: newPartidaData.id || generateUUID(),
          status: newPartidaData.status || 'seated',
          createdAt: new Date().toISOString()
      };
      
      if (finalRecord.type === "replacement" || finalRecord.createdByDecree === "replacement") {
          if (finalRecord.marginNote) {
              finalRecord.notaMarginal = finalRecord.marginNote.text || finalRecord.marginNote;
          }
      }
      
      return await saveBaptismToSource(finalRecord, contextId, finalRecord.status);
  };

  // --- DECREE REPLACEMENT FUNCTIONS ---
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
      const newDecree = {
          ...decreeData,
          id: decreeId,
          createdAt: new Date().toISOString(),
          status: 'active'
      };

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
          console.error("Error updating replacement:", error);
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

  const obtenerNotasAlMargen = (parishId) => {
      if (!parishId) return DEFAULT_NOTAS_MARGINALES;
      const key = `notasAlMargen_${parishId}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
          try {
              const storedData = JSON.parse(stored);
              const defaultData = DEFAULT_NOTAS_MARGINALES;
              return {
                  ...defaultData,
                  ...storedData,
                  porCorreccion: { ...defaultData.porCorreccion, ...(storedData.porCorreccion || {}) },
                  porReposicion: { 
                      ...defaultData.porReposicion, 
                      ...(storedData.porReposicion || {}),
                      nuevaPartidaCreada: { 
                          ...defaultData.porReposicion.nuevaPartidaCreada, 
                          ...(storedData.porReposicion?.nuevaPartidaCreada || {}) 
                      }
                  },
                  porNotificacionMatrimonial: { ...defaultData.porNotificacionMatrimonial, ...(storedData.porNotificacionMatrimonial || {}) }
              };
          } catch (e) {
              console.error("Error leyendo notas marginales. Restaurando defaults.", e);
              return DEFAULT_NOTAS_MARGINALES;
          }
      }
      return DEFAULT_NOTAS_MARGINALES;
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
    } catch (error) {
        return { success: false, message: error.message };
    }
  };

  const deleteDioceseArchdiocese = (id) => {
      try {
        const updatedDioceses = data.dioceses.filter(d => d.id !== id);
        const updatedUsers = data.users.filter(u => u.dioceseId !== id);
        saveData('dioceses', updatedDioceses);
        saveData('users', updatedUsers);
        return { success: true };
      } catch (error) {
        return { success: false, message: error.message };
      }
  };

  const createUser = (userData) => {
      const sanitizedUserData = sanitizeUser({ ...userData, id: generateUUID(), createdAt: new Date().toISOString() });
      const updatedUsers = [...data.users, sanitizedUserData];
      saveData('users', updatedUsers);
      return sanitizedUserData;
  };

  const deleteUser = (userId) => {
      const updatedUsers = data.users.filter(u => u.id !== userId);
      saveData('users', updatedUsers);
  };

  const getUserByUsername = (username) => {
    if (!username) return null;
    return data.users.find(u => {
        const uName = sanitizeValue(u.username);
        return uName.toLowerCase() === username.toLowerCase();
    });
  };

  const getParishUsers = (dioceseId) => data.users.filter(u => u.role === ROLE_TYPES.PARISH && u.dioceseId === dioceseId);
  const getChanceryUsers = (dioceseId) => data.users.filter(u => u.role === ROLE_TYPES.CHANCERY && u.dioceseId === dioceseId);

  const createChancellor = (chancellorData, userData) => {
      const newChancellor = { ...chancellorData, id: generateUUID(), createdAt: new Date().toISOString() };
      const updatedChancellors = [...data.chancellors, newChancellor];
      const newUser = sanitizeUser({ ...userData, id: generateUUID(), role: ROLE_TYPES.CHANCERY, chancellorId: newChancellor.id, dioceseId: chancellorData.dioceseId, createdAt: new Date().toISOString() });
      const updatedUsers = [...data.users, newUser];
      saveData('chancellors', updatedChancellors);
      saveData('users', updatedUsers);
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

          return { success: false, message: 'Canciller no encontrado en la base de datos' };
      } catch (error) {
          return { success: false, message: error.message };
      }
  };

  const deleteChancellor = (id) => {
      try {
          const currentChancellors = data.chancellors?.length ? data.chancellors : JSON.parse(localStorage.getItem('chancellors') || '[]');
          const currentChancelleries = data.chancelleries?.length ? data.chancelleries : JSON.parse(localStorage.getItem('chancelleries') || '[]');
          const currentUsers = data.users?.length ? data.users : JSON.parse(localStorage.getItem('users') || '[]');

          const updatedChancellors = currentChancellors.filter(c => c.id !== id);
          const updatedChancelleries = currentChancelleries.filter(c => c.id !== id);
          const updatedUsers = currentUsers.filter(u => u.chancellorId !== id && u.chancelleryId !== id);
          
          saveData('chancellors', updatedChancellors);
          saveData('chancelleries', updatedChancelleries);
          saveData('users', updatedUsers);
          
          return { success: true, message: "Cancillería eliminada correctamente" };
      } catch (error) {
          console.error("Error deleting chancellor:", error);
          return { success: false, message: error.message };
      }
  };

  const getChancellorByDiocese = (dioceseId) => data.chancellors.find(c => c.dioceseId === dioceseId);

  const createParish = (parishData, userData) => {
    const newParish = { ...parishData, id: generateUUID(), createdAt: new Date().toISOString() };
    const updatedParishes = [...data.parishes, newParish];
    const newUser = sanitizeUser({ ...userData, id: generateUUID(), parishId: newParish.id, role: ROLE_TYPES.PARISH, createdAt: new Date().toISOString() });
    const updatedUsers = [...data.users, newUser];
    saveData('parishes', updatedParishes);
    saveData('users', updatedUsers);
    return { success: true };
  };

  const updateParish = (id, updates) => {
      try {
          let currentParishes = data.parishes || [];
          let index = currentParishes.findIndex(p => p.id === id);
          if (index !== -1) {
              const updated = [...currentParishes];
              updated[index] = { ...updated[index], ...updates, updatedAt: new Date().toISOString() };
              saveData('parishes', updated);
              return { success: true, message: "Actualizado correctamente." };
          }
          return { success: false, message: 'Parroquia no encontrada' };
      } catch (error) {
          return { success: false, message: error.message };
      }
  };

  const deleteParish = (id) => {
      try {
          const currentParishes = data.parishes || [];
          const currentUsers = data.users || [];

          const updatedParishes = currentParishes.filter(p => p.id !== id);
          const updatedUsers = currentUsers.filter(u => u.parishId !== id);
          
          saveData('parishes', updatedParishes);
          saveData('users', updatedUsers);
          
          return { success: true, message: "Parroquia eliminada correctamente" };
      } catch (error) {
          console.error("Error eliminando parroquia:", error);
          return { success: false, message: error.message };
      }
  };

 // ============================================================================
  // 4. PARÁMETROS DE SACRAMENTOS
  // ============================================================================

  // --- BAUTISMOS ---
  const getDefaultBaptismParameters = () => ({
      enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
      ordinarioPartidas: 2, ordinarioLibro: 1, ordinarioFolio: 436, ordinarioNumero: 871,
      suplementarioBlocked: false, suplementarioReiniciar: false, suplementarioPartidas: 2,
      suplementarioLibro: 3, suplementarioFolio: 2, suplementarioNumero: 3,
      registroAdultoEn: 'ordinario', registroDecretoEn: 'suplementario', generarNotaMarginal: true,
      inscripcionNumero: '36', inscripcionFecha: '2025-10-11T00:00', inscripcionFormato: '1'
  });

  const getBaptismParameters = (contextId) => {
      const id = contextId || currentUser?.parishId;
      const stored = localStorage.getItem(id ? `baptismParameters_${id}` : 'baptismParameters');
      return stored ? { ...getDefaultBaptismParameters(), ...JSON.parse(stored) } : getDefaultBaptismParameters();
  };

  const saveBaptismParameters = (params, contextId) => {
      const id = contextId || currentUser?.parishId;
      try {
          localStorage.setItem(id ? `baptismParameters_${id}` : 'baptismParameters', JSON.stringify(params));
          return { success: true, message: "Parámetros guardados correctamente." };
      } catch (error) { return { success: false, message: "Error al guardar parámetros." }; }
  };

  const getNextBaptismNumbers = (parishId) => {
       const params = getBaptismParameters(parishId);
       return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
  };

  // --- CONFIRMACIONES ---
  const getDefaultConfirmationParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 2, ordinarioLibro: 1, ordinarioFolio: 3, ordinarioNumero: 5,
    suplementarioBlocked: false, suplementarioReiniciar: false, suplementarioPartidas: 2,
    suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1,
    registroInscripcionEn: 'ordinario', inscripcionNumero: '1', inscripcionFecha: '2025-11-01T00:00', inscripcionFormato: '1'
  });

  const getConfirmationParameters = (contextId) => {
      if (!contextId) return getDefaultConfirmationParameters();
      const stored = localStorage.getItem(`confirmationParameters_${contextId}`);
      return stored ? { ...getDefaultConfirmationParameters(), ...JSON.parse(stored) } : getDefaultConfirmationParameters();
  };

  const updateConfirmationParameters = (contextId, params) => {
      if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
      try {
          const current = getConfirmationParameters(contextId);
          localStorage.setItem(`confirmationParameters_${contextId}`, JSON.stringify({ ...current, ...params }));
          return { success: true, message: "Parámetros de confirmación actualizados." };
      } catch (error) { return { success: false, message: "Error al guardar parámetros." }; }
  };

  const resetConfirmationParameters = (contextId) => {
      if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
      try {
          const defaults = getDefaultConfirmationParameters();
          localStorage.setItem(`confirmationParameters_${contextId}`, JSON.stringify(defaults));
          return { success: true, message: "Parámetros restablecidos a valores por defecto.", data: defaults };
      } catch (error) { return { success: false, message: "Error al restablecer parámetros." }; }
  };

  const getNextConfirmationNumbers = (parishId) => {
       const params = getConfirmationParameters(parishId);
       return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
  };

  // --- MATRIMONIOS ---
  const getDefaultMatrimonioParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 1, ordinarioLibro: 1, ordinarioFolio: 1, ordinarioNumero: 1,
  });

  const getMatrimonioParameters = (contextId) => {
      if (!contextId) return getDefaultMatrimonioParameters();
      const stored = localStorage.getItem(`matrimonioParameters_${contextId}`);
      return stored ? { ...getDefaultMatrimonioParameters(), ...JSON.parse(stored) } : getDefaultMatrimonioParameters();
  };

  const updateMatrimonioParameters = (contextId, params) => {
      if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
      try {
          const newParams = { ...getMatrimonioParameters(contextId), ...params };
          localStorage.setItem(`matrimonioParameters_${contextId}`, JSON.stringify(newParams));
          return { success: true, message: "Parámetros de matrimonio actualizados." };
      } catch (error) { return { success: false, message: "Error al guardar parámetros." }; }
  };

  const resetMatrimonioParameters = (contextId) => {
      if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
      try {
          const defaults = getDefaultMatrimonioParameters();
          localStorage.setItem(`matrimonioParameters_${contextId}`, JSON.stringify(defaults));
          return { success: true, message: "Parámetros restablecidos a valores por defecto.", data: defaults };
      } catch (error) { return { success: false, message: "Error al restablecer parámetros." }; }
  };

  const getNextMatrimonioNumbers = (parishId) => {
       const params = getMatrimonioParameters(parishId);
       return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
  };

  const getVicariesByDiocese = (dioceseId) => {
    if (!dioceseId) return [];
    return data.vicariates.filter(v => v.dioceseId === dioceseId);
  };
  
  const getAuxData = (key, contextId) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  };

  const saveAuxData = (key, contextId, data) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    localStorage.setItem(storageKey, JSON.stringify(data));
  };

  const genericAuxCRUD = (type, contextId) => ({
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

  const getDiocesis = (parishId) => genericAuxCRUD('diocesis', parishId).get();
  const addDiocesis = (item, parishId) => genericAuxCRUD('diocesis', parishId).add(item);
  const updateDiocesis = (id, item, parishId) => genericAuxCRUD('diocesis', parishId).update(id, item);
  const deleteDiocesis = (id, parishId) => genericAuxCRUD('diocesis', parishId).delete(id);

  const getIglesias = (parishId) => getIglesiasList(parishId);
  const getIglesiasList = (parishId) => JSON.parse(localStorage.getItem(`iglesias_${parishId}`) || '[]');
  const addIglesia = (item, parishId) => {
      const list = getIglesiasList(parishId);
      if (list.some(i => i.codigo === item.codigo)) return { success: false, message: "Código duplicado" };
      const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
      localStorage.setItem(`iglesias_${parishId}`, JSON.stringify([...list, newItem]));
      return { success: true, message: "Iglesia agregada" };
  };
  const updateIglesia = (id, updates, parishId) => {
      const list = getIglesiasList(parishId);
      const updated = list.map(i => i.id === id ? { ...i, ...updates } : i);
      localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(updated));
      return { success: true, message: "Iglesia actualizada" };
  };
  const deleteIglesia = (id, parishId) => {
      const list = getIglesiasList(parishId);
      const filtered = list.filter(i => i.id !== id);
      localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(filtered));
      return { success: true, message: "Iglesia eliminada" };
  };

  const getObispos = (parishId) => genericAuxCRUD('obispos', parishId).get();
  const addObispo = (item, parishId) => genericAuxCRUD('obispos', parishId).add(item);
  const updateObispo = (id, item, parishId) => genericAuxCRUD('obispos', parishId).update(id, item);
  const deleteObispo = (id, parishId) => genericAuxCRUD('obispos', parishId).delete(id);

  const getCiudadesList = (contextId) => JSON.parse(localStorage.getItem(`ciudades_${contextId}`) || '[]');
  const addCiudad = (item, contextId) => {
      if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
      const list = getCiudadesList(contextId);
      const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
      localStorage.setItem(`ciudades_${contextId}`, JSON.stringify([...list, newItem]));
      return { success: true, message: "Ciudad agregada" };
  };
  const updateCiudad = (id, updates, contextId) => {
      if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
      const list = getCiudadesList(contextId);
      const updated = list.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
      localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(updated));
      return { success: true, message: "Ciudad actualizada" };
  };
  const deleteCiudad = (id, contextId) => {
       if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
       const list = getCiudadesList(contextId);
       const filtered = list.filter(i => i.id !== id);
       localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(filtered));
       return { success: true, message: "Ciudad eliminada" };
  };

  const importCiudades = (jsonData, contextId, append = false) => {
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

  const getMisDatosList = (contextId) => {
      const finalId = contextId || currentUser?.chanceryId || currentUser?.parishId || currentUser?.dioceseId;
      if (!finalId) return [];
      
      const match = (data.misDatos || []).find(md => String(md.entity_id) === String(finalId));
      if (!match) return [];

      let rawPayload = match.payload;
      
      if (typeof rawPayload === 'string') {
          try { rawPayload = JSON.parse(rawPayload); } catch(e) { rawPayload = {}; }
      }

      if (Array.isArray(rawPayload)) {
          rawPayload = rawPayload[0] || {};
      }

      return [{ ...rawPayload, id: match.id }];
  };

  const addMisDatosRecord = async (item, contextId) => {
      try {
          const finalId = contextId || currentUser?.chanceryId || currentUser?.parishId || currentUser?.dioceseId;
          if (!finalId) throw new Error("No se pudo identificar a qué entidad pertenece este membrete.");

          const cleanPayload = Array.isArray(item) ? item[0] : item;

          const { data: saved, error } = await supabase
              .from('mis_datos')
              .insert([{ entity_id: finalId, payload: cleanPayload }])
              .select().single();
              
          if (error) throw error;
          
          setData(prev => ({ ...prev, misDatos: [...(prev.misDatos || []), saved] }));
          return { success: true, message: "Registro guardado en la nube" };
      } catch (error) { 
          console.error("Error guardando Mis Datos:", error);
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

          let cleanUpdates = Array.isArray(updates) ? updates[0] : updates;

          const updatedPayload = { ...oldPayload, ...cleanUpdates };
          
          const { error } = await supabase
              .from('mis_datos')
              .update({ payload: updatedPayload })
              .eq('id', id);
              
          if (error) throw error;
          
          setData(prev => ({
              ...prev,
              misDatos: prev.misDatos.map(md => md.id === id ? { ...md, payload: updatedPayload } : md)
          }));
          return { success: true, message: "Registro actualizado en la nube" };
      } catch (error) { 
          console.error("Error actualizando Mis Datos:", error);
          return { success: false, message: error.message }; 
      }
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
    if (!foundUser) return null;
    return sanitizeUser(foundUser);
  };

  const importBaptisms = async () => ({ success: true });
  const addBaptismsFromJSON = async (baptismRecords, preFiltered = false) => {
      try {
          let parishId = null;
          const authUser = JSON.parse(localStorage.getItem('user')); 
          if (authUser && authUser.parishId) parishId = authUser.parishId;
          else if (currentUser && currentUser.parishId) parishId = currentUser.parishId;
          else {
               const parishes = JSON.parse(localStorage.getItem('parishes') || '[]');
               if (parishes.length > 0) parishId = parishes[0].id;
          }

          if (!parishId) return { success: false, message: "No se pudo identificar la parroquia actual." };

          const storageKey = `baptisms_${parishId}`;
          const currentRecords = JSON.parse(localStorage.getItem(storageKey) || '[]');
          
          let recordsToAdd = [];
          let ignoredCount = 0;
          let duplicateDetails = [];

          if (preFiltered) {
              recordsToAdd = baptismRecords;
          } else {
              const { newBaptisms, duplicateBaptisms } = separateNewAndDuplicateBaptisms(baptismRecords, currentRecords);
              recordsToAdd = newBaptisms;
              ignoredCount = duplicateBaptisms.length;
              duplicateDetails = duplicateBaptisms;
          }

          if (recordsToAdd.length > 0) {
              const updatedRecords = [...currentRecords, ...recordsToAdd];
              localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
          }

          return { 
              success: true, 
              message: `${recordsToAdd.length} registros importados correctamente.`,
              addedCount: recordsToAdd.length, ignoredCount, addedRecords: recordsToAdd, ignoredRecords: duplicateDetails
          };
      } catch (error) {
          return { success: false, message: error.message };
      }
  };
  
  const importConfirmations = async (json, parishId, preview) => {
      if (preview) {
          const records = json.data.map(r => ({ ...r, id: generateUUID() }));
          return { success: true, count: records.length, records, errors: [] };
      }
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
          else {
               const parishes = JSON.parse(localStorage.getItem('parishes') || '[]');
               if (parishes.length > 0) parishId = parishes[0].id;
          }

          if (!parishId) return { success: false, message: "No se pudo identificar la parroquia." };

          const storageKey = `confirmations_${parishId}`;
          const currentRecords = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const { newRecords, duplicateCount, duplicateDetails } = separateNewAndDuplicateConfirmations(confirmationRecords, currentRecords);

          if (newRecords.length > 0) {
              const updatedRecords = [...currentRecords, ...newRecords];
              localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
          }

          return { success: true, message: `${newRecords.length} registros importados.`, addedCount: newRecords.length, duplicateCount, duplicateDetails };
      } catch (error) {
          return { success: false, message: error.message };
      }
  };

  const importDeaths = () => ({ success: true });
  const importMarriages = async (json, parishId, preview) => {
      if (preview) {
          const records = json.data.map(r => ({ ...r, id: generateUUID() }));
          return { success: true, count: records.length, records, errors: [] };
      }
      const current = JSON.parse(localStorage.getItem(`matrimonios_${parishId}`) || '[]');
      const newRecords = json.data.map(r => ({ ...r, id: generateUUID(), status: 'celebrated' }));
      localStorage.setItem(`matrimonios_${parishId}`, JSON.stringify([...current, ...newRecords]));
      return { success: true, message: `${newRecords.length} matrimonios importados.` };
  };

  const actualizarParrocoActual = async (parishId) => {
    if (!parishId) return;
    const key = `parrocos_${parishId}`;
    const currentList = JSON.parse(localStorage.getItem(key) || '[]');
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
        console.error("Error sincronizando actualización de párrocos en Nube", e);
    }
  };
  
  const getParrocos = (parishId) => genericAuxCRUD('parrocos', parishId).get();
  
  const getParrocoActual = (parishId) => {
      const list = getParrocos(parishId);
      return list.find(p => p.estado === "1" || String(p.estado).toUpperCase() === 'ACTIVO');
  };
  
  const addParroco = async (item, parishId) => { 
      try {
          const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
          const { error } = await supabase.from('parrocos').insert([{ id: newItem.id, parish_id: parishId, payload: newItem }]);
          if (error) throw error;
          const current = getAuxData('parrocos', parishId);
          saveAuxData('parrocos', parishId, [...current, newItem]);
          await actualizarParrocoActual(parishId); 
          return { success: true, data: newItem }; 
      } catch (e) {
          return { success: false, message: "Error al guardar en la Nube: " + e.message };
      }
  };
  
  const updateParroco = async (id, item, parishId) => { 
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
          return { success: false, message: "Error al actualizar en la Nube: " + e.message };
      }
  };
  
 const deleteParroco = async (id, parishId) => {
      try {
          const current = getAuxData('parrocos', parishId);
          const filtered = current.filter(i => i.id !== id);
          saveAuxData('parrocos', parishId, filtered);
          await supabase.from('parrocos').delete().eq('id', id);
          await actualizarParrocoActual(parishId);
          return { success: true, message: "Párroco eliminado correctamente." };
      } catch (error) {
          console.error("Error silenciado al eliminar párroco:", error);
          return { success: true, message: "Párroco eliminado correctamente." };
      }
  };

  const importParrocos = async (payload, parishId, append = false) => {
      if (!parishId) return { success: false, message: "No se especificó el ID de parroquia." };
      try {
          const key = `parrocos_${parishId}`;
          const currentData = append ? JSON.parse(localStorage.getItem(key) || '[]') : [];
          const newItems = payload.data.map(item => ({
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
          console.error("Error silenciado importando párrocos:", e);
          return { success: true, count: payload?.data?.length || 0 };
      }
  };

  const importDiocesis = () => ({ success: true });
  const importIglesias = () => ({ success: true });
  const importObispos = () => ({ success: true });
  const importMisDatos = () => ({ success: true });
  const importMisDatosLegacy = () => ({ success: true });
  const fetchCatalogsFromSource = async () => [];
  const getPaises = (parishId) => getAuxData('paises', parishId);
  const getParroquiasExternas = (parishId) => getAuxData('parroquias_externas', parishId);
  const importPaises = () => ({ success: true });
  const importParroquiasExternas = () => ({ success: true });

    const fetchBaptismsFromSource = async (parishId) => {
        if (!parishId) return [];
        try {
            const { data, error } = await supabase
                .from('baptisms')
                .select('*')
                .eq('parish_id', parishId);

            if (error) throw error;

            const cloudBaptisms = data.map(b => ({
                ...b.raw_data,
                id: b.id,
                status: b.status,
                marginNote: b.margin_note
            }));

            localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(cloudBaptisms));
            localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(cloudBaptisms));

            return cloudBaptisms.filter(b => b && b.id && (b.nombres || b.firstName || b.apellidos || b.lastName));
        } catch (error) {
            console.error("Error descargando bautismos de Supabase:", error);
            return getBaptisms(parishId);
        }
    };

    const getBaptisms = (parishId) => {
        if (!parishId) return [];
        try {
            const raw = localStorage.getItem(`baptisms_${parishId}`);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(b => b && b.id && (b.nombres || b.firstName || b.apellidos || b.lastName));
        } catch (error) {
            return [];
        }
    };

    const getConfirmedBaptisms = (parishId) => {
        const all = getBaptisms(parishId);
        return all.filter(b => b.status === 'confirmed' || b.status === 'seated');
    };

    const deleteBaptismFromSource = async () => ({ success: true });

    const validateBaptismNumbers = async (libro, folio, numero, parishId) => {
        const list = getBaptisms(parishId);
        const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
        if (exists) return { valid: false, message: "Ya existe un registro con esta numeración." };
        return { valid: true };
    };
  
  const getPendingBaptisms = (parishId) => {
      if (!parishId) return [];
      try {
          const raw = localStorage.getItem(`pendingBaptisms_${parishId}`);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return [];
          return parsed.filter(b => b && b.id && (b.nombres || b.firstName || b.apellidos || b.lastName));
      } catch (error) {
          console.error(`[AppDataContext] Error loading pending baptisms for parish ${parishId}:`, error);
          return [];
      }
  };
  
  const calculateNextConsecutive = (currentNumero, currentFolio, currentLibro, maxPartidasPorFolio, reiniciarEnFolioNuevo) => {
      let nextNumero = parseInt(currentNumero || 1, 10) + 1;
      let nextFolio = parseInt(currentFolio || 1, 10);
      let nextLibro = parseInt(currentLibro || 1, 10);
      const partidasPorFolio = parseInt(maxPartidasPorFolio || 1, 10);
      const expectedFolio = Math.ceil((parseInt(currentNumero || 1, 10) + 1) / partidasPorFolio);

      if (expectedFolio > nextFolio) {
          nextFolio = expectedFolio;
          if (reiniciarEnFolioNuevo) {
              nextNumero = 1;
          }
      }

      return {
          numero: String(nextNumero).padStart(4, '0'),
          folio: String(nextFolio).padStart(4, '0'),
          libro: String(nextLibro).padStart(4, '0')
      };
  };

    const seatBaptism = async (originalId, parishId, updates = {}) => {
      try {
          const pending = await getPendingBaptisms(parishId);
          const record = pending.find(r => r.id === originalId);
          
          if (!record) {
              return { success: false, message: "Registro no encontrado en pendientes." };
          }
          
          const params = JSON.parse(localStorage.getItem(`baptismParameters_${parishId}`) || '{}');
          const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
          const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
          const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

          const fechaReal = updates.fechaSacramento || updates.sacramentDate || updates.fechaBautismo || 
                            record.fechaSacramento || record.sacramentDate || record.fechaBautismo || 
                            record.fecbau || record.sacrament_date || '';

          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let safeId = record.id;
          if (!uuidRegex.test(safeId)) {
              safeId = generateUUID();
          }

          const finalRecord = { 
              ...record, 
              ...updates, 
              id: safeId, 
              status: 'seated', 
              estado: 'Activo',
              book_number: libroAsignado, 
              page_number: folioAsignado, 
              entry_number: numeroAsignado,
              libro: libroAsignado,
              folio: folioAsignado,
              numero: numeroAsignado,
              numeroActa: numeroAsignado,
              fechaSacramento: fechaReal,
              sacramentDate: fechaReal,
              fechaBautismo: fechaReal,
              fecbau: fechaReal
          };
          
          const cleanDate = (d) => (d && typeof d === 'string' && d.trim() !== '') ? d : null;

          const dbRecord = {
              id: safeId,
              parish_id: parishId,
              book_number: libroAsignado,
              page_number: folioAsignado,
              entry_number: numeroAsignado,
              first_name: String(finalRecord.firstName || finalRecord.nombres || ''),
              last_name: String(finalRecord.lastName || finalRecord.apellidos || ''),
              gender: String(finalRecord.sex || finalRecord.sexo || ''),
              birth_date: cleanDate(finalRecord.birthDate || finalRecord.fechaNacimiento),
              sacrament_date: cleanDate(fechaReal),
              minister: String(finalRecord.minister || finalRecord.ministro || ''),
              father_name: String(finalRecord.fatherName || finalRecord.nombrePadre || ''),
              mother_name: String(finalRecord.motherName || finalRecord.motherName || ''),
              status: 'seated',
              margin_note: String(finalRecord.marginNote || finalRecord.notaMarginal || finalRecord.notaAlMargen || ''),
              raw_data: finalRecord 
          };

          const { error } = await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
          if (error) throw error;

          const newPending = pending.filter(r => r.id !== originalId);
          localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(newPending));
          
          const list = getBaptisms(parishId).filter(b => b.id !== finalRecord.id);
          const newList = [...list, finalRecord];
          localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(newList));
          localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(newList));

          const nextConsecutivos = calculateNextConsecutive(
              params.ordinarioNumero || 1, 
              params.ordinarioFolio || 1, 
              params.ordinarioLibro || 1, 
              params.ordinarioPartidas || 2, 
              params.ordinarioRestartNumber
          );

          localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify({ 
              ...params, 
              ordinarioNumero: nextConsecutivos.numero,
              ordinarioFolio: nextConsecutivos.folio,
              ordinarioLibro: nextConsecutivos.libro
          }));
          
          window.dispatchEvent(new Event('storage'));
          return { success: true, message: "Registro asentado y guardado en la Nube correctamente." };
      } catch (err) {
          console.error("❌ seatBaptism error:", err);
          return { success: false, message: "Error interno: " + err.message };
      }
  };

  const seatMultipleBaptisms = async (ids, parishId) => {
      try {
          const pending = await getPendingBaptisms(parishId);
          const recordsToSeat = pending.filter(r => ids.includes(r.id));
          if (recordsToSeat.length === 0) return { success: false, message: "No hay registros seleccionados para asentar." };

          let params = JSON.parse(localStorage.getItem(`baptismParameters_${parishId}`) || '{}');
          let currentLibro = parseInt(params.ordinarioLibro || 1);
          let currentFolio = parseInt(params.ordinarioFolio || 1);
          let currentNumero = parseInt(params.ordinarioNumero || 1);
          const maxPartidas = parseInt(params.ordinarioPartidas || 2);

          const dbRecords = [];
          recordsToSeat.forEach(record => {
              const sLibro = String(currentLibro).padStart(4, '0');
              const sFolio = String(currentFolio).padStart(4, '0');
              const sNumero = String(currentNumero).padStart(4, '0');

              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              let safeId = record.id;
              if (!uuidRegex.test(safeId)) safeId = generateUUID();

              const finalRecord = {
                  ...record,
                  id: safeId,
                  status: 'seated',
                  estado: 'Activo',
                  book_number: sLibro, page_number: sFolio, entry_number: sNumero,
                  libro: sLibro, folio: sFolio, numero: sNumero, numeroActa: sNumero,
              };

              const cleanDate = (d) => (d && typeof d === 'string' && d.trim() !== '') ? d : null;
              dbRecords.push({
                  id: safeId,
                  parish_id: parishId,
                  book_number: sLibro, page_number: sFolio, entry_number: sNumero,
                  first_name: String(finalRecord.firstName || finalRecord.nombres || ''),
                  last_name: String(finalRecord.lastName || finalRecord.apellidos || ''),
                  gender: String(finalRecord.sex || finalRecord.sexo || ''),
                  birth_date: cleanDate(finalRecord.birthDate || finalRecord.fechaNacimiento),
                  sacrament_date: cleanDate(finalRecord.sacramentDate || finalRecord.fechaSacramento || finalRecord.fechaBautismo || finalRecord.fecbau),
                  minister: String(finalRecord.minister || finalRecord.ministro || ''),
                  father_name: String(finalRecord.fatherName || finalRecord.nombrePadre || ''),
                  mother_name: String(finalRecord.motherName || finalRecord.nombreMadre || ''),
                  status: 'seated',
                  raw_data: finalRecord
              });

              if (currentNumero % maxPartidas === 0) currentFolio++;
              currentNumero++;
          });

          const { error } = await supabase.from('baptisms').upsert(dbRecords, { onConflict: 'id' });
          if (error) throw error;

          params.ordinarioLibro = currentLibro;
          params.ordinarioFolio = currentFolio;
          params.ordinarioNumero = currentNumero;
          localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(params));

          const newPending = pending.filter(r => !ids.includes(r.id));
          localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(newPending));

          window.dispatchEvent(new Event('storage'));
          return { success: true, message: `¡Se asentaron ${dbRecords.length} registros en la Nube correctamente!` };
      } catch (error) {
          console.error("❌ seatMultipleBaptisms error:", error);
          return { success: false, message: "Error conectando a la Nube: " + error.message };
      }
  };

  const getConfirmations = (parishId) => JSON.parse(localStorage.getItem(`confirmations_${parishId}`) || '[]');
  const getPendingConfirmations = (parishId) => JSON.parse(localStorage.getItem(`pendingConfirmations_${parishId}`) || '[]');
  
  const saveConfirmationToSource = async (data, parishId, mode) => {
      const storageKey = mode === 'celebrated' ? `confirmations_${parishId}` : `pendingConfirmations_${parishId}`;
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const newItem = { ...data, id: data.id || generateUUID(), status: mode === 'celebrated' ? 'confirmed' : 'pending', createdAt: new Date().toISOString() };
      
      localStorage.setItem(storageKey, JSON.stringify([...list.filter(c => c.id !== newItem.id), newItem]));
      
      // Subir a Supabase si el sacramento ya está celebrado
      if (mode === 'celebrated') {
          try {
              const dbRecord = {
                  id: newItem.id, parish_id: parishId,
                  first_name: String(newItem.nombres || newItem.firstName || ''),
                  last_name: String(newItem.apellidos || newItem.lastName || ''),
                  sacrament_date: newItem.fechaSacramento || newItem.sacramentDate || null,
                  status: newItem.status,
                  raw_data: newItem
              };
              await supabase.from('confirmations').upsert(dbRecord, { onConflict: 'id' });
          } catch (e) { console.warn("Modo offline confirmación:", e); }
      }
      
      window.dispatchEvent(new Event('storage'));
      return { success: true, id: newItem.id };
  };

  const seatConfirmation = async (id, parishId) => {
      const pending = await getPendingConfirmations(parishId);
      const record = pending.find(r => r.id === id);
      if (!record) return { success: false, message: "Registro no encontrado" };
      
      const params = getConfirmationParameters(parishId);
      const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
      const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
      const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

      const finalRecord = { 
          ...record, 
          status: 'celebrated', 
          book_number: libroAsignado, 
          page_number: folioAsignado, 
          entry_number: numeroAsignado 
      };
      
      const list = getConfirmations(parishId);
      localStorage.setItem(`confirmations_${parishId}`, JSON.stringify([...list, finalRecord]));
      const newPending = pending.filter(r => r.id !== id);
      localStorage.setItem(`pendingConfirmations_${parishId}`, JSON.stringify(newPending));
      
      const nextConsecutivos = calculateNextConsecutive(
          params.ordinarioNumero || 1, 
          params.ordinarioFolio || 1, 
          params.ordinarioLibro || 1, 
          params.ordinarioPartidas || 2, 
          params.ordinarioRestartNumber
      );

      updateConfirmationParameters(parishId, { 
          ...params, 
          ordinarioNumero: nextConsecutivos.numero,
          ordinarioFolio: nextConsecutivos.folio,
          ordinarioLibro: nextConsecutivos.libro
      });
      return { success: true, message: "Asentado exitosamente" };
  };

  const seatMultipleConfirmations = async (ids, parishId) => {
      let count = 0;
      for (const id of ids) {
          const res = await seatConfirmation(id, parishId);
          if (res.success) count++;
      }
      return { success: true, message: `${count} registros asentados.` };
  };

  const validateConfirmationNumbers = async (libro, folio, numero, parishId) => {
      const list = getConfirmations(parishId);
      const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
      if (exists) return { valid: false, message: "Numeración duplicada" };
      return { valid: true };
  };

  const getMatrimonios = (parishId) => JSON.parse(localStorage.getItem(`matrimonios_${parishId}`) || '[]');
  const getPendingMatrimonios = (parishId) => JSON.parse(localStorage.getItem(`pendingMatrimonios_${parishId}`) || '[]');

  const saveMatrimonioToSource = async (data, parishId, mode) => {
      const storageKey = mode === 'celebrated' ? `matrimonios_${parishId}` : `pendingMatrimonios_${parishId}`;
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const newItem = { ...data, id: data.id || generateUUID(), status: mode === 'celebrated' ? 'celebrated' : 'pending', createdAt: new Date().toISOString() };
      
      localStorage.setItem(storageKey, JSON.stringify([...list.filter(m => m.id !== newItem.id), newItem]));

      // Subir a Supabase si el matrimonio ya está celebrado
      if (mode === 'celebrated') {
          try {
              const dbRecord = {
                  id: newItem.id, parish_id: parishId,
                  first_name: String(newItem.esposo?.nombres || newItem.esposo_nombres || ''),
                  last_name: String(newItem.esposa?.nombres || newItem.esposa_nombres || ''),
                  sacrament_date: newItem.fechaSacramento || newItem.sacramentDate || null,
                  status: newItem.status,
                  raw_data: newItem
              };
              await supabase.from('marriages').upsert(dbRecord, { onConflict: 'id' });
          } catch (e) { console.warn("Modo offline matrimonio:", e); }
      }
      
      window.dispatchEvent(new Event('storage'));
      return { success: true, id: newItem.id };
  };

  const seatMatrimonio = async (id, parishId) => {
      const pending = await getPendingMatrimonios(parishId);
      const record = pending.find(r => r.id === id);
      if (!record) return { success: false, message: "Registro no encontrado" };
      
      const params = getMatrimonioParameters(parishId);
      const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
      const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
      const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

      const finalRecord = { 
          ...record, 
          status: 'celebrated', 
          book_number: libroAsignado, 
          page_number: folioAsignado, 
          entry_number: numeroAsignado 
      };
      
      const list = getMatrimonios(parishId);
      localStorage.setItem(`matrimonios_${parishId}`, JSON.stringify([...list, finalRecord]));
      const newPending = pending.filter(r => r.id !== id);
      localStorage.setItem(`pendingMatrimonios_${parishId}`, JSON.stringify(newPending));
      
      const nextConsecutivos = calculateNextConsecutive(
          params.ordinarioNumero || 1, 
          params.ordinarioFolio || 1, 
          params.ordinarioLibro || 1, 
          params.ordinarioPartidas || 1, 
          params.ordinarioRestartNumber
      );

      updateMatrimonioParameters(parishId, { 
          ...params, 
          ordinarioNumero: nextConsecutivos.numero,
          ordinarioFolio: nextConsecutivos.folio,
          ordinarioLibro: nextConsecutivos.libro
      });
      return { success: true, message: "Asentado exitosamente" };
  };

  const seatMultipleMatrimonios = async (ids, parishId) => {
      let count = 0;
      for (const id of ids) {
          const res = await seatMatrimonio(id, parishId);
          if (res.success) count++;
      }
      return { success: true, message: `${count} registros asentados.` };
  };

  const validateMatrimonioNumbers = async (libro, folio, numero, parishId) => {
      const list = getMatrimonios(parishId);
      const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
      if (exists) return { valid: false, message: "Numeración duplicada" };
      return { valid: true };
  };

  const searchBaptismGlobal = (book, page, entry, dioceseId) => {
      if (!dioceseId) return null;
      const parishes = data.parishes.filter(p => p.dioceseId === dioceseId);
      let foundRecord = null;
      let targetParishId = null;
      for (const parish of parishes) {
          const records = getBaptisms(parish.id) || [];
          const match = records.find(b => 
              String(b.book_number || b.libro) === String(book) &&
              String(b.page_number || b.folio) === String(page) &&
              String(b.entry_number || b.numero) === String(entry)
          );
          if (match) {
              foundRecord = match;
              targetParishId = parish.id;
              break;
          }
      }
      return foundRecord ? { record: foundRecord, parishId: targetParishId } : null;
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