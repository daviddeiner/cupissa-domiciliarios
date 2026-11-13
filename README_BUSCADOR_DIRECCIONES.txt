CUPISSA DOMICILIARIOS - BUSCADOR MEJORADO DE DIRECCIONES Y LUGARES

CAMBIOS DE ESTA VERSION
- Búsqueda paralela en Photon y Nominatim para ampliar resultados de direcciones y puntos de interés del Atlántico.
- Normalización de numeración de inmuebles (por ejemplo #58-32) y comparación contra el número devuelto por el geocodificador.
- Comparación adicional de vía y municipio cuando la consulta contiene número.
- Los resultados sin número coincidente se identifican claramente como “Vía encontrada · número sin verificar”.
- Una coincidencia de la carrera sin el número del inmueble NO se considera dirección exacta.
- Al seleccionar una vía sin número verificado no se calcula una ruta engañosa ni se habilita la confirmación de entrega.
- Los resultados exactos y los establecimientos se pueden seleccionar y usar para calcular ruta.
- Caché de CSS/JS actualizada.

INSTALACION
1. Haz una copia de seguridad del repositorio.
2. Reemplaza los archivos del ZIP conservando la carpeta cupissa-domiciliarios y su estructura.
3. Publica en GitHub Pages desde main.
4. Cierra completamente la PWA y vuelve a abrirla; la versión de recursos cambió a smartsearch2.
5. Prueba una dirección con número y verifica que el resultado indique “Número encontrado”.

LIMITACIONES Y SEGURIDAD DE DIRECCIONES
- Photon y Nominatim son geocodificadores públicos externos; no son servicios alojados por CUPISSA y pueden tener límites o indisponibilidad.
- La precisión depende de que los datos de OpenStreetMap contengan el número del inmueble. En muchas calles colombianas no existe numeración de puertas cartografiada.
- Si no existe el número en los datos, el buscador lo indica y no presenta el eje de la calle como puerta exacta. No se inventan coordenadas.
- Los lugares se ubican en el punto cartográfico registrado; para establecimientos grandes debe verificarse que el punto corresponda al acceso de entrega.
- La ruta sigue usando OSRM público y las teselas siguen usando OpenStreetMap. Esta actualización NO instala todavía un motor geográfico propio.

ACTUALIZACIÓN: VALIDACIÓN ESTRICTA DE DIRECCIONES RESIDENCIALES
- La búsqueda detecta el municipio solicitado (por ejemplo, Barranquilla o Soledad) y descarta resultados cuya respuesta no confirme ese municipio.
- Prueba variantes de la nomenclatura colombiana (vía + cruce/número) para ampliar la recuperación de candidatos.
- Un resultado residencial solo se considera exacto cuando el proveedor devuelve house_number coincidente, vía coincidente y municipio coincidente.
- Si se indica barrio explícitamente, también exige que el resultado confirme ese barrio para considerarlo exacto.
- Las coincidencias que solo identifican la vía se muestran como aproximadas y no habilitan la confirmación de entrega.
- Los lugares comerciales mantienen el flujo de búsqueda por nombre que ya funcionaba.
IMPORTANTE: el buscador sigue consultando Photon y Nominatim. Si esos índices no contienen el número del inmueble, el sistema no puede inventar una coordenada exacta. En ese caso debe solicitar confirmación con una referencia/punto exacto y mantener el destino como no verificado.
