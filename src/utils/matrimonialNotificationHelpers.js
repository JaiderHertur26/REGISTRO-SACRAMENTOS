import { 
    saveDocumento, 
    getAllDocumentos, 
    saveAviso 
} from './matrimonialNotificationStorage';
import { 
    validatePartidaSelected, 
    validateMarriageFields, 
    validateNoDuplicates, 
    validateConsecutivoUniqueness,
    validarPersonaNoTieneConyuge
} from './matrimonialNotificationValidation';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

// --- Verification & Validation Helpers ---

export const validatePartidaNotaIntegrity = (partida) => {
    if (!partida) return false;
    const isAffected = !!partida.notificacionMatrimonialId;
    if (isAffected) {
        return !!(partida.notaAlMargen || partida.notaMarginal);
    }
    return true;
};

export const verifyDesafectacionSuccess = (partidaId, parishId) => {
    try {
        const key = `baptisms_${parishId}`;
        const baptisms = JSON.parse(localStorage.getItem(key) || '[]');
        const verifiedPartida = baptisms.find(b => String(b.id) === String(partidaId));
        if (!verifiedPartida) return false;
        
        return (
            verifiedPartida.notificacionMatrimonialId === null || 
            verifiedPartida.notificacionMatrimonialId === undefined
        );
    } catch (e) {
        console.error("Error verifying desafectación:", e);
        return false;
    }
};

export const verifyAfectacionSuccess = (partidaId, parishId) => {
    try {
        const key = `baptisms_${parishId}`;
        const baptisms = JSON.parse(localStorage.getItem(key) || '[]');
        const verifiedPartida = baptisms.find(b => String(b.id) === String(partidaId));
        if (!verifiedPartida) return false;
        
        return !!verifiedPartida.notificacionMatrimonialId;
    } catch (e) {
        console.error("Error verifying afectación:", e);
        return false;
    }
};

// --- Main Helpers ---

export const generarConsecutivoNotificacionMatrimonial = (parishId) => {
    const docsRes = getAllDocumentos(parishId);
    let count = 1;
    const year = new Date().getFullYear();
    
    if (docsRes.success && docsRes.data.length > 0) {
        const yearDocs = docsRes.data.filter(d => d.consecutivo?.includes(`NM-${year}-`));
        if (yearDocs.length > 0) {
            const numbers = yearDocs.map(d => parseInt(d.consecutivo.split('-')[2] || 0));
            count = Math.max(...numbers) + 1;
        }
    }
    
    const consecutivo = `NM-${year}-${String(count).padStart(4, '0')}`;
    const uniqueCheck = validateConsecutivoUniqueness(consecutivo);
    
    if (!uniqueCheck.valid) {
        return { success: false, message: uniqueCheck.message, data: null };
    }
    
    return { success: true, message: 'Consecutivo generado.', data: consecutivo };
};

export const validarNotificacionMatrimonial = (datos) => {
    const partidaCheck = validatePartidaSelected(datos.partida);
    if (!partidaCheck.valid) return { success: false, message: partidaCheck.message, errors: {} };

    const formCheck = validateMarriageFields(datos.formData);
    if (!formCheck.valid) return { success: false, message: formCheck.message, errors: formCheck.fieldErrors };

    return { success: true, message: 'Validación exitosa.', errors: {} };
};

export const buscarDuplicados = (baptismPartidaId, spouseName, marriageDate, marriageBook, marriageFolio, marriageNumber) => {
    const duplicateCheck = validateNoDuplicates(baptismPartidaId, spouseName, marriageDate, marriageBook, marriageFolio, marriageNumber);
    if (!duplicateCheck.valid) {
        return { success: false, message: duplicateCheck.message, data: null };
    }
    return { success: true, message: 'Sin duplicados.', data: null };
};

