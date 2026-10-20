# Emilia — actualización v2

Fecha: 20 de octubre de 2026. Cambios locales, sin commit ni push.

## Funciones portadas

- Implementación de Luis v1.3, documentada en sus fases 2, 4 y 5, adaptada a esta PWA. Sin `AndroidBridge` ni `androidBack`; exportación mediante Blob y descarga JSON.
- Ningún cálculo suma `barWeight`. Se conserva como metadato informativo.
- Parámetro editable `usesBodyweight` por ejercicio. Cuando está activo, carga de sistema = peso corporal + carga externa; una asistencia negativa resta masa. La referencia se etiqueta **5RM total (cuerpo + lastre)** y se convierte desde la unidad del ejercicio.
- `buildSummary()` reconstruye y guarda resúmenes con `calculationVersion: '2.0'`: series, reps, volumen, carga media, intensidad media ponderada por reps, cobertura, intensidad legada de picos, trabajo, potencia, duración, masa corporal, RPE y notas; incluye desglose por ejercicio. Intensidad desconocida = `null`, mostrada como «Sin dato» y cobertura.
- Ajustes permite RPE opcional de 1–10 y notas. Las referencias históricas no se sustituyen por parámetros de otra sesión. Peso/duración históricos tienen procedencia desconocida salvo confirmación explícita.
- Ciclos Lineal Pavel, Escalonado Pavel y Libre, con generación y edición de grupos de series, activación/pausa, tarjeta en sesión, «Plan: …» y carga por ejercicio con conversión kg/lbs. El avance depende de entrenamientos registrados; cada sesión vinculada conserva una copia del plan y referencias. Comparación semanal planeado/real con referencia de intensidad fijada por el plan.
- Hist contiene las nueve gráficas globales de Luis: peso corporal, volumen, intensidad media, series, reps, trabajo, potencia, duración y RPE. Fechas compartidas, bandas de ciclos, ventana de 70 días, scroll horizontal sincronizado, eje Y fijo y cursor común al tocar. Los borradores vacíos se conservan pero no cuentan como entrenamiento.
- Siete fuentes Barlow/Barlow Condensed locales y su licencia OFL en `fonts/`; sin Google Fonts. Fecha con `showPicker()` y fallback nativo. Mini tarjetas con columnas que pueden encogerse y valores que pueden partir línea.

## Identidad y lógica propia conservadas

Se mantienen exactamente nombres, orden y propiedades iniciales de los nueve ejercicios: Peso Muerto Smith, Sentadillas Smith, Press de Pierna, Press en Poleas, Press Militar con Mancuernas, Shrugs Smith, Espalda Alta en Poleas, Remo en Polea y Pantorrilla en Prensa. Sus ROM originales son 0.46, 0.57, 0.5, 0.4, 0.4, 0.15, 0.36, 0.36 y 0.2 m; todos empiezan con 5RM 0, kg, `usesBodyweight: false` y `barWeight: 0`.

Se conservan las etiquetas de equipo, valores iniciales al agregar series (1×5, carga 0), conversión de unidades, temporizador, historial de masa corporal, color `--volt: #FF78B7`, nombre de Emilia y crédito de Luis Cárdenas / Storm Studios. `ASSISTED` permanece vacío, como en el original; no se inventaron ejercicios asistidos. Las cargas negativas funcionan al activar peso corporal y se prueban por separado.

Los meta tags Apple y `manifest.json` permanecen iguales, incluidos icono, `start_url: './index.html'` y scope. El manifest original no declara `id`; no se agregó uno ni se cambió su identidad de instalación.

## Almacenamiento y protección

| Clave | Uso |
|---|---|
| `workoutSessionsEmilia` | Mismo arreglo de sesiones de la app original |
| `workoutRestEmilia` | Mismo descanso en segundos |
| `workoutSessionsEmiliaCycles` | Nueva colección exclusiva de ciclos |
| `workoutSessionsEmilia_respaldo_v2` | Copia previa a la primera migración/escritura |
| `workoutSessionsEmilia_respaldo_importacion_v2` | Copia previa a la primera importación |

El respaldo incluye sesiones y ciclos completos, cadenas originales `rawSessions`/`rawCycles` y descanso. Se crea una sola vez y nunca se reemplaza al recargar. Si no hay espacio para respaldar, la migración se detiene sin escribir el historial. JSON corrupto, cadena vacía o colección estructuralmente inválida producen «Datos protegidos»; nunca se interpretan como historial vacío. Tampoco los sobrescribe el autoguardado.

