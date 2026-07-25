const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DECENAS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const VEINTIS = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS_COMPLETAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export const convertirAñoALetras = (año) => {
    const year = parseInt(año, 10);
    if (isNaN(year)) return '';
    if (year === 2000) return 'DOS MIL';
    
    let text = '';
    if (year >= 2000) {
        text += 'DOS MIL ';
        const resto = year % 2000;
        if (resto > 0) {
            if (resto < 10) text += UNIDADES[resto];
            else if (resto < 20) text += DECENAS[resto - 10];
            else if (resto < 30) text += VEINTIS[resto - 20];
            else {
                const dec = Math.floor(resto / 10);
                const uni = resto % 10;
                text += DECENAS_COMPLETAS[dec];
                if (uni > 0) text += ' Y ' + UNIDADES[uni];
            }
        }
    } else if (year >= 1900) {
        text += 'MIL NOVECIENTOS ';
        const resto = year % 1900;
        if (resto > 0) {
             if (resto < 10) text += UNIDADES[resto];
            else if (resto < 20) text += DECENAS[resto - 10];
            else if (resto < 30) text += VEINTIS[resto - 20];
            else {
                const dec = Math.floor(resto / 10);
                const uni = resto % 10;
                text += DECENAS_COMPLETAS[dec];
                if (uni > 0) text += ' Y ' + UNIDADES[uni];
            }
        }
    } else {
        text = year.toString(); // Fallback
    }
    return text.trim();
};

const convertirDiaALetras = (dia) => {
    const d = parseInt(dia, 10);
    if (d === 1) return 'UNO'; // Corrected from PRIMERO to UNO for standard date reading
    if (d < 10) return UNIDADES[d];
    if (d < 20) return DECENAS[d - 10];
    if (d < 30) return VEINTIS[d - 20];
    const dec = Math.floor(d / 10);
    const uni = d % 10;
    if (uni === 0) return DECENAS_COMPLETAS[dec];
    return DECENAS_COMPLETAS[dec] + ' Y ' + UNIDADES[uni];
};

export const convertirFechaALetras = (fechaStr) => {
    if (!fechaStr) return '';
    try {
        let datePart = fechaStr;
        if (fechaStr instanceof Date) {
            datePart = fechaStr.toISOString().split('T')[0];
        } else if (typeof fechaStr === 'string' && fechaStr.includes('T')) {
            datePart = fechaStr.split('T')[0];
        }
        
        let year, month, day;
        
        if (datePart.includes('-')) {
            [year, month, day] = datePart.split('-');
        } else if (datePart.includes('/')) {
            [day, month, year] = datePart.split('/');
        } else {
            return fechaStr;
        }

        const diaLetras = convertirDiaALetras(day);
        const mesLetras = MESES[parseInt(month, 10) - 1];
        const añoLetras = convertirAñoALetras(year);

        if (!diaLetras || !mesLetras || !añoLetras) return fechaStr;

        return `${diaLetras} DE ${mesLetras} DE ${añoLetras}`;
    } catch (e) {
        return typeof fechaStr === 'string' ? fechaStr : '';
    }
};