/**
 * Helper function to format dates to "DD de MMMM de YYYY" in Spanish.
 * Example: "2025-02-21" -> "21 de febrero de 2025"
 * @param {string} fecha - Date string (YYYY-MM-DD or ISO format)
 * @returns {string} Formatted date string
 */
export const formatearFecha = (fecha) => {
    if (!fecha) return '';
    try {
        // Extract just the date part to avoid timezone shifts
        const datePart = fecha.includes('T') ? fecha.split('T')[0] : fecha;
        if (!datePart.includes('-')) return fecha; // Fallback if format is unexpected

        const [year, month, day] = datePart.split('-');
        // Month is 0-indexed in Date constructor
        const date = new Date(year, parseInt(month) - 1, day);
        
        if (isNaN(date.getTime())) return fecha;
        
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return new Intl.DateTimeFormat('es-CO', options).format(date);
    } catch (e) {
        return fecha;
    }
};

/**
 * Generates the predefined marginal note text for a matrimonial notification.
 * Replaces placeholders with actual values if provided.
 * @param {Object} params - The document parameters
 * @returns {string} The generated predefined text
 */
export const generarTextoNotificacionMatrimonial = (params = {}) => {
    const {
        fechaNotificacion = '[FECHA_NOTIFICACION]',
        fechaMatrimonio = '[FECHA_MATRIMONIO]',
        parroquiaMatrimonio = '[PARROQUIA_MATRIMONIO]',
        diocesisMatrimonio = '[DIOCESIS_MATRIMONIO]',
        nombreConyuge = '[NOMBRE_CONYUGE]',
        libroMatrimonio = '[LIBRO_MAT]',
        folioMatrimonio = '[FOLIO_MAT]',
        numeroMatrimonio = '[NUMERO_MAT]',
        fechaExpedicion = '[FECHA_EXPEDICION]'
    } = params;

    return `EL ${fechaNotificacion}, SE RECIBIÓ NOTIFICACIÓN DE MATRIMONIO CELEBRADO EL DÍA ${fechaMatrimonio} EN LA PARROQUIA ${parroquiaMatrimonio}, DIÓCESIS DE ${diocesisMatrimonio}, CON ${nombreConyuge}. REGISTRADO EN EL LIBRO ${libroMatrimonio}, FOLIO ${folioMatrimonio}, NUMERO ${numeroMatrimonio}. LA INFORMACION SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE EXPIDE EN BARRANQUILLA, ATLANTICO - COLOMBIA EL DIA ${fechaExpedicion}...............`;
};