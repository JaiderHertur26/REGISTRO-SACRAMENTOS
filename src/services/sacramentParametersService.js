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
    } catch (e) {}

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
// 🔢 MOTOR INTELIGENTE DE CÁLCULO DE CONSECUTIVOS CANÓNICOS
// ============================================================================
export const calculateNextConsecutive = (currentNumero, currentFolio, currentLibro, maxPartidasPorFolio, reiniciarEnFolioNuevo) => {
    let num = parseInt(currentNumero || 1, 10);
    let fol = parseInt(currentFolio || 1, 10);
    let lib = parseInt(currentLibro || 1, 10);
    const max = parseInt(maxPartidasPorFolio || 1, 10);

    if (reiniciarEnFolioNuevo) {
        // REGLA 1: Si el número llega al tope del folio, el folio avanza y el número vuelve a 1.
        if (num >= max) {
            fol += 1;
            num = 1;
        } else {
            num += 1;
        }
    } else {
        // REGLA 2: El número es absoluto (nunca vuelve a 1). Si es múltiplo del tope, el folio avanza.
        if (num % max === 0) {
            fol += 1;
        }
        num += 1;
    }

    return {
        numero: String(num).padStart(4, '0'),
        folio: String(fol).padStart(4, '0'),
        libro: String(lib).padStart(4, '0') // El libro NUNCA avanza automáticamente
    };
};

// 🔢 UTILIDAD PARA EL NÚMERO DE REGISTRO CIVIL (Nuevos Bautismos)
export const calculateNextRegistro = (currentRegistro) => {
    if (!currentRegistro) return '000001';
    
    // Extraemos solo la parte numérica para poder incrementarla, respetando si tiene letras iniciales
    const numMatch = String(currentRegistro).match(/\d+/);
    if (numMatch) {
        const numStr = numMatch[0];
        const nextNum = parseInt(numStr, 10) + 1;
        const paddedNext = String(nextNum).padStart(numStr.length, '0');
        // Reemplazamos la porción numérica por la nueva e incrementada
        return String(currentRegistro).replace(numStr, paddedNext);
    }
    return currentRegistro;
};