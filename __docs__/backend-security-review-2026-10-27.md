# Refuerzo de seguridad — 27 de octubre de 2026

## Alcance y evidencia

Revisión de código, configuración, dependencias y regresiones sobre NestJS 12 / Express 5. Se mantienen las correcciones documentadas en `backend-security-review-2026-10-14.md`. No se realizó pentest contra un servicio desplegado ni se verificaron proveedores, firewall, secretos, backups o infraestructura de producción. Cero alertas de dependencias conocidas no equivale a ausencia absoluta de vulnerabilidades.

## Hallazgos y cambios

| Hallazgo verificable | Corrección | Verificación |
| --- | --- | --- |
| `body-parser@2.3.0` vulnerable; 21 alertas iniciales entre producción y herramientas; una auditoría posterior también detectó un aviso moderado de qs | Actualización compatible del lockfile a `body-parser@2.4.0`, `fast-uri@3.1.9` y demás transitivas corregidas, sin agregar overrides; se actualizó el pin existente de `qs` a 6.16.1 | Auditorías completas y de producción |
| La autenticación dependía de decorar cada ruta | Guard JWT global; rutas públicas explícitas (incluidas FAQ y contacto informativo existentes); autenticación de sesión se ejecuta una sola vez | Pruebas HTTP de ruta sin decoradores, JWT expirado, firma y algoritmo incorrectos |
| JWT solo exigía un secreto no vacío y no validaba las formas de los identificadores antes de consultar | Secreto de al menos 32 bytes, rechazo de ejemplos conocidos, HS256 explícito, UUIDs de usuario y sesión | Pruebas de configuración y estrategia |
| Sesiones de tratamiento comprobaban clínica pero no acceso al paciente ni permiso clínico | Lectura condicionada al acceso al paciente; escritura requiere además `canManageClinical`; se comprueban origen y destino de reasociaciones | E2E con especialista no asignado, asignado, permiso revocado y membresía inactiva |
| Listados clínicos cargaban registros antes de filtrar y capturaban todos los errores | Filtrado de clínica/asignación en SQL antes de paginar y contar | E2E de conteos autorizados |
| Listados generales sin límites | Paginación estable con 30 registros por defecto, máximo 100 | E2E sobre los ocho endpoints |
| Se aceptaba cualquier ZIP u OLE como Word | Detección DOCX con `file-type`; DOC requiere contenedor CFB con stream WordDocument, identificador binario y tabla Word | Archivos DOC/DOCX de prueba; rechazo ZIP, OLE genérico y archivo truncado |
| Contraseñas nuevas desde seis caracteres | Mínimo 15 caracteres sin composición obligatoria, máximo 72 bytes UTF-8 | Registro, login heredado, cambio, reset y caracteres multibyte |
| Configuración HTTP duplicada y pruebas sin los controles de producción | Función compartida `configureHttp`, un parser por tipo de contenido, límites explícitos, validación y errores comunes | Pruebas HTTP y E2E con la misma configuración |
| Errores de parser de tamaño acababan como 500 | Traducción acotada de errores conocidos a 400/413/415, sin devolver contenido enviado | Pruebas de cuerpo demasiado grande y JSON malformado |
| Multipart sin límites de cantidad | Un archivo, diez campos y once partes; nombres generados con UUID | Pruebas de exceso de archivos/campos y limpieza |

Los webhooks de PayPal y Google Drive están exentos exclusivamente de JWT: mantienen la comprobación de firma del proveedor o token del canal. Los documentos siguen requiriendo permisos para descarga y no se sirven como archivos clínicos estáticos públicos. La detección de formato no es un antivirus ni una validación completa de la integridad o del contenido activo del documento.

## Cambios para el frontend

Los siguientes GET generales ahora devuelven `{ items, total, limit, offset }` en lugar de arrays:

- `/api/appointments`
- `/api/invoices`
- `/api/payments`
- `/api/expenses`
- `/api/clinical-records`
- `/api/clinical-notes`
- `/api/treatments`
- `/api/treatment-sessions`

Enviar `?limit=30&offset=0`; `limit` debe ser un entero de 1 a 100 y `offset` un entero no negativo. El conteo respeta autorización. Los contratos de agenda especializada, reportes, exportaciones y archivos por paciente se conservan. Esta paginación limita registros principales; no impone un límite independiente a cada relación anidada.

Registro, cambio y recuperación deben aceptar frases de al menos 15 caracteres y como máximo 72 bytes UTF-8. Login y comprobación de la contraseña actual conservan compatibilidad con contraseñas anteriores, incluidas las Unicode que bcrypt históricamente truncó. No se fuerza cambio ni se recalculan hashes existentes. Nuevas contraseñas no se truncan. Los tokens conservan su duración de dos horas y requieren una sesión activa.

