// Perfil Familias: pantalla completa informativa
(function () {
  const CFG = window.APP_CONFIG;
  const { esc, MESES, parseFecha, diasHasta } = UI;

  document.getElementById('hdr').outerHTML = UI.header('Familias');
  UI.startClock();
  UI.backToHome();

  // Momento exacto (Date) de una fecha "yyyy-mm-dd" + hora "HH:MM" opcional
  function momento(fecha, hora, finDelDia) {
    const d = parseFecha(fecha);
    if (!d) return null;
    const m = UI.minutosDelDia(hora);
    if (m !== null) d.setMinutes(m);
    else if (finDelDia) d.setHours(23, 59, 59);
    return d;
  }

  const diaMes = s => { const d = parseFecha(s); return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : ''; };

  // Texto del estado de una fecha o período: { chip, clase, orden }
  function estadoFecha(f) {
    const ahora = new Date();
    const ini = momento(f.fecha, f.hora, false);
    const fin = f.fechaFin ? momento(f.fechaFin, f.horaFin, true) : null;
    const dias = diasHasta(f.fecha);
    if (fin && ahora >= ini) {
      // período vigente
      const quedan = diasHasta(f.fechaFin);
      const resta = quedan === 0
        ? (f.horaFin ? `Termina hoy a las ${f.horaFin}` : 'Último día')
        : quedan === 1 ? 'Termina mañana' : `Quedan ${quedan} días`;
      return { chip: '🟢 Disponible ahora', sub: `Hasta el ${diaMes(f.fechaFin)}${f.horaFin ? ' · ' + f.horaFin + ' hrs' : ''} · ${resta}`, clase: 'vigente', orden: -1 };
    }
    const hora = f.hora ? ` desde las ${f.hora}` : '';
    let chip = dias === 0 ? '¡Hoy!' : dias === 1 ? 'Mañana' : `En ${dias} días`;
    if (f.hora && dias <= 1) chip += hora.replace(' desde las', ' ·');
    const sub = fin ? `Del ${diaMes(f.fecha)}${f.hora ? ' (' + f.hora + ' hrs)' : ''} al ${diaMes(f.fechaFin)}` : '';
    return { chip, sub, clase: dias <= 3 ? 'soon' : '', orden: dias };
  }

  // Los estados cambian con la hora ("Mañana" → "¡Hoy!" → "Disponible ahora"): se recalculan cada minuto
  let ultimasFechas = null;
  setInterval(() => ultimasFechas && renderFechas(...ultimasFechas), 60000);

  function renderFechas(fechas, acts) {
    ultimasFechas = [fechas, acts];
    // Fechas importantes (pueden ser un período) + actividades marcadas para familias
    const todas = fechas.concat(acts.map(a => ({
      titulo: a.titulo,
      fecha: a.fecha,
      descripcion: [a.hora && a.hora + ' hrs', a.lugar].filter(Boolean).join(' · ') || a.descripcion,
      icono: a.icono || '📌',
    })));
    const ahora = new Date();
    const vistos = new Set();
    const lista = todas
      .filter(f => {
        if (f.fechaFin) return momento(f.fechaFin, f.horaFin, true) >= ahora; // período aún no termina
        const d = diasHasta(f.fecha);
        return d !== null && d >= 0;
      })
      .filter(f => {
        const k = f.fecha + '|' + String(f.titulo).toLowerCase().trim();
        return !vistos.has(k) && vistos.add(k);
      })
      .map(f => ({ ...f, est: estadoFecha(f) }))
      .sort((a, b) => a.est.orden - b.est.orden)
      .slice(0, 4);
    document.getElementById('fechas').innerHTML = lista.length ? lista.map((f, i) => {
      const d = parseFecha(f.fecha);
      return `<div class="date-item ${f.est.clase}" style="animation-delay:${i * 0.08}s">
        <div class="cal"><div class="m">${MESES[d.getMonth()]}</div><div class="d">${d.getDate()}</div>
          ${f.fechaFin ? `<div class="hasta">al ${esc(diaMes(f.fechaFin))}</div>` : ''}</div>
        <div><h3>${esc(f.titulo)}</h3>${f.descripcion ? `<p>${esc(f.descripcion)}</p>` : ''}
          ${f.est.sub ? `<p class="periodo">${esc(f.est.sub)}</p>` : ''}
          <span class="left">${esc(f.est.chip)}</span></div>
        ${UI.icono(f.icono || '📅')}
      </div>`;
    }).join('') : '<p class="empty-msg">No hay fechas próximas</p>';
  }

  // Recuadro amarillo: solo el mensaje editable (Admin → Ajustes), sin título
  function renderMensaje(texto) {
    const el = document.getElementById('tip');
    el.hidden = !texto;
    el.innerHTML = texto ? `<div class="fade"><p class="tip-msg">${esc(texto)}</p></div>` : '';
  }

  // Educación: recuadro propio (solo aparece si hay algo para familias).
  // Los videos se reproducen ahí mismo y los textos se leen unos segundos.
  const eduBox = document.getElementById('edu-fam-box');
  const eduFam = document.getElementById('edu-fam');
  function renderEducacion(notas) {
    const items = notas.map(n => UI.enlaceVideo(n)
      ? { titulo: n.titulo, url: UI.enlaceVideo(n), audio: n.audio, audioFunc: n.audioFunc, vecesAudio: n.vecesAudio }
      : { titulo: n.titulo, texto: UI.textoLimpio(n) });
    eduBox.hidden = !items.length;
    UI.gallery(eduFam, items,
      { seg: CFG.DURACION_EDUCACION_SEG, maxVideo: CFG.DURACION_VIDEO_MAX_SEG, sonido: CFG.VIDEO_CON_SONIDO_FAMILIAS,
        perfil: 'familias', onCambio: onCambioEdu },
      '📚 Experiencia educativa');
    return items.filter(f => f.url);
  }

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

  // Sonido: si el video de Educación suena tiene prioridad (se silencia el carrusel);
  // mientras suene cualquier video, la música de fondo baja.
  const gal = document.getElementById('gal');
  let galAudio = false;
  let eduAudio = false;

  function ajustarMusica() {
    videoSonando = galAudio || eduAudio;
    if (pistas.length) fundido(volObjetivo());
  }

  function onCambioVideo(conAudio) {
    galAudio = conAudio;
    ajustarMusica();
  }

  function onCambioEdu(conAudio) {
    eduAudio = conAudio;
    if (gal._setMudo) gal._setMudo(conAudio);
    else gal._mudo = conAudio;
    ajustarMusica();
  }

  function activarSonido() {
    if (ytFrame) {
      ytCmd('unMute');
      aplicarVolumen(volObjetivo());
    } else if (pistas.length && musica.paused) {
      tocar();
    }
    eduFam._activarSonido && eduFam._activarSonido();
    gal._activarSonido();
  }

  UI.autoData(data => {
    const aj = UI.ajustes(data);
    renderMensaje(aj.mensajeTexto);
    const fotos = API.para(data.fotos, 'familias');
    UI.gallery(gal, fotos,
      { seg: aj.segFotosFamilias, maxVideo: CFG.DURACION_VIDEO_MAX_SEG, sonido: CFG.VIDEO_CON_SONIDO_FAMILIAS,
        perfil: 'familias', onCambio: onCambioVideo },
      'Actividades del colegio');
    const videosEdu = renderEducacion(API.para(data.noticias, 'familias'));
    setMusica(data.musica || []);
    const videosConAudio = CFG.VIDEO_CON_SONIDO_FAMILIAS &&
      fotos.concat(videosEdu).some(f => UI.youtubeId(f.url) && f.audio !== 'no');
    if (pistas.length || videosConAudio) UI.pedirSonido(activarSonido);
    renderFechas(data.fechas || [], (data.actividades || []).filter(a => a.publico === 'familias' || a.publico === 'ambos'));
    UI.avisoHoy(document.getElementById('aviso-hoy'),
      (data.actividades || []).filter(a => a.publico === 'familias' || a.publico === 'ambos').concat(data.fechas || []));
    UI.renderTicker(document.getElementById('ticker'), API.para(data.avisos, 'familias'), aj.velocidadAvisos);
  });
})();