// ==========================================
// EL MOTOR QUE ARMA LA NOTA MARGINAL CON PLANTILLA
// ==========================================
export const agregarNotaAlMargen = (partida, notificacionData, documentoId, notaPlantilla) => {
    if (!partida || !partida.id || !partida.parishId) {
        return { success: false, message: 'Falta información de la partida para agregar la nota.', data: null };
    }

    try {
        const key = `baptisms_${partida.parishId}`;
        const storedBaptisms = JSON.parse(localStorage.getItem(key) || '[]');
        const index = storedBaptisms.findIndex(b => String(b.id) === String(partida.id));

        if (index === -1) {
             return { success: false, message: 'Partida no encontrada en almacenamiento.', data: null };
        }

        const currentPartida = storedBaptisms[index];
        const currentNota = currentPartida.notaAlMargen || currentPartida.notaMarginal || null;
        
        let originalNota = currentPartida.notaAlMargenOriginal;
        if (originalNota === undefined) {
            originalNota = currentNota;
        }

        // 1. Tomamos la plantilla inyectada, o un fallback si no llegó
        let notaFormateada = notaPlantilla || "CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL DIA [FECHA_MATRIMONIO] EN LA PARROQUIA [PARROQUIA_MATRIMONIO] DE LA DIOCESIS DE [DIOCESIS_MATRIMONIO]. L:[LIBRO_MATRIMONIO] F:[FOLIO_MATRIMONIO] N:[NUMERO_MATRIMONIO].";

        // 2. Reemplazar dinámicamente usando nuestro diccionario de etiquetas
        const safeText = (val) => val ? String(val).toUpperCase() : '---';
        const safeDateText = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            return convertDateToSpanishText(dateStr).replace(/^EL\s+/i, '').toUpperCase();
        };

        notaFormateada = notaFormateada
            .replace(/\[NOMBRE_CONYUGE\]/g, safeText(notificacionData.nombreConyuge))
            .replace(/\[FECHA_MATRIMONIO\]/g, safeDateText(notificacionData.fechaMatrimonio))
            .replace(/\[PARROQUIA_MATRIMONIO\]/g, safeText(notificacionData.parroquiaMatrimonio))
            .replace(/\[DIOCESIS_MATRIMONIO\]/g, safeText(notificacionData.diocesisMatrimonio))
            .replace(/\[LIBRO_MATRIMONIO\]/g, String(notificacionData.libroMatrimonio || '0').padStart(4, '0'))
            .replace(/\[FOLIO_MATRIMONIO\]/g, String(notificacionData.folioMatrimonio || '0').padStart(4, '0'))
            .replace(/\[NUMERO_MATRIMONIO\]/g, String(notificacionData.numeroMatrimonio || '0').padStart(4, '0'));

        const nuevaNotaCombinada = originalNota 
            ? `${originalNota}\n\n${notaFormateada}`
            : notaFormateada;

        storedBaptisms[index] = {
            ...currentPartida,
            notaAlMargenOriginal: originalNota,
            notaMarginal: nuevaNotaCombinada, // Guarda el resultado final
            notaAlMargen: nuevaNotaCombinada, // Backwards compatibility
            notificacionMatrimonialId: documentoId,
            estadoNotificacion: 'afectada',
            notificacionData: notificacionData // Raw data por si se requiere después
        };

        localStorage.setItem(key, JSON.stringify(storedBaptisms));
        
        return { success: true, message: 'Nota marginal agregada exitosamente.', data: nuevaNotaCombinada };
    } catch (e) {
        console.error("[Afectación] Error:", e);
        return { success: false, message: 'Excepción al agregar nota marginal: ' + e.message, data: null };
    }
};

// Pasamos la notaPlantilla por todo el árbol de funciones
export const afectarPartidaBautismo = (partida, notificacionData, documentoId, notaPlantilla) => {
    console.log(`[Afectar Partida] Intentando afectar partida ID: ${partida?.id} en parroquia: ${partida?.parishId}`);
    const result = agregarNotaAlMargen(partida, notificacionData, documentoId, notaPlantilla);
    if (result.success) {
        console.log(`[Afectar Partida] Éxito al afectar la partida ID: ${partida.id}`);
    } else {
        console.error(`[Afectar Partida] Fallo al afectar la partida ID: ${partida.id}`, result.message);
    }
    return result;
};

