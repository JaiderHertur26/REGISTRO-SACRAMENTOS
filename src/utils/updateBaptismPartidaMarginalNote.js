import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

/**
 * Formats and returns the marginal note string for an annulled baptism partida.
 * 
 * @param {string} baptismPartidaId - The ID of the baptism record (unused in string generation but kept for signature compliance)
 * @param {object} decreeData - Contains { numero, fecha, libro, folio }
 * @param {any} auxiliaryData - Optional auxiliary data
 * @returns {string} The formatted marginal note
 */
export const updateBaptismPartidaMarginalNote = (baptismPartidaId, decreeData, auxiliaryData) => {
    const { numero, fecha, libro, folio } = decreeData;
    
    // Format date: DD DE MMMM DE YYYY (Spanish)
    // convertDateToSpanishText returns "DD DE MES DE AÑO"
    const formattedDate = fecha ? convertDateToSpanishText(fecha).toUpperCase() : '---';
    
    // Ensure book/folio have values
    const bookStr = libro || '---';
    const pageStr = folio || '---';
    const decreeNum = numero || '---';

    const header = "- - - - - - - - - - - - - - - - - NOTA AL MARGEN - - - - - - - - - - - - - - - - - -";
    const body = `SIN NOTA MARGINAL DE MATRIMONIO HASTA LA FECHA. PARTIDA ANULADA POR DECRETO DE CORRECCIÓN DE BAUTISMO EL ${formattedDate}. DECRETO No. ${decreeNum}. LIBRO: ${bookStr} FOLIO: ${pageStr}. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SE PARTE EN BARRANQUILLA, ATLÁNTICO - COLOMBIA. ESTA ACTA REPOSA EN PODER DE DOS NOTARIOS VEINTITRÉS..........................................................`;

    return `${header}\n${body}`;
};