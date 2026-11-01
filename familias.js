// Perfil Familias: pantalla completa informativa
(function () {
  const CFG = window.APP_CONFIG;
  const { esc, MESES, parseFecha, diasHasta } = UI;

  document.getElementById('hdr').outerHTML = UI.header('Familias');
  UI.startClock();
  UI.backToHome();

  function faltan(d) {
    if (d === 0) return '¡Hoy!';
    if (d === 1) return 'Mañana';
    return `En ${d} días`;
  }

  function renderFechas(fechas, acts) {
    // Fechas importantes + actividades marcadas para familias
    const todas = fechas.concat(acts.map(a => ({
      titulo: a.titulo,
      fecha: a.fecha,
      descripcion: [a.hora && a.hora + ' hrs', a.lugar].filter(Boolean).join(' · ') || a.descripcion,
      icono: '📌',
    })));
    const vistos = new Set();
    const lista = todas
      .map(f => ({ ...f, dias: diasHasta(f.fecha) }))
      .filter(f => f.dias !== null && f.dias >= 0)
      .filter(f => {
        const k = f.fecha + '|' + String(f.titulo).toLowerCase().trim();
        return !vistos.has(k) && vistos.add(k);
      })
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 4);
    document.getElementById('fechas').innerHTML = lista.length ? lista.map((f, i) => {
      const d = parseFecha(f.fecha);
      return `<div class="date-item ${f.dias <= 3 ? 'soon' : ''}" style="animation-delay:${i * 0.08}s">
        <div class="cal"><div class="m">${MESES[d.getMonth()]}</div><div class="d">${d.getDate()}</div></div>
        <div><h3>${esc(f.titulo)}</h3>${f.descripcion ? `<p>${esc(f.descripcion)}</p>` : ''}<span class="left">${faltan(f.dias)}</span></div>
        <div class="icon">${esc(f.icono || '📅')}</div>
      </div>`;
    }).join('') : '<p class="empty-msg">No hay fechas próximas</p>';
  }

  // Recuadro amarillo: mensaje editable (Admin → Ajustes) + publicaciones de Educación, rotando
  let notas = [];
  let mensaje = null;
  let n = 0;
  function rotarTip() {
    const el = document.getElementById('tip');
    const items = (mensaje ? [mensaje] : []).concat(notas);
    if (!items.length) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const t = items[n % items.length];
    n++;
    if (t === mensaje) {
      el.innerHTML = `<div class="fade"><div class="card-title"><span class="dot"></span>${esc(t.titulo)}</div>
        <p style="margin-top:1vh">${esc(t.texto)}</p></div>`;
      return;
    }
    el.innerHTML = `<div class="fade"><div class="card-title"><span class="dot"></span>Para las familias</div>
      <h3>${UI.enlaceVideo(t) ? '▶ ' : ''}${esc(t.titulo)}</h3>
      <p>${esc(UI.textoLimpio(t) || (UI.enlaceVideo(t) ? 'Experiencia educativa: véala en el carrusel de videos.' : ''))}</p></div>`;
  }
  setInterval(rotarTip, CFG.DURACION_SLIDE_SEG * 1000);

  // ---------- Música de fondo: MP3 o YouTube (video o lista de reproducción) ----------
  // Baja de volumen mientras suena un video del carrusel.
  const musica = new Audio();
  musica.preload = 'auto';
  musica.id = 'musica-fondo';
  musica.hidden = true;
  document.body.appendChild(musica);
  const ytBox = document.createElement('div'); // reproductor de YouTube invisible
  ytBox.className = 'yt-musica';
  document.body.appendChild(ytBox);
  let ytFrame = null;
  let pistas = [];
  let pista = 0;
  let firmaMusica = '';
  let videoSonando = false;
  let errores = 0;
  let vol = 0; // volumen actual (0 a 1), para los fundidos
  let fadeTimer;

  const volObjetivo = () => (videoSonando ? CFG.MUSICA_VOLUMEN_CON_VIDEO : CFG.MUSICA_VOLUMEN);
  const listaId = url => (String(url || '').match(/[?&]list=([\w-]+)/) || [])[1] || null;
  const esYoutube = p => !!(UI.youtubeId(p.url) || listaId(p.url));

  function ytCmd(func, args) {
    ytFrame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
  }

  function aplicarVolumen(v) {
    vol = v;
    if (ytFrame) ytCmd('setVolume', [Math.round(v * 100)]);
    else musica.volume = v;
  }

  function fundido(destino, ms) {
    clearInterval(fadeTimer);
    const desde = vol;
    const t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (ms || 1200));
      aplicarVolumen(desde + (destino - desde) * k);
      if (k >= 1) clearInterval(fadeTimer);
    }, 80);
  }

  function detener() {
    musica.pause();
    musica.removeAttribute('src');
    ytBox.innerHTML = '';
    ytFrame = null;
  }

  function tocar() {
    detener();
    if (!pistas.length) return;
    const p = pistas[pista % pistas.length];
    const unica = pistas.length === 1;
    vol = volObjetivo();
    if (esYoutube(p)) {
      const id = UI.youtubeId(p.url);
      const lista = listaId(p.url);
      const sonar = UI.sonidoPermitido(); // navegador sin clic: parte en silencio
      let src = `https://www.youtube.com/embed/${id || 'videoseries'}?autoplay=1&controls=0&enablejsapi=1&mute=${sonar ? 0 : 1}`;
      if (lista) src += '&list=' + lista;
      if (unica) src += '&loop=1' + (lista ? '' : '&playlist=' + id);
      if (location.protocol.startsWith('http')) src += '&origin=' + encodeURIComponent(location.origin);
      ytBox.innerHTML = `<iframe allow="autoplay; encrypted-media" src="${src}"></iframe>`;
      ytFrame = ytBox.querySelector('iframe');
      ytFrame.onload = () => ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 2 }), '*');
      if (!sonar) UI.pedirSonido(activarSonido);
    } else {
      musica.src = p.url;
      musica.loop = unica;
      musica.volume = vol;
      musica.play().catch(() => UI.pedirSonido(activarSonido)); // navegador: esperar un clic/OK
    }
  }

  // Avisos del reproductor de YouTube de la música
  window.addEventListener('message', e => {
    if (!ytFrame || e.source !== ytFrame.contentWindow) return;
    let d;
    try { d = JSON.parse(e.data); } catch (err) { return; }
    if (d.event === 'onReady' || d.event === 'initialDelivery') {
      aplicarVolumen(vol);
      if (listaId(ytFrame.src) && !/embed\/[\w-]{11}\?/.test(ytFrame.src)) ytCmd('setShuffle', [true]);
    }
    const estado = d.event === 'onStateChange' ? d.info : d.info && d.info.playerState;
    if (estado === 1) errores = 0;
    if (estado === 0 && pistas.length > 1) { pista++; tocar(); } // terminó → siguiente
    if (d.event === 'onError' && pistas.length > 1 && ++errores <= pistas.length) { pista++; setTimeout(tocar, 1000); }
  });

  musica.onended = () => { pista++; tocar(); };
  musica.onplaying = () => (errores = 0);
  musica.onerror = () => {
    if (!musica.getAttribute('src')) return;
    if (!pistas.length || ++errores > pistas.length) return; // ninguna pista se puede reproducir
    pista++;
    setTimeout(tocar, 1000);
  };

  function setMusica(lista) {
    const f = JSON.stringify(lista.map(m => m.url));
    if (f === firmaMusica) return; // misma lista → seguir sonando sin cortar
    firmaMusica = f;
    pistas = CFG.MUSICA_FAMILIAS ? lista.filter(m => m.url).sort(() => Math.random() - 0.5) : [];
    pista = 0;
    errores = 0;
    tocar();
  }

  // La galería avisa si el elemento visible es un video con sonido
  function onCambioVideo(conAudio) {
    videoSonando = conAudio;
    if (pistas.length) fundido(volObjetivo());
  }

  function activarSonido() {
    if (ytFrame) {
      ytCmd('unMute');
      aplicarVolumen(volObjetivo());
    } else if (pistas.length && musica.paused) {
      tocar();
    }
    document.getElementById('gal')._activarSonido();
  }

  UI.autoData(data => {
    const aj = UI.ajustes(data);
    mensaje = aj.mensajeTexto ? { titulo: aj.mensajeTitulo || 'Mensaje para las familias', texto: aj.mensajeTexto } : null;
    const fotos = UI.carrusel(data, 'familias');
    UI.gallery(document.getElementById('gal'), fotos,
      { seg: aj.segFotosFamilias, maxVideo: CFG.DURACION_VIDEO_MAX_SEG, sonido: CFG.VIDEO_CON_SONIDO_FAMILIAS, onCambio: onCambioVideo },
      'Actividades del colegio');
    setMusica(data.musica || []);
    const videosConAudio = CFG.VIDEO_CON_SONIDO_FAMILIAS && fotos.some(f => UI.youtubeId(f.url) && f.audio !== 'no');
    if (pistas.length || videosConAudio) UI.pedirSonido(activarSonido);
    renderFechas(data.fechas || [], (data.actividades || []).filter(a => a.publico === 'familias' || a.publico === 'ambos'));
    UI.avisoHoy(document.getElementById('aviso-hoy'),
      (data.actividades || []).filter(a => a.publico === 'familias' || a.publico === 'ambos').concat(data.fechas || []));
    notas = API.para(data.noticias, 'familias');
    rotarTip();
    UI.renderTicker(document.getElementById('ticker'), API.para(data.avisos, 'familias'));
  });
})();
