import React from 'react';

/**
 * Retrieves the active priest from a list of priests.
 *
 * @param {Array} parrocosData - An array of priest objects, each with 'nombre', 'apellido', and 'estado'.
 * @returns {string} The full name of the active priest in uppercase, or "PÁRROCO ENCARGADO" if not found.
 */
export const getActivePriest = (parrocosData) => {
    if (!parrocosData || !Array.isArray(parrocosData)) {
        return "PÁRROCO ENCARGADO";
    }

    const activePriest = parrocosData.find(priest => String(priest.estado) === "1"); // estado 1 typically means active

    if (activePriest) {
        const nombre = activePriest.nombre || '';
        const apellido = activePriest.apellido || '';
        return `${nombre} ${apellido}`.trim().toUpperCase();
    }

    return "PÁRROCO ENCARGADO";
};