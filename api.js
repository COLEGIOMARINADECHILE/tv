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
    if (MODO_DEMO) return DEMO;
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

  const para = (lista, perfil) =>
    (lista || []).filter(x => !x.publico || x.publico === 'ambos' || x.publico === perfil);

  window.API = { cargarDatos, version, admin, para, DEMO };
})();
