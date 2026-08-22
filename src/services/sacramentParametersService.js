import { supabase } from '@/lib/supabaseClient';

export const getDefaultBaptismParameters = () => ({
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,
    ordinarioPartidas: 2,
    ordinarioRestartNumber: false,
    suplementarioLibro: 1,
    suplementarioFolio: 1,
    suplementarioNumero: 1,
    suplementarioPartidas: 2,
    suplementarioReiniciar: false,
    numeroRegistroActual: "000001"
});

export const getDefaultConfirmationParameters = () => ({
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,
    ordinarioPartidas: 2,
    ordinarioRestartNumber: false
});

export const getDefaultMatrimonioParameters = () => ({
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,
    ordinarioPartidas: 1,
    ordinarioRestartNumber: false
});

// ============================================================================
// 🕊️ BAUTISMOS
// ============================================================================
export const getBaptismParameters = async (parishId) => {
    if (!parishId) return getDefaultBaptismParameters();
    
    try {
        const { data, error } = await supabase
            .from('parish_parameters')
            .select('bautizos_params')
            .eq('parish_id', parishId)
            .maybeSingle();

        if (!error && data?.bautizos_params) {
            localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(data.bautizos_params));
            return { ...getDefaultBaptismParameters(), ...data.bautizos_params };
        }
    } catch (e) {
        console.warn("Leyendo parámetros locales de bautismo:", e);
    }

    const stored = localStorage.getItem(`baptismParameters_${parishId}`);
    return stored ? { ...getDefaultBaptismParameters(), ...JSON.parse(stored) } : getDefaultBaptismParameters();
};

export const saveBaptismParameters = async (params, parishId) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    try {
        localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(params));
        
        await supabase
            .from('parish_parameters')
            .upsert({
                parish_id: parishId,
                bautizos_params: params,
                updated_at: new Date().toISOString()
            }, { onConflict: 'parish_id' });

        return { success: true, message: "Parámetros actualizados en la nube." };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const getNextBaptismNumbers = async (parishId) => {
    const params = await getBaptismParameters(parishId);
    return { 
        book: String(params.ordinarioLibro || 1).padStart(4, '0'), 
        page: String(params.ordinarioFolio || 1).padStart(4, '0'), 
        entry: String(params.ordinarioNumero || 1).padStart(4, '0') 
    };
};

// ============================================================================
// 🕊️ CONFIRMACIONES
// ============================================================================
export const getDefaultConfirmationParameters = () => ({
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,
    ordinarioPartidas: 2,
    ordinarioRestartNumber: false,
    ordinarioBlocked: false,
    numeroRegistroActual: "000001",
    suplementarioLibro: 1,
    suplementarioFolio: 1,
    suplementarioNumero: 1,
    suplementarioPartidas: 2,
    suplementarioReiniciar: false,
    suplementarioBlocked: false,
    registroRegularEn: 'ordinario',
    registroDecretoEn: 'suplementario',
    generarNotaMarginal: true
});

export const getConfirmationParameters = async (parishId) => {
    if (!parishId) return getDefaultConfirmationParameters();
    
    try {
        const { data, error } = await supabase
            .from('parish_parameters')
            .select('confirmaciones_params')
            .eq('parish_id', parishId)
            .maybeSingle();

        if (!error && data?.confirmaciones_params) {
            localStorage.setItem(`confirmationParameters_${parishId}`, JSON.stringify(data.confirmaciones_params));
            return { ...getDefaultConfirmationParameters(), ...data.confirmaciones_params };
        }
    } catch (e) {
        console.warn("Error leyendo parámetros de confirmación:", e);
    }

    const stored = localStorage.getItem(`confirmationParameters_${parishId}`);
    return stored ? { ...getDefaultConfirmationParameters(), ...JSON.parse(stored) } : getDefaultConfirmationParameters();
};