La normalización extiende los objetos originales y conserva campos adicionales de sesiones, ejercicios, series, configuraciones y resúmenes, así como ejercicios desconocidos. Solo recalcula campos derivados conocidos; mantiene fechas, peso corporal, duración y parámetros de cada sesión.

Exportación: `{schemaVersion: 2, sessions, cycles}`, incluidos cambios actuales en memoria. Importación acepta también el arreglo antiguo y envoltorios compatibles v1; valida antes de escribir, añade fechas nuevas y conserva las existentes ante conflictos. Los ciclos se combinan por identificador. Ante fallos de escritura de las dos colecciones se intenta restaurarlas. localStorage no proporciona una transacción atómica entre claves ante un cierre abrupto; los respaldos permanecen como recuperación.

Service worker: `emilia-workout-v4` → `emilia-workout-v5`; registro `./sw.js?v=5`. ASSETS incluye las siete fuentes y licencia. La limpieza de cachés ahora se limita al prefijo `emilia-workout-`, para conservar las cachés de otras apps del mismo dominio.

## Pruebas

Comando: `node tests/migracion.cjs` — **PASS**. Incluye `tests/regresiones.cjs`, adaptado de las pruebas de Luis a los ejercicios y claves de Emilia. No requiere instalar dependencias.

La prueba principal obtiene el HTML viejo con `git show HEAD:index.html` y ejecuta su script real en Node/vm. Usa sus funciones de carga, ajustes, parámetros, cambio de unidad, agregar/repetir filas y guardado para generar cuatro fechas entrenadas y el borrador inicial. Cada fecha entrenada contiene los nueve ejercicios, dos filas por ejercicio, varias series, kg/lbs alternados, pesos corporales/duraciones distintos y 5RM/ROM editados.

Después inicia el HTML nuevo sobre una copia del mismo localStorage y comprueba todos los campos originales, fechas, orden, series/reps/pesos/unidades, referencias y masa corporal; respaldo exacto incluso a nivel de cadena original; descanso; recarga sin sustituir el respaldo; pantallas de sesión, entrenamiento de los nueve ejercicios, parámetros, Hist, Ajustes y Ciclos. Ejecuta exportación Blob real y el manejador de archivo de importación con FileReader simulado, verificando ida y vuelta de sesiones y ciclos sin pérdida. Comprueba formato antiguo, conflictos, JSON corrupto, estructura inválida y fallos de cuota al respaldar/migrar.

Las regresiones adicionales comprueban métricas/cobertura, masa corporal y asistencia, ausencia de suma de barra incluso forzando `barWeight: 20`, progresión lineal/escalonada, copias del plan, avance sin duplicados, comparación semanal con referencia fija, rollback de importación, extensiones desconocidas, cambios sin guardar exportables, nueve gráficas, huecos, bandas y cursor. El historial de 150 sesiones en un año verifica sincronización de scroll, escala Y estable, gestos y límites de 20/70/71 días. También se verifican cabeceras TTF, ASSETS, identidad del manifest y meta tags Apple.

Revisión adicional en Chrome contra servidor local: carga de sesión, tarjetas, Hist vacío con nueve paneles y pantalla Ciclos; consola sin errores ni advertencias. No sustituye la revisión de disposición y gestos en Safari/iPhone. El servidor de revisión se detuvo al terminar.

## Efecto de quitar la barra

**Cambio numérico en Emilia: cero**, porque los nueve ejercicios originales ya declaran `barWeight: 0`. La prueba compara las métricas originales ejercicio por ejercicio y sesión por sesión: Δ volumen 0 kg·reps, fuerza 0 N, trabajo 0 J, potencia 0 W e intensidad legada 0 puntos porcentuales. Ejemplos generados:

| Fecha | Volumen antes = después (kg·reps) | Trabajo antes = después (J) |
|---|---:|---:|
| 2026-03-01 | 3761.531136 | 12814.012137024001 |
| 2026-06-15 | 3986.42256 | 13843.472065920001 |
| 2026-10-01 | 4933.602432 | 17715.747994560006 |
| 2026-10-19 | 5114.65536 | 18717.358625280005 |

La intensidad media ponderada por reps es una métrica nueva y no debe confundirse con el promedio legado de picos. Donde antes se mostraba cero por falta de referencia ahora se muestra «Sin dato» (`null`); no se modifican pesos ni referencias para obtener esa presentación.

Pendiente de verificar en el iPhone real: actualización instalada desde GitHub Pages, permanencia efectiva de su localStorage, disponibilidad offline, calendario nativo, descarga/importación de archivos y arbitraje táctil/scroll. No se accedió al historial real del alumno, no se publicó nada y no se modificó la app de Luis.
