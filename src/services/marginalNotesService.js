import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

export const DEFAULT_NOTAS_MARGINALES = {
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

export const obtenerNotasAlMargen = (parishId) => {
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

export const saveNotasAlMargen = (notes, parishId) => {
    if (!parishId) return;
    localStorage.setItem(`notasAlMargen_${parishId}`, JSON.stringify(notes));
};

export const generarNotaAlMargenAnulada = (partidaNueva, decreto, parishId) => {
    const notes = obtenerNotasAlMargen(parishId);
    let template = notes?.porCorreccion?.anulada || DEFAULT_NOTAS_MARGINALES.porCorreccion.anulada;

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

export const generarNotaAlMargenNuevaPartida = (partidaAnulada, decreto, sacerdote, parishId) => {
    const notes = obtenerNotasAlMargen(parishId);
    let template = notes?.porCorreccion?.nuevaPartida || DEFAULT_NOTAS_MARGINALES.porCorreccion.nuevaPartida;

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

export const generarNotaAlMargenEstandar = (parishId) => {
    const notes = obtenerNotasAlMargen(parishId);
    return notes?.estandar || DEFAULT_NOTAS_MARGINALES.estandar;
};

export const actualizarNotaAlMargenCorreccion = (anulada, nuevaPartida, parishId) => {
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

export const actualizarNotaAlMargenReposicion = (nuevaPartida, parishId) => {
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

export const actualizarNotaAlMargenEstandar = (texto, parishId) => {
    const current = obtenerNotasAlMargen(parishId);
    const updated = { ...current, estandar: texto || "" };
    saveNotasAlMargen(updated, parishId);
    return { success: true, message: "Nota estándar actualizada." };
};