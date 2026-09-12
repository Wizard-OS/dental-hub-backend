# Contratos de membresía — implementación completa

Todos los paths tienen prefijo `/api`. Se requiere `Authorization: Bearer <token>`, `x-clinic-id`, rol owner/admin y permiso `manageClinic`. `GET /membership/current` conserva sus permisos anteriores.

## Flujo de las seis pantallas

| Acción | Método y path | Entrada principal |
|---|---|---|
| Presentación / elegir plan | `GET /membership/plans` | — |
| Cotización / aplicar o quitar promoción | `POST /membership/quote` | `interval`, `promotionCode?` |
| Listar promociones | `GET /membership/promotions?interval=yearly` | Intervalo |
| Listar tarjeta / PayPal guardados | `GET /membership/payment-methods` | — |
| Añadir método | `POST /membership/payment-methods/setup` | `type: card\|paypal`, `requestId` UUID |
| Confirmar tokenización/autorización | `POST /membership/payment-methods/setup/:id/confirm` | ID local de sesión; sin body |
| Confirmar método seleccionado | `PATCH /membership/payment-methods/default` | `paymentMethodId` UUID |
| Eliminar método | `DELETE /membership/payment-methods/:id` | ID local de método |
| Iniciar membresía | `POST /membership/start` | Ver ejemplo |
| Éxito / gestión | `GET /membership/current` | — |
| Restaurar / sincronizar compras | `POST /membership/restore` | Sin body |
| Confirmar una suscripción concreta | `POST /membership/confirm` | `providerSubscriptionId` |
| Cancelar | `POST /membership/cancel` | Sin body |
| Historial de cobros | `GET /membership/charges` | — |
| Reintentar cobro fallido | `POST /membership/charges/:id/retry` | Sin body |
| Recuperar orden conocida / confirmar acción del pagador | `POST /membership/charges/:id/reconcile` | `providerOrderId` |
| Estado de configuración | `GET /membership/readiness` | — |

También se puede usar `POST /billing/checkout` con `planCode: "premium"` y los campos de inicio siguientes. Si se omite `paymentMethodId`, ese endpoint conserva el checkout alojado legacy de PayPal.

### Añadir y seleccionar métodos

1. Crear una sesión con `type` y un UUID nuevo en `requestId`. La respuesta incluye `setupSessionId`, `setupTokenId`, `approvalUrl`, `expiresAt` y `cardEntry`.
2. Para tarjeta, conectar `setupTokenId` con PayPal Card Fields/SDK en la interfaz. Para PayPal, completar la autorización del SDK o `approvalUrl`. Los datos completos de tarjeta viajan directamente a PayPal.
3. Llamar al endpoint de confirmación con **`setupSessionId`**, no con un ID arbitrario del proveedor. El servidor verifica aprobación, identidad del cliente y token permanente antes de guardar el método.
4. Seleccionar el UUID local devuelto mediante `PATCH /membership/payment-methods/default`.

La sesión vence a las 2 horas. Preservar el mismo `requestId` en los reintentos de una operación; usar un UUID diferente para añadir otro método o iniciar otra membresía. Una sesión completada se puede consultar de nuevo sin crear otro token. Los pasos de aprobación e intercambio tienen checkpoints persistidos para recuperarse tras un reinicio.

Ejemplo de listado:

```json
{
  "methods": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "type": "card",
      "brand": "MASTERCARD",
      "last4": "4242",
      "expiry": "2028-08",
      "maskedEmail": null,
      "isDefault": true,
      "expired": false
    }
  ],
  "selectionMode": "saved_methods",
  "provider": "paypal",
  "canAdd": true,
  "canSelectSaved": true,
  "requiresApproval": false,
  "supportedTypes": ["card", "paypal"]
}
```

Los valores son ilustrativos: las respuestas reales provienen de PayPal. El backend guarda únicamente referencias del proveedor y metadatos enmascarados. Nunca recibe PAN/CVV ni permite que el cliente invente marca, últimos dígitos o identidad del pagador. Las referencias permanentes no se exponen en el listado.

Un método vencido o revocado no se puede usar. No se permite eliminar el método de una membresía vigente hasta sustituirlo o cancelar la membresía. La selección se aplica a los próximos cobros. El módulo `/payment-methods` existente continúa siendo exclusivamente para los cobros clínicos, no para membresías.

### Precios, promoción e inicio

Todos los importes de cotizaciones y cobros son **enteros en centavos de USD**. La moneda operativa de la clínica no cambia estos precios.

