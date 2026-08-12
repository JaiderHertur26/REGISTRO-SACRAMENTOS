import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { obtenerNotasAlMargen } from './marginalNotesService';
import { getParrocos } from './catalogsService';
import { 
    calculateNextConsecutive, 
    getConfirmationParameters, 
    updateConfirmationParameters, 
    getMatrimonioParameters, 
    updateMatrimonioParameters, 
    getBaptismParameters 
} from './sacramentParametersService';

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
// 🧠 DICCIONARIO ÚNICO Y PURIFICADOR MAESTRO DE BAUTISMOS
// ============================================================================
export const purificarRegistroBautismo = (raw) => {
    if (!raw) return null;

    const pId = raw.parishId || raw.parish_id || 'ae48c502-6603-4887-ba38-6886e628430e';
    const config = obtenerNotasAlMargen(pId) || {};
    
    const identityId = raw.tipoIdentidad || raw.identityId || 'id_estandar';
    let notaCalculada = "";
    switch (identityId) {
        case 'id_anulada_correccion': notaCalculada = config.porCorreccion?.anulada || "ANULADA POR CORRECCIÓN."; break;
        case 'id_creada_correccion': notaCalculada = config.porCorreccion?.nuevaPartida || "CREADA POR CORRECCIÓN."; break;
        case 'id_creada_reposicion': notaCalculada = config.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || "CREADA POR REPOSICIÓN."; break;
        case 'id_notaMatrimonio': notaCalculada = config.porNotificacionMatrimonial?.textoParaPartidaOriginal || "CONTRAJO MATRIMONIO."; break;
        default: notaCalculada = raw.notaMarginal || raw.margin_note || config.estandar || "ES COPIA FIEL DEL ORIGINAL."; break;
    }

    const getFechaHoyLetras = () => {
        try {
            const hoy = new Date().toISOString().split('T')[0];
            return convertDateToSpanishText(hoy).replace(/^EL\s+/i, '').toUpperCase();
        } catch (e) { return "FECHA ACTUAL"; }
    };
    const notaFinalConFecha = notaCalculada.replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras()).toUpperCase();

    const getNombreParrocoActual = () => {
        if (!pId) return 'PÁRROCO ENCARGADO';
        const lista = getParrocos(pId) || [];
        const actual = lista.find(p => String(p.estado) === '1');
        return actual ? `${actual.nombre} ${actual.apellido || ''}`.trim().toUpperCase() : 'PÁRROCO ENCARGADO';
    };

    const sLibro = String(raw.Libro || raw.book_number || raw.libro || '0').padStart(4, '0');
    const sFolio = String(raw.folio || raw.page_number || '0').padStart(4, '0');
    const sNumero = String(raw.numero || raw.entry_number || raw.number || '0').padStart(4, '0');

    // DICCIONARIO OFICIAL CANÓNICO
    return {
        id: raw.id || generateUUID(),
        parishId: pId,
        parish_id: pId,
        tipoIdentidad: identityId,

        // 1. Archivo e Identificación
        numeroRegistro: String(raw.numeroRegistro || raw.inscripcionNumero || raw.numero_registro || '---'),
        Libro: sLibro,
        folio: sFolio,
        numero: sNumero,

        // 2. Sacramento
        lugarBautismo: String(raw.lugarBautismo || raw.placeOfSacrament || '---').trim().toUpperCase(),
        fechaSacramento: raw.fechaSacramento || raw.sacramentDate || '---',
        horaSacramento: raw.horaSacramento || '10:00',

        // 3. Sujeto Bautizado
        nombres: String(raw.nombres || raw.firstName || '').trim().toUpperCase(),
        apellidos: String(raw.apellidos || raw.lastName || '').trim().toUpperCase(),
        sexo: String(raw.sexo || raw.gender || 'MASCULINO').toUpperCase(),
        fechaNacimiento: raw.fechaNacimiento || raw.birthDate || '---',
        lugarNacimiento: String(raw.lugarNacimiento || raw.placeOfBirth || '---').trim().toUpperCase(),

        // 4. Registro Civil
        nuip: String(raw.nuip || raw.documentNumber || raw.nuipNuit || '---'),
        serialRegistro: String(raw.serialRegistro || raw.serialRegCivil || '---'),
        oficinaRegistro: String(raw.oficinaRegistro || raw.registryOffice || '---').trim().toUpperCase(),
        fechaExpedicionRegistro: raw.fechaExpedicionRegistro || raw.fechaExpedicion || '---',

        // 5. Padres y Filiación
        nombrePadre: String(raw.nombrePadre || raw.fatherName || '---').trim().toUpperCase(),
        cedulaPadre: String(raw.cedulaPadre || raw.fatherId || '---'),
        nombreMadre: String(raw.nombreMadre || raw.motherName || '---').trim().toUpperCase(),
        cedulaMadre: String(raw.cedulaMadre || raw.motherId || '---'),
        tipoUnionPadres: String(raw.tipoUnionPadres || raw.parentalUnion || '---').trim().toUpperCase(),
        abuelosPaternos: String(raw.abuelosPaternos || raw.paternalGrandparents || '---').trim().toUpperCase(),
        abuelosMaternos: String(raw.abuelosMaternos || raw.maternalGrandparents || '---').trim().toUpperCase(),
        direccion: String(raw.direccion || raw.address || '---').trim().toUpperCase(),

        // 6. Testigos y Ministro
        padrinos: String(raw.padrinos || raw.godparents || '---').trim().toUpperCase(),
        ministro: String(raw.ministro || raw.minister || '---').trim().toUpperCase(),
        daFe: raw.daFe || getNombreParrocoActual(),

        // 7. Auditoría
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

        // 🚀 MODO BULLETPROOF: Solo guardamos en las columnas estrictamente necesarias y empaquetamos TODO en raw_data
        const dbRecord = {
            id: purificado.id,
            parish_id: targetParishId,
            folio: purificado.folio,
            number: purificado.numero,
            status: statusFinal,
            raw_data: purificado,
            created_at: new Date().toISOString()
        };

        const { error: insertErr } = await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
        if (insertErr) throw insertErr;

        const storageKey = `baptisms_${targetParishId}`;
        const currentLocal = safeJsonParse(localStorage.getItem(storageKey), []);
        const updatedLocal = [purificado, ...currentLocal.filter(b => b.id !== purificado.id)];

        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
        localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(updatedLocal));

        window.dispatchEvent(new Event('storage'));
        return { success: true, id: purificado.id };
    } catch (e) {
        console.error("Error guardando en Supabase:", e);
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
                const raw = typeof pb.raw_data === 'string' ? safeJsonParse(pb.raw_data, {}) : (pb.raw_data || {});
                return purificarRegistroBautismo({ ...raw, id: pb.id, status: 'pending' });
            });
            localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(cloudPending));
            return cloudPending;
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
        const { data, error } = await supabase
            .from('baptisms')
            .select('*')
            .eq('parish_id', parishId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const cloudBaptisms = (data || []).map(b => {
            const raw = typeof b.raw_data === 'string' ? safeJsonParse(b.raw_data, {}) : (b.raw_data || {});
            return purificarRegistroBautismo({
                ...raw,
                id: b.id,
                status: b.status,
                marginNote: b.margin_note || raw.marginNote || raw.notaMarginal,
                Libro: raw.Libro || b.book_number || '0001',
                folio: raw.folio || b.folio || b.page_number || '0001',
                numero: raw.numero || b.number || b.entry_number || '0001',
            });
        });

        localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(cloudBaptisms));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(cloudBaptisms));

        return cloudBaptisms;
    } catch (error) {
        return getBaptisms(parishId);
    }
};

