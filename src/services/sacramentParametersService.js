import { incrementPaddedValue } from '@/utils/supabaseHelpers';

// ============================================================================
// 1. PARÁMETROS POR DEFECTO
// ============================================================================
export const getDefaultBaptismParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 2, ordinarioLibro: 1, ordinarioFolio: 436, ordinarioNumero: 871,
    suplementarioBlocked: false, suplementarioReiniciar: false, suplementarioPartidas: 2,
    suplementarioLibro: 3, suplementarioFolio: 2, suplementarioNumero: 3,
    registroAdultoEn: 'ordinario', registroDecretoEn: 'suplementario', generarNotaMarginal: true,
    inscripcionNumero: '36', inscripcionFecha: '2025-10-11T00:00', inscripcionFormato: '1'
});

export const getDefaultConfirmationParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 2, ordinarioLibro: 1, ordinarioFolio: 3, ordinarioNumero: 5,
    suplementarioBlocked: false, suplementarioReiniciar: false, suplementarioPartidas: 2,
    suplementarioLibro: 1, suplementarioFolio: 1, suplementarioNumero: 1,
    registroInscripcionEn: 'ordinario', inscripcionNumero: '1', inscripcionFecha: '2025-11-01T00:00', inscripcionFormato: '1'
});

export const getDefaultMatrimonioParameters = () => ({
    enablePreview: true, reportPrinting: false, ordinarioBlocked: false, ordinarioRestartNumber: false,
    ordinarioPartidas: 1, ordinarioLibro: 1, ordinarioFolio: 1, ordinarioNumero: 1,
});

// ============================================================================
// 2. MÉTODOS DE BAUTISMO
// ============================================================================
export const getBaptismParameters = (contextId) => {
    if (!contextId) return getDefaultBaptismParameters();
    const stored = localStorage.getItem(`baptismParameters_${contextId}`);
    return stored ? { ...getDefaultBaptismParameters(), ...JSON.parse(stored) } : getDefaultBaptismParameters();
};

export const saveBaptismParameters = (params, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de parroquia" };
    try {
        localStorage.setItem(`baptismParameters_${contextId}`, JSON.stringify(params));
        return { success: true, message: "Parámetros guardados correctamente." };
    } catch (error) { 
        return { success: false, message: "Error al guardar parámetros." }; 
    }
};

export const getNextBaptismNumbers = (parishId) => {
    const params = getBaptismParameters(parishId);
    return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
};

// ============================================================================
// 3. MÉTODOS DE CONFIRMACIÓN
// ============================================================================
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
    } catch (error) { 
        return { success: false, message: "Error al guardar parámetros." }; 
    }
};

export const resetConfirmationParameters = (contextId) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    try {
        const defaults = getDefaultConfirmationParameters();
        localStorage.setItem(`confirmationParameters_${contextId}`, JSON.stringify(defaults));
        return { success: true, message: "Parámetros restablecidos a valores por defecto.", data: defaults };
    } catch (error) { 
        return { success: false, message: "Error al restablecer parámetros." }; 
    }
};

export const getNextConfirmationNumbers = (parishId) => {
    const params = getConfirmationParameters(parishId);
    return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
};

// ============================================================================
// 4. MÉTODOS DE MATRIMONIO
// ============================================================================
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
    } catch (error) { 
        return { success: false, message: "Error al guardar parámetros." }; 
    }
};

export const resetMatrimonioParameters = (contextId) => {
    if (!contextId) return { success: false, message: "ID de contexto no proporcionado" };
    try {
        const defaults = getDefaultMatrimonioParameters();
        localStorage.setItem(`matrimonioParameters_${contextId}`, JSON.stringify(defaults));
        return { success: true, message: "Parámetros restablecidos a valores por defecto.", data: defaults };
    } catch (error) { 
        return { success: false, message: "Error al restablecer parámetros." }; 
    }
};

export const getNextMatrimonioNumbers = (parishId) => {
    const params = getMatrimonioParameters(parishId);
    return { book: params.ordinarioLibro || 1, page: params.ordinarioFolio || 1, entry: params.ordinarioNumero || 1 };
};

// ============================================================================
// 5. CÁLCULO GENERAL DE CONSECUTIVOS (LIBRO / FOLIO / ACTA)
// ============================================================================
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