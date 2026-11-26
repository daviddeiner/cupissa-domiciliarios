/* CUPISSA ADMIN · cuadros de diálogo de la marca */
(() => {
 const nativeAlert = window.alert;
 let root;
 function ensure() {
  if (root) return root;
  root=document.createElement('div');root.id='cupissa-dialog-layer';
  root.style.cssText='position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.60);backdrop-filter:blur(8px);padding:20px';
  root.innerHTML=`<div role="dialog" aria-modal="true" aria-labelledby="cupissa-dialog-title" style="width:100%;max-width:440px;background:white;border:1px solid #fce7f3;border-radius:28px;box-shadow:0 28px 90px #0004;overflow:hidden;font-family:Inter,sans-serif"><div style="height:7px;background:linear-gradient(90deg,#db2777,#f472b6)"></div><div style="padding:27px"><div style="width:48px;height:48px;border-radius:16px;background:#fdf2f8;color:#db2777;display:grid;place-items:center;font-size:23px;margin-bottom:16px"><i class="fa-solid fa-circle-info"></i></div><h3 id="cupissa-dialog-title" style="font-weight:900;font-size:19px;color:#0f172a;margin:0 0 10px">CUPISSA</h3><p id="cupissa-dialog-text" style="font-size:14px;line-height:1.6;color:#475569;white-space:pre-line;overflow-wrap:anywhere"></p><div id="cupissa-dialog-fields" style="display:grid;gap:12px;margin-top:16px"></div><div id="cupissa-dialog-actions" style="display:flex;gap:10px;margin-top:24px;justify-content:flex-end"></div></div></div>`;
  document.body.append(root);return root;
 }
 function dialog(message,{title='CUPISSA',cancel=false,fields=[]}={}) {return new Promise(resolve=>{
  const el=ensure();el.style.display='flex';el.querySelector('#cupissa-dialog-title').textContent=title;el.querySelector('#cupissa-dialog-text').textContent=String(message||'');
  const fieldWrap=el.querySelector('#cupissa-dialog-fields');fieldWrap.replaceChildren();
  fields.forEach(field=>{const label=document.createElement('label');label.style.cssText='font-size:12px;font-weight:750;color:#334155;display:grid;gap:6px';label.textContent=field.label;const input=document.createElement('input');input.type=field.type||'text';input.value=field.value||'';input.required=true;input.min=field.min||'';input.style.cssText='padding:12px;border:1px solid #e2e8f0;border-radius:12px;outline-color:#db2777;font-size:14px';input.dataset.field=field.key;label.append(input);fieldWrap.append(label)});
  const actions=el.querySelector('#cupissa-dialog-actions');actions.replaceChildren();
  const finish=result=>{el.style.display='none';resolve(result)};
  if(cancel){const b=document.createElement('button');b.textContent='Cancelar';b.style.cssText='padding:11px 18px;border:0;border-radius:12px;background:#f1f5f9;color:#475569;font-weight:800;cursor:pointer';b.onclick=()=>finish(null);actions.append(b)}
  const ok=document.createElement('button');ok.textContent=cancel?'Aceptar':'Entendido';ok.style.cssText='padding:11px 22px;border:0;border-radius:12px;background:#db2777;color:#fff;font-weight:800;cursor:pointer';ok.onclick=()=>{const values={};for(const input of fieldWrap.querySelectorAll('input')){if(!input.checkValidity()){input.reportValidity();return} values[input.dataset.field]=input.value}finish(fields.length?values:true)};actions.append(ok);if(fields.length)fieldWrap.querySelector('input')?.focus();else ok.focus();
 })}
 window.cupissaDialog=dialog;
 window.cupissaConfirm=async message=>!!(await dialog(message,{title:'Confirmar acción',cancel:true}));
 window.cupissaDebtForm=()=>dialog('Registra una nueva deuda para el cliente seleccionado.',{title:'Crear nueva deuda',cancel:true,fields:[{key:'monto',label:'Monto de la deuda ($)',type:'number',min:'1'},{key:'cuotas',label:'Número de cuotas',type:'number',min:'1',value:'4'},{key:'fecha',label:'Próximo vencimiento',type:'date',value:new Date().toLocaleDateString('en-CA')},{key:'frecuencia',label:'Frecuencia (Quincenal, Semanal, Diario, Mensual)',value:'Quincenal'}]});
 // Avisos no bloqueantes para todas las operaciones del administrador.
 const toastStyles = {
  success: {icon:'✓',accent:'#15803d',bg:'#f0fdf4',border:'#bbf7d0'},
  error: {icon:'!',accent:'#be123c',bg:'#fff1f2',border:'#fecdd3'},
  warning: {icon:'!',accent:'#a16207',bg:'#fffbeb',border:'#fde68a'},
  info: {icon:'i',accent:'#be185d',bg:'#fdf2f8',border:'#fbcfe8'}
 };
 function getToastRoot() {
  let target=document.getElementById('cupissa-toast-stack');
  if(!target){
   target=document.createElement('div');target.id='cupissa-toast-stack';
   target.setAttribute('aria-live','polite');target.setAttribute('aria-atomic','false');
   target.style.cssText='position:fixed;right:16px;bottom:18px;z-index:2147483647;display:flex;flex-direction:column;gap:10px;width:min(390px,calc(100vw - 32px));pointer-events:none';
   (document.body||document.documentElement).appendChild(target);
  }
  return target;
 }
 function notify(message,type='info',duration){
  const msg=String(message??'').trim();if(!msg)return;
  const style=toastStyles[type]||toastStyles.info;
  const host=getToastRoot();
  const item=document.createElement('div');
  item.setAttribute('role',type==='error'?'alert':'status');
  item.style.cssText=`display:flex;align-items:flex-start;gap:11px;padding:14px 12px 14px 14px;border:1px solid ${style.border};border-left:4px solid ${style.accent};border-radius:14px;background:${style.bg};color:#1f2937;box-shadow:0 12px 36px rgba(15,23,42,.17);pointer-events:auto;font:500 13px/1.5 Inter,system-ui,sans-serif;overflow-wrap:anywhere;white-space:pre-line;`;
  const symbol=document.createElement('span');symbol.textContent=style.icon;
  symbol.setAttribute('aria-hidden','true');
  symbol.style.cssText=`flex:none;width:23px;height:23px;display:grid;place-items:center;border-radius:50%;background:${style.accent};color:#fff;font-weight:900`;
  const body=document.createElement('div');body.textContent=msg;body.style.cssText='flex:1;min-width:0;max-height:170px;overflow:auto';
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','Cerrar notificación');
  dismiss.style.cssText='align-self:flex-start;border:none;background:transparent;font-size:22px;line-height:1;color:#64748b;cursor:pointer;padding:0 2px';
  const remove=()=>item.remove();dismiss.addEventListener('click',remove);
  item.append(symbol,body,dismiss);host.prepend(item);
  while(host.children.length>4)host.lastElementChild.remove();
  const ms=duration??(type==='error'?10000:type==='warning'?8000:4500);
  if(ms>0)setTimeout(remove,ms);
  return item;
 }
 function guessType(message) {
  const value=String(message??'').toLowerCase();
  if(/error|no fue posible|no se pudo|no pudimos|fall[oó]|fallid|denegad|rechazad|no se encontr|no se elimin[oó]|no se guard[oó]|no coincide|no pudo|no está disponible/.test(value))return 'error';
  if(/selecciona|por favor|escribe|indica|completa|debe |no puede|ya existe|ya est[aá]|agrega|máximo|m[aá]ximo|inv[aá]lid|verifica|atenci[oó]n/.test(value))return 'warning';
  if(/correctamente|exitos|actualizad|registrad|guardad|cread|eliminad|publicad|subid|pagad|entregad|enviad|ocultad/.test(value))return 'success';
  return 'info';
 }
 window.cupissaToast=notify;
 // Se mantiene cupissaConfirm/cupissaDialog para decisiones y formularios.
 window.alert=message=>notify(message,guessType(message));
})();