export const seatBaptism = async (originalId, parishId, updates = {}) => {
    try {
        const pending = await getPendingBaptisms(parishId);
        const record = pending.find(r => r.id === originalId);
        if (!record) return { success: false, message: "Registro no encontrado en borradores." };
        
        const params = await getBaptismParameters(parishId);
        const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
        const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
        const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

        const rawDate = updates.fechaSacramento || updates.sacramentDate || record.fechaSacramento || '';
        const safeId = record.id || generateUUID();

        const finalRecord = purificarRegistroBautismo({ 
            ...record, 
            ...updates, 
            id: safeId, 
            parishId,
            status: 'seated', 
            Libro: libroAsignado, 
            folio: folioAsignado, 
            numero: numeroAsignado,
            fechaSacramento: rawDate
        });

        // 🚀 MODO BULLETPROOF: Guardar directo en la nube sin importar el esquema SQL
        const dbRecord = {
            id: safeId,
            parish_id: parishId,
            status: 'seated',
            folio: folioAsignado,
            number: numeroAsignado,
            raw_data: finalRecord,
            created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
        if (insertError) throw insertError;

        await supabase.from('pending_baptisms').delete().eq('id', originalId);

        const newPending = pending.filter(r => r.id !== originalId);
        localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(newPending));
        
        const list = getBaptisms(parishId).filter(b => b.id !== safeId);
        const newList = [finalRecord, ...list];
        localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(newList));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(newList));

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: "Registro asentado permanentemente." };
    } catch (err) {
        return { success: false, message: "Error al guardar: " + err.message };
    }
};

