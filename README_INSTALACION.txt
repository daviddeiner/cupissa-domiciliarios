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


8. NAVEGACIÓN GPS TIPO WAZE / GOOGLE MAPS
   - La pantalla de navegación usa MapLibre GL JS, cartografía raster de OpenStreetMap y rutas OSRM.
   - Requiere publicar el portal por HTTPS y que el domiciliario permita la ubicación precisa del celular.
   - En Supabase > SQL Editor ejecuta SQL_NAVEGACION_GPS.sql UNA SOLA VEZ.
   - En Supabase > Edge Functions > cupissa-domicilios, reemplaza el código por edge-functions/cupissa-domicilios/index.ts y despliega.
   - La posición se guarda en cupissa_domiciliarios_ubicaciones mientras el domiciliario navega. La vista cupissa_gestion_ubicaciones_domiciliarios queda disponible para que el panel administrativo consulte las ubicaciones y el punto GPS de entrega.
   - La confirmación conserva el flujo actual de fotografía y firma. Se habilita desde la navegación al estar aproximadamente a 35 metros del destino; la coordenada capturada se guarda como punto GPS de entrega.
   - IMPORTANTE: los servicios públicos de teselas OSM, Nominatim y OSRM son servicios comunitarios con políticas y límites de uso. Para operación comercial de alto volumen conviene contratar/autoalojar teselas, geocodificación y enrutamiento. La ubicación GPS depende del dispositivo y puede tener errores; se muestra su precisión estimada.
   - El panel administrativo CUPISSA no está incluido en este ZIP. Los datos quedan almacenados y la vista SQL está creada para conectarla a Gestión > Domiciliarios.
