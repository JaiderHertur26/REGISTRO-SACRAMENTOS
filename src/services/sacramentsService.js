import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { obtenerNotasAlMargen } from './marginalNotesService';
import { getParrocos } from './catalogsService';
import { calculateNextConsecutive, getConfirmationParameters, updateConfirmationParameters, getMatrimonioParameters, updateMatrimonioParameters } from './sacramentParametersService';

const safeJsonParse = (str, fallback = []) => {
    if (!str || str === 'undefined' || str === 'null') return fallback;
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
};

// ============================================================================
// 🕊️ BAUTISMOS
// ============================================================================
export const purificarRegistroBautismo = (raw) => {
    if (!raw) return null;

    const pId = raw.parishId || raw.parish_id;
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

        Libro: String(raw.Libro || raw.book_number || '0').padStart(4, '0'),
        folio: String(raw.folio || raw.page_number || '0').padStart(4, '0'),
        numero: String(raw.numero || raw.entry_number || '0').padStart(4, '0'),

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

export const saveBaptismToSource = async (data, parishId, mode) => {
    const purificado = purificarRegistroBautismo(data);
    const targetParishId = parishId || purificado.parishId;
    const statusFinal = mode || purificado.status || 'seated';

    try {
        if (statusFinal === 'pending') {
            const tempRecord = {
                id: purificado.id,
                parish_id: targetParishId,
                status: 'pending',
                raw_data: purificado,
                created_at: new Date().toISOString()
            };
            
            await supabase.from('pending_baptisms').upsert(tempRecord, { onConflict: 'id' });

            const storageKey = `pendingBaptisms_${targetParishId}`;
            const currentLocal = safeJsonParse(localStorage.getItem(storageKey), []);
            localStorage.setItem(storageKey, JSON.stringify([...currentLocal.filter(b => b.id !== purificado.id), purificado]));
            window.dispatchEvent(new Event('storage'));
            return { success: true, id: purificado.id };
        }

        const cleanDate = (d) => (d && String(d).trim() !== '' && d !== '---') ? d : null;

        const dbRecord = {
            id: purificado.id,
            parish_id: targetParishId,
            book_number: purificado.Libro, 
            page_number: purificado.folio, 
            entry_number: purificado.numero, 
            first_name: purificado.nombres,
            last_name: purificado.apellidos,
            gender: purificado.sexo,
            birth_date: cleanDate(purificado.fechaNacimiento),
            sacrament_date: cleanDate(purificado.fechaSacramento),
            minister: purificado.ministro,
            father_name: purificado.nombrePadre,
            mother_name: purificado.nombreMadre,
            status: statusFinal,
            margin_note: purificado.notaMarginal,
            raw_data: purificado 
        };

        await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });

        const storageKey = `baptisms_${targetParishId}`;
        const currentLocal = safeJsonParse(localStorage.getItem(storageKey), []);
        const updatedLocal = [...currentLocal.filter(b => b.id !== purificado.id), purificado];

        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
        localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(updatedLocal));

        window.dispatchEvent(new Event('storage'));
        return { success: true, id: purificado.id };
    } catch (e) {
        return { success: false, message: e.message };
    }
};

export const getPendingBaptisms = async (parishId) => {
    if (!parishId) return [];
    try {
        const { data, error } = await supabase
            .from('pending_baptisms')
            .select('*')
            .eq('parish_id', parishId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            const cloudPending = data.map(pb => {
                let raw = pb.raw_data;
                if (typeof raw === 'string') raw = safeJsonParse(raw, {});
                return { ...raw, id: pb.id, status: 'pending' };
            });
            
            localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(cloudPending));
            return cloudPending.filter(b => b && b.id);
        }
        
        localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify([]));
        return [];
    } catch (error) {
        return safeJsonParse(localStorage.getItem(`pendingBaptisms_${parishId}`), []);
    }
};

export const getBaptisms = (parishId) => {
    if (!parishId) return [];
    return safeJsonParse(localStorage.getItem(`baptisms_${parishId}`), []).filter(b => b && b.id);
};

export const fetchBaptismsFromSource = async (parishId) => {
    if (!parishId) return [];
    try {
        const { data, error } = await supabase.from('baptisms').select('*').eq('parish_id', parishId);
        if (error) throw error;

        const cloudBaptisms = (data || []).map(b => ({
            ...(typeof b.raw_data === 'string' ? safeJsonParse(b.raw_data, {}) : (b.raw_data || {})),
            id: b.id,
            status: b.status,
            marginNote: b.margin_note
        }));

        localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(cloudBaptisms));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(cloudBaptisms));

        return cloudBaptisms.filter(b => b && b.id);
    } catch (error) {
        return getBaptisms(parishId);
    }
};

