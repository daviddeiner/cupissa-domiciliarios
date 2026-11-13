/* CUPISSA DOMICILIARIOS | Sesión independiente, sin permisos del administrador. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>'$ '+new Intl.NumberFormat('es-CO').format(Number(v||0));
 const db=window.supabase.createClient(window.CUPISSA_SUPABASE_URL,window.CUPISSA_SUPABASE_ANON_KEY,{auth:{storageKey:'cupissa-courier-session-v1',autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
 let session=null,assigned=[],selected=null,proofPhoto=null,filter='active',signaturePoints=0,signing=false,ctx;
 let installPrompt=null;
 let navMap=null,navCourierMarker=null,navWatch=null,navOrder=null,navDestination=null,navDestinationApproximate=false,navPosition=null,navRoute=null,navSteps=[],navStepIndex=0,navLastReroute=0,navHeading=0,navReached=false,navLastPersist=0,navLastPersistPosition=null,navSearchAbort=null,navSearchTimer=null,navSearchSeq=0;
 const routeSourceId='cupissa-route',destinationSourceId='cupissa-destination',courierSourceId='cupissa-courier';
 const rad=v=>v*Math.PI/180;
 const distanceMeters=(a,b)=>{const R=6371000,dLat=rad(b[1]-a[1]),dLon=rad(b[0]-a[0]);const x=Math.sin(dLat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
 const fmtDistance=m=>m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1).replace('.',',')} km`;
 const fmtDuration=s=>{const m=Math.max(1,Math.round(s/60));return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min`;};
 const bearingBetween=(a,b)=>{const y=Math.sin(rad(b[0]-a[0]))*Math.cos(rad(b[1]));const x=Math.cos(rad(a[1]))*Math.sin(rad(b[1]))-Math.sin(rad(a[1]))*Math.cos(rad(b[1]))*Math.cos(rad(b[0]-a[0]));return (Math.atan2(y,x)*180/Math.PI+360)%360;};
 const navStatus=t=>{$('nav-status').textContent=t;};
 function addressFor(o){return [o.direccion,o.barrio,o.ciudad].filter(Boolean).join(', ')||String(o.ubicacion||'').trim();}
 function validCoords(latValue,lonValue){if(latValue===null||latValue===undefined||lonValue===null||lonValue===undefined||String(latValue).trim()===''||String(lonValue).trim()==='')return null;const lat=Number(latValue),lon=Number(lonValue);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||lat===0&&lon===0)return null;return [lon,lat];}
 function coordsFromOrder(o){
  // Priorizar siempre coordenadas explícitas guardadas en el pedido/cliente; no geocodificar si existen.
  const pairs=[['latitud','longitud'],['latitude','longitude'],['lat','lng'],['lat','lon'],['entrega_latitud','entrega_longitud'],['ubicacion_latitud','ubicacion_longitud']];
  for(const [a,b] of pairs){const c=validCoords(o?.[a],o?.[b]);if(c)return c;}
  const u=o?.ubicacion;
  if(u&&typeof u==='object'){for(const [a,b] of pairs){const c=validCoords(u[a],u[b]);if(c)return c;}if(Array.isArray(u.coordinates)&&u.coordinates.length>=2){const c=validCoords(u.coordinates[1],u.coordinates[0]);if(c)return c;}}
  if(typeof u==='string'){
   const trimmed=u.trim();if(trimmed.startsWith('{')){try{const parsed=JSON.parse(trimmed);for(const [a,b] of pairs){const c=validCoords(parsed[a],parsed[b]);if(c)return c;}if(Array.isArray(parsed.coordinates)&&parsed.coordinates.length>=2){const c=validCoords(parsed.coordinates[1],parsed.coordinates[0]);if(c)return c;}}catch{}}
   const m=trimmed.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)/);if(m){const c=validCoords(m[1],m[2]);if(c)return c;}
  }
  return null;
 }
 async function geocodeDestination(o){
  const known=coordsFromOrder(o);if(known)return {coords:known,approximate:false,source:'pedido'};
  const street=String(o.direccion||'').trim(),barrio=String(o.barrio||'').trim();
  const city=String(o.ciudad||o.municipio||'Soledad').trim();
  const department=String(o.departamento||o.departamento_nombre||'Atlántico').trim();
  const raw=[street,barrio,city,department,'Colombia'].filter(Boolean).join(', ');
  if(!street&&!barrio)throw new Error('Este pedido no tiene dirección ni coordenadas. Busca el destino por dirección o nombre del lugar.');
  const queries=[raw,...(street?[`${street}, ${city}, ${department}, Colombia`]:[]),...(barrio?[`${barrio}, ${city}, ${department}, Colombia`]:[])];
  geocodeDestination._approx=null;
  for(let i=0;i<queries.length;i++){
   const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=co&addressdetails=1&dedupe=1&q=${encodeURIComponent(queries[i])}`;
   try{
    const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)continue;const rows=await r.json();
    const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const cityN=norm(city),depN=norm(department);
    const ranked=(rows||[]).map(row=>{const a=row.address||{};const locality=norm(a.city||a.town||a.village||a.municipality||a.county);const state=norm(a.state||a.region);const cityMatch=!cityN||locality.includes(cityN)||cityN.includes(locality);const depMatch=!depN||state.includes(depN)||depN.includes(state);const coords=validCoords(row.lat,row.lon);return {row,coords,score:(cityMatch?100:0)+(depMatch?30:0)+Number(row.importance||0)*10};}).filter(x=>x.coords).sort((a,b)=>b.score-a.score);
    if(!ranked.length)continue;
    const best=ranked[0],a=best.row.address||{};const locality=norm(a.city||a.town||a.village||a.municipality||a.county);const cityMatches=!cityN||locality.includes(cityN)||cityN.includes(locality);
    // No aceptar como exacto un resultado de otro municipio. La búsqueda por barrio siempre es aproximada.
    if(i<2&&!cityMatches)continue;
    const requestedNumber=(street.match(/#\s*([0-9]+(?:[-A-Za-z][0-9A-Za-z]*)?)/)||[])[1]||'';
    const returnedNumber=String(a.house_number||'').replace(/\s+/g,'').toLowerCase();
    const requestedRoad=street.replace(/#.*$/,'').replace(/\b(cra|cra\.|carrera|cll|calle|av|avenida)\b/gi,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const returnedRoad=String(a.road||a.pedestrian||a.residential||'').replace(/\b(cra|cra\.|carrera|cll|calle|av|avenida)\b/gi,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const numberMatches=!requestedNumber||returnedNumber===requestedNumber.replace(/\s+/g,'').toLowerCase();
    const roadMatches=!requestedRoad||!returnedRoad||requestedRoad.includes(returnedRoad)||returnedRoad.includes(requestedRoad);
    const exactStreet=!requestedNumber||(!!returnedNumber&&numberMatches&&roadMatches);
    const candidate={coords:best.coords,approximate:i>0||!cityMatches||!exactStreet,source:'geocodificacion',label:best.row.display_name||''};
    if(!candidate.approximate)return candidate;
    // Guardar la mejor aproximación, pero seguir probando consultas más específicas.
    if(!geocodeDestination._approx)geocodeDestination._approx=candidate;
   }catch(e){console.warn('[CUPISSA geocoding]',e);}
  }
  if(geocodeDestination._approx)return geocodeDestination._approx;
  throw new Error('No pudimos verificar esta dirección en el municipio del pedido. Usa el buscador de direcciones para elegir el lugar correcto.');
 }
 const normGeo=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function closeNavSearch(){const box=$('nav-search-results');if(box){box.hidden=true;box.innerHTML='';}}
 function requestedHouseNumber(query){
  const q=String(query||'');
  const m=q.match(/#\s*([0-9]+(?:\s*[-/]\s*[0-9A-Za-z]+)?)/i);
  return m?m[1].replace(/\s+/g,'').toLowerCase():'';
 }
 function normalizedHouseNumber(value){return String(value||'').toLowerCase().replace(/[^0-9a-z]/g,'');}
 const ATLANTIC_MUNICIPALITIES=['barranquilla','soledad','malambo','galapa','puerto colombia','sabanalarga','baranoa','tubara','juan de acosta','polonuevo','sabanagrande','santo tomas','palmar de varela','ponedera','campo de la cruz','candelaria','manati','luruaco','repelon','santa lucia','suan'];
 function requestedMunicipality(query){const q=normGeo(query);return ATLANTIC_MUNICIPALITIES.find(name=>q.includes(name))||'';}
 function rowMunicipality(row){const a=row.address||{};return normGeo(a.city||a.town||a.village||a.municipality||a.county||a.city_district||'');}
 function rowNeighborhood(row){const a=row.address||{};return normGeo(a.suburb||a.neighbourhood||a.neighborhood||a.quarter||a.city_district||'');}
 function rowIsExactForQuery(row,query){
  const wanted= requestedHouseNumber(query);if(!wanted)return true;
  const a=row.address||{};const got=normalizedHouseNumber(a.house_number||row.housenumber||'');
  if(!got||got!==normalizedHouseNumber(wanted))return false;
  const requestedRoad=String(query||'').split('#')[0].replace(/\b(cra|cra\.|carrera|cll|cll\.|calle|av|avenida)\b/gi,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const returnedRoad=String(a.road||a.pedestrian||a.residential||a.street||'').replace(/\b(cra|cra\.|carrera|cll|cll\.|calle|av|avenida)\b/gi,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  if(!returnedRoad||!requestedRoad||(!requestedRoad.includes(returnedRoad)&&!returnedRoad.includes(requestedRoad)))return false;
  const municipality=requestedMunicipality(query),locality=rowMunicipality(row);
  // Nunca considerar exacta una coincidencia que no confirme el municipio solicitado.
  if(municipality&&(!locality||!locality.includes(municipality)))return false;
  // Si se indicó barrio explícitamente (segmento entre comas), exigir coincidencia del barrio.
  const parts=String(query||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(parts.length>=3){
   const possible=normGeo(parts.slice(1,-1).join(' '));
   const neighborhood=rowNeighborhood(row);
   const meaningful=possible.replace(/\b(atlantico|colombia|barranquilla|soledad|malambo|galapa|puerto colombia|sabanalarga)\b/g,'').trim();
   if(meaningful&&neighborhood&&!neighborhood.includes(meaningful)&&!meaningful.includes(neighborhood))return false;
   if(meaningful&&!neighborhood)return false;
  }
  return true;
 }
 function resultMatchesRequestedMunicipality(row,query){
  const wanted=requestedMunicipality(query);if(!wanted)return true;
  const actual=rowMunicipality(row);
  // No mezclar barrios o calles homónimas de municipios distintos.
  return !!actual&&actual.includes(wanted);
 }
 function renderNavSearch(rows,query){
  const box=$('nav-search-results'),hint=$('nav-search-hint');if(!box)return;box.innerHTML='';
  if(!rows.length){box.hidden=true;hint.textContent=requestedMunicipality(query)?'No encontramos resultados verificables en el municipio indicado. No mostraremos calles de otros municipios como si fueran esta dirección. Prueba agregar el barrio o una referencia cercana.':'No encontramos coincidencias en el Atlántico. Prueba con dirección completa, barrio y municipio, o con el nombre oficial del lugar.';return;}
  const wantsNumber=!!requestedHouseNumber(query);
  rows.forEach(row=>{
   const coords=validCoords(row.lat,row.lon);if(!coords)return;const a=row.address||{};
   const title=row.name||a.amenity||a.shop||a.tourism||a.leisure||a.road||row.display_name.split(',')[0]||'Lugar encontrado';
   const detail=row.display_name||[a.road,a.house_number,a.suburb,a.city,a.town,a.state].filter(Boolean).join(', ');
   const exact=rowIsExactForQuery(row,query);
   const b=document.createElement('button');b.type='button';b.className='nav-search-result';b.setAttribute('role','option');
   const status=wantsNumber?(exact?'Número y municipio coinciden':'Vía encontrada · inmueble sin verificar'):(row._source==='photon'?'Lugar/dirección encontrada':'Coincidencia cartográfica');
   b.innerHTML=`<strong>${esc(title)}</strong><small>${esc(detail)}</small><em class="nav-result-status ${wantsNumber&&!exact?'approx':''}">${esc(status)}</em>`;
   b.addEventListener('click',()=>selectNavSearchResult(row,title,detail,query));box.appendChild(b);
  });
  box.hidden=!box.children.length;
  const exactCount=rows.filter(r=>rowIsExactForQuery(r,query)).length;
  hint.textContent=wantsNumber?(exactCount?`${exactCount} resultado(s) coinciden en número, vía y municipio. Revisa también el barrio antes de iniciar.`:'No se encontró el número exacto en el municipio indicado. Los resultados son solamente la vía; no se usarán como puerta de entrega.'):`Resultados para: ${query}. Selecciona el establecimiento o lugar correcto.`;
 }
 function photonToRow(feature){
  const p=feature.properties||{},c=feature.geometry?.coordinates||[];if(c.length<2)return null;
  const address={road:p.street||p.name||'',house_number:p.housenumber||'',suburb:p.district||p.suburb||'',city:p.city||p.town||p.village||p.county||'',town:p.town||'',village:p.village||'',municipality:p.county||'',state:p.state||'',country:p.country||''};
  const display=[p.name,p.street&&p.street!==p.name?p.street:'',p.housenumber,p.district,p.city||p.town||p.county,p.state,p.country].filter(Boolean).join(', ');
  return {lat:String(c[1]),lon:String(c[0]),name:p.name||p.street||'',address,display_name:display, _source:'photon',_osm_id:p.osm_id};
 }
 function isAtlanticResult(row){
  const a=row.address||{},state=normGeo(a.state||'');
  const city=normGeo([a.city,a.town,a.village,a.municipality,a.county,a.suburb].filter(Boolean).join(' '));
  const names=/barranquilla|soledad|malambo|galapa|puerto colombia|sabanalarga|baranoa|tubara|juan de acosta|polonuevo|sabanagrande|santo tomas|palmar de varela|ponedera|campo de la cruz|candelaria|manati|luruaco|repelon|santa lucia|suan/;
  return state.includes('atlantico')||names.test(city);
 }
 async function runNavSearch(){
  const input=$('nav-search-input'),hint=$('nav-search-hint');const q=String(input?.value||'').trim();if(q.length<3){hint.textContent='Escribe al menos 3 caracteres para buscar.';closeNavSearch();return;}
  navSearchAbort?.abort();navSearchAbort=new AbortController();const seq=++navSearchSeq;$('nav-search-button').disabled=true;hint.textContent='Buscando direcciones y lugares en el Atlántico…';
  try{
   const query=/(atlantico|colombia)/i.test(q)?q:`${q}, Atlántico, Colombia`;
   // Variantes para que la nomenclatura colombiana no dependa de una sola interpretación del geocodificador.
   const variants=[query];
   const addressMatch=q.match(/^\s*(cra\.?|carrera|cll\.?|calle|av\.?|avenida)\s*([0-9]+[a-z]?)\s*#\s*([0-9]+)\s*[-/]\s*([0-9]+[a-z]?)\s*(.*)$/i);
   if(addressMatch){
    const road=`${addressMatch[1]} ${addressMatch[2]}`,cross=`${addressMatch[3]}-${addressMatch[4]}`;
    const tail=addressMatch[5].replace(/^[,\s]+/,'');
    variants.push(`${road} ${cross}${tail?`, ${tail}`:''}, Atlántico, Colombia`);
    variants.push(`${road} con calle ${addressMatch[3]}, ${tail}, Atlántico, Colombia`);
   }
   const photonUrl=`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=20&lang=es`;
   const requests=[fetch(photonUrl,{headers:{Accept:'application/json'},signal:navSearchAbort.signal}).then(r=>{if(!r.ok)throw new Error('Photon '+r.status);return r.json();})];
   for(const variant of [...new Set(variants)]){
    const nomUrl=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&dedupe=1&limit=20&countrycodes=co&q=${encodeURIComponent(variant)}`;
    requests.push(fetch(nomUrl,{headers:{Accept:'application/json'},signal:navSearchAbort.signal}).then(r=>{if(!r.ok)throw new Error('Nominatim '+r.status);return r.json();}));
   }
   const results=await Promise.allSettled(requests);
   if(seq!==navSearchSeq)return;
   const photonResult=results[0];
   const photonRows=photonResult.status==='fulfilled'?(photonResult.value.features||[]).map(photonToRow).filter(Boolean):[];
   const nomRows=results.slice(1).flatMap(result=>result.status==='fulfilled'?(result.value||[]).map(x=>({...x,_source:'nominatim'})):[]);
   const combined=[...photonRows,...nomRows].filter(x=>validCoords(x.lat,x.lon)&&isAtlanticResult(x)&&resultMatchesRequestedMunicipality(x,q));
   const wantsNumber=!!requestedHouseNumber(q);
   const seen=new Set(),rows=combined.filter(x=>{const key=`${normalizedHouseNumber(x.address?.house_number)}|${normGeo(x.name||x.address?.road)}|${Number(x.lat).toFixed(5)}|${Number(x.lon).toFixed(5)}`;if(seen.has(key))return false;seen.add(key);return true;});
   rows.sort((a,b)=>{
    const exactA=rowIsExactForQuery(a,q),exactB=rowIsExactForQuery(b,q);if(exactA!==exactB)return exactA?-1:1;
    const namedA=!!a.name,namedB=!!b.name;if(namedA!==namedB)return namedA?-1:1;
    return (Number(b.importance)||0)-(Number(a.importance)||0);
   });
   renderNavSearch(rows.slice(0,18),q);
   if(!rows.length&&pr.status==='rejected'&&nr.status==='rejected')hint.textContent='Los servicios de búsqueda no respondieron. Inténtalo nuevamente; no se seleccionó ninguna ubicación.';
  }catch(e){if(e.name!=='AbortError'){hint.textContent=e.message||'No fue posible realizar la búsqueda. Inténtalo nuevamente.';closeNavSearch();}}
  finally{if(seq===navSearchSeq)$('nav-search-button').disabled=false;}
 }
 async function selectNavSearchResult(row,title,detail,query){
  const coords=validCoords(row.lat,row.lon);if(!coords)return;
  const exact=rowIsExactForQuery(row,query);const hasNumber=!!requestedHouseNumber(query);
  navDestination=coords;navDestinationApproximate=hasNumber&&!exact;navReached=false;navRoute=null;navSteps=[];navStepIndex=0;navLastReroute=0;
  $('nav-arrived').disabled=true;$('nav-destination-label').textContent=title;$('nav-instruction').textContent=navDestinationApproximate?'Número de inmueble sin verificar':'Destino seleccionado';
  $('nav-distance-next').textContent=navDestinationApproximate?'Se encontró la vía, pero no el número exacto':'Calculando ruta hasta '+title;
  updateDestinationMarker();updateRouteLayer();closeNavSearch();
  if(navMap?.loaded())navMap.easeTo({center:coords,zoom:16.5,pitch:42,duration:450});
  if(navDestinationApproximate){navStatus('No se encontró el número exacto del inmueble. Esta ubicación corresponde a la vía, no a la puerta del cliente. Prueba otra escritura o busca un establecimiento cercano; no se habilitará la confirmación.');$('nav-search-hint').textContent='El número no está verificado en los datos cartográficos. No se calculará una ruta como si fuera la puerta exacta.';return;}
  navStatus('Destino seleccionado. Calculando ruta…');
  if(navPosition){try{await calculateRoute(true);}catch(e){navStatus(e.message);$('nav-search-hint').textContent='El lugar fue localizado, pero no se pudo calcular una ruta: '+e.message;}}
  else navStatus('Destino localizado. Esperando la ubicación GPS del domiciliario para calcular la ruta.');
 }
 function navStyle(){return {version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors',maxzoom:19}},layers:[{id:'osm',type:'raster',source:'osm'}]};}
 function ensureNavMap(){
  if(navMap){requestAnimationFrame(()=>navMap.resize());return;}
  navMap=new maplibregl.Map({container:'delivery-map',style:navStyle(),center:navPosition||[-74.8,10.98],zoom:14,pitch:0,bearing:0,antialias:true,fadeDuration:0, attributionControl:true});
  navMap.addControl(new maplibregl.NavigationControl({showCompass:false,showZoom:false}),'bottom-right');
  navMap.on('load',()=>{
    navMap.addSource(routeSourceId,{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]},properties:{}}});
    navMap.addLayer({id:'route-casing',type:'line',source:routeSourceId,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#062b49','line-width':11,'line-opacity':.9}});
    navMap.addLayer({id:'route-line',type:'line',source:routeSourceId,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#16b9ff','line-width':6}});
    navMap.addSource(destinationSourceId,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    navMap.addLayer({id:'destination-marker',type:'circle',source:destinationSourceId,paint:{'circle-radius':9,'circle-color':'#ed348b','circle-stroke-color':'#fff','circle-stroke-width':3}});
    const arrow=document.createElement('div');arrow.className='gps-arrow-marker';arrow.innerHTML='<span>▲</span>';
    navCourierMarker=new maplibregl.Marker({element:arrow,anchor:'center',rotationAlignment:'viewport'}).setLngLat(navPosition||[-74.8,10.98]).addTo(navMap);
    updateCourierMarker();updateDestinationMarker();updateRouteLayer();
    navMap.resize();
    if(navRoute?.coordinates?.length){const b=new maplibregl.LngLatBounds();navRoute.coordinates.forEach(c=>b.extend(c));navMap.fitBounds(b,{padding:{top:115,bottom:245,left:28,right:28},duration:0,maxZoom:17});}
  });
  navMap.on('click',async e=>{
    if(!navOrder)return;
    navDestination=[e.lngLat.lng,e.lngLat.lat];navDestinationApproximate=false;navReached=false;$('nav-arrived').disabled=true;
    updateDestinationMarker();$('nav-instruction').textContent='Destino marcado en el mapa';$('nav-distance-next').textContent='Calculando ruta hasta el punto seleccionado';
    navStatus('Destino seleccionado manualmente. Calculando ruta…');
    if(navPosition){try{await calculateRoute(true);}catch(err){navStatus(err.message);}}
    else navStatus('Destino marcado. Esperando señal GPS del domiciliario.');
  });
  navMap.on('error',e=>{if(e?.error){console.warn('[CUPISSA map]',e.error);const msg=String(e.error.message||'');if(/tile|source|style|fetch|network|load/i.test(msg))navStatus('No se pudieron cargar las calles del mapa. Revisa la conexión; el GPS y los datos del pedido siguen activos.');}});
  navMap.on('idle',()=>{if(navRoute)updateRouteLayer();});
}
 function updateCourierMarker(){if(navCourierMarker&&navPosition){navCourierMarker.setLngLat(navPosition);navCourierMarker.setRotation(0);}}
 function updateDestinationMarker(){if(navMap?.getSource(destinationSourceId)){const features=navDestination?[{type:'Feature',geometry:{type:'Point',coordinates:navDestination},properties:{}}]:[];navMap.getSource(destinationSourceId).setData({type:'FeatureCollection',features});}}
 function updateRouteLayer(){if(navMap?.getSource(routeSourceId))navMap.getSource(routeSourceId).setData(navRoute?{type:'Feature',geometry:navRoute,properties:{}}:{type:'Feature',geometry:{type:'LineString',coordinates:[]},properties:{}});}
 async function calculateRoute(force=false){if(!navPosition||!navDestination)return;const now=Date.now();if(!force&&now-navLastReroute<12000)return;navLastReroute=now;const url=`https://router.project-osrm.org/route/v1/driving/${navPosition[0]},${navPosition[1]};${navDestination[0]},${navDestination[1]}?overview=full&geometries=geojson&steps=true`;const r=await fetch(url);if(!r.ok)throw new Error('No fue posible calcular la ruta. Comprueba tu conexión.');const d=await r.json();if(d.code!=='Ok'||!d.routes?.length)throw new Error('No encontramos una ruta en automóvil hasta esta dirección.');const route=d.routes[0];navRoute=route.geometry;navSteps=(route.legs||[]).flatMap(l=>l.steps||[]).filter(s=>s.maneuver);navStepIndex=0;updateRouteLayer();$('nav-eta').textContent=fmtDuration(route.duration);$('nav-distance').textContent=fmtDistance(route.distance);$('nav-arrival').textContent=new Date(Date.now()+route.duration*1000).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});if(force&&navMap){const fit=()=>{if(!navMap||!navRoute)return;const b=new maplibregl.LngLatBounds();route.geometry.coordinates.forEach(c=>b.extend(c));navMap.resize();navMap.fitBounds(b,{padding:{top:115,bottom:245,left:28,right:28},duration:500,maxZoom:17});};if(navMap.loaded())fit();else navMap.once('load',fit);}updateInstruction();}
 function updateInstruction(){if(!navSteps.length){$('nav-instruction').textContent='Sigue la ruta';$('nav-distance-next').textContent='Continúa hacia el destino';return;}let s=navSteps[navStepIndex]||navSteps.at(-1);while(navStepIndex<navSteps.length-1&&s.geometry?.coordinates?.length&&distanceMeters(navPosition,s.geometry.coordinates.at(-1))<Math.max(35,s.distance*.45)){s=navSteps[++navStepIndex];}const t=s.maneuver?.type,m=s.maneuver?.modifier;let label='Continúa';if(t==='turn')label=m?.includes('left')?'Gira a la izquierda':m?.includes('right')?'Gira a la derecha':'Gira';else if(t==='roundabout'||t==='rotary')label='En la glorieta';else if(t==='arrive')label='Has llegado al destino';else if(t==='depart')label='Inicia el recorrido';else if(t==='merge')label='Incorpórate';else if(t==='fork')label=m?.includes('left')?'Mantente a la izquierda':'Mantente a la derecha';$('nav-instruction').textContent=label;$('nav-distance-next').textContent=`En ${fmtDistance(s.distance||0)}${s.name?' · '+s.name:''}`;$('nav-turn-icon').textContent=m?.includes('left')?'↰':m?.includes('right')?'↱':t==='arrive'?'●':'↑';}
 async function persistCourierPosition(p){if(!session||!navOrder)return;const c=p.coords,now=Date.now(),point=[c.longitude,c.latitude];if(now-navLastPersist<10000&&navLastPersistPosition&&distanceMeters(point,navLastPersistPosition)<20)return;navLastPersist=now;navLastPersistPosition=point;try{await call('courier_location',{pedido_id:String(navOrder.id),latitud:c.latitude,longitud:c.longitude,precision_m:c.accuracy,rumbo:Number.isFinite(c.heading)?c.heading:null,velocidad:Number.isFinite(c.speed)?c.speed:null,registrado_en:new Date(p.timestamp).toISOString()});}catch(e){console.warn('[CUPISSA GPS]',e.message);}}
 async function onGpsPosition(p){
  navPosition=[p.coords.longitude,p.coords.latitude];window.__cupissaLastAccuracy=p.coords.accuracy;
  if(Number.isFinite(p.coords.heading)&&p.coords.heading!==null)navHeading=p.coords.heading;
  else if(navRoute?.coordinates?.length){const n=navRoute.coordinates.find(c=>distanceMeters(navPosition,c)>12);if(n)navHeading=bearingBetween(navPosition,n);}
  updateCourierMarker();
  if(navMap?.loaded())navMap.easeTo({center:navPosition,bearing:navHeading,pitch:52,zoom:17.5,duration:650});
  await persistCourierPosition(p);
  if(!navDestination){navStatus(`GPS activo · Precisión aproximada ${Math.round(p.coords.accuracy)} m · Marca el destino tocando el mapa.`);return;}
  const remaining=distanceMeters(navPosition,navDestination);
  if(remaining<60&&!navDestinationApproximate){navReached=true;$('nav-arrived').disabled=false;navStatus('Estás en el destino. Verifica la dirección antes de confirmar.');if(navRoute){navRoute=null;navSteps=[];if(navMap?.getSource(routeSourceId))navMap.getSource(routeSourceId).setData({type:'Feature',geometry:{type:'LineString',coordinates:[]},properties:{}});}return;}
  else if(navDestinationApproximate){navReached=false;$('nav-arrived').disabled=true;navStatus('El destino es aproximado. Toca la puerta o punto exacto del cliente en el mapa para habilitar la confirmación.');}
  else {navReached=false;$('nav-arrived').disabled=true;navStatus(`GPS activo · Precisión aproximada ${Math.round(p.coords.accuracy)} m`);}
  const nearestRouteDistance=navRoute?.coordinates?.length?Math.min(...navRoute.coordinates.filter((_,i)=>i%Math.max(1,Math.floor(navRoute.coordinates.length/80))===0).map(c=>distanceMeters(navPosition,c))):Infinity;
  if(!navDestinationApproximate&&(!navRoute||nearestRouteDistance>85)){try{await calculateRoute(!navRoute);}catch(e){navStatus(e.message);}}
  else updateInstruction();
}
 function startGps(){if(!navigator.geolocation){navStatus('Este dispositivo no ofrece ubicación GPS.');return;}if(navWatch!==null)navigator.geolocation.clearWatch(navWatch);navWatch=navigator.geolocation.watchPosition(onGpsPosition,e=>navStatus(e.code===1?'Permite el acceso a la ubicación para CUPISSA.':e.code===2?'Activa la ubicación del celular.':'El GPS tardó demasiado. Inténtalo en un lugar abierto.'),{enableHighAccuracy:true,maximumAge:2000,timeout:20000});}
 async function startNavigation(order){
  if(!window.maplibregl){alert('No se pudo cargar el motor del mapa. Comprueba tu conexión e inténtalo de nuevo.');return;}
  navOrder=order;navSearchAbort?.abort();$('nav-search-input').value='';closeNavSearch();$('nav-search-hint').textContent='Busca una dirección, barrio o establecimiento en el Atlántico.';navReached=false;navRoute=null;navSteps=[];navStepIndex=0;navLastReroute=0;navDestination=null;navDestinationApproximate=false;navPosition=null;navLastPersist=0;navLastPersistPosition=null;updateRouteLayer();updateDestinationMarker();
  $('nav-destination-label').textContent=addressFor(order)||'Dirección pendiente';$('nav-arrived').disabled=true;
  $('nav-instruction').textContent='Buscando destino…';$('nav-distance-next').textContent='Preparando navegación';$('nav-turn-icon').textContent='↑';
  $('nav-eta').textContent='-- min';$('nav-distance').textContent='-- km';$('nav-arrival').textContent='--:--';
  show('navigation-screen',true);document.body.classList.add('navigation-open');
  ensureNavMap();requestAnimationFrame(()=>{navMap?.resize();requestAnimationFrame(()=>navMap?.resize());});setTimeout(()=>navMap?.resize(),350);
  navStatus('Solicitando ubicación GPS de alta precisión…');startGps();
  try{
    const result=await geocodeDestination(order);navDestination=result.coords;navDestinationApproximate=!!result.approximate;updateDestinationMarker();
    if(result.approximate){
      $('nav-instruction').textContent='Confirma el punto de entrega';$('nav-distance-next').textContent='La dirección se ubicó de forma aproximada';
      navRoute=null;navSteps=[];updateRouteLayer();navStatus('La dirección del pedido no se pudo verificar automáticamente. Usa el buscador superior para localizar la dirección exacta o el nombre del establecimiento; no necesitas marcar el mapa.');$('nav-search-hint').textContent='La búsqueda automática no confirmó la puerta. Escribe aquí la dirección completa o el nombre del lugar.';
      if(navPosition&&navMap?.loaded())navMap.easeTo({center:navDestination,zoom:17.5,pitch:48,duration:600});
    }else{
      $('nav-instruction').textContent='Destino localizado';$('nav-distance-next').textContent='Calculando recorrido';
      navStatus('Destino localizado. Esperando GPS para calcular la ruta.');
    }
    if(!navDestinationApproximate&&navPosition){try{await calculateRoute(true);}catch(e){navStatus(e.message);}}
  }catch(e){
    $('nav-instruction').textContent='Selecciona el destino';$('nav-distance-next').textContent='Toca la ubicación del cliente en el mapa';
    navStatus(e.message);
  }
}
 function stopNavigation(){if(navWatch!==null){navigator.geolocation.clearWatch(navWatch);navWatch=null;}show('navigation-screen',false);document.body.classList.remove('navigation-open');navOrder=null;navReached=false;}
 $('nav-search-button').addEventListener('click',runNavSearch);
 $('nav-search-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runNavSearch();}});
 $('nav-search-input').addEventListener('input',()=>{clearTimeout(navSearchTimer);const q=$('nav-search-input').value.trim();if(q.length>=4)navSearchTimer=setTimeout(runNavSearch,650);else closeNavSearch();});
 $('nav-close').addEventListener('click',stopNavigation);
 $('nav-recenter').addEventListener('click',()=>{if(navPosition&&navMap)navMap.easeTo({center:navPosition,zoom:17.5,bearing:navHeading,pitch:52,duration:500});});
 $('nav-arrived').addEventListener('click',()=>{if(!navOrder||!navPosition)return;const o=navOrder;stopNavigation();openProof(o);});
 window.addEventListener('pagehide',()=>{if(navWatch!==null)navigator.geolocation.clearWatch(navWatch);});

 const installed=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
 function installHelp(){
   const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
   $('install-guidance').textContent=ios
     ? 'En Safari: toca Compartir y elige «Agregar a pantalla de inicio». La aplicación necesita internet para recibir y confirmar domicilios.'
     : 'En el menú de tu navegador (⋮), selecciona «Instalar aplicación» o «Agregar a pantalla de inicio». Usa HTTPS y abre esta página directamente para que aparezca la opción.';
   show('install-info',true);
 }
 async function installApp(){
   if(installed())return;
   if(installPrompt){
     const prompt=installPrompt;installPrompt=null;
     await prompt.prompt();
     await prompt.userChoice.catch(()=>{});
   }else installHelp();
 }
 ['install-button','install-button-login'].forEach(id=>$(id)?.addEventListener('click',installApp));
 $('install-info-close').onclick=()=>show('install-info',false);
 $('install-info-done').onclick=()=>show('install-info',false);
 function updateInstallButton(){
   const visible=!installed();
   $('install-button').hidden=!visible;
   $('install-button-login').hidden=!visible;
 }
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;updateInstallButton();});
 window.addEventListener('appinstalled',()=>{installPrompt=null;updateInstallButton();});
 updateInstallButton();
 // Solo habilita instalación PWA. NO guarda pedidos, datos personales ni evidencias offline.
 if('serviceWorker' in navigator && location.protocol==='https:'){
   window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}),{once:true});
 }

 const tel=v=>{let n=String(v||'').replace(/\D/g,'');if(n.startsWith('57')&&n.length===12)n=n.slice(2);return /^3\d{9}$/.test(n)?n:'';};
 const show=(id,yes)=>{$(id).hidden=!yes;};
 function message(id,text){$(id).textContent=text;$(id).hidden=!text;}
 async function call(action,args={}){
  const {data,error}=await db.functions.invoke('cupissa-domicilios',{body:{action,...args}});
  if(error){const server=error.context?.json?await error.context.json().catch(()=>null):null;throw new Error(server?.error||error.message||'Error de conexión con Supabase');}
  if(!data?.ok)throw new Error(data?.error||'La operación no fue confirmada');return data;
 }
 function checkConnectivity(){if(!navigator.onLine)message('app-status','Necesitas internet para consultar o confirmar domicilios.');}
 $('login-form').addEventListener('submit',async event=>{
  event.preventDefault();let phone=tel(event.currentTarget.phone.value);if(!phone){message('login-error','Escribe un celular colombiano válido.');return;}
  const btn=$('login-button');btn.disabled=true;btn.textContent='Verificando…';message('login-error','');
  try{
   const {data,error}=await db.auth.signInWithPassword({email:`repartidor-${phone}@domiciliarios.cupissa.com`,password:event.currentTarget.password.value});
   if(error)throw error;
   session=data.session;
   await loadOrders();show('login-screen',false);show('app-screen',true);
  }catch(error){await db.auth.signOut();message('login-error','No fue posible entrar. Verifica que CUPISSA te haya registrado y que el teléfono/contraseña coincidan. '+(error?.message||''));}
  finally{btn.disabled=false;btn.textContent='Entrar a mis domicilios';}
 });
 $('logout-button').addEventListener('click',async()=>{await db.auth.signOut();session=null;assigned=[];show('app-screen',false);show('login-screen',true);});
 $('refresh-button').addEventListener('click',loadOrders);
 $('show-active').onclick=()=>{filter='active';render();$('show-active').classList.add('active');$('show-all').classList.remove('active');};
 $('show-all').onclick=()=>{filter='all';render();$('show-all').classList.add('active');$('show-active').classList.remove('active');};
 async function loadOrders(){
  $('app-status').textContent='Actualizando domicilios…';
  try{const r=await call('courier_orders');assigned=r.orders||[];$('driver-name').textContent=[r.courier.nombres,r.courier.apellidos].join(' ');render();$('app-status').textContent=`Actualizado ${new Date().toLocaleTimeString('es-CO')}`;}
  catch(error){$('app-status').textContent='No fue posible consultar los pedidos: '+error.message;throw error;}
 }
 function picture(o){const items=Array.isArray(o.productos)?o.productos:[];
  const first=items.find(p=>p.imagen_url||p.imagenes?.[0]);return first?.imagen_url||first?.imagenes?.[0]||o.imagenes?.[0]||'';
 }
 function render(){
  const active=assigned.filter(o=>!o.entregado_en&&o.estado==='EN CAMINO'),delivered=assigned.filter(o=>o.entregado_en);
  $('pending-count').textContent=String(active.length);$('delivered-count').textContent=String(delivered.length);
  const list=filter==='active'?active:assigned;
  $('orders-list').innerHTML=list.map(o=>{
   const image=picture(o);const remaining=Math.max(0,Number(o.total||0)+Number(o.envio||0)-Number(o.anticipo||0));
   const items=Array.isArray(o.productos)?o.productos:[];
   const all=items.map(p=>`${esc(p.nombre||'Producto')} × ${esc(p.cantidad||1)}`).join(' · ');
   return `<article class="order-card"><div class="order-top"><div class="thumb">${image?`<img src="${esc(image)}" loading="lazy" alt="Producto del pedido">`:'<span>📦</span>'}</div><div class="order-top-text"><strong>${esc(o.numero)}</strong><p>${esc(all||'Pedido CUPISSA')}</p><span class="chip ${o.entregado_en?'done':''}">${esc(o.entregado_en?'ENTREGADO':o.estado)}</span></div></div><div class="order-details"><div><small>CLIENTE</small><strong>${esc(o.nombre_cliente)}</strong></div><div><small>TELÉFONO</small><a href="tel:${esc(o.telefono||'')}">${esc(o.telefono||'—')}</a></div><div><small>DIRECCIÓN</small><strong>${esc([o.direccion,o.barrio,o.ciudad].filter(Boolean).join(', ')||o.ubicacion||'Verificar con cliente')}</strong></div><div><small>FECHA ENTREGA</small><strong>${esc(o.fecha_entrega||'Sin fecha')}</strong></div></div>${o.nota?`<p class="note">Nota: ${esc(o.nota)}</p>`:''}<div class="payment"><span>RESTANTE A COBRAR</span><strong>${money(remaining)}</strong></div><button type="button" data-order-id="${esc(o.id)}" class="primary wide">${o.entregado_en?'Ver comprobante':'Ver ruta de entrega'}</button></article>`;
  }).join('')||'<div class="empty"><strong>No hay entregas en esta lista.</strong><p>Cuando CUPISSA te asigne un pedido aparecerá aquí.</p></div>';
  $('orders-list').querySelectorAll('[data-order-id]').forEach(button=>button.addEventListener('click',()=>{
   const order=assigned.find(o=>String(o.id)===String(button.dataset.orderId));
   if(!order)return;if(order.entregado_en)openDelivery(order.id);else startNavigation(order);
  }));
 }
 function resetSignature(){
  const canvas=$('signature-canvas');const rect=canvas.getBoundingClientRect();
  const pixelRatio=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  canvas.width=Math.max(300,Math.round(rect.width*pixelRatio));canvas.height=Math.round(195*pixelRatio);
  ctx=canvas.getContext('2d');ctx.scale(pixelRatio,pixelRatio);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width/pixelRatio,canvas.height/pixelRatio);
  ctx.strokeStyle='#1c1c2c';ctx.lineWidth=2.7;ctx.lineCap='round';ctx.lineJoin='round';signaturePoints=0;
 }
 $('delivery-photo').addEventListener('change',async e=>{
  const file=e.target.files?.[0];show('photo-preview',false);proofPhoto=null;$('photo-next').disabled=true;
  if(!file)return;
  if(!file.type.startsWith('image/')||file.size>10*1024*1024){message('proof-error','Selecciona una foto JPG/PNG/WEBP de máximo 10 MB.');return;}
  try{proofPhoto=await compressImage(file,1280,.78);$('photo-preview').src=proofPhoto;show('photo-preview',true);$('photo-next').disabled=false;message('proof-error','');}
  catch(error){message('proof-error','No se pudo procesar la fotografía. '+error.message);}
 });
 function compressImage(file,maxSide,quality){return new Promise((resolve,reject)=>{
   const url=URL.createObjectURL(file);const image=new Image();image.onload=()=>{
      try{const scale=Math.min(1,maxSide/Math.max(image.width,image.height));const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',quality));
      }catch(error){URL.revokeObjectURL(url);reject(error);}
   };image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('La imagen no se puede abrir.'));};image.src=url;
  });}
 function openProof(o){selected=o;proofPhoto=null;signaturePoints=0;show('proof-modal',true);show('photo-step',true);show('signature-step',false);$('proof-title').textContent='Pedido '+o.numero;$('proof-client').textContent=o.nombre_cliente;
  $('proof-form').reset();show('photo-preview',false);$('photo-next').disabled=true;message('proof-error','');}
 function closeProof(){show('proof-modal',false);selected=null;proofPhoto=null;}
 $('proof-close').onclick=closeProof;
 $('photo-next').onclick=()=>{if(!proofPhoto)return;show('photo-step',false);show('signature-step',true);requestAnimationFrame(resetSignature);};
 const canvas=$('signature-canvas');
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();signing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx?.beginPath();ctx?.moveTo(p.x,p.y);});
 canvas.addEventListener('pointermove',e=>{if(!signing)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();signaturePoints++;});
 ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,()=>signing=false));
 $('signature-clear').onclick=resetSignature;
 $('proof-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!selected||!proofPhoto||signaturePoints<3){message('proof-error','Adjunta la fotografía y solicita la firma del cliente antes de confirmar.');return;}
  if(!confirm('¿Confirmar la entrega de este pedido con foto y firma?'))return;
  const btn=$('proof-submit');btn.disabled=true;btn.textContent='Confirmando…';message('proof-error','');
  try{
   const signature=canvas.toDataURL('image/png');if(!navPosition){message('proof-error','No se puede confirmar sin una ubicación GPS capturada durante la navegación.');return;}
   const result=await call('complete_delivery',{pedido_id:String(selected.id),foto:proofPhoto,firma:signature,latitud:navPosition[1],longitud:navPosition[0],precision_m:window.__cupissaLastAccuracy||null});
   closeProof();await loadOrders();
   if(result.correo?.ok===false)alert('Pedido ENTREGADO correctamente. Aviso: '+(result.correo.warning||'El correo no pudo confirmarse.'));
   else alert('Entrega registrada: foto, firma y estado ENTREGADO sincronizados.');
  }catch(error){message('proof-error','No se confirmó el pedido: '+error.message);}
  finally{btn.disabled=false;btn.textContent='Confirmar entrega';}
 });
 async function openDelivery(id){try{
  const r=await call('view_delivery',{pedido_id:String(id)});
  $('delivery-signed-photo').src=r.foto_url;$('delivery-signed-signature').src=r.firma_url;show('preview-modal',true);
 }catch(error){alert('No se pudo abrir la entrega: '+error.message);}}
 $('preview-close').onclick=()=>show('preview-modal',false);
 window.addEventListener('online',()=>{if(session)loadOrders().catch(()=>{});});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)loadOrders().catch(()=>{});});
 (async()=>{try{const {data}=await db.auth.getSession();if(!data?.session)return;session=data.session;await loadOrders();show('login-screen',false);show('app-screen',true);}
 catch(_){await db.auth.signOut();show('login-screen',true);show('app-screen',false);}})();
})();
