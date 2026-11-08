// Panel Administrador: publica información e imágenes en Google Sheets / Drive.
(function () {
  const CFG = window.APP_CONFIG;
  const { esc } = UI;
  const app = document.getElementById('app');
  const PASS_KEY = 'cmch_admin_pass';
  let password = '';
  try { password = sessionStorage.getItem(PASS_KEY) || ''; } catch (e) {}
  let data = null;
  let seccion = 'actividades';
  let editando = null; // publicación que se está editando (o null = agregar nueva)
  // Tamaño máximo de archivos (se suben por partes de 8 MB; cada pantalla los descarga una vez y los guarda)
  // (cada TV descarga el archivo por partes una sola vez y lo guarda; archivos muy grandes tardan más la primera vez)
  const MAX_VIDEO_MB = 500;
  const MAX_AUDIO_MB = 500;

  // En qué edificio se muestra en las pantallas Familias (cada TV Familias elige su espacio al abrirse)
  const ESPACIO_SEL = `<label>🏫 Espacio en pantallas Familias
    <select name="espacio"><option value="">Todos los edificios</option>
    <option value="matriz">🏫 Edificio Matriz (Prebásica y 5° Básico a 4° Medio)</option>
    <option value="menor">🧒 Edificio Ciclo Menor (1° a 4° Básico)</option></select></label>`;
  const PUBLICO = `<label>Mostrar a
    <select name="publico"><option value="ambos">Funcionarios y familias</option>
    <option value="funcionarios">Solo funcionarios</option><option value="familias">Solo familias</option></select></label>
    ${ESPACIO_SEL}`;

  // Lista de cursos del colegio agrupada por nivel (para elegir con un clic)
  const opcionesCursos = (sel, vacio) => `<option value="">${vacio}</option>` +
    Object.values(UI.NIVELES).map(n => `<optgroup label="${esc(n.nombre.replace(/^\S+\s/, ''))}">${n.cursos.map(c =>
      `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('')}</optgroup>`).join('');

  // Cuántas veces al día suena un video (para no saturar)
  const OPC_VECES = [['', 'Siempre'], ['1', '1 vez al día'], ['2', '2 veces al día'], ['3', '3 veces al día'],
    ['4', '4 veces al día'], ['6', '6 veces al día'], ['8', '8 veces al día']];
  const opcionesVeces = sel => OPC_VECES.map(([v, t]) => `<option value="${v}" ${String(sel || '') === v ? 'selected' : ''}>${t}</option>`).join('');
  // Recuadro "Sonido del video" del formulario (Fotos y videos, y Educación)
  const SONIDO = attrs => `<fieldset class="sonido" ${attrs || ''}>
    <legend>🔊 Sonido del video</legend>
    <label class="check"><input type="checkbox" name="audio" value="si" checked>
      Con sonido en <b>Familias</b> (la música de fondo baja mientras suena)</label>
    <label class="check"><input type="checkbox" name="audioFunc" value="si">
      Con sonido en <b>Funcionarios</b> (la TV se pausa mientras suena y vuelve al terminar)</label>
    <label>🔁 ¿Cuántas veces al día con sonido?
      <select name="vecesAudio">${opcionesVeces('')}</select></label>
    <p class="note">Las veces se reparten durante la jornada; el resto del tiempo el video se ve sin sonido.
    Todo esto se puede cambiar después en la lista de la derecha.</p>
  </fieldset>`;

  // Categoría de fotos y videos (define el rótulo en las pantallas)
  const OPC_CAT = [['actividades', '🏫 Actividades del colegio'], ['educacion', '📚 Educación']];
  const opcionesCat = sel => OPC_CAT.map(([v, t]) => `<option value="${v}" ${(sel || 'actividades') === v ? 'selected' : ''}>${t}</option>`).join('');
  const filaCategoria = f => `<div class="cat-fila"><span class="sf-tit">🏷️ Categoría:</span>
    <select class="cat-sel" data-id="${esc(f.id)}">${opcionesCat(f.categoria)}</select></div>`;

  // Fila "Sonido" editable de cada video ya publicado
  const filaSonido = f => {
    if (!UI.youtubeId(f.url) && f.formato !== 'video') return '';
    const fam = f.audio !== 'no';
    const fun = f.audioFunc === 'si';
    return `<div class="sonido-fila">
      <span class="sf-tit">🔊 Sonido:</span>
      <button class="toggle ${fam ? 'on' : ''}" data-id="${esc(f.id)}" data-campo="audio" data-valor="${fam ? 'no' : 'si'}">${fam ? '🔊' : '🔇'} Familias</button>
      <button class="toggle ${fun ? 'on' : ''}" data-id="${esc(f.id)}" data-campo="audioFunc" data-valor="${fun ? 'no' : 'si'}">${fun ? '🔊' : '🔇'} Funcionarios</button>
      <label class="sf-veces">🔁 <select class="veces-sel" data-id="${esc(f.id)}">${opcionesVeces(f.vecesAudio)}</select></label>
    </div>`;
  };

  // Marca ⭐ Importante: la fecha se destaca en las pantallas (dorado, primero y con brillo)
  const IMPORTANTE = `<label class="check importante-check"><input type="checkbox" name="importante" value="si">
    ⭐ <b>Fecha importante</b>: se destaca en dorado en las pantallas y aparece primero</label>`;
  const filaImportante = f => {
    const on = f.importante === 'si';
    return `<div class="sonido-fila"><span class="sf-tit">⭐ Destacar:</span>
      <button class="toggle ${on ? 'on' : ''}" data-id="${esc(f.id)}" data-campo="importante" data-valor="${on ? '' : 'si'}">${on ? '⭐ Importante' : '☆ Normal'}</button></div>`;
  };

  // Selector de íconos (incluye la insignia del colegio)
  const selectorIconos = def => `<div class="etiqueta">Ícono</div>
    <input type="hidden" name="icono" value="${esc(def)}">
    <div class="icon-picker">${UI.ICONOS.map(i => `<button type="button" data-ico="${esc(i)}" class="${i === def ? 'on' : ''}"
      title="${i === 'insignia' ? 'Insignia del colegio' : ''}">${i === 'insignia' ? '<img src="insignia.png" alt="Insignia">' : i}</button>`).join('')}</div>`;

  // Definición de cada sección del panel
  const SECCIONES = {
    actividades: {
      nombre: '📅 Actividades',
      form: `<label>Título<input name="titulo" required></label>
        <label>Descripción<textarea name="descripcion"></textarea></label>
        <label>Fecha<input type="date" name="fecha" required></label>
        <label>Hora<input type="time" name="hora"></label>
        <label>Lugar<input name="lugar"></label>${selectorIconos('📅')}${PUBLICO}${IMPORTANTE}`,
      linea: a => [(a.importante === 'si' ? '⭐ ' : '') + a.titulo, `${a.fecha} ${a.hora || ''} · ${a.lugar || ''} · ${a.publico}`],
      ico: a => a.icono || '📅',
      extra: filaImportante,
    },
    fotos: {
      nombre: '📸 Fotos y videos',
      form: `<label>Título / actividad<input name="titulo" required></label>
        <label>🏷️ Categoría<select name="categoria">${opcionesCat('actividades')}</select></label>
        <label>Tipo
          <select name="tipo"><option value="imagen">📷 Imagen</option><option value="video">▶️ Video de YouTube</option></select></label>
        <p class="note">📸 Las publicaciones de Instagram se eligen en la sección <b>📸 Instagram</b>.</p>
        <label data-tipo="imagen">Imágenes (puede elegir varias a la vez con Ctrl)<input type="file" name="imagen" accept="image/*" multiple></label>
        <p class="note cuantas" data-tipo="imagen" style="color:var(--gold)"></p>
        <label class="check" data-tipo="imagen"><input type="checkbox" name="historia" value="si">
          ⏱️ <b>Es una historia de Instagram</b>: se ve destacada y se quita sola a las 24 h</label>
        <label data-tipo="video" hidden>Enlace de YouTube<input name="url" placeholder="https://www.youtube.com/watch?v=..."></label>
        <label data-editar-ig hidden>Mensaje (se muestra al lado de la publicación)<textarea name="texto" rows="4" disabled></textarea></label>
        <img class="preview" id="preview" hidden alt="">
        ${SONIDO('data-tipo="video" hidden')}
        ${PUBLICO}
        <p class="note" data-tipo="imagen">La imagen se reduce automáticamente a 1920 px antes de subirla a Google Drive.</p>
        <p class="note" data-tipo="video" hidden>El video se reproduce completo y luego pasa al siguiente elemento del carrusel.
        Debe ser público o "no listado" y permitir insertarse en otros sitios.</p>`,
      linea: f => [(UI.youtubeId(f.url) ? '▶ ' : f.formato === 'video' ? '🎬 ' : f.origen === 'instagram' ? '📸 ' : '') + f.titulo,
        (f.categoria === 'educacion' ? '📚 Educación' : '🏫 Actividades') + ' · ' + f.publico +
        (f.origen === 'instagram' ? ' · desde Instagram' : '') +
        (f.vence ? (Date.parse(f.vence) > Date.now()
          ? ' · ⏱️ Historia hasta ' + new Date(f.vence).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : ' · ⏱️ Historia vencida (ya no se muestra)') : '')],
      img: f => (UI.youtubeId(f.url) ? `https://img.youtube.com/vi/${UI.youtubeId(f.url)}/mqdefault.jpg`
        : UI.instagramRuta(f.url) || f.formato === 'video' ? '' : f.url),
      // categoría y sonido editables en cada publicación
      extra: f => filaCategoria(f) + filaSonido(f),
    },
    destacados: { nombre: '⭐ Destacados' },
    institucional: { nombre: '🏫 Misión, Visión y Equipo' }, // vista propia (vistaInstitucional) // vista propia: todos los cursos listos (ver vistaDestacados)
    musica: {
      nombre: '🎵 Música Familias',
      form: `<label>Nombre de la canción<input name="titulo" required></label>
        <label>Origen
          <select name="tipo"><option value="enlace">▶️ YouTube (video o lista de reproducción)</option><option value="archivo">📁 Subir archivo MP3</option></select></label>
        <label data-tipo="enlace">Enlace de YouTube o de un .mp3<input name="url" placeholder="https://www.youtube.com/watch?v=...&list=... · https://youtu.be/..."></label>
        <label data-tipo="archivo" hidden>Archivo de audio (MP3, máx. ${MAX_AUDIO_MB} MB · se sube por partes)<input type="file" name="imagen" accept="audio/*"></label>
        <p class="note">Suena de fondo en la pantalla Familias y baja de volumen cuando aparece un video con sonido.
        Si pega una <b>lista de reproducción</b> de YouTube, se reproduce completa en orden aleatorio.
        Use música libre de derechos o con autorización.</p>`,
      linea: m => [(/youtu/.test(m.url) ? '▶ ' : '🎵 ') + m.titulo,
        m.fileId ? 'Archivo en Google Drive' : (/[?&]list=/.test(m.url) ? 'Lista de YouTube · ' : '') + m.url],
    },
    // Sección antigua: solo aparece si quedan publicaciones de antes (para poder eliminarlas).
    // Ahora Educación se publica en "Fotos y videos" con la categoría 📚 Educación.
    noticias: {
      nombre: '📚 Educación (anteriores)',
      soloSiHay: true,
      form: `<label>Título<input name="titulo" required></label>
        <label>Texto<textarea name="texto" maxlength="280" placeholder="Breve descripción (opcional si agrega un video)"></textarea></label>
        <label>Video de YouTube · experiencia educativa (opcional)<input name="url" placeholder="Pegue aquí el enlace (botón Compartir → Copiar): https://youtu.be/..."></label>
        <img class="preview" id="preview" hidden alt="">
        ${SONIDO()}
        ${PUBLICO}
        <p class="note">Esta sección es de publicaciones anteriores. Para publicar algo nuevo de Educación use
        <b>📸 Fotos y videos</b> con la categoría <b>📚 Educación</b>. Los videos de aquí se muestran en el carrusel.</p>`,
      linea: n => [(UI.enlaceVideo(n) ? '▶ ' : '') + n.titulo, n.publico + ' · ' + UI.textoLimpio(n).slice(0, 80)],
      img: n => (UI.enlaceVideo(n) ? `https://img.youtube.com/vi/${UI.youtubeId(UI.enlaceVideo(n))}/mqdefault.jpg` : ''),
      extra: n => SECCIONES.fotos.extra(Object.assign({}, n, { url: UI.enlaceVideo(n) })),
    },
    fechas: {
      nombre: '🗓️ Fechas familias',
      form: `<label>Título<input name="titulo" required placeholder="Ej: Completar ficha de matrícula"></label>
        <div class="dos">
          <label>Desde (fecha)<input type="date" name="fecha" required></label>
          <label>Hora (opcional)<input type="time" name="hora"></label>
        </div>
        <div class="dos">
          <label>Hasta (opcional)<input type="date" name="fechaFin"></label>
          <label>Hora término (opcional)<input type="time" name="horaFin"></label>
        </div>
        <p class="note">Para un <b>período</b> (ej. del 2 de noviembre a las 14:00 hasta el 30 de noviembre) complete "Hasta".
        Mientras esté vigente se muestra "🟢 Disponible ahora" con los días que quedan, y desaparece al terminar.</p>
        <label>Detalle<input name="descripcion" placeholder="Ej: En la página del colegio o en secretaría"></label>
        ${selectorIconos('📅')}${IMPORTANTE}${ESPACIO_SEL}`,
      linea: f => [(f.importante === 'si' ? '⭐ ' : '') + f.titulo, `${f.fecha}${f.hora ? ' ' + f.hora : ''}${f.fechaFin ? ' → ' + f.fechaFin + (f.horaFin ? ' ' + f.horaFin : '') : ''} · ${f.descripcion || ''}`],
      ico: f => f.icono || '📅',
      extra: filaImportante,
    },
    avisos: {
      nombre: '📢 Avisos (cinta)',
      form: `<label>Texto del aviso<input name="texto" required maxlength="140"></label>${PUBLICO}`,
      linea: a => [a.texto, a.publico],
    },
    // 🎂 Cumpleaños de funcionarios/as: ese día aparece un saludo en la pantalla Funcionarios
    cumpleanos: {
      nombre: '🎂 Cumpleaños',
      form: `<label>👤 Nombre del funcionario o funcionaria<input name="nombre" required placeholder="Ej: María José Pérez"></label>
        <label>📅 Día del cumpleaños (el año no importa: se saluda todos los años)<input type="date" name="fecha" required></label>
        <label>💼 Cargo (opcional)<input name="cargo" placeholder="Ej: Profesora de Lenguaje"></label>
        <label>💌 Mensaje para ese día (opcional)<textarea name="mensaje" rows="3" maxlength="220"
          placeholder="Vacío = ¡Te deseamos un día lleno de alegría! Con cariño, tu comunidad del Colegio Marina de Chile 💙"></textarea></label>
        <p class="note">Ese día, en la pantalla <b>Funcionarios</b>, aparece "🎂 ¡Feliz cumpleaños!" con el nombre y el mensaje,
        primero en el carrusel y repetido durante la jornada. No se muestra en Familias.</p>`,
      linea: c => {
        const d = String(c.fecha || '').slice(5, 10).split('-');
        const hoy = new Date();
        const esHoy = +d[0] === hoy.getMonth() + 1 && +d[1] === hoy.getDate();
        return [(esHoy ? '🎉 HOY · ' : '🎂 ') + c.nombre,
          `${+d[1] || '?'} de ${UI.MESES[(+d[0] || 1) - 1] || ''}${c.cargo ? ' · ' + c.cargo : ''}${c.mensaje ? ' · 💌 ' + c.mensaje.slice(0, 60) : ''}`];
      },
    },
    instagram: { nombre: '📸 Instagram' },
    reunion: { nombre: '👨‍👩‍👧 Reunión apoderados' },
    ajustes: { nombre: '⚙️ Ajustes' },
    canales: {
      nombre: '📺 Canales TV',
      form: `<label>Nombre<input name="nombre" required></label>
        <label>Enlace<input type="url" name="url" required placeholder="https://www.tvn.cl/en-vivo"></label>
        <label>Orden<input type="number" name="orden" min="1" value="1"></label>
        <p class="note">Acepta páginas de señal en vivo (TVN, 13, CHV…), enlaces de YouTube en vivo o .m3u8.
        Las páginas de los canales solo se ven dentro de la app Android TV.</p>`,
      linea: c => [`${c.orden}. ${c.nombre}`, c.url],
    },
  };

  function toast(texto, tipo) {
    const el = document.createElement('div');
    el.className = 'msg ' + (tipo || 'ok');
    el.textContent = texto;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // Archivo completo → base64 (para la música)
  function aBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // Reduce imagen a máx. 1920px (o lo indicado) y devuelve base64 JPEG
  function comprimir(file, max) {
    max = max || 1920;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function vistaLogin(error) {
    app.innerHTML = `<div class="panel login">
      <img src="insignia.png" alt="Escudo">
      <h2>Panel Administrador</h2>
      ${!CFG.API_URL ? '<div class="warn note">Falta configurar <b>API_URL</b> en <code>config.js</code>. Vea el README.</div>' : ''}
      <form id="f-login">
        <label>Contraseña<input type="password" name="pass" required autofocus></label>
        <button class="btn">Ingresar</button>
        ${error ? `<p class="note" style="color:#ff8b8e">${esc(error)}</p>` : ''}
        <button type="button" class="link-btn" id="olvide">🔑 ¿Olvidó la clave? Enviarla al correo del administrador</button>
        <p class="note" id="olvide-msg" hidden></p>
        <a href="index.html" class="note">← Volver al inicio</a>
      </form></div>`;
    // la clave se envía SOLO al correo fijo del administrador (lo decide Apps Script, no esta página)
    document.getElementById('olvide').onclick = async e => {
      const b = e.target;
      const msg = document.getElementById('olvide-msg');
      if (!confirm('¿Enviar la clave al correo del administrador?')) return;
      b.disabled = true;
      msg.hidden = false;
      msg.textContent = 'Enviando…';
      try {
        const r = await API.admin('recuperarClave', {});
        msg.style.color = '#7ee2a8';
        msg.textContent = `✔ Se envió la clave a ${r.correo}. Revise también la carpeta de spam.`;
      } catch (err) {
        msg.style.color = '#ff8b8e';
        msg.textContent = err.message;
        b.disabled = false;
      }
    };
    document.getElementById('f-login').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        await API.admin('login', { password: e.target.pass.value });
        password = e.target.pass.value;
        try { sessionStorage.setItem(PASS_KEY, password); } catch (e2) {}
        await recargar();
      } catch (err) {
        vistaLogin(err.message);
      }
    };
  }

  async function recargar() {
    data = await API.cargarDatos();
    vistaPanel();
  }

  // Una fila de teléfono: tipo · nombre · número · quitar
  const TIPOS_TEL = [['telefono', '📞 Teléfono'], ['celular', '📱 Celular'], ['whatsapp', '💬 WhatsApp'], ['correo', '✉️ Correo']];
  const filaTel = t => `<div class="tel-fila">
    <select data-campo="tipo">${TIPOS_TEL.map(([v, n]) => `<option value="${v}" ${(t.tipo || 'telefono') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <input data-campo="nombre" placeholder="Nombre (ej. Secretaría)" value="${esc(t.nombre || '')}">
    <input data-campo="numero" placeholder="Número (ej. 41 234 5678)" value="${esc(t.numero || '')}">
    <button type="button" class="tel-quitar" title="Quitar">✕</button>
  </div>`;

  // 🏫 Un edificio agregado: ícono y nombre (el id no cambia aunque se cambie el nombre)
  const filaEdificio = e => `<div class="tel-fila ed-fila" data-id="${esc(e.id || '')}">
    <select data-campo="ico">${['🏢', '🏫', '🏛️', '🏠', '⛪', '🎨', '🔬', '⚽', '🎭', '📚'].map(i => `<option ${i === (e.ico || '🏢') ? 'selected' : ''}>${i}</option>`).join('')}</select>
    <input data-campo="nombre" placeholder="Nombre (ej. Edificio Anexo)" value="${esc(e.nombre || '')}">
    <span class="note">${e.id ? 'TV: familias.html?espacio=' + esc(e.id) : 'Nuevo'}</span>
    <button type="button" class="tel-quitar" title="Quitar">✕</button></div>`;

  // 🎨 Colores y fondo: un tema para todas las pantallas y, si se quiere, uno distinto para Familias o Funcionarios.
  // Temas listos, uno personalizado, imagen de fondo propia con ajustes y vista previa antes de guardar.
  const PERFILES_TEMA = [['todas', '🖥️ Todas las pantallas'], ['familias', '👨‍👩‍👧 Familias'], ['funcionarios', '📺 Funcionarios']];
  let temas = {}; // { todas, familias, funcionarios } mientras se edita
  let temaPerfil = 'todas';
  function bloqueTema(a) {
    const g = UI.leerJSON(a.tema, {});
    temas = g.todas || g.familias || g.funcionarios
      ? { todas: g.todas || {}, familias: g.familias || null, funcionarios: g.funcionarios || null }
      : { todas: g, familias: null, funcionarios: null }; // formato anterior: un solo tema
    temaPerfil = 'todas';
    const tarjeta = (k, nombre, c, acento) => `<label class="tema-op">
      <input type="radio" name="temaPreset" value="${k}">
      <span class="tema-muestra" style="background:linear-gradient(160deg,${c[1]},${c[0]})">
        <i style="background:${c[4]}"></i><i style="background:${c[2]}"></i><i style="background:${acento}"></i></span>
      <b>${esc(nombre)}</b></label>`;
    const deslizador = (k, nombre, min, max, unidad) => `<label class="tema-rango">${nombre} <output data-salida="${k}"></output>
      <input type="range" name="${k}" min="${min}" max="${max}" data-unidad="${unidad}"></label>`;
    return `<fieldset class="grupo" id="tema-box">
      <legend>🎨 Colores y fondo de las pantallas</legend>
      <div class="tema-tabs">${PERFILES_TEMA.map(([k, n]) => `<button type="button" data-perfil="${k}" class="${k === 'todas' ? 'on' : ''}">${n}</button>`).join('')}</div>
      <label class="check tema-propio-perfil" hidden><input type="checkbox" name="temaUsarPropio">
        <span>Usar colores y fondo <b>propios</b> en esta pantalla (si no, usa los de "Todas las pantallas")</span></label>
      <div class="tema-editor">
        <div class="tema-grid">${Object.entries(UI.TEMAS).map(([k, p]) => tarjeta(k, p.nombre, p.c, p.acento)).join('')}
          ${tarjeta('propio', '🎨 Personalizado', ['#06153a', '#0a1f52', '#0f2c72', '#163b94', '#2453c4'], '#f6c90e')}</div>
        <div class="dos tema-propio">
          <label>Color principal (personalizado)<input type="color" name="temaBase"></label>
          <label>Color de acento (destacados, títulos)<input type="color" name="temaAcento"></label>
        </div>
        <div class="etiqueta">Fondo</div>
        <div class="fondo-grid">${Object.entries(UI.FONDOS).map(([k, n]) => `<label class="check">
          <input type="radio" name="temaFondo" value="${k}"> ${esc(n)}</label>`).join('')}</div>
        <div class="tema-img" hidden>
          <div class="etiqueta">🖼️ Imagen de fondo</div>
          <div class="img-lista">${(data.fondos || []).map(f => `<label class="img-op" title="${esc(f.nombre || '')}">
            <input type="radio" name="temaImg" value="${esc(f.url)}"><img src="${esc(f.url)}" alt="">
            <button type="button" class="img-quitar" data-id="${esc(f.id)}" title="Eliminar esta imagen">✕</button></label>`).join('')}
            <label class="img-op img-subir"><input type="file" accept="image/*" id="img-subir" hidden><span>➕<br>Subir imagen</span></label></div>
          <div class="tema-ajustes">
            ${deslizador('imgOscuro', '🌑 Oscurecer', 0, 85, '%')}
            ${deslizador('imgBlur', '💧 Desenfoque', 0, 30, '')}
            ${deslizador('imgSat', '🎨 Intensidad del color', 0, 200, '%')}
            ${deslizador('imgZoom', '🔍 Acercar', 100, 250, '%')}
            ${deslizador('imgTinte', '🖌️ Tinte con los colores del tema', 0, 90, '%')}
            <label>📍 Mostrar la parte de la foto
              <select name="imgPos"><option value="center">Centro</option><option value="top">Arriba</option>
              <option value="bottom">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option></select></label>
            <label class="check"><input type="checkbox" name="imgMover"> 🎞️ Movimiento suave (acercamiento lento)</label>
            <button type="button" class="btn ghost mini" id="img-restablecer">↺ Restablecer ajustes de la imagen</button>
          </div>
          <p class="note">Consejo: oscurecer entre 40 % y 60 % y un poco de tinte hacen que los textos se lean bien sobre cualquier foto.</p>
        </div>
      </div>
      <div class="tema-vista-acc">
        <select id="tema-pantalla"><option value="familias">👨‍👩‍👧 Ver Familias</option><option value="funcionarios">📺 Ver Funcionarios (sin TV)</option></select>
        <a class="btn ghost" id="tema-abrir" target="_blank">↗ Abrir en pantalla completa</a>
      </div>
      <div class="tema-vista"><iframe id="tema-iframe" title="Vista previa" tabindex="-1"></iframe></div>
      <p class="note">La vista previa se actualiza al instante y <b>no cambia las pantallas</b>. Cuando le guste, pulse <b>Guardar ajustes</b>.</p>
    </fieldset>`;
  }
  // el tema guardado: { todas, familias, funcionarios } (null = usa el de todas)
  const temaDelForm = () => ({ todas: temas.todas, familias: temas.familias, funcionarios: temas.funcionarios });

  function iniciarTema(fa) {
    const box = document.getElementById('tema-box');
    const iframe = document.getElementById('tema-iframe');
    const caja = iframe.parentElement;
    const el = fa.elements;
    const escalar = () => { iframe.style.transform = `scale(${caja.clientWidth / 1920})`; };
    const actual = () => temas[temaPerfil] || temas.todas;
    // muestra en el formulario el tema de la pestaña elegida
    const cargar = () => {
      const t = Object.assign({ preset: 'marino', fondo: 'degradado', base: '#0f2c72', acento: '#f6c90e' }, UI.IMG_DEF, actual());
      const propio = temaPerfil === 'todas' || !!temas[temaPerfil];
      box.querySelector('.tema-propio-perfil').hidden = temaPerfil === 'todas';
      el.temaUsarPropio.checked = propio;
      box.querySelector('.tema-editor').classList.toggle('apagado', !propio);
      fa.querySelectorAll('[name="temaPreset"]').forEach(r => (r.checked = r.value === t.preset));
      fa.querySelectorAll('[name="temaFondo"]').forEach(r => (r.checked = r.value === t.fondo));
      fa.querySelectorAll('[name="temaImg"]').forEach(r => (r.checked = r.value === t.img));
      el.temaBase.value = t.base; el.temaAcento.value = t.acento;
      ['imgOscuro', 'imgBlur', 'imgSat', 'imgZoom', 'imgTinte'].forEach(k => (el[k].value = t[k]));
      el.imgPos.value = t.imgPos || 'center';
      el.imgMover.checked = !!t.imgMover;
      salidas();
      box.querySelector('.tema-img').hidden = t.fondo !== 'imagen';
    };
    const salidas = () => box.querySelectorAll('[data-salida]').forEach(o => {
      const i = el[o.dataset.salida];
      o.textContent = i.name === 'imgBlur' ? (i.value === '0' ? 'nada' : i.value) : i.value + i.dataset.unidad;
    });
    // lee el formulario y lo guarda en la pestaña elegida
    const leer = () => {
      if (temaPerfil !== 'todas' && !el.temaUsarPropio.checked) { temas[temaPerfil] = null; return; }
      const v = n => (fa.querySelector(`[name="${n}"]:checked`) || {}).value;
      const t = { preset: v('temaPreset') || 'marino', fondo: v('temaFondo') || 'degradado' };
      if (t.preset === 'propio') { t.base = el.temaBase.value; t.acento = el.temaAcento.value; }
      if (t.fondo === 'imagen') {
        t.img = v('temaImg') || '';
        ['imgOscuro', 'imgBlur', 'imgSat', 'imgZoom', 'imgTinte'].forEach(k => (t[k] = +el[k].value));
        t.imgPos = el.imgPos.value;
        t.imgMover = el.imgMover.checked ? 'si' : '';
      }
      temas[temaPerfil] = t;
    };
    // vista previa: la pantalla de la pestaña (o la elegida), con el tema completo
    const pantalla = () => (temaPerfil === 'todas' ? document.getElementById('tema-pantalla').value : temaPerfil);
    const url = () => `${pantalla()}.html?vista=1${pantalla() === 'funcionarios' ? '&tv=0' : ''}${/demo=1/.test(location.search) ? '&demo=1' : ''}` +
      `&tema=${encodeURIComponent(JSON.stringify(temaDelForm()))}`;
    let cargada = '';
    const ver = () => {
      document.getElementById('tema-abrir').href = url();
      const w = iframe.contentWindow;
      // misma pantalla: se aplica al instante sin recargar (los deslizadores se ven en vivo)
      if (cargada === pantalla() && w && w.UI && w.UI.aplicarTema) {
        try { w.history.replaceState(null, '', url()); w.UI.aplicarTema(null, JSON.stringify(temaDelForm())); return; } catch (e) {}
      }
      cargada = pantalla();
      iframe.src = url();
      escalar();
    };
    const cambio = () => { leer(); salidas(); box.querySelector('.tema-img').hidden = (fa.querySelector('[name="temaFondo"]:checked') || {}).value !== 'imagen'; ver(); };

    box.querySelectorAll('.tema-tabs button').forEach(b => (b.onclick = () => {
      box.querySelectorAll('.tema-tabs button').forEach(x => x.classList.toggle('on', x === b));
      temaPerfil = b.dataset.perfil;
      document.getElementById('tema-pantalla').hidden = temaPerfil !== 'todas';
      cargar();
      ver();
    }));
    el.temaUsarPropio.onchange = () => {
      if (el.temaUsarPropio.checked && !temas[temaPerfil]) temas[temaPerfil] = Object.assign({}, temas.todas); // parte desde el general
      if (!el.temaUsarPropio.checked) temas[temaPerfil] = null;
      cargar();
      ver();
    };
    box.querySelector('.tema-editor').addEventListener('change', e => {
      if (e.target.id === 'img-subir') return;
      // al tocar un color propio se elige "Personalizado"
      if (e.target.name === 'temaBase' || e.target.name === 'temaAcento') fa.querySelector('[name="temaPreset"][value="propio"]').checked = true;
      // al elegir una imagen se activa el fondo de imagen
      if (e.target.name === 'temaImg') fa.querySelector('[name="temaFondo"][value="imagen"]').checked = true;
      cambio();
    });
    box.querySelector('.tema-editor').addEventListener('input', e => { if (e.target.type === 'range') cambio(); });
    document.getElementById('tema-pantalla').onchange = ver;
    document.getElementById('img-restablecer').onclick = () => {
      Object.entries(UI.IMG_DEF).forEach(([k, v]) => { if (el[k]) { if (el[k].type === 'checkbox') el[k].checked = !!v; else el[k].value = v; } });
      cambio();
    };
    // subir una imagen de fondo nueva (queda en la lista para usarla en cualquier pantalla)
    document.getElementById('img-subir').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      const etq = e.target.closest('.img-subir').querySelector('span');
      etq.textContent = 'Subiendo…';
      try {
        const r = await API.admin('add', { password, sheet: 'fondos', item: { nombre: f.name.replace(/\.\w+$/, '') },
          image: { data: await comprimir(f, 1920), mimeType: 'image/jpeg', name: f.name.replace(/\.\w+$/, '') + '.jpg' } });
        // se agrega a la lista y queda elegida
        const url = (r.item && r.item.url) || '';
        data.fondos = (data.fondos || []).concat(r.item ? [r.item] : []);
        e.target.closest('.img-subir').insertAdjacentHTML('beforebegin', `<label class="img-op"><input type="radio" name="temaImg" value="${esc(url)}" checked>
          <img src="${esc(url)}" alt=""><button type="button" class="img-quitar" data-id="${esc((r.item || {}).id || '')}" title="Eliminar esta imagen">✕</button></label>`);
        fa.querySelector('[name="temaFondo"][value="imagen"]').checked = true;
        toast('Imagen subida ✔ · ajústela y pulse Guardar ajustes');
        cambio();
      } catch (err) { toast(err.message, 'err'); }
      etq.innerHTML = '➕<br>Subir imagen';
      e.target.value = '';
    };
    box.querySelector('.img-lista').addEventListener('click', async e => {
      const b = e.target.closest('.img-quitar');
      if (!b) return;
      e.preventDefault();
      if (!confirm('¿Eliminar esta imagen de fondo? Si alguna pantalla la usa, pulse luego Guardar ajustes con otra imagen o fondo.')) return;
      try {
        await API.admin('delete', { password, sheet: 'fondos', id: b.dataset.id });
        b.closest('.img-op').remove();
        toast('Imagen eliminada');
      } catch (err) { toast(err.message, 'err'); }
    });
    window.addEventListener('resize', escalar);
    cargar();
    ver();
  }


  // Ajustes generales: mensaje para las familias y segundos de las fotos
  function formAjustes() {
    const a = UI.ajustes(data);
    return `<div class="panel" style="max-width:760px">
      <h2>⚙️ Ajustes de las pantallas</h2>
      <form id="f-ajustes">
        <fieldset class="grupo">
          <legend>📢 Cinta de avisos (abajo, en ambas pantallas)</legend>
          <label>Velocidad de la cinta
            <select name="velocidadAvisos">${[['lenta', '🐢 Lenta'], ['normal', 'Normal'], ['rapida', '🐇 Rápida']]
              .map(([v, t]) => `<option value="${v}" ${a.velocidadAvisos === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        </fieldset>

        <fieldset class="grupo">
          <legend>👨‍👩‍👧 Pantalla Familias</legend>
          <label>Mensaje para las familias<textarea name="mensajeTexto" maxlength="280">${esc(a.mensajeTexto)}</textarea></label>
          <p class="note">Aparece destacado en la pantalla Familias. Déjelo vacío para no mostrarlo.</p>
          <label>Segundos que se ve cada foto · Familias<input type="number" name="segFotosFamilias" min="3" max="120" value="${esc(a.segFotosFamilias)}"></label>
        </fieldset>

        <fieldset class="grupo">
          <legend>📞 Teléfonos de contacto (franja "Contáctanos" en Familias)</legend>
          <div class="tel-filas" id="tel-filas">${(UI.contactos(a.telefonos).length ? UI.contactos(a.telefonos) : [{}]).map(filaTel).join('')}</div>
          <button type="button" class="btn ghost" id="tel-agregar">➕ Agregar otro teléfono</button>
          <p class="note">Si hay más de 4, se muestran de a 4 rotando.</p>
        </fieldset>

        <fieldset class="grupo">
          <legend>📱 Sitio web y redes (se muestran con código QR en Familias)</legend>
          <label>🌐 Sitio web del colegio<input name="sitioWeb" value="${esc(a.sitioWeb)}" placeholder="www.colegiomarinadechile.cl"></label>
          <label>📸 Instagram (usuario o enlace)<input name="instagram" value="${esc(a.instagram)}" placeholder="@colegiomarinadechile"></label>
          <label>▶️ YouTube (canal o enlace)<input name="youtube" value="${esc(a.youtube)}" placeholder="@colegiomarinadechile o https://www.youtube.com/@..."></label>
          <p class="note">Deje vacío lo que no quiera mostrar. Las familias escanean el QR con la cámara del celular.</p>
        </fieldset>

        <fieldset class="grupo">
          <legend>📺 Pantalla Funcionarios</legend>
          <label>Segundos que se ve cada foto · Funcionarios<input type="number" name="segFotosFuncionarios" min="3" max="120" value="${esc(a.segFotosFuncionarios)}"></label>
          <p class="note">Los videos siempre se muestran completos.</p>
          <label>🎂 Canción de cumpleaños (suena al aparecer el saludo; la TV se pausa mientras suena)
            <select name="cumpleMusica">${[['0', '🔇 No suena'], ['1', '1 vez al día'], ['2', '2 veces al día'], ['3', '3 veces al día'],
              ['4', '4 veces al día'], ['6', '6 veces al día']].map(([v, t]) => `<option value="${v}" ${String(a.cumpleMusica === undefined || a.cumpleMusica === '' ? '3' : a.cumpleMusica) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <p class="note">Las veces se reparten durante la jornada (no suena dos veces seguidas). Es la melodía tradicional
          de "Cumpleaños feliz" tocada como caja musical, unos 13 segundos.
          <button type="button" class="link-btn" id="probar-cumple">▶ Escuchar</button></p>
        </fieldset>

        ${bloqueTema(a)}

        <fieldset class="grupo">
          <legend>🏫 Edificios del colegio</legend>
          <p class="note">Ya existen: <b>🏫 Edificio Matriz</b> (con Prebásica) y <b>🧒 Edificio Ciclo Menor</b>.
          Agregue aquí otros edificios: aparecerán para elegir en cada TV Familias, en las publicaciones y en las salas de reunión.</p>
          <div class="tel-filas" id="ed-filas">${UI.leerJSON(a.edificios, []).map(filaEdificio).join('')}</div>
          <button type="button" class="btn ghost" id="ed-agregar">➕ Agregar edificio</button>
        </fieldset>

        <button class="btn">Guardar ajustes</button>
      </form>
      <form id="f-clave" class="clave-box">
        <fieldset class="grupo">
          <legend>🔑 Cambiar la clave del panel</legend>
          <label>Clave actual<input type="password" name="actual" required autocomplete="current-password"></label>
          <label>Clave nueva (mínimo 6 caracteres)<input type="password" name="nueva" required minlength="6" autocomplete="new-password"></label>
          <label>Repita la clave nueva<input type="password" name="repetir" required minlength="6" autocomplete="new-password"></label>
          <p class="note">Al cambiarla se envía un comprobante con la clave nueva al correo del administrador.</p>
          <button class="btn">🔑 Cambiar clave</button>
        </fieldset>
      </form></div>`;
  }

  function iniciarClave() {
    const f = document.getElementById('f-clave');
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector('.btn');
      const { actual, nueva, repetir } = f.elements;
      if (nueva.value !== repetir.value) return toast('Las claves nuevas no coinciden', 'err');
      if (nueva.value === actual.value) return toast('La clave nueva debe ser distinta de la actual', 'err');
      btn.disabled = true;
      btn.textContent = 'Cambiando…';
      try {
        const r = await API.admin('cambiarClave', { password: actual.value, nueva: nueva.value });
        password = nueva.value;
        try { sessionStorage.setItem(PASS_KEY, password); } catch (e2) {}
        f.reset();
        toast(`Clave cambiada ✔ · comprobante enviado a ${r.correo}`);
      } catch (err) {
        toast(err.message, 'err');
      }
      btn.disabled = false;
      btn.textContent = '🔑 Cambiar clave';
    };
  }

  // ---------- 👨‍👩‍👧 Modo reunión de apoderados: salas por edificio y varias reuniones guardadas ----------
  const opcEdificio = sel => Object.entries(UI.EDIFICIOS)
    .map(([v, t]) => `<option value="${v}" ${(sel || 'matriz') === v ? 'selected' : ''}>${t}</option>`).join('');
  const filaSala = s => `<div class="tel-fila reu-sala-fila">
    <select data-campo="edificio">${opcEdificio(s.edificio)}</select>
    <input data-campo="sala" placeholder="Sala (ej. 12 o Laboratorio)" value="${esc(s.sala || '')}">
    <select data-campo="piso"><option value="">Piso: no aplica</option>${[1, 2, 3].map(p =>
      `<option value="${p}" ${String(s.piso) === String(p) ? 'selected' : ''}>${p}° piso</option>`).join('')}</select>
    <button type="button" class="tel-quitar" title="Quitar">✕</button>
  </div>`;
  // estado de cada curso: con reunión · sin reunión · cambiada a otro día (y cuándo)
  const ESTADOS = [['', '✅ Con reunión'], ['sin', '🚫 Sin reunión'], ['cambio', '📅 Cambiada a otro día']];
  const filaCurso = c => `<div class="tel-fila reu-curso-fila ${c.sala || c.estado ? '' : 'sin-sala'}">
    <input data-campo="curso" placeholder="Curso (ej. 5° Básico A)" value="${esc(c.curso || '')}" ${c.curso ? 'readonly class="curso-fijo"' : ''}>
    <select data-campo="edificio">${opcEdificio(c.edificio)}</select>
    <select data-campo="sala" data-valor="${esc(c.sala || '')}"></select>
    <select data-campo="estado">${ESTADOS.map(([v, t]) => `<option value="${v}" ${(c.estado || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <input data-campo="cambio" placeholder="¿Cuándo? (ej. jueves 6 nov 19:00)" value="${esc(c.cambio || '')}" ${c.estado === 'cambio' ? '' : 'hidden'}>
    <button type="button" class="tel-quitar" title="Quitar">✕</button>
  </div>`;
  // los datos de una lista de filas → [{campo: valor}]
  const leerFilas = cont => [...cont.children].map(f => {
    const o = {};
    f.querySelectorAll('[data-campo]').forEach(c => (o[c.dataset.campo] = c.value.trim()));
    return o;
  });

  // Niveles marcados de una reunión (los guardados o, en reuniones antiguas, los que tienen algún curso en la lista)
  const nivelesDe = r => (Array.isArray(r.niveles) ? r.niveles
    : Object.keys(UI.NIVELES).filter(k => (r.cursos || []).some(c => UI.NIVELES[k].cursos.includes(c.curso))));
  // Sala que tuvo cada curso la última vez (Admin la recuerda: no hay que elegirla en cada reunión)
  let salasCurso = {};
  // Cursos de los niveles marcados, con su edificio y su sala de la última vez
  const cursosDeNiveles = niveles => niveles.flatMap(k => UI.NIVELES[k].cursos.map(c =>
    ({ curso: c, edificio: UI.NIVELES[k].edificio, sala: salasCurso[c] || '' })));
  // Una reunión nueva viene con TODOS los cursos listos; una guardada, con los suyos
  const datosBloque = r => {
    if (r.cursos && r.cursos.length) return { niveles: nivelesDe(r), cursos: r.cursos };
    const niveles = Array.isArray(r.niveles) && r.niveles.length ? r.niveles : Object.keys(UI.NIVELES);
    return { niveles, cursos: cursosDeNiveles(niveles) };
  };

  // Reuniones generales (una o varias, ej. una por ciclo): para quién, lugar, hora, tema e institución
  const previasAdmin = r => (Array.isArray(r.previas) ? r.previas
    : r.previa && r.previa.activa === 'si' ? [Object.assign({ para: 'todos' }, r.previa)] : []);
  const filaPrevia = p => `<div class="reu-previa-fila">
    <label>¿Para quiénes?<select data-p="para"><option value="todos">👥 Todos los cursos de esta reunión</option>
      ${Object.entries(UI.NIVELES).map(([k, n]) => `<option value="${k}" ${p.para === k ? 'selected' : ''}>${esc(n.nombre)}</option>`).join('')}</select></label>
    <label>Lugar<input data-p="lugar" list="lugares-previa" value="${esc(p.lugar || '')}" placeholder="Ej: Gimnasio"></label>
    <label>Hora<input type="time" data-p="hora" value="${esc(p.hora || '')}"></label>
    <label>Tema (opcional)<input data-p="tema" value="${esc(p.tema || '')}" placeholder="Ej: Charla de seguridad"></label>
    <label>Institución (opcional)<input data-p="institucion" value="${esc(p.institucion || '')}" placeholder="Ej: Carabineros"></label>
    <button type="button" class="tel-quitar" title="Quitar">✕</button>
    <datalist id="lugares-previa"><option value="Gimnasio"><option value="Hall de entrada"><option value="Hall Ciclo Menor"><option value="Patio techado"><option value="Biblioteca CRA"><option value="Comedor"></datalist>
  </div>`;

  // Una reunión guardada (ej. "Básica" o "Media") con su horario y sus cursos
  const bloqueReunion = r => `<fieldset class="grupo reu-bloque" data-id="${esc(r.id || 'r' + Date.now())}">
    <legend><input class="reu-nombre" value="${esc(r.nombre || '')}" placeholder="Nombre (ej. Básica)"></legend>
    <label class="check"><input type="checkbox" data-r="activo" ${r.activo === 'si' ? 'checked' : ''}>
      <b>Activar esta reunión</b> (la pantalla Familias la muestra en el horario indicado)</label>
    <div class="dos">
      <label>📅 Fecha de la reunión<input type="date" data-r="fecha" value="${esc(r.fecha || '')}"></label>
      <label>Título que se ve en pantalla<input data-r="titulo" value="${esc(r.titulo || '')}" placeholder="Ej: Reunión de apoderados 2° semestre"></label>
    </div>
    <p class="note">Antes de esa fecha, Familias muestra el aviso <b>"Próxima reunión de apoderados"</b> con los cursos
    (en rango, ej. "1° a 4° Básico"), el edificio y la hora. <b>El día de la reunión</b> aparecen las salas de cada curso.</p>
    <div class="etiqueta">🕒 Hora de inicio de cada grupo y cómo se anuncian sus cursos (vacío = se calcula solo)</div>
    <div class="reu-horas">${Object.entries(UI.EDIFICIOS).map(([e, nombre]) => `<label>${nombre}
      <input type="time" data-hora="${e}" value="${esc((r.horas || {})[e] || '')}">
      <input data-resumen="${e}" value="${esc((r.resumen || {})[e] || '')}" placeholder="${esc(UI.resumenCursos((r.cursos || []).filter(c => c.edificio === e && !c.estado)) || 'Ej: 1° a 4° Básico')}"></label>`).join('')}</div>
    <div class="dos">
      <label>Mostrar las salas desde (opcional)<input type="datetime-local" data-r="desde" value="${esc(r.desde || '')}"></label>
      <label>Hasta (opcional · vacío = todo el día de la reunión)<input type="datetime-local" data-r="hasta" value="${esc(r.hasta || '')}"></label>
    </div>
    <fieldset class="reu-previa-box">
      <legend>📣 Reuniones generales antes de ir a las salas (opcional · puede haber una por ciclo)</legend>
      <div class="reu-previas">${previasAdmin(r).map(filaPrevia).join('')}</div>
      <button type="button" class="btn ghost mini reu-previa-agregar">➕ Agregar reunión general</button>
      <p class="note">Ej.: <b>Primer ciclo</b> en el Hall del Ciclo Menor a las 17:30 y <b>Segundo ciclo</b> en el Gimnasio a las 18:30.
      En la pantalla aparece arriba del tablero de salas y en el aviso de la próxima reunión (cada edificio ve las suyas).</p>
    </fieldset>
    <div class="etiqueta">👥 Niveles que tienen reunión este día (desmarque los que no)</div>
    <div class="reu-niveles">${Object.entries(UI.NIVELES).map(([k, n]) => `<label class="check">
      <input type="checkbox" data-nivel="${k}" ${datosBloque(r).niveles.includes(k) ? 'checked' : ''}> ${n.nombre}</label>`).join('')}</div>
    <div class="etiqueta">🚪 Elija solo la sala de cada curso (el edificio se puede cambiar; las salas se recuerdan para la próxima vez)</div>
    <div class="reu-tabla-head"><span>Curso</span><span>Edificio</span><span>Sala</span><span>Estado</span><span></span><span></span></div>
    <div class="tel-filas reu-cursos">${datosBloque(r).cursos.map(filaCurso).join('')}</div>
    <button type="button" class="btn ghost reu-curso-agregar">➕ Agregar otro curso</button>
    <div class="reu-acciones">
      <button type="button" class="btn ghost reu-duplicar">📄 Duplicar reunión</button>
      <button type="button" class="btn ghost reu-eliminar">🗑️ Eliminar reunión</button>
    </div>
  </fieldset>`;

  const salasIniciales = () => [{ edificio: 'prebasica', sala: 'Pre-Kínder' }, { edificio: 'prebasica', sala: 'Kínder' }]
    .concat([1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ edificio: 'menor', sala: String(n) })))
    .concat(Array.from({ length: 15 }, (_, k) => ({ edificio: 'matriz', sala: String(k + 1) })));

  function formReunion() {
    const aj = UI.ajustes(data);
    const lista = UI.reuniones(aj);
    salasCurso = UI.leerJSON(aj.salasCurso, {});
    // si aún no se recordaba, se toma la sala que el curso tiene en las reuniones ya guardadas
    lista.forEach(r => (r.cursos || []).forEach(c => { if (c.sala && !salasCurso[c.curso]) salasCurso[c.curso] = c.sala; }));
    let salas = UI.leerJSON(aj.salas, []);
    // la primera vez: salas del colegio ya creadas (Matriz 1 a 15, Ciclo Menor 1 a 8, Prebásica)
    if (!salas.length) salas = salasIniciales();
    const ahora = UI.reunion(aj);
    const estado = ahora.vigente ? `🟢 <b>Se está mostrando ahora: "${esc(ahora.nombre || ahora.titulo || 'Reunión')}"</b> en la pantalla Familias.`
      : '⚪ Ninguna reunión se está mostrando ahora: la pantalla Familias muestra lo de siempre.';
    return `<div class="panel" style="max-width:1100px">
      <h2>👨‍👩‍👧 Modo reunión de apoderados</h2>
      <p class="note">${estado}</p>
      <form id="f-reunion">
        <details class="grupo reu-detalle">
          <summary>🏫 Lista de salas de cada edificio y su piso (ya están creadas; ábrala solo para agregar una sala o indicar el piso)</summary>
          <div class="tel-filas" id="reu-salas">${(salas.length ? salas : [{}]).map(filaSala).join('')}</div>
          <button type="button" class="btn ghost" id="reu-sala-agregar">➕ Agregar sala</button>
          <button type="button" class="btn ghost" id="reu-sala-base">⚡ Completar salas 1 a 15 del Matriz y 1 a 8 del Ciclo Menor</button>
          <p class="note">Indique el piso cuando el edificio tiene más de uno (algunos tienen 3 pisos, otros solo 1).
          <b>Prebásica</b> está en el Edificio Matriz, pero va aparte para tener su propio horario de reunión:
          se muestra en los TV del <b>Edificio Matriz</b> (y en el General).</p>
        </details>
        <p class="note">Cada reunión ya trae <b>todos los cursos</b>: solo elija la <b>sala</b> de cada uno (queda en amarillo el que falta).
        Si un día es solo para algunos niveles (ej. <b>Media</b>), desmarque los demás. Si un curso no tiene reunión o se cambió de día,
        elija su estado: en la pantalla se avisa en vez de la sala.</p>
        <div id="reu-lista">${(lista.length ? lista : [{ nombre: 'Básica' }]).map(bloqueReunion).join('')}</div>
        <button type="button" class="btn ghost" id="reu-nueva">➕ Nueva reunión (otro día)</button>
        <button class="btn">💾 Guardar todo</button>
      </form></div>`;
  }

  function iniciarReunion() {
    const fr = document.getElementById('f-reunion');
    const salas = document.getElementById('reu-salas');
    const lista = document.getElementById('reu-lista');
    // cada curso solo puede elegir salas del edificio que se le asignó
    const actualizarSalas = () => {
      const todas = leerFilas(salas).filter(s => s.sala);
      lista.querySelectorAll('.reu-curso-fila').forEach(f => {
        const ed = f.querySelector('[data-campo="edificio"]').value;
        const sel = f.querySelector('[data-campo="sala"]');
        const valor = sel.value || sel.dataset.valor || '';
        const propias = todas.filter(s => s.edificio === ed);
        sel.innerHTML = `<option value="">${propias.length ? 'Elija la sala…' : 'Primero agregue salas de este edificio'}</option>` +
          propias.map(s => `<option value="${esc(s.sala)}">${esc(UI.nombreSala(s.sala))}${s.piso ? ` · ${s.piso}° piso` : ''}</option>`).join('');
        sel.value = propias.some(s => s.sala === valor) ? valor : '';
        sel.dataset.valor = sel.value;
        // "¿Cuándo?" solo cuando se cambió de día
        f.querySelector('[data-campo="cambio"]').hidden = f.querySelector('[data-campo="estado"]').value !== 'cambio';
        // se marca en amarillo el curso que aún no tiene sala
        f.classList.toggle('sin-sala', !sel.value && !f.querySelector('[data-campo="estado"]').value);
      });
    };

    salas.onclick = e => {
      if (!e.target.classList.contains('tel-quitar')) return;
      e.target.closest('.tel-fila').remove();
      if (!salas.children.length) salas.insertAdjacentHTML('beforeend', filaSala({}));
      actualizarSalas();
    };
    salas.oninput = salas.onchange = actualizarSalas;
    document.getElementById('reu-sala-agregar').onclick = () => { salas.insertAdjacentHTML('beforeend', filaSala({})); actualizarSalas(); };

    document.getElementById('reu-sala-base').onclick = () => {
      const hay = leerFilas(salas).filter(s => s.sala);
      [...salas.children].forEach(f => { if (!f.querySelector('[data-campo="sala"]').value.trim()) f.remove(); });
      salasIniciales().filter(s => !hay.some(h => h.edificio === s.edificio && h.sala === s.sala))
        .forEach(s => salas.insertAdjacentHTML('beforeend', filaSala(s)));
      actualizarSalas();
      toast('Salas completadas: revise el piso de cada una y pulse Guardar todo');
    };

    lista.onchange = e => {
      if (e.target.dataset.campo === 'sala') actualizarSalas();
      // marcar un nivel agrega sus cursos (con su edificio y la sala de la última vez); desmarcarlo los quita
      const nivel = e.target.dataset.nivel;
      if (nivel) {
        const bloque = e.target.closest('.reu-bloque');
        const cursos = bloque.querySelector('.reu-cursos');
        const N = UI.NIVELES[nivel];
        const filasDe = () => [...cursos.children].filter(f => N.cursos.includes(f.querySelector('[data-campo="curso"]').value.trim()));
        if (e.target.checked) {
          const ya = filasDe().map(f => f.querySelector('[data-campo="curso"]').value.trim());
          N.cursos.filter(c => !ya.includes(c)).forEach(c =>
            cursos.insertAdjacentHTML('beforeend', filaCurso({ curso: c, edificio: N.edificio, sala: salasCurso[c] || '' })));
        } else {
          filasDe().forEach(f => f.remove());
        }
        actualizarSalas();
        return;
      }
      if (['edificio', 'estado'].includes(e.target.dataset.campo)) actualizarSalas();
    };
    lista.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      const bloque = b.closest('.reu-bloque');
      const cursos = bloque.querySelector('.reu-cursos');
      // reuniones generales: agregar otra o quitar una
      if (b.classList.contains('reu-previa-agregar')) {
        bloque.querySelector('.reu-previas').insertAdjacentHTML('beforeend', filaPrevia({ para: 'todos' }));
        return;
      }
      if (b.classList.contains('tel-quitar') && b.closest('.reu-previa-fila')) {
        b.closest('.reu-previa-fila').remove();
        return;
      }
      if (b.classList.contains('tel-quitar')) {
        b.closest('.tel-fila').remove();
      } else if (b.classList.contains('reu-curso-agregar')) {
        cursos.insertAdjacentHTML('beforeend', filaCurso({}));
      } else if (b.classList.contains('rap-agregar')) {
        // "5° Básico" + "A B" → 5° Básico A, 5° Básico B (en el edificio elegido)
        const nivel = bloque.querySelector('.rap-nivel').value.trim();
        const letras = bloque.querySelector('.rap-letras').value.split(/[\s,;y]+/i).filter(Boolean);
        const edificio = bloque.querySelector('.rap-edificio').value;
        if (!nivel) return toast('Escriba el nivel, por ejemplo 5° Básico', 'err');
        // la fila vacía del comienzo se reemplaza
        [...cursos.children].forEach(f => { if (!f.querySelector('[data-campo="curso"]').value.trim()) f.remove(); });
        (letras.length ? letras : ['']).forEach(l => cursos.insertAdjacentHTML('beforeend',
          filaCurso({ curso: (nivel + ' ' + l.toUpperCase()).trim(), edificio })));
        bloque.querySelector('.rap-letras').value = '';
      } else if (b.classList.contains('reu-duplicar')) {
        const copia = leerBloque(bloque);
        copia.id = 'r' + Date.now();
        copia.nombre = (copia.nombre || 'Reunión') + ' (copia)';
        copia.activo = '';
        bloque.insertAdjacentHTML('afterend', bloqueReunion(copia));
      } else if (b.classList.contains('reu-eliminar')) {
        if (!confirm('¿Eliminar esta reunión? (se borra al pulsar Guardar todo)')) return;
        bloque.remove();
        if (!lista.children.length) lista.insertAdjacentHTML('beforeend', bloqueReunion({ nombre: 'Reunión' }));
      } else return;
      actualizarSalas();
    };
    document.getElementById('reu-nueva').onclick = () => {
      lista.insertAdjacentHTML('beforeend', bloqueReunion({ nombre: 'Otro día' }));
      actualizarSalas();
      lista.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    actualizarSalas();

    // datos de un bloque de reunión
    function leerBloque(bloque) {
      const v = k => bloque.querySelector(`[data-r="${k}"]`);
      return {
        id: bloque.dataset.id, nombre: bloque.querySelector('.reu-nombre').value.trim(),
        activo: v('activo').checked ? 'si' : '', titulo: v('titulo').value.trim(), desde: v('desde').value, hasta: v('hasta').value,
        // hora de cada edificio (ej. Prebásica 17:30, Ciclo Menor 18:00, Matriz 19:00)
        horas: Object.fromEntries([...bloque.querySelectorAll('[data-hora]')].map(i => [i.dataset.hora, i.value]).filter(([, h]) => h)),
        fecha: v('fecha').value,
        // cómo se anuncian los cursos de cada grupo (si se deja vacío se calcula de la lista, ej. "1° a 4° Básico")
        resumen: Object.fromEntries([...bloque.querySelectorAll('[data-resumen]')].map(i => [i.dataset.resumen, i.value.trim()]).filter(([, t]) => t)),
        cursos: leerFilas(bloque.querySelector('.reu-cursos')).filter(c => c.curso)
          .map(c => (c.estado === 'cambio' ? c : Object.assign(c, { cambio: '' }))),
        niveles: [...bloque.querySelectorAll('[data-nivel]')].filter(i => i.checked).map(i => i.dataset.nivel),
        // reunión general antes de ir a las salas (gimnasio, hall…)
        previas: [...bloque.querySelectorAll('.reu-previa-fila')].map(f =>
          Object.fromEntries([...f.querySelectorAll('[data-p]')].map(i => [i.dataset.p, i.value.trim()])))
          .filter(p => p.lugar || p.hora || p.tema),
        previa: null, // formato anterior (una sola)
      };
    }

    fr.onsubmit = async e => {
      e.preventDefault();
      const btn = fr.querySelector('.btn:not(.ghost)');
      try {
        const reuniones = [...lista.querySelectorAll('.reu-bloque')].map(leerBloque);
        reuniones.forEach(r => {
          const n = r.nombre || 'sin nombre';
          if (r.desde && r.hasta && r.hasta < r.desde) throw new Error(`Reunión "${n}": "Hasta" debe ser después de "Desde"`);
          if (r.activo && !r.cursos.length) throw new Error(`Reunión "${n}": marque qué cursos tienen reunión`);
          if (r.previas.some(p => !(p.lugar && p.hora))) throw new Error(`Reunión "${n}": indique el lugar y la hora de cada reunión general`);
          // se recuerda la sala de cada curso para la próxima reunión
          r.cursos.forEach(c => { if (c.sala) salasCurso[c.curso] = c.sala; });
        });
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        await API.admin('ajustes', { password, valores: {
          reuniones: JSON.stringify(reuniones), salas: JSON.stringify(leerFilas(salas).filter(s => s.sala)),
          salasCurso: JSON.stringify(salasCurso),
          reunion: '', // formato anterior (una sola reunión): ya no se usa
        } });
        toast('Guardado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = '💾 Guardar todo';
      }
    };
  }

  // ---------- 📸 Instagram: elegir publicaciones (casillas) e historias automáticas ----------
  function vistaInstagram() {
    const historias = (data.historias || []).filter(h => new Date(h.vence).getTime() > Date.now());
    return `<div class="panel ig-panel">
      <h2>📸 Instagram del colegio</h2>
      <form id="ig-enlace">
        <fieldset class="grupo">
          <legend>🔗 Compartir una publicación o reel (sin clave)</legend>
          <label>Enlace o código de inserción de la publicación
            <textarea name="url" rows="2" required placeholder="https://www.instagram.com/p/... · o pegue el código &lt;blockquote class=&quot;instagram-media&quot;…"></textarea></label>
          <label>Mensaje (opcional) · copie aquí el texto de la publicación
            <textarea name="texto" rows="4" placeholder="Se mostrará destacado al lado de la foto o del reel"></textarea></label>
          <div class="dos">${PUBLICO}
            <label>🏷️ Categoría<select name="categoria">${opcionesCat('actividades')}</select></label></div>
          <button class="btn">Publicar en las pantallas</button>
          <p class="note">En Instagram abra la publicación → <b>⋯ → Copiar enlace</b>. Se muestra con la tarjeta oficial de
          Instagram y, si escribe el mensaje, este aparece grande al lado.
          <b>Los reels por enlace solo muestran su portada</b>: para que se reproduzcan, súbalos abajo.
          Para quitar una publicación, use <b>📸 Fotos y videos</b>.</p>
        </fieldset>
      </form>
      <form id="ig-foto">
        <fieldset class="grupo">
          <legend>🖼️ Subir la foto de una publicación con su mensaje (recomendado: siempre se ve)</legend>
          <p class="note">Instagram a veces bloquea sus publicaciones en otras páginas (en el TV se ve "no disponible").
          Guarde la foto desde Instagram y súbala aquí con el texto: se verá <b>igual, con la foto grande y el mensaje al lado</b>,
          sin depender de Instagram. Si la publicación tiene varias fotos, elija varias.</p>
          <label>Foto(s) de la publicación<input type="file" name="fotos" accept="image/*" multiple required></label>
          <label>Mensaje · copie aquí el texto de la publicación
            <textarea name="texto" rows="4" placeholder="Ej: 🥦🍎 Día de la Alimentación Saludable…"></textarea></label>
          ${PUBLICO}
          <button class="btn">Publicar en las pantallas</button>
        </fieldset>
      </form>
      <form id="ig-reel">
        <fieldset class="grupo">
          <legend>🎬 Subir un reel para que se reproduzca solo (con sonido)</legend>
          <p class="note">Por enlace, Instagram solo deja mostrar la portada del reel. Para que se reproduzca solo y
          completo, descárguelo (en el reel: <b>⋯ → Descargar</b> o "Guardar en el teléfono") y súbalo aquí.</p>
          <label>Archivo del reel (MP4, máx. ${MAX_VIDEO_MB} MB · se sube por partes)<input type="file" name="video" accept="video/mp4,video/*" required></label>
          <label>Mensaje (opcional) · aparece grande al lado del video
            <textarea name="texto" rows="3" placeholder="Ej: ¡Así vivimos la Feria Científica! 🔬"></textarea></label>
          ${SONIDO()}
          ${PUBLICO}
          <button class="btn">Subir reel</button>
        </fieldset>
      </form>
      <form>
        <fieldset class="grupo">
          <legend>⏱️ Historias</legend>
          <p class="note">⏱️ <b>Historias:</b> Instagram no permite mostrarlas desde un enlace. Guárdela desde Instagram
          (en la historia: <b>⋯ → Guardar</b>) y súbala en <b>📸 Fotos y videos</b> marcando
          <b>"Es una historia"</b>: se verá destacada y se quitará sola a las 24 h.</p>
        </fieldset>
      </form>
      <details class="ig-ayuda"><summary>Opcional: conexión automática con token (elegir con casillas e historias automáticas)</summary>
      <p class="note" id="ig-estado">Revisando la conexión con Instagram…</p>

      <div id="ig-conectar" hidden>
        <label>Token de acceso de Instagram<input id="ig-token" type="password" autocomplete="off" placeholder="IGAA…"></label>
        <button class="btn" id="ig-btn-conectar">🔗 Conectar Instagram</button>
        <details class="ig-ayuda"><summary>¿Cómo obtengo el token? (se hace una sola vez)</summary>
          <ol>
            <li>En la app de Instagram del colegio: <b>Configuración → Tipo de cuenta → Cambiar a cuenta profesional → Empresa</b>.</li>
            <li>En <b>developers.facebook.com</b> (con una cuenta de Facebook del colegio): <b>Mis apps → Crear app</b>,
              elija el caso de uso <b>"Administrar mensajes y contenido en Instagram"</b>.</li>
            <li>Dentro de la app: <b>Instagram → Configuración de la API con inicio de sesión de Instagram →
              Generar tokens de acceso → Agregar cuenta</b> e inicie sesión con la cuenta del colegio.</li>
            <li>Copie el token que aparece, péguelo arriba y pulse <b>Conectar</b>.</li>
          </ol>
          <p class="note">El token se guarda en Apps Script (no en la hoja pública) y se renueva solo cada semana.</p>
        </details>
      </div>

      <div id="ig-cuerpo" hidden>
        <fieldset class="grupo">
          <legend>🖼️ Elija las publicaciones que se mostrarán en las pantallas</legend>
          <form id="ig-opciones" class="dos">${PUBLICO}
            <label>🏷️ Categoría<select name="categoria">${opcionesCat('actividades')}</select></label></form>
          <div class="ig-grid" id="ig-grid"><p class="note">Cargando publicaciones…</p></div>
          <button class="btn" id="ig-agregar" disabled>Agregar seleccionadas</button>
          <p class="note">Se ven como <b>foto grande con la reseña al lado</b>. Para quitarlas, use
          <b>📸 Fotos y videos</b>. Los reels se muestran con su portada.</p>
        </fieldset>
        <fieldset class="grupo">
          <legend>⏱️ Historias (automáticas)</legend>
          <p class="note">Cada 30 minutos se buscan historias nuevas: aparecen solas al comienzo del carrusel
          y se quitan cuando cumplen 24 horas.</p>
          <div class="ig-historias">${historias.map(h => `<img src="${esc(h.url)}" alt="Historia">`).join('')
            || '<p class="note">No hay historias activas en este momento.</p>'}</div>
          <button class="btn ghost" id="ig-buscar">🔄 Buscar historias ahora</button>
          <button class="btn ghost" id="ig-cambiar">Cambiar token</button>
        </fieldset>
      </div>
      </details>
    </div>`;
  }

  async function iniciarInstagram() {
    // Foto(s) de una publicación + su mensaje: se ve como Instagram pero sin depender de Instagram
    const ff = document.getElementById('ig-foto');
    ff.onsubmit = async e => {
      e.preventDefault();
      const btn = ff.querySelector('.btn');
      try {
        const fotos = [...ff.elements.fotos.files];
        if (!fotos.length) throw new Error('Elija la foto de la publicación');
        const texto = ff.elements.texto.value.trim();
        btn.disabled = true;
        for (let k = 0; k < fotos.length; k++) {
          btn.textContent = `Subiendo foto ${k + 1} de ${fotos.length}…`;
          const image = { data: await comprimir(fotos[k]), mimeType: 'image/jpeg', name: fotos[k].name.replace(/\.\w+$/, '') + '.jpg' };
          await API.admin('add', { password, sheet: 'fotos', image, item: {
            titulo: (texto.split('\n')[0] || 'Publicación de Instagram').slice(0, 90), texto, origen: 'instagram',
            categoria: 'actividades', publico: ff.elements.publico.value, espacio: ff.elements.espacio.value,
          } });
        }
        toast('Publicado en las pantallas ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = 'Publicar en las pantallas';
      }
    };

    // Subir un reel (MP4): se guarda en Drive y se reproduce solo en el carrusel
    const fr = document.getElementById('ig-reel');
    fr.onsubmit = async e => {
      e.preventDefault();
      const btn = fr.querySelector('.btn');
      try {
        const archivo = fr.elements.video.files[0];
        if (!archivo) throw new Error('Elija el archivo del reel');
        if (archivo.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`El video supera ${MAX_VIDEO_MB} MB. Use uno más corto o súbalo a YouTube.`);
        const el = fr.elements;
        const texto = el.texto.value.trim();
        btn.disabled = true;
        const fileId = await API.subirArchivo(password, archivo, p => (btn.textContent = `Subiendo reel… ${Math.round(p * 100)}%`));
        btn.textContent = 'Publicando…';
        await API.admin('add', { password, sheet: 'fotos', item: {
          titulo: (texto.split('\n')[0] || 'Reel de Instagram').slice(0, 90), texto,
          formato: 'video', origen: 'instagram', categoria: 'actividades',
          audio: el.audio.checked ? 'si' : 'no', audioFunc: el.audioFunc.checked ? 'si' : 'no',
          vecesAudio: el.vecesAudio.value, publico: el.publico.value, espacio: el.espacio.value,
        }, image: { fileId, mimeType: archivo.type || 'video/mp4' } });
        toast('Reel publicado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = 'Subir reel';
      }
    };

    // Publicar por enlace (no necesita clave ni token)
    const fe = document.getElementById('ig-enlace');
    fe.onsubmit = async e => {
      e.preventDefault();
      const btn = fe.querySelector('.btn');
      try {
        const ruta = UI.instagramRuta(fe.elements.url.value);
        if (!ruta) throw new Error('El enlace no parece ser una publicación o reel de Instagram');
        const texto = fe.elements.texto.value.trim();
        btn.disabled = true;
        btn.textContent = 'Publicando…';
        await API.admin('add', { password, sheet: 'fotos', item: {
          titulo: (texto.split('\n')[0] || (ruta.startsWith('reel/') ? 'Reel de Instagram' : 'Publicación de Instagram')).slice(0, 90),
          url: `https://www.instagram.com/${ruta}/`, texto, origen: 'instagram',
          publico: fe.elements.publico.value, espacio: fe.elements.espacio.value, categoria: fe.elements.categoria.value,
        } });
        toast('Publicado en las pantallas ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = 'Publicar en las pantallas';
      }
    };

    const estado = document.getElementById('ig-estado');
    const conectar = document.getElementById('ig-conectar');
    const cuerpo = document.getElementById('ig-cuerpo');
    const mostrar = c => {
      estado.innerHTML = c.conectado
        ? `✅ Conectado a <b>@${esc(c.usuario)}</b>`
        : '⚠️ Instagram aún no está conectado. Para elegir publicaciones y mostrar historias solas, conéctelo con un token.';
      conectar.hidden = c.conectado;
      cuerpo.hidden = !c.conectado;
      if (c.conectado) cargarPublicaciones();
    };

    document.getElementById('ig-btn-conectar').onclick = async e => {
      const b = e.target;
      b.disabled = true;
      b.textContent = 'Conectando…';
      try {
        const r = await API.admin('igConectar', { password, token: document.getElementById('ig-token').value });
        toast('Instagram conectado ✔');
        mostrar(r.cuenta);
      } catch (err) {
        toast(err.message, 'err');
      }
      b.disabled = false;
      b.textContent = '🔗 Conectar Instagram';
    };
    document.getElementById('ig-cambiar').onclick = () => { conectar.hidden = false; };
    document.getElementById('ig-buscar').onclick = async e => {
      e.target.disabled = true;
      try {
        await API.admin('igHistorias', { password });
        toast('Historias actualizadas ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        e.target.disabled = false;
      }
    };

    const grid = document.getElementById('ig-grid');
    const agregar = document.getElementById('ig-agregar');
    const elegidas = () => [...grid.querySelectorAll('input:checked')].map(c => c.value);
    grid.onchange = () => {
      const n = elegidas().length;
      agregar.disabled = !n;
      agregar.textContent = n ? `Agregar ${n} seleccionada${n > 1 ? 's' : ''}` : 'Agregar seleccionadas';
    };
    agregar.onclick = async () => {
      const ids = elegidas();
      const op = document.getElementById('ig-opciones').elements;
      agregar.disabled = true;
      agregar.textContent = `Agregando ${ids.length}… (copiando las fotos)`;
      try {
        const r = await API.admin('igAgregar', { password, ids, item: { publico: op.publico.value, categoria: op.categoria.value } });
        toast(`${r.agregadas} publicación(es) agregada(s) a las pantallas ✔`);
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        grid.onchange();
      }
    };

    async function cargarPublicaciones() {
      try {
        const { lista } = await API.admin('igLista', { password });
        const TIPO = { VIDEO: '🎬 Reel', CAROUSEL_ALBUM: '🗂️ Varias fotos' };
        grid.innerHTML = lista.map(m => `<label class="ig-item ${m.agregada ? 'ya' : ''}">
          <input type="checkbox" value="${esc(m.id)}" ${m.agregada ? 'disabled' : ''}>
          <img src="${esc(m.img)}" alt="" loading="lazy">
          ${TIPO[m.tipo] ? `<span class="ig-tipo">${TIPO[m.tipo]}</span>` : ''}
          ${m.agregada ? '<span class="ig-ya">✔ En pantallas</span>' : ''}
          <small>${esc(new Date(m.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }))} · ${esc(m.texto.slice(0, 90))}</small>
        </label>`).join('') || '<p class="note">La cuenta no tiene publicaciones.</p>';
      } catch (err) {
        grid.innerHTML = `<p class="note" style="color:#ff8b8e">${esc(err.message)}</p>`;
      }
    }

    try {
      mostrar((await API.admin('igEstado', { password })).cuenta);
    } catch (err) {
      estado.innerHTML = /desconocida/i.test(err.message)
        ? '⚠️ Falta actualizar el <b>Code.gs</b> en Apps Script para usar Instagram.'
        : esc(err.message);
    }
  }

  // ¿YouTube permite reproducir este video fuera de su sitio? Muchos dueños (sellos de música) lo prohíben
  // (error 150/101). Se prueba con un reproductor invisible y en silencio: true · false · null (no se supo).
  const MSG_YT_BLOQUEADO = 'Este video de YouTube no permite reproducirse fuera de YouTube (lo decidió su dueño), ' +
    'así que en las pantallas no se verá ni sonará. Elija otra versión (por ejemplo, "lyrics", "audio" o música libre).';
  const revisadosYt = {};
  function youtubeInsertable(id) {
    if (revisadosYt[id] !== undefined) return Promise.resolve(revisadosYt[id]);
    return new Promise(res => {
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:-9999px;width:320px;height:180px;opacity:0;pointer-events:none';
      f.allow = 'autoplay; encrypted-media';
      const fin = r => {
        clearTimeout(t);
        window.removeEventListener('message', oir);
        f.remove();
        if (r !== null) revisadosYt[id] = r;
        res(r);
      };
      const t = setTimeout(() => fin(null), 15000);
      const oir = e => {
        if (e.source !== f.contentWindow) return;
        let d;
        try { d = JSON.parse(e.data); } catch (x) { return; }
        if (d.event === 'onError') fin(!(d.info === 150 || d.info === 101 || d.info === 100));
        const st = d.event === 'onStateChange' ? d.info : d.info && d.info.playerState;
        if (st === 1 || st === 3) fin(true); // reproduciendo o cargando: se puede
      };
      window.addEventListener('message', oir);
      f.onload = () => f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 7 }), '*');
      f.src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
      document.body.appendChild(f);
    });
  }

  // Marca con ⚠️ los videos y canciones ya publicados que YouTube no deja reproducir (de a uno)
  async function revisarPublicadosYt() {
    const sec = seccion;
    for (const it of (data[sec] || [])) {
      const id = UI.youtubeId(it.url);
      if (!id || await youtubeInsertable(id) !== false || seccion !== sec) continue;
      const b = app.querySelector(`.del[data-id="${CSS.escape(String(it.id))}"]`);
      const fila = b && b.closest('.item');
      if (fila && !fila.querySelector('.aviso-yt')) {
        fila.insertAdjacentHTML('beforeend', `<p class="aviso-yt">⚠️ YouTube no permite reproducir este video fuera de su sitio:
          en las pantallas <b>no se verá ni sonará</b>. Elimínelo y publique otra versión.</p>`);
      }
    }
  }

  // ---------- Editar una publicación: se carga en el mismo formulario y se guarda con "update" ----------
  const CASILLAS_NO = ['audio', 'audioFunc']; // desmarcadas se guardan como 'no' (vacío = con sonido)

  function cargarEdicion(form, it) {
    const el = form.elements;
    // tipo según lo publicado (no se puede cambiar al editar)
    if (el.tipo) {
      el.tipo.value = seccion === 'destacados' ? (it.tipo === 'curso' ? 'curso' : 'alumno')
        : seccion === 'musica' ? (it.fileId ? 'archivo' : 'enlace') : UI.youtubeId(it.url) ? 'video' : 'imagen';
      el.tipo.onchange && el.tipo.onchange();
      el.tipo.disabled = true;
    }
    // los reels (MP4) también tienen sonido; las publicaciones de Instagram, su mensaje
    if (it.formato === 'video') form.querySelectorAll('fieldset.sonido').forEach(f => (f.hidden = false));
    form.querySelectorAll('[data-editar-ig]').forEach(f => (f.hidden = it.origen !== 'instagram'));
    // destacados: al editar un alumno se puede cambiar su nombre
    form.querySelectorAll('[data-solo-editar]').forEach(f => (f.hidden = seccion === 'destacados' && it.tipo === 'curso'));
    form.querySelectorAll('.dest-filas').forEach(f => (f.hidden = true));
    if (seccion === 'destacados' && it.url) { const p = document.getElementById('preview'); p.src = it.url; p.hidden = false; }
    // lo que no corresponde a esta publicación no se envía (así no se borra, por ejemplo, la imagen)
    form.querySelectorAll('input, select, textarea').forEach(c => {
      if (c.name === 'tipo') return;
      const oculto = !!c.closest('[hidden]');
      c.disabled = oculto || c.type === 'file' || c.name === 'historia';
      if (c.type === 'file') c.closest('label').hidden = true;
      if (c.disabled || !c.name) return;
      // sonido en Familias: vacío = con sonido · en Funcionarios: solo si dice 'si'
      if (c.type === 'checkbox') c.checked = c.name === 'audio' ? it.audio !== 'no' : it[c.name] === 'si';
      // en las listas solo se carga un valor que exista (si está vacío queda la opción por defecto)
      else if (it[c.name] !== undefined && (c.tagName !== 'SELECT' || [...c.options].some(o => o.value === String(it[c.name])))) c.value = it[c.name];
    });
    form.querySelectorAll('.cuantas, [data-tipo="imagen"].note').forEach(n => (n.hidden = true));
    // ícono elegido
    if (el.icono) form.querySelectorAll('.icon-picker button').forEach(b => b.classList.toggle('on', b.dataset.ico === (it.icono || el.icono.value)));
    const prev = document.getElementById('preview');
    if (prev && UI.youtubeId(it.url)) { prev.src = `https://img.youtube.com/vi/${UI.youtubeId(it.url)}/hqdefault.jpg`; prev.hidden = false; }
  }

  async function guardarEdicion(form) {
    const btn = form.querySelector('.btn');
    try {
      const item = { id: editando.id };
      new FormData(form).forEach((v, k) => (item[k] = String(v)));
      form.querySelectorAll('input[type=checkbox][name]:not(:disabled)').forEach(c => {
        item[c.name] = c.checked ? 'si' : CASILLAS_NO.includes(c.name) ? 'no' : '';
      });
      if (seccion === 'fechas' && item.fechaFin && item.fechaFin < item.fecha) throw new Error('La fecha "Hasta" debe ser igual o posterior a "Desde"');
      if (item.url !== undefined && UI.youtubeId(editando.url)) {
        const id = UI.youtubeId(item.url);
        if (!id) throw new Error('El enlace no parece ser un video de YouTube');
        item.url = 'https://www.youtube.com/watch?v=' + id;
      }
      if (seccion === 'musica' && item.url !== undefined && !/^https?:\/\//.test(item.url)) throw new Error('Escriba un enlace que empiece con https://');
      btn.disabled = true;
      const ytId = item.url !== undefined && item.url !== editando.url && UI.youtubeId(item.url);
      if (ytId) {
        btn.textContent = 'Revisando el video en YouTube…';
        if (await youtubeInsertable(ytId) === false) throw new Error(MSG_YT_BLOQUEADO);
      }
      btn.textContent = 'Guardando…';
      await API.admin('update', { password, sheet: seccion, item });
      toast('Cambios guardados ✔');
      editando = null;
      await recargar();
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = '💾 Guardar cambios';
    }
  }

  // ---------- ⭐ Destacados: todos los cursos listos; se abre uno con un clic y se agregan o editan sus alumnos/as ----------
  // También: el curso completo (🏆 una foto de todo el curso), apoderados/as y funcionarios/as destacados/as.
  const destAbiertos = new Set(); // cursos abiertos (siguen abiertos al guardar)
  const ETQ_DEST = {
    alumno: { quien: 'alumno/a', detalle: '' },
    apoderado: { quien: 'apoderado/a', detalle: '👨‍👩‍👧 Detalle (ej. apoderada de 2° Básico B)' },
    funcionario: { quien: 'funcionario/a', detalle: '💼 Cargo (ej. Inspector, Profesora de Lenguaje)' },
  };

  // ¿Quién lo ve? (cada destacado por separado: ej. lo de funcionarios, solo en la pantalla Funcionarios)
  const OPC_PUBLICO = [['ambos', '👀 Funcionarios y familias'], ['funcionarios', '📺 Solo Funcionarios'], ['familias', '👨‍👩‍👧 Solo Familias']];
  const selPublico = (sel, attr) => `<label>👀 Lo ven<select ${attr}>${OPC_PUBLICO.map(([v, t]) =>
    `<option value="${v}" ${(sel || 'ambos') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  // por defecto: lo de funcionarios solo en Funcionarios; el resto, en ambas pantallas
  const publicoPorDefecto = tipo => (/funcionario/.test(tipo) ? 'funcionarios' : 'ambos');

  // una persona ya publicada: se edita ahí mismo (nombre, motivo, foto, quién lo ve) o se elimina
  const tarjetaPersona = d => `<div class="dp-item" data-id="${esc(d.id)}">
    <img src="${esc(d.url || 'insignia.png')}" alt="">
    <div class="dp-campos">
      <label>👤 Nombre<input data-f="nombre" value="${esc(d.nombre || '')}"></label>
      ${ETQ_DEST[d.tipo] && ETQ_DEST[d.tipo].detalle ? `<label>${ETQ_DEST[d.tipo].detalle}<input data-f="curso" value="${esc(d.curso || '')}"></label>` : ''}
      <label>🏅 Motivo<input data-f="motivo" value="${esc(d.motivo || '')}"></label>
      ${selPublico(d.publico, 'data-f="publico"')}
    </div>
    <div class="dp-acc">
      <label class="btn ghost mini">📷 Cambiar foto<input type="file" accept="image/*" data-acc="foto" hidden></label>
      <button type="button" class="btn mini" data-acc="guardar">💾 Guardar</button>
      <button type="button" class="del" data-acc="eliminar">🗑️ Eliminar</button>
    </div></div>`;

  // agregar personas: se eligen varias fotos y aparece una fila por foto
  const bloqueNuevos = tipo => `<div class="dp-nuevos">
    <label class="btn ghost dp-subir">📷 Agregar fotos de ${tipo === 'alumno' ? 'alumnos/as' : tipo === 'apoderado' ? 'apoderados/as' : 'funcionarios/as'}
      (una por persona · puede elegir varias a la vez)<input type="file" accept="image/*" multiple data-acc="fotos" hidden></label>
    <div class="dp-filas"></div>
    <div class="dp-publicar" hidden>
      <label>🏅 Motivo para todos (si alguno tiene otro, escríbalo en su fila)<input data-f="motivoComun" placeholder="Ej: Excelencia académica del semestre"></label>
      ${tipo === 'alumno' ? '' : selPublico(publicoPorDefecto(tipo), 'data-f="publicoNuevo"')}
      <button type="button" class="btn" data-acc="publicar">✅ Publicar</button>
    </div></div>`;

  // una foto de grupo ya publicada (curso completo, o un grupo / actividad de funcionarios o apoderados)
  const tarjetaGrupo = (c, conNombre) => `<div class="dp-item" data-id="${esc(c.id)}"><img src="${esc(c.url)}" alt="" class="ancha">
    <div class="dp-campos">
      ${conNombre ? `<label>📌 Grupo o actividad<input data-f="nombre" value="${esc(c.nombre || '')}"></label>` : ''}
      <label>🏅 Motivo<input data-f="motivo" value="${esc(c.motivo || '')}"></label>
      ${selPublico(c.publico, 'data-f="publico"')}
    </div>
    <div class="dp-acc">
      <label class="btn ghost mini">📷 Cambiar foto<input type="file" accept="image/*" data-acc="foto" hidden></label>
      <button type="button" class="btn mini" data-acc="guardar">💾 Guardar</button>
      <button type="button" class="del" data-acc="eliminar">🗑️ Quitar</button></div></div>`;

  // un grupo (un curso, apoderados o funcionarios): lo publicado y para agregar más
  function cuerpoGrupo(tipo, curso) {
    const lista = (data.destacados || []).filter(d => (d.tipo || 'alumno') === tipo && (tipo !== 'alumno' || d.curso === curso));
    let html = `<div class="etiqueta">${tipo === 'alumno' ? '⭐ Alumnos/as destacados/as' : '👤 Personas destacadas (una foto por persona)'}</div>
      <div class="dp-lista">${lista.map(tarjetaPersona).join('') || `<p class="note">Aún no hay ${ETQ_DEST[tipo].quien} destacados/as${curso ? ' en este curso' : ''}.</p>`}</div>
      ${bloqueNuevos(tipo)}`;
    if (tipo === 'alumno') {
      // 🏆 el curso completo
      const c = (data.destacados || []).find(d => d.tipo === 'curso' && d.curso === curso);
      html += `<div class="dp-curso" data-tipo="curso">
        <div class="etiqueta">🏆 Destacar al curso completo</div>
        ${c ? tarjetaGrupo(c, false)
          : `<div class="dp-nuevo-curso">
            <label class="btn ghost mini">📷 Foto del curso completo<input type="file" accept="image/*" data-acc="fotoCurso" hidden></label>
            <img class="dp-vista" hidden alt="">
            <label>🏅 Motivo<input data-f="motivoCurso" placeholder="Ej: Mejor asistencia del mes"></label>
            ${selPublico('ambos', 'data-f="publicoNuevo"')}
            <button type="button" class="btn mini" data-acc="publicarCurso">🏆 Destacar curso</button></div>`}
      </div>`;
    } else {
      // 👥 grupos o actividades (ej. "Equipo de Inspectoría", "Taller de apoderados"): una foto con varias personas
      const grupos = (data.destacados || []).filter(d => d.tipo === 'grupo_' + tipo);
      html += `<div class="dp-curso" data-tipo="grupo_${tipo}">
        <div class="etiqueta">👥 Grupos y actividades destacadas (una foto con varias personas)</div>
        <div class="dp-lista">${grupos.map(g => tarjetaGrupo(g, true)).join('')}</div>
        <div class="dp-nuevo-curso">
          <label class="btn ghost mini">📷 Foto del grupo o actividad<input type="file" accept="image/*" data-acc="fotoCurso" hidden></label>
          <img class="dp-vista" hidden alt="">
          <label>📌 Grupo o actividad<input data-f="nombreGrupo" placeholder="${tipo === 'funcionario' ? 'Ej: Equipo de Inspectoría · Jornada de convivencia' : 'Ej: Directiva de 3° Medio · Taller de familias'}"></label>
          <label>🏅 Motivo<input data-f="motivoCurso" placeholder="Ej: Por su gran apoyo en la Fiesta de la Chilenidad"></label>
          ${selPublico(publicoPorDefecto(tipo), 'data-f="publicoNuevo"')}
          <button type="button" class="btn mini" data-acc="publicarCurso">⭐ Destacar</button></div>
      </div>`;
    }
    return html;
  }


  function vistaDestacados() {
    const ds = data.destacados || [];
    const cuenta = c => ds.filter(d => (d.tipo || 'alumno') === 'alumno' && d.curso === c).length;
    const tieneCurso = c => ds.some(d => d.tipo === 'curso' && d.curso === c);
    const grupo = (tipo, curso, titulo, resumen) => `<details class="dp-grupo" data-tipo="${tipo}" data-curso="${esc(curso || '')}"
        ${destAbiertos.has(tipo + '|' + (curso || '')) ? 'open' : ''}>
      <summary><b>${esc(titulo)}</b><span class="dp-resumen">${resumen}</span></summary>
      <div class="dp-cuerpo">${destAbiertos.has(tipo + '|' + (curso || '')) ? cuerpoGrupo(tipo, curso) : ''}</div></details>`;
    const n = t => ds.filter(d => d.tipo === t).length;
    return `<div class="panel" style="max-width:1100px">
      <h2>⭐ Destacados</h2>
      <p class="note">Pinche un curso para abrirlo: ahí agrega a los alumnos/as destacados/as (varias fotos a la vez), corrige su nombre,
      motivo o foto, y puede destacar al <b>curso completo</b> con una foto. En las pantallas pasan <b>de a 3</b>.</p>
      <fieldset class="grupo dp-opciones" id="dest-opc">
        <legend>⚙️ Para lo que publique ahora</legend>
        <div class="dos">${PUBLICO}</div>
        <label>📅 Mostrar hasta (opcional · vacío = hasta que lo elimine)<input type="date" name="vence"></label>
      </fieldset>
      <div id="dest-grupos">
        ${Object.values(UI.NIVELES).map(N => `<div class="dp-nivel"><h3>${esc(N.nombre)}</h3>
          <div class="dp-cursos">${N.cursos.map(c => grupo('alumno', c, c,
            `${cuenta(c) ? `⭐ ${cuenta(c)}` : '—'}${tieneCurso(c) ? ' · 🏆' : ''}`)).join('')}</div></div>`).join('')}
        <div class="dp-nivel"><h3>👥 Comunidad</h3><div class="dp-cursos">
          ${grupo('apoderado', '', '💙 Apoderados/as destacados/as', [n('apoderado') ? `⭐ ${n('apoderado')}` : '', n('grupo_apoderado') ? `👥 ${n('grupo_apoderado')}` : ''].filter(Boolean).join(' · ') || '—')}
          ${grupo('funcionario', '', '🏅 Funcionarios/as destacados/as', [n('funcionario') ? `⭐ ${n('funcionario')}` : '', n('grupo_funcionario') ? `👥 ${n('grupo_funcionario')}` : ''].filter(Boolean).join(' · ') || '—')}
        </div></div>
      </div></div>`;
  }

  function iniciarDestacados() {
    const cont = document.getElementById('dest-grupos');
    const opc = () => {
      const o = {};
      document.querySelectorAll('#dest-opc [name]').forEach(c => (o[c.name] = c.value));
      return o;
    };
    // al abrir un curso se dibuja su contenido
    cont.addEventListener('toggle', e => {
      const g = e.target;
      if (!g.classList || !g.classList.contains('dp-grupo')) return;
      const k = g.dataset.tipo + '|' + g.dataset.curso;
      if (g.open) {
        destAbiertos.add(k);
        if (!g.querySelector('.dp-cuerpo').innerHTML.trim()) g.querySelector('.dp-cuerpo').innerHTML = cuerpoGrupo(g.dataset.tipo, g.dataset.curso);
      } else destAbiertos.delete(k);
    }, true);

    const dibujarFilas = nuevos => {
      const g = nuevos.closest('.dp-grupo');
      const det = ETQ_DEST[g.dataset.tipo].detalle;
      nuevos.querySelector('.dp-filas').innerHTML = nuevos._archivos.map((f, k) => `<div class="dest-fila ${det ? 'con-detalle' : ''}" data-k="${k}">
        <img src="${f.vista}" alt="">
        <label>👤 Nombre<input data-campo="nombre" placeholder="Nombre y apellido" value="${esc(f.nombre || '')}"></label>
        ${det ? `<label>${det}<input data-campo="curso" value="${esc(f.curso || '')}"></label>` : ''}
        <label>🏅 Motivo (si es distinto)<input data-campo="motivo" placeholder="Vacío = el motivo para todos" value="${esc(f.motivo || '')}"></label>
        <button type="button" class="tel-quitar" title="Quitar esta foto">✕</button></div>`).join('');
      nuevos.querySelector('.dp-publicar').hidden = !nuevos._archivos.length;
    };
    const leerFilasNuevas = nuevos => nuevos.querySelectorAll('.dest-fila').forEach(r => {
      const f = nuevos._archivos[+r.dataset.k];
      r.querySelectorAll('[data-campo]').forEach(c => (f[c.dataset.campo] = c.value.trim()));
    });

    cont.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.acc === 'fotos') {
        const nuevos = t.closest('.dp-nuevos');
        nuevos._archivos = nuevos._archivos || [];
        leerFilasNuevas(nuevos);
        [...t.files].forEach(file => nuevos._archivos.push({ file, vista: URL.createObjectURL(file) }));
        t.value = '';
        dibujarFilas(nuevos);
        nuevos.querySelector('.dest-fila:last-child [data-campo="nombre"]')?.focus();
      } else if (t.dataset.acc === 'foto') {
        // nueva foto para alguien ya publicado: se ve al tiro y se guarda con "Guardar"
        const it = t.closest('.dp-item');
        if (!t.files[0]) return;
        it._foto = t.files[0];
        it.querySelector('img').src = URL.createObjectURL(t.files[0]);
        it.classList.add('cambiado');
      } else if (t.dataset.acc === 'fotoCurso') {
        const b = t.closest('.dp-nuevo-curso');
        if (!t.files[0]) return;
        b._foto = t.files[0];
        const v = b.querySelector('.dp-vista');
        v.src = URL.createObjectURL(t.files[0]);
        v.hidden = false;
      }
    });
    const marcar = e => { const it = e.target.closest('.dp-item'); if (it) it.classList.add('cambiado'); };
    cont.addEventListener('input', marcar);
    cont.addEventListener('change', marcar);

    cont.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      const g = b.closest('.dp-grupo');
      const tipo = g.dataset.tipo;
      const curso = g.dataset.curso;
      const ocupado = async (texto, fn) => {
        const antes = b.textContent;
        b.disabled = true;
        b.textContent = texto;
        try { await fn(); } catch (err) { toast(err.message, 'err'); b.disabled = false; b.textContent = antes; }
      };
      if (b.classList.contains('tel-quitar')) {
        const nuevos = b.closest('.dp-nuevos');
        leerFilasNuevas(nuevos);
        nuevos._archivos.splice(+b.closest('.dest-fila').dataset.k, 1);
        dibujarFilas(nuevos);
      } else if (b.dataset.acc === 'publicar') {
        const nuevos = b.closest('.dp-nuevos');
        leerFilasNuevas(nuevos);
        const comun = nuevos.querySelector('[data-f="motivoComun"]').value.trim();
        const fs = nuevos._archivos || [];
        const sin = fs.findIndex(f => !f.nombre);
        if (sin > -1) return toast(`Falta el nombre de la foto ${sin + 1}`, 'err');
        if (fs.some(f => !f.motivo) && !comun) return toast('Escriba el motivo (para todos o en cada fila)', 'err');
        await ocupado('Subiendo…', async () => {
          const grupoId = 'g' + Date.now();
          for (let k = 0; k < fs.length; k++) {
            b.textContent = `Subiendo ${k + 1} de ${fs.length}…`;
            const f = fs[k];
            const item = Object.assign(opc(), { tipo, grupo: grupoId, nombre: f.nombre, motivo: f.motivo || comun,
              curso: tipo === 'alumno' ? curso : (f.curso || '') });
            // apoderados/as y funcionarios/as: quién lo ve se elige en su propio bloque
            const pub = nuevos.querySelector('[data-f="publicoNuevo"]');
            if (pub) item.publico = pub.value;
            const image = { data: await comprimir(f.file, 900), mimeType: 'image/jpeg', name: f.nombre + '.jpg' };
            await API.admin('add', { password, sheet: 'destacados', item, image });
          }
          toast(`${fs.length} publicado(s) ✔`);
          await recargar();
        });
      } else if (b.dataset.acc === 'publicarCurso') {
        // foto de grupo: el curso completo, o un grupo / actividad de funcionarios o apoderados
        const bl = b.closest('.dp-nuevo-curso');
        const tipoG = b.closest('.dp-curso').dataset.tipo; // 'curso' | 'grupo_funcionario' | 'grupo_apoderado'
        const motivo = bl.querySelector('[data-f="motivoCurso"]').value.trim();
        const nombreG = bl.querySelector('[data-f="nombreGrupo"]');
        if (!bl._foto) return toast(tipoG === 'curso' ? 'Elija la foto del curso completo' : 'Elija la foto del grupo o actividad', 'err');
        if (nombreG && !nombreG.value.trim()) return toast('Escriba el nombre del grupo o actividad', 'err');
        if (!motivo) return toast('Escriba el motivo', 'err');
        await ocupado('Subiendo…', async () => {
          const nombre = nombreG ? nombreG.value.trim() : '';
          const image = { data: await comprimir(bl._foto, 1920), mimeType: 'image/jpeg', name: (nombre || curso) + '.jpg' };
          const item = Object.assign(opc(), { tipo: tipoG, curso: tipoG === 'curso' ? curso : '', nombre, motivo,
            publico: bl.querySelector('[data-f="publicoNuevo"]').value });
          await API.admin('add', { password, sheet: 'destacados', item, image });
          toast('Destacado ✔');
          await recargar();
        });
      } else if (b.dataset.acc === 'guardar') {
        const it = b.closest('.dp-item');
        const item = { id: it.dataset.id };
        it.querySelectorAll('[data-f]').forEach(c => (item[c.dataset.f] = c.value.trim()));
        if (item.nombre === '') return toast('Escriba el nombre', 'err');
        await ocupado('Guardando…', async () => {
          const image = it._foto ? { data: await comprimir(it._foto, it.closest('.dp-curso') ? 1920 : 900), mimeType: 'image/jpeg', name: (item.nombre || curso) + '.jpg' } : undefined;
          await API.admin('update', { password, sheet: 'destacados', item, image });
          toast('Cambios guardados ✔');
          await recargar();
        });
      } else if (b.dataset.acc === 'eliminar') {
        if (!confirm('¿Eliminar este destacado? (también su foto)')) return;
        await ocupado('Eliminando…', async () => {
          await API.admin('delete', { password, sheet: 'destacados', id: b.closest('.dp-item').dataset.id });
          toast('Eliminado');
          await recargar();
        });
      }
    });
  }


  // ---------- 🏫 Institucional: Misión, Visión, Sellos y "Conoce al equipo de gestión" ----------
  const CARGOS_BASE = ['Directora', 'Inspector/a General', 'Inspector/a General', 'Inspector/a General', 'Encargada de Convivencia Escolar',
    'Jefe de UTP', 'Coordinadora PIE', 'Coordinador/a de Ciclo', 'Coordinador/a de Ciclo', 'Coordinador/a de Ciclo'];
  const ICONOS_SELLO = ['🎓', '🧭', '🌱', '🎨', '⚽', '🤝', '📚', '🔬', '💙', '🌎', '🏆', '✨', '🧠', '🎭', '🎵', '❤️'];
  const filaSello = s => `<div class="sello-fila">
    <select data-s="icono">${ICONOS_SELLO.map(i => `<option ${i === (s.icono || '⭐') ? 'selected' : ''}>${i}</option>`).join('')}</select>
    <label>Título corto (se ve grande)<input data-s="titulo" value="${esc(s.titulo || '')}" placeholder="Ej: Deporte y arte"></label>
    <label>Texto<input data-s="texto" value="${esc(s.texto || '')}"></label>
    <button type="button" class="tel-quitar" title="Quitar">✕</button></div>`;
  const tarjetaEquipo = p => `<div class="dp-item eq-item" data-id="${esc(p.id)}">
    <img src="${esc(p.url || 'insignia.png')}" alt="">
    <div class="dp-campos">
      <label>👤 Nombre<input data-f="nombre" value="${esc(p.nombre || '')}" placeholder="Nombre y apellido"></label>
      <label>💼 Cargo<input data-f="cargo" list="cargos-base" value="${esc(p.cargo || '')}"></label>
    </div>
    <div class="dp-acc">
      <button type="button" class="btn ghost mini" data-acc="subir" title="Subir en el orden">⬆</button>
      <button type="button" class="btn ghost mini" data-acc="bajar" title="Bajar en el orden">⬇</button>
      <label class="btn ghost mini">📷 ${p.url ? 'Cambiar foto' : 'Agregar foto'}<input type="file" accept="image/*" data-acc="foto" hidden></label>
      <button type="button" class="btn mini" data-acc="guardar">💾 Guardar</button>
      <button type="button" class="del" data-acc="eliminar">🗑️</button>
    </div></div>`;

  // 🛡️ Insignias que se alternan en el encabezado al girar
  function bloqueInsignias(aj) {
    const elegidas = UI.leerJSON(aj.insignias, null);
    const todas = UI.INSIGNIAS_BASE.map(u => ({ url: u, nombre: u === 'insignia.png' ? 'Insignia' : 'Insignia en color' }))
      .concat((data.insignias || []).map(i => ({ url: i.url, nombre: i.nombre, id: i.id })));
    const usa = u => (Array.isArray(elegidas) ? elegidas.includes(u) : true);
    return `<fieldset class="grupo" id="ins-box" style="margin-top:18px">
      <legend>🛡️ Insignias del encabezado</legend>
      <p class="note">El escudo de arriba gira cada cierto tiempo. Marque las insignias que quiere que vayan <b>alternándose</b> en cada giro
      (por ejemplo la de color y la de los <b>70 años</b>). Use imágenes con fondo transparente (PNG) para que se vean mejor.</p>
      <div class="ins-lista">${todas.map(i => `<label class="ins-op">
        <input type="checkbox" value="${esc(i.url)}" ${usa(i.url) ? 'checked' : ''}>
        <img src="${esc(i.url)}" alt=""><span>${esc(i.nombre || '')}</span>
        ${i.id ? `<button type="button" class="img-quitar" data-id="${esc(i.id)}" title="Eliminar">✕</button>` : ''}</label>`).join('')}
        <label class="ins-op img-subir"><input type="file" accept="image/png,image/*" id="ins-subir" hidden><span>➕<br>Subir insignia</span></label></div>
      <button type="button" class="btn" id="ins-guardar">💾 Guardar insignias</button>
    </fieldset>`;
  }
  function iniciarInsignias() {
    const box = document.getElementById('ins-box');
    document.getElementById('ins-guardar').onclick = async e => {
      const urls = [...box.querySelectorAll('.ins-op input[type=checkbox]:checked')].map(c => c.value);
      if (!urls.length) return toast('Marque al menos una insignia', 'err');
      e.target.disabled = true;
      try {
        await API.admin('ajustes', { password, valores: { insignias: JSON.stringify(urls) } });
        toast('Insignias guardadas ✔');
        await recargar();
      } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
    };
    document.getElementById('ins-subir').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      const etq = e.target.closest('.img-subir').querySelector('span');
      etq.textContent = 'Subiendo…';
      try {
        // PNG: se sube tal cual (para no perder el fondo transparente) si no es muy grande
        const png = /png/i.test(f.type) && f.size < 3 * 1024 * 1024;
        const image = png ? { data: await aBase64(f), mimeType: 'image/png', name: f.name }
          : { data: await comprimir(f, 800), mimeType: 'image/jpeg', name: f.name.replace(/\.\w+$/, '') + '.jpg' };
        const r = await API.admin('add', { password, sheet: 'insignias', item: { nombre: f.name.replace(/\.\w+$/, '') }, image });
        // la nueva queda marcada para alternarse
        const actuales = [...box.querySelectorAll('.ins-op input[type=checkbox]:checked')].map(c => c.value);
        if (r.item && r.item.url) await API.admin('ajustes', { password, valores: { insignias: JSON.stringify(actuales.concat(r.item.url)) } });
        toast('Insignia subida ✔');
        await recargar();
      } catch (err) { toast(err.message, 'err'); etq.innerHTML = '➕<br>Subir insignia'; }
    };
    box.addEventListener('click', async e => {
      const b = e.target.closest('.img-quitar');
      if (!b) return;
      e.preventDefault();
      if (!confirm('¿Eliminar esta insignia?')) return;
      try {
        await API.admin('delete', { password, sheet: 'insignias', id: b.dataset.id });
        toast('Eliminada');
        await recargar();
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  function vistaInstitucional() {
    const aj = UI.ajustes(data);
    const g = UI.leerJSON(aj.institucional, {});
    const ins = UI.institucional(aj);
    const eq = (data.equipo || []).slice().sort((a, b) => (+a.orden || 999) - (+b.orden || 999));
    const bloque = (k, titulo) => `<fieldset class="grupo">
      <legend>${titulo}</legend>
      <label>Frase grande (resumen en pocas palabras)<input name="${k}Lema" value="${esc(ins[k].lema)}" maxlength="70"></label>
      <label>Texto completo<textarea name="${k}Texto" rows="5">${esc(ins[k].texto)}</textarea></label>
    </fieldset>`;
    return `<div class="panel" style="max-width:1100px">
      <h2>🏫 Misión, Visión, Sellos y Equipo de gestión</h2>
      <p class="note">Aparecen <b>de vez en cuando</b> en el carrusel de ambas pantallas, con un diseño propio:
      la Visión y la Misión con su frase grande y las <b>palabras clave resaltadas</b>; los Sellos como tarjetas con ícono;
      y "Conoce al equipo de gestión" con fotos, de a 4.</p>
      <form id="f-inst">
        <fieldset class="grupo">
          <legend>⚙️ Cuándo aparecen</legend>
          <label class="check"><input type="checkbox" name="activo" ${ins.activo ? 'checked' : ''}> Mostrar Misión, Visión y Sellos</label>
          <label class="check"><input type="checkbox" name="equipo" ${ins.equipo ? 'checked' : ''}> Mostrar "Conoce al equipo de gestión"</label>
          <label>Aparece una cada…<select name="cada">${[3, 4, 5, 6, 8, 10, 15].map(n => `<option value="${n}" ${ins.cada === n ? 'selected' : ''}>${n} publicaciones</option>`).join('')}</select></label>
        </fieldset>
        <p class="note">✍️ Para <b>resaltar</b> palabras clave escríbalas entre dos asteriscos: <code>**enfoque humanista**</code>.
        Así el texto largo se lee rápido: en pantalla se marcan en dorado una por una.</p>
        ${bloque('vision', '🔭 Visión')}
        ${bloque('mision', '🧭 Misión')}
        <fieldset class="grupo">
          <legend>🏅 Sellos educativos</legend>
          <div class="tel-filas" id="sellos-filas">${ins.sellos.map(filaSello).join('')}</div>
          <button type="button" class="btn ghost" id="sello-agregar">➕ Agregar sello</button>
        </fieldset>
        <button class="btn">💾 Guardar Misión, Visión y Sellos</button>
        ${g.vision || g.mision || g.sellos ? '<button type="button" class="btn ghost" id="inst-original">↺ Volver al texto original</button>' : ''}
      </form>
      ${bloqueInsignias(aj)}
      <fieldset class="grupo" id="equipo-box" style="margin-top:18px">
        <legend>👥 Conoce al equipo de gestión</legend>
        <datalist id="cargos-base">${[...new Set(CARGOS_BASE)].map(c => `<option value="${esc(c)}">`).join('')}
          <option value="Subdirector/a"><option value="Orientador/a"><option value="Psicólogo/a"><option value="Encargado/a de Extraescolar"></datalist>
        <div class="dp-lista" id="equipo-lista">${eq.map(tarjetaEquipo).join('') || '<p class="note">Aún no hay integrantes. Use "⚡ Agregar los cargos del equipo" o "➕ Agregar integrante".</p>'}</div>
        <div class="reu-acciones">
          <button type="button" class="btn ghost" id="eq-agregar">➕ Agregar integrante</button>
          ${eq.length ? '' : '<button type="button" class="btn ghost" id="eq-base">⚡ Agregar los cargos del equipo (Directora, 3 Inspectores Generales, Convivencia, UTP, PIE, 3 Coordinadores de ciclo)</button>'}
        </div>
        <p class="note">Escriba el nombre, elija o escriba el cargo (puede agregar los cargos que necesite), agregue la foto y pulse 💾 Guardar en cada uno.
        Solo aparecen en pantalla los que tienen nombre. Ordénelos con ⬆ ⬇.</p>
      </fieldset></div>`;
  }

  function iniciarInstitucional() {
    iniciarInsignias();
    const f = document.getElementById('f-inst');
    const sellos = document.getElementById('sellos-filas');
    document.getElementById('sello-agregar').onclick = () => sellos.insertAdjacentHTML('beforeend', filaSello({ icono: '⭐' }));
    sellos.onclick = e => { if (e.target.classList.contains('tel-quitar')) e.target.closest('.sello-fila').remove(); };
    const guardar = async valor => {
      const btn = f.querySelector('.btn:not(.ghost)');
      btn.disabled = true;
      btn.textContent = 'Guardando…';
      try {
        await API.admin('ajustes', { password, valores: { institucional: valor } });
        toast('Guardado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = '💾 Guardar Misión, Visión y Sellos';
      }
    };
    f.onsubmit = e => {
      e.preventDefault();
      const el = f.elements;
      guardar(JSON.stringify({
        activo: el.activo.checked ? 'si' : 'no', equipo: el.equipo.checked ? 'si' : 'no', cada: el.cada.value,
        vision: { lema: el.visionLema.value.trim(), texto: el.visionTexto.value.trim() },
        mision: { lema: el.misionLema.value.trim(), texto: el.misionTexto.value.trim() },
        sellos: [...sellos.querySelectorAll('.sello-fila')].map(r => Object.fromEntries([...r.querySelectorAll('[data-s]')].map(i => [i.dataset.s, i.value.trim()])))
          .filter(s => s.titulo || s.texto),
      }));
    };
    const orig = document.getElementById('inst-original');
    if (orig) orig.onclick = () => {
      if (!confirm('¿Volver a la Misión, Visión y Sellos originales del colegio?')) return;
      const el = f.elements;
      guardar(JSON.stringify({ activo: el.activo.checked ? 'si' : 'no', equipo: el.equipo.checked ? 'si' : 'no', cada: el.cada.value }));
    };

    // 👥 equipo de gestión
    const box = document.getElementById('equipo-box');
    const lista = document.getElementById('equipo-lista');
    const nuevoOrden = () => Math.max(0, ...(data.equipo || []).map(p => +p.orden || 0)) + 1;
    const agregar = async (items, b) => {
      b.disabled = true;
      try {
        for (const it of items) await API.admin('add', { password, sheet: 'equipo', item: it });
        toast('Agregado ✔ · complete el nombre y la foto de cada uno');
        await recargar();
      } catch (err) { toast(err.message, 'err'); b.disabled = false; }
    };
    document.getElementById('eq-agregar').onclick = e => agregar([{ nombre: '', cargo: '', orden: nuevoOrden() }], e.target);
    const base = document.getElementById('eq-base');
    if (base) base.onclick = e => agregar(CARGOS_BASE.map((cargo, k) => ({ nombre: '', cargo, orden: k + 1 })), e.target);
    box.addEventListener('change', e => {
      const it = e.target.closest('.eq-item');
      if (!it) return;
      it.classList.add('cambiado');
      if (e.target.dataset.acc === 'foto' && e.target.files[0]) { it._foto = e.target.files[0]; it.querySelector('img').src = URL.createObjectURL(it._foto); }
    });
    box.addEventListener('input', e => { const it = e.target.closest('.eq-item'); if (it) it.classList.add('cambiado'); });
    box.addEventListener('click', async e => {
      const b = e.target.closest('button[data-acc]');
      if (!b) return;
      const it = b.closest('.eq-item');
      const id = it.dataset.id;
      try {
        if (b.dataset.acc === 'guardar') {
          b.disabled = true;
          b.textContent = 'Guardando…';
          const item = { id, nombre: it.querySelector('[data-f="nombre"]').value.trim(), cargo: it.querySelector('[data-f="cargo"]').value.trim() };
          const image = it._foto ? { data: await comprimir(it._foto, 900), mimeType: 'image/jpeg', name: (item.nombre || 'equipo') + '.jpg' } : undefined;
          await API.admin('update', { password, sheet: 'equipo', item, image });
          toast('Guardado ✔');
          await recargar();
        } else if (b.dataset.acc === 'eliminar') {
          if (!confirm('¿Quitar a esta persona del equipo de gestión?')) return;
          await API.admin('delete', { password, sheet: 'equipo', id });
          toast('Eliminado');
          await recargar();
        } else if (b.dataset.acc === 'subir' || b.dataset.acc === 'bajar') {
          // intercambia el orden con el vecino
          const vecino = b.dataset.acc === 'subir' ? it.previousElementSibling : it.nextElementSibling;
          if (!vecino || !vecino.classList.contains('eq-item')) return;
          const orden = [...lista.querySelectorAll('.eq-item')].map(x => x.dataset.id);
          const i = orden.indexOf(id), j = orden.indexOf(vecino.dataset.id);
          [orden[i], orden[j]] = [orden[j], orden[i]];
          b.disabled = true;
          for (let k = 0; k < orden.length; k++) {
            const p = (data.equipo || []).find(x => String(x.id) === orden[k]);
            if (p && +p.orden !== k + 1) await API.admin('update', { password, sheet: 'equipo', item: { id: orden[k], orden: k + 1 } });
          }
          await recargar();
        }
      } catch (err) { toast(err.message, 'err'); b.disabled = false; }
    });
  }


  function vistaPanel() {
    UI.ajustes(data); // suma los edificios agregados en Ajustes a las listas
    const S = SECCIONES[seccion];
    const lista = (data[seccion] || []).slice().reverse();
    const cuerpo = seccion === 'ajustes' ? formAjustes() : seccion === 'instagram' ? vistaInstagram()
      : seccion === 'reunion' ? formReunion() : seccion === 'destacados' ? vistaDestacados() : seccion === 'institucional' ? vistaInstitucional() : `
      <div class="grid ${seccion === 'destacados' ? 'una-col' : ''}">
        <div class="panel ${editando ? 'editando' : ''}"><h2>${editando ? '✏️ Editar publicación' : 'Agregar'}</h2>
          <form id="f-add">${S.form}<button class="btn">${editando ? '💾 Guardar cambios' : 'Publicar'}</button>
          ${editando ? '<button type="button" class="btn ghost" id="cancelar-edicion">Cancelar</button>' : ''}</form></div>
        <div class="panel"><h2>Publicado (${lista.length})</h2>
          <div class="items">${lista.map(it => {
            const [t, sub] = S.linea(it);
            return `<div class="item">${S.img && S.img(it) ? `<img src="${esc(S.img(it))}" alt="">` : ''}${S.ico ? UI.icono(S.ico(it), 'lista-ico') : ''}
              <div class="t"><b>${esc(t)}</b><small>${esc(sub)}${it.espacio && UI.ESPACIOS[it.espacio]
                ? ' · solo ' + esc(UI.ESPACIOS[it.espacio].nombre) : ''}</small></div>
              <button class="edit" data-id="${esc(it.id)}">✏️ Editar</button>
              <button class="del" data-id="${esc(it.id)}">Eliminar</button>
              ${S.extra ? S.extra(it) : ''}</div>`;
          }).join('') || '<p class="note">Nada publicado aún.</p>'}</div>
        </div>
      </div>`;
    app.innerHTML = `
      <div class="top">
        <img src="insignia.png" alt="Escudo">
        <div><h1>Panel Administrador</h1><p>${esc(CFG.NOMBRE)}</p></div>
        <div class="right">
          <a class="btn ghost" href="funcionarios.html" target="_blank">Ver Funcionarios</a>
          <a class="btn ghost" href="familias.html" target="_blank">Ver Familias</a>
          <button class="btn ghost" id="salir">Salir</button>
        </div>
      </div>
      <div class="nav">${Object.keys(SECCIONES).filter(k => !SECCIONES[k].soloSiHay || (data[k] || []).length).map(k =>
        `<button data-k="${k}" class="${k === seccion ? 'on' : ''}">${SECCIONES[k].nombre}</button>`).join('')}</div>
      ${cuerpo}`;

    // los edificios agregados también se pueden elegir como "Espacio" de cada publicación
    app.querySelectorAll('select[name="espacio"]').forEach(s => Object.entries(UI.ESPACIOS).filter(([, e]) => e.extra)
      .forEach(([id, e]) => { if (![...s.options].some(o => o.value === id)) s.add(new Option(e.nombre, id)); }));
    app.querySelectorAll('.nav button').forEach(b => (b.onclick = () => { seccion = b.dataset.k; editando = null; vistaPanel(); }));
    document.getElementById('salir').onclick = () => {
      try { sessionStorage.removeItem(PASS_KEY); } catch (e) {}
      password = '';
      vistaLogin();
    };

    if (['fotos', 'musica', 'noticias'].includes(seccion)) revisarPublicadosYt();

    if (seccion === 'instagram') {
      iniciarInstagram();
      return;
    }
    if (seccion === 'reunion') {
      iniciarReunion();
      return;
    }
    if (seccion === 'destacados') {
      iniciarDestacados();
      return;
    }
    if (seccion === 'institucional') {
      iniciarInstitucional();
      return;
    }

    if (seccion === 'ajustes') {
      iniciarClave();
      const fa = document.getElementById('f-ajustes');
      iniciarTema(fa);
      document.getElementById('probar-cumple').onclick = e => { e.target.disabled = true; UI.melodiaCumple().then(() => (e.target.disabled = false)); };
      const edFilas = document.getElementById('ed-filas');
      document.getElementById('ed-agregar').onclick = () => {
        edFilas.insertAdjacentHTML('beforeend', filaEdificio({}));
        edFilas.lastElementChild.querySelector('input').focus();
      };
      edFilas.onclick = e => {
        if (!e.target.classList.contains('tel-quitar')) return;
        if (e.target.closest('.ed-fila').dataset.id && !confirm('¿Quitar este edificio? En los TV que lo tengan elegido habrá que elegir otro espacio.')) return;
        e.target.closest('.ed-fila').remove();
      };
      const filas = document.getElementById('tel-filas');
      // agregar / quitar filas de teléfono
      document.getElementById('tel-agregar').onclick = () => filas.insertAdjacentHTML('beforeend', filaTel({}));
      filas.onclick = e => {
        if (!e.target.classList.contains('tel-quitar')) return;
        e.target.closest('.tel-fila').remove();
        if (!filas.children.length) filas.insertAdjacentHTML('beforeend', filaTel({}));
      };
      fa.onsubmit = async e => {
        e.preventDefault();
        const btn = fa.querySelector('button[type=submit], .btn:not(.ghost)');
        const valores = {};
        new FormData(fa).forEach((v, k) => (valores[k] = String(v).trim()));
        // teléfonos: lista ordenada (se guardan solo las filas con número)
        valores.telefonos = JSON.stringify([...filas.querySelectorAll('.tel-fila')].map(f => {
          const o = {};
          f.querySelectorAll('[data-campo]').forEach(c => (o[c.dataset.campo] = c.value.trim()));
          return o;
        }).filter(t => t.numero));
        // colores y fondo
        valores.tema = JSON.stringify(temaDelForm());
        // los campos del editor de colores no son ajustes sueltos
        Object.keys(valores).filter(k => /^(tema|img)[A-Z]/.test(k)).forEach(k => delete valores[k]);
        const sinImg = Object.values(temaDelForm()).find(t => t && t.fondo === 'imagen' && !t.img);
        if (sinImg) { toast('Eligió "Imagen propia" pero falta elegir o subir la imagen', 'err'); return; }
        // edificios agregados (cada uno con un id fijo, ej. "edanexo")
        const usados = new Set(Object.keys(UI.ESPACIOS).concat(Object.keys(UI.EDIFICIOS)));
        valores.edificios = JSON.stringify([...edFilas.querySelectorAll('.ed-fila')].map(f => {
          const nombre = f.querySelector('[data-campo="nombre"]').value.trim();
          let id = f.dataset.id;
          if (!id && nombre) {
            const base = 'ed' + nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^edificio\s+/, '').replace(/[^a-z0-9]+/g, '').slice(0, 14);
            id = base; let n = 2;
            while (usados.has(id)) id = base + n++;
            usados.add(id);
          }
          return { id, nombre, ico: f.querySelector('[data-campo="ico"]').value };
        }).filter(e => e.nombre));
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        try {
          await API.admin('ajustes', { password, valores });
          toast('Ajustes guardados ✔');
          await recargar();
        } catch (err) {
          toast(err.message, 'err');
          btn.disabled = false;
          btn.textContent = 'Guardar ajustes';
        }
      };
      return;
    }

    const form = document.getElementById('f-add');
    form.querySelectorAll('.icon-picker button').forEach(b => (b.onclick = () => {
      form.querySelectorAll('.icon-picker button').forEach(x => x.classList.toggle('on', x === b));
      form.elements.icono.value = b.dataset.ico;
    }));
    const file = form.querySelector('input[type=file]');
    const preview = document.getElementById('preview');
    const tipo = form.elements.tipo;
    if (file && preview) file.onchange = () => {
      if (!file.files.length) return;
      preview.src = URL.createObjectURL(file.files[0]);
      preview.hidden = false;
      const n = form.querySelector('.cuantas');
      if (n) n.textContent = file.files.length > 1 ? `${file.files.length} fotos seleccionadas · se publicarán con el mismo título` : '';
    };
    if (tipo) {
      // mostrar los campos que corresponden al tipo elegido
      tipo.onchange = () => {
        form.querySelectorAll('[data-tipo]').forEach(el => (el.hidden = el.dataset.tipo !== tipo.value));
        if (preview) preview.hidden = true;
      };
    }
    // vista previa de un enlace de YouTube (Fotos y videos, Educación)
    if (preview && form.elements.url) form.elements.url.oninput = () => {
      const id = UI.youtubeId(form.elements.url.value);
      preview.hidden = !id;
      if (id) preview.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    };

    if (editando) cargarEdicion(form, editando);
    app.querySelectorAll('.edit').forEach(b => (b.onclick = () => {
      editando = (data[seccion] || []).find(x => String(x.id) === b.dataset.id) || null;
      vistaPanel();
      app.querySelector('.panel.editando')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    const cancelar = document.getElementById('cancelar-edicion');
    if (cancelar) cancelar.onclick = () => { editando = null; vistaPanel(); };

    form.onsubmit = async e => {
      e.preventDefault();
      if (editando) return guardarEdicion(form);
      const btn = form.querySelector('.btn');
      try {
        const item = {};
        new FormData(form).forEach((v, k) => { if (k !== 'imagen' && k !== 'tipo') item[k] = v; });
        const t = tipo ? tipo.value : null;
        // historia: vence 24 h después de publicarla
        if (item.historia === 'si' && t === 'imagen') item.vence = new Date(Date.now() + 864e5).toISOString();
        delete item.historia;
        if (seccion === 'fechas' && item.fechaFin && item.fechaFin < item.fecha) {
          throw new Error('La fecha "Hasta" debe ser igual o posterior a "Desde"');
        }
        if (t === 'video') {
          const id = UI.youtubeId(item.url);
          if (!id) throw new Error('El enlace no parece ser un video de YouTube');
          item.url = 'https://www.youtube.com/watch?v=' + id;
          item.audio = item.audio === 'si' ? 'si' : 'no';
          item.audioFunc = item.audioFunc === 'si' ? 'si' : 'no';
        } else if (seccion === 'noticias') {
          // Educación: texto y/o video. Si el enlace se pegó en el texto, se mueve a su campo.
          if (!item.url && UI.youtubeId(item.texto)) {
            item.url = UI.enlaceVideo(item);
            item.texto = UI.textoLimpio(item);
          }
          if (item.url) {
            const id = UI.youtubeId(item.url);
            if (!id) throw new Error('El enlace no parece ser un video de YouTube');
            item.url = 'https://www.youtube.com/watch?v=' + id;
            item.audio = item.audio === 'si' ? 'si' : 'no';
            item.audioFunc = item.audioFunc === 'si' ? 'si' : 'no';
          } else {
            if (!item.texto) throw new Error('Escriba un texto o agregue un video');
            delete item.audio;
            delete item.audioFunc;
            delete item.vecesAudio;
          }
        } else if (t === 'enlace') {
          if (!/^https?:\/\//.test(item.url || '')) throw new Error('Escriba un enlace que empiece con https://');
        } else if (t) {
          delete item.url;
          delete item.audio;
          delete item.audioFunc;
            delete item.vecesAudio;
          if (!file.files[0]) throw new Error('Seleccione un archivo');
        }
        const f = file && (t === 'imagen' || t === 'archivo') ? file.files[0] : null;
        if (f && seccion === 'musica' && f.size > MAX_AUDIO_MB * 1024 * 1024) throw new Error(`El archivo supera ${MAX_AUDIO_MB} MB`);
        btn.disabled = true;
        // ¿YouTube deja reproducir este video fuera de su sitio? (si no, en las pantallas no se verá ni sonará)
        const ytId = (t === 'video' || t === 'enlace' || seccion === 'noticias') && UI.youtubeId(item.url);
        if (ytId) {
          btn.textContent = 'Revisando el video en YouTube…';
          if (await youtubeInsertable(ytId) === false) throw new Error(MSG_YT_BLOQUEADO);
        }
        if (f && t === 'imagen') {
          // varias fotos con el mismo título: una publicación por foto
          const fotos = [...file.files];
          for (let k = 0; k < fotos.length; k++) {
            btn.textContent = `Subiendo foto ${k + 1} de ${fotos.length}…`;
            const image = { data: await comprimir(fotos[k]), mimeType: 'image/jpeg', name: fotos[k].name.replace(/\.\w+$/, '') + '.jpg' };
            await API.admin('add', { password, sheet: seccion, item: Object.assign({}, item), image });
          }
          toast(fotos.length > 1 ? `${fotos.length} fotos publicadas ✔` : 'Publicado ✔');
          await recargar();
          return;
        }
        let image = null;
        if (f) {
          // canción MP3: se sube por partes (sirve para archivos grandes)
          const fileId = await API.subirArchivo(password, f, p => (btn.textContent = `Subiendo música… ${Math.round(p * 100)}%`));
          image = { fileId, mimeType: f.type || 'audio/mpeg' };
        }
        btn.textContent = 'Publicando…';
        await API.admin('add', { password, sheet: seccion, item, image });
        toast('Publicado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = 'Publicar';
      }
    };

    app.querySelectorAll('.cat-sel').forEach(s => (s.onchange = async () => {
      s.disabled = true;
      try {
        await API.admin('update', { password, sheet: seccion, item: { id: s.dataset.id, categoria: s.value } });
        toast('Categoría actualizada ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        s.disabled = false;
      }
    }));

    app.querySelectorAll('.veces-sel').forEach(s => (s.onchange = async () => {
      s.disabled = true;
      try {
        await API.admin('update', { password, sheet: seccion, item: { id: s.dataset.id, vecesAudio: s.value } });
        toast('Actualizado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        s.disabled = false;
      }
    }));

    app.querySelectorAll('.toggle').forEach(b => (b.onclick = async () => {
      b.disabled = true;
      try {
        await API.admin('update', { password, sheet: seccion, item: { id: b.dataset.id, [b.dataset.campo]: b.dataset.valor } });
        toast('Actualizado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        b.disabled = false;
      }
    }));

    app.querySelectorAll('.del').forEach(b => (b.onclick = async () => {
      if (!confirm('¿Eliminar este elemento?')) return;
      b.disabled = true;
      try {
        await API.admin('delete', { password, sheet: seccion, id: b.dataset.id });
        toast('Eliminado');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        b.disabled = false;
      }
    }));
  }

  if (password && CFG.API_URL) recargar().catch(() => vistaLogin());
  else vistaLogin();
})();
