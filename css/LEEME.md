# 1 · Sitio web (GitHub Pages)

**Haga primero el paso 2 (Apps Script)** para tener la URL `/exec`.

1. `js/config.js` **ya trae configurada** la URL de su Apps Script (`API_URL`).
   Ahí también puede ajustar los tiempos de fotos/videos.
2. En github.com cree un repositorio nuevo **público** (ej.: `tv-colegio`).
3. *Add file → Upload files* → arrastre **todo el contenido de esta carpeta**
   (index.html, admin.html, css, js, assets…) → *Commit changes*.
4. *Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save*.
5. En 1–2 minutos su sitio estará en `https://USUARIO.github.io/tv-colegio/`.

Direcciones:
- Inicio: `https://USUARIO.github.io/tv-colegio/`
- Directo funcionarios: `.../index.html?perfil=funcionarios`
- Directo familias: `.../index.html?perfil=familias`
- Administrador: `.../admin.html` → **no aparece en las pantallas del TV**; solo se entra
  escribiendo esta dirección (guárdela en marcadores del computador de quien administra).

> Sin `API_URL` el sitio funciona en **MODO DEMO** con datos de ejemplo.