Las escrituras sobre sesiones de tratamiento pueden devolver ahora 403 para miembros sin `canManageClinical` o sin acceso al paciente; pertenecer a la clínica no basta. Las URLs y tipos de recursos permanecen iguales.

Swagger/OpenAPI reflejan autenticación por defecto y operaciones públicas con `security: []`. Postman se regenera desde ese contrato.

## Configuración y despliegue

- Configurar un `JWT_SECRET` aleatorio de al menos 32 bytes; generar con `openssl rand -hex 32`. `.env.example` no incluye un secreto reutilizable. Longitud no demuestra entropía. No se rotó ni editó el secreto existente. Si hay que cambiarlo, los tokens anteriores dejarán de validar y habrá que iniciar sesión de nuevo.
- Definir `NODE_ENV=production`. Los valores admitidos son development/test/production; puertos, límites y booleanos explícitos inválidos hacen fallar el arranque.
- Seed y exposición de OTP no pueden habilitarse en producción. Swagger sigue deshabilitado por defecto en producción; `ENABLE_SWAGGER=false` también se respeta en desarrollo.
- CORS usa orígenes HTTP(S) exactos, sin rutas, credenciales, comodines ni barra final. En producción una lista vacía no aprueba ningún origen de navegador. CORS no sustituye autenticación ni restringe clientes HTTP sin Origin.
- Proxy sin confianza por defecto (`TRUST_PROXY_HOPS=0`). Configurar los saltos reales únicamente tras verificar la cadena de proxies y los encabezados en staging.
- Límites HTTP: JSON 1 MiB, URL encoded 256 KiB y 100 parámetros; `BODY_JSON_LIMIT` y `BODY_URLENCODED_LIMIT` aceptan tamaños positivos en b/kb/mb. Se admiten booleanos true/false, yes/no y 1/0.
- PostgreSQL sigue requiriendo TLS verificado y credenciales explícitas en producción; schema synchronization permanece deshabilitado allí. No hay migraciones nuevas ni cambios de esquema en esta entrega.
- El throttler conserva sus límites actuales y almacenamiento por proceso. Antes de desplegar varias instancias se requiere un gateway con límite compartido o almacenamiento compartido. No se agregó Redis sin una arquitectura de despliegue definida.
- Conservar claves de cifrado de Google Drive, configuración canónica de HOST_API y migraciones anteriores. El almacenamiento local no sustituye almacenamiento persistente ni backups.

## Pruebas y ejecución segura

`pnpm test:e2e:isolated` crea un proyecto Docker único, PostgreSQL 18.6 en almacenamiento temporal, puerto local aleatorio y credenciales aleatorias. Cada suite comienza con un esquema vacío; se elimina el contenedor al finalizar. No utiliza ni modifica la base configurada en `.env`. Los E2E rechazan ejecutarse fuera de ese entorno aislado. El seed se invoca como preparación interna del test, sin debilitar su endpoint protegido.

Las integraciones externas se simulan donde corresponde: Google OAuth/Drive y PayPal no se prueban con cuentas reales. La suite clínica simula solo el adaptador de almacenamiento externo, conservando autorización y persistencia del backend. Las pruebas anteriores estaban desalineadas con el OAuth state, los enlaces de descarga autenticados y la validación de imágenes; se actualizaron los fixtures y expectativas.

Comandos de aceptación: `pnpm lint`, TypeScript con `tsconfig.eslint.json`, `pnpm build`, `pnpm test --runInBand`, `pnpm test:e2e:isolated`, `pnpm test:database-config`, `pnpm test:migrations`, `pnpm postman:check --source __docs__/openapi.json`, `pnpm audit` y `pnpm audit --prod`.

## Referencias

- [Autenticación global NestJS](https://docs.nestjs.com/security/authentication)
- [Validación NestJS](https://docs.nestjs.com/techniques/validation)
- [Límites de peticiones y despliegue distribuido](https://docs.nestjs.com/security/rate-limiting)
- [Aviso body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828)
- [Detección file-type y limitaciones](https://github.com/sindresorhus/file-type)
- [CFB: lectura de contenedores binarios](https://github.com/SheetJS/js-cfb)

## Resultados registrados

- Lint, build y TypeScript de aplicación y E2E sin errores.
- 38 suites unitarias/HTTP: 243 tests aprobados.
- 11 suites E2E, 61 tests aprobados, sobre PostgreSQL desechable; se incluyen permisos, paginación y rutas informativas públicas.
- 5 tests de configuración de base de datos y 6 de migraciones aprobados.
- OpenAPI exportado y Postman generado y comprobado desde el archivo local.
- Auditoría completa y de producción: cero alertas conocidas tras actualizar el pin existente de qs a 6.16.1. No quedan alertas pendientes reportadas por npm en esta ejecución.
