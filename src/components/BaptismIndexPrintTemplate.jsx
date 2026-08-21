import React, { forwardRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { formatPersonData } from '@/utils/formatPersonData';

const BaptismIndexPrintTemplate = forwardRef(
    ({ data, parroquiaInfo, bookNumber }, ref) => {
        const { user } = useAuth() || {};
        const { getMisDatosList } = useAppData() || {};

        /*
         * ============================================================
         * 1. DATOS BASE
         * ============================================================
         */

        const dataSource = Array.isArray(data) ? data : [];

        /*
         * ============================================================
         * 2. IDENTIDAD SEGURA DE LA PARROQUIA
         * ============================================================
         */

        const getSafeParishId = () => {
            if (user?.parishId) {
                return user.parishId;
            }

            try {
                const storedUser = JSON.parse(
                    localStorage.getItem('user') || '{}'
                );

                return storedUser?.parishId || null;
            } catch (error) {
                console.warn(
                    'No fue posible recuperar parishId desde localStorage.',
                    error
                );

                return null;
            }
        };

        const safeParishId = getSafeParishId();

        /*
         * ============================================================
         * 3. NORMALIZADOR DE TEXTO
         * ============================================================
         */

        const safeText = (value, fallback = '') => {
            if (value === undefined || value === null) {
                return fallback;
            }

            if (typeof value === 'object') {
                return fallback;
            }

            const text = String(value).trim();

            return text !== '' ? text : fallback;
        };

        /*
         * ============================================================
         * 4. BUSCADOR ROBUSTO DEL MEMBRETE
         * ============================================================
         */

        const getOfficialData = (field, fallback = '') => {
            try {
                /*
                 * Primera prioridad:
                 * información recibida directamente por props.
                 */
                if (
                    parroquiaInfo &&
                    parroquiaInfo[field] !== undefined &&
                    parroquiaInfo[field] !== null &&
                    String(parroquiaInfo[field]).trim() !== ''
                ) {
                    return String(parroquiaInfo[field]).trim();
                }

                if (!safeParishId) {
                    return fallback;
                }

                let parishData = null;

                /*
                 * Segunda prioridad:
                 * localStorage.mis_datos
                 */
                const rawGlobal = localStorage.getItem('mis_datos');

                if (rawGlobal) {
                    try {
                        const allRecords = JSON.parse(rawGlobal);

                        if (Array.isArray(allRecords)) {
                            const record = allRecords.find(
                                (item) =>
                                    String(item?.entity_id) ===
                                    String(safeParishId)
                            );

                            if (record?.payload) {
                                parishData = Array.isArray(record.payload)
                                    ? record.payload[0]
                                    : record.payload;
                            }
                        }
                    } catch (storageError) {
                        console.warn(
                            'Error leyendo mis_datos desde localStorage.',
                            storageError
                        );
                    }
                }

                /*
                 * Tercera prioridad:
                 * contexto de la aplicación.
                 */
                if (
                    !parishData &&
                    typeof getMisDatosList === 'function'
                ) {
                    try {
                        const records = getMisDatosList(safeParishId);

                        if (Array.isArray(records) && records.length > 0) {
                            const firstRecord = records[0];

                            parishData =
                                firstRecord?.['0'] ||
                                firstRecord ||
                                null;
                        }
                    } catch (contextError) {
                        console.warn(
                            'Error obteniendo datos parroquiales desde el contexto.',
                            contextError
                        );
                    }
                }

                if (!parishData || typeof parishData !== 'object') {
                    return fallback;
                }

                const normalizedField = String(field).toLowerCase();

                const aliases = {
                    nombre: [
                        'nombre',
                        'nombreParroquia',
                        'nombreparroquia',
                        'nombreCancilleria',
                        'nombre_cancilleria',
                    ],

                    diocesis: [
                        'diocesis',
                        'diócesis',
                        'nombreDiocesis',
                        'nombreDiócesis',
                        'diocesis_name',
                        'dioceseName',
                    ],

                    ciudad: [
                        'ciudad',
                        'municipio',
                        'city',
                    ],

                    region: [
                        'region',
                        'región',
                        'departamento',
                        'department',
                    ],
                };

                const possibleFields =
                    aliases[normalizedField] || [field];

                for (const possibleField of possibleFields) {
                    const value = parishData[possibleField];

                    if (
                        value !== undefined &&
                        value !== null &&
                        String(value).trim() !== ''
                    ) {
                        const cleanValue = String(value).trim();

                        if (
                            cleanValue.toUpperCase() !== 'DESCONOCIDA' &&
                            cleanValue.toUpperCase() !== 'UNKNOWN'
                        ) {
                            return cleanValue;
                        }
                    }
                }
            } catch (error) {
                console.error(
                    'Error leyendo información oficial de la parroquia.',
                    error
                );
            }

            return fallback;
        };

        /*
         * ============================================================
         * 5. INFORMACIÓN OFICIAL DE CABECERA
         * ============================================================
         */

        const diocesis = safeText(
            getOfficialData(
                'diocesis',
                user?.dioceseName || 'DIÓCESIS'
            ),
            'DIÓCESIS'
        ).toUpperCase();

        const nombreParroquia = safeText(
            getOfficialData(
                'nombre',
                user?.parishName || 'PARROQUIA'
            ),
            'PARROQUIA'
        ).toUpperCase();

        const ciudad = safeText(
            getOfficialData('ciudad', '')
        ).toUpperCase();

        const departamento = safeText(
            getOfficialData('region', '')
        ).toUpperCase();

        /*
         * Evita:
         * BARRANQUILLA, ATLÁNTICO, COLOMBIA - COLOMBIA
         */
        const locationParts = [ciudad, departamento].filter(Boolean);

        let ubicacionHeader = locationParts.join(', ');

        if (
            ubicacionHeader &&
            !/\bCOLOMBIA\b/i.test(ubicacionHeader)
        ) {
            ubicacionHeader += ' - COLOMBIA';
        }

        /*
         * ============================================================
         * 6. HELPERS DE CAMPOS
         * ============================================================
         */

        const getField = (record, fields, fallback = '') => {
            for (const field of fields) {
                const value = record?.[field];

                if (
                    value !== undefined &&
                    value !== null &&
                    String(value).trim() !== ''
                ) {
                    return value;
                }
            }

            return fallback;
        };

        const formatPerson = (value, fallback = '---') => {
            const cleanValue = safeText(value, '');

            if (!cleanValue) {
                return fallback;
            }

            try {
                if (typeof formatPersonData === 'function') {
                    const formatted = formatPersonData(cleanValue);

                    return safeText(formatted, fallback);
                }
            } catch (error) {
                console.warn(
                    'Error formateando nombre de persona.',
                    error
                );
            }

            return cleanValue;
        };

        /*
         * ============================================================
         * 7. FORMATEADOR DE REFERENCIAS
         * ============================================================
         *
         * Ejemplos:
         * 1    -> 0001
         * 12   -> 0012
         * 123  -> 0123
         * 1234 -> 1234
         * 12B  -> 12B
         * ---  -> ---
         */

        const formatNumber = (value) => {
            if (
                value === undefined ||
                value === null
            ) {
                return '---';
            }

            const str = String(value).trim();

            if (
                !str ||
                str === '0' ||
                str === '---' ||
                str === '-'
            ) {
                return '---';
            }

            /*
             * Números enteros:
             */
            if (/^\d+$/.test(str)) {
                return str.padStart(4, '0');
            }

            /*
             * Valores alfanuméricos:
             * 12B, 15-A, 23B, etc.
             */
            return str;
        };

        /*
         * ============================================================
         * 8. ORDENAMIENTO ALFABÉTICO ESPAÑOL
         * ============================================================
         */

        const sortedData = useMemo(() => {
            const collator = new Intl.Collator('es-CO', {
                sensitivity: 'base',
                numeric: false,
                ignorePunctuation: true,
            });

            return [...dataSource].sort((a, b) => {
                const apellidosA = safeText(
                    getField(a, [
                        'apellidos',
                        'apellido',
                        'lastName',
                        'apellido1',
                    ]),
                    ''
                );

                const nombresA = safeText(
                    getField(a, [
                        'nombres',
                        'nombre',
                        'firstName',
                    ]),
                    ''
                );

                const apellidosB = safeText(
                    getField(b, [
                        'apellidos',
                        'apellido',
                        'lastName',
                        'apellido1',
                    ]),
                    ''
                );

                const nombresB = safeText(
                    getField(b, [
                        'nombres',
                        'nombre',
                        'firstName',
                    ]),
                    ''
                );

                /*
                 * Primero apellidos.
                 * Si coinciden, nombres.
                 */
                const surnameComparison = collator.compare(
                    apellidosA,
                    apellidosB
                );

                if (surnameComparison !== 0) {
                    return surnameComparison;
                }

                return collator.compare(
                    nombresA,
                    nombresB
                );
            });
        }, [dataSource]);

        /*
         * ============================================================
         * 9. FECHA DE GENERACIÓN
         * ============================================================
         */

        const generatedDate = useMemo(() => {
            try {
                return new Intl.DateTimeFormat('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                }).format(new Date());
            } catch {
                return new Date().toLocaleDateString('es-CO');
            }
        }, []);

        /*
         * ============================================================
         * 10. RENDER
         * ============================================================
         */

        return (
            <div
                ref={ref}
                className="print-container"
            >
                <style type="text/css">
                    {`
                        /*
                         * =====================================================
                         * CONFIGURACIÓN GENERAL
                         * =====================================================
                         */

                        .print-container {
                            width: 100%;
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            color: #000;
                            font-family: Arial, Helvetica, sans-serif;
                            box-sizing: border-box;
                        }

                        .print-container *,
                        .print-container *::before,
                        .print-container *::after {
                            box-sizing: border-box;
                        }

                        /*
                         * =====================================================
                         * CONFIGURACIÓN DE PÁGINA
                         * =====================================================
                         */

                        @page {
                            size: Letter portrait;
                            margin: 15mm;
                        }

                        @media print {
                            html,
                            body {
                                margin: 0 !important;
                                padding: 0 !important;
                                width: 100% !important;
                                background: #fff !important;
                            }

                            body {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }

                            .print-container {
                                width: 100% !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }

                            /*
                             * Repetir cabecera y pie de tabla
                             */
                            .print-table thead {
                                display: table-header-group;
                            }

                            .print-table tfoot {
                                display: table-footer-group;
                            }

                            /*
                             * Evitar que una fila se parta entre páginas
                             */
                            .print-table tr {
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }

                            .print-table td,
                            .print-table th {
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }

                            /*
                             * Evitar que el título quede aislado
                             */
                            .header-cell {
                                page-break-after: avoid !important;
                                break-after: avoid !important;
                            }
                        }

                        /*
                         * =====================================================
                         * TABLA
                         * =====================================================
                         */

                        .print-table {
                            width: 100%;
                            max-width: 100%;
                            border-collapse: collapse;
                            border-spacing: 0;
                            table-layout: fixed;
                            font-size: 9pt;
                        }

                        /*
                         * =====================================================
                         * CABECERA ECLESIÁSTICA
                         * =====================================================
                         */

                        .header-cell {
                            width: 100%;
                            border: none !important;
                            background: #fff !important;
                            padding: 0 0 12px 0 !important;
                            text-align: center;
                        }

                        .print-diocese {
                            margin: 0;
                            padding: 0;
                            font-family: "Times New Roman", Times, serif;
                            font-size: 13pt;
                            font-weight: 700;
                            line-height: 1.2;
                            letter-spacing: 0.8px;
                            text-align: center;
                        }

                        .print-parish {
                            margin: 4px 0 2px 0;
                            padding: 0;
                            font-family: "Times New Roman", Times, serif;
                            font-size: 16pt;
                            font-weight: 900;
                            line-height: 1.15;
                            text-align: center;
                        }

                        .print-location {
                            min-height: 11px;
                            margin: 2px 0 0 0;
                            padding: 0;
                            font-size: 8.5pt;
                            line-height: 1.2;
                            color: #444;
                            text-align: center;
                        }

                        .print-title {
                            margin-top: 12px;
                            padding: 7px 0 7px 0;
                            border-top: 1.5px solid #000;
                            border-bottom: 2px solid #000;
                            font-family: "Times New Roman", Times, serif;
                            font-size: 12pt;
                            font-weight: 700;
                            line-height: 1.2;
                            letter-spacing: 1px;
                            text-align: center;
                        }

                        /*
                         * =====================================================
                         * CABECERA DE COLUMNAS
                         * =====================================================
                         */

                        .header-row th {
                            padding: 7px 4px;
                            border: 1px solid #000;
                            border-top: 2px solid #000;
                            border-bottom: 2px solid #000;
                            background: #eaeaea !important;
                            font-size: 8pt;
                            font-weight: 700;
                            line-height: 1.15;
                            text-align: center;
                            text-transform: uppercase;
                            vertical-align: middle;
                        }

                        /*
                         * =====================================================
                         * CUERPO
                         * =====================================================
                         */

                        .print-table tbody td {
                            padding: 5px 5px;
                            border: 1px solid #555;
                            font-size: 8.5pt;
                            line-height: 1.2;
                            vertical-align: middle;
                            overflow-wrap: break-word;
                            word-break: normal;
                        }

                        /*
                         * Filas alternadas
                         */
                        .print-table tbody tr:nth-child(even) td {
                            background-color: #f8f8f8 !important;
                        }

                        /*
                         * =====================================================
                         * ANCHOS DE COLUMNAS
                         * =====================================================
                         */

                        .col-number {
                            width: 4%;
                            text-align: center;
                            font-size: 8pt !important;
                            font-weight: 700;
                        }

                        .col-titular {
                            width: 33%;
                        }

                        .col-padres {
                            width: 39%;
                            font-size: 8pt !important;
                            color: #222;
                        }

                        .col-ref {
                            width: 8%;
                            text-align: center;
                            font-family: "Courier New", Courier, monospace;
                            font-size: 9pt !important;
                            font-weight: 700;
                            white-space: nowrap;
                        }

                        /*
                         * =====================================================
                         * NOMBRES
                         * =====================================================
                         */

                        .text-bold {
                            margin: 0;
                            padding: 0;
                            color: #000;
                            font-size: 9pt;
                            font-weight: 700;
                            line-height: 1.2;
                        }

                        .text-muted {
                            margin-top: 2px;
                            padding: 0;
                            color: #444;
                            font-size: 8pt;
                            line-height: 1.2;
                        }

                        /*
                         * =====================================================
                         * PADRES
                         * =====================================================
                         */

                        .parent-line {
                            margin: 0;
                            padding: 0;
                            line-height: 1.25;
                        }

                        .parent-line + .parent-line {
                            margin-top: 2px;
                        }

                        .parent-label {
                            font-weight: 700;
                            color: #000;
                        }

                        /*
                         * =====================================================
                         * REGISTRO ANULADO
                         * =====================================================
                         */

                        .row-anulada td {
                            background: #fff0f0 !important;
                            color: #777;
                        }

                        .row-anulada .text-bold {
                            color: #666;
                        }

                        .badge-anulada {
                            display: inline-block;
                            margin-left: 6px;
                            padding: 2px 4px;
                            border-radius: 3px;
                            background: #d32f2f !important;
                            color: #fff !important;
                            font-size: 6pt;
                            font-weight: 700;
                            line-height: 1;
                            vertical-align: middle;
                            white-space: nowrap;
                        }

                        /*
                         * =====================================================
                         * SIN REGISTROS
                         * =====================================================
                         */

                        .empty-row td {
                            height: 100px;
                            padding: 30px !important;
                            color: #888;
                            font-size: 10pt !important;
                            font-style: italic;
                            text-align: center;
                            vertical-align: middle;
                        }

                        /*
                         * =====================================================
                         * PIE
                         * =====================================================
                         */

                        .footer-cell {
                            border: none !important;
                            background: #fff !important;
                            padding: 12px 0 0 0 !important;
                            color: #666 !important;
                            font-size: 7pt !important;
                            font-style: italic;
                            line-height: 1.2;
                            text-align: right !important;
                        }

                        /*
                         * =====================================================
                         * AJUSTES PARA IMPRESIÓN
                         * =====================================================
                         */

                        @media print {
                            .header-row th {
                                background-color: #eaeaea !important;
                            }

                            .print-table tbody tr:nth-child(even) td {
                                background-color: #f8f8f8 !important;
                            }

                            .row-anulada td {
                                background-color: #fff0f0 !important;
                            }

                            .badge-anulada {
                                background-color: #d32f2f !important;
                                color: #fff !important;
                            }
                        }
                    `}
                </style>

                <table className="print-table">
                    {/*
                     * ========================================================
                     * DEFINICIÓN EXPLÍCITA DE ANCHOS
                     * ========================================================
                     */}
                    <colgroup>
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '33%' }} />
                        <col style={{ width: '39%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                    </colgroup>

                    <thead>
                        {/*
                         * ====================================================
                         * MEMBRETE
                         * ====================================================
                         */}
                        <tr>
                            <th
                                colSpan={6}
                                className="header-cell"
                            >
                                <div className="print-diocese">
                                    {diocesis}
                                </div>

                                <div className="print-parish">
                                    {nombreParroquia}
                                </div>

                                <div className="print-location">
                                    {ubicacionHeader || '\u00A0'}
                                </div>

                                <div className="print-title">
                                    ÍNDICE GENERAL DE BAUTISMOS
                                    {bookNumber !== undefined &&
                                    bookNumber !== null &&
                                    String(bookNumber).trim() !== ''
                                        ? ` • LIBRO ${formatNumber(
                                              bookNumber
                                          )}`
                                        : ''}
                                </div>
                            </th>
                        </tr>

                        {/*
                         * ====================================================
                         * ENCABEZADOS DE COLUMNAS
                         * ====================================================
                         */}
                        <tr className="header-row">
                            <th className="col-number">
                                N°
                            </th>

                            <th className="col-titular">
                                APELLIDOS Y NOMBRES
                            </th>

                            <th className="col-padres">
                                PADRES / FILIACIÓN
                            </th>

                            <th className="col-ref">
                                LIBRO
                            </th>

                            <th className="col-ref">
                                FOLIO
                            </th>

                            <th className="col-ref">
                                ACTA
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedData.map((record, index) => {
                            /*
                             * =================================================
                             * IDENTIDAD
                             * =================================================
                             */

                            const apellidos = formatPerson(
                                getField(record, [
                                    'apellidos',
                                    'apellido',
                                    'lastName',
                                    'apellido1',
                                ]),
                                '---'
                            );

                            const nombres = formatPerson(
                                getField(record, [
                                    'nombres',
                                    'nombre',
                                    'firstName',
                                ]),
                                '---'
                            );

                            /*
                             * =================================================
                             * PADRES
                             * =================================================
                             */

                            const padre = formatPerson(
                                getField(record, [
                                    'nombrePadre',
                                    'fatherName',
                                    'padre',
                                    'padreNombre',
                                    'nombre_del_padre',
                                ]),
                                '---'
                            );

                            const madre = formatPerson(
                                getField(record, [
                                    'nombreMadre',
                                    'motherName',
                                    'madre',
                                    'madreNombre',
                                    'nombre_de_la_madre',
                                ]),
                                '---'
                            );

                            /*
                             * =================================================
                             * REFERENCIAS
                             * =================================================
                             */

                            const book = formatNumber(
                                getField(record, [
                                    'Libro',
                                    'libro',
                                    'book_number',
                                    'bookNumber',
                                    'numeroLibro',
                                ])
                            );

                            const page = formatNumber(
                                getField(record, [
                                    'folio',
                                    'Folio',
                                    'page_number',
                                    'pageNumber',
                                ])
                            );

                            const entry = formatNumber(
                                getField(record, [
                                    'numero',
                                    'numeroActa',
                                    'NumeroActa',
                                    'entry_number',
                                    'entryNumber',
                                    'acta',
                                    'numeroRegistro',
                                ])
                            );

                            /*
                             * =================================================
                             * ESTADO
                             * =================================================
                             */

                            const status = safeText(
                                getField(record, [
                                    'status',
                                    'estado',
                                ]),
                                ''
                            ).toLowerCase();

                            const isAnnulled =
                                status === 'anulada' ||
                                status === 'anulado' ||
                                record?.isAnnulled === true ||
                                record?.isAnulada === true;

                            /*
                             * =================================================
                             * ID ESTABLE
                             * =================================================
                             */

                            const rowKey =
                                record?.id ||
                                record?._id ||
                                record?.uuid ||
                                `${apellidos}-${nombres}-${index}`;

                            return (
                                <tr
                                    key={rowKey}
                                    className={
                                        isAnnulled
                                            ? 'row-anulada'
                                            : ''
                                    }
                                >
                                    <td className="col-number">
                                        {index + 1}
                                    </td>

                                    <td className="col-titular">
                                        <div className="text-bold">
                                            {apellidos}

                                            {isAnnulled && (
                                                <span className="badge-anulada">
                                                    ANULADA
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-muted">
                                            {nombres}
                                        </div>
                                    </td>

                                    <td className="col-padres">
                                        <div className="parent-line">
                                            <span className="parent-label">
                                                P:
                                            </span>{' '}
                                            {padre}
                                        </div>

                                        <div className="parent-line">
                                            <span className="parent-label">
                                                M:
                                            </span>{' '}
                                            {madre}
                                        </div>
                                    </td>

                                    <td className="col-ref">
                                        {book}
                                    </td>

                                    <td className="col-ref">
                                        {page}
                                    </td>

                                    <td className="col-ref">
                                        {entry}
                                    </td>
                                </tr>
                            );
                        })}

                        {sortedData.length === 0 && (
                            <tr className="empty-row">
                                <td colSpan={6}>
                                    NO SE ENCONTRARON REGISTROS ASENTADOS
                                    PARA GENERAR EL ÍNDICE
                                </td>
                            </tr>
                        )}
                    </tbody>

                    <tfoot>
                        <tr>
                            <td
                                colSpan={6}
                                className="footer-cell"
                            >
                                Índice generado por el Sistema
                                SacramentumRegistry • {generatedDate}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        );
    }
);

BaptismIndexPrintTemplate.displayName =
    'BaptismIndexPrintTemplate';

export default BaptismIndexPrintTemplate;