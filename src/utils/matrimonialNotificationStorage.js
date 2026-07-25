import { generateUUID } from '@/utils/supabaseHelpers';

const STORAGE_KEY = 'matrimonialNotifications';
const AVISOS_KEY = 'matrimonialNotificationAvisos';

export const initializeMatrimonialNotificationStorage = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(AVISOS_KEY)) {
        localStorage.setItem(AVISOS_KEY, JSON.stringify([]));
    }
};

export const saveDocumento = (documento) => {
    try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const newDoc = {
            ...documento,
            id: documento.id || generateUUID(),
            createdAt: new Date().toISOString(),
            status: documento.status || 'generado'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, newDoc]));
        return { success: true, message: 'Documento guardado exitosamente.', data: newDoc };
    } catch (error) {
        return { success: false, message: 'Error al guardar el documento.', data: null };
    }
};

export const getDocumentoById = (id) => {
    try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const found = current.find(doc => doc.id === id);
        if (found) return { success: true, message: 'Documento encontrado.', data: found };
        return { success: false, message: 'Documento no encontrado.', data: null };
    } catch (error) {
        return { success: false, message: 'Error al buscar el documento.', data: null };
    }
};

export const getAllDocumentos = (parishId) => {
    try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const filtered = parishId ? current.filter(doc => doc.parishId === parishId) : current;
        return { success: true, message: 'Documentos obtenidos.', data: filtered };
    } catch (error) {
        return { success: false, message: 'Error al obtener documentos.', data: [] };
    }
};

export const updateDocumentoStatus = (id, status) => {
    try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
        let updated = false;
        const newData = current.map(doc => {
            if (doc.id === id) {
                updated = true;
                return { ...doc, status, viewedAt: status === 'visto' ? new Date().toISOString() : doc.viewedAt };
            }
            return doc;
        });
        
        if (updated) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            return { success: true, message: 'Estado actualizado.', data: null };
        }
        return { success: false, message: 'Documento no encontrado.', data: null };
    } catch (error) {
        return { success: false, message: 'Error al actualizar el estado.', data: null };
    }
};

export const deleteDocumento = (id) => {
    try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const filtered = current.filter(doc => doc.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return { success: true, message: 'Documento eliminado.', data: null };
    } catch (error) {
        return { success: false, message: 'Error al eliminar el documento.', data: null };
    }
};

export const saveAviso = (aviso) => {
    try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(AVISOS_KEY));
        const newAviso = { ...aviso, id: aviso.id || generateUUID(), createdAt: new Date().toISOString(), status: 'pendiente' };
        localStorage.setItem(AVISOS_KEY, JSON.stringify([...current, newAviso]));
        return { success: true, message: 'Aviso guardado.', data: newAviso };
    } catch (error) {
        return { success: false, message: 'Error al guardar el aviso.', data: null };
    }
};

export const getAllAvisos = (receiverParishId) => {
    try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(AVISOS_KEY));
        const filtered = receiverParishId ? current.filter(a => a.receiverParishId === receiverParishId) : current;
        return { success: true, message: 'Avisos obtenidos.', data: filtered };
    } catch (error) {
        return { success: false, message: 'Error al obtener avisos.', data: [] };
    }
};

export const updateAvisoStatus = (id, status) => {
     try {
        initializeMatrimonialNotificationStorage();
        const current = JSON.parse(localStorage.getItem(AVISOS_KEY));
        let updated = false;
        const newData = current.map(doc => {
            if (doc.id === id) {
                updated = true;
                return { ...doc, status, viewedAt: status === 'visto' ? new Date().toISOString() : doc.viewedAt };
            }
            return doc;
        });
        
        if (updated) {
            localStorage.setItem(AVISOS_KEY, JSON.stringify(newData));
            return { success: true, message: 'Aviso actualizado.', data: null };
        }
        return { success: false, message: 'Aviso no encontrado.', data: null };
    } catch (error) {
        return { success: false, message: 'Error al actualizar aviso.', data: null };
    }
};