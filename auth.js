/* Autenticación de DEMOSTRACIÓN. No usar con información real ni publicar como sistema seguro. */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const USERS_KEY = 'ah_demo_users_v1';
  const SESSION_KEY = 'ah_demo_session_v1';
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = 'Honestidad2026!';
  let activeUser = null;
  let lastQrUser = null;
  const readUsers = () => { try { const v = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const saveUsers = (v) => localStorage.setItem(USERS_KEY, JSON.stringify(v));
  const randomText = (n=10) => { const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'; let out=''; const bytes=new Uint8Array(n); if (window.crypto?.getRandomValues) crypto.getRandomValues(bytes); else for(let i=0;i<n;i++) bytes[i]=Math.floor(Math.random()*256); for(const b of bytes) out += chars[b % chars.length]; return out; };
  const usernameFor = (name, users) => { const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'').slice(0,20) || 'estudiante'; let result=base, i=2; while(users.some(u=>u.username===result)) result=`${base}${i++}`; return result; };
  const showGate = () => { $('#auth-gate').hidden=false; $('#admin-shell').hidden=true; $('#contenido').hidden=true; document.querySelector('.site-header').hidden=true; document.querySelector('.site-footer').hidden=true; $('#student-welcome').hidden=true; };
  const showStudent = (u) => { activeUser=u; $('#auth-gate').hidden=true; $('#admin-shell').hidden=true; $('#contenido').hidden=false; document.querySelector('.site-header').hidden=false; document.querySelector('.site-footer').hidden=false; $('#student-welcome').hidden=false; $('#student-name').textContent=u.name; $('#student-username').textContent='@'+u.username; $('#main-nav').querySelectorAll('a').forEach(a=>a.hidden=false); window.scrollTo(0,0); };
  const showAdmin = () => { activeUser={role:'admin', username:ADMIN_USER, name:'Administrador'}; $('#auth-gate').hidden=true; $('#contenido').hidden=true; document.querySelector('.site-header').hidden=true; document.querySelector('.site-footer').hidden=true; $('#student-welcome').hidden=true; $('#admin-shell').hidden=false; renderUsers(); window.scrollTo(0,0); };
  const logout = () => { localStorage.removeItem(SESSION_KEY); activeUser=null; showGate(); $('#login-password').value=''; window.scrollTo(0,0); };
  function renderUsers() {
    const users=readUsers(); $('#user-count').textContent=users.length;
    const list=$('#users-list');
    if(!users.length){ list.innerHTML='<p class="empty-state">Aún no hay usuarios. Crea la primera cuenta de prueba.</p>'; return; }
    list.innerHTML=users.map(u=>`<div class="user-row"><div><strong>${escapeHtml(u.name)}</strong><small>@${escapeHtml(u.username)} · ${escapeHtml(u.email || 'Sin correo')}</small></div><div class="user-row-actions"><button type="button" data-qr="${escapeHtml(u.id)}">Ver QR</button><button type="button" data-delete="${escapeHtml(u.id)}">Eliminar</button></div></div>`).join('');
  }
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function makeQrUrl(u) { const base=location.href.split('#')[0]; return `${base}#login-user=${encodeURIComponent(u.username)}`; }
  function openQr(u, password=null) {
    lastQrUser=u; $('#qr-user-title').textContent=`QR · ${u.name}`; $('#qr-user-detail').textContent=`Usuario: ${u.username}`;
    $('#qr-credentials').innerHTML=`<strong>Usuario:</strong> ${escapeHtml(u.username)}${password ? `<br><strong>Contraseña temporal:</strong> ${escapeHtml(password)}` : ''}`;
    const holder=$('#qr-code'); holder.innerHTML='';
    const url=makeQrUrl(u);
    if(window.QRCode) new QRCode(holder,{text:url,width:200,height:200,colorDark:'#082f55',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    else holder.innerHTML=`<p>No se pudo cargar el generador de QR. Conecta a internet y vuelve a abrir esta ventana.<br><small>${escapeHtml(url)}</small></p>`;
    $('#qr-dialog').showModal();
  }
  $('#login-form').addEventListener('submit', e=>{
    e.preventDefault(); const username=$('#login-user').value.trim(); const password=$('#login-password').value;
    if(username===ADMIN_USER && password===ADMIN_PASS){ localStorage.setItem(SESSION_KEY, JSON.stringify({role:'admin'})); $('#login-status').textContent=''; showAdmin(); return; }
    const user=readUsers().find(u=>u.username.toLowerCase()===username.toLowerCase() && u.password===password);
    if(!user){ $('#login-status').textContent='Usuario o contraseña incorrectos. Revisa los datos de demostración.'; return; }
    localStorage.setItem(SESSION_KEY, JSON.stringify({role:'student',id:user.id})); $('#login-status').textContent='';
    const hash=location.hash; if(hash.startsWith('#login-user=')) history.replaceState(null,'',location.pathname+location.search);
    // Recargar para que script.js inicialice progreso e inscripciones usando la clave del perfil correcto.
    location.reload();
  });
  $('#create-user-form').addEventListener('submit', e=>{
    e.preventDefault(); const name=$('#new-name').value.trim(), email=$('#new-email').value.trim(); const users=readUsers();
    if(!name) return; const username=usernameFor(name,users), password=randomText(12);
    const user={id:`ah-${Date.now().toString(36)}-${randomText(5).replace(/[^a-zA-Z0-9]/g,'').slice(0,5)}`,name,email,username,password,createdAt:new Date().toISOString()};
    users.push(user); saveUsers(users); renderUsers(); $('#new-name').value=''; $('#new-email').value=''; $('#create-user-status').textContent=`Cuenta creada: ${username}. Guarda la contraseña ahora; no volverá a mostrarse.`; openQr(user,password);
  });
  $('#users-list').addEventListener('click',e=>{
    const qr=e.target.closest('[data-qr]'); const del=e.target.closest('[data-delete]');
    if(qr){ const u=readUsers().find(x=>x.id===qr.dataset.qr); if(u) openQr(u); }
    if(del){ const users=readUsers(), u=users.find(x=>x.id===del.dataset.delete); if(u && confirm(`¿Eliminar la cuenta de ${u.name}?`)){ saveUsers(users.filter(x=>x.id!==u.id)); renderUsers(); } }
  });
  $('#admin-logout').addEventListener('click',logout); $('#student-logout').addEventListener('click',logout);
  $('#show-my-qr').addEventListener('click',()=>{if(activeUser && activeUser.role!=='admin') openQr(activeUser);});
  $('#close-qr').addEventListener('click',()=>$('#qr-dialog').close());
  $('#download-qr').addEventListener('click',()=>{
    const img=$('#qr-code img'), canvas=$('#qr-code canvas'); let url=img?.src || canvas?.toDataURL('image/png');
    if(!url){ alert('El QR todavía no está disponible.'); return; } const a=document.createElement('a'); a.href=url; a.download=`academic-honesty-qr-${lastQrUser?.username || 'usuario'}.png`; a.click();
  });
  const prefill=()=>{ const m=location.hash.match(/(?:^#|&)login-user=([^&]+)/); if(m){ try{$('#login-user').value=decodeURIComponent(m[1]);}catch{} $('#qr-login-note').hidden=false; } };
  let cameraStream=null, scannerFrame=null, scannerActive=false, barcodeDetector=null, lastScanAt=0;
  const stopScanner=()=>{
    scannerActive=false;
    if(scannerFrame!==null) cancelAnimationFrame(scannerFrame);
    scannerFrame=null;
    if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop()); cameraStream=null;}
    const video=$('#qr-video'); if(video){video.pause(); video.srcObject=null;}
    const dialog=$('#scanner-dialog'); if(dialog.open) dialog.close();
  };
  const acceptScannedQr=(raw)=>{
    let username='';
    try {
      const decoded=String(raw).trim();
      const hashMatch=decoded.match(/(?:#|&)login-user=([^&]+)/);
      if(hashMatch) username=decodeURIComponent(hashMatch[1]);
      else if(!decoded.includes('://') && /^[a-z0-9.]+$/i.test(decoded)) username=decoded;
      else { const url=new URL(decoded); const m=url.hash.match(/(?:^#|&)login-user=([^&]+)/); if(m) username=decodeURIComponent(m[1]); }
    } catch {}
    if(!username){$('#scanner-status').textContent='Este QR no parece ser una credencial de Academic Honesty. Intenta con el QR de un usuario.'; return;}
    const user=readUsers().find(u=>u.username.toLowerCase()===username.toLowerCase());
    if(!user){$('#scanner-status').textContent='El usuario de ese QR no existe en este navegador. En esta demo, las cuentas son locales.'; return;}
    $('#login-user').value=user.username; $('#login-password').focus(); $('#qr-login-note').hidden=false;
    $('#login-status').textContent='QR reconocido. Introduce la contraseña para completar el acceso.';
    stopScanner();
  };
  async function scanLoop(){
    if(!scannerActive) return;
    const video=$('#qr-video'), canvas=$('#qr-canvas');
    if(video.readyState>=HTMLMediaElement.HAVE_ENOUGH_DATA && performance.now()-lastScanAt>120){
      lastScanAt=performance.now();
      try {
        let result=null;
        if(barcodeDetector){const codes=await barcodeDetector.detect(video); if(codes.length) result=codes[0].rawValue;}
        else if(window.jsQR){const ctx=canvas.getContext('2d',{willReadFrequently:true}); canvas.width=video.videoWidth; canvas.height=video.videoHeight; ctx.drawImage(video,0,0,canvas.width,canvas.height); const pixels=ctx.getImageData(0,0,canvas.width,canvas.height); const code=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'}); if(code) result=code.data;}
        if(result){acceptScannedQr(result); return;}
      } catch(err) { /* Un fotograma ilegible se vuelve a intentar. */ }
    }
    scannerFrame=requestAnimationFrame(scanLoop);
  }
  $('#open-qr-scanner').addEventListener('click',async()=>{
    const dialog=$('#scanner-dialog');
    if(!navigator.mediaDevices?.getUserMedia){$('#login-status').textContent='Este navegador no permite usar la cámara aquí. Abre la web mediante HTTPS o localhost y vuelve a intentarlo.'; return;}
    if(!window.BarcodeDetector && !window.jsQR){$('#login-status').textContent='No se pudo cargar el lector QR. Revisa tu conexión a internet e inténtalo de nuevo.'; return;}
    try {
      dialog.showModal(); $('#scanner-status').textContent='Solicitando acceso a la cámara…';
      cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      const video=$('#qr-video'); video.srcObject=cameraStream; await video.play();
      barcodeDetector=null;
      if('BarcodeDetector' in window){try{barcodeDetector=new BarcodeDetector({formats:['qr_code']});}catch{barcodeDetector=null;}}
      scannerActive=true; $('#scanner-status').textContent='Apunta la cámara al QR del usuario…'; scanLoop();
    } catch(err){
      stopScanner();
      $('#login-status').textContent=err?.name==='NotAllowedError'?'No se concedió permiso para usar la cámara. Permite el acceso en el navegador e inténtalo otra vez.':'No se pudo abrir la cámara. Comprueba los permisos y que la página esté en HTTPS o localhost.';
    }
  });
  $('#stop-qr-scanner').addEventListener('click',stopScanner);
  $('#scanner-dialog').addEventListener('close',()=>{if(cameraStream) stopScanner();});
  function init(){
    prefill();
    let session=null; try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{}
    if(session?.role==='admin') showAdmin();
    else if(session?.role==='student'){ const u=readUsers().find(x=>x.id===session.id); if(u) showStudent(u); else logout(); }
    else showGate();
  }
  window.addEventListener('hashchange',prefill); init();
})();
