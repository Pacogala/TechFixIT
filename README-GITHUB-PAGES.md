# Publicar en GitHub Pages

Sigue estos pasos para publicar tu proyecto en GitHub Pages usando Vite y React:

1. **Asegúrate de tener git inicializado:**
   ```bash
   git init
   git remote add origin https://github.com/Pacogala/TechFixIT.git
   ```

2. **Instala gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

3. **Agrega los scripts a tu package.json:**
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```

4. **Configura vite.config.ts:**
   Agrega o modifica la propiedad `base`:
   ```ts
   export default defineConfig({
     base: '/TechFixIT/',
     // ...resto de la config
   })
   ```

5. **Haz build y despliega:**
   ```bash
   npm run deploy
   ```

6. **Verifica tu página:**
   Tu app estará disponible en: https://pacogala.github.io/TechFixIT/

---

**Notas:**
- Asegúrate de que el repositorio en GitHub tenga el mismo nombre y esté correctamente enlazado.
- Si tienes problemas con rutas, revisa la propiedad `base` en vite.config.ts.
