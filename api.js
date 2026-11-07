// Acceso a datos (Apps Script) con caché local y datos de demostración.
(function () {
  const CFG = window.APP_CONFIG;
  const CACHE_KEY = 'cmch_tv_data';

  function hoyMas(d) {
    const t = new Date();
    t.setDate(t.getDate() + d);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  const DEMO = {
    actividades: [
      { id: 'a1', titulo: 'Consejo de profesores', descripcion: 'Análisis de resultados del semestre y planificación.', fecha: hoyMas(0), hora: '16:00', lugar: 'Sala de profesores', publico: 'funcionarios', icono: 'insignia' },
      { id: 'a2', titulo: 'Capacitación PIE', descripcion: 'Estrategias DUA para el aula.', fecha: hoyMas(1), hora: '15:30', lugar: 'Biblioteca CRA', publico: 'funcionarios' },
      { id: 'a3', titulo: 'Simulacro de evacuación', descripcion: 'Participa toda la comunidad educativa.', fecha: hoyMas(2), hora: '10:00', lugar: 'Todo el colegio', publico: 'ambos', importante: 'si' },
      { id: 'a4', titulo: 'Reunión de apoderados', descripcion: 'Entrega de informes de notas parciales.', fecha: hoyMas(3), hora: '19:00', lugar: 'Salas de clases', publico: 'ambos' },
      { id: 'a6', titulo: 'Jornada de reflexión', descripcion: 'Proyecto educativo institucional.', fecha: hoyMas(5), hora: '09:00', lugar: 'Gimnasio', publico: 'funcionarios', icono: '🤝' },
      { id: 'a7', titulo: 'Entrega de planificaciones', descripcion: 'Plazo para unidad 4.', fecha: hoyMas(6), hora: '13:00', lugar: 'UTP', publico: 'funcionarios', icono: '📝' },
      { id: 'a5', titulo: 'Desayuno de funcionarios', descripcion: 'Celebración de cumpleaños del mes.', fecha: hoyMas(4), hora: '08:00', lugar: 'Comedor', publico: 'funcionarios' },
    ],
    fotos: [
      { id: 'f9', titulo: 'Feria del libro', url: 'https://picsum.photos/seed/marina9/1080/1350', publico: 'ambos', origen: 'instagram',
        texto: '📚 ¡Así vivimos nuestra Feria del Libro 2026! 🎉\nNuestros estudiantes compartieron lecturas, cuentacuentos y mucha creatividad.\nGracias a las familias que nos acompañaron 💙 #ColegioMarinaDeChile #Lectura' },
      { id: 'f7', titulo: 'Reel de ejemplo', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', publico: 'ambos',
        formato: 'video', origen: 'instagram', audio: 'si', texto: '🌼 Así celebramos la primavera en nuestro colegio. ¡Gracias a todos los que participaron! 💙' },
      { id: 'f8', titulo: 'Feria científica', url: 'https://www.instagram.com/p/DfIf20tgQNx/', publico: 'ambos', origen: 'instagram',
        texto: '🔬 Nuestros estudiantes presentaron sus proyectos en la Feria de Andalién Sur. ¡Felicitaciones a todo el equipo! 💙' },
      { id: 'f0', titulo: 'Video de ejemplo', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', publico: 'ambos', audio: 'si', audioFunc: 'no' },
      { id: 'f1', titulo: 'Feria científica 2026', url: 'https://picsum.photos/seed/marina1/1280/720', publico: 'ambos' },
      { id: 'f5', titulo: 'Taller de lectura compartida', url: 'https://picsum.photos/seed/marina5/1280/720', publico: 'ambos', categoria: 'educacion' },
      { id: 'f2', titulo: 'Día del Profesor', url: 'https://picsum.photos/seed/marina2/1280/720', publico: 'funcionarios' },
      { id: 'f3', titulo: 'Acto de Glorias Navales', url: 'https://picsum.photos/seed/marina3/1280/720', publico: 'ambos' },
      { id: 'f4', titulo: 'Salida pedagógica 4° básico', url: 'https://picsum.photos/seed/marina4/1280/720', publico: 'familias' },
    ],
    noticias: [
      { id: 'n1', titulo: 'Evaluación formativa', texto: 'La retroalimentación oportuna mejora el aprendizaje hasta en un 30%. Compartamos criterios de logro al inicio de cada clase.', publico: 'funcionarios' },
      { id: 'n4', titulo: 'Experiencia: aprendizaje basado en proyectos', texto: 'Mire esta experiencia https://youtu.be/aqz-KE-bpKQ?si=abc123', url: '', publico: 'ambos', audio: '', audioFunc: '', vecesAudio: '3' },
      { id: 'n2', titulo: 'Bienestar docente', texto: 'Recuerda tomar pausas activas. El autocuidado también es parte de nuestra labor educativa.', publico: 'funcionarios' },
      { id: 'n3', titulo: 'Lectura en familia', texto: '15 minutos diarios de lectura compartida fortalecen el vocabulario y el vínculo familiar.', publico: 'familias' },
    ],
    // ?demo=1&reunion=1 muestra el modo reunión de apoderados de ejemplo
    ajustesReunion: [
      // ejemplo real: Básica = 18 cursos en 3 edificios (un curso sin reunión y otro cambiado de día)
      { id: 'salas', valor: JSON.stringify(
        [['prebasica', 'Pre-Kínder', ''], ['prebasica', 'Kínder', '']]
          .concat([1, 2, 3, 4, 5, 6, 7, 8].map(n => ['menor', String(n), n <= 4 ? '1' : '2']))
          .concat([11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34].map(n => ['matriz', String(n), String(n)[0]]))
          .map(([edificio, sala, piso]) => ({ edificio, sala, piso }))) },
      { id: 'reuniones', valor: JSON.stringify([
        { id: 'r1', nombre: 'Básica', activo: 'si', fecha: hoyMas(0), titulo: 'Hoy', horas: { prebasica: '17:30', menor: '18:00', matriz: '19:00' },
          previas: [{ para: 'menor', lugar: 'Hall Ciclo Menor', hora: '17:30', tema: 'Bienvenida del ciclo' },
            { para: 'basica', lugar: 'Gimnasio', hora: '18:30', tema: 'Charla de seguridad escolar', institucion: 'Carabineros de Chile' }], cursos:
          [{ curso: 'Pre-Kínder', edificio: 'prebasica', sala: 'Pre-Kínder' }, { curso: 'Kínder', edificio: 'prebasica', sala: 'Kínder' }]
            .concat([1, 2, 3, 4].flatMap((n, k) => ['A', 'B'].map((l, j) => ({ curso: `${n}° Básico ${l}`, edificio: 'menor', sala: String(k * 2 + j + 1) }))))
            .concat([5, 6, 7, 8].flatMap((n, k) => ['A', 'B'].map((l, j) => ({ curso: `${n}° Básico ${l}`, edificio: 'matriz', sala: String([11, 12, 13, 14, 21, 22, 23, 24][k * 2 + j]) }))))
            .map(c => (c.curso === '3° Básico B' ? Object.assign(c, { estado: 'sin' })
              : c.curso === '6° Básico A' ? Object.assign(c, { estado: 'cambio', cambio: 'jueves 6 nov · 19:00' }) : c)) },
        { id: 'r2', nombre: 'Media', activo: 'si', fecha: hoyMas(7), titulo: 'Martes 11 de noviembre', horas: { matriz: '19:00' }, cursos:
          [1, 2, 3, 4].flatMap((n, k) => ['A', 'B', 'C'].map((l, j) => ({ curso: `${n}° Medio ${l}`, edificio: 'matriz', sala: String([21, 22, 23, 24, 31, 32, 33, 34, 11, 12, 13, 14][k * 3 + j]) }))) },
      ]) },
    ],
    // ⭐ alumnos destacados (5 subidos juntos → pasan de a 3) y 🏆 un curso destacado
    destacados: [
      ['Martina Soto', '3° Básico A'], ['Benjamín Rojas', '5° Básico B'], ['Isidora Muñoz', '7° Básico A'],
      ['Tomás Fuentes', '1° Medio C'], ['Josefa Contreras', '4° Medio B'],
    ].map(([nombre, curso], k) => ({ id: 'e' + k, tipo: 'alumno', nombre, curso, grupo: 'g1', publico: 'ambos',
      motivo: k === 3 ? 'Primer lugar comunal de ajedrez' : 'Excelencia académica del semestre',
      url: `https://picsum.photos/seed/alumno${k}/600/600` }))
      .concat([{ id: 'p1', tipo: 'apoderado', nombre: 'Carolina Pérez', curso: 'Apoderada de 2° Básico B', publico: 'ambos',
        motivo: 'Por su compromiso con la directiva del curso', url: 'https://picsum.photos/seed/apod1/600/600' },
      { id: 'u1', tipo: 'funcionario', nombre: 'Jorge Lagos', curso: 'Inspector', publico: 'ambos',
        motivo: '25 años de servicio en el colegio', url: 'https://picsum.photos/seed/func1/600/600' }])
      .concat([{ id: 'gf1', tipo: 'grupo_funcionario', nombre: 'Equipo de Inspectoría', publico: 'funcionarios',
        motivo: 'Por su gran trabajo en la Fiesta de la Chilenidad', url: 'https://picsum.photos/seed/equipo1/1280/860' }])
      .concat([{ id: 'c1', tipo: 'curso', curso: '6° Básico B', publico: 'ambos', url: 'https://picsum.photos/seed/curso6b/1280/860',
        motivo: '🏆 Mejor asistencia del mes de octubre (98 %). ¡Felicitaciones a los estudiantes y sus familias!' }]),
    fondos: [{ id: 'fo1', nombre: 'Bahía', url: 'https://picsum.photos/seed/bahiaconce/1920/1080' }],
    // 🎂 cumpleaños de ejemplo: hoy (se ve en Funcionarios)
    cumpleanos: [
      { id: 'b1', nombre: 'María José Pérez', fecha: '1990-' + hoyMas(0).slice(5), cargo: 'Profesora de Lenguaje', mensaje: '' },
      { id: 'b2', nombre: 'Pedro Soto', fecha: '1985-' + hoyMas(0).slice(5), cargo: 'Auxiliar', mensaje: '¡Gracias por cuidar cada rincón del colegio! Que tengas un gran día 🎉' },
    ],
    historias: [
      { id: 'h1', url: 'https://picsum.photos/seed/marinah1/1080/1920', fecha: new Date(Date.now() - 3 * 3600e3).toISOString(),
        vence: new Date(Date.now() + 21 * 3600e3).toISOString() },
    ],
    fechas: [
      { id: 'd1', titulo: 'Reunión de apoderados', fecha: hoyMas(3), descripcion: '19:00 hrs en cada sala', icono: 'insignia' },
      { id: 'd5', titulo: 'Completar ficha de matrícula', fecha: hoyMas(-1), hora: '14:00', fechaFin: hoyMas(28), descripcion: 'En la página web del colegio', icono: '📝' },
      { id: 'd2', titulo: 'Jornada de vacunación', fecha: hoyMas(8), descripcion: 'Traer carnet de control', icono: '💉', importante: 'si' },
      { id: 'd3', titulo: 'Fiesta de la Chilenidad', fecha: hoyMas(15), descripcion: 'Muestra folclórica en el gimnasio', icono: '🇨🇱' },
      { id: 'd4', titulo: 'Fin del semestre', fecha: hoyMas(40), descripcion: 'Entrega de informes', icono: '🎓' },
    ],
    canales: [
      { id: 'c1', nombre: 'Chilevisión', url: 'https://www.chilevision.cl/senal-online/', orden: 1 },
      { id: 'c2', nombre: 'TVN', url: 'https://www.tvn.cl/en-vivo', orden: 2 },
      { id: 'c3', nombre: 'Canal 13', url: 'https://www.13.cl/en-vivo', orden: 3 },
    ],
    avisos: [
      { id: 'v1', texto: 'Bienvenidos al Colegio Marina de Chile', publico: 'ambos' },
      { id: 'v2', texto: 'Recuerde revisar el correo institucional diariamente', publico: 'funcionarios' },
      { id: 'v3', texto: 'Horario de atención de apoderados: lunes a viernes 8:00 a 13:00', publico: 'familias' },
    ],
    ajustes: [
      { id: 'telefonos', valor: JSON.stringify([
        { tipo: 'telefono', nombre: 'Secretaría', numero: '41 234 5678' },
        { tipo: 'telefono', nombre: 'Inspectoría', numero: '41 234 5679' },
        { tipo: 'whatsapp', nombre: 'WhatsApp', numero: '+56 9 1234 5678' },
        { tipo: 'correo', nombre: 'Correo', numero: 'contacto@colegio.cl' },
      ]) },
      { id: 'sitioWeb', valor: 'www.ejemplo-colegio.cl' },
      { id: 'instagram', valor: '@ejemplo_colegio' },
      { id: 'youtube', valor: '@ejemplo_colegio' },
    ],
    musica: [
      { id: 'm1', titulo: 'Lista de ejemplo', url: 'https://www.youtube.com/watch?v=CLeZyIID9Bo&list=PLhvRqWR6il6FAbhLWbHnEIVQErmpBRXCo' },
    ],
    demo: true,
  };

  // ...html?demo=1 muestra datos de ejemplo (para revisar el diseño)
  const MODO_DEMO = !CFG.API_URL || /[?&]demo=1/.test(location.search);

  async function cargarDatos() {
    if (MODO_DEMO) {
      // ?reunion=1 → hoy "Básica" (salas) y próxima "Media" (aviso) · ?reunion=2 → hoy "Media" (12 cursos)
      // ?reunion=3 → ninguna hoy: solo los avisos de las próximas reuniones
      const modo = (location.search.match(/[?&]reunion=(\d)/) || [])[1];
      if (!modo) return DEMO;
      const aj = DEMO.ajustesReunion.map(a => {
        if (a.id !== 'reuniones' || modo === '1') return a;
        return { id: a.id, valor: JSON.stringify(JSON.parse(a.valor).map(r => Object.assign({}, r,
          modo === '2' ? { activo: r.id === 'r2' ? 'si' : '', fecha: hoyMas(0) } : { fecha: r.id === 'r1' ? hoyMas(2) : r.fecha }))) };
      });
      return Object.assign({}, DEMO, { ajustes: (DEMO.ajustes || []).concat(aj) });
    }
    try {
      const r = await fetch(CFG.API_URL + '?t=' + Date.now());
      const data = await r.json();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
      return data;
    } catch (e) {
      // sin internet → usar última copia
      try {
        const c = localStorage.getItem(CACHE_KEY);
        if (c) return JSON.parse(c);
      } catch (e2) {}
      return DEMO;
    }
  }

  // Consulta liviana: número que cambia cada vez que el administrador publica algo.
  // null = no disponible (sin API o backend antiguo).
  async function version() {
    if (MODO_DEMO) return 'demo';
    try {
      const r = await fetch(CFG.API_URL + '?accion=version&t=' + Date.now());
      const d = await r.json();
      return d.version === undefined ? null : String(d.version);
    } catch (e) {
      return undefined; // sin conexión: no hacer nada esta vez
    }
  }

  // POST sin preflight CORS (text/plain) → Apps Script
  async function admin(action, payload) {
    if (!CFG.API_URL) throw new Error('Configure API_URL en config.js');
    const r = await fetch(CFG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload)),
    });
    const res = await r.json();
    if (!res.ok) throw new Error(res.error || 'Error');
    return res;
  }

  // Video MP4 o canción MP3 publicada: se descarga a través de Apps Script por partes de 8 MB
  // (Drive no deja reproducirlos directamente en otra página) y se guarda en el equipo,
  // así al recargar la pantalla no se vuelve a descargar. Devuelve una URL local.
  const videos = {};
  const CACHE = 'cmch-medios';
  const claveCache = id => new Request(location.origin + '/__medio/' + encodeURIComponent(id));

  async function descargarMedio(fileId) {
    try {
      const guardado = await (await caches.open(CACHE)).match(claveCache(fileId));
      if (guardado) return await guardado.blob();
    } catch (e) {} // sin almacenamiento disponible: se descarga igual
    const partes = [];
    let total = 1;
    let tipo = '';
    for (let k = 0; k < total; k++) {
      // mientras se reproduce un video no se descarga nada (procesar la descarga hace que el video se pegue)
      while (document.body && document.body.classList.contains('video-activo')) await new Promise(r => setTimeout(r, 2000));
      const d = await (await fetch(CFG.API_URL + '?accion=video&id=' + encodeURIComponent(fileId) + '&parte=' + k)).json();
      if (!d.data) throw new Error(d.error || 'Archivo no disponible');
      tipo = d.tipo;
      total = d.partes || 1; // un Code.gs anterior entrega todo de una vez
      partes.push(await (await fetch(`data:${d.tipo};base64,${d.data}`)).blob());
    }
    const blob = new Blob(partes, { type: tipo });
    try { await (await caches.open(CACHE)).put(claveCache(fileId), new Response(blob)); } catch (e) {}
    return blob;
  }

  function video(fileId) {
    if (!videos[fileId]) {
      videos[fileId] = descargarMedio(fileId)
        .then(b => URL.createObjectURL(b))
        .catch(err => { delete videos[fileId]; throw err; }); // se reintenta la próxima vez
    }
    return videos[fileId];
  }

  // Borra del equipo los videos y canciones que ya no están publicados
  async function limpiarMedios(vigentes) {
    try {
      const c = await caches.open(CACHE);
      const ok = new Set(vigentes.map(id => claveCache(id).url));
      for (const req of await c.keys()) if (!ok.has(req.url)) await c.delete(req);
    } catch (e) {}
  }

  const para = (lista, perfil) =>
    (lista || []).filter(x => !x.publico || x.publico === 'ambos' || x.publico === perfil);

  // Sube un archivo grande a Drive por partes de 8 MB (sin el límite de tamaño de una sola subida).
  // alAvanzar(0..1) informa el progreso. Devuelve el id del archivo en Drive.
  async function subirArchivo(password, archivo, alAvanzar) {
    const PARTE = 8 * 1024 * 1024;
    const admin = window.API.admin; // (permite simular la subida en pruebas)
    const { sesion } = await admin('subidaIniciar', { password, nombre: archivo.name, tipo: archivo.type || 'application/octet-stream', tamano: archivo.size });
    for (let inicio = 0; inicio < archivo.size; inicio += PARTE) {
      const trozo = archivo.slice(inicio, Math.min(inicio + PARTE, archivo.size));
      const data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(trozo);
      });
      let res;
      for (let intento = 1; ; intento++) { // cada parte se reintenta hasta 3 veces si falla la red
        try {
          res = await admin('subidaParte', { password, sesion, inicio, total: archivo.size, tipo: archivo.type, data });
          break;
        } catch (e) {
          if (intento >= 3) throw e;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      alAvanzar && alAvanzar(Math.min(1, (inicio + trozo.size) / archivo.size));
      if (res.fileId) return res.fileId;
    }
    throw new Error('La subida no terminó, intente de nuevo');
  }

  window.API = { cargarDatos, version, admin, para, video, limpiarMedios, subirArchivo, DEMO };
})();