- Anual: 10000 centavos por año; equivalente mensual de presentación 833; ahorro anual redondeado 17%.
- Mensual: 1000 centavos por mes.
- `BIENVENIDA10`: solo primera contratación anual con prueba; primer cobro 9000, renovaciones 10000. Se normalizan espacios exteriores y mayúsculas.
- Las promociones no se acumulan. Omitir `promotionCode`, usar `null` o cadena vacía para continuar sin promoción.
- Primera prueba: 14 días; `totalToday: 0`; recordatorio a las 48 horas previas al final.
- Clínica que ya tuvo prueba o contratación: cotización sin nueva prueba, `trialDays: 0`, primer cobro completo y sin promoción de bienvenida.

```json
{
  "interval": "yearly",
  "promotionCode": "BIENVENIDA10",
  "paymentMethodId": "11111111-1111-4111-8111-111111111111",
  "requestId": "22222222-2222-4222-8222-222222222222",
  "acceptRecurringBilling": true
}
```

`acceptRecurringBilling` es obligatorio. Se persisten fecha, miembro que aceptó, método seleccionado y oferta aceptada. `startTrial` es opcional y por defecto depende de la elegibilidad; `true` se rechaza si la prueba ya fue utilizada. Si se solicita `false`, se omite la prueba y se programa el cobro inmediato.

La respuesta contiene `status` y `membership`. Durante la prueba devuelve `trialing`; sin prueba devuelve inicialmente `payment_pending` hasta comprobar un pago capturado. Un HTTP 201 por sí solo no acredita un pago. El servidor calcula importes y fechas; no acepta importes del cliente.

Los inicios concurrentes con el mismo UUID devuelven la misma membresía. Cambiar parámetros conservando ese UUID se rechaza. Se guarda el historial de UUID de contratación para que repetir una petición antigua no cree otro contrato después de cancelar.

### Estado para la pantalla de éxito

`GET /membership/current` conserva `plan`, `status`, `billing`, `license`, `limits`, `usage`, `warnings` y `entitlements`. Añade:

- `checkout`: oferta aceptada, con intervalo, moneda, precio, descuento, primer cobro, total inicial y precio de renovación. Es una fotografía de la contratación, **no un recibo** de pagos posteriores.
- `billing.mode`: `vault` para métodos guardados; `subscription` para la integración alojada anterior.
- `billing.paymentMethod`: ID local y datos enmascarados del método seleccionado.
- `billing.nextChargeAt`, `billing.paidCycles`, `currentPeriodStart`, `currentPeriodEnd`.
- `trial.startedAt`, `trial.endsAt`, `trial.reminderAt`, `trial.reminderScheduled`, `trial.reminderSentAt`, `trial.reminderError`.

Las membresías locales con cobros Vault tienen identificador `V-<uuid>`; las suscripciones alojadas PayPal conservan `I-…`. Restaurar verifica el contrato de la clínica seleccionada y sus órdenes; no reinicia la prueba ni permite importar una compra de otra clínica. Este flujo de pago es PayPal, no un flujo de recibos de App Store/Google Play.

## Renovaciones, fallos y cancelación

El worker incorporado al backend procesa cada minuto los cobros vencidos y los recordatorios. Los trabajos están en PostgreSQL, no solo en memoria. Los bloqueos por clínica coordinan peticiones HTTP y workers de múltiples instancias.

Cada período tiene un único registro en `membership_charges`. Antes de llamar a PayPal se guarda el intento; la orden se guarda antes de capturar. Se usan claves idempotentes estables. Después de un resultado incierto se consulta la orden existente. Nunca se concede acceso pagado por una orden meramente creada, pendiente o aprobada: se requiere captura COMPLETED y coincidencia de identificador, importe y moneda.

Las renovaciones usan meses/años calendario desde la fecha ancla, ajustando meses cortos y años bisiestos sin acumular desvíos. El descuento aplica únicamente al ciclo 0. Un pago atrasado no extiende la prueba; sin cobro confirmado al vencer el período, `plan.effectiveCode` vuelve a Free.

Se reintentan automáticamente hasta 5 veces con espera creciente. Un intento que perdió el ID de orden y superó la ventana conservadora de 5 horas pasa a `action_required / RECONCILIATION_REQUIRED`; no se crea otra orden automáticamente. El endpoint de reconciliación verifica una orden conocida contra el cobro antes de recuperar su resultado. Si PayPal requiere acción del pagador, se entrega `approvalUrl` y luego se reconcilia. El historial expone estados y errores operativos.