export const seatBaptism = async (originalId, parishId, updates = {}) => {
    try {
        const pending = await getPendingBaptisms(parishId);
        const record = pending.find(r => r.id === originalId);
        if (!record) return { success: false, message: "Registro no encontrado en pendientes." };
        
        const params = safeJsonParse(localStorage.getItem(`baptismParameters_${parishId}`), {});
        const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
        const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
        const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

        const fechaReal = updates.fechaSacramento || updates.sacramentDate || record.fechaSacramento || record.sacramentDate || '';
        const safeId = record.id || generateUUID();

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
            fechaSacramento: fechaReal
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
            mother_name: String(finalRecord.motherName || finalRecord.nombreMadre || ''),
            status: 'seated',
            margin_note: String(finalRecord.marginNote || finalRecord.notaMarginal || ''),
            raw_data: finalRecord 
        };

        await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
        await supabase.from('pending_baptisms').delete().eq('id', originalId);

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
        return { success: true, message: "Registro asentado correctamente." };
    } catch (err) {
        return { success: false, message: "Error: " + err.message };
    }
};

export const seatMultipleBaptisms = async (ids, parishId) => {
    try {
        const pending = await getPendingBaptisms(parishId);
        const recordsToSeat = pending.filter(r => ids.includes(r.id));
        if (recordsToSeat.length === 0) return { success: false, message: "No hay registros seleccionados." };

        let params = safeJsonParse(localStorage.getItem(`baptismParameters_${parishId}`), {});
        let currentLibro = parseInt(params.ordinarioLibro || 1);
        let currentFolio = parseInt(params.ordinarioFolio || 1);
        let currentNumero = parseInt(params.ordinarioNumero || 1);
        const maxPartidas = parseInt(params.ordinarioPartidas || 2);

        const dbRecords = [];
        recordsToSeat.forEach(record => {
            const sLibro = String(currentLibro).padStart(4, '0');
            const sFolio = String(currentFolio).padStart(4, '0');
            const sNumero = String(currentNumero).padStart(4, '0');
            const safeId = record.id || generateUUID();

            const finalRecord = {
                ...record,
                id: safeId,
                status: 'seated',
                estado: 'Activo',
                book_number: sLibro, page_number: sFolio, entry_number: sNumero,
                libro: sLibro, folio: sFolio, numero: sNumero,
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
                sacrament_date: cleanDate(finalRecord.sacramentDate || finalRecord.fechaSacramento),
                minister: String(finalRecord.minister || finalRecord.ministro || ''),
                father_name: String(finalRecord.fatherName || finalRecord.nombrePadre || ''),
                mother_name: String(finalRecord.motherName || finalRecord.nombreMadre || ''),
                status: 'seated',
                raw_data: finalRecord
            });

            if (currentNumero % maxPartidas === 0) currentFolio++;
            currentNumero++;
        });

        await supabase.from('baptisms').upsert(dbRecords, { onConflict: 'id' });
        await supabase.from('pending_baptisms').delete().in('id', ids);

        params.ordinarioLibro = currentLibro;
        params.ordinarioFolio = currentFolio;
        params.ordinarioNumero = currentNumero;
        localStorage.setItem(`baptismParameters_${parishId}`, JSON.stringify(params));

        const newPending = pending.filter(r => !ids.includes(r.id));
        localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(newPending));

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: `¡Se asentaron ${dbRecords.length} registros!` };
    } catch (error) {
        return { success: false, message: "Error: " + error.message };
    }
};

export const validateBaptismNumbers = async (libro, folio, numero, parishId) => {
    const list = getBaptisms(parishId);
    const exists = list.some(r => String(r.book_number || r.Libro) === String(libro) && String(r.page_number || r.folio) === String(folio) && String(r.entry_number || r.numero) === String(numero));
    if (exists) return { valid: false, message: "Ya existe un registro con esta numeración." };
    return { valid: true };
};

// ============================================================================
// 🕊️ CONFIRMACIONES
// ============================================================================
export const getConfirmations = (parishId) => safeJsonParse(localStorage.getItem(`confirmations_${parishId}`), []);
export const getPendingConfirmations = (parishId) => safeJsonParse(localStorage.getItem(`pendingConfirmations_${parishId}`), []);

export const saveConfirmationToSource = async (data, parishId, mode) => {
    const storageKey = mode === 'celebrated' ? `confirmations_${parishId}` : `pendingConfirmations_${parishId}`;
    const list = safeJsonParse(localStorage.getItem(storageKey), []);
    const newItem = { ...data, id: data.id || generateUUID(), status: mode === 'celebrated' ? 'confirmed' : 'pending', createdAt: new Date().toISOString() };
    
    localStorage.setItem(storageKey, JSON.stringify([...list.filter(c => c.id !== newItem.id), newItem]));
    
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
        } catch (e) {}
    }
    
    window.dispatchEvent(new Event('storage'));
    return { success: true, id: newItem.id };
};

