export const validatePartidaSelected = (partida) => {
    if (!partida) {
        return { valid: false, message: 'Debe seleccionar una partida de bautismo.' };
    }
    if (!partida.id) {
        return { valid: false, message: 'La partida seleccionada no tiene un ID válido.' };
    }
    return { valid: true, message: 'Partida válida.' };
};

export const validateMarriageFields = (formData) => {
    const fieldErrors = {};
    let valid = true;

    if (!formData.spouseName || formData.spouseName.trim() === '') {
        fieldErrors.spouseName = 'El nombre del cónyuge es requerido.';
        valid = false;
    }

    if (!formData.marriageDate) {
        fieldErrors.marriageDate = 'La fecha de matrimonio es requerida.';
        valid = false;
    } else {
        const dateObj = new Date(formData.marriageDate);
        if (isNaN(dateObj.getTime())) {
            fieldErrors.marriageDate = 'La fecha ingresada no es válida.';
            valid = false;
        } else if (dateObj > new Date()) {
            fieldErrors.marriageDate = 'La fecha de matrimonio no puede ser en el futuro.';
            valid = false;
        }
    }

    if (!formData.marriageBook || Number(formData.marriageBook) <= 0) {
        fieldErrors.marriageBook = 'Debe ser un número mayor a 0.';
        valid = false;
    }
    
    if (!formData.marriageFolio || Number(formData.marriageFolio) <= 0) {
        fieldErrors.marriageFolio = 'Debe ser un número mayor a 0.';
        valid = false;
    }

    if (!formData.marriageNumber || Number(formData.marriageNumber) <= 0) {
        fieldErrors.marriageNumber = 'Debe ser un número mayor a 0.';
        valid = false;
    }

    if (!formData.marriageDiocese) {
        fieldErrors.marriageDiocese = 'Debe seleccionar la diócesis donde se celebró.';
        valid = false;
    }

    if (!formData.marriageParish || formData.marriageParish.trim() === '') {
        fieldErrors.marriageParish = 'Debe especificar la parroquia donde se celebró.';
        valid = false;
    }

    return {
        valid,
        message: valid ? 'Campos válidos.' : 'Hay errores en el formulario.',
        fieldErrors
    };
};

export const validateNoDuplicates = (baptismPartidaId, spouseName, marriageDate, marriageBook, marriageFolio, marriageNumber) => {
    const storageData = localStorage.getItem('matrimonialNotifications');
    if (!storageData) return { valid: true, message: 'No hay duplicados.' };

    const notifications = JSON.parse(storageData);
    
    const isDuplicate = notifications.some(doc => 
        doc.baptismPartidaId === baptismPartidaId &&
        doc.spouseName?.toLowerCase().trim() === spouseName?.toLowerCase().trim() &&
        doc.marriageDate === marriageDate &&
        String(doc.marriageBook) === String(marriageBook) &&
        String(doc.marriageFolio) === String(marriageFolio) &&
        String(doc.marriageNumber) === String(marriageNumber)
    );

    if (isDuplicate) {
        return { valid: false, message: 'Ya existe una notificación matrimonial con estos mismos datos (Mismo cónyuge, fecha y ubicación en el libro).' };
    }

    return { valid: true, message: 'No hay duplicados.' };
};

export const validateConsecutivoUniqueness = (consecutivo) => {
    const storageData = localStorage.getItem('matrimonialNotifications');
    if (!storageData) return { valid: true, message: 'Consecutivo único.' };

    const notifications = JSON.parse(storageData);
    const exists = notifications.some(doc => doc.consecutivo === consecutivo);

    if (exists) {
        return { valid: false, message: 'El número de consecutivo ya existe. Por favor intente nuevamente.' };
    }

    return { valid: true, message: 'Consecutivo único.' };
};

export const validarPersonaNoTieneConyuge = (nombrePersona, documentos = []) => {
    if (!nombrePersona) return { valido: true, mensaje: '' };
    
    const nameToMatch = nombrePersona.toLowerCase().trim();
    
    const documentoExistente = documentos.find(doc => {
        const docStatus = (doc.status || '').toLowerCase();
        if (docStatus === 'anulado' || docStatus === 'cancelado') return false;
        
        const docPersonName = (doc.personName || '').toLowerCase().trim();
        return docPersonName === nameToMatch && doc.spouseName && doc.spouseName.trim() !== '';
    });

    if (documentoExistente) {
        return {
            valido: false,
            mensaje: `${nombrePersona} ya tiene un cónyuge registrado: ${documentoExistente.spouseName}. No se puede crear otro aviso de notificación matrimonial.`,
            documentoExistente
        };
    }

    return { valido: true, mensaje: '' };
};