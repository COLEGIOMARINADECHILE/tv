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
          <img src="insignia.png" alt="Escudo ${esc(CFG.NOMBRE)}">
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

  // velocidad: 'lenta' | 'normal' | 'rapida' (Admin → Ajustes)
  function renderTicker(el, avisos, velocidad) {
    const textos = avisos.length ? avisos.map(a => a.texto) : ['Bienvenidos al ' + CFG.NOMBRE];
    const html = textos.map(t => `<span>${esc(t)}</span>`).join('');
    el.innerHTML = `<div class="label">Avisos</div><div style="flex:1;overflow:hidden"><div class="track">${html}</div></div>`;
    const track = el.querySelector('.track');
    // velocidad constante según largo del texto
    // velocidad constante (píxeles por segundo) según el ajuste elegido en el panel
    const pxSeg = { lenta: 25, normal: 40, rapida: 65 }[velocidad] || 40;
    requestAnimationFrame(() => (track.style.animationDuration = Math.max(25, track.scrollWidth / pxSeg) + 's'));
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
    autoActualizarApp();
  }

  // Si se subió una versión nueva de la página a GitHub, las pantallas se recargan solas
  // (evita que el TV o el navegador sigan mostrando una copia antigua guardada en memoria).
  function autoActualizarApp() {
    const script = document.querySelector('script[src*="common.js"]');
    const actual = script && (script.src.match(/[?&]v=(\w+)/) || [])[1];
    if (!actual || !location.protocol.startsWith('http')) return;
    const revisar = async () => {
      try {
        const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
        const j = await r.json();
        if (!j.v || j.v === actual) return;
        // evitar recargas seguidas si el servidor aún entrega la versión antigua
        const ultimo = +sessionStorage.getItem('cmch_recarga') || 0;
        if (Date.now() - ultimo < 10 * 60000) return;
        sessionStorage.setItem('cmch_recarga', Date.now());
        const u = new URL(location.href);
        u.searchParams.set('r', Date.now()); // dirección nueva = la página se descarga de nuevo
        location.replace(u.toString());
      } catch (e) {}
    };
    setTimeout(revisar, 8000);
    setInterval(revisar, 2 * 60000);
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

  // ---------- Límite de veces al día con sonido (por video, perfil y televisor) ----------
  // vecesAudio vacío = siempre. Si es N, suena como máximo N veces al día y
  // repartidas en la jornada (no antes de JORNADA_MIN / N minutos desde la última vez).
  function cuotaLeer(clave) {
    const hoy = new Date().toDateString();
    let r = null;
    try { r = JSON.parse(localStorage.getItem(clave)); } catch (e) {}
    return r && r.d === hoy ? r : { d: hoy, n: 0, t: 0 };
  }

  function cuotaDisponible(clave, veces) {
    if (!veces) return true;
    const r = cuotaLeer(clave);
    if (r.n >= veces) return false;
    const separacion = (CFG.JORNADA_MIN || 600) / veces * 60000;
    return !r.t || Date.now() - r.t >= separacion;
  }

  function cuotaRegistrar(clave, veces) {
    if (!veces) return;
    const r = cuotaLeer(clave);
    r.n++;
    r.t = Date.now();
    try { localStorage.setItem(clave, JSON.stringify(r)); } catch (e) {}
  }

  // Galería de fotos (transición tipo Ken Burns) y videos de YouTube.
  // opts: { seg, maxVideo, sonido, perfil, onCambio(videoConAudio) }
  // Devuelve (en el elemento) el._activarSonido() para quitar el silencio al video actual.
  function gallery(el, fotos, opts, etiqueta) {
    // Al refrescar datos no reiniciar el carrusel (ni cortar un video) si nada cambió
    const firma = JSON.stringify(fotos.map(f => [f.url, f.titulo, f.texto, f.audio, f.audioFunc, f.vecesAudio, f.etiqueta].join('|')).concat(!!opts.sonido, opts.seg));
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
        // diapositiva de solo texto (Educación sin video)
        if (!f.url && f.texto !== undefined) {
          return `<div class="ph texto"><div class="slide-texto">
            <h3>${esc(f.titulo)}</h3>${f.texto ? `<p>${esc(f.texto)}</p>` : ''}</div></div>`;
        }
        // Publicación o reel de Instagram por enlace: tarjeta oficial de Instagram y el mensaje al lado
        const ig = instagramRuta(f.url);
        if (ig) {
          const texto = String(f.texto || '').trim();
          const tam = texto.length < 140 ? 'g' : texto.length < 380 ? 'm' : 'c';
          return `<div class="ph insta enlace" data-ig="${ig}" data-cap="${texto ? '' : '1'}">
            <div class="ig-marco"></div>
            <div class="ig-resena">
              <span class="ig-logo">📸 Instagram${ig.startsWith('reel/') ? ' · Reel' : ''}</span>
              ${texto ? `<p class="ig-texto ${tam}">${esc(texto)}</p>` : `<b class="ig-titulo">${esc(f.titulo)}</b>`}
            </div></div>`;
        }
        // Video MP4 subido (ej. un reel descargado de Instagram): se reproduce solo, completo y con su mensaje al lado
        if (f.formato === 'video') {
          const texto = String(f.texto || '').trim();
          const tam = texto.length < 140 ? 'g' : texto.length < 380 ? 'm' : 'c';
          const audio = opts.sonido && audioDe(f);
          // los subidos a Drive se descargan vía Apps Script (data-file); los demás se usan directo
          return `<div class="ph insta mp4 ${texto ? '' : 'solo'}" data-mp4="1" data-clave="${esc(f.fileId || f.id || f.url)}"
              data-file="${esc(f.fileId || '')}" data-audio="${audio ? 1 : ''}" data-veces="${esc(f.vecesAudio || '')}">
            <div class="ig-foto"><video ${f.fileId ? '' : `src="${esc(f.url)}"`} muted playsinline preload="none"></video></div>
            ${texto ? `<div class="ig-resena"><span class="ig-logo">🎬 Reel</span><p class="ig-texto ${tam}">${esc(texto)}</p></div>` : ''}
          </div>`;
        }
        // Instagram (publicación elegida o historia): foto destacada y la reseña al lado
        if (f.origen === 'instagram' || f.historia) {
          const texto = String(f.texto || '').trim();
          const tam = texto.length < 140 ? 'g' : texto.length < 380 ? 'm' : 'c';
          return `<div class="ph insta ${f.historia ? 'historia' : ''}">
            <div class="ig-fondo" style="background-image:url('${esc(f.url)}')"></div>
            <div class="ig-foto"><img src="${esc(f.url)}" alt="${esc(f.titulo)}" loading="lazy"></div>
            <div class="ig-resena">
              <span class="ig-logo">📸 ${f.historia ? 'Historia de Instagram' : 'Instagram'}</span>
              ${f.historia ? `<b class="ig-hace">${esc(haceCuanto(f.fecha))}</b>`
                : `<p class="ig-texto ${tam}">${esc(texto || f.titulo)}</p>`}
            </div></div>`;
        }
        const yt = youtubeId(f.url);
        const media = yt
          ? `<img src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt="">` // portada mientras carga
          : `<img src="${esc(f.url)}" alt="${esc(f.titulo)}" loading="lazy">`;
        // audio: 'no' lo silencia; vacío o 'si' suena (solo donde opts.sonido lo permite)
        const audio = yt && opts.sonido && audioDe(f);
        return `<div class="ph ${yt ? 'video' : ''}" data-yt="${yt || ''}" data-audio="${audio ? 1 : ''}" data-veces="${esc(f.vecesAudio || '')}">${media}
          <div class="caption"><small>${yt ? '▶ Video · ' : ''}${esc(f.etiqueta || etiqueta)}</small>${esc(f.titulo)}</div></div>`;
      }).join('') +
      `<div class="dots">${fotos.map(() => '<i></i>').join('')}</div>`;
    const phs = [...el.querySelectorAll('.ph')];
    const dots = el.querySelectorAll('.dots i');
    let i = -1;

    // ¿Puede sonar ahora este video? (quiere sonido, se permite, nadie tiene prioridad
    // y aún le quedan veces hoy). Cada reproducción cuenta una sola vez.
    const tocaSonido = ph => {
      if (!ph.dataset.audio || !sonidoPermitido() || el._mudo) return false;
      if (ph._sonoEstaVez) return true;
      const veces = +ph.dataset.veces || 0;
      const clave = `cmch_snd_${opts.perfil || 'x'}_${ph.dataset.yt || ph.dataset.clave}`;
      if (!cuotaDisponible(clave, veces)) return false;
      cuotaRegistrar(clave, veces);
      ph._sonoEstaVez = true;
      return true;
    };

    const siguiente = () => {
      clearTimeout(el._timer);
      const prev = phs[i];
      i = (i + 1) % phs.length;
      const ph = phs[i];
      // solo un video a la vez: se quita el reproductor del anterior
      if (prev && prev !== ph) {
        prev.querySelector('iframe')?.remove();
        prev.querySelector('video')?.pause();
      }
      document.body.classList.remove('video-activo');
      ph._duracion = 0;
      ph._sonoEstaVez = false;
      phs.forEach(p => p.classList.toggle('active', p === ph));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      const conAudio = tocaSonido(ph);
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
      } else if (ph.dataset.ig) {
        // tarjeta oficial de Instagram: se carga al mostrarse y se ajusta al alto del recuadro
        if (!ph.querySelector('iframe')) {
          ph.querySelector('.ig-marco').innerHTML = `<iframe scrolling="no" allow="autoplay; encrypted-media"
            src="https://www.instagram.com/${ph.dataset.ig}/embed/${ph.dataset.cap ? 'captioned/' : ''}"></iframe>`;
          ajustarInsta(ph, ph.dataset.cap ? 760 : 560);
        }
        if (phs.length > 1) el._timer = setTimeout(siguiente, opts.seg * 1500);
      } else if (ph.dataset.mp4) {
        // video MP4: se ve completo y pasa al siguiente al terminar
        const v = ph.querySelector('video');
        const reproducir = () => {
          v.preload = 'auto';
          v.loop = phs.length === 1;
          v.muted = !conAudio;
          v.onended = () => phs.length > 1 && siguiente();
          // al partir, un "salto" al mismo instante vuelve a alinear imagen y sonido
          v.onplaying = () => { v.onplaying = null; setTimeout(() => { if (!v.paused) v.currentTime = v.currentTime; }, 700); };
          v.onerror = () => { avisar(false); if (phs.length > 1) el._timer = setTimeout(siguiente, 3000); };
          try { v.currentTime = 0; } catch (e) {}
          document.body.classList.add('video-activo'); // pausa los efectos: el TV se dedica al video
          avisar(conAudio); // la música baja solo cuando el video ya suena
          // si el navegador no deja sonar sin un clic, se reproduce en silencio
          v.play().catch(() => {
            v.muted = true;
            avisar(false);
            v.play().catch(() => {});
          });
        };
        avisar(false);
        if (v.getAttribute('src')) reproducir();
        else {
          ph.classList.add('cargando');
          API.video(ph.dataset.file)
            .then(url => { v.src = url; ph.classList.remove('cargando'); if (phs[i] === ph) reproducir(); })
            .catch(() => { ph.classList.remove('cargando'); if (phs[i] === ph && phs.length > 1) siguiente(); });
        }
        if (phs.length > 1) el._timer = setTimeout(siguiente, opts.maxVideo * 1000); // tope de seguridad
      } else if (ph.classList.contains('insta') && phs.length > 1) {
        // un poco más que una foto, para alcanzar a leer la reseña
        el._timer = setTimeout(siguiente, opts.seg * 1500);
      } else if (phs.length > 1) {
        el._timer = setTimeout(siguiente, opts.seg * 1000);
      }
      if (!ph.dataset.mp4) avisar(!!ph.dataset.yt && conAudio); // el MP4 avisa al comenzar a sonar
    };

    // tras el primer clic/OK en un navegador: dar sonido al video que se está viendo
    el._activarSonido = () => {
      const ph = phs[i];
      if (ph && ph.dataset.mp4 && tocaSonido(ph)) {
        const v = ph.querySelector('video');
        v.muted = false;
        v.play().catch(() => {});
        avisar(true);
      }
      if (ph && ph.dataset.yt && tocaSonido(ph)) {
        const fr = ph.querySelector('iframe');
        ytCmd(fr, 'unMute');
        ytCmd(fr, 'setVolume', [100]);
        avisar(true);
      }
    };

    // Silenciar / devolver el sonido desde afuera (cuando otro video tiene prioridad)
    el._setMudo = mudo => {
      if (!!el._mudo === !!mudo) return;
      el._mudo = mudo;
      const ph = phs[i];
      if (ph && ph.dataset.mp4 && ph.dataset.audio) {
        const suena = !mudo && tocaSonido(ph);
        ph.querySelector('video').muted = !suena;
        avisar(suena);
        return;
      }
      if (!ph || !ph.dataset.yt || !ph.dataset.audio) return;
      const fr = ph.querySelector('iframe');
      const suena = !mudo && tocaSonido(ph);
      ytCmd(fr, suena ? 'unMute' : 'mute');
      if (suena) ytCmd(fr, 'setVolume', [100]);
      avisar(suena);
    };

    // La tarjeta de Instagram mide 400 px de ancho: se escala para caber completa en el recuadro
    const ajustarInsta = (ph, alto) => {
      const fr = ph.querySelector('.ig-marco iframe');
      if (!fr) return;
      const s = Math.min(1.8, (ph.clientHeight * 0.94) / alto);
      fr.style.height = alto + 'px';
      fr.style.transform = `scale(${s})`;
      const marco = ph.querySelector('.ig-marco');
      marco.style.width = 400 * s + 'px';
      marco.style.height = alto * s + 'px';
    };

    el._onMsg = e => {
      let host = '';
      try { host = new URL(e.origin).hostname; } catch (err) { return; }
      if (/instagram\.com$/.test(host)) {
        // Instagram informa el alto real de la tarjeta
        const ph = phs[i];
        const fr = ph && ph.querySelector('.ig-marco iframe');
        if (!fr || e.source !== fr.contentWindow) return;
        try {
          const d = JSON.parse(e.data);
          if (d.type === 'MEASURE' && d.details.height > 0) ajustarInsta(ph, d.details.height);
        } catch (err) {}
        return;
      }
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
        else {
          // un solo video: se repite, y cada repetición cuenta como una vez nueva con sonido
          const ph = phs[i];
          const frv = ph.querySelector('iframe');
          ph._sonoEstaVez = false;
          ph._duracion = 0;
          const suena = tocaSonido(ph);
          ytCmd(frv, suena ? 'unMute' : 'mute');
          if (suena) ytCmd(frv, 'setVolume', [100]);
          avisar(suena);
          ytCmd(frv, 'playVideo');
        }
      }
    };
    window.addEventListener('message', el._onMsg);
    siguiente();
    // los videos MP4 se van descargando de a uno, para que estén listos cuando les toque
    phs.map(p => p.dataset.file).filter(Boolean)
      .reduce((p, id) => p.then(() => API.video(id).catch(() => {})), Promise.resolve());
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

  // ---------- Íconos para fechas y actividades ----------
  // 'insignia' = escudo del colegio; el resto son emojis agrupados por tema.
  const ICONOS = [
    'insignia', '📅', '⏰', '📣', '⭐', '🎉', '🎓', '🏫', '📚', '✏️', '📝', '🔬',
    '💻', '🎨', '🎭', '🎵', '⚽', '🏆', '🏃', '🧘', '🩺', '💉', '🍎', '🥗',
    '👨‍👩‍👧', '🤝', '❤️', '🙌', '🇨🇱', '⚓', '🌊', '🌱', '🌎', '🚌', '🗳️', '🎄',
  ];

  function icono(valor, clase) {
    const v = valor || '📅';
    return v === 'insignia'
      ? `<div class="icon ${clase || ''}"><img src="insignia.png" alt="Insignia"></div>`
      : `<div class="icon ${clase || ''}">${esc(v)}</div>`;
  }

  // ---------- Recordatorio de las actividades de HOY ----------
  // Muestra la próxima actividad del día con hora, lugar y cuánto falta;
  // "AHORA" mientras está en curso (se considera 1 hora de duración).
  const DURACION_ACTIVIDAD_MIN = 60;

  function minutosDelDia(hora) {
    const m = String(hora || '').match(/^(\d{1,2}):(\d{2})/);
    return m ? +m[1] * 60 + +m[2] : null;
  }

  function faltaTexto(min) {
    if (min < 60) return `En ${min} min`;
    const h = Math.floor(min / 60);
    const r = min % 60;
    return `Faltan ${h} h${r ? ' ' + r + ' min' : ''}`;
  }

  function minutosAhora() {
    const t = new Date();
    return t.getHours() * 60 + t.getMinutes();
  }

  // Estado de una actividad de hoy según su hora: { texto, clase }
  // clase: 'hoy' (falta >1 h o sin hora) · 'pronto' (≤1 h) · 'ahora' (en curso) · 'fin' (terminó)
  function estadoHoy(hora) {
    const ini = minutosDelDia(hora);
    const now = minutosAhora();
    if (ini === null) return { texto: '📅 Durante el día', clase: 'hoy' };
    if (now >= ini + DURACION_ACTIVIDAD_MIN) return { texto: '✓ Finalizada', clase: 'fin' };
    if (now >= ini) return { texto: '🔴 AHORA · En este momento', clase: 'ahora' };
    if (ini - now <= 60) return { texto: '⏰ ' + faltaTexto(ini - now), clase: 'pronto' };
    return { texto: faltaTexto(ini - now), clase: 'hoy' };
  }

  // ¿Ya pasó? Un día anterior, o hoy cuando terminó (1 h después de su hora de inicio)
  function yaPaso(fecha, hora) {
    const d = diasHasta(fecha);
    if (d === null || d < 0) return true;
    const ini = minutosDelDia(hora);
    return d === 0 && ini !== null && minutosAhora() >= ini + DURACION_ACTIVIDAD_MIN;
  }

  function avisoHoy(el, actividades) {
    el._acts = actividades;
    const pintar = () => {
      const nowMin = minutosAhora();
      const hoyActs = (el._acts || [])
        .filter(a => diasHasta(a.fecha) === 0)
        .map(a => ({ ...a, ini: minutosDelDia(a.hora) }))
        .filter(a => a.ini === null || a.ini + DURACION_ACTIVIDAD_MIN > nowMin) // las terminadas se ocultan
        .sort((a, b) => (a.ini === null ? 9999 : a.ini) - (b.ini === null ? 9999 : b.ini));
      if (!hoyActs.length) {
        el.hidden = true;
        el.innerHTML = '';
        return;
      }
      const a = hoyActs[0];
      const est = estadoHoy(a.hora);
      const estado = a.ini === null ? 'Hoy' : est.texto;
      const clase = est.clase;
      const mas = hoyActs.length - 1;
      el.hidden = false;
      el.className = 'aviso-hoy ' + clase;
      el.innerHTML = `
        <div class="ah-estado">${estado}</div>
        <div class="ah-cuerpo">${icono(a.icono || '📅', 'ah-ico')}
          <div class="ah-titulo">${esc(a.titulo)}</div>
          <div class="ah-meta">${a.hora ? '🕒 ' + esc(a.hora) + ' hrs' : '📅 Durante el día'}${a.lugar ? ' · 📍 ' + esc(a.lugar) : ''}</div>
        </div>
        ${mas > 0 ? `<div class="ah-mas">+${mas} más hoy</div>` : ''}`;
    };
    pintar();
    clearInterval(el._timer);
    el._timer = setInterval(pintar, 30000);
  }

  // Ajustes editables desde el panel (con valores por defecto de config.js)
  function ajustes(data) {
    const a = {
      mensajeTitulo: 'Mensaje para las familias',
      mensajeTexto: '¡Gracias por acompañar a sus hijos e hijas en su aprendizaje!',
      segFotosFamilias: CFG.DURACION_FOTO_SEG,
      segFotosFuncionarios: CFG.DURACION_FOTO_FUNCIONARIOS_SEG,
      velocidadAvisos: 'normal',
      telefonos: '',
      sitioWeb: '',
      instagram: '',
      youtube: '',
    };
    (data.ajustes || []).forEach(r => { if (r.id) a[r.id] = r.valor; });
    a.segFotosFamilias = Math.max(3, +a.segFotosFamilias || CFG.DURACION_FOTO_SEG);
    a.segFotosFuncionarios = Math.max(3, +a.segFotosFuncionarios || CFG.DURACION_FOTO_FUNCIONARIOS_SEG);
    return a;
  }

  // Teléfonos guardados en Ajustes: lista JSON [{tipo, nombre, numero}]
  // (acepta también el formato antiguo "Nombre: número" por línea)
  function contactos(valor) {
    const s = String(valor || '').trim();
    if (!s) return [];
    try {
      const lista = JSON.parse(s);
      if (Array.isArray(lista)) return lista.filter(t => t && t.numero);
    } catch (e) {}
    return s.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
      const k = l.indexOf(':');
      return k > 0
        ? { tipo: 'telefono', nombre: l.slice(0, k).trim(), numero: l.slice(k + 1).trim() }
        : { tipo: 'telefono', nombre: 'Contacto', numero: l };
    });
  }

  // Sitio web, Instagram y YouTube → { nombre, ico, url, texto, clase } para mostrar con QR
  function redes(aj) {
    const out = [];
    const web = String(aj.sitioWeb || '').trim();
    if (web) {
      const url = /^https?:\/\//i.test(web) ? web : 'https://' + web;
      out.push({ nombre: 'Sitio web', ico: '🌐', url, texto: url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''), clase: 'r-web' });
    }
    const ig = String(aj.instagram || '').trim();
    if (ig) {
      const usuario = ig.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?].*$/, '');
      out.push({ nombre: 'Instagram', ico: '📸', url: 'https://www.instagram.com/' + usuario, texto: '@' + usuario, clase: 'r-ig' });
    }
    const yt = String(aj.youtube || '').trim();
    if (yt) {
      const url = /^https?:\/\//i.test(yt) ? yt : 'https://www.youtube.com/' + (yt.startsWith('@') ? yt : '@' + yt);
      const texto = (url.match(/youtube\.com\/(@[\w.-]+)/i) || [])[1] || 'YouTube';
      out.push({ nombre: 'YouTube', ico: '▶️', url, texto, clase: 'r-yt' });
    }
    return out;
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

  // Carrusel: fotos y videos con su categoría (Actividades del colegio o 📚 Educación).
  // También incluye los videos publicados antes en la antigua sección Educación.
  function carrusel(data, perfil) {
    const ahora = Date.now();
    const fotos = API.para(data.fotos, perfil)
      // historias subidas a mano: se ven 24 h (campo "vence") y luego desaparecen
      .filter(f => !f.vence || Date.parse(f.vence) > ahora)
      .map(f => (f.vence ? Object.assign({}, f, { historia: true, fecha: new Date(Date.parse(f.vence) - 864e5).toISOString(), etiqueta: 'Recién publicado' }) : f))
      .map(f => (f.categoria === 'educacion' ? Object.assign({}, f, { etiqueta: '📚 Educación' }) : f));
    const antiguos = API.para(data.noticias, perfil)
      .filter(n => enlaceVideo(n))
      .map(n => ({ titulo: n.titulo, url: enlaceVideo(n), audio: n.audio, audioFunc: n.audioFunc, vecesAudio: n.vecesAudio, etiqueta: '📚 Educación' }));
    // historias de Instagram vigentes (24 h): van primero, en ambas pantallas
    const historias = (data.historias || [])
      .filter(h => new Date(h.vence).getTime() > Date.now())
      .map(h => ({ titulo: 'Historia de Instagram', url: h.url, fecha: h.fecha, historia: true, etiqueta: 'Recién publicado' }));
    return historias.concat(fotos, antiguos);
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

  // Ruta de una publicación o reel de Instagram ("p/CODIGO" o "reel/CODIGO") o null
  function instagramRuta(url) {
    const m = String(url || '').match(/instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/);
    return m ? (m[1] === 'p' ? 'p' : 'reel') + '/' + m[2] : null;
  }

  // "Hace 3 h" desde una fecha ISO (historias de Instagram)
  function haceCuanto(iso) {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    return min < 60 ? `Hace ${min || 1} min` : `Hace ${Math.round(min / 60)} h`;
  }

  window.UI = { MESES, parseFecha, diasHasta, esc, header, startClock, renderTicker, autoData, backToHome, gallery, youtubeId, instagramRuta, sonidoPermitido, pedirSonido, autoScroll, carrusel, miniaturaVideo, enlaceVideo, textoLimpio, ajustes, avisoHoy, estadoHoy, yaPaso, minutosDelDia, ICONOS, icono, contactos, redes };
})();
