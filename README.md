# Namibia Investing - Locales Comerciales

Esta es la plataforma interna de Namibia Investing para la captura y filtrado automático de ofertas de locales comerciales en Galicia (Vigo y Santiago de Compostela).

## Arquitectura del Proyecto

El sistema está compuesto por dos partes principales: un **Scraper en Python** que extrae los datos de Gmail, y un **Frontend Estático** que lee esos datos y se sincroniza con Firebase.

### 1. Extracción de Datos (Backend Automático)
- **Script:** `fetch_emails.py`
- **Funcionamiento:** Se conecta a la API de Gmail y busca correos con la etiqueta `locales`. Extrae el título, precio, metros cuadrados, descripción y el enlace al anuncio (Idealista, Fotocasa, etc.).
- **Automatización:** Se ejecuta automáticamente cada 6 horas mediante GitHub Actions (`.github/workflows/update_data.yml`). Si encuentra correos nuevos, actualiza el archivo `data.json` y hace un commit automático en el repositorio.
- **Filtros:** Solo guarda locales que tengan un precio y área válidos (mayor a 0) y descarta correos de bienvenida de los portales.

### 2. Frontend y Lógica de Descartes (El Equipo)
- **Tecnologías:** HTML, CSS (Vanilla) y JavaScript (`app.js`).
- **Visualización:** La web carga los datos de `data.json` y permite filtrar por región y ciudades específicas, así como un buscador por texto libre.

#### Lógica de Sincronización y Descartes
Para que el equipo completo (**El Oso (el jefe) 🐻, El Drome, El Garro y El Fino**) pueda limpiar el listado y que todos vean la misma información en tiempo real, se ha integrado **Firebase Realtime Database**.

**El flujo de estados es el siguiente:**
1. **Estado Inicial (Activo):** Cuando un nuevo local llega por correo, aparece en la pestaña de su región correspondiente (ej. Área de Vigo).
2. **Acción de Descartar:** 
   - Al pulsar "Descartar 🐻", aparece un modal moderno de confirmación.
   - Si se acepta, el script coge la **URL original del anuncio** (para evitar duplicados por ID de correo), la codifica de forma segura (`encodeURIComponent`) y la envía a la base de datos de Firebase.
   - La tarjeta desaparece instantáneamente de la lista principal para todos los usuarios conectados.
3. **Estado Descartado:** 
   - La tarjeta pasa a la pestaña "Oso descartados 🐻". 
   - Si el día de mañana el mismo anuncio llega en un correo nuevo, el sistema no lo mostrará en la lista principal porque su URL ya consta en Firebase como descartada.
4. **Acción de Recuperar:**
   - Estando en la pestaña de descartados, pulsar "Recuperar 🐻" borra la URL de Firebase.
   - La tarjeta regresa a su pestaña original en tiempo real para todo el equipo.

## Configuración de Firebase
La base de datos utiliza una capa gratuita (Plan Spark) alojada en Bélgica (`europe-west1`). Las reglas de seguridad deben estar siempre en modo abierto para que la web estática pueda leer y escribir sin autenticación:
```json
{
  "rules": {
    ".read": "true",
    ".write": "true"
  }
}
```

## Desarrollo Local
Para lanzar la aplicación en tu propio ordenador de manera local:
1. Abre un terminal en esta carpeta.
2. Ejecuta: `python3 -m http.server 8000`
3. Visita `http://localhost:8000` en tu navegador.
