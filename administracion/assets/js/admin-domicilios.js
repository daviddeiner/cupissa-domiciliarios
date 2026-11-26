/* CUPISSA ADMIN | Domicilios. Módulo separado: no altera créditos, productos ni checkout. */
(() => {
 'use strict';
 const db=window.supabaseClient || (typeof supabaseClient!=='undefined'?supabaseClient:null);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
 const money=v=>'$ '+new Intl.NumberFormat('es-CO').format(Number(v||0));
 const previousSwitch=window.switchTab;
 let couriers=[],assignments=[],pending=[],pickups=[],deliveredRentals=[],activeOrders=[],currentTab='clientes',loading=false;
 function status(message,error=false){const el=$('domicilios-status');if(el){el.textContent=message;el.classList.toggle('text-rose-700',error);}}
 async function request(action,body={}){
   if(!db) throw new Error('No existe una conexión activa con Supabase.');
   const {data:authData,error:authError}=await db.auth.getSession();
   if(authError||!authData?.session?.access_token) {
     throw new Error('Inicia sesión nuevamente como administrador antes de crear el domiciliario.');
   }
   const {data,error}=await db.functions.invoke('cupissa-domicilios',{
     body:{action,...body},
     headers:{Authorization:`Bearer ${authData.session.access_token}`}
   });
   if(error){
     let detail='';let statusCode='';
     // Supabase FunctionsHttpError conserva la respuesta HTTP original
     // en context: recuperar su JSON sin mostrar únicamente "non-2xx".
     const response=error.context;
     if(response && typeof response.clone==='function'){
       try{
         const payload=await response.clone().json();
         detail=typeof payload?.error==='string'?payload.error:(payload?.error?.message||payload?.message||payload?.detail||JSON.stringify(payload?.error||payload||{}));
         if(payload?.code)detail+=` [${payload.code}]`;
       }catch(_){
         try{detail=String(await response.clone().text()).slice(0,350);}catch(_){}
       }
       statusCode=response.status?`HTTP ${response.status}`:'';
       const gatewayCode=response.headers?.get?.('sb-error-code');
       if(gatewayCode && !detail.includes(gatewayCode))detail+=` [${gatewayCode}]`;
     }
     if(!detail)detail=error.message||'La función rechazó la operación.';
     if(!detail || /non-2xx/i.test(detail))detail='La función rechazó la solicitud. Comprueba su despliegue y autenticación en Supabase.';
     throw new Error([statusCode,detail].filter(Boolean).join(' — '));
   }
   if(!data?.ok)throw new Error(typeof data?.error==='string'?data.error:(data?.error?.message||JSON.stringify(data?.error||{})||'No se confirmó la operación de domicilios.'));
   return data;
 }
 function photo(o){const p=Array.isArray(o.productos)?o.productos[0]:null;
   return p?.imagen_url||p?.imagenes?.[0]||o.imagenes?.[0]||'';
 }
 async function fetchAllFiltered(table,field,value,order='created_at') {
   const rows=[];let offset=0;
   while(true){
     let query=db.from(table).select('*');
     if(field)query=query.eq(field,value);
     if(order)query=query.order(order,{ascending:false});
     const {data,error}=await query.range(offset,offset+999);
     if(error)throw error;
     rows.push(...(data||[]));
     if((data||[]).length<1000)break;
     offset+=1000;
   }
   return {data:rows,error:null};
 }
 async function fetchData(){
   if(loading||!db)return;loading=true;status('Consultando pedidos de despacho…');
   try{
     const [c,d,orders,rentals,collection,active]=await Promise.all([
       db.from('cupissa_domiciliarios').select('id,nombres,apellidos,telefono,activo').order('creado_en',{ascending:false}).limit(500),
       db.from('cupissa_domicilios').select('pedido_id,domiciliario_id,entregado_en,foto_path,firma_path').order('asignado_en',{ascending:false}).limit(1000),
       db.from('pedidos_web').select('*').eq('estado','EN DEPARTAMENTO DE DESPACHO').order('fecha_entrega',{ascending:true}).limit(1000),
       fetchAllFiltered('pedidos_web','estado','ENTREGADO'),
       fetchAllFiltered('cupissa_recogidas_alquiler',null,null,'creado_en'),
       db.from('pedidos_web').select('*').eq('estado','EN CAMINO').limit(1000)
     ]);
     if(c.error)throw c.error;if(d.error)throw d.error;if(orders.error)throw orders.error;if(rentals.error)throw rentals.error;if(collection.error)throw collection.error;if(active.error)throw active.error;
     couriers=c.data||[];assignments=d.data||[];pending=orders.data||[];pickups=collection.data||[];activeOrders=active.data||[];deliveredRentals=(rentals.data||[]).filter(o=>String(o.tipo_pedido||o.tipo_servicio||'').toUpperCase()==='ALQUILER'||(Array.isArray(o.productos)&&o.productos.some(p=>String(p.modalidad||'').toUpperCase()==='ALQUILER'))).filter(o=>!pickups.some(p=>String(p.pedido_id)===String(o.id)&&p.recogido_en));render();
     status(`${pending.length} pedido(s) por asignar · ${couriers.filter(c=>c.activo).length} domiciliario(s) activo(s).`);
   }catch(error){status('No se pudieron consultar los domicilios. Ejecuta el SQL e instala la Edge Function cupissa-domicilios. '+(error.message||error),true);}
   finally{loading=false;}
 }
 function render(){
   const root=$('domicilios-pendientes'),assigned=$('domicilios-en-camino');
   if(root){root.innerHTML=pending.map(o=>{
      const choices=couriers.filter(c=>c.activo).map(c=>`<option value="${esc(c.id)}">${esc(c.nombres+' '+c.apellidos)} · ${esc(c.telefono)}</option>`).join('');
      const value=Number(o.total||0)+Number(o.envio??o.domicilio_envio??0)-Number(o.anticipo||0);
      const src=photo(o);
      return `<article class="delivery-admin-card"><div class="flex gap-3"><div class="delivery-admin-photo">${src?`<img loading="lazy" src="${esc(src)}" alt="Foto del producto">`:'<i class="fa-solid fa-box"></i>'}</div><div class="min-w-0 flex-1"><p class="text-xs font-black">${esc(o.numero_pedido||o.id)}</p><p class="text-[11px] text-slate-500">Entrega: ${esc(o.fecha_entrega||'Sin fecha')}</p><p class="text-[11px] text-slate-600 mt-1">${esc(o.cliente_nombre||'Cliente CUPISSA')} · ${esc(o.contacto||o.telefono)}</p><strong class="block text-pink-700 text-sm mt-1">Por cobrar: ${money(Math.max(0,value))}</strong></div></div><div class="flex flex-col sm:flex-row gap-2 mt-3"><select class="delivery-admin-select" data-assign="${esc(o.id)}" aria-label="Domiciliario para este pedido"><option value="">Selecciona domiciliario</option>${choices}</select><button type="button" class="delivery-admin-primary" data-assign-btn="${esc(o.id)}" ${choices?'':'disabled'}>Asignar y marcar EN CAMINO</button></div></article>`;
   }).join('')||'<p class="p-5 text-slate-500 text-sm">No hay pedidos pendientes en departamento de despacho.</p>';
    root.querySelectorAll('[data-assign-btn]').forEach(button=>button.addEventListener('click',()=>assignOrder(button.dataset.assignBtn,button)));
   }
   if(assigned){
     const recentlyAssigned=assignments.filter(d=>!d.entregado_en && activeOrders.some(o=>String(o.id)===String(d.pedido_id))).slice(0,100);
     assigned.innerHTML=recentlyAssigned.map(d=>{
       const c=couriers.find(x=>x.id===d.domiciliario_id);
       const o=activeOrders.find(x=>String(x.id)===String(d.pedido_id))||{};
       const src=photo(o), remaining=Math.max(0,Number(o.total||0)+Number(o.envio??o.domicilio_envio??0)-Number(o.anticipo||0));
       return `<div class="delivery-admin-card"><div class="flex gap-3"><div class="delivery-admin-photo">${src?`<img loading="lazy" src="${esc(src)}" alt="Producto">`:'<i class="fa-solid fa-box"></i>'}</div><div><strong>Pedido ${esc(o.numero_pedido||d.pedido_id)}</strong><p class="text-xs">${esc(c?c.nombres+' '+c.apellidos:'Domiciliario')} · EN CAMINO</p><strong class="text-pink-700">Por cobrar: ${money(remaining)}</strong></div></div></div>`;
     }).join('')||'<p class="text-xs text-slate-500">Sin repartos en camino.</p>';
   }
   const pickupRoot=$('domicilios-recogidas');
   if(pickupRoot){
     const choices=couriers.filter(c=>c.activo).map(c=>`<option value="${esc(c.id)}">${esc(c.nombres+' '+c.apellidos)}</option>`).join('');
     pickupRoot.innerHTML=deliveredRentals.map(o=>{
       const registered=pickups.find(p=>String(p.pedido_id)===String(o.id));
       const src=photo(o), courier=couriers.find(c=>c.id===registered?.domiciliario_id);
       return `<article class="delivery-admin-card"><div class="flex gap-3"><div class="delivery-admin-photo">${src?`<img src="${esc(src)}" loading="lazy" alt="Producto de alquiler">`:'<i class="fa-solid fa-box"></i>'}</div><div><strong>${esc(o.numero_pedido||o.id)}</strong><p class="text-xs">${esc(o.cliente_nombre||'Cliente CUPISSA')}</p><p class="text-xs text-pink-700 font-bold">${courier?'RECOGIDA · '+esc(courier.nombres+' '+courier.apellidos):'POR ASIGNAR RECOGIDA'}</p></div></div><div class="flex gap-2 mt-3"><select class="delivery-admin-select" data-pickup-select="${esc(o.id)}"><option value="">Selecciona domiciliario</option>${couriers.filter(c=>c.activo).map(c=>`<option value="${esc(c.id)}" ${registered?.domiciliario_id===c.id?'selected':''}>${esc(c.nombres+' '+c.apellidos)}</option>`).join('')}</select><button type="button" class="delivery-admin-primary" data-pickup-assign="${esc(o.id)}">${registered?'Reasignar':'Asignar recogida'}</button></div></article>`;
     }).join('')||'<p class="text-xs text-slate-500">No hay alquileres entregados pendientes de recogida.</p>';
     pickupRoot.querySelectorAll('[data-pickup-assign]').forEach(button=>button.addEventListener('click',async()=>{
       const id=button.dataset.pickupAssign,courier=pickupRoot.querySelector(`[data-pickup-select="${CSS.escape(id)}"]`)?.value;
       if(!courier)return alert('Selecciona un domiciliario.');
       button.disabled=true;
       try{await request('assign_pickup',{pedido_id:id,domiciliario_id:courier});await fetchData();}
       catch(error){alert('No se pudo asignar la recogida: '+error.message);button.disabled=false;}
     }));

   }
 }
 async function assignOrder(id,button){
   const select=$('domicilios-pendientes')?.querySelector(`[data-assign="${CSS.escape(id)}"]`);
   const courier=select?.value;
   if(!courier)return alert('Selecciona un domiciliario registrado.');
   if(!confirm(`¿Asignar el pedido ${id} y marcarlo EN CAMINO?`))return;
   button.disabled=true;button.textContent='Asignando…';
   try{
     const {data,error}=await db.rpc('cupissa_domicilios_asignar_admin',{p_pedido_id:String(id),p_domiciliario_id:courier});
     if(error||data!==true)throw new Error(error?.message||'Supabase no confirmó la asignación');
     await fetchData();window.cupissaLoadWebOrders?.();
   }catch(error){alert('No fue posible asignar el domicilio: '+error.message);button.disabled=false;button.textContent='Asignar y marcar EN CAMINO';}
 }
 window.cupissaAbrirCrearDomiciliario=function(){ $('domiciliario-create-form')?.classList.toggle('hidden'); };
 window.cupissaCrearDomiciliario=async function(event){
   event.preventDefault();
   const form=event.currentTarget;
   const btn=form.querySelector('[type=submit]');
   const field=name=>String(form.elements.namedItem(name)?.value||'').trim();
   const payload={
     nombres:field('nombres'),apellidos:field('apellidos'),
     telefono:field('telefono'),password:form.elements.namedItem('password')?.value||''
   };
   btn.disabled=true;
   try{
     const data=await request('create_courier',payload);
     form.reset();form.classList.add('hidden');
     status('Domiciliario creado correctamente.');
     await fetchData();
     alert(`Domiciliario creado: ${data.domiciliario.nombres}. Entrará con el teléfono y la contraseña asignados.`);
   }catch(error){
     const msg=String(error?.message||error);
     status(`No se pudo crear domiciliario: ${msg}`,true);
     alert(`No se pudo crear el domiciliario:\n${msg}\n\nRevisa Edge Functions → cupissa-domicilios → Logs si continúa el error.`);
   }finally{btn.disabled=false;}
 };
 window.cupissaVerEntregaAdmin=async function(id){
   try{
     const data=await request('view_delivery',{pedido_id:String(id)});
     const node=document.createElement('div');node.className='delivery-proof-overlay';
     node.innerHTML=`<div class="delivery-proof-card" role="dialog" aria-modal="true" aria-label="Comprobante de entrega"><button type="button" class="delivery-proof-close" aria-label="Cerrar">Cerrar ×</button><h3>Entrega confirmada</h3><p class="text-xs text-slate-500 mb-3">${esc(new Date(data.entregado_en).toLocaleString('es-CO'))}</p><p class="font-bold text-xs mb-2">Foto de la entrega</p><img src="${esc(data.foto_url)}" alt="Fotografía de la entrega"><p class="font-bold text-xs my-2">Firma del cliente</p><img src="${esc(data.firma_url)}" alt="Firma del cliente"></div>`;
     node.querySelector('button').onclick=()=>node.remove();node.addEventListener('click',e=>{if(e.target===node)node.remove()});document.body.appendChild(node);
   }catch(error){alert(error.message);}
 };
 // Pedido: insertar solo cuando la entrega tiene las dos evidencias.
 const oldView=window.viewWebOrder;
 if(typeof oldView==='function') window.viewWebOrder=function(id){
   oldView(id);
   (async()=>{
     let proof=null;
     try {
       const {data,error}=await db.rpc('cupissa_domicilios_entregas_admin');
       if(!error && Array.isArray(data)) proof=data.find(d=>String(d.pedido_id)===String(id));
       if(error) console.warn('[CUPISSA] Consulta de entregas administracion:',error.message);
     } catch(error){ console.warn('[CUPISSA] Consulta de entrega:',error); }
     if(!proof){
       const {data,error}=await db.from('cupissa_domicilios')
         .select('pedido_id,entregado_en,foto_path,firma_path').eq('pedido_id',String(id)).maybeSingle();
       if(!error && data?.entregado_en && data?.foto_path && data?.firma_path) proof=data;
     }
     if(!proof) return;
     const modal=document.querySelector('#admin-web-modal');
     const container=modal?.querySelector('.admin-web-modal-content');
     if(!container || container.querySelector('.cupissa-admin-proof-button'))return;
     const b=document.createElement('button');b.type='button';
     b.className='delivery-admin-primary cupissa-admin-proof-button mt-4';
     b.textContent='Ver entrega · Fotografía y firma del cliente';
     b.onclick=()=>window.cupissaVerEntregaAdmin(id);
     container.appendChild(b);
   })().catch(error=>console.warn('[CUPISSA] Ver entrega:',error));
 };
 window.cupissaCargarDomicilios=fetchData;
 window.switchTab=function(tab){
   if(tab==='domicilios'){
      previousSwitch?.('clientes');
      // No ocultar Créditos por separado: es una subpestaña de Clientes.
      ['tab-section-clientes','tab-section-catalogo','tab-section-web-pedidos','tab-section-alquileres','tab-section-vistas'].forEach(id=>$(id)?.classList.add('hidden'));
      $('tab-section-domicilios')?.classList.remove('hidden');
      fetchData();
   }else{ $('tab-section-domicilios')?.classList.add('hidden');previousSwitch?.(tab); }
   currentTab=tab;
   document.querySelectorAll('[data-app-tab]').forEach(button=>button.classList.toggle('is-active',button.dataset.appTab===(tab==='web-clientes'?'clientes':tab)));
   ['', '-mob'].forEach(suffix=>$('tab-btn-domicilios'+suffix)?.classList.toggle('fuchsia-text',tab==='domicilios'));
   $('cupissa-admin-more-menu')?.classList.add('hidden');
 };
 document.addEventListener('DOMContentLoaded',()=>{
   $('cupissa-admin-more')?.addEventListener('click',()=>$('cupissa-admin-more-menu')?.classList.toggle('hidden'));
   $('domicilios-refresh')?.addEventListener('click',fetchData);
 });
})();