export const seatMultipleBaptisms = async (ids, parishId) => {
    try {
        const pending = await getPendingBaptisms(parishId);
        const recordsToSeat = pending.filter(r => ids.includes(r.id));
        if (recordsToSeat.length === 0) return { success: false, message: "No hay registros." };

        let params = await getBaptismParameters(parishId);
        let currentLibro = parseInt(params.ordinarioLibro || 1, 10);
        let currentFolio = parseInt(params.ordinarioFolio || 1, 10);
        let currentNumero = parseInt(params.ordinarioNumero || 1, 10);
        const maxPartidas = parseInt(params.ordinarioPartidas || 2, 10);

        const dbRecords = [];
        const purificados = [];

        recordsToSeat.forEach(record => {
            const sLibro = String(currentLibro).padStart(4, '0');
            const sFolio = String(currentFolio).padStart(4, '0');
            const sNumero = String(currentNumero).padStart(4, '0');
            const safeId = record.id || generateUUID();
            
            const finalRecord = purificarRegistroBautismo({
                ...record,
                id: safeId,
                parishId,
                status: 'seated',
                Libro: sLibro, 
                folio: sFolio, 
                numero: sNumero
            });

            purificados.push(finalRecord);

            dbRecords.push({
                id: safeId,
                parish_id: parishId,
                status: 'seated',
                folio: sFolio,
                number: sNumero,
                raw_data: finalRecord,
                created_at: new Date().toISOString()
            });

            if (currentNumero % maxPartidas === 0) currentFolio++;
            currentNumero++;
        });

        const { error: insertErr } = await supabase.from('baptisms').upsert(dbRecords, { onConflict: 'id' });
        if (insertErr) throw insertErr;

        await supabase.from('pending_baptisms').delete().in('id', ids);

        const newPending = pending.filter(r => !ids.includes(r.id));
        localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(newPending));

        const list = getBaptisms(parishId).filter(b => !ids.includes(b.id));
        const updatedList = [...purificados, ...list];
        localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(updatedList));
        localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(updatedList));

        window.dispatchEvent(new Event('storage'));
        return { success: true, message: `¡Se asentaron ${dbRecords.length} registros!` };
    } catch (error) {
        return { success: false, message: "Error: " + error.message };
    }
};

export const validateBaptismNumbers = async (libro, folio, numero, parishId) => {
    const list = getBaptisms(parishId);
    const exists = list.some(r => String(r.Libro) === String(libro) && String(r.folio) === String(folio) && String(r.numero) === String(numero));
    if (exists) return { valid: false, message: "Esta numeración ya existe." };
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
    
    const params = await getConfirmationParameters(parishId);
    const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
    const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
    const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

    const finalRecord = { ...record, status: 'celebrated', book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado };
    
    const list = getConfirmations(parishId);
    localStorage.setItem(`confirmations_${parishId}`, JSON.stringify([...list, finalRecord]));
    localStorage.setItem(`pendingConfirmations_${parishId}`, JSON.stringify(pending.filter(r => r.id !== id)));
    
    const next = calculateNextConsecutive(params.ordinarioNumero || 1, params.ordinarioFolio || 1, params.ordinarioLibro || 1, params.ordinarioPartidas || 2, params.ordinarioRestartNumber);
    await updateConfirmationParameters(parishId, { ...params, ordinarioNumero: next.numero, ordinarioFolio: next.folio, ordinarioLibro: next.libro });
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
    
    const params = await getMatrimonioParameters(parishId);
    const libroAsignado = String(params.ordinarioLibro || 1).padStart(4, '0');
    const folioAsignado = String(params.ordinarioFolio || 1).padStart(4, '0');
    const numeroAsignado = String(params.ordinarioNumero || 1).padStart(4, '0');

    const finalRecord = { ...record, status: 'celebrated', book_number: libroAsignado, page_number: folioAsignado, entry_number: numeroAsignado };
    
    const list = getMatrimonios(parishId);
    localStorage.setItem(`matrimonios_${parishId}`, JSON.stringify([...list, finalRecord]));
    localStorage.setItem(`pendingMatrimonios_${parishId}`, JSON.stringify(pending.filter(r => r.id !== id)));
    
    const next = calculateNextConsecutive(params.ordinarioNumero || 1, params.ordinarioFolio || 1, params.ordinarioLibro || 1, params.ordinarioPartidas || 1, params.ordinarioRestartNumber);
    await updateMatrimonioParameters(parishId, { ...params, ordinarioNumero: next.numero, ordinarioFolio: next.folio, ordinarioLibro: next.libro });
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