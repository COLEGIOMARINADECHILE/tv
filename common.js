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

  // Carga datos y los mantiene al día: cada pocos segundos consulta si el
  // administrador publicó algo y solo entonces descarga y redibuja (onData).
  function autoData(onData) {
    let firma = null;
    let version = null;
    let ocupado = false;

    const cargar = async () => {
      const data = await API.cargarDatos();
      const f = JSON.stringify(Object.assign({}, data, { actualizado: 0, version: 0 }));
      if (f === firma) return; // nada cambió → no interrumpir animaciones ni videos
      firma = f;
      document.querySelector('.demo-badge')?.remove();
      if (data.demo) document.body.insertAdjacentHTML('beforeend', '<div class="demo-badge">MODO DEMO</div>');
      onData(data);
    };

    const revisar = async () => {
      if (ocupado) return;
      ocupado = true;
      try {
        const v = await API.version();
        if (v === undefined) return; // sin conexión
        if (v === null || v !== version) {
          // null = backend sin "version" → se compara el contenido completo
          version = v;
          await cargar();
        }
      } finally {
        ocupado = false;
      }
    };

    cargar();
    setInterval(revisar, CFG.VERIFICAR_CAMBIOS_SEG * 1000);
    setInterval(cargar, CFG.REFRESCO_DATOS_SEG * 1000); // por si se edita la hoja a mano
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

  // ¿Se puede reproducir audio sin que alguien toque la pantalla?
  // En la app Android TV siempre; en un navegador, solo después de un clic o tecla.
  function sonidoPermitido() {
    return !!window.AndroidTV || !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  }

  // Muestra "Presione OK para activar el sonido" hasta el primer clic/tecla.
  function pedirSonido(onActivar) {
    if (sonidoPermitido() || document.getElementById('activar-sonido')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<button class="sound-pill" id="activar-sonido">🔊 Presione OK o haga clic para activar el sonido</button>');
    const activar = e => {
      if (e.type === 'keydown' && (e.key === 'Escape' || e.keyCode === 4)) return;
      document.removeEventListener('keydown', activar, true);
      document.removeEventListener('click', activar, true);
      document.getElementById('activar-sonido')?.remove();
      onActivar();
    };
    document.addEventListener('keydown', activar, true);
    document.addEventListener('click', activar, true);
  }

  function ytCmd(iframe, func, args) {
    iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  }

  // Galería de fotos (transición tipo Ken Burns) y videos de YouTube.
  // opts: { seg, maxVideo, sonido, onCambio(videoConAudio) }
  // Devuelve (en el elemento) el._activarSonido() para quitar el silencio al video actual.
  function gallery(el, fotos, opts, etiqueta) {
    // Al refrescar datos no reiniciar el carrusel (ni cortar un video) si nada cambió
    const firma = JSON.stringify(fotos.map(f => [f.url, f.titulo, f.audio, f.audioFunc, f.etiqueta].join('|')).concat(!!opts.sonido));
    // qué videos llevan sonido en este perfil (por defecto: el campo "audio" de Familias)
    const audioDe = opts.audioDe || (f => f.audio !== 'no');
    if (el._firma === firma) return;
    el._firma = firma;
    clearTimeout(el._timer);
    if (el._onMsg) window.removeEventListener('message', el._onMsg);
    el._activarSonido = () => {};
    const avisar = conAudio => opts.onCambio && opts.onCambio(conAudio);
    if (!fotos.length) {
      el.innerHTML = '<p class="empty-msg" style="padding-top:20vh">Aún no hay fotografías ni videos publicados</p>';
      avisar(false);
      return;
    }
    el.innerHTML =
      fotos.map(f => {
        const yt = youtubeId(f.url);
        const media = yt
          ? `<img src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt="">` // portada mientras carga
          : `<img src="${esc(f.url)}" alt="${esc(f.titulo)}" loading="lazy">`;
        // audio: 'no' lo silencia; vacío o 'si' suena (solo donde opts.sonido lo permite)
        const audio = yt && opts.sonido && audioDe(f);
        return `<div class="ph ${yt ? 'video' : ''}" data-yt="${yt || ''}" data-audio="${audio ? 1 : ''}">${media}
          <div class="caption"><small>${yt ? '▶ Video · ' : ''}${esc(f.etiqueta || etiqueta)}</small>${esc(f.titulo)}</div></div>`;
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
      ph._duracion = 0;
      phs.forEach(p => p.classList.toggle('active', p === ph));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      const conAudio = !!ph.dataset.audio && sonidoPermitido();
      if (ph.dataset.yt) {
        if (!ph.querySelector('iframe')) {
          const origin = location.protocol.startsWith('http') ? '&origin=' + encodeURIComponent(location.origin) : '';
          ph.insertAdjacentHTML('afterbegin', `<iframe allow="autoplay; encrypted-media"
            src="https://www.youtube.com/embed/${ph.dataset.yt}?autoplay=1&mute=${conAudio ? 0 : 1}&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1${origin}"></iframe>`);
          const fr = ph.querySelector('iframe');
          // pedir a YouTube que avise cuando el video termine
          fr.onload = () => {
            fr.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
            if (conAudio) { ytCmd(fr, 'unMute'); ytCmd(fr, 'setVolume', [100]); }
          };
        }
        // Si en 30 s YouTube no informa la duración (video bloqueado o sin internet), se sigue
        el._timer = setTimeout(siguiente, 30000);
      } else if (phs.length > 1) {
        el._timer = setTimeout(siguiente, opts.seg * 1000);
      }
      avisar(!!ph.dataset.yt && conAudio);
    };

    // tras el primer clic/OK en un navegador: dar sonido al video que se está viendo
    el._activarSonido = () => {
      const ph = phs[i];
      if (ph && ph.dataset.audio) {
        const fr = ph.querySelector('iframe');
        ytCmd(fr, 'unMute');
        ytCmd(fr, 'setVolume', [100]);
        avisar(true);
      }
    };

    el._onMsg = e => {
      let host = '';
      try { host = new URL(e.origin).hostname; } catch (err) { return; }
      if (!/youtube\.com$/.test(host)) return;
      // solo los avisos del video visible del carrusel (no los de la música de fondo)
      const fr = phs[i] && phs[i].querySelector('iframe');
      if (!fr || e.source !== fr.contentWindow) return;
      let d;
      try { d = JSON.parse(e.data); } catch (err) { return; }
      // Al conocer la duración, el video se muestra completo (+5 s de margen)
      if (d.info && d.info.duration > 0 && phs[i] && phs[i].dataset.yt && !phs[i]._duracion) {
        phs[i]._duracion = d.info.duration;
        clearTimeout(el._timer);
        const resta = Math.min(d.info.duration - (d.info.currentTime || 0) + 5, opts.maxVideo);
        el._timer = setTimeout(siguiente, resta * 1000);
      }
      if (d.event === 'onError' && phs.length > 1) { setTimeout(siguiente, 3000); return; }
      const estado = d.event === 'onStateChange' ? d.info : d.info && d.info.playerState;
      if (estado === 0 && phs[i] && phs[i].dataset.yt) {
        if (phs.length > 1) siguiente();
        else phs[i].querySelector('iframe').contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      }
    };
    window.addEventListener('message', el._onMsg);
    siguiente();
  }

  // Si el contenido no cabe, se desplaza solo y lento hacia abajo y vuelve arriba.
  function autoScroll(el) {
    clearInterval(el._scroll);
    el.scrollTop = 0;
    let pausa = 120; // ~5 s quieto al inicio
    el._scroll = setInterval(() => {
      if (el.scrollHeight <= el.clientHeight + 2) return; // todo cabe
      if (pausa > 0) { pausa--; return; }
      el.scrollTop += 1;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        pausa = 120;
        setTimeout(() => el.scrollTo({ top: 0, behavior: 'smooth' }), 4000);
      }
    }, 40);
  }

  // Video de una publicación de Educación: en el campo del enlace o pegado en el texto
  function enlaceVideo(n) {
    const id = youtubeId(n.url) || youtubeId(n.texto);
    return id ? 'https://www.youtube.com/watch?v=' + id : '';
  }

  // Texto sin enlaces pegados (para mostrarlo limpio en pantalla)
  function textoLimpio(n) {
    return String(n.texto || '').replace(/https?:\/\/\S+/g, '').trim();
  }

  // Fotos y videos + videos de Educación (experiencias educativas), para el carrusel
  function carrusel(data, perfil) {
    const edu = API.para(data.noticias, perfil)
      .filter(n => enlaceVideo(n))
      .map(n => ({ titulo: n.titulo, url: enlaceVideo(n), audio: n.audio, audioFunc: n.audioFunc, etiqueta: '📚 Experiencia educativa' }));
    return API.para(data.fotos, perfil).concat(edu);
  }

  // Miniatura de video para tarjetas de Educación
  function miniaturaVideo(url) {
    const id = youtubeId(url);
    return id ? `<div class="edu-thumb"><img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" alt="">
      <span>▶ En el carrusel</span></div>` : '';
  }

  // ID de un enlace de YouTube (watch, youtu.be, shorts, live, embed) o null
  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  window.UI = { MESES, parseFecha, diasHasta, esc, header, startClock, renderTicker, autoData, backToHome, gallery, youtubeId, sonidoPermitido, pedirSonido, autoScroll, carrusel, miniaturaVideo, enlaceVideo, textoLimpio };
})();