export const crearAvisoNotificacion = (documento) => {
    if (!documento || !documento.baptismParishId) {
        return { success: false, message: 'Falta ID de parroquia receptora.', data: null };
    }
    
    if (documento.parishId === documento.baptismParishId) {
         return { success: true, message: 'Parroquia interna, no se requiere aviso.', data: null };
    }

    const aviso = {
        receiverParishId: documento.baptismParishId,
        documentoId: documento.id,
        consecutivo: documento.consecutivo,
        personName: documento.personName,
        marriageDate: documento.marriageDate,
        spouseName: documento.spouseName,
        status: 'pendiente'
    };

    return saveAviso(aviso);
};

export const guardarNotificacionMatrimonial = (datos) => {
    // 0. Recibimos la plantilla de la UI
    const { partida, formData, parishId, createdBy, notaPlantilla } = datos;

    // 1. Validate form and data
    const validation = validarNotificacionMatrimonial({ partida, formData });
    if (!validation.success) return validation;

    const personName = `${partida.nombres || partida.firstName || ''} ${partida.apellidos || partida.lastName || ''}`.trim();

    // 2. Validate Spouse Conflict
    const currentDocsRes = getAllDocumentos(parishId);
    if (currentDocsRes.success) {
        const spouseCheck = validarPersonaNoTieneConyuge(personName, currentDocsRes.data);
        if (!spouseCheck.valido) {
            return { success: false, message: spouseCheck.mensaje, data: null };
        }
    }

    // 3. Duplicates Check
    const dupCheck = buscarDuplicados(
        partida.id, formData.spouseName, formData.marriageDate, 
        formData.marriageBook, formData.marriageFolio, formData.marriageNumber
    );
    if (!dupCheck.success) return dupCheck;

    // 4. Consecutivo
    const consecutivoRes = generarConsecutivoNotificacionMatrimonial(parishId);
    if (!consecutivoRes.success) return consecutivoRes;

    // 5. Create Document
    const documento = {
        parishId,
        receiverParishId: partida.parishId || null,
        consecutivo: consecutivoRes.data,
        baptismPartidaId: partida.id,
        personName,
        personBirthDate: partida.fecnac || partida.birthDate || '',
        baptismBook: partida.book || partida.book_number || '',
        baptismFolio: partida.page || partida.page_number || '',
        baptismNumber: partida.entry || partida.entry_number || '',
        baptismParishId: partida.parishId || null,
        baptismDioceseId: partida.dioceseId || null,
        
        // Spouse partida mappings
        spouseBaptismPartidaId: formData.spousePartida?.partidaBautismoId || null,
        spouseBaptismParishId: formData.spousePartida?.parishId || null,

        spouseName: formData.spouseName,
        marriageDate: formData.marriageDate,
        marriageBook: formData.marriageBook,
        marriageFolio: formData.marriageFolio,
        marriageNumber: formData.marriageNumber,
        marriageDiocese: formData.marriageDiocese,
        marriageParish: formData.marriageParish,
        createdBy,
        status: 'generado',
        marginNoteApplied: false,
        marginNoteText: ''
    };

    // Prepare robust notification data for the marginal note generator
    const currentDate = new Date().toISOString().split('T')[0];
    const baseNotificacionData = {
        fechaNotificacion: currentDate,
        parroquiaMatrimonio: formData.marriageParishName || formData.marriageParish, 
        diocesisMatrimonio: formData.marriageDioceseName || formData.marriageDiocese,
        libroMatrimonio: formData.marriageBook,
        folioMatrimonio: formData.marriageFolio,
        numeroMatrimonio: formData.marriageNumber,
        fechaMatrimonio: formData.marriageDate,
        fechaExpedicion: currentDate
    };

    // 6. Save Document FIRST to get an ID
    const saveRes = saveDocumento(documento);
    if (!saveRes.success) return saveRes;

    const savedDocId = saveRes.data.id;

    // 7. Apply Margin Note directly for the MAIN PERSONA if local
    if (partida.parishId === parishId) {
        const notificacionDataPrincipal = {
            ...baseNotificacionData,
            nombreConyuge: formData.spouseName // The spouse name
        };
        
        // Enviamos la plantilla hasta el inyector final
        const noteRes = afectarPartidaBautismo(partida, notificacionDataPrincipal, savedDocId, notaPlantilla);
        if (noteRes.success) {
            saveRes.data.marginNoteApplied = true;
            saveRes.data.marginNoteText = noteRes.data;
        }
    }

    // 8. Apply Margin Note to the SPOUSE (cónyuge) if local
    if (formData.spousePartida && formData.spousePartida.partidaBautismoId) {
        const spouseParishId = formData.spousePartida.parishId || parishId;
        if (spouseParishId === parishId) {
             console.log("[Afectar Partida] Afectando partida local del cónyuge.");
             
             const notificacionDataConyuge = {
                 ...baseNotificacionData,
                 nombreConyuge: personName // The main person becomes the spouse here
             };

             afectarPartidaBautismo(
                 { id: formData.spousePartida.partidaBautismoId, parishId: spouseParishId }, 
                 notificacionDataConyuge, 
                 savedDocId,
                 notaPlantilla // Enviamos la misma plantilla para el cónyuge
             );
        } else {
             console.log("[Afectar Partida] La partida del cónyuge pertenece a otra parroquia.");
        }
    }

    // 9. Create notification for the other parish if applicable (main persona)
    crearAvisoNotificacion(saveRes.data);
    
    // Verify afectacion
    if (partida.parishId === parishId) {
        const isVerified = verifyAfectacionSuccess(partida.id, parishId);
        if (!isVerified) {
            console.warn(`[Afectación] Advertencia: La verificación de afectación falló para la partida ${partida.id}.`);
        }
    }

    return { success: true, message: 'Notificación matrimonial creada exitosamente.', data: saveRes.data };
};

