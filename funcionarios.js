// Perfil Funcionarios: TV en vivo (mitad izquierda) + información (mitad derecha)
(function () {
  const CFG = window.APP_CONFIG;
  const { esc, MESES, parseFecha, diasHasta } = UI;
  // Dentro de la app Android TV existe el puente nativo window.AndroidTV
  const NATIVE = window.AndroidTV || null;
  const KEY_CANAL = 'cmch_canal';
  const KEY_TV = 'cmch_con_tv';

  document.getElementById('hdr').outerHTML = UI.header('Funcionarios');
  UI.startClock();
  UI.backToHome();

  const player = document.getElementById('player');
  const chList = document.getElementById('channels');
  let canales = [];
  let actual = 0;
  let tvPausada = false;
  try { actual = +localStorage.getItem(KEY_CANAL) || 0; } catch (e) {}

  // ¿Este televisor muestra TV? Lo recuerda cada equipo. Por defecto sí,
  // salvo que la dirección traiga ?tv=0 (ej. una APK creada "sin TV").
  let conTv = new URLSearchParams(location.search).get('tv') !== '0';
  try {
    const guardado = localStorage.getItem(KEY_TV);
    if (guardado !== null) conTv = guardado === '1';
  } catch (e) {}

  function cambiarTv(mostrar) {
    try { localStorage.setItem(KEY_TV, mostrar ? '1' : '0'); } catch (e) {}
    NATIVE && NATIVE.hideTv();
    location.reload();
  }

  if (!conTv) {
    document.querySelector('main.split').classList.add('sin-tv');
    // botón en el encabezado para volver a ver TV (se elige con OK del control)
    document.querySelector('.tv-header .clock').insertAdjacentHTML('beforebegin',
      '<button class="tv-toggle" id="ver-tv">📺 Ver TV</button>');
    const b = document.getElementById('ver-tv');
    b.onclick = () => cambiarTv(true);
    b.focus();
  }

  // ---------- Televisión ----------
  function embedUrl(url) {
    let m;
    if ((m = url.match(/youtube\.com\/channel\/(UC[\w-]+)/))) return { type: 'iframe', src: `https://www.youtube.com/embed/live_stream?channel=${m[1]}&autoplay=1&mute=1` };
    if ((m = url.match(/(?:youtu\.be\/|v=|\/live\/|\/embed\/)([\w-]{11})/))) return { type: 'iframe', src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1` };
    if (/\.(m3u8|mp4)(\?|$)/i.test(url)) return { type: 'video', src: url };
    return { type: 'iframe', src: url, web: true };
  }

  function playerRect() {
    const r = player.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  }

  function sintonizar(i, osd) {
    if (!conTv || !canales.length) return;
    actual = (i + canales.length) % canales.length;
    try { localStorage.setItem(KEY_CANAL, actual); } catch (e) {}
    const c = canales[actual];
    chList.querySelectorAll('.channel-btn').forEach((b, k) => b.classList.toggle('active', k === actual));
    if (tvPausada) return; // un video con sonido está sonando; la TV vuelve al terminar

    if (!c.url) {
      NATIVE && NATIVE.hideTv();
      player.innerHTML = `<div class="empty"><img src="insignia.png" alt=""><b>${esc(c.nombre)}</b>
        Agregue el enlace de este canal en el panel Administrador.</div>`;
      return;
    }
    if (NATIVE) {
      // La app nativa dibuja la señal exactamente sobre este recuadro
      player.innerHTML = `<div class="empty"><b>Cargando ${esc(c.nombre)}…</b></div>`;
      NATIVE.showTv(c.url, ...playerRect());
    } else {
      const e = embedUrl(c.url);
      player.innerHTML = e.type === 'video'
        ? `<video src="${esc(e.src)}" autoplay muted controls playsinline></video>`
        : `<iframe src="${esc(e.src)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
      player.insertAdjacentHTML('beforeend', '<div class="live">EN VIVO</div>');
      if (e.web) {
        player.insertAdjacentHTML('beforeend', `<div class="osd show" style="top:auto;bottom:1.4vh;font-size:1.5vh;color:#fff">
          Si la señal no aparece aquí, este canal se ve en la app Android TV</div>`);
        setTimeout(() => player.querySelectorAll('.osd').forEach(o => o.classList.remove('show')), 8000);
      }
    }
    if (osd) {
      player.insertAdjacentHTML('beforeend', `<div class="osd show" id="osd">${actual + 1} · ${esc(c.nombre)}</div>`);
      setTimeout(() => document.getElementById('osd')?.classList.remove('show'), 2500);
    }
  }

  function renderCanales(lista) {
    if (!conTv) return;
    const nuevos = lista.slice().sort((a, b) => (+a.orden || 0) - (+b.orden || 0));
    if (JSON.stringify(nuevos) === JSON.stringify(canales)) return; // sin cambios → no interrumpir
    canales = nuevos;
    chList.innerHTML = canales.map((c, i) =>
      `<button class="channel-btn" data-i="${i}"><span class="num">${i + 1}</span>${esc(c.nombre)}</button>`).join('') +
      '<button class="channel-btn tv-off" id="ocultar-tv"><span class="num">✕</span>Ocultar TV</button>';
    chList.querySelectorAll('.channel-btn[data-i]').forEach(b => b.addEventListener('click', () => sintonizar(+b.dataset.i, true)));
    document.getElementById('ocultar-tv').onclick = () => cambiarTv(false);
    sintonizar(actual < canales.length ? actual : 0);
    chList.children[actual]?.focus();
  }

  // Control remoto
  document.addEventListener('keydown', e => {
    const btns = [...chList.querySelectorAll('.channel-btn')];
    if (!btns.length) return;
    let f = btns.indexOf(document.activeElement);
    if (f < 0) f = actual;
    const cols = 3;
    const mover = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (mover !== undefined) {
      e.preventDefault();
      btns[Math.min(Math.max(f + mover, 0), btns.length - 1)].focus();
    } else if (e.key === 'ChannelUp' || e.key === 'PageUp' || e.keyCode === 166) {
      e.preventDefault(); sintonizar(actual + 1, true); btns[actual].focus();
    } else if (e.key === 'ChannelDown' || e.key === 'PageDown' || e.keyCode === 167) {
      e.preventDefault(); sintonizar(actual - 1, true); btns[actual].focus();
    } else if (/^[1-9]$/.test(e.key) && +e.key <= canales.length) {
      sintonizar(+e.key - 1, true); btns[actual].focus();
    }
  });

  window.addEventListener('resize', () => NATIVE && conTv && !tvPausada && canales[actual]?.url && NATIVE.showTv(canales[actual].url, ...playerRect()));

  // ---------- Panel informativo (todo visible a la vez) ----------
  // Actividades: bloque destacado "HOY" (con estado en vivo) y, aparte, los próximos días
  let ultimasActs = [];
  function renderAgenda(acts) {
    ultimasActs = acts;
    const lista = acts
      .map(a => ({ ...a, dias: diasHasta(a.fecha) }))
      // las que ya pasaron desaparecen (las de hoy, 1 h después de su hora de inicio)
      .filter(a => !UI.yaPaso(a.fecha, a.hora) && a.dias <= 7)
      .sort((a, b) => a.dias - b.dias || String(a.hora).localeCompare(String(b.hora)));
    const hoy = lista.filter(a => a.dias === 0);
    const semana = lista.filter(a => a.dias > 0);
    const el = document.getElementById('agenda');
    const fechaHoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    // HOY queda fijo arriba (si son más de 2, rotan de a 2).
    // Los próximos días pasan por páginas, sin desplazarse, con tiempo para leerlos.
    (el._pags || []).forEach(clearInterval);
    el._pags = [];

    const tarjetaHoy = a => `
      <div class="hoy-card${a.importante === 'si' ? ' importante' : ''}" data-hora="${esc(a.hora || '')}">
        ${a.importante === 'si' ? '<span class="cinta-imp">⭐ IMPORTANTE</span>' : ''}
        ${UI.icono(a.icono || '📅', 'hoy-ico')}
        <div class="hoy-info">
          <h3>${esc(a.titulo)}</h3>
          <div class="hoy-meta">${a.hora ? `<span>🕒 ${esc(a.hora)} hrs</span>` : ''}${a.lugar ? `<span>📍 ${esc(a.lugar)}</span>` : ''}</div>
          ${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ''}
        </div>
        <div class="hoy-estado"></div>
      </div>`;

    // Próximos días: tarjeta con el día de la semana destacado (un color por día),
    // hora y lugar en etiquetas, y cuánto falta.
    const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const tarjetaSemana = a => {
      const d = parseFecha(a.fecha);
      const falta = a.dias === 1 ? 'Mañana' : `En ${a.dias} días`;
      return `<div class="sem-card dia-${d.getDay()}${a.importante === 'si' ? ' importante' : ''}">
        ${a.importante === 'si' ? '<span class="cinta-imp">⭐ IMPORTANTE</span>' : ''}
        <div class="sem-fecha">
          <span class="sem-dia">${DIAS[d.getDay()]}</span>
          <span class="sem-num">${d.getDate()}</span>
          <span class="sem-mes">${MESES[d.getMonth()]}</span>
        </div>
        <div class="sem-info">
          <h3>${esc(a.titulo)}</h3>
          ${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ''}
          <div class="sem-chips">${a.hora ? `<span>🕒 ${esc(a.hora)}</span>` : ''}${a.lugar ? `<span>📍 ${esc(a.lugar)}</span>` : ''}</div>
        </div>
        <div class="sem-lado">${UI.icono(a.icono || '📅', 'sem-ico')}<span class="sem-falta">${falta}</span></div>
      </div>`;
    };

    // sin actividades, el carrusel (fotos, destacados) usa casi todo el espacio de la columna
    el.closest('.info3')?.classList.toggle('agenda-vacia', !lista.length);
    if (!lista.length) {
      el.innerHTML = '<p class="empty-msg">No hay actividades programadas esta semana</p>';
      return;
    }
    el.innerHTML = `
      ${hoy.length ? `<section class="hoy-bloque">
        <div class="hoy-head"><span class="hoy-tag">⭐ HOY</span><span class="hoy-fecha">${esc(fechaHoy)}</span>
          <span class="pag" id="hoy-pag"></span></div>
        <div class="hoy-cards" id="hoy-cards"></div>
      </section>` : ''}
      ${semana.length ? `<div class="semana-head">📆 Próximos días <span class="pag" id="sem-pag"></span></div>
        <div class="sem-grid" id="sem-grid"></div>` : ''}`;

    if (hoy.length) paginar('hoy-cards', 'hoy-pag', hoy.map(tarjetaHoy), 2, actualizarEstadosHoy);
    if (semana.length) {
      // cuántas tarjetas caben por página: se prueba con muchas y se reduce hasta que no se corten
      const tarjetas = semana.map(tarjetaSemana);
      const grid = document.getElementById('sem-grid');
      const columnas = conTv ? 2 : 1;
      let n = Math.min(tarjetas.length, columnas * 4);
      const cabe = () => {
        grid.innerHTML = tarjetas.slice(0, n).join('');
        const ult = grid.lastElementChild;
        return !ult || ult.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 1;
      };
      while (n > 1 && !cabe()) n -= (n > columnas ? columnas : 1);
      paginar('sem-grid', 'sem-pag', tarjetas, Math.max(1, n));
    }

    function paginar(idCont, idPag, tarjetas, n, alMostrar) {
      const paginas = [];
      for (let k = 0; k < tarjetas.length; k += n) paginas.push(tarjetas.slice(k, k + n).join(''));
      let p = 0;
      const mostrar = () => {
        const c = document.getElementById(idCont);
        const ind = document.getElementById(idPag);
        if (!c) return;
        c.innerHTML = paginas[p];
        c.classList.remove('pagina-nueva');
        void c.offsetWidth; // reinicia la animación de entrada
        c.classList.add('pagina-nueva');
        if (ind) ind.innerHTML = paginas.length > 1 ? paginas.map((_, k) => `<i class="${k === p ? 'on' : ''}"></i>`).join('') : '';
        alMostrar && alMostrar();
      };
      mostrar();
      if (paginas.length > 1) {
        el._pags.push(setInterval(() => { p = (p + 1) % paginas.length; mostrar(); }, CFG.DURACION_AGENDA_SEG * 1000));
      }
    }
  }

  // Estado en vivo de cada actividad de hoy (AHORA / En 25 min / Finalizada)
  function actualizarEstadosHoy() {
    let terminada = false;
    document.querySelectorAll('.hoy-card').forEach(c => {
      const e = UI.estadoHoy(c.dataset.hora);
      if (e.clase === 'fin') terminada = true;
      c.classList.remove('hoy', 'pronto', 'ahora', 'fin');
      c.classList.add(e.clase); // conserva "importante"
      c.querySelector('.hoy-estado').textContent = e.texto;
    });
    // una actividad terminó: se vuelve a armar la agenda sin ella
    if (terminada) setTimeout(() => renderAgenda(ultimasActs), 0);
  }
  setInterval(actualizarEstadosHoy, 30000);

  // Sonido: si un video del carrusel suena, la TV se pausa para que no se mezclen; vuelve al terminar.
  function onCambioVideo(conAudio) {
    if (!conTv || conAudio === tvPausada) return;
    tvPausada = conAudio;
    if (conAudio) {
      NATIVE && NATIVE.hideTv();
      player.innerHTML = `<div class="empty"><img src="insignia.png" alt="">
        <b>TV en pausa</b>Se está reproduciendo un video del colegio con sonido.</div>`;
    } else {
      sintonizar(actual);
    }
  }

  // 🎂 Canción de cumpleaños: suena al aparecer el saludo, las veces al día elegidas en Admin → Ajustes
  // (repartidas en la jornada). Mientras suena, la TV se pausa y luego vuelve.
  let vecesCumple = 3;
  let cantando = false;
  function onCumple() {
    if (!vecesCumple || cantando || tvPausada) return; // 0 = sin canción · si suena un video, no se mezcla
    const CLAVE = 'cmch_cumple_musica';
    const hoy = new Date().toDateString();
    let r = null;
    try { r = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) {}
    if (!r || r.d !== hoy) r = { d: hoy, n: 0, t: 0 };
    const separacion = (CFG.JORNADA_MIN || 600) / vecesCumple * 60000;
    if (r.n >= vecesCumple || (r.t && Date.now() - r.t < separacion)) return;
    r.n++;
    r.t = Date.now();
    try { localStorage.setItem(CLAVE, JSON.stringify(r)); } catch (e) {}
    cantando = true;
    if (conTv) {
      NATIVE && NATIVE.hideTv();
      player.innerHTML = `<div class="empty"><span style="font-size:8vh">🎂</span><b>¡Feliz cumpleaños!</b>La TV vuelve al terminar la canción.</div>`;
    }
    UI.melodiaCumple().then(() => {
      cantando = false;
      if (conTv && !tvPausada) sintonizar(actual);
    });
  }

  function activarSonido() {
    document.getElementById('gal')._activarSonido();
  }

  UI.autoData(data => {
    const aj = UI.ajustes(data);
    vecesCumple = aj.cumpleMusica === undefined || aj.cumpleMusica === '' ? 3 : +aj.cumpleMusica || 0;
    renderCanales(data.canales || []);
    renderAgenda(API.para(data.actividades, 'funcionarios'));
    // Actividades del colegio + Educación en el mismo carrusel (el rótulo indica la categoría)
    const fotos = UI.carrusel(data, 'funcionarios');
    // en el equipo quedan guardados solo los videos que siguen publicados
    API.limpiarMedios((data.fotos || []).filter(f => f.formato === 'video' && f.fileId).map(f => f.fileId));
    UI.gallery(document.getElementById('gal'), fotos,
      { seg: aj.segFotosFuncionarios, maxVideo: CFG.DURACION_VIDEO_MAX_SEG, sonido: true, perfil: 'funcionarios',
        audioDe: f => f.audioFunc === 'si', onCambio: onCambioVideo, onCumple },
      'Actividades del colegio');
    if (fotos.some(f => UI.youtubeId(f.url) && f.audioFunc === 'si')) UI.pedirSonido(activarSonido);
    UI.renderTicker(document.getElementById('ticker'), API.para(data.avisos, 'funcionarios'), aj.velocidadAvisos);
  });
})();
