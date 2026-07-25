# Plan de Prueba de Integración: Normalización de Datos de Bautismo

## 1. Objetivo
Verificar que los datos de partidas de bautismo provenientes de diferentes fuentes (importación JSON y creación manual "Sentar Registros") se impriman correctamente utilizando una estructura de datos normalizada, evitando errores de campos faltantes o claves incompatibles.

## 2. Descripción del Problema Original
El componente de impresión (`BaptismPrintTemplate.jsx`) esperaba claves específicas en español (ej. `fechaBautismo`, `nombrePadre`), mientras que los datos guardados en la base de datos (localStorage) utilizaban claves en inglés (ej. `sacramentDate`, `fatherName`) o formatos mixtos provenientes de importaciones JSON antiguas. Esto causaba que los campos aparecieran vacíos ("---") al imprimir.

## 3. Solución Implementada
Se implementó una capa de normalización (`src/utils/baptismDataNormalizer.js`) que actúa como adaptador antes de la impresión.
- **Entrada:** Objeto de registro raw (con claves mixtas).
- **Proceso:** Mapeo de claves, formateo de fechas, conversión de arrays a strings.
- **Salida:** Objeto estandarizado listo para `BaptismPrintTemplate`.

## 4. Pasos de Prueba Manual

### Caso A: Verificar Datos Existentes (Importados/JSON)
1. Inicie sesión como usuario de parroquia.
2. Navegue a **Partidas > Bautismo**.
3. Seleccione un registro antiguo (probablemente importado de JSON).
4. Haga clic en el icono de **Impresión** (impresora amarilla).
5. **Verificación en Pantalla:**
   - ¿Aparece el modal de opciones de impresión?
   - ¿Aparece alguna advertencia amarilla de "Datos incompletos"? (Si faltan datos críticos).
6. Haga clic en "Imprimir".
7. **Verificación en Vista Previa de Impresión:**
   - Verifique que la fecha de bautismo NO sea "---" ni `undefined`.
   - Verifique que los nombres de los padres aparezcan correctamente.
   - Verifique que los padrinos aparezcan como lista de texto, no como `[object Object]`.

### Caso B: Verificar Nuevos Registros ("Sentar Registros")
1. Navegue a **Sentar Registros > Bautismo**.
2. Complete un registro manualmente con datos de prueba.
3. Guarde el registro ("Registrar").
4. Vaya a **Partidas > Bautismo** y busque el registro recién creado.
5. Seleccione el registro.
6. Haga clic en el botón "Debug Datos" (si está visible en desarrollo) y verifique:
   - Que `Raw Data` tenga claves en inglés (`firstName`, `sacramentDate`).
   - Que `Normalized Data` tenga claves en español (`nombres`, `fechaBautismo`).
7. Haga clic en Imprimir.
8. Verifique que los datos se mapeen correctamente en la hoja impresa.

## 5. Checklist de Validación Técnica

- [ ] **Fechas:** Se convierten correctamente de `YYYY-MM-DD` a texto español o formato legible.
- [ ] **Padrinos:** Si el origen es un array `[{name: 'Juan'}]`, se imprime como "Juan". Si es string "Juan", se imprime "Juan".
- [ ] **Sexo:** Se normaliza a "MASCULINO" / "FEMENINO" independientemente de si la entrada es "1", "M", o "Masculino".
- [ ] **Errores:** Si el objeto de datos es `null`, la aplicación no se rompe (pantalla blanca), sino que muestra campos vacíos o error controlado.

## 6. Debugging
Si los datos siguen sin aparecer:
1. Abra la consola del navegador (F12).
2. Busque los logs "Normalizing Baptism Data (Input)" y "(Output)".
3. Compare el Output con los props esperados en `BaptismPrintTemplate.jsx`.
4. Si el Output tiene el dato correcto pero no se imprime, revise si `BaptismPrintTemplate` está recibiendo el prop correctamente o si tiene un error de estilo CSS (ej. texto blanco sobre blanco).