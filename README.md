# La Justa

Aplicación web progresiva móvil para dividir una cuenta detallada entre amigos.
Una persona paga el total y el resto le devuelve su consumo real más la
propina proporcional.

## Primera versión de prueba

El piloto permite:

- fotografiar una preboleta o comanda desde el iPhone;
- transcribir, corregir y eliminar consumos;
- agregar alias temporales y marcar quién pagó;
- asignar unidades individuales o consumos compartidos;
- calcular la propina proporcional en pesos chilenos;
- compartir el resumen junto con la fotografía mediante el menú nativo;
- eliminar la sesión después de compartir;
- instalar la aplicación desde Safari como PWA.

El OCR todavía no forma parte de esta versión. Los consumos se ingresan
manualmente para validar primero el flujo y las reglas financieras.

## Privacidad

La aplicación no usa cuentas ni una base de datos central. La fotografía, los
alias y las asignaciones permanecen en memoria durante la sesión y se eliminan
al compartir o finalizar. No se solicitan RUT, correos ni nombres legales.

## Desarrollo

Requiere Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Validación completa:

```bash
npm run test:domain
npm run lint
npm run build
npm test
```

## Arquitectura

- TypeScript 5
- React 19
- Next.js 16 con Vinext
- PWA sin persistencia remota
- motor financiero aislado en `domain/`

Las decisiones técnicas y las siguientes fases están documentadas en
[`docs/architecture.md`](docs/architecture.md).

El flujo de ramas, pruebas automáticas, acceso SSH y despliegues está
documentado en [`docs/development-workflow.md`](docs/development-workflow.md).
