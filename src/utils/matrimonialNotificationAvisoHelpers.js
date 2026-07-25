import { updateAvisoStatus, getAllAvisos, getDocumentoById } from './matrimonialNotificationStorage';

export const obtenerAvisosParroquia = (parishId) => {
    if (!parishId) return [];
    const response = getAllAvisos(parishId);
    return response.success ? response.data : [];
};

export const filtrarAvisos = (avisos, filtros) => {
    if (!avisos) return [];
    return avisos.filter(aviso => {
        // Filtro por texto libre (nombre, consecutivo)
        if (filtros.search) {
            const term = filtros.search.toLowerCase();
            const personName = (aviso.personName || '').toLowerCase();
            const consecutivo = (aviso.consecutivo || '').toLowerCase();
            if (!personName.includes(term) && !consecutivo.includes(term)) return false;
        }

        // Filtro por estado
        if (filtros.status && filtros.status !== 'Todos') {
            const statusTarget = filtros.status.toLowerCase(); // 'pendientes' -> 'pendiente', 'vistos' -> 'visto'
            const currentStatus = (aviso.status || '').toLowerCase();
            if (statusTarget === 'pendientes' && currentStatus !== 'pendiente') return false;
            if (statusTarget === 'vistos' && currentStatus !== 'visto') return false;
        }

        // Filtro por fecha (rango)
        if (filtros.dateFrom || filtros.dateTo) {
            const avisoDate = new Date(aviso.createdAt).setHours(0, 0, 0, 0);
            if (filtros.dateFrom) {
                const from = new Date(filtros.dateFrom).setHours(0, 0, 0, 0);
                if (avisoDate < from) return false;
            }
            if (filtros.dateTo) {
                const to = new Date(filtros.dateTo).setHours(23, 59, 59, 999);
                if (avisoDate > to) return false;
            }
        }

        // Filtro por parroquia emisora (opcional si guardamos el parishId emisor en el aviso, 
        // normalmente el documento tiene el parishId de origen)
        if (filtros.emisorParishId && filtros.emisorParishId !== 'Todas') {
            const doc = obtenerDocumentoRelacionado(aviso.documentoId);
            if (!doc || doc.parishId !== filtros.emisorParishId) return false;
        }

        return true;
    });
};

export const marcarAvisoComoVisto = (avisoId, userId) => {
    const res = updateAvisoStatus(avisoId, 'visto');
    if (res.success) {
        // En una implementación real, aquí se guardaría el userId que lo vio
        const avisosKey = 'matrimonialNotificationAvisos';
        const current = JSON.parse(localStorage.getItem(avisosKey) || '[]');
        const updated = current.map(a => {
            if (a.id === avisoId) {
                return { ...a, viewedBy: userId, status: 'visto', viewedAt: new Date().toISOString() };
            }
            return a;
        });
        localStorage.setItem(avisosKey, JSON.stringify(updated));
    }
    return res;
};

export const eliminarAviso = (avisoId) => {
    try {
        const avisosKey = 'matrimonialNotificationAvisos';
        const current = JSON.parse(localStorage.getItem(avisosKey) || '[]');
        const updated = current.filter(a => a.id !== avisoId);
        localStorage.setItem(avisosKey, JSON.stringify(updated));
        return { success: true, message: 'Aviso eliminado correctamente.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const obtenerDocumentoRelacionado = (documentoId) => {
    const res = getDocumentoById(documentoId);
    return res.success ? res.data : null;
};

export const obtenerPartidaRelacionada = (baptismPartidaId) => {
    if (!baptismPartidaId) return null;
    // Búsqueda exhaustiva en todas las parroquias guardadas en localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('baptisms_')) {
            try {
                const arr = JSON.parse(localStorage.getItem(key) || '[]');
                const found = arr.find(b => b.id === baptismPartidaId);
                if (found) return found;
            } catch (e) {
                // ignore
            }
        }
    }
    return null;
};

export const obtenerMatrimonioRelacionado = (matrimonioId) => {
    if (!matrimonioId) return null;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('matrimonios_')) {
            try {
                const arr = JSON.parse(localStorage.getItem(key) || '[]');
                const found = arr.find(m => m.id === matrimonioId);
                if (found) return found;
            } catch (e) {
                // ignore
            }
        }
    }
    return null;
};

export const obtenerParroquiaEmisoraInfo = (parishId) => {
    if (!parishId) return null;
    const parishes = JSON.parse(localStorage.getItem('parishes') || '[]');
    return parishes.find(p => p.id === parishId) || null;
};