const SUPABASE_URL = window.CUPISSA_SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = localStorage.getItem('cupissa_supabase_public_key') || window.CUPISSA_SUPABASE_ANON_KEY || '';
        let supabaseClient = null;
        function cupissaCreateSupabaseClient() {
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY || /PEGA_AQUI|YOUR_|CHANGE_ME/i.test(SUPABASE_ANON_KEY)) return null;
            if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') return null;
            try { return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{storageKey:'cupissa-courier-session-v1',autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}}); }
            catch (error) { console.error('No fue posible iniciar la conexión de Supabase:', error); return null; }
        }
        supabaseClient = cupissaCreateSupabaseClient();

        function cupissaIsSecretApiKey(value) {
            const key = String(value || '').trim();
            if (/^sb_secret_/i.test(key)) return true;
            const parts = key.split('.');
            if (parts.length === 3) {
                try {
                    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
                    const payload = JSON.parse(atob(padded));
                    return String(payload.role || '').toLowerCase() === 'service_role';
                } catch (_) { return false; }
            }
            return false;
        }

        window.openSupabaseConfig = function () {
            const panel = document.getElementById('admin-supabase-config-panel');
            if (panel) panel.classList.remove('hidden');
            const input = document.getElementById('admin-supabase-public-key');
            if (input) {
                try { input.value = localStorage.getItem('cupissa_supabase_public_key') || ''; } catch (_) { input.value = ''; }
                input.focus();
            }
        };
        window.closeSupabaseConfig = function () {
            document.getElementById('admin-supabase-config-panel')?.classList.add('hidden');
        };
        window.saveSupabasePublicKey = function (event) {
            event?.preventDefault();
            const input = document.getElementById('admin-supabase-public-key');
            const feedback = document.getElementById('admin-supabase-config-error');
            const key = String(input?.value || '').trim();
            const showError = message => { if (feedback) { feedback.textContent = message; feedback.classList.remove('hidden'); } };
            if (!key) return showError('Pega la clave pública publishable o anon de este proyecto.');
            if (cupissaIsSecretApiKey(key) || /^sb_secret_/i.test(key)) {
                return showError('Esa es una clave secreta o service_role. No se puede usar en el navegador. Copia la clave publishable o anon.');
            }
            if (!key.startsWith('sb_publishable_') && !key.startsWith('eyJ')) {
                return showError('El formato no coincide con una clave publishable (sb_publishable_) ni con la clave anon antigua (eyJ…).');
            }
            try {
                localStorage.setItem('cupissa_supabase_public_key', key);
                localStorage.removeItem('cupissa_admin_logged');
                window.location.reload();
            } catch (error) {
                showError('El navegador no permitió guardar la configuración.');
            }
        };


const LOGOUT_URL="../";

async function verifyAdmin(){
 if(!supabaseClient) throw new Error('No hay conexión con Supabase.');
 const {data,error}=await supabaseClient.auth.getUser();
 if(error || String(data?.user?.email||'').toLowerCase()!==String(window.CUPISSA_ADMIN_EMAIL||'').toLowerCase()) throw new Error('Acceso reservado al administrador autorizado.');
}
async function enterAdmin(authenticatedUser){if(authenticatedUser){if(String(authenticatedUser.email||'').toLowerCase()!==String(window.CUPISSA_ADMIN_EMAIL||'').toLowerCase())throw new Error('Acceso no autorizado.');}else await verifyAdmin(); document.getElementById('private-content').classList.remove('hidden');document.getElementById('admin-login-screen').classList.add('hidden'); void Promise.resolve().then(startModule).catch(e=>{console.warn(e);alert('No se pudo cargar el módulo: '+e.message);});}
async function handleAdminLogin(e){ e.preventDefault();const button=e.target.querySelector('[type=submit]');const box=document.getElementById('admin-login-error');box.classList.add('hidden');button.disabled=true;try{
 const email=document.getElementById('admin-user-email').value.trim(); if(email.toLowerCase()!==String(window.CUPISSA_ADMIN_EMAIL).toLowerCase())throw new Error('Correo no autorizado.');
 if(!supabaseClient)throw new Error('No hay conexión con Supabase.');
 const {data,error}=await supabaseClient.auth.signInWithPassword({email,password:document.getElementById('admin-user-pass').value});if(error)throw error; if(!data?.user)throw new Error('No se recibió una sesión válida.'); await enterAdmin(data.user);
 }catch(error){box.querySelector('span').textContent=error.message||'No fue posible iniciar sesión.';box.classList.remove('hidden');}finally{button.disabled=false;}}
async function handleAdminLogout(){try{await supabaseClient?.auth.signOut({scope:'local'});}finally{location.replace(LOGOUT_URL);}}
document.addEventListener('DOMContentLoaded',async()=>{try{if(!supabaseClient){document.getElementById('admin-supabase-config-notice')?.classList.remove('hidden');return;}const {data}=await supabaseClient.auth.getSession();if(data?.session)await enterAdmin();}catch(e){console.warn(e.message);}});
