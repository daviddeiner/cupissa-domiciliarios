CUPISSA DOMICILIARIOS — VERSIÓN MÓVIL + CORREOS DE ENTREGA

1. Publica esta carpeta del portal de domiciliarios en su sitio HTTPS.
2. Para activar la instalación como aplicación, visita la página en Chrome/Edge (Android) y usa «Instalar app»; en Safari (iPhone) usa Compartir → Agregar a pantalla de inicio.
3. La app requiere internet: no se almacenan pedidos ni fotografías offline.

IMPORTANTE: LA CORRECCIÓN DE CORREOS NO SE ACTIVA AL SUBIR EL SITIO.
4. En Supabase → Edge Functions → cupissa-domicilios → Code, reemplaza todo por el contenido de edge-functions/cupissa-domicilios/index.ts y pulsa Deploy updates.
5. Comprueba Secrets: CUPISSA_MAILER_URL y CUPISSA_MAILER_SECRET. La función envía mediante el servicio de correo ya configurado; no expone secretos en el navegador.
6. Prueba con un pedido de prueba que esté EN CAMINO y cuyo cliente tenga correo. Cuando se confirma la entrega, el envío se ejecuta desde la Edge Function.
7. Si no aparece el correo, revisa Logs de cupissa-domicilios y el servicio indicado en CUPISSA_MAILER_URL.

No hay SQL nuevo. No se modifican CUPISSA ADMIN ni CUPISSA CLIENTES.
