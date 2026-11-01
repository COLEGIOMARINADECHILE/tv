// ============================================================
//  CONFIGURACIÓN – edite solo este archivo
// ============================================================
window.APP_CONFIG = {
  // Pegue aquí la URL de su Aplicación web de Apps Script (termina en /exec).
  // Si se deja vacío, la app funciona en MODO DEMO con datos de ejemplo.
  API_URL: 'https://script.google.com/macros/s/AKfycbwIGGpVRYm7wOawp8kEy2VKUFTKi28sKIf0EqPcNuoOOZvkkyv4Hk8rCa6L_BTbySjLGQ/exec',

  NOMBRE: 'Colegio Marina de Chile',
  CIUDAD: 'Concepción',

  // Cada cuántos segundos las pantallas preguntan si hay información nueva
  // (lo publicado en el panel Administrador aparece en ese tiempo)
  VERIFICAR_CAMBIOS_SEG: 10,
  // Recarga completa de respaldo (por si se edita la hoja de cálculo a mano)
  REFRESCO_DATOS_SEG: 300,
  // Duración de cada diapositiva del panel informativo
  DURACION_SLIDE_SEG: 12,
  // Duración de cada foto en el carrusel
  // (también se cambian desde el panel Administrador → ⚙️ Ajustes, que tiene prioridad)
  DURACION_FOTO_SEG: 12,
  // En Funcionarios las fotos pasan más lento (se leen junto a las actividades)
  DURACION_FOTO_FUNCIONARIOS_SEG: 20,
  // Los videos de YouTube se ven COMPLETOS y pasan al siguiente al terminar.
  // Este es solo un tope de seguridad por si YouTube no avisa el final (en segundos).
  DURACION_VIDEO_MAX_SEG: 1800,
  // Educación (Funcionarios): segundos que se ve cada texto antes de pasar al siguiente
  DURACION_EDUCACION_SEG: 15,
  // Videos del perfil Familias con sonido (cada video se puede silenciar desde Admin).
  // En Funcionarios siempre van en silencio para no tapar la TV.
  // En un navegador de PC se pide un clic la primera vez; en la app Android TV suena solo.
  VIDEO_CON_SONIDO_FAMILIAS: true,

  // Música de fondo en Familias (se sube en Admin → Música)
  MUSICA_FAMILIAS: true,
  MUSICA_VOLUMEN: 0.5,            // 0 a 1
  MUSICA_VOLUMEN_CON_VIDEO: 0.05, // mientras suena un video
};
