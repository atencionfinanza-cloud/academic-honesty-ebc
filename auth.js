
/* Academic Honesty - Autenticación con Supabase */
(() => {
  'use strict';

  // Corregimos el selector para consultar elementos del documento.
  const el = (selector) => document.querySelector(selector);

  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_KEY = window.SUPABASE_PUBLISHABLE_KEY;

  let supabase = null;
  let activeUser = null;
  window.AH_SUPABASE = null;
  window.AH_CURRENT_USER = null;
  let lastQrUser = null;
  let cameraStream = null;
  let scannerFrame = null;
  let scannerActive = false;
  let barcodeDetector = null;
  let lastScanAt = 0;

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));

  const randomText = (length = 14) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => chars[byte % chars.length]).join('');
  };

  function setStatus(selector, message) {
    const node = el(selector);
    if (node) node.textContent = message;
  }

  function hidePageSections() {
    const header = el('.site-header');
    const footer = el('.site-footer');

    if (header) header.hidden = true;
    if (footer) footer.hidden = true;
    if (el('#student-welcome')) el('#student-welcome').hidden = true;
    if (el('#auth-gate')) el('#auth-gate').hidden = true;
    if (el('#admin-shell')) el('#admin-shell').hidden = true;
    if (el('#contenido')) el('#contenido').hidden = true;
  }

  function showGate() {
    hidePageSections();
    if (el('#auth-gate')) el('#auth-gate').hidden = false;
    activeUser = null;
  }

  function showStudent(user) {
    activeUser = user;
    window.AH_CURRENT_USER = user;
    hidePageSections();

    if (el('#contenido')) el('#contenido').hidden = false;
    if (el('#student-welcome')) el('#student-welcome').hidden = false;

    const header = el('.site-header');
    const footer = el('.site-footer');
    if (header) header.hidden = false;
    if (footer) footer.hidden = false;

    if (el('#student-name')) el('#student-name').textContent = user.name;
    if (el('#student-username')) {
      el('#student-username').textContent = '@' + user.username;
    }

    if (el('#main-nav')) {
      el('#main-nav').querySelectorAll('a').forEach(link => {
        link.hidden = false;
      });
    }

    window.scrollTo(0, 0);
  }

  async function showAdmin() {
    activeUser = {
      role: 'admin',
      username: 'admin',
      name: 'Administrador'
    };

    window.AH_CURRENT_USER = activeUser;
    hidePageSections();
    if (el('#admin-shell')) el('#admin-shell').hidden = false;

    await renderUsers();
    window.scrollTo(0, 0);
  }

  async function getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, role')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async function establishSession(authUser) {
    const profile = await getProfile(authUser.id);

    const user = {
      id: authUser.id,
      username: profile.username || authUser.email || '',
      name: profile.full_name || authUser.user_metadata?.full_name || 'Usuario',
      role: profile.role
    };

    if (user.role === 'admin') {
      await showAdmin();
    } else {
      showStudent(user);
    }

    return user;
  }

  async function logout() {
    stopScanner();

    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error al cerrar sesión:', error);

    activeUser = null;
    window.AH_CURRENT_USER = null;
    showGate();

    if (el('#login-password')) el('#login-password').value = '';
    setStatus('#login-status', '');
    window.scrollTo(0, 0);
  }

  async function callStudentFunction(payload) {
    const { data, error } = await supabase.functions.invoke(
      'manage-students',
      { body: payload }
    );

    if (error) {
      let detail = error.message || 'No se pudo completar la operación.';
      try {
        if (error.context) {
          const response = await error.context.json();
          if (response?.error) detail = response.error;
          else if (response?.message) detail = response.message;
        }
      } catch (_) {}
      throw new Error(detail);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function renderUsers() {
    const list = el('#users-list');
    const count = el('#user-count');
    if (!list) return;

    list.innerHTML = '<p class="empty-state">Cargando alumnos…</p>';

    try {
      const result = await callStudentFunction({ action: 'list_students' });
      const users = result.students || result.users || result.data || [];

      if (count) count.textContent = users.length;

      if (!users.length) {
        list.innerHTML =
          '<p class="empty-state">Todavía no hay alumnos registrados. Crea la primera cuenta.</p>';
        return;
      }

      list.innerHTML = users.map(user => `
        <div class="user-row">
          <div>
            <strong>${escapeHtml(user.full_name || user.name || 'Alumno')}</strong>
            <small>@${escapeHtml(user.username || '')}</small>
          </div>
          <div class="user-row-actions">
            <button type="button" data-qr="${escapeHtml(user.id)}">Ver QR</button>
            <button type="button" data-delete="${escapeHtml(user.id)}">Eliminar</button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('[data-qr]').forEach(button => {
        button.addEventListener('click', () => {
          const user = users.find(item => item.id === button.dataset.qr);
          if (user) openQr({
            id: user.id,
            username: user.username,
            name: user.full_name || user.name || 'Alumno'
          });
        });
      });

      list.querySelectorAll('[data-delete]').forEach(button => {
        button.addEventListener('click', async () => {
          const user = users.find(item => item.id === button.dataset.delete);
          if (!user) return;

          const name = user.full_name || user.name || user.username;
          if (!confirm(`¿Eliminar la cuenta de ${name}? Esta acción no se puede deshacer.`)) {
            return;
          }

          button.disabled = true;
          try {
            await callStudentFunction({
              action: 'delete_student',
              user_id: user.id
            });
            await renderUsers();
            setStatus('#create-user-status', 'La cuenta se eliminó correctamente.');
          } catch (error) {
            alert('No se pudo eliminar la cuenta: ' + error.message);
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      list.innerHTML =
        '<p class="empty-state">No se pudo cargar la lista. Comprueba la conexión y los permisos del administrador.</p>';
      console.error('Error al cargar alumnos:', error);
    }
  }

  function usernameBase(name) {
    return name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '.')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 24) || 'alumno';
  }

  function makeQrUrl(user) {
    return `${location.href.split('#')[0]}#login-user=${encodeURIComponent(user.username)}`;
  }

  function openQr(user, password = null) {
    lastQrUser = user;

    if (el('#qr-user-title')) {
      el('#qr-user-title').textContent = `QR · ${user.name}`;
    }
    if (el('#qr-user-detail')) {
      el('#qr-user-detail').textContent = `Usuario: ${user.username}`;
    }
    if (el('#qr-credentials')) {
      el('#qr-credentials').innerHTML =
        `<strong>Usuario:</strong> ${escapeHtml(user.username)}` +
        (password
          ? `<br><strong>Contraseña temporal:</strong> ${escapeHtml(password)}`
          : '');
    }

    const holder = el('#qr-code');
    if (!holder) return;
    holder.innerHTML = '';

    const url = makeQrUrl(user);
    if (window.QRCode) {
      new QRCode(holder, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#082f55',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      holder.textContent = 'No se pudo cargar el generador de QR. Recarga la página.';
    }

    if (el('#qr-dialog')) el('#qr-dialog').showModal();
  }

  function prefillUsername() {
    const match = location.hash.match(/(?:^#|&)login-user=([^&]+)/);
    if (!match) return;

    try {
      if (el('#login-user')) {
        el('#login-user').value = decodeURIComponent(match[1]);
      }
      if (el('#qr-login-note')) el('#qr-login-note').hidden = false;
    } catch (_) {}
  }

  async function login(event) {
    event.preventDefault();

    const enteredUsername = el('#login-user')?.value.trim() || '';
    const password = el('#login-password')?.value || '';
    if (!enteredUsername || !password) {
      setStatus('#login-status', 'Escribe tu usuario y contraseña.');
      return;
    }

    const submitButton = el('#login-form')?.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setStatus('#login-status', 'Verificando acceso…');

    try {
      // El administrador entra con su correo real.
      // El alumno entra con su usuario y correo interno.
      const email = enteredUsername.includes('@')
        ? enteredUsername
        : `${enteredUsername.toLowerCase()}@students.academic-honesty.invalid`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await establishSession(data.user);
      setStatus('#login-status', '');

      if (location.hash.includes('login-user=')) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (error) {
      console.error('Error de inicio de sesión:', error);
      setStatus('#login-status', 'Usuario o contraseña incorrectos, o cuenta sin permisos. Revisa los datos e inténtalo de nuevo.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function createStudent(event) {
    event.preventDefault();

    if (!activeUser || activeUser.role !== 'admin') {
      setStatus('#create-user-status', 'No tienes permisos para crear cuentas.');
      return;
    }

    const name = el('#new-name')?.value.trim() || '';
    if (!name) {
      setStatus('#create-user-status', 'Escribe el nombre del alumno.');
      return;
    }

    const submitButton = el('#create-user-form')?.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setStatus('#create-user-status', 'Creando cuenta segura…');

    try {
      // Se genera una contraseña temporal para entregar al alumno.
      const password = randomText(14);
      const username = usernameBase(name);

      const result = await callStudentFunction({
        action: 'create_student',
        full_name: name,
        username,
        password
      });

      const created = result.student || result.user || result;
      const user = {
        id: created.id,
        username: created.username || username,
        name: created.full_name || name
      };

      if (el('#new-name')) el('#new-name').value = '';
      if (el('#new-email')) el('#new-email').value = '';

      setStatus(
        '#create-user-status',
        `Cuenta creada. Entrega al alumno su usuario y contraseña temporal; guarda los datos antes de cerrar esta ventana.`
      );

      await renderUsers();
      openQr(user, password);
    } catch (error) {
      console.error('Error al crear alumno:', error);
      setStatus('#create-user-status', 'No se pudo crear la cuenta: ' + error.message);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function stopScanner() {
    scannerActive = false;
    if (scannerFrame !== null) cancelAnimationFrame(scannerFrame);
    scannerFrame = null;

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }

    const video = el('#qr-video');
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    const dialog = el('#scanner-dialog');
    if (dialog?.open) dialog.close();
  }

  function acceptScannedQr(raw) {
    let username = '';
    try {
      const decoded = String(raw).trim();
      const match = decoded.match(/(?:#|&)login-user=([^&]+)/);

      if (match) {
        username = decodeURIComponent(match[1]);
      } else if (!decoded.includes('://') && /^[a-z0-9._-]+$/i.test(decoded)) {
        username = decoded;
      } else {
        const url = new URL(decoded);
        const urlMatch = url.hash.match(/(?:^#|&)login-user=([^&]+)/);
        if (urlMatch) username = decodeURIComponent(urlMatch[1]);
      }
    } catch (_) {}

    if (!username) {
      setStatus('#scanner-status', 'Este QR no parece ser una credencial de Academic Honesty.');
      return;
    }

    if (el('#login-user')) el('#login-user').value = username;
    if (el('#login-password')) el('#login-password').focus();
    if (el('#qr-login-note')) el('#qr-login-note').hidden = false;

    setStatus('#login-status', 'QR reconocido. Introduce tu contraseña para completar el acceso.');
    stopScanner();
  }

  async function scanLoop() {
    if (!scannerActive) return;

    const video = el('#qr-video');
    const canvas = el('#qr-canvas');

    if (
      video &&
      canvas &&
      video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
      performance.now() - lastScanAt > 120
    ) {
      lastScanAt = performance.now();

      try {
        let result = null;

        if (barcodeDetector) {
          const codes = await barcodeDetector.detect(video);
          if (codes.length) result = codes[0].rawValue;
        } else if (window.jsQR) {
          const context = canvas.getContext('2d', { willReadFrequently: true });
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(
            pixels.data,
            pixels.width,
            pixels.height,
            { inversionAttempts: 'attemptBoth' }
          );
          if (code) result = code.data;
        }

        if (result) {
          acceptScannedQr(result);
          return;
        }
      } catch (_) {}
    }

    scannerFrame = requestAnimationFrame(scanLoop);
  }

  async function openScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('#login-status', 'La cámara requiere HTTPS y permiso del navegador.');
      return;
    }

    if (!window.BarcodeDetector && !window.jsQR) {
      setStatus('#login-status', 'No se pudo cargar el lector QR. Comprueba tu conexión.');
      return;
    }

    try {
      const dialog = el('#scanner-dialog');
      dialog?.showModal();
      setStatus('#scanner-status', 'Solicitando acceso a la cámara…');

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      const video = el('#qr-video');
      video.srcObject = cameraStream;
      await video.play();

      barcodeDetector = null;
      if ('BarcodeDetector' in window) {
        try {
          barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        } catch (_) {}
      }

      scannerActive = true;
      setStatus('#scanner-status', 'Apunta la cámara al QR del usuario…');
      scanLoop();
    } catch (error) {
      stopScanner();
      setStatus(
        '#login-status',
        error?.name === 'NotAllowedError'
          ? 'No se concedió permiso para usar la cámara.'
          : 'No se pudo abrir la cámara. Comprueba los permisos del navegador.'
      );
    }
  }

  async function initialize() {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY || !window.supabase?.createClient) {
        throw new Error('Falta la configuración pública de Supabase en index.html.');
      }

      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      window.AH_SUPABASE = supabase;

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session?.user) {
        await establishSession(data.session.user);
      } else {
        showGate();
      }
    } catch (error) {
      console.error('Error al inicializar Supabase:', error);
      showGate();
      setStatus(
        '#login-status',
        'No se pudo conectar con Supabase. Revisa la configuración y recarga la página.'
      );
    }
  }

  function bindEvents() {
    el('#login-form')?.addEventListener('submit', login);
    el('#create-user-form')?.addEventListener('submit', createStudent);

    el('#admin-logout')?.addEventListener('click', logout);
    el('#student-logout')?.addEventListener('click', logout);

    el('#show-my-qr')?.addEventListener('click', () => {
      if (activeUser && activeUser.role !== 'admin') openQr(activeUser);
    });

    el('#close-qr')?.addEventListener('click', () => el('#qr-dialog')?.close());
    el('#stop-qr-scanner')?.addEventListener('click', stopScanner);
    el('#open-qr-scanner')?.addEventListener('click', openScanner);

    el('#download-qr')?.addEventListener('click', () => {
      const image = el('#qr-code img');
      const canvas = el('#qr-code canvas');
      const url = image?.src || canvas?.toDataURL('image/png');

      if (!url) {
        alert('El QR todavía no está disponible.');
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = `academic-honesty-qr-${lastQrUser?.username || 'usuario'}.png`;
      link.click();
    });

    el('#scanner-dialog')?.addEventListener('close', () => {
      if (cameraStream) stopScanner();
    });

    window.addEventListener('hashchange', prefillUsername);

    // Si la sesión cambia o vence, se actualiza la pantalla.
    if (window.supabase?.createClient) {
      // Supabase se inicializa antes de registrar este listener.
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!session) { window.AH_CURRENT_USER = null; showGate(); }
      });
    }
  }

  bindEvents();

  // Permite que otros scripts sepan cuándo terminó la comprobación de sesión.
  window.AH_AUTH_READY = initialize().finally(() => {
    prefillUsername();
    window.dispatchEvent(new CustomEvent('ah-auth-ready'));
  });
})();
