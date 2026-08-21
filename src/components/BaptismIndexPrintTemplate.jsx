```jsx
import React, { forwardRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { formatPersonData } from '@/utils/formatPersonData';

const BaptismIndexPrintTemplate = forwardRef(
    ({ data, parroquiaInfo, bookNumber }, ref) => {
        const { user } = useAuth() || {};
        const { getMisDatosList } = useAppData() || {};

        /*
         * ================================================================
         * 1. DATOS BASE
         * ================================================================
         */

        const dataSource = Array.isArray(data) ? data : [];

        /*
         * ================================================================
         * 2. IDENTIDAD SEGURA DE LA PARROQUIA
         * ================================================================
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
         * ================================================================
         * 3. HELPERS GENERALES
         * ================================================================
         */

        const sanitizeText = (value, fallback = '---') => {
            if (
                value === undefined ||
                value === null ||
                typeof value === 'object'
            ) {
                return fallback;
            }

            const str = String(value)
                .replace(/[\r\n\t]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (
                !str ||
                str === '---' ||
                str === '-'
            ) {
                return fallback;
            }

            return str.toUpperCase();
        };

        const getField = (
            record,
            fields = [],
            fallback = ''
        ) => {
            const raw = record?.raw_data || {};

            for (const field of fields) {
                const directValue = record?.[field];

                if (
                    directValue !== undefined &&
                    directValue !== null &&
                    String(directValue).trim() !== ''
                ) {
                    return directValue;
                }

                const rawValue = raw?.[field];

                if (
                    rawValue !== undefined &&
                    rawValue !== null &&
                    String(rawValue).trim() !== ''
                ) {
                    return rawValue;
                }
            }

            return fallback;
        };

        /*
         * ================================================================
         * 4. BUSCADOR ROBUSTO DEL MEMBRETE
         * ================================================================
         */

        const getOfficialData = (field, fallback = '') => {
            try {
                /*
                 * Prioridad 1:
                 * parroquiaInfo
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
                 * Prioridad 2:
                 * localStorage
                 */
                const rawGlobal =
                    localStorage.getItem('mis_datos');

                if (rawGlobal) {
                    try {
                        const allRecords =
                            JSON.parse(rawGlobal);

                        if (Array.isArray(allRecords)) {
                            const record = allRecords.find(
                                (item) =>
                                    String(item?.entity_id) ===
                                    String(safeParishId)
                            );

                            if (record?.payload) {
                                parishData = Array.isArray(
                                    record.payload
                                )
                                    ? record.payload[0]
                                    : record.payload;
                            }
                        }
                    } catch (storageError) {
                        console.warn(
                            'Error leyendo mis_datos.',
                            storageError
                        );
                    }
                }

                /*
                 * Prioridad 3:
                 * contexto
                 */
                if (
                    !parishData &&
                    typeof getMisDatosList === 'function'
                ) {
                    try {
                        const records =
                            getMisDatosList(safeParishId);

                        if (
                            Array.isArray(records) &&
                            records.length > 0
                        ) {
                            parishData =
                                records[0]?.['0'] ||
                                records[0] ||
                                null;
                        }
                    } catch (contextError) {
                        console.warn(
                            'Error obteniendo datos parroquiales.',
                            contextError
                        );
                    }
                }

                if (
                    !parishData ||
                    typeof parishData !== 'object'
                ) {
                    return fallback;
                }

                const normalizedField =
                    String(field).toLowerCase();

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
                    const value =
                        parishData?.[possibleField];

                    if (
                        value !== undefined &&
                        value !== null &&
                        String(value).trim() !== ''
                    ) {
                        const cleanValue =
                            String(value).trim();

                        if (
                            cleanValue.toUpperCase() !==
                                'DESCONOCIDA' &&
                            cleanValue.toUpperCase() !==
                                'UNKNOWN'
                        ) {
                            return cleanValue;
                        }
                    }
                }
            } catch (error) {
                console.error(
                    'Error leyendo membrete en Índice:',
                    error
                );
            }

            return fallback;
        };

        /*
         * ================================================================
         * 5. MEMBRETE
         * ================================================================
         */

        const diocesis = sanitizeText(
            getOfficialData(
                'diocesis',
                user?.dioceseName || 'DIÓCESIS'
            ),
            'DIÓCESIS'
        );

        const nombreParroquia = sanitizeText(
            getOfficialData(
                'nombre',
                user?.parishName || 'PARROQUIA'
            ),
            'PARROQUIA'
        );

        const ciudad = sanitizeText(
            getOfficialData('ciudad', ''),
            ''
        );

        const departamento = sanitizeText(
            getOfficialData('region', ''),
            ''
        );

        let ubicacionHeader = [
            ciudad,
            departamento,
        ]
            .filter(Boolean)
            .join(', ');

        if (
            ubicacionHeader &&
            !/\bCOLOMBIA\b/i.test(ubicacionHeader)
        ) {
            ubicacionHeader += ' - COLOMBIA';
        }

        /*
         * ================================================================
         * 6. LIBRO
         * ================================================================
         */

        const formatNumber = (value) => {
            if (
                value === undefined ||
                value === null ||
                value === ''
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
             * Números puros:
             * 1 -> 0001
             * 25 -> 0025
             */
            if (/^\d+$/.test(str)) {
                return str.padStart(4, '0');
            }

            /*
             * Conserva referencias como:
             * 12B
             * 15-A
             * 24 bis
             */
            return str;
        };

        const formattedBookNumber =
            bookNumber !== undefined &&
            bookNumber !== null &&
            String(bookNumber).trim() !== ''
                ? formatNumber(bookNumber)
                : '';

        /*
         * ================================================================
         * 7. ORDEN ALFABÉTICO
         * ================================================================
         */

        const sortedData = [...dataSource].sort(
            (a, b) => {
                const apellidoA = sanitizeText(
                    getField(a, [
                        'apellidos',
                        'apellido',
                        'lastName',
                    ]),
                    ''
                );

                const nombreA = sanitizeText(
                    getField(a, [
                        'nombres',
                        'nombre',
                        'firstName',
                    ]),
                    ''
                );

                const apellidoB = sanitizeText(
                    getField(b, [
                        'apellidos',
                        'apellido',
                        'lastName',
                    ]),
                    ''
                );

                const nombreB = sanitizeText(
                    getField(b, [
                        'nombres',
                        'nombre',
                        'firstName',
                    ]),
                    ''
                );

                const collator = new Intl.Collator(
                    'es-CO',
                    {
                        sensitivity: 'base',
                        ignorePunctuation: true,
                    }
                );

                const surnameResult =
                    collator.compare(
                        apellidoA,
                        apellidoB
                    );

                if (surnameResult !== 0) {
                    return surnameResult;
                }

                return collator.compare(
                    nombreA,
                    nombreB
                );
            }
        );

        /*
         * ================================================================
         * 8. FORMATEO DE PERSONAS
         * ================================================================
         */

        const formatPerson = (value) => {
            const clean = sanitizeText(value, '---');

            if (
                clean === '---' ||
                typeof formatPersonData !== 'function'
            ) {
                return clean;
            }

            try {
                return sanitizeText(
                    formatPersonData(clean),
                    '---'
                );
            } catch {
                return clean;
            }
        };

        /*
         * ================================================================
         * 9. PADRES
         * ================================================================
         */

        const getParentName = (
            record,
            type
        ) => {
            if (type === 'father') {
                return getField(record, [
                    'nombre_padre',
                    'nombrePadre',
                    'padre',
                    'fatherName',
                    'father_name',
                    'padreNombre',
                ]);
            }

            return getField(record, [
                'nombre_madre',
                'nombreMadre',
                'madre',
                'motherName',
                'mother_name',
                'madreNombre',
            ]);
        };

        /*
         * ================================================================
         * 10. FECHA
         * ================================================================
         */

        const generatedDate =
            new Intl.DateTimeFormat('es-CO', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }).format(new Date());

        /*
         * ================================================================
         * 11. RENDER
         * ================================================================
         */

        return (
            <div
                ref={ref}
                className="print-container"
            >
                <style type="text/css">
                    {`
                        /*
                         * ==================================================
                         * RESET
                         * ==================================================
                         */

                        .print-container,
                        .print-container * {
                            box-sizing: border-box;
                        }

                        .print-container {
                            width: 100%;
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            color: #000;
                        }

                        /*
                         * ==================================================
                         * PÁGINA
                         * ==================================================
                         */

                        @page {
                            size: Letter portrait;
                            margin: 10mm 11mm 11mm 11mm;
                        }

                        @media print {
                            html,
                            body {
                                margin: 0 !important;
                                padding: 0 !important;
                                background: #fff !important;
                                overflow: visible !important;
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

                            .print-table {
                                page-break-inside: auto;
                            }

                            .print-table thead {
                                display: table-header-group;
                            }

                            .print-table tfoot {
                                display: table-footer-group;
                            }

                            .print-table tr {
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }

                            .print-table td,
                            .print-table th {
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }
                        }

                        /*
                         * ==================================================
                         * MEMBRETE
                         * ==================================================
                         */

                        .print-header-cell {
                            border: none !important;
                            padding: 0 0 9px 0 !important;
                            background: #fff !important;
                        }

                        .institution-header {
                            position: relative;
                            width: 100%;
                            padding: 1px 0 9px 0;
                            text-align: center;
                        }

                        /*
                         * Pequeño elemento ornamental.
                         * Sobrio para conservar apariencia de documento
                         * eclesiástico oficial.
                         */

                        .header-ornament {
                            display: block;
                            margin: 0 auto 4px auto;
                            color: #222;
                            font-family:
                                "Times New Roman",
                                Times,
                                serif;
                            font-size: 10px;
                            line-height: 1;
                        }

                        .print-diocese {
                            margin: 0;
                            font-family:
                                "Times New Roman",
                                Times,
                                serif;
                            font-size: 12pt;
                            font-weight: 700;
                            letter-spacing: 1.4px;
                            line-height: 1.15;
                            text-transform: uppercase;
                        }

                        .print-parish {
                            margin: 3px 0 2px 0;
                            font-family:
                                "Times New Roman",
                                Times,
                                serif;
                            font-size: 15pt;
                            font-weight: 900;
                            letter-spacing: 0.25px;
                            line-height: 1.12;
                            text-transform: uppercase;
                        }

                        .print-location {
                            margin-top: 3px;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 7.8pt;
                            font-weight: 500;
                            letter-spacing: 0.45px;
                            line-height: 1.15;
                            color: #333;
                            text-transform: uppercase;
                        }

                        /*
                         * Línea institucional doble
                         */

                        .header-rule {
                            width: 92%;
                            height: 5px;
                            margin: 8px auto 6px auto;
                            border-top: 1.5px solid #000;
                            border-bottom: 1px solid #000;
                        }

                        .print-title {
                            margin-top: 2px;
                            font-family:
                                "Times New Roman",
                                Times,
                                serif;
                            font-size: 11pt;
                            font-weight: 700;
                            letter-spacing: 1.2px;
                            line-height: 1.2;
                            text-transform: uppercase;
                        }

                        .print-book {
                            font-weight: 900;
                        }

                        /*
                         * ==================================================
                         * TABLA
                         * ==================================================
                         */

                        .print-table {
                            width: 100%;
                            max-width: 100%;
                            table-layout: fixed;
                            border-collapse: collapse;
                            border-spacing: 0;
                            border: 1.5px solid #000;
                            font-family:
                                Arial,
                                Helvetica,
                                sans-serif;
                            font-size: 8pt;
                        }

                        /*
                         * ==================================================
                         * COLUMNAS
                         * ==================================================
                         */

                        .col-number {
                            width: 4%;
                            text-align: center;
                        }

                        .col-titular {
                            width: 32%;
                        }

                        .col-padres {
                            width: 41.5%;
                        }

                        .col-ref {
                            width: 7.5%;
                            text-align: center;
                        }

                        /*
                         * ==================================================
                         * CABECERA DE TABLA
                         * ==================================================
                         */

                        .header-row th {
                            padding: 6px 4px;
                            border: 1px solid #000 !important;
                            border-top: 2px solid #000 !important;
                            border-bottom: 2px solid #000 !important;
                            background: #e7e7e7 !important;
                            color: #000;
                            font-family:
                                Arial,
                                Helvetica,
                                sans-serif;
                            font-size: 7.3pt;
                            font-weight: 900;
                            letter-spacing: 0.2px;
                            line-height: 1.1;
                            text-align: center;
                            text-transform: uppercase;
                            vertical-align: middle;
                            white-space: nowrap;
                        }

                        /*
                         * ==================================================
                         * CUERPO
                         * ==================================================
                         */

                        .print-table tbody td {
                            padding: 4.5px 5px;
                            border: 1px solid #555 !important;
                            background: #fff;
                            color: #000;
                            font-size: 7.8pt;
                            line-height: 1.15;
                            vertical-align: middle;
                            overflow-wrap: break-word;
                            word-break: normal;
                        }

                        .print-table tbody tr:nth-child(even) td {
                            background: #f7f7f7 !important;
                        }

                        /*
                         * ==================================================
                         * NÚMERO
                         * ==================================================
                         */

                        .col-number {
                            font-family:
                                Arial,
                                Helvetica,
                                sans-serif;
                            font-size: 7.5pt !important;
                            font-weight: 700;
                            text-align: center;
                        }

                        /*
                         * ==================================================
                         * TITULAR
                         * ==================================================
                         */

                        .text-bold {
                            margin: 0;
                            color: #000;
                            font-size: 8.2pt;
                            font-weight: 900;
                            line-height: 1.12;
                        }

                        .text-muted {
                            margin-top: 2px;
                            color: #333;
                            font-size: 7.4pt;
                            font-weight: 500;
                            line-height: 1.1;
                        }

                        /*
                         * ==================================================
                         * PADRES
                         * ==================================================
                         */

                        .col-padres {
                            font-size: 7.15pt !important;
                            line-height: 1.15 !important;
                        }

                        .parent-line {
                            margin: 0;
                            padding: 0;
                            line-height: 1.2;
                        }

                        .parent-line + .parent-line {
                            margin-top: 2px;
                        }

                        .parent-label {
                            font-weight: 900;
                            color: #000;
                        }

                        /*
                         * ==================================================
                         * LIBRO / FOLIO / ACTA
                         * ==================================================
                         */

                        .col-ref {
                            font-family:
                                "Courier New",
                                Courier,
                                monospace;
                            font-size: 8.2pt !important;
                            font-weight: 700;
                            text-align: center;
                            white-space: nowrap;
                            letter-spacing: 0.1px;
                        }

                        /*
                         * ==================================================
                         * ANULADOS
                         * ==================================================
                         */

                        .row-anulada td {
                            background: #f4eeee !important;
                            color: #555;
                        }

                        .row-anulada .text-bold {
                            color: #444;
                        }

                        .badge-anulada {
                            display: inline-block;
                            margin-left: 5px;
                            padding: 1.5px 4px;
                            border: 1px solid #555;
                            border-radius: 2px;
                            background: #333 !important;
                            color: #fff !important;
                            font-family:
                                Arial,
                                Helvetica,
                                sans-serif;
                            font-size: 5pt;
                            font-weight: 900;
                            letter-spacing: 0.4px;
                            line-height: 1;
                            vertical-align: middle;
                            white-space: nowrap;
                        }

                        /*
                         * ==================================================
                         * SIN REGISTROS
                         * ==================================================
                         */

                        .empty-row td {
                            padding: 35px 20px !important;
                            color: #777 !important;
                            font-family:
                                "Times New Roman",
                                Times,
                                serif;
                            font-size: 10pt !important;
                            font-style: italic;
                            text-align: center;
                        }

                        /*
                         * ==================================================
                         * PIE
                         * ==================================================
                         */

                        .footer-cell {
                            border: none !important;
                            background: #fff !important;
                            padding: 7px 0 0 0 !important;
                            color: #666 !important;
                            font-family:
                                "Times New Roman",
                                Times,
                                serif;
                            font-size: 6.3pt !important;
                            font-style: italic;
                            line-height: 1.2;
                            text-align: right !important;
                        }

                        /*
                         * ==================================================
                         * ACABADO DE IMPRESIÓN
                         * ==================================================
                         */

                        @media print {
                            .header-row th {
                                background-color: #e7e7e7 !important;
                            }

                            .print-table tbody tr:nth-child(even) td {
                                background-color: #f7f7f7 !important;
                            }

                            .row-anulada td {
                                background-color: #f4eeee !important;
                            }

                            .badge-anulada {
                                background-color: #333 !important;
                                color: #fff !important;
                            }
                        }
                    `}
                </style>

                <table className="print-table">

                    {/*
                     * ======================================================
                     * CONTROL ABSOLUTO DE ANCHOS
                     * ======================================================
                     */}

                    <colgroup>
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '41.5%' }} />
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '7.5%' }} />
                    </colgroup>

                    <thead>

                        {/*
                         * ==================================================
                         * MEMBRETE
                         *
                         * Al estar dentro de THEAD, se repetirá al
                         * cambiar de página durante la impresión.
                         * ==================================================
                         */}

                        <tr>
                            <th
                                colSpan={6}
                                className="print-header-cell"
                            >
                                <div className="institution-header">

                                    <div className="header-ornament">
                                        ✦
                                    </div>

                                    <div className="print-diocese">
                                        {diocesis}
                                    </div>

                                    <div className="print-parish">
                                        {nombreParroquia}
                                    </div>

                                    {ubicacionHeader && (
                                        <div className="print-location">
                                            {ubicacionHeader}
                                        </div>
                                    )}

                                    <div className="header-rule" />

                                    <div className="print-title">
                                        ÍNDICE GENERAL DE BAUTISMOS

                                        {formattedBookNumber && (
                                            <>
                                                {' '}
                                                <span>
                                                    •
                                                </span>{' '}
                                                <span className="print-book">
                                                    LIBRO{' '}
                                                    {
                                                        formattedBookNumber
                                                    }
                                                </span>
                                            </>
                                        )}
                                    </div>

                                </div>
                            </th>
                        </tr>

                        {/*
                         * ==================================================
                         * ENCABEZADOS
                         * ==================================================
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

                        {sortedData.map(
                            (record, index) => {

                                /*
                                 * ==========================================
                                 * PERSONA
                                 * ==========================================
                                 */

                                const apellidos =
                                    formatPerson(
                                        getField(record, [
                                            'apellidos',
                                            'apellido',
                                            'lastName',
                                        ])
                                    );

                                const nombres =
                                    formatPerson(
                                        getField(record, [
                                            'nombres',
                                            'nombre',
                                            'firstName',
                                        ])
                                    );

                                /*
                                 * ==========================================
                                 * PADRES
                                 * ==========================================
                                 */

                                const padre =
                                    formatPerson(
                                        getParentName(
                                            record,
                                            'father'
                                        )
                                    );

                                const madre =
                                    formatPerson(
                                        getParentName(
                                            record,
                                            'mother'
                                        )
                                    );

                                /*
                                 * ==========================================
                                 * REFERENCIAS
                                 * ==========================================
                                 */

                                const book =
                                    formatNumber(
                                        getField(
                                            record,
                                            [
                                                'book_number',
                                                'bookNumber',
                                                'Libro',
                                                'libro',
                                                'numeroLibro',
                                            ]
                                        )
                                    );

                                const page =
                                    formatNumber(
                                        getField(
                                            record,
                                            [
                                                'folio',
                                                'Folio',
                                                'page_number',
                                                'pageNumber',
                                            ]
                                        )
                                    );

                                const entry =
                                    formatNumber(
                                        getField(
                                            record,
                                            [
                                                'number',
                                                'numero',
                                                'numeroActa',
                                                'NumeroActa',
                                                'entry_number',
                                                'entryNumber',
                                                'acta',
                                            ]
                                        )
                                    );

                                /*
                                 * ==========================================
                                 * ESTADO
                                 * ==========================================
                                 */

                                const status =
                                    sanitizeText(
                                        getField(
                                            record,
                                            [
                                                'status',
                                                'estado',
                                            ]
                                        ),
                                        ''
                                    ).toLowerCase();

                                const isAnulada =
                                    status ===
                                        'anulada' ||
                                    status ===
                                        'anulado' ||
                                    record?.isAnnulled ===
                                        true ||
                                    record?.isAnulada ===
                                        true ||
                                    record?.raw_data
                                        ?.isAnnulled ===
                                        true ||
                                    String(
                                        record?.raw_data
                                            ?.estado || ''
                                    ).toLowerCase() ===
                                        'anulada';

                                /*
                                 * ==========================================
                                 * KEY
                                 * ==========================================
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
                                            isAnulada
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

                                                {isAnulada && (
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
                            }
                        )}

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
                                Índice generado oficialmente por
                                el Sistema Eclesia Digital •{' '}
                                {generatedDate}
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
```
