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

  let notas = [];
  let n = 0;
  function rotarTip() {
    const el = document.getElementById('tip');
    if (!notas.length) {
      el.innerHTML = `<div class="card-title"><span class="dot"></span>Mensaje para las familias</div>
        <p style="margin-top:1vh">¡Gracias por acompañar a sus hijos e hijas en su aprendizaje!</p>`;
      return;
    }
    const t = notas[n % notas.length];
    n++;
    el.innerHTML = `<div class="fade"><div class="card-title"><span class="dot"></span>Para las familias</div>
      <h3>${esc(t.titulo)}</h3><p>${esc(t.texto)}</p></div>`;
  }
  setInterval(rotarTip, CFG.DURACION_SLIDE_SEG * 1000);

  // ---------- Música de fondo: baja de volumen mientras suena un video ----------
  const musica = new Audio();
  musica.preload = 'auto';
  musica.id = 'musica-fondo';
  musica.hidden = true;
  document.body.appendChild(musica);
  let pistas = [];
  let pista = 0;
  let firmaMusica = '';
  let videoSonando = false;
  let errores = 0;
  let fadeTimer;

  const volObjetivo = () => (videoSonando ? CFG.MUSICA_VOLUMEN_CON_VIDEO : CFG.MUSICA_VOLUMEN);

  function fundido(destino, ms) {
    clearInterval(fadeTimer);
    const desde = musica.volume;
    const t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (ms || 1200));
      musica.volume = desde + (destino - desde) * k;
      if (k >= 1) clearInterval(fadeTimer);
    }, 50);
  }

  function tocar() {
    if (!pistas.length) {
      musica.pause();
      return;
    }
    musica.src = pistas[pista % pistas.length].url;
    musica.volume = volObjetivo();
    musica.play().catch(() => UI.pedirSonido(activarSonido)); // navegador: esperar un clic/OK
  }
  musica.onended = () => { pista++; tocar(); };
  musica.onplaying = () => (errores = 0);
  musica.onerror = () => {
    if (!pistas.length || ++errores > pistas.length) return; // ninguna pista se puede reproducir
    pista++;
    setTimeout(tocar, 1000);
  };

  function setMusica(lista) {
    const f = JSON.stringify(lista.map(m => m.url));
    if (f === firmaMusica) return; // misma lista → seguir sonando sin cortar
    firmaMusica = f;
    pistas = CFG.MUSICA_FAMILIAS ? lista.slice().sort(() => Math.random() - 0.5) : [];
    pista = 0;
    errores = 0;
    musica.loop = pistas.length === 1;
    tocar();
  }

  // La galería avisa si el elemento visible es un video con sonido
  function onCambioVideo(conAudio) {
    videoSonando = conAudio;
    if (!musica.paused) fundido(volObjetivo());
  }

  function activarSonido() {
    if (pistas.length && musica.paused) tocar();
    document.getElementById('gal')._activarSonido();
  }

  UI.autoData(data => {
    const fotos = API.para(data.fotos, 'familias');
    UI.gallery(document.getElementById('gal'), fotos,
      { seg: CFG.DURACION_FOTO_SEG, maxVideo: CFG.DURACION_VIDEO_MAX_SEG, sonido: CFG.VIDEO_CON_SONIDO_FAMILIAS, onCambio: onCambioVideo },
      'Actividades del colegio');
    setMusica(data.musica || []);
    const videosConAudio = CFG.VIDEO_CON_SONIDO_FAMILIAS && fotos.some(f => UI.youtubeId(f.url) && f.audio !== 'no');
    if (pistas.length || videosConAudio) UI.pedirSonido(activarSonido);
    renderFechas(data.fechas || [], (data.actividades || []).filter(a => a.publico === 'familias' || a.publico === 'ambos'));
    notas = API.para(data.noticias, 'familias');
    rotarTip();
    UI.renderTicker(document.getElementById('ticker'), API.para(data.avisos, 'familias'));
  });
})();
