import { generateUUID } from './supabaseHelpers';

/**
 * Maps a raw legacy JSON record to the internal Baptism structure.
 */
export const mapBaptismJSON = (rawData) => {
    // Helper to format date if needed
    const formatDate = (d) => d || '';

    const mapSex = (s) => {
        const str = String(s).toUpperCase().trim();
        if (str === '1' || str === 'M' || str.includes('MASC')) return 'MASCULINO';
        if (str === '2' || str === 'F' || str.includes('FEM')) return 'FEMENINO';
        return str || 'NO ESPECIFICADO';
    };

    return {
        id: generateUUID(),
        status: 'confirmed', 
        
        // Registry Info
        book_number: String(rawData.libro || rawData.book_number || ''),
        page_number: String(rawData.folio || rawData.page_number || ''),
        entry_number: String(rawData.numero || rawData.entry_number || ''),
        
        // Sacrament Data
        sacramentDate: formatDate(rawData.fechaSacramento || rawData.fecbau),
        sacramentPlace: rawData.lugarBautismoDetalle || rawData.lugarBautismo || rawData.lugbau || '',
        lugarBautismo: rawData.lugarBautismo || rawData.lugbau || '',
        lugarBautismoDetalle: rawData.lugarBautismoDetalle || rawData.lugarBautismo || rawData.lugbau || '',
        
        // Person Data
        firstName: rawData.nombres || rawData.firstName || '',
        lastName: rawData.apellidos || rawData.lastName || '',
        birthDate: formatDate(rawData.fechaNacimiento || rawData.fecnac),
        birthPlace: rawData.lugarNacimiento || rawData.lugarn || rawData.lugnac || '',
        lugarNacimientoDetalle: rawData.lugarNacimientoDetalle || rawData.lugarNacimiento || rawData.lugarn || '',
        sex: mapSex(rawData.sexo || rawData.sex),
        
        // Parents & Union
        fatherName: rawData.nombrePadre || rawData.padre || '',
        fatherId: rawData.cedulaPadre || rawData.cedupad || '',
        motherName: rawData.nombreMadre || rawData.madre || '',
        motherId: rawData.cedulaMadre || rawData.cedumad || '',
        tipoUnionPadres: rawData.tipoUnionPadres || rawData.tipohijo || '',
        parentsUnionType: rawData.tipoUnionPadres || rawData.tipohijo || '',
        
        // Grandparents
        paternalGrandparents: rawData.abuelosPaternos || rawData.abuepat || rawData.abupa || '',
        maternalGrandparents: rawData.abuelosMaternos || rawData.abuemat || rawData.abuma || '',
        
        // Godparents
        godfather: rawData.padri || '', 
        godmother: rawData.madri || '', 
        godparents: rawData.padrinos || rawData.godparents || ((rawData.padri || '') + (rawData.madri ? ' y ' + rawData.madri : '')).trim() || '',
        
        // Minister
        minister: rawData.ministro || rawData.minister || '',
        ministerFaith: rawData.daFe || rawData.dafe || rawData.ministerFaith || '',
        
        // Civil Registry
        registrySerial: rawData.serialRegistro || rawData.regciv || '',
        nuip: rawData.nuip || '',
        registryOffice: rawData.oficinaRegistro || rawData.notaria || '',
        registryDate: rawData.fechaExpedicionRegistro || rawData.fecregis || '',

        // Notes & Meta
        notes: rawData.notaMarginal || rawData.nota || '',
        notaMarginal: rawData.notaMarginal || rawData.nota || '',
        importedAt: new Date().toISOString(),
        isAnulado: rawData.anulado === true || rawData.anulado === '1' || rawData.estado === 'anulada',
        lastUpdated: rawData.actualizad || new Date().toISOString(),
        
        // Other legacy fields
        numinsc: rawData.numinsc,
        direccion: rawData.direccion,
        responsable: rawData.responsa,
        documentos: [rawData.docu1, rawData.docu2, rawData.docu3, rawData.docu4].filter(Boolean)
    };
};

/**
 * Validates the overall structure of the imported JSON file.
 */
export const validateBaptismStructure = (jsonData) => {
    if (!jsonData || typeof jsonData !== 'object') {
        return { isValid: false, message: 'El archivo no es un JSON válido.' };
    }
    
    if (!Array.isArray(jsonData.data)) {
        return { isValid: false, message: 'El JSON debe contener una propiedad "data" que sea un arreglo.' };
    }

    if (jsonData.data.length === 0) {
        return { isValid: false, message: 'El arreglo "data" está vacío.' };
    }

    return { isValid: true, count: jsonData.data.length };
};

/**
 * Validates a single record row for required fields and data types.
 */
export const validateBaptismData = (record) => {
    const errors = [];
    
    // Required Identity (acepta tanto el formato nuevo como el viejo)
    if (!record.libro && !record.book_number) errors.push('Falta Libro');
    if (!record.folio && !record.page_number) errors.push('Falta Folio');
    if (!record.numero && !record.entry_number) errors.push('Falta Número');
    if (!record.nombres && !record.firstName) errors.push('Faltan Nombres');
    if (!record.apellidos && !record.lastName) errors.push('Faltan Apellidos');

    // NOTA: Se ha eliminado la validación estricta de números (1-5) para "sexo" y "tipohijo"
    // para permitir la importación de textos descriptivos ("MASCULINO", "MATRIMONIO CATÓLICO", etc.)

    return {
        isValid: errors.length === 0,
        errors
    };
};

export const handleBaptismImportError = (error) => {
    console.error("Baptism Import Error:", error);
    if (error instanceof SyntaxError) {
        return "Error de sintaxis en el archivo JSON. Verifique el formato.";
    }
    return error.message || "Error desconocido durante la importación.";
};

export const detectDuplicateBaptisms = (importedRecords, existingRecords) => {
    const newRecords = [];
    const duplicateRecords = [];

    const existingKeys = new Set(existingRecords.map(r => {
        const b = String(r.book_number || r.libro || '').trim().toLowerCase();
        const p = String(r.page_number || r.folio || '').trim().toLowerCase();
        const e = String(r.entry_number || r.numero || '').trim().toLowerCase();
        return `${b}-${p}-${e}`;
    }));

    importedRecords.forEach(record => {
        const b = String(record.book_number || record.libro || '').trim().toLowerCase();
        const p = String(record.page_number || record.folio || '').trim().toLowerCase();
        const e = String(record.entry_number || record.numero || '').trim().toLowerCase();
        const key = `${b}-${p}-${e}`;

        if (existingKeys.has(key)) {
            duplicateRecords.push(record);
        } else {
            newRecords.push(record);
        }
    });

    return { newRecords, duplicateRecords };
};

export const separateNewAndDuplicateBaptisms = (importedRecords, existingRecords) => {
    const { newRecords, duplicateRecords } = detectDuplicateBaptisms(importedRecords, existingRecords);
    
    return {
        newBaptisms: newRecords,
        duplicateBaptisms: duplicateRecords,
        summary: {
            newCount: newRecords.length,
            duplicateCount: duplicateRecords.length
        }
    };
};