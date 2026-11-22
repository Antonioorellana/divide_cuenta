# Flujo estable de desarrollo

## Objetivo

Todo cambio de La Justa debe quedar trazable, probado y desplegable sin
trabajar directamente sobre `main`.

## Acceso a GitHub

El remoto usa SSH:

```text
git@github.com:Antonioorellana/divide_cuenta.git
```

La llave Ed25519 está registrada en GitHub y el agente SSH de macOS usa el
llavero del sistema. `git fetch`, `git pull` y `git push` no dependen de un
token temporal de GitHub CLI.

GitHub CLI queda como herramienta opcional para crear o administrar pull
requests. No es necesario autenticarla para commits ni pushes.

## Flujo de ramas

1. Actualizar `main`.
2. Crear una rama corta para la funcionalidad.
3. Implementar y probar localmente.
4. Crear commits pequeños y descriptivos.
5. Subir la rama por SSH.
6. Revisar el pull request y sus comprobaciones automáticas.
7. Fusionar solo cuando todas las comprobaciones estén aprobadas.

La rama actual del piloto es `agent/iphone-pilot-v1` y su pull request se
actualiza automáticamente con cada push.

## Control automático de calidad

GitHub Actions ejecuta en cada pull request y en cada push a `main`:

- instalación reproducible mediante `npm ci`;
- pruebas del motor financiero;
- ESLint;
- build y pruebas de render de la PWA;
- build nativo de Next.js para Vercel.

Un fallo debe corregirse en la rama. No se debe fusionar un PR con la
comprobación `Calidad` fallida.

## Estrategia de despliegue

La aplicación conserva dos builds explícitos:

- `npm run build`: Vinext, utilizado por Sites;
- `npm run build:vercel`: Next.js nativo, utilizado por Vercel.

Esto permite comparar ambos proveedores sin hacer que un despliegue dependa
del formato interno del otro.

## Regla de secretos

No se versionan `.env`, tokens, certificados ni llaves privadas. Los secretos
de CI o de producción deben almacenarse en GitHub Actions, Sites o Vercel,
nunca dentro del repositorio.