export const seatConfirmation = async (id, parishId) => {
    const pending = await getPendingConfirmations(parishId);
    const record = pending.find(r => r.id === id);
    if (!record) return { success: false, message: "Registro no encontrado" };
    
    const params = getConfirmationParameters(parishId);
    const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
    const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
    const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

    const finalRecord = { ...record, status: 'celebrated', book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado };
    
    const list = getConfirmations(parishId);
    localStorage.setItem(`confirmations_${parishId}`, JSON.stringify([...list, finalRecord]));
    localStorage.setItem(`pendingConfirmations_${parishId}`, JSON.stringify(pending.filter(r => r.id !== id)));
    
    const next = calculateNextConsecutive(params.ordinarioNumero || 1, params.ordinarioFolio || 1, params.ordinarioLibro || 1, params.ordinarioPartidas || 2, params.ordinarioRestartNumber);
    updateConfirmationParameters(parishId, { ...params, ordinarioNumero: next.numero, ordinarioFolio: next.folio, ordinarioLibro: next.libro });
    return { success: true, message: "Asentado exitosamente" };
};

export const seatMultipleConfirmations = async (ids, parishId) => {
    let count = 0;
    for (const id of ids) {
        const res = await seatConfirmation(id, parishId);
        if (res.success) count++;
    }
    return { success: true, message: `${count} registros asentados.` };
};

export const validateConfirmationNumbers = async (libro, folio, numero, parishId) => {
    const list = getConfirmations(parishId);
    const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
    if (exists) return { valid: false, message: "Numeración duplicada" };
    return { valid: true };
};

// ============================================================================
// 🕊️ MATRIMONIOS
// ============================================================================
export const getMatrimonios = (parishId) => safeJsonParse(localStorage.getItem(`matrimonios_${parishId}`), []);
export const getPendingMatrimonios = (parishId) => safeJsonParse(localStorage.getItem(`pendingMatrimonios_${parishId}`), []);

export const saveMatrimonioToSource = async (data, parishId, mode) => {
    const storageKey = mode === 'celebrated' ? `matrimonios_${parishId}` : `pendingMatrimonios_${parishId}`;
    const list = safeJsonParse(localStorage.getItem(storageKey), []);
    const newItem = { ...data, id: data.id || generateUUID(), status: mode === 'celebrated' ? 'celebrated' : 'pending', createdAt: new Date().toISOString() };
    
    localStorage.setItem(storageKey, JSON.stringify([...list.filter(m => m.id !== newItem.id), newItem]));

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
        } catch (e) {}
    }
    
    window.dispatchEvent(new Event('storage'));
    return { success: true, id: newItem.id };
};

export const seatMatrimonio = async (id, parishId) => {
    const pending = await getPendingMatrimonios(parishId);
    const record = pending.find(r => r.id === id);
    if (!record) return { success: false, message: "Registro no encontrado" };
    
    const params = getMatrimonioParameters(parishId);
    const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
    const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
    const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

    const finalRecord = { ...record, status: 'celebrated', book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado };
    
    const list = getMatrimonios(parishId);
    localStorage.setItem(`matrimonios_${parishId}`, JSON.stringify([...list, finalRecord]));
    localStorage.setItem(`pendingMatrimonios_${parishId}`, JSON.stringify(pending.filter(r => r.id !== id)));
    
    const next = calculateNextConsecutive(params.ordinarioNumero || 1, params.ordinarioFolio || 1, params.ordinarioLibro || 1, params.ordinarioPartidas || 1, params.ordinarioRestartNumber);
    updateMatrimonioParameters(parishId, { ...params, ordinarioNumero: next.numero, ordinarioFolio: next.folio, ordinarioLibro: next.libro });
    return { success: true, message: "Asentado exitosamente" };
};

export const seatMultipleMatrimonios = async (ids, parishId) => {
    let count = 0;
    for (const id of ids) {
        const res = await seatMatrimonio(id, parishId);
        if (res.success) count++;
    }
    return { success: true, message: `${count} registros asentados.` };
};

export const validateMatrimonioNumbers = async (libro, folio, numero, parishId) => {
    const list = getMatrimonios(parishId);
    const exists = list.some(r => String(r.book_number) === String(libro) && String(r.page_number) === String(folio) && String(r.entry_number) === String(numero));
    if (exists) return { valid: false, message: "Numeración duplicada" };
    return { valid: true };
};