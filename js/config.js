// ============================================================
//  CONFIGURACIÓN – edite solo este archivo
// ============================================================
window.APP_CONFIG = {
  // Pegue aquí la URL de su Aplicación web de Apps Script (termina en /exec).
  // Si se deja vacío, la app funciona en MODO DEMO con datos de ejemplo.
  API_URL: 'https://script.google.com/macros/s/AKfycbwIGGpVRYm7wOawp8kEy2VKUFTKi28sKIf0EqPcNuoOOZvkkyv4Hk8rCa6L_BTbySjLGQ/exec',

  NOMBRE: 'Colegio Marina de Chile',
  CIUDAD: 'Concepción',

  // Cada cuántos segundos se recargan los datos desde Google Sheets
  REFRESCO_DATOS_SEG: 300,
  // Duración de cada diapositiva del panel informativo
  DURACION_SLIDE_SEG: 12,
  // Duración de cada foto en el carrusel
  DURACION_FOTO_SEG: 7,
  // Los videos de YouTube pasan al siguiente al terminar; este es el tiempo máximo
  DURACION_VIDEO_MAX_SEG: 180,
  // En la app Android TV, los videos del perfil Familias se reproducen con sonido
  // (en Funcionarios siempre van en silencio para no tapar la TV)
  VIDEO_CON_SONIDO_FAMILIAS: true,
};
