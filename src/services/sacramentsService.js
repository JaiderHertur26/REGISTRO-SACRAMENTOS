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

export const cleanDateOnly = (d) => {
    if (!d || typeof d !== 'string' || d.trim() === '' || d === '---') return null;
    const trimmed = d.trim();
    const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
        const [day, month, year] = datePart.split('/');
        return `${year}-${month}-${day}`;
    }
    return null;
};

// ============================================================================
// 🧠 RESOLUCIÓN RELACIONAL (LLAVES FORÁNEAS DE LIBROS)
// ============================================================================
const resolveBookId = async (parishId, bookNumberStr) => {
    if (!bookNumberStr || bookNumberStr === '---' || bookNumberStr === '0000') return null;

    try {
        const numericBookNumber = parseInt(bookNumberStr, 10);
        if (isNaN(numericBookNumber)) return null;

        const { data: existingBook, error: searchError } = await supabase
            .from('sacrament_books')
            .select('id')
            .eq('parish_id', parishId)
            .eq('book_number', numericBookNumber) 
            .eq('sacrament_type', 'BAUTISMO')      
            .maybeSingle();

        if (searchError && searchError.code !== 'PGRST116') throw searchError;
        if (existingBook && existingBook.id) return existingBook.id; 

        const newBookId = generateUUID();
        const { error: insertError } = await supabase
            .from('sacrament_books')
            .insert([{
                id: newBookId,
                parish_id: parishId,
                book_number: numericBookNumber,
                sacrament_type: 'BAUTISMO',
                status: 'ABIERTO',
                created_at: new Date().toISOString()
            }]);

        if (insertError) throw insertError;
        return newBookId;
    } catch (error) {
        console.error("Error asegurando la integridad del Libro:", error);
        return null;
    }
};


// ============================================================================
// 🕊️ BAUTISMOS: MOTOR PRINCIPAL (ESPEJO 1 A 1 CON LA BD)
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
        default: notaCalculada = raw.notaMarginal || raw.margin_note || raw.nota_marginal || config.estandar || "ES COPIA FIEL DEL ORIGINAL."; break;
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

    // Este diccionario unifica lo que viene de React y lo que viene de las nuevas columnas de Supabase
    const purificado = {
        id: raw.id || generateUUID(),
        parishId: pId,
        parish_id: pId,
        tipoIdentidad: identityId,

        Libro: String(raw.Libro || raw.book_number || raw.libro || '0').padStart(4, '0'),
        folio: String(raw.folio || raw.page_number || '0').padStart(4, '0'),
        numero: String(raw.numero || raw.number || raw.entry_number || '0').padStart(4, '0'),
        numeroRegistro: raw.numeroRegistro || raw.numero_registro || raw.inscripcionNumero || '',

        lugarBautismo: String(raw.lugarBautismo || raw.lugar_bautismo || raw.placeOfSacrament || '').trim().toUpperCase(),
        fechaSacramento: raw.fechaSacramento || raw.celebration_date || raw.sacramentDate || '',
        horaSacramento: raw.horaSacramento || raw.hora_sacramento || '10:00',
        
        apellidos: String(raw.apellidos || raw.last_name || '').trim().toUpperCase(),
        nombres: String(raw.nombres || raw.first_name || '').trim().toUpperCase(),
        sexo: String(raw.sexo || raw.gender || 'MASCULINO').toUpperCase(),
        fechaNacimiento: raw.fechaNacimiento || raw.fecha_nacimiento || raw.birthDate || '',
        lugarNacimiento: String(raw.lugarNacimiento || raw.lugar_nacimiento || raw.placeOfBirth || '').trim().toUpperCase(),

        nuip: String(raw.nuip || raw.documentNumber || ''),
        serialRegistro: String(raw.serialRegistro || raw.serial_registro || raw.serialRegCivil || ''),
        oficinaRegistro: String(raw.oficinaRegistro || raw.oficina_registro || raw.registryOffice || '').toUpperCase(),
        fechaExpedicionRegistro: raw.fechaExpedicionRegistro || raw.fecha_expedicion_registro || raw.fechaExpedicion || '',

        tipoUnionPadres: String(raw.tipoUnionPadres || raw.tipo_union_padres || raw.parentalUnion || '').trim().toUpperCase(),
        nombrePadre: String(raw.nombrePadre || raw.nombre_padre || raw.fatherName || '').trim().toUpperCase(),
        cedulaPadre: raw.cedulaPadre || raw.cedula_padre || raw.fatherId || '',
        nombreMadre: String(raw.nombreMadre || raw.nombre_madre || raw.motherName || '').trim().toUpperCase(),
        cedulaMadre: raw.cedulaMadre || raw.cedula_madre || raw.motherId || '',
        direccion: String(raw.direccion || '').toUpperCase(),
        
        abuelosPaternos: String(raw.abuelosPaternos || raw.abuelos_paternos || raw.paternalGrandparents || '').trim().toUpperCase(),
        abuelosMaternos: String(raw.abuelosMaternos || raw.abuelos_maternos || raw.maternalGrandparents || '').trim().toUpperCase(),

        padrinos: String(raw.padrinos || raw.godparents || '').trim().toUpperCase(),
        ministro: String(raw.ministro || raw.minister_name || raw.minister || '').trim().toUpperCase(),
        daFe: raw.daFe || raw.da_fe || getNombreParrocoActual(),

        notaMarginal: notaFinalConFecha,
        status: raw.status || raw.estado || 'seated',
        updatedAt: new Date().toISOString()
    };

    return purificado;
};