export const desafectarPartidaBautismo = async (partidaId, parishId) => {
    try {
        if (!partidaId || !parishId) {
            console.warn("[Desafectación] Faltan parámetros requeridos (partidaId o parishId) para la desafectación.");
            return { success: false, message: "Faltan parámetros requeridos para desafectar la partida." };
        }

        console.log(`[Desafectación] Intentando desafectar partida ID: ${partidaId} en parroquia ${parishId}`);
        const key = `baptisms_${parishId}`;
        const baptisms = JSON.parse(localStorage.getItem(key) || '[]');
        const index = baptisms.findIndex(b => String(b.id) === String(partidaId));

        if (index === -1) {
            console.warn(`[Desafectación] Partida con ID ${partidaId} no encontrada en la parroquia ${parishId}.`);
            return { success: true, message: "Partida no encontrada localmente, omitiendo desafectación." };
        }

        const partida = baptisms[index];
        const restoredNote = partida.notaAlMargenOriginal !== undefined ? partida.notaAlMargenOriginal : null;
        
        baptisms[index] = {
            ...partida,
            notificacionMatrimonialId: null,
            notificacionMatrimonial: null,
            estadoNotificacion: null,
            notaAlMargen: restoredNote,
            notaMarginal: restoredNote,
            notaAlMargenOriginal: null,
            notificacionData: null,
            marginNoteText: null
        };

        localStorage.setItem(key, JSON.stringify(baptisms));

        const isVerified = verifyDesafectacionSuccess(partidaId, parishId);
        
        if (isVerified) {
            console.log(`[Desafectación] Partida ${partidaId} desafectada exitosamente. Nota original restaurada:`, restoredNote ? 'Sí' : 'No');
            return { success: true };
        } else {
            console.error(`[Desafectación] La verificación falló para la partida ${partidaId}.`);
            throw new Error("La verificación de actualización falló: la partida sigue afectada.");
        }

    } catch (error) {
        console.error("[Desafectación] Error al desafectar partida:", error);
        throw error;
    }
};