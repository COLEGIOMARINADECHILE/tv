// Perfil Familias: pantalla completa informativa
(function () {
  const CFG = window.APP_CONFIG;
  const { esc, MESES, parseFecha, diasHasta } = UI;

  // Espacio (edificio) de este TV: muestra lo publicado para ese edificio y sus salas de reunión
  const ESPACIO = UI.espacioTv();
  document.getElementById('hdr').outerHTML = UI.header(ESPACIO ? 'Familias · ' + UI.ESPACIOS[ESPACIO].corto : 'Familias');
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
    return { chip, sub, clase: dias === 0 ? 'soon hoy' : dias <= 3 ? 'soon' : '', orden: dias };
  }

  // Los estados cambian con la hora ("Mañana" → "¡Hoy!" → "Disponible ahora"): se recalculan cada minuto
  let ultimasFechas = null;
  setInterval(() => ultimasFechas && renderFechas(...ultimasFechas), 60000);
  // al terminar de cargar las letras cambia el alto de las tarjetas: se vuelve a calcular cuántas caben
  document.fonts?.ready.then(() => ultimasFechas && renderFechas(...ultimasFechas));
  window.addEventListener('resize', () => ultimasFechas && renderFechas(...ultimasFechas));

  function renderFechas(fechas, acts) {
    ultimasFechas = [fechas, acts];
    // Fechas importantes (pueden ser un período) + actividades marcadas para familias
    const todas = fechas.concat(acts.map(a => ({
      titulo: a.titulo,
      fecha: a.fecha,
      descripcion: [a.hora && a.hora + ' hrs', a.lugar].filter(Boolean).join(' · ') || a.descripcion,
      icono: a.icono || '📌',
      hora: a.hora,
      importante: a.importante,
    })));
    const imp = f => (f.importante === 'si' ? 0 : 1);
    const ahora = new Date();
    const vistos = new Set();
    const lista = todas
      .filter(f => {
        if (f.fechaFin) return momento(f.fechaFin, f.horaFin, true) >= ahora; // período aún no termina
        return !UI.yaPaso(f.fecha, f.hora); // desaparece al pasar (con hora: 1 h después de comenzar)
      })
      .filter(f => {
        const k = f.fecha + '|' + String(f.titulo).toLowerCase().trim();
        return !vistos.has(k) && vistos.add(k);
      })
      .map(f => ({ ...f, est: estadoFecha(f) }))
      // las ⭐ importantes primero (siempre visibles), luego por cercanía
      .sort((a, b) => imp(a) - imp(b) || a.est.orden - b.est.orden);
    const cont = document.getElementById('fechas');
    clearInterval(cont._pag);
    if (!lista.length) {
      cont.innerHTML = '<p class="empty-msg">No hay fechas próximas</p>';
      paginasFechas(cont, 0, 0);
      return;
    }
    const tarjetas = lista.map((f, i) => {
      const d = parseFecha(f.fecha);
      const esImp = f.importante === 'si';
      return `<div class="date-item ${f.est.clase}${esImp ? ' importante' : ''}" style="animation-delay:${(i % 4) * 0.08}s">
        <div class="cal"><div class="m">${MESES[d.getMonth()]}</div><div class="d">${d.getDate()}</div>
          ${f.fechaFin ? `<div class="hasta">al ${esc(diaMes(f.fechaFin))}</div>` : ''}</div>
        <div><h3>${esc(f.titulo)}</h3>
          ${f.descripcion || f.est.sub ? `<p>${esc(f.descripcion || '')}${f.descripcion && f.est.sub ? ' · ' : ''}${f.est.sub ? `<span class="periodo">${esc(f.est.sub)}</span>` : ''}</p>` : ''}
          <span class="left">${esc(f.est.chip)}</span>${esImp ? '<span class="cinta-imp">⭐ IMPORTANTE</span>' : ''}</div>
        ${UI.icono(f.icono || '📅')}
      </div>`;
    });

    // Se muestran solo las que caben completas; si son más, avanzan por páginas
    let n = tarjetas.length;
    const cabe = () => {
      cont.innerHTML = tarjetas.slice(0, n).join('');
      // debe caber en su recuadro y también dentro de la columna (en modo reunión el recuadro crece con su contenido)
      const lado = cont.closest('.family-side').getBoundingClientRect().bottom - 14;
      return cont.lastElementChild.getBoundingClientRect().bottom <= Math.min(cont.getBoundingClientRect().bottom + 1, lado);
    };
    cont.classList.add('midiendo'); // sin animación de entrada, para medir la posición real
    while (n > 1 && !cabe()) n--;
    cont.classList.remove('midiendo');
    const paginas = [];
    for (let k = 0; k < tarjetas.length; k += n) paginas.push(tarjetas.slice(k, k + n).join(''));
    let p = Math.min(cont._p || 0, paginas.length - 1); // al recalcular cada minuto se sigue en la misma página
    const mostrar = () => {
      cont._p = p;
      cont.innerHTML = paginas[p];
      cont.classList.remove('pagina-nueva');
      void cont.offsetWidth; // reinicia la animación de entrada
      cont.classList.add('pagina-nueva');
      paginasFechas(cont, paginas.length, p);
    };
    mostrar();
    if (paginas.length > 1) cont._pag = setInterval(() => { p = (p + 1) % paginas.length; mostrar(); }, CFG.DURACION_AGENDA_SEG * 1000);
  }

  // Puntos de página junto al título "Fechas importantes"
  function paginasFechas(cont, total, actual) {
    const titulo = cont.previousElementSibling;
    let ind = titulo.querySelector('.pag');
    if (!ind) titulo.insertAdjacentHTML('beforeend', '<span class="pag"></span>'), (ind = titulo.querySelector('.pag'));
    ind.innerHTML = total > 1 ? Array.from({ length: total }, (_, k) => `<i class="${k === actual ? 'on' : ''}"></i>`).join('') : '';
  }

  // Mensaje destacado para las familias (Admin → Ajustes), sin título
  function renderMensaje(texto) {
    const el = document.getElementById('tip');
    el.hidden = !texto;
    el.innerHTML = texto ? `<div class="tip-wrap fade">
      <img class="tip-logo" src="insignia-color.png" alt="Insignia Colegio Marina de Chile">
      <p class="tip-msg">${esc(texto)}</p></div>` : '';
  }

  // ---------- Franja "Contáctanos": teléfonos + QR (sitio web, Instagram, YouTube) ----------
  const TIPOS_TEL = {
    telefono: { ico: '📞', clase: 't-tel' },
    celular: { ico: '📱', clase: 't-cel' },
    whatsapp: { ico: '💬', clase: 't-wsp' },
    correo: { ico: '✉️', clase: 't-mail' },
  };
  let contactoFirma = null;
  let telTimer;

  function renderContacto(aj) {
    const tels = UI.contactos(aj.telefonos);
    const redes = UI.redes(aj);
    const firma = JSON.stringify([tels, redes]);
    if (firma === contactoFirma) return;
    contactoFirma = firma;
    const el = document.getElementById('contacto');
    clearInterval(telTimer);
    el.hidden = !tels.length && !redes.length;
    if (el.hidden) return;

    // de a 4 teléfonos; si hay más, rotan
    const POR_GRUPO = 4;
    // cada teléfono con su propio color (para no confundirlos); el ícono indica el tipo
    const grupo = n => tels.slice(n, n + POR_GRUPO).map((t, k) => {
      const tp = TIPOS_TEL[t.tipo] || TIPOS_TEL.telefono;
      return `<div class="ct-tel col-${(n + k) % 6} fade"><span class="ct-ico">${tp.ico}</span>
        <div><small>${esc(t.nombre)}</small><b>${esc(t.numero)}</b></div></div>`;
    }).join('');

    el.innerHTML = `
      ${tels.length ? `<div class="ct-tels">
        <div class="ct-titulo">📞 Contáctanos</div>
        <div class="ct-lista" id="ct-lista">${grupo(0)}</div>
      </div>` : ''}
      ${redes.length ? `<div class="ct-qrs">
        <div class="ct-scan"><span>📱</span> <b>Escanea</b> con la cámara de tu celular para acceder directo</div>
        <div class="ct-qr-fila">${redes.map((r, i) => `<div class="ct-qr ${r.clase}">
          <div class="qr-caja"><div class="qr" id="qr-${i}"></div></div>
          <span>${r.ico} ${esc(r.nombre)}</span><small>${esc(r.texto)}</small></div>`).join('')}</div>
      </div>` : ''}`;

    // códigos QR
    redes.forEach((r, i) => {
      const caja = document.getElementById('qr-' + i);
      const px = Math.round(window.innerHeight * 0.12);
      if (window.QRCode) {
        new QRCode(caja, { text: r.url, width: px, height: px, colorDark: '#06153a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      } else {
        caja.textContent = r.texto; // sin internet para cargar el generador
      }
    });

    if (tels.length > POR_GRUPO) {
      let n = 0;
      telTimer = setInterval(() => {
        n = n + POR_GRUPO >= tels.length ? 0 : n + POR_GRUPO;
        document.getElementById('ct-lista').innerHTML = grupo(n);
      }, 8000);
    }
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
      const sonar = url => {
        if (pistas[pista % pistas.length] !== p) return; // ya se cambió de canción
        musica.src = url;
        musica.loop = unica;
        musica.volume = vol;
        musica.play().catch(() => UI.pedirSonido(activarSonido)); // navegador: esperar un clic/OK
      };
      // MP3 subido a Drive: se descarga vía Apps Script (Drive ya no deja reproducirlo directo)
      if (p.fileId) API.video(p.fileId).then(sonar).catch(() => sonar(p.url));
      else sonar(p.url);
    }
  }

  // Avisos del reproductor de YouTube de la música
  window.addEventListener('message', e => {
    if (!ytFrame || e.source !== ytFrame.contentWindow) return;
    let d;
    try { d = JSON.parse(e.data); } catch (err) { return; }
    // si el reproductor partió en silencio y ya se puede sonar, se le devuelve el sonido
    if (UI.sonidoPermitido() && (d.event === 'onReady' || (d.info && d.info.muted === true)) && (ytFrame._reintentos = (ytFrame._reintentos || 0) + 1) <= 8) {
      ytCmd('unMute');
      aplicarVolumen(vol);
    }
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

  // Mientras suene un video del carrusel, la música de fondo baja.
  const gal = document.getElementById('gal');

  // Si la música es de YouTube, se pausa mientras se reproduce cualquier video del carrusel:
  // muchos TV no pueden con dos videos a la vez (se pegan o no parten). Vuelve al terminar.
  new MutationObserver(() => {
    if (!ytFrame) return;
    const hayVideo = document.body.classList.contains('video-activo');
    if (hayVideo !== !!ytFrame._pausadoPorVideo) {
      ytFrame._pausadoPorVideo = hayVideo;
      ytCmd(hayVideo ? 'pauseVideo' : 'playVideo');
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

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
    gal._activarSonido();
  }

  // ---------- Modo reunión de apoderados: primero, la sala de cada curso por edificio ----------
  let principal = () => {};
  setInterval(() => principal(), 30000); // se activa / desactiva solo según el horario elegido
  let ultimoAj = null;
  setInterval(() => ultimoAj && renderProximas(ultimoAj), 60000); // "Mañana" → "Hoy" → desaparece al empezar

  // "Próxima reunión de apoderados": antes del día se anuncia qué cursos (en rango), en qué edificio y a qué hora.
  // El día de la reunión aparece el tablero con las salas.
  const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function cuandoReunion(fecha) {
    const d = parseFecha(fecha);
    const n = diasHasta(fecha);
    const dia = `${DIAS_SEM[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    return n === 0 ? 'Hoy, ' + dia : n === 1 ? 'Mañana, ' + dia : dia.charAt(0).toUpperCase() + dia.slice(1);
  }
  function renderProximas(aj) {
    const box = document.getElementById('prox-reunion');
    const lista = UI.proximasReuniones(aj)
      .map(r => Object.assign({}, r, { grupos: r.grupos.filter(g => !ESPACIO || g.espacio === ESPACIO) }))
      .filter(r => r.grupos.length);
    const firma = JSON.stringify(lista.map(r => [r.fecha, r.grupos]));
    if (box._firma === firma) return;
    box._firma = firma;
    clearInterval(box._rot);
    box.hidden = !lista.length;
    if (!lista.length) { box.innerHTML = ''; return; }
    const tarjeta = r => `<div class="pr-head"><span class="pr-tag">👨‍👩‍👧 Próxima reunión de apoderados</span></div>
      <div class="pr-dia">📅 ${esc(cuandoReunion(r.fecha))}</div>
      <div class="pr-grupos">${r.grupos.map(g => `<div class="pr-grupo pr-${g.grupo}">
        <b>${esc(g.cursos)}</b>
        <span>${esc(g.espacio ? UI.ESPACIOS[g.espacio].nombre : UI.EDIFICIOS[g.grupo])}</span>
        ${g.hora ? `<span class="pr-hora">🕒 ${esc(g.hora)} hrs</span>` : ''}
      </div>`).join('')}</div>`;
    // si hay más de una reunión próxima (ej. Básica y Media), se alternan
    let k = 0;
    const mostrar = () => { box.innerHTML = `<div class="fade">${tarjeta(lista[k])}</div>`; };
    mostrar();
    if (lista.length > 1) box._rot = setInterval(() => { k = (k + 1) % lista.length; mostrar(); }, 12000);
  }

  // Devuelve true si el modo está activo (y lo muestra); false si hay que mostrar el carrusel.
  // Mientras está activo, las fotos siguen pasando en un recuadro más chico al costado.
  const galMini = document.getElementById('gal-mini');
  function renderReunion(aj, fotos) {
    const r = UI.reunion(aj);
    // en el TV de un edificio, solo las salas de ese edificio (más grandes y sin cambiar de página)
    if (ESPACIO) r.cursos = r.cursos.filter(c => UI.ESPACIOS[ESPACIO].grupos.includes(c.edificio));
    const box = document.getElementById('reunion');
    const reacomodarFechas = () => ultimasFechas && setTimeout(() => renderFechas(...ultimasFechas), 50);
    if (!r.vigente || !r.cursos.length) {
      if (!box.hidden) {
        box.hidden = true;
        box.innerHTML = '';
        box._firma = '';
        clearInterval(box._pag);
        gal.hidden = false;
        if (galMini._detener) galMini._detener();
        galMini.hidden = true;
        document.body.classList.remove('modo-reunion');
        reacomodarFechas();
      }
      return false;
    }
    if (gal._detener) gal._detener(); // el carrusel grande se detiene (videos y su sonido)
    gal.hidden = true;
    box.hidden = false;
    if (!document.body.classList.contains('modo-reunion')) {
      document.body.classList.add('modo-reunion');
      reacomodarFechas();
    }
    // fotos al costado: solo imágenes (sin videos ni sonido, para no distraer)
    const soloFotos = fotos.filter(f => f.url && !UI.youtubeId(f.url) && !UI.instagramRuta(f.url) && f.formato !== 'video')
      .map(f => ({ titulo: f.titulo, url: f.url, etiqueta: f.historia ? 'Instagram' : f.etiqueta }));
    galMini.hidden = !soloFotos.length;
    if (soloFotos.length) {
      UI.gallery(galMini, soloFotos, { seg: 8, maxVideo: 0, sonido: false, perfil: 'mini' }, 'Actividades del colegio');
    }

    const firma = JSON.stringify([r.titulo, r.horas, r.cursos]);
    if (box._firma === firma) return true;
    box._firma = firma;
    clearInterval(box._pag);

    const edificios = Object.keys(UI.EDIFICIOS).filter(e => r.cursos.some(c => c.edificio === e));
    // cada columna tan ancha como cursos tiene (un edificio con 2 cursos no ocupa lo mismo que uno con 8)
    const anchos = edificios.map(e => `minmax(0,${Math.max(r.cursos.filter(c => c.edificio === e).length, 5)}fr)`).join(' ');
    // cada curso: su sala (y piso) o, si cambió, el aviso
    const fila = c => `<div class="reu-fila ${c.estado ? 'est-' + esc(c.estado) : ''}">
      <b class="reu-curso">${esc(c.curso)}</b>
      ${c.estado === 'sin' ? '<span class="reu-sala aviso">🚫 Sin reunión</span>'
        : c.estado === 'cambio' ? `<span class="reu-sala aviso">📅 Cambiada${c.cambio ? ': ' + esc(c.cambio) : ' a otro día'}</span>`
        : `<span class="reu-sala">${esc(UI.nombreSala(c.sala) || 'Sala por confirmar')}</span>
          ${c.piso ? `<span class="reu-piso">${esc(c.piso)}° piso</span>` : ''}`}
    </div>`;
    box.innerHTML = `
      <div class="reu-head">
        <span class="reu-tag">👨‍👩‍👧 Reunión de apoderados</span>
        ${r.titulo ? `<span class="reu-titulo">${esc(r.titulo)}</span>` : ''}
        <span class="reu-nota">Busque el curso de su hijo o hija y diríjase a la sala indicada</span>
      </div>
      <div class="reu-cols ${['', 'una', 'dos', 'tres'][edificios.length]}" style="grid-template-columns:${anchos}">
        ${edificios.map(e => `<div class="reu-col reu-${e}">
          <h3><span>${UI.EDIFICIOS[e]}</span>
            ${(r.horas || {})[e] ? `<span class="reu-hora">🕒 ${esc(r.horas[e])} hrs</span>` : ''}<span class="pag"></span></h3>
          <div class="reu-lista"></div></div>`).join('')}
      </div>`;

    // cada edificio muestra los cursos que caben y, si son más, avanzan por páginas
    const cols = [...box.querySelectorAll('.reu-col')].map((col, k) => {
      const lista = col.querySelector('.reu-lista');
      const filas = r.cursos.filter(c => c.edificio === edificios[k]).map(fila);
      let n = filas.length;
      lista.classList.add('midiendo');
      const cabe = () => {
        lista.innerHTML = filas.slice(0, n).join('');
        return lista.lastElementChild.getBoundingClientRect().bottom <= lista.getBoundingClientRect().bottom + 1;
      };
      while (n > 1 && !cabe()) n--;
      lista.classList.remove('midiendo');
      const paginas = [];
      for (let j = 0; j < filas.length; j += n) paginas.push(filas.slice(j, j + n).join(''));
      return { lista, ind: col.querySelector('.pag'), paginas, p: 0 };
    });
    const mostrar = () => cols.forEach(c => {
      c.lista.innerHTML = c.paginas[c.p];
      c.lista.classList.remove('pagina-nueva');
      void c.lista.offsetWidth;
      c.lista.classList.add('pagina-nueva');
      c.ind.innerHTML = c.paginas.length > 1 ? c.paginas.map((_, j) => `<i class="${j === c.p ? 'on' : ''}"></i>`).join('') : '';
    });
    mostrar();
    if (cols.some(c => c.paginas.length > 1)) {
      box._pag = setInterval(() => { cols.forEach(c => (c.p = (c.p + 1) % c.paginas.length)); mostrar(); }, 12000);
    }
    return true;
  }

  UI.autoData(todo => {
    // solo lo publicado para todos o para el edificio de este TV
    const data = Object.assign({}, todo);
    ['fotos', 'fechas', 'actividades', 'avisos', 'noticias'].forEach(k => (data[k] = UI.paraEspacio(todo[k], ESPACIO)));
    const aj = UI.ajustes(data);
    renderMensaje(aj.mensajeTexto);
    renderContacto(aj);
    // Actividades del colegio + Educación en el mismo carrusel (el rótulo indica la categoría)
    const fotos = UI.carrusel(data, 'familias');
    principal = () => {
      // Modo reunión de apoderados: ocupa el lugar del carrusel mientras esté activo
      if (renderReunion(aj, fotos)) return;
      UI.gallery(gal, fotos,
        { seg: aj.segFotosFamilias, maxVideo: CFG.DURACION_VIDEO_MAX_SEG, sonido: CFG.VIDEO_CON_SONIDO_FAMILIAS,
          perfil: 'familias', onCambio: onCambioVideo },
        'Actividades del colegio');
    };
    principal();
    setMusica(data.musica || []);
    // en el equipo quedan guardados solo los videos y canciones que siguen publicados
    API.limpiarMedios((data.fotos || []).filter(f => f.formato === 'video' && f.fileId).map(f => f.fileId)
      .concat((data.musica || []).filter(m => m.fileId).map(m => m.fileId)));
    const videosConAudio = CFG.VIDEO_CON_SONIDO_FAMILIAS &&
      fotos.some(f => UI.youtubeId(f.url) && f.audio !== 'no');
    if (pistas.length || videosConAudio) UI.pedirSonido(activarSonido);
    ultimoAj = aj;
    renderProximas(aj);
    // primero el aviso de HOY: así las fechas se reparten en el espacio que realmente queda
    UI.avisoHoy(document.getElementById('aviso-hoy'),
      (data.actividades || []).filter(a => a.publico === 'familias' || a.publico === 'ambos').concat(data.fechas || []));
    renderFechas(data.fechas || [], (data.actividades || []).filter(a => a.publico === 'familias' || a.publico === 'ambos'));
    UI.renderTicker(document.getElementById('ticker'), API.para(data.avisos, 'familias'), aj.velocidadAvisos);
  });
})();
