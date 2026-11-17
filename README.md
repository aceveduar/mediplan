# React + TypeScript + Vite

## GitHub Pages

This application is configured for static deployment to GitHub Pages.

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push a change to `main` or run the **Deploy to GitHub Pages** workflow.

The workflow builds `dist/` and deploys it automatically. Relative Vite paths allow
the site to work from both a project URL such as
`https://<usuario>.github.io/ameliadoctor/` and a custom domain.

The app is stored entirely in the browser's `localStorage`. GitHub Pages does not
provide a private server or database, so do not publish sensitive medical data.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
