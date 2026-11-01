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

  // Definición de cada sección del panel
  const SECCIONES = {
    actividades: {
      nombre: '📅 Actividades',
      form: `<label>Título<input name="titulo" required></label>
        <label>Descripción<textarea name="descripcion"></textarea></label>
        <label>Fecha<input type="date" name="fecha" required></label>
        <label>Hora<input type="time" name="hora"></label>
        <label>Lugar<input name="lugar"></label>${PUBLICO}`,
      linea: a => [a.titulo, `${a.fecha} ${a.hora || ''} · ${a.lugar || ''} · ${a.publico}`],
    },
    fotos: {
      nombre: '📸 Fotografías',
      form: `<label>Título / actividad<input name="titulo" required></label>
        <label>Imagen<input type="file" name="imagen" accept="image/*" required></label>
        <img class="preview" id="preview" hidden alt="">${PUBLICO}
        <p class="note">La imagen se reduce automáticamente a 1920 px antes de subirla a Google Drive.</p>`,
      linea: f => [f.titulo, f.publico],
      img: f => f.url,
    },
    noticias: {
      nombre: '📚 Educación',
      form: `<label>Título<input name="titulo" required></label>
        <label>Texto<textarea name="texto" required maxlength="280"></textarea></label>${PUBLICO}`,
      linea: n => [n.titulo, n.publico + ' · ' + String(n.texto).slice(0, 80)],
    },
    fechas: {
      nombre: '🗓️ Fechas familias',
      form: `<label>Título<input name="titulo" required></label>
        <label>Fecha<input type="date" name="fecha" required></label>
        <label>Detalle<input name="descripcion" placeholder="Ej: 19:00 hrs en cada sala"></label>
        <label>Ícono (emoji)<input name="icono" placeholder="🎉" maxlength="4"></label>`,
      linea: f => [`${f.icono || '📅'} ${f.titulo}`, `${f.fecha} · ${f.descripcion || ''}`],
    },
    avisos: {
      nombre: '📢 Avisos (cinta)',
      form: `<label>Texto del aviso<input name="texto" required maxlength="140"></label>${PUBLICO}`,
      linea: a => [a.texto, a.publico],
    },
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
      <img src="assets/insignia.png" alt="Escudo">
      <h2>Panel Administrador</h2>
      ${!CFG.API_URL ? '<div class="warn note">Falta configurar <b>API_URL</b> en <code>js/config.js</code>. Vea el README.</div>' : ''}
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

  function vistaPanel() {
    const S = SECCIONES[seccion];
    const lista = (data[seccion] || []).slice().reverse();
    app.innerHTML = `
      <div class="top">
        <img src="assets/insignia.png" alt="Escudo">
        <div><h1>Panel Administrador</h1><p>${esc(CFG.NOMBRE)}</p></div>
        <div class="right">
          <a class="btn ghost" href="funcionarios.html" target="_blank">Ver Funcionarios</a>
          <a class="btn ghost" href="familias.html" target="_blank">Ver Familias</a>
          <button class="btn ghost" id="salir">Salir</button>
        </div>
      </div>
      <div class="nav">${Object.keys(SECCIONES).map(k =>
        `<button data-k="${k}" class="${k === seccion ? 'on' : ''}">${SECCIONES[k].nombre}</button>`).join('')}</div>
      <div class="grid">
        <div class="panel"><h2>Agregar</h2><form id="f-add">${S.form}<button class="btn">Publicar</button></form></div>
        <div class="panel"><h2>Publicado (${lista.length})</h2>
          <div class="items">${lista.map(it => {
            const [t, sub] = S.linea(it);
            return `<div class="item">${S.img ? `<img src="${esc(S.img(it))}" alt="">` : ''}
              <div class="t"><b>${esc(t)}</b><small>${esc(sub)}</small></div>
              <button class="del" data-id="${esc(it.id)}">Eliminar</button></div>`;
          }).join('') || '<p class="note">Nada publicado aún.</p>'}</div>
        </div>
      </div>`;

    app.querySelectorAll('.nav button').forEach(b => (b.onclick = () => { seccion = b.dataset.k; vistaPanel(); }));
    document.getElementById('salir').onclick = () => {
      try { sessionStorage.removeItem(PASS_KEY); } catch (e) {}
      password = '';
      vistaLogin();
    };

    const form = document.getElementById('f-add');
    const file = form.querySelector('input[type=file]');
    if (file) file.onchange = () => {
      const p = document.getElementById('preview');
      p.src = URL.createObjectURL(file.files[0]);
      p.hidden = false;
    };

    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('.btn');
      btn.disabled = true;
      btn.textContent = 'Publicando…';
      try {
        const item = {};
        new FormData(form).forEach((v, k) => { if (k !== 'imagen') item[k] = v; });
        let image = null;
        if (file && file.files[0]) image = { data: await comprimir(file.files[0]), mimeType: 'image/jpeg', name: file.files[0].name.replace(/\.\w+$/, '') + '.jpg' };
        await API.admin('add', { password, sheet: seccion, item, image });
        toast('Publicado ✔');
        await recargar();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.textContent = 'Publicar';
      }
    };

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