Los webhooks se verifican con PayPal antes de actualizar el estado. Los eventos Orders/Capture se reconcilian con datos obtenidos del proveedor. Una captura tardía puede cerrar un cobro de una membresía cancelada, pero no puede reactivar el contrato ni reiniciar renovaciones.

**La cancelación es inmediata:** finaliza acceso Premium, desactiva próximos cobros y recordatorios. La interfaz debe explicar ese comportamiento antes de confirmarla. Se pueden conservar o eliminar los métodos guardados por separado.

Las suscripciones alojadas existentes mantienen su API y planes remotos. El worker también reconcilia su estado con PayPal periódicamente. Su fuente de pago se gestiona dentro de PayPal; para nuevos flujos con selector de métodos usar `membership/start` o checkout con `paymentMethodId`.

## Aviso de fin de prueba

Se programa al activar la prueba, a `trial.endsAt - 48 horas`. El destinatario es el email de la clínica; si falta, el primer owner activo que permita notificaciones por email y `billingAlerts`. Nunca se envía a pacientes.

El envío usa Resend, con payload persistido y clave idempotente por contrato/prueba. Hay hasta 5 intentos, backoff y registro de resultado. La aceptación del proveedor se registra en `reminderSentAt`/`reminderProviderId`; no garantiza que el destinatario haya leído el correo. Se suprimen avisos tras cancelar o finalizar la prueba. Una entrega incierta que supera 23 horas no se reenvía automáticamente fuera de la ventana de idempotencia de Resend.

`reminderScheduled` solo es verdadero con trabajo pendiente, configuración de correo y worker habilitado. La falta de destinatario/configuración no se disfraza como envío exitoso. `reminderError` permite detectar problemas operativos.

## Configuración y operación

No se necesitan planes PayPal precreados para la ruta con métodos guardados: se usan Vault v3 + Orders v2 y el calendario del backend. La cuenta comercial de PayPal debe tener habilitados Vault y pagos con tarjeta. Configurar:

```dotenv
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_RETURN_URL=https://tu-app/retorno-pago
PAYPAL_CANCEL_URL=https://tu-app/cancelacion-pago
PAYPAL_WEBHOOK_ID=...
RESEND_API_KEY=...
MEMBERSHIP_EMAIL_FROM=DentalHub <billing@tu-dominio-verificado.com>
BILLING_WORKER_ENABLED=true
```

Suscribir el webhook `/api/billing/webhooks/paypal` a `CHECKOUT.ORDER.APPROVED` y eventos `PAYMENT.CAPTURE.*`. Conservar `BILLING.SUBSCRIPTION.*` y `PAYMENT.SALE.COMPLETED` si se usa el flujo anterior. Las variables `PAYPAL_PREMIUM_*_PLAN_ID` solo son necesarias para ese flujo alojado anterior; sus ofertas de prueba siguen validándose contra los precios/ciclos anunciados.

`GET /membership/readiness` enumera las variables faltantes sin revelar secretos y devuelve el Client ID público requerido por el SDK. Las credenciales y la habilitación comercial son configuración externa; no hay proveedor ficticio en producción.

Migraciones:

```sh
pnpm db:migrate:membership
```

El runner aplica las dos migraciones aditivas de membresía en una transacción y registra checksum/fecha. Se puede repetir; rechaza cambios a una migración ya aplicada. Las migraciones fueron aplicadas a la base local durante esta implementación. En otro entorno se ejecuta el mismo comando con sus credenciales.

Pruebas y contratos:

```sh
pnpm test -- --runInBand
pnpm test:membership:e2e
pnpm run build
pnpm openapi:export
node scripts/generate-postman-collection.mjs --source __docs__/openapi.json
```

El test integral crea y elimina su propia base PostgreSQL local, usa proveedores de prueba y no envía correos ni cargos reales. Incluye concurrencia, acceso entre clínicas, recordatorio con reintento, captura con respuesta perdida, renovación sin descuento, restauración, cancelación y límites anteriores. El exportador de OpenAPI desactiva el worker y la sincronización de esquema.

En Postman usar `membershipPaymentMethodId`, `membershipSetupSessionId`, `membershipChargeId` y `membershipRequestId`; este último debe contener un UUID nuevo por operación lógica y conservarse en sus reintentos.

Referencias de implementación: [Vault v3](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/vault_payment_tokens_v3.json), [Orders v2](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json), [idempotencia de correo](https://resend.com/docs/dashboard/emails/idempotency-keys).
