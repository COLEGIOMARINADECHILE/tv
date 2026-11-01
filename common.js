// Utilidades compartidas por las pantallas TV.
(function () {
  const CFG = window.APP_CONFIG;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // "2026-10-31" → Date local (sin desfase UTC)
  function parseFecha(s) {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function hoy() {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function diasHasta(s) {
    const d = parseFecha(s);
    return d ? Math.round((d - hoy()) / 86400000) : null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function header(perfil) {
    return `
      <header class="tv-header">
        <div class="brand">
          <img src="assets/insignia.png" alt="Escudo ${esc(CFG.NOMBRE)}">
          <div class="brand-text">
            <div class="name">${esc(CFG.NOMBRE)}</div>
            <div class="city">${esc(CFG.CIUDAD)}</div>
          </div>
        </div>
        <div class="profile-pill">${esc(perfil)}</div>
        <div class="clock"><div class="time" id="clk-time">--:--</div><div class="date" id="clk-date"></div></div>
      </header>`;
  }

  function startClock() {
    const t = document.getElementById('clk-time');
    const d = document.getElementById('clk-date');
    const tick = () => {
      const n = new Date();
      t.textContent = n.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
      d.textContent = n.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };
    tick();
    setInterval(tick, 10000);
  }

  function renderTicker(el, avisos) {
    const textos = avisos.length ? avisos.map(a => a.texto) : ['Bienvenidos al ' + CFG.NOMBRE];
    const html = textos.map(t => `<span>${esc(t)}</span>`).join('');
    el.innerHTML = `<div class="label">Avisos</div><div style="flex:1;overflow:hidden"><div class="track">${html}</div></div>`;
    const track = el.querySelector('.track');
    // velocidad constante según largo del texto
    requestAnimationFrame(() => (track.style.animationDuration = Math.max(20, track.scrollWidth / 90) + 's'));
  }

  // Carga datos y refresca periódicamente; llama a onData(data) cada vez.
  function autoData(onData) {
    const run = async () => {
      const data = await API.cargarDatos();
      document.querySelector('.demo-badge')?.remove();
      if (data.demo) document.body.insertAdjacentHTML('beforeend', '<div class="demo-badge">MODO DEMO</div>');
      onData(data);
    };
    run();
    setInterval(run, CFG.REFRESCO_DATOS_SEG * 1000);
  }

  // Botón "Atrás" del control remoto → volver al inicio
  function backToHome() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 4) {
        e.preventDefault();
        location.href = 'index.html';
      }
    });
  }

  // Galería de fotos con transición tipo Ken Burns
  function gallery(el, fotos, seg, etiqueta) {
    clearInterval(el._timer);
    if (!fotos.length) {
      el.innerHTML = '<p class="empty-msg" style="padding-top:20vh">Aún no hay fotografías publicadas</p>';
      return;
    }
    el.innerHTML =
      fotos.map(f => `<div class="ph"><img src="${esc(f.url)}" alt="${esc(f.titulo)}" loading="lazy">
        <div class="caption"><small>${esc(etiqueta)}</small>${esc(f.titulo)}</div></div>`).join('') +
      `<div class="dots">${fotos.map(() => '<i></i>').join('')}</div>`;
    const phs = el.querySelectorAll('.ph');
    const dots = el.querySelectorAll('.dots i');
    let i = 0;
    const show = () => {
      phs.forEach((p, k) => p.classList.toggle('active', k === i));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      i = (i + 1) % phs.length;
    };
    show();
    el._timer = setInterval(show, seg * 1000);
  }

  window.UI = { MESES, parseFecha, diasHasta, esc, header, startClock, renderTicker, autoData, backToHome, gallery };
})();
