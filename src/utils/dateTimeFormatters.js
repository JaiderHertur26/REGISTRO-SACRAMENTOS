/**
 * Utility functions for converting dates, times, and numbers to Spanish text.
 */

const UNIDADES = ['', 'UN ', 'DOS ', 'TRES ', 'CUATRO ', 'CINCO ', 'SEIS ', 'SIETE ', 'OCHO ', 'NUEVE '];
const DECENAS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DIEZ_A_VEINTINUEVE = ['', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const VEINTE_A_VEINTINUEVE = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS_COMPLETAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO ', 'DOSCIENTOS ', 'TRESCIENTOS ', 'CUATROCIENTOS ', 'QUINIENTOS ', 'SEISCIENTOS ', 'SETECIENTOS ', 'OCHOCIENTOS ', 'NOVECIENTOS '];
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/**
 * Converts a number to its Spanish text representation.
 * Handles numbers up to 9999 (sufficient for years and days).
 * @param {number|string} num 
 * @returns {string} Uppercase Spanish text
 */
export const convertNumberToSpanishText = (num) => {
    let number = parseInt(num, 10);
    if (isNaN(number)) return '';
    if (number === 0) return 'CERO';
    if (number === 100) return 'CIEN';

    let text = '';

    // Thousands
    if (number >= 1000) {
        if (number === 1000) text += 'MIL ';
        else if (number < 2000) text += 'MIL ';
        else {
            text += convertNumberToSpanishText(Math.floor(number / 1000)) + ' MIL ';
        }
        number %= 1000;
    }

    // Hundreds
    if (number >= 100) {
        if (number === 100) text += 'CIENTO ';
        else {
            text += CENTENAS[Math.floor(number / 100)];
        }
        number %= 100;
    }

    // Tens and Units
    if (number > 0) {
        if (number < 10) {
            text += UNIDADES[number];
        } else if (number < 20) {
            text += DECENAS[number - 10] + ' ';
        } else if (number < 30) {
             text += VEINTE_A_VEINTINUEVE[number - 20] + ' ';
        } else {
            text += DECENAS_COMPLETAS[Math.floor(number / 10)];
            if (number % 10 > 0) {
                text += ' Y ' + UNIDADES[number % 10];
            } else {
                text += ' ';
            }
        }
    }

    return text.trim();
};

/**
 * Converts 1-31 to Spanish words (UNO, DOS, TRES, etc.)
 * Used specifically for day numbers in dates.
 * @param {number|string} num 
 * @returns {string}
 */
export const convertNumberToSpanishWords = (num) => {
    const number = parseInt(num, 10);
    if (isNaN(number)) return '';
    if (number === 1) return 'UNO';
    return convertNumberToSpanishText(number);
};

/**
 * Converts 01-12 to Spanish month names (ENERO, FEBRERO, etc.)
 * @param {number|string} monthNum 
 * @returns {string}
 */
export const convertMonthToSpanishWords = (monthNum) => {
    const number = parseInt(monthNum, 10);
    if (isNaN(number) || number < 1 || number > 12) return '';
    return MESES[number - 1];
};

/**
 * Converts years to Spanish words (2026 -> DOS MIL VEINTISÉIS)
 * @param {number|string} year 
 * @returns {string}
 */
export const convertYearToSpanishWords = (year) => {
    return convertNumberToSpanishText(year);
};

/**
 * Converts a date string to Spanish text format.
 * Format: "EL PRIMERO DE MES DE AÑO" (if day is 1)
 * Format: "EL [NUMBER] DE MES DE AÑO" (otherwise)
 * @param {string} dateStr YYYY-MM-DD or DD/MM/YYYY
 * @returns {string} Uppercase Spanish text
 */
export const convertDateToSpanishText = (dateStr) => {
    if (!dateStr) return '______________________';

    let day, month, year;

    if (dateStr.includes('/')) {
        [day, month, year] = dateStr.split('/').map(Number);
    } else if (dateStr.includes('-')) {
        // Handle T part if exists
        const cleanDate = dateStr.split('T')[0];
        [year, month, day] = cleanDate.split('-').map(Number);
    } else {
        return dateStr;
    }

    if (!day || !month || !year) return dateStr;

    let dayText;
    if (day === 1) {
        dayText = 'PRIMERO';
    } else {
        dayText = convertNumberToSpanishText(day);
    }
    
    const monthText = MESES[month - 1];
    const yearText = convertNumberToSpanishText(year);

    return `EL ${dayText} DE ${monthText} DE ${yearText}`;
};

/**
 * Converts a date string to Natural Spanish text format.
 * Format: "El primero de mes de año" (Lowercase except start, handles 'primero' for 1st)
 * @param {string} dateStr YYYY-MM-DD or DD/MM/YYYY
 * @returns {string} Natural Spanish text (e.g., "El primero de julio de dos mil veintidós")
 */
export const convertDateToSpanishTextNatural = (dateStr) => {
    if (!dateStr) return '______________________';

    let day, month, year;

    if (dateStr.includes('/')) {
        [day, month, year] = dateStr.split('/').map(Number);
    } else if (dateStr.includes('-')) {
        const cleanDate = dateStr.split('T')[0];
        [year, month, day] = cleanDate.split('-').map(Number);
    } else {
        return dateStr;
    }

    if (!day || !month || !year) return dateStr;

    let dayText;
    if (day === 1) {
        dayText = 'primero';
    } else {
        dayText = convertNumberToSpanishText(day).toLowerCase().trim();
    }

    const MESES_LOWER = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const monthText = MESES_LOWER[month - 1];
    const yearText = convertNumberToSpanishText(year).toLowerCase().trim();

    return `El ${dayText} de ${monthText} de ${yearText}`;
};


/**
 * Converts a time string to Spanish text.
 * @param {string} timeStr HH:mm
 * @returns {string} Uppercase Spanish text
 */
export const convertTimeToSpanishText = (timeStr) => {
    if (!timeStr) return '';
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    let text = convertNumberToSpanishText(hours);
    
    if (minutes === 0) {
        text += ' EN PUNTO';
    } else if (minutes === 30) {
        text += ' Y TREINTA';
    } else {
        text += ' Y ' + convertNumberToSpanishText(minutes) + ' MINUTOS';
    }
    
    if (hours < 12) text += ' DE LA MAÑANA';
    else if (hours === 12) text += ' DEL MEDIODÍA';
    else text += ' DE LA TARDE'; 

    return text;
};