# Frontend skills registry

Catálogo de skills del paquete frontend, llevadas desde ivanHomePage
a `.opencode/skills/`. Los wrappers vendored (`frontend-design` y
`design-taste-frontend`) viven en `frontend/skills/` y
`node frontend/scripts/sync-frontend.mjs` los copia a `.opencode/skills/`
cuando `frontend` es `true`. El resto se instala y actualiza desde sus repos
de origen con `node frontend/scripts/sync-skills.mjs` (orígenes fijados en
`frontend/skills-lock.json`), que copia cada instalación a `.opencode/skills/`
para que OpenCode la descubra.

## Origen verificado de cada skill

| Skill | Dueño | Repositorio de origen | Verificado en |
| ----- | ----- | --------------------- | ------------- |
| `frontend-design` | UI | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) (Apache-2.0) | el propio `SKILL.md` del proyecto origen lo declara (+ comando `npx skills add`) |
| `design-taste-frontend` | UI | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT) | el propio `SKILL.md` del proyecto origen lo declara (+ comando `npx skills add`) |
| `impeccable` | UI | **sin repo declarable en el proyecto origen** (vendored local v4.8.0, scripts v0.1.18, binario ~22MB, sin URL en sus ficheros) → no vendored en este repo, solo copia manual bajo demanda, fuera del baseline | `SKILL.md` + `scripts/VERSION` del proyecto origen; sin entrada en el lock |
| `make-interfaces-feel-better` | UI | [jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better) | `frontend/skills-lock.json` (`source`) |
| `transitions-dev` | UI | [Jakubantalik/transitions.dev](https://github.com/Jakubantalik/transitions.dev) | `frontend/skills-lock.json` (`source`) |
| `transitions-polish` | UI | [Jakubantalik/transitions.dev](https://github.com/Jakubantalik/transitions.dev) | `frontend/skills-lock.json` (`source`) |
| `gsap-core` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `gsap-frameworks` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `gsap-performance` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `gsap-plugins` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `gsap-react` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `gsap-scrolltrigger` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `gsap-timeline` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `gsap-utils` | UI | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | `frontend/skills-lock.json` (`source`) |
| `modern-web-guidance` | UI + SEO + analytics (compartida) | [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | `frontend/skills-lock.json` (`source` + hash) |

Notas:

- SEO y analytics no traen skills propias del proyecto origen: trabajan con
  sus MCPs más `modern-web-guidance`.
- `modern-web-guidance` es obligatoria primero en cualquier tarea HTML/CSS
  o JS de cliente (los pesos del modelo contienen patrones obsoletos).
