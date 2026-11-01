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

  // Galería de fotos (transición tipo Ken Burns) y videos de YouTube.
  // opts: { seg, maxVideo, sonido }
  function gallery(el, fotos, opts, etiqueta) {
    // Al refrescar datos no reiniciar el carrusel (ni cortar un video) si nada cambió
    const firma = JSON.stringify(fotos.map(f => f.url + '|' + f.titulo));
    if (el._firma === firma) return;
    el._firma = firma;
    clearTimeout(el._timer);
    if (el._onMsg) window.removeEventListener('message', el._onMsg);
    if (!fotos.length) {
      el.innerHTML = '<p class="empty-msg" style="padding-top:20vh">Aún no hay fotografías ni videos publicados</p>';
      return;
    }
    el.innerHTML =
      fotos.map(f => {
        const yt = youtubeId(f.url);
        const media = yt
          ? `<img src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt="">` // portada mientras carga
          : `<img src="${esc(f.url)}" alt="${esc(f.titulo)}" loading="lazy">`;
        return `<div class="ph ${yt ? 'video' : ''}" data-yt="${yt || ''}">${media}
          <div class="caption"><small>${yt ? '▶ Video · ' : ''}${esc(etiqueta)}</small>${esc(f.titulo)}</div></div>`;
      }).join('') +
      `<div class="dots">${fotos.map(() => '<i></i>').join('')}</div>`;
    const phs = [...el.querySelectorAll('.ph')];
    const dots = el.querySelectorAll('.dots i');
    let i = -1;

    const siguiente = () => {
      clearTimeout(el._timer);
      const prev = phs[i];
      i = (i + 1) % phs.length;
      const ph = phs[i];
      // solo un video a la vez: se quita el reproductor del anterior
      if (prev && prev !== ph) prev.querySelector('iframe')?.remove();
      phs.forEach(p => p.classList.toggle('active', p === ph));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      if (ph.dataset.yt) {
        if (!ph.querySelector('iframe')) {
          const origin = location.protocol.startsWith('http') ? '&origin=' + encodeURIComponent(location.origin) : '';
          ph.insertAdjacentHTML('afterbegin', `<iframe allow="autoplay; encrypted-media"
            src="https://www.youtube.com/embed/${ph.dataset.yt}?autoplay=1&mute=${opts.sonido ? 0 : 1}&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1${origin}"></iframe>`);
          const fr = ph.querySelector('iframe');
          // pedir a YouTube que avise cuando el video termine
          fr.onload = () => fr.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
        }
        el._timer = setTimeout(siguiente, opts.maxVideo * 1000);
      } else if (phs.length > 1) {
        el._timer = setTimeout(siguiente, opts.seg * 1000);
      }
    };

    el._onMsg = e => {
      if (!/youtube\.com$/.test(new URL(e.origin).hostname)) return;
      let d;
      try { d = JSON.parse(e.data); } catch (err) { return; }
      const estado = d.event === 'onStateChange' ? d.info : d.info && d.info.playerState;
      if (estado === 0 && phs[i] && phs[i].dataset.yt) {
        if (phs.length > 1) siguiente();
        else phs[i].querySelector('iframe').contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      }
    };
    window.addEventListener('message', el._onMsg);
    siguiente();
  }

  // ID de un enlace de YouTube (watch, youtu.be, shorts, live, embed) o null
  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  window.UI = { MESES, parseFecha, diasHasta, esc, header, startClock, renderTicker, autoData, backToHome, gallery, youtubeId };
})();
