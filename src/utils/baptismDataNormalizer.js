import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

/**
 * Normalizes baptism record data from various sources (JSON import, local DB, manual entry)
 * into a standardized format expected by the BaptismPrintTemplate.
 * 
 * @param {Object} rawData - The raw record object
 * @returns {Object} Normalized object with specific keys expected by the print template
 */
export const normalizeBaptismPartida = (rawData) => {
    if (!rawData) {
        console.warn("normalizeBaptismPartida received null or undefined data");
        return getEmptyPartida();
    }

    try {
        // 1. Handle Dates
        const normalizeDate = (dateVal) => {
            if (!dateVal) return '';
            return dateVal;
        };

        const fechaBautismo = normalizeDate(rawData.sacramentDate || rawData.fechaBautismo || rawData.FecBau);
        const fechaNacimiento = normalizeDate(rawData.birthDate || rawData.fechaNacimiento || rawData.FecNac);

        // 2. Handle Arrays (Godparents, Grandparents)
        const arrayToString = (val) => {
            if (!val) return '';
            if (Array.isArray(val)) {
                return val.map(item => (typeof item === 'object' ? item.name : item)).join(', ');
            }
            return String(val);
        };

        // 3. Normalize Sexo
        const normalizeSexo = (val) => {
            if (!val) return 'NO ESPECIFICADO';
            const v = String(val).toUpperCase();
            if (v === '1' || v === 'M' || v.startsWith('MASC')) return 'MASCULINO';
            if (v === '2' || v === 'F' || v.startsWith('FEM')) return 'FEMENINO';
            return v;
        };

        // 4. Map Keys
        const normalized = {
            // Identifiers
            id: rawData.id || '',
            
            // Registry Info
            libro: String(rawData.book_number || rawData.libro || rawData.Libro || '---'),
            folio: String(rawData.page_number || rawData.folio || rawData.Folio || '---'),
            numero: String(rawData.entry_number || rawData.numero || rawData.Numero || '---'),
            
            // Sacrament Data
            fechaBautismo: fechaBautismo,
            lugarBautismoDetalle: rawData.lugarBautismoDetalle || rawData.lugarBautismo || rawData.sacramentPlace || rawData.place || '',
            ministro: rawData.minister || rawData.ministro || '',
            daFe: rawData.daFe || rawData.ministerFaith || rawData.DaFe || '', 
            
            // Candidate Data
            nombres: rawData.firstName || rawData.nombres || rawData.Nombres || '',
            apellidos: rawData.lastName || rawData.apellidos || rawData.Apellidos || '',
            fechaNacimiento: fechaNacimiento,
            lugarNacimientoDetalle: rawData.lugarNacimientoDetalle || rawData.lugarNacimiento || rawData.birthPlace || '',
            sexo: normalizeSexo(rawData.sex || rawData.sexo),
            
            // Parents
            nombrePadre: rawData.fatherName || rawData.nombrePadre || rawData.Padre || '',
            cedulaPadre: rawData.fatherId || rawData.cedulaPadre || '',
            nombreMadre: rawData.motherName || rawData.nombreMadre || rawData.Madre || '',
            cedulaMadre: rawData.motherId || rawData.cedulaMadre || '',
            tipoUnionPadres: rawData.tipoUnionPadres || rawData.parentsUnionType || '',
            
            // Grandparents & Godparents
            abuelosPaternos: arrayToString(rawData.paternalGrandparents || rawData.abuelosPaternos),
            abuelosMaternos: arrayToString(rawData.maternalGrandparents || rawData.abuelosMaternos),
            padrinos: arrayToString(rawData.godparents || rawData.padrinos),
            
            // Metadata
            notaAlMargen: rawData.notaMarginal || rawData.notaAlMargen || rawData.NotaMarginal || '',
            oficinaRegistroCivil: rawData.registryOffice || rawData.oficinaRegistroCivil || '',

            // Preserve embedded parish info if present (e.g. historical snapshot)
            parroquiaInfo: rawData.parroquiaInfo || {} 
        };

        return normalized;

    } catch (error) {
        console.error("Error normalizing baptism data:", error);
        return getEmptyPartida();
    }
};

/**
 * Enriches a normalized partida with auxiliary data (parish details).
 * Useful for injecting current parish data into records that don't have it,
 * or overriding it for printing.
 * 
 * @param {Object} partida - Normalized baptism object
 * @param {Object} auxiliaryData - Mis Datos object (nombre, direccion, etc)
 * @returns {Object} Enriched partida object
 */
export const enrichBaptismPartidaWithAuxiliaryData = (partida, auxiliaryData) => {
    if (!partida) return null;
    if (!auxiliaryData) return partida;
    
    return {
        ...partida,
        parroquiaInfo: {
            // Prefer existing info if specific override is needed, otherwise use aux data
            ...partida.parroquiaInfo,
            
            nombre: auxiliaryData.nombre || auxiliaryData.parishName || partida.parroquiaInfo?.nombre || '',
            direccion: auxiliaryData.direccion || auxiliaryData.address || partida.parroquiaInfo?.direccion || '',
            telefono: auxiliaryData.telefono || auxiliaryData.phone || partida.parroquiaInfo?.telefono || '',
            email: auxiliaryData.email || partida.parroquiaInfo?.email || '',
            ciudad: auxiliaryData.ciudad || auxiliaryData.city || partida.parroquiaInfo?.ciudad || '',
            departamento: auxiliaryData.departamento || auxiliaryData.state || partida.parroquiaInfo?.departamento || '',
            diocesis: auxiliaryData.diocesis || auxiliaryData.dioceseName || partida.parroquiaInfo?.diocesis || ''
        }
    };
};

const getEmptyPartida = () => ({
    libro: '---', folio: '---', numero: '---',
    fechaBautismo: '', lugarBautismoDetalle: '',
    nombres: '', apellidos: '',
    fechaNacimiento: '', lugarNacimientoDetalle: '', sexo: '',
    nombrePadre: '', nombreMadre: '',
    abuelosPaternos: '', abuelosMaternos: '', padrinos: '',
    ministro: '', notaAlMargen: '',
    parroquiaInfo: {}
});

export const validateBaptismPartidaStructure = (normalizedData) => {
    const missing = [];
    if (!normalizedData.nombres && !normalizedData.apellidos) missing.push('Nombres/Apellidos');
    if (!normalizedData.fechaBautismo) missing.push('Fecha de Bautismo');
    
    return {
        isValid: missing.length === 0,
        missingFields: missing
    };
};