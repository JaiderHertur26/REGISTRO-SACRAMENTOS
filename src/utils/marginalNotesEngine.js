import { convertDateToSpanishText } from './dateTimeFormatters';

// 🧠 1. LECTOR DE PLANTILLAS DINÁMICAS (Lee del Panel de Control o usa default)
const getTemplates = (parishId) => {
    const defaultTemplates = {
        correccion_anulada: "PARTIDA ANULADA POR DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO]. LA INFORMACIÓN CORREGIDA PASA AL LIBRO SUPLETORIO: L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].",
        correccion_nueva: "ESTA PARTIDA SE INSCRIBE POR DECRETO DE CORRECCIÓN NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], Y ANULA LA PARTIDA ORIGINAL DEL L-[LIBRO_ANULADA] F-[FOLIO_ANULADA] N-[NUMERO_ANULADA]. DA FE: [MINISTRO].",
        reposicion_nueva: "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], DEBIDO A PÉRDIDA O DETERIORO DEL ORIGINAL. DA FE: [MINISTRO].",
        matrimonio_casado: "EL DÍA [FECHA_NOTIFICACION] SE RECIBIÓ AVISO DE LA PARROQUIA [PARROQUIA_MATRIMONIO] DE LA DIÓCESIS DE [DIOCESIS_MATRIMONIO], NOTIFICANDO QUE CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL [FECHA_MATRIMONIO]. INSCRITO EN EL L-[LIBRO_MAT], F-[FOLIO_MAT], N-[NUMERO_MAT].",
        matrimonio_nulidad: "MATRIMONIO DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO].",
        vinculo_civil: "REGISTRO CIVIL: NUIP/NIP [NUIP]. EXPEDIDO EN LA OFICINA [OFICINA_REGISTRO] EL DÍA [FECHA_EXPEDICION_RC]."
    };

    if (!parishId) return defaultTemplates;
    const stored = localStorage.getItem(`marginalNotesTemplates_${parishId}`);
    return stored ? { ...defaultTemplates, ...JSON.parse(stored) } : defaultTemplates;
};

// 🧹 LIMPIEZA DE FECHAS (Convierte a letras mayúsculas sin "EL ")
const cleanDateText = (dateString) => {
    if (!dateString || dateString === '---') return '___';
    try {
        return convertDateToSpanishText(dateString).replace(/^EL\s+/i, '').toUpperCase();
    } catch {
        return String(dateString).toUpperCase();
    }
};

// ⚙️ 2. EL MOTOR PRINCIPAL EXPORTADO
export const marginalNotesEngine = {
    
    // ---------------------------------------------------------
    // A. DECRETOS DE CORRECCIÓN
    // ---------------------------------------------------------
    forAnnulledCorrection: (parishId, data) => {
        let template = getTemplates(parishId).correccion_anulada;
        return template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[LIBRO_NUEVA\]/g, String(data.libroNuevo || '___').padStart(4, '0'))
            .replace(/\[FOLIO_NUEVA\]/g, String(data.folioNuevo || '___').padStart(4, '0'))
            .replace(/\[NUMERO_NUEVA\]/g, String(data.numeroNuevo || '___').padStart(4, '0'))
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(new Date().toISOString()));
    },

    forNewCorrection: (parishId, data) => {
        let template = getTemplates(parishId).correccion_nueva;
        return template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[LIBRO_ANULADA\]/g, String(data.libroAnulada || '___').padStart(4, '0'))
            .replace(/\[FOLIO_ANULADA\]/g, String(data.folioAnulada || '___').padStart(4, '0'))
            .replace(/\[NUMERO_ANULADA\]/g, String(data.numeroAnulada || '___').padStart(4, '0'))
            .replace(/\[MINISTRO\]/g, (data.ministro || '___').toUpperCase())
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(new Date().toISOString()));
    },

    // ---------------------------------------------------------
    // B. DECRETOS DE REPOSICIÓN
    // ---------------------------------------------------------
    forReposition: (parishId, data) => {
        let template = getTemplates(parishId).reposicion_nueva;
        return template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[MINISTRO\]/g, (data.ministro || '___').toUpperCase())
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(new Date().toISOString()));
    },

    // ---------------------------------------------------------
    // C. NOTIFICACIONES MATRIMONIALES (Heredado de tu archivo viejo)
    // ---------------------------------------------------------
    forMarriageNotification: (parishId, data) => {
        let template = getTemplates(parishId).matrimonio_casado;
        return template
            .replace(/\[FECHA_NOTIFICACION\]/g, cleanDateText(data.fechaNotificacion || new Date().toISOString()))
            .replace(/\[PARROQUIA_MATRIMONIO\]/g, (data.parroquiaMatrimonio || '___').toUpperCase())
            .replace(/\[DIOCESIS_MATRIMONIO\]/g, (data.diocesisMatrimonio || '___').toUpperCase())
            .replace(/\[NOMBRE_CONYUGE\]/g, (data.nombreConyuge || '___').toUpperCase())
            .replace(/\[FECHA_MATRIMONIO\]/g, cleanDateText(data.fechaMatrimonio))
            .replace(/\[LIBRO_MAT\]/g, String(data.libroMatrimonio || '___').padStart(4, '0'))
            .replace(/\[FOLIO_MAT\]/g, String(data.folioMatrimonio || '___').padStart(4, '0'))
            .replace(/\[NUMERO_MAT\]/g, String(data.numeroMatrimonio || '___').padStart(4, '0'))
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(new Date().toISOString()));
    },

    forMarriageAnnulment: (parishId, data) => {
        let template = getTemplates(parishId).matrimonio_nulidad;
        return " " + template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(new Date().toISOString()));
    },

    // ---------------------------------------------------------
    // D. DATOS CIVILES COMPLEMENTARIOS
    // ---------------------------------------------------------
    appendCivilRegistry: (parishId, data) => {
        if (!data.nuip && !data.oficinaRegistro) return ''; 
        let template = getTemplates(parishId).vinculo_civil;
        return " " + template
            .replace(/\[NUIP\]/g, data.nuip || '---')
            .replace(/\[OFICINA_REGISTRO\]/g, (data.oficinaRegistro || '---').toUpperCase())
            .replace(/\[FECHA_EXPEDICION_RC\]/g, cleanDateText(data.fechaExpedicionRc));
    }
};