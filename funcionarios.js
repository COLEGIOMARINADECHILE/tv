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
      player.innerHTML = `<div class="empty"><img src="assets/insignia.png" alt=""><b>${esc(c.nombre)}</b>
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
  function renderAgenda(acts) {
    const lista = acts
      .map(a => ({ ...a, dias: diasHasta(a.fecha) }))
      .filter(a => a.dias !== null && a.dias >= 0 && a.dias <= 7)
      .sort((a, b) => a.dias - b.dias || String(a.hora).localeCompare(String(b.hora)));
    const el = document.getElementById('agenda');
    el.innerHTML = lista.length ? `<div class="agenda-grid">${lista.map((a, i) => {
      const d = parseFecha(a.fecha);
      return `<div class="event ${a.dias === 0 ? 'today' : ''}" style="animation-delay:${i * 0.06}s">
        <div class="day"><div class="d">${d.getDate()}</div><div class="m">${a.dias === 0 ? 'HOY' : MESES[d.getMonth()]}</div></div>
        <div><h3>${esc(a.titulo)}</h3>${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ''}
        <div class="meta">${a.hora ? '🕒 ' + esc(a.hora) + ' hrs' : ''}${a.lugar ? ' · 📍 ' + esc(a.lugar) : ''}</div></div>
      </div>`;
    }).join('')}</div>` : '<p class="empty-msg">No hay actividades programadas esta semana</p>';
    UI.autoScroll(el);
  }

  function renderEdu(notas) {
    const icons = ['💡', '🎯', '🧠', '🌱', '📖'];
    const el = document.getElementById('edu');
    el.innerHTML = notas.length ? notas.map((n, i) => `
      <article class="edu" style="animation-delay:${i * 0.1}s">
        ${UI.miniaturaVideo(UI.enlaceVideo(n))}
        <h3>${icons[i % icons.length]} ${esc(n.titulo)}</h3>${UI.textoLimpio(n) ? `<p>${esc(UI.textoLimpio(n))}</p>` : ''}
      </article>`).join('') : '<p class="empty-msg">Sin publicaciones</p>';
    UI.autoScroll(el);
  }

  // Si un video suena, la TV se pausa para que no se mezclen; vuelve al terminar
  function onCambioVideo(conAudio) {
    if (!conTv || conAudio === tvPausada) return;
    tvPausada = conAudio;
    if (conAudio) {
      NATIVE && NATIVE.hideTv();
      player.innerHTML = `<div class="empty"><img src="assets/insignia.png" alt="">
        <b>TV en pausa</b>Se está reproduciendo un video del colegio con sonido.</div>`;
    } else {
      sintonizar(actual);
    }
  }

  function activarSonido() {
    document.getElementById('gal')._activarSonido();
  }

  UI.autoData(data => {
    renderCanales(data.canales || []);
    renderAgenda(API.para(data.actividades, 'funcionarios'));
    const fotos = UI.carrusel(data, 'funcionarios');
    UI.gallery(document.getElementById('gal'), fotos,
      { seg: CFG.DURACION_FOTO_FUNCIONARIOS_SEG, maxVideo: CFG.DURACION_VIDEO_MAX_SEG, sonido: true,
        audioDe: f => f.audioFunc === 'si', onCambio: onCambioVideo },
      'Actividades del colegio');
    if (fotos.some(f => UI.youtubeId(f.url) && f.audioFunc === 'si')) UI.pedirSonido(activarSonido);
    renderEdu(API.para(data.noticias, 'funcionarios'));
    UI.renderTicker(document.getElementById('ticker'), API.para(data.avisos, 'funcionarios'));
  });
})();