// 🚀 GUARDADO 1 A 1 EN LA NUEVA BASE DE DATOS
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
            
            const { error: insertErr } = await supabase.from('pending_baptisms').upsert(tempRecord, { onConflict: 'id' });
            if (insertErr) throw insertErr;

            const storageKey = `pendingBaptisms_${targetParishId}`;
            const currentLocal = safeJsonParse(localStorage.getItem(storageKey), []);
            localStorage.setItem(storageKey, JSON.stringify([...currentLocal.filter(b => b.id !== purificado.id), purificado]));
            window.dispatchEvent(new Event('storage'));
            return { success: true, id: purificado.id };
        }

        const realBookId = await resolveBookId(targetParishId, purificado.Libro);

        const dbRecord = {
            id: purificado.id,
            parish_id: targetParishId,
            book_id: realBookId, 
            
            // Archivo y Localización
            book_number: String(purificado.Libro || '0000'),
            folio: String(purificado.folio || '0000'),
            number: String(purificado.numero || '0000'),
            numero_registro: purificado.numeroRegistro || null,
            
            // Celebración
            celebration_date: cleanDateOnly(purificado.fechaSacramento),
            hora_sacramento: purificado.horaSacramento || null,
            lugar_bautismo: purificado.lugarBautismo || null,
            
            // Bautizado
            apellidos: purificado.apellidos || null,
            nombres: purificado.nombres || null,
            sexo: purificado.sexo || null,
            fecha_nacimiento: cleanDateOnly(purificado.fechaNacimiento),
            lugar_nacimiento: purificado.lugarNacimiento || null,
            
            // Registro Civil
            nuip: purificado.nuip || null,
            serial_registro: purificado.serialRegistro || null,
            oficina_registro: purificado.oficinaRegistro || null,
            fecha_expedicion_registro: cleanDateOnly(purificado.fechaExpedicionRegistro),
            
            // Filiación
            tipo_union_padres: purificado.tipoUnionPadres || null,
            nombre_padre: purificado.nombrePadre || null,
            cedula_padre: purificado.cedulaPadre || null,
            nombre_madre: purificado.nombreMadre || null,
            cedula_madre: purificado.cedulaMadre || null,
            direccion: purificado.direccion || null,
            
            // Genealogía y Testigos
            abuelos_paternos: purificado.abuelosPaternos || null,
            abuelos_maternos: purificado.abuelosMaternos || null,
            padrinos: purificado.padrinos || null,
            
            // Ministros y Notas
            ministro: purificado.ministro || null,
            da_fe: purificado.daFe || null,
            nota_marginal: purificado.notaMarginal || null,
            status: statusFinal,
            
            // Respaldo
            raw_data: purificado,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('baptisms').upsert(dbRecord, { onConflict: 'id' });
        if (error) throw error;

        const storageKey = `baptisms_${targetParishId}`;
        const currentLocal = safeJsonParse(localStorage.getItem(storageKey), []);
        const updatedLocal = [purificado, ...currentLocal.filter(b => b.id !== purificado.id)];

        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
        localStorage.setItem(`baptismPartidas_${targetParishId}`, JSON.stringify(updatedLocal));

        window.dispatchEvent(new Event('storage'));
        return { success: true, id: purificado.id };
    } catch (e) {
        console.error("Supabase Error:", e);
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

// 🚀 LECTURA 1 A 1 DESDE LA NUEVA BASE DE DATOS
export const fetchBaptismsFromSource = async (parishId) => {
    if (!parishId) return [];
    try {
        // Pedimos todas las columnas a la BD
        const { data, error } = await supabase
            .from('baptisms')
            .select('*') 
            .eq('parish_id', parishId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const cloudBaptisms = (data || []).map(b => {
            // El purificador mapea automáticamente las columnas snake_case de Supabase 
            // a las camelCase que necesitan los modales de React.
            return purificarRegistroBautismo(b);
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

        const realBookId = await resolveBookId(parishId, libroAsignado);

        const dbRecord = {
            id: safeId,
            parish_id: parishId,
            book_id: realBookId,
            
            // Archivo y Localización
            book_number: String(finalRecord.Libro || '0000'),
            folio: String(finalRecord.folio || '0000'),
            number: String(finalRecord.numero || '0000'),
            numero_registro: finalRecord.numeroRegistro || null,
            
            // Celebración
            celebration_date: cleanDateOnly(finalRecord.fechaSacramento),
            hora_sacramento: finalRecord.horaSacramento || null,
            lugar_bautismo: finalRecord.lugarBautismo || null,
            
            // Bautizado
            apellidos: finalRecord.apellidos || null,
            nombres: finalRecord.nombres || null,
            sexo: finalRecord.sexo || null,
            fecha_nacimiento: cleanDateOnly(finalRecord.fechaNacimiento),
            lugar_nacimiento: finalRecord.lugarNacimiento || null,
            
            // Registro Civil
            nuip: finalRecord.nuip || null,
            serial_registro: finalRecord.serialRegistro || null,
            oficina_registro: finalRecord.oficinaRegistro || null,
            fecha_expedicion_registro: cleanDateOnly(finalRecord.fechaExpedicionRegistro),
            
            // Filiación
            tipo_union_padres: finalRecord.tipoUnionPadres || null,
            nombre_padre: finalRecord.nombrePadre || null,
            cedula_padre: finalRecord.cedulaPadre || null,
            nombre_madre: finalRecord.nombreMadre || null,
            cedula_madre: finalRecord.cedulaMadre || null,
            direccion: finalRecord.direccion || null,
            
            // Genealogía y Testigos
            abuelos_paternos: finalRecord.abuelosPaternos || null,
            abuelos_maternos: finalRecord.abuelosMaternos || null,
            padrinos: finalRecord.padrinos || null,
            
            // Ministros y Notas
            ministro: finalRecord.ministro || null,
            da_fe: finalRecord.daFe || null,
            nota_marginal: finalRecord.notaMarginal || null,
            status: 'seated',
            
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
        console.error("Error en seatBaptism:", err);
        return { success: false, message: "Error al guardar en la nube: " + err.message };
    }
};

export const seatMultipleBaptisms = async (ids, parishId) => {
    try {
        const pending = await getPendingBaptisms(parishId);
        const recordsToSeat = pending.filter(r => ids.includes(r.id));
        if (recordsToSeat.length === 0) return { success: false, message: "No hay registros seleccionados." };

        let params = await getBaptismParameters(parishId);
        let currentLibro = parseInt(params.ordinarioLibro || 1, 10);
        let currentFolio = parseInt(params.ordinarioFolio || 1, 10);
        let currentNumero = parseInt(params.ordinarioNumero || 1, 10);
        const maxPartidas = parseInt(params.ordinarioPartidas || 2, 10);

        const dbRecords = [];
        const purificados = [];
        const bookIdCache = {}; 

        for (const record of recordsToSeat) {
            const sLibro = String(currentLibro).padStart(4, '0');
            const sFolio = String(currentFolio).padStart(4, '0');
            const sNumero = String(currentNumero).padStart(4, '0');
            const safeId = record.id || generateUUID();
            const rawDate = record.fechaSacramento || record.sacramentDate || '';

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

            if (!bookIdCache[sLibro]) bookIdCache[sLibro] = await resolveBookId(parishId, sLibro);

            dbRecords.push({
                id: safeId,
                parish_id: parishId,
                book_id: bookIdCache[sLibro],
                
                book_number: String(finalRecord.Libro || '0000'),
                folio: String(finalRecord.folio || '0000'),
                number: String(finalRecord.numero || '0000'),
                numero_registro: finalRecord.numeroRegistro || null,
                
                celebration_date: cleanDateOnly(finalRecord.fechaSacramento),
                hora_sacramento: finalRecord.horaSacramento || null,
                lugar_bautismo: finalRecord.lugarBautismo || null,
                
                apellidos: finalRecord.apellidos || null,
                nombres: finalRecord.nombres || null,
                sexo: finalRecord.sexo || null,
                fecha_nacimiento: cleanDateOnly(finalRecord.fechaNacimiento),
                lugar_nacimiento: finalRecord.lugarNacimiento || null,
                
                nuip: finalRecord.nuip || null,
                serial_registro: finalRecord.serialRegistro || null,
                oficina_registro: finalRecord.oficinaRegistro || null,
                fecha_expedicion_registro: cleanDateOnly(finalRecord.fechaExpedicionRegistro),
                
                tipo_union_padres: finalRecord.tipoUnionPadres || null,
                nombre_padre: finalRecord.nombrePadre || null,
                cedula_padre: finalRecord.cedulaPadre || null,
                nombre_madre: finalRecord.nombreMadre || null,
                cedula_madre: finalRecord.cedulaMadre || null,
                direccion: finalRecord.direccion || null,
                
                abuelos_paternos: finalRecord.abuelosPaternos || null,
                abuelos_maternos: finalRecord.abuelosMaternos || null,
                padrinos: finalRecord.padrinos || null,
                
                ministro: finalRecord.ministro || null,
                da_fe: finalRecord.daFe || null,
                nota_marginal: finalRecord.notaMarginal || null,
                status: 'seated',

                raw_data: finalRecord,
                created_at: new Date().toISOString()
            });

            if (currentNumero % maxPartidas === 0) currentFolio++;
            currentNumero++;
        }

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
        console.error("Error en seatMultipleBaptisms:", error);
        return { success: false, message: "Error: " + error.message };
    }
};

export const validateBaptismNumbers = async (libro, folio, numero, parishId) => {
    const list = getBaptisms(parishId);
    const exists = list.some(r => String(r.Libro) === String(libro) && String(r.folio) === String(folio) && String(r.numero) === String(numero));
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