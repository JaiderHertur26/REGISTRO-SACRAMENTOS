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
    const stored = localStorage.getItem(`notasAlMargen_${parishId}`);
    if (stored) {
        try {
            const storedData = JSON.parse(stored);
            const defaultData = DEFAULT_NOTAS_MARGINALES;
            return {
                ...defaultData, ...storedData,
                porCorreccion: { ...defaultData.porCorreccion, ...(storedData.porCorreccion || {}) },
                porReposicion: { 
                    ...defaultData.porReposicion, ...(storedData.porReposicion || {}),
                    nuevaPartidaCreada: { 
                        ...defaultData.porReposicion.nuevaPartidaCreada, 
                        ...(storedData.porReposicion?.nuevaPartidaCreada || {}) 
                    }
                },
                porNotificacionMatrimonial: { ...defaultData.porNotificacionMatrimonial, ...(storedData.porNotificacionMatrimonial || {}) }
            };
        } catch (e) {
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
    return notes?.estandar || "";
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

// --- BAPTISM PARAMETERS ---
export const getDefaultBaptismParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 2, ordinarioLibro: 1, ordinarioFolio: 436, ordinarioNumero: 871,
    suplementarioBlocked: false, suplementarioReiniciar: false, suplementarioPartidas: 2,
    suplementarioLibro: 3, suplementarioFolio: 2, suplementarioNumero: 3,
    registroAdultoEn: 'ordinario', registroDecretoEn: 'suplementario', generarNotaMarginal: true,
    inscripcionNumero: '36', inscripcionFecha: '2025-10-11T00:00', inscripcionFormato: '1'
});

export const getBaptismParameters = (contextId) => {
    const stored = localStorage.getItem(contextId ? `baptismParameters_${contextId}` : 'baptismParameters');
    return stored ? { ...getDefaultBaptismParameters(), ...JSON.parse(stored) } : getDefaultBaptismParameters();
};

export const saveBaptismParameters = (params, contextId) => {
    try {
        localStorage.setItem(contextId ? `baptismParameters_${contextId}` : 'baptismParameters', JSON.stringify(params));
        return { success: true, message: "Parámetros guardados correctamente." };
    } catch (error) { return { success: false, message: "Error al guardar parámetros." }; }
};

export const getNextBaptismNumbers = (contextId) => {
    const params = getBaptismParameters(contextId);
    return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
};

// --- CONFIRMATION PARAMETERS ---
export const getDefaultConfirmationParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 2, ordinarioLibro: 1, ordinarioFolio: 3, ordinarioNumero: 5,
    suplementarioBlocked: false, suplementarioReiniciar: false, suplementarioPartidas: 2,
    suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1,
    registroInscripcionEn: 'ordinario', inscripcionNumero: '1', inscripcionFecha: '2025-11-01T00:00', inscripcionFormato: '1'
});

export const getConfirmationParameters = (contextId) => {
    if (!contextId) return getDefaultConfirmationParameters();
    const stored = localStorage.getItem(`confirmationParameters_${contextId}`);
    return stored ? { ...getDefaultConfirmationParameters(), ...JSON.parse(stored) } : getDefaultConfirmationParameters();
};

export const updateConfirmationParameters = (contextId, params) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    try {
        const current = getConfirmationParameters(contextId);
        localStorage.setItem(`confirmationParameters_${contextId}`, JSON.stringify({ ...current, ...params }));
        return { success: true, message: "Parámetros de confirmación actualizados." };
    } catch (error) { return { success: false, message: "Error al guardar parámetros." }; }
};

export const resetConfirmationParameters = (contextId) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    try {
        const defaults = getDefaultConfirmationParameters();
        localStorage.setItem(`confirmationParameters_${contextId}`, JSON.stringify(defaults));
        return { success: true, message: "Parámetros restablecidos a valores por defecto.", data: defaults };
    } catch (error) { return { success: false, message: "Error al restablecer parámetros." }; }
};

export const getNextConfirmationNumbers = (contextId) => {
    const params = getConfirmationParameters(contextId);
    return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
};

// --- MARRIAGE PARAMETERS ---
export const getDefaultMatrimonioParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 1, ordinarioLibro: 1, ordinarioFolio: 1, ordinarioNumero: 1,
});

export const getMatrimonioParameters = (contextId) => {
    if (!contextId) return getDefaultMatrimonioParameters();
    const stored = localStorage.getItem(`matrimonioParameters_${contextId}`);
    return stored ? { ...getDefaultMatrimonioParameters(), ...JSON.parse(stored) } : getDefaultMatrimonioParameters();
};

export const updateMatrimonioParameters = (contextId, params) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    try {
        const newParams = { ...getMatrimonioParameters(contextId), ...params };
        localStorage.setItem(`matrimonioParameters_${contextId}`, JSON.stringify(newParams));
        return { success: true, message: "Parámetros de matrimonio actualizados." };
    } catch (error) { return { success: false, message: "Error al guardar parámetros." }; }
};

export const resetMatrimonioParameters = (contextId) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    try {
        const defaults = getDefaultMatrimonioParameters();
        localStorage.setItem(`matrimonioParameters_${contextId}`, JSON.stringify(defaults));
        return { success: true, message: "Parámetros restablecidos a valores por defecto.", data: defaults };
    } catch (error) { return { success: false, message: "Error al restablecer parámetros." }; }
};

export const getNextMatrimonioNumbers = (contextId) => {
    const params = getMatrimonioParameters(contextId);
    return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
};

// --- GENERAL MATH UTIL ---
export const calculateNextConsecutive = (currentNumero, currentFolio, currentLibro, maxPartidasPorFolio, reiniciarEnFolioNuevo) => {
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