export const updateConfirmationParameters = async (parishId, params) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    try {
        const current = await getConfirmationParameters(parishId);
        const updated = { ...current, ...params };
        localStorage.setItem(`confirmationParameters_${parishId}`, JSON.stringify(updated));

        await supabase
            .from('parish_parameters')
            .upsert({
                parish_id: parishId,
                confirmaciones_params: updated,
                updated_at: new Date().toISOString()
            }, { onConflict: 'parish_id' });

        return { success: true, message: "Parámetros de confirmación actualizados en la nube." };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const resetConfirmationParameters = (parishId) => updateConfirmationParameters(parishId, getDefaultConfirmationParameters());

export const getNextConfirmationNumbers = async (parishId) => {
    const params = await getConfirmationParameters(parishId);
    return { 
        book: String(params.ordinarioLibro || 1).padStart(4, '0'), 
        page: String(params.ordinarioFolio || 1).padStart(4, '0'), 
        entry: String(params.ordinarioNumero || 1).padStart(4, '0') 
    };
};

// ============================================================================
// 🕊️ MATRIMONIOS
// ============================================================================
export const getMatrimonioParameters = async (parishId) => {
    if (!parishId) return getDefaultMatrimonioParameters();
    
    try {
        const { data, error } = await supabase
            .from('parish_parameters')
            .select('matrimonios_params')
            .eq('parish_id', parishId)
            .maybeSingle();

        if (!error && data?.matrimonios_params) {
            localStorage.setItem(`matrimonioParameters_${parishId}`, JSON.stringify(data.matrimonios_params));
            return { ...getDefaultMatrimonioParameters(), ...data.matrimonios_params };
        }
    } catch (e) {}

    const stored = localStorage.getItem(`matrimonioParameters_${parishId}`);
    return stored ? { ...getDefaultMatrimonioParameters(), ...JSON.parse(stored) } : getDefaultMatrimonioParameters();
};

export const updateMatrimonioParameters = async (parishId, params) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia" };
    try {
        const current = await getMatrimonioParameters(parishId);
        const updated = { ...current, ...params };
        localStorage.setItem(`matrimonioParameters_${parishId}`, JSON.stringify(updated));

        await supabase
            .from('parish_parameters')
            .upsert({
                parish_id: parishId,
                matrimonios_params: updated,
                updated_at: new Date().toISOString()
            }, { onConflict: 'parish_id' });

        return { success: true, message: "Parámetros de matrimonio actualizados en la nube." };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const resetMatrimonioParameters = (parishId) => updateMatrimonioParameters(parishId, getDefaultMatrimonioParameters());

export const getNextMatrimonioNumbers = async (parishId) => {
    const params = await getMatrimonioParameters(parishId);
    return { 
        book: String(params.ordinarioLibro || 1).padStart(4, '0'), 
        page: String(params.ordinarioFolio || 1).padStart(4, '0'), 
        entry: String(params.ordinarioNumero || 1).padStart(4, '0') 
    };
};

// ============================================================================
// 🔢 CÁLCULO DE CONSECUTIVOS (AVANCE Y RETROCESO)
// ============================================================================

/**
 * Avanza el consecutivo (Para nuevas partidas o decretos)
 * Cubre: Casos 1, 2 y 4
 */
export const calculateNextConsecutive = (currentNumero, currentFolio, currentLibro, maxPartidasPorFolio, reiniciarEnFolioNuevo) => {
    let num = parseInt(currentNumero || 1, 10);
    let fol = parseInt(currentFolio || 1, 10);
    let lib = parseInt(currentLibro || 1, 10);
    const limit = parseInt(maxPartidasPorFolio || 1, 10);

    if (reiniciarEnFolioNuevo) {
        // Regla: Al llenar el folio, pasamos al siguiente y el número vuelve a 1
        if (num >= limit) {
            fol += 1;
            num = 1;
        } else {
            num += 1;
        }
    } else {
        // Regla: El número crece infinitamente. El folio avanza cada vez que el número completa un ciclo del límite.
        num += 1;
        if ((num - 1) % limit === 0) {
            fol += 1;
        }
    }

    return {
        numero: String(num).padStart(4, '0'),
        folio: String(fol).padStart(4, '0'),
        libro: String(lib).padStart(4, '0')
    };
};

/**
 * Retrocede el consecutivo (Para cuando se elimina/anula una partida)
 * Revierte matemáticamente los Casos 1, 2 y 4
 */
export const calculatePreviousConsecutive = (currentNumero, currentFolio, currentLibro, maxPartidasPorFolio, reiniciarEnFolioNuevo) => {
    let num = parseInt(currentNumero || 1, 10);
    let fol = parseInt(currentFolio || 1, 10);
    let lib = parseInt(currentLibro || 1, 10);
    const limit = parseInt(maxPartidasPorFolio || 1, 10);

    // Evitar retroceder más allá del 1-1
    if (fol <= 1 && num <= 1) {
        return {
            numero: String(num).padStart(4, '0'),
            folio: String(fol).padStart(4, '0'),
            libro: String(lib).padStart(4, '0')
        };
    }

    if (reiniciarEnFolioNuevo) {
        // Regla Inversa: Si el número es 1 y bajamos, volvemos al folio anterior en su límite máximo
        if (num === 1 && fol > 1) {
            fol -= 1;
            num = limit;
        } else {
            num -= 1;
        }
    } else {
        // Regla Inversa: Si el número actual abrió un folio nuevo, al retroceder cerramos ese folio
        if ((num - 1) % limit === 0 && fol > 1) {
            fol -= 1;
        }
        num -= 1;
    }

    return {
        numero: String(num).padStart(4, '0'),
        folio: String(fol).padStart(4, '0'),
        libro: String(lib).padStart(4, '0')
    };
};

/**
 * Avanza el Número de Registro Global (Caso 3)
 */
export const calculateNextRegistro = (currentRegistro) => {
    const next = parseInt(currentRegistro || 0, 10) + 1;
    return String(next).padStart(6, '0');
};

/**
 * Retrocede el Número de Registro Global (Caso 3)
 */
export const calculatePreviousRegistro = (currentRegistro) => {
    let prev = parseInt(currentRegistro || 1, 10) - 1;
    if (prev < 1) prev = 1;
    return String(prev).padStart(6, '0');
};