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

  const PUBLICO = `<label>Mostrar a
    <select name="publico"><option value="ambos">Funcionarios y familias</option>
    <option value="funcionarios">Solo funcionarios</option><option value="familias">Solo familias</option></select></label>`;

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

  // Fila "Sonido" editable de cada video ya publicado
  const filaSonido = f => {
    if (!UI.youtubeId(f.url)) return '';
    const fam = f.audio !== 'no';
    const fun = f.audioFunc === 'si';
    return `<div class="sonido-fila">
      <span class="sf-tit">🔊 Sonido:</span>
      <button class="toggle ${fam ? 'on' : ''}" data-id="${esc(f.id)}" data-campo="audio" data-valor="${fam ? 'no' : 'si'}">${fam ? '🔊' : '🔇'} Familias</button>
      <button class="toggle ${fun ? 'on' : ''}" data-id="${esc(f.id)}" data-campo="audioFunc" data-valor="${fun ? 'no' : 'si'}">${fun ? '🔊' : '🔇'} Funcionarios</button>
      <label class="sf-veces">🔁 <select class="veces-sel" data-id="${esc(f.id)}">${opcionesVeces(f.vecesAudio)}</select></label>
    </div>`;
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
        <label>Lugar<input name="lugar"></label>${selectorIconos('📅')}${PUBLICO}`,
      linea: a => [a.titulo, `${a.fecha} ${a.hora || ''} · ${a.lugar || ''} · ${a.publico}`],
      ico: a => a.icono || '📅',
    },
    fotos: {
      nombre: '📸 Fotos y videos',
      form: `<label>Título / actividad<input name="titulo" required></label>
        <label>Tipo
          <select name="tipo"><option value="imagen">📷 Imagen</option><option value="video">▶️ Video de YouTube</option></select></label>
        <label data-tipo="imagen">Imágenes (puede elegir varias a la vez con Ctrl)<input type="file" name="imagen" accept="image/*" multiple></label>
        <p class="note cuantas" data-tipo="imagen" style="color:var(--gold)"></p>
        <label data-tipo="video" hidden>Enlace de YouTube<input name="url" placeholder="https://www.youtube.com/watch?v=..."></label>
        <img class="preview" id="preview" hidden alt="">
        ${SONIDO('data-tipo="video" hidden')}
        ${PUBLICO}
        <p class="note" data-tipo="imagen">La imagen se reduce automáticamente a 1920 px antes de subirla a Google Drive.</p>
        <p class="note" data-tipo="video" hidden>El video se reproduce completo y luego pasa al siguiente elemento del carrusel.
        Debe ser público o "no listado" y permitir insertarse en otros sitios.</p>`,
      linea: f => [(UI.youtubeId(f.url) ? '▶ ' : '') + f.titulo, f.publico],
      img: f => (UI.youtubeId(f.url) ? `https://img.youtube.com/vi/${UI.youtubeId(f.url)}/mqdefault.jpg` : f.url),
      // botones para cambiar el sonido de un video ya publicado, por perfil
      extra: filaSonido,
    },
    musica: {
      nombre: '🎵 Música Familias',
      form: `<label>Nombre de la canción<input name="titulo" required></label>
        <label>Origen
          <select name="tipo"><option value="enlace">▶️ YouTube (video o lista de reproducción)</option><option value="archivo">📁 Subir archivo MP3</option></select></label>
        <label data-tipo="enlace">Enlace de YouTube o de un .mp3<input name="url" placeholder="https://www.youtube.com/watch?v=...&list=... · https://youtu.be/..."></label>
        <label data-tipo="archivo" hidden>Archivo de audio (máx. 20 MB)<input type="file" name="imagen" accept="audio/*"></label>
        <p class="note">Suena de fondo en la pantalla Familias y baja de volumen cuando aparece un video con sonido.
        Si pega una <b>lista de reproducción</b> de YouTube, se reproduce completa en orden aleatorio.
        Use música libre de derechos o con autorización.</p>`,
      linea: m => [(/youtu/.test(m.url) ? '▶ ' : '🎵 ') + m.titulo,
        m.fileId ? 'Archivo en Google Drive' : (/[?&]list=/.test(m.url) ? 'Lista de YouTube · ' : '') + m.url],
    },
    noticias: {
      nombre: '📚 Educación',
      form: `<label>Título<input name="titulo" required></label>
        <label>Texto<textarea name="texto" maxlength="280" placeholder="Breve descripción (opcional si agrega un video)"></textarea></label>
        <label>Video de YouTube · experiencia educativa (opcional)<input name="url" placeholder="Pegue aquí el enlace (botón Compartir → Copiar): https://youtu.be/..."></label>
        <img class="preview" id="preview" hidden alt="">
        ${SONIDO()}
        ${PUBLICO}
        <p class="note">El video se reproduce completo en el recuadro de Educación (Funcionarios y Familias).</p>`,
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
        ${selectorIconos('📅')}`,
      linea: f => [f.titulo, `${f.fecha}${f.hora ? ' ' + f.hora : ''}${f.fechaFin ? ' → ' + f.fechaFin + (f.horaFin ? ' ' + f.horaFin : '') : ''} · ${f.descripcion || ''}`],
      ico: f => f.icono || '📅',
    },
    avisos: {
      nombre: '📢 Avisos (cinta)',
      form: `<label>Texto del aviso<input name="texto" required maxlength="140"></label>${PUBLICO}`,
      linea: a => [a.texto, a.publico],
    },
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

  // Reduce imagen a máx. 1920px y devuelve base64 JPEG
  function comprimir(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 1920;
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
        <a href="index.html" class="note">← Volver al inicio</a>
      </form></div>`;
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

  // Ajustes generales: mensaje para las familias y segundos de las fotos
  function formAjustes() {
    const a = UI.ajustes(data);
    return `<div class="panel" style="max-width:720px">
      <h2>⚙️ Ajustes de las pantallas</h2>
      <form id="f-ajustes">
        <label>Mensaje para las familias<textarea name="mensajeTexto" maxlength="280">${esc(a.mensajeTexto)}</textarea></label>
        <p class="note">Aparece en el recuadro amarillo de la pantalla Familias (rota junto a las publicaciones de Educación).
        Déjelo vacío para no mostrarlo.</p>
        <label>Segundos que se ve cada foto · Familias<input type="number" name="segFotosFamilias" min="3" max="120" value="${esc(a.segFotosFamilias)}"></label>
        <label>Segundos que se ve cada foto · Funcionarios<input type="number" name="segFotosFuncionarios" min="3" max="120" value="${esc(a.segFotosFuncionarios)}"></label>
        <p class="note">Los videos siempre se muestran completos.</p>
        <label>Velocidad de la cinta de avisos (abajo)
          <select name="velocidadAvisos">${[['lenta', '🐢 Lenta'], ['normal', 'Normal'], ['rapida', '🐇 Rápida']]
            .map(([v, t]) => `<option value="${v}" ${a.velocidadAvisos === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <button class="btn">Guardar ajustes</button>
      </form></div>`;
  }

  function vistaPanel() {
    const S = SECCIONES[seccion];
    const lista = (data[seccion] || []).slice().reverse();
    const cuerpo = seccion === 'ajustes' ? formAjustes() : `
      <div class="grid">
        <div class="panel"><h2>Agregar</h2><form id="f-add">${S.form}<button class="btn">Publicar</button></form></div>
        <div class="panel"><h2>Publicado (${lista.length})</h2>
          <div class="items">${lista.map(it => {
            const [t, sub] = S.linea(it);
            return `<div class="item">${S.img && S.img(it) ? `<img src="${esc(S.img(it))}" alt="">` : ''}${S.ico ? UI.icono(S.ico(it), 'lista-ico') : ''}
              <div class="t"><b>${esc(t)}</b><small>${esc(sub)}</small></div>
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
      <div class="nav">${Object.keys(SECCIONES).map(k =>
        `<button data-k="${k}" class="${k === seccion ? 'on' : ''}">${SECCIONES[k].nombre}</button>`).join('')}</div>
      ${cuerpo}`;

    app.querySelectorAll('.nav button').forEach(b => (b.onclick = () => { seccion = b.dataset.k; vistaPanel(); }));
    document.getElementById('salir').onclick = () => {
      try { sessionStorage.removeItem(PASS_KEY); } catch (e) {}
      password = '';
      vistaLogin();
    };

    if (seccion === 'ajustes') {
      const fa = document.getElementById('f-ajustes');
      fa.onsubmit = async e => {
        e.preventDefault();
        const btn = fa.querySelector('.btn');
        const valores = {};
        new FormData(fa).forEach((v, k) => (valores[k] = String(v).trim()));
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

    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('.btn');
      try {
        const item = {};
        new FormData(form).forEach((v, k) => { if (k !== 'imagen' && k !== 'tipo') item[k] = v; });
        const t = tipo ? tipo.value : null;
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
        if (f && seccion === 'musica' && f.size > 20 * 1024 * 1024) throw new Error('El archivo supera 20 MB');
        btn.disabled = true;
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
        btn.textContent = f && seccion === 'musica' ? 'Subiendo música… (puede tardar)' : 'Publicando…';
        let image = null;
        if (f) image = { data: await aBase64(f), mimeType: f.type || 'audio/mpeg', name: f.name };
        await API.admin('add', { password, sheet: seccion, item, image });
        toast('Publicado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = 'Publicar';
      }
    };

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
