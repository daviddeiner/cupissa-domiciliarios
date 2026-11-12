/* CUPISSA DOMICILIARIOS | Sesión independiente, sin permisos del administrador. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>'$ '+new Intl.NumberFormat('es-CO').format(Number(v||0));
 const db=window.supabase.createClient(window.CUPISSA_SUPABASE_URL,window.CUPISSA_SUPABASE_ANON_KEY,{auth:{storageKey:'cupissa-courier-session-v1',autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
 let session=null,assigned=[],selected=null,proofPhoto=null,filter='active',signaturePoints=0,signing=false,ctx;
 let installPrompt=null;
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
   return `<article class="order-card"><div class="order-top"><div class="thumb">${image?`<img src="${esc(image)}" loading="lazy" alt="Producto del pedido">`:'<span>📦</span>'}</div><div class="order-top-text"><strong>${esc(o.numero)}</strong><p>${esc(all||'Pedido CUPISSA')}</p><span class="chip ${o.entregado_en?'done':''}">${esc(o.entregado_en?'ENTREGADO':o.estado)}</span></div></div><div class="order-details"><div><small>CLIENTE</small><strong>${esc(o.nombre_cliente)}</strong></div><div><small>TELÉFONO</small><a href="tel:${esc(o.telefono||'')}">${esc(o.telefono||'—')}</a></div><div><small>DIRECCIÓN</small><strong>${esc([o.direccion,o.barrio,o.ciudad].filter(Boolean).join(', ')||o.ubicacion||'Verificar con cliente')}</strong></div><div><small>FECHA ENTREGA</small><strong>${esc(o.fecha_entrega||'Sin fecha')}</strong></div></div>${o.nota?`<p class="note">Nota: ${esc(o.nota)}</p>`:''}<div class="payment"><span>RESTANTE A COBRAR</span><strong>${money(remaining)}</strong></div><button type="button" data-order-id="${esc(o.id)}" class="primary wide">${o.entregado_en?'Ver comprobante':'Marcar entregado'}</button></article>`;
  }).join('')||'<div class="empty"><strong>No hay entregas en esta lista.</strong><p>Cuando CUPISSA te asigne un pedido aparecerá aquí.</p></div>';
  $('orders-list').querySelectorAll('[data-order-id]').forEach(button=>button.addEventListener('click',()=>{
   const order=assigned.find(o=>String(o.id)===String(button.dataset.orderId));
   if(!order)return;if(order.entregado_en)openDelivery(order.id);else openProof(order);
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
   const signature=canvas.toDataURL('image/png');const result=await call('complete_delivery',{pedido_id:String(selected.id),foto:proofPhoto,firma:signature});
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
