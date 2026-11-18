# MediPlan

PWA para organizar y registrar tomas de medicamentos. La aplicación es estática y guarda sus datos en el almacenamiento local del navegador; no necesita una cuenta ni un servidor.

## Estructura

- `src/App.tsx`: interfaz y coordinación de flujos.
- `src/domain/`: tipos del dominio, indicaciones iniciales y reglas puras de horarios.
- `src/storage/appData.ts`: validación, carga, migración y guardado local.
- `src/domain/*.test.ts` y `src/storage/*.test.ts`: pruebas de reglas y persistencia.

## Desarrollo

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

GitHub Actions ejecuta las pruebas y compila la aplicación antes de publicar `dist/` en GitHub Pages al actualizar `main`.

Los datos solo se guardan en este navegador. Borrar sus datos o cambiar de dispositivo puede hacer que se pierdan; exporta una copia desde la aplicación si necesitas conservarlos.
