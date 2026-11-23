# Frontend package (opcional)

Paquete frontend de CruzNess, independiente del core.

## Activar (todo el bloque, un booleano)

En `cruzness.yml`:

```yaml
frontend: true
```

Un único booleano para todo el paquete: `true` lo carga, `false` (valor del
`.example`) no registra ningún MCP frontend ni deja agentes ni skills en el
proyecto.

Después de cambiar `frontend` (o `frontendTools`), materializa el paquete y
reinicia OpenCode si hace falta:

```sh
node frontend/scripts/sync-frontend.mjs            # aplica lo que dice cruzness.yml
node frontend/scripts/sync-frontend.mjs --dry-run   # solo muestra qué haría
```

El script es idempotente: copia los agentes y las skills vendored a
`.opencode/` (ignorado por Git) cuando `frontend: true`, y los borra cuando es
`false`. Es la única forma de ocultarlos: OpenCode registra los agentes y las
skills de fichero **después** de cada `setup` de plugin, así que un plugin no
puede verlos, añadirlos ni quitarlos en V2.

### Por rol (frontendTools)

Sin `frontendTools` se registran `browse`, `imagetooling` y `storybook`.
Para añadir MCPs de SEO, analytics o UI, decláralos bajo el rol correspondiente:

```yaml
frontend: true
frontendTools:
  seo:
    name: my-seo
    type: remote
    url: https://example.test/mcp
  analytics:
    - name: my-analytics
      type: remote
      url: https://example.test/mcp
    - name: my-traffic
      type: remote
      url: https://example.test/mcp
```

SEO admite una sola definición. Analytics y UI admiten una definición o una
lista. Usa `type: remote` con `url`, o `type: local` con `command`. Si un rol
tiene varias entradas, dales nombres distintos; no reutilices nombres ni
prefijos de MCPs integrados. Los nombres admiten minúsculas, dígitos, guiones
y guiones bajos.

El plugin `cruzness.frontend` solo lee `cruzness.yml` para los MCPs: con `true`
registra los servidores elegidos; con `false` (o sin la clave) no registra
ninguno. Los agentes y las skills los pone o los quita el script
`sync-frontend`. El core (`cruzness` + `cruzness.notifications`) no depende de
este paquete ni este paquete del core.

Los fuentes viven en `frontend/`: `frontend/agents/*.md` y las skills
vendored en `frontend/skills/`. `scripts/sync-frontend.mjs` los materializa en
las rutas estándar de OpenCode.

## Agentes y división de herramientas

Tres especialistas con MCPs disjuntos; cada uno solo ve los suyos. Hay tres
y no más: un cuarto quedaría solapando a UI.

| Agente | Fichero | MCPs | Skills |
| ------ | ------- | ---- | ------ |
| UI | `frontend/agents/ui.md` | `browse`, `imagetooling` y `storybook`, más los MCPs que declares bajo `ui` | `frontend-design`, `design-taste-frontend`, `impeccable`, `make-interfaces-feel-better`, `transitions-dev`, `transitions-polish`, GSAP x8 |
| SEO | `frontend/agents/seo.md` | herramientas del rol `seo` que definas en `frontendTools` | (sin skills propias en origen; MCP + web guidance) |
| Analytics | `frontend/agents/analytics.md` | herramientas del rol `analytics` que definas en `frontendTools` | (sin skills propias en origen; MCPs + web guidance) |

`modern-web-guidance` es la única skill compartida por los tres (estándares
web y CWV: obligatoria primero en cualquier tarea HTML/CSS o JS de
cliente).

## MCPs

Los MCPs integrados se cargan sin declararlos en `frontendTools`.

| Servidor | Rol | Notas |
| -------- | --- | ----- |
| `browse` | UI (browser verification) | siempre puesto con el frontend, vía `npx -y @opencode/browse mcp` (no se configura en el yml) |
| `imagetooling` | image-transform | siempre puesto con el frontend, monta el proyecto abierto en `/workspace` (no se configura en el yml) |
| `storybook` | UI (componentes y documentación) | CruzNess arranca `storybook-mcp` como proceso local; Storybook debe estar sirviendo su índice en `http://localhost:6006/index.json`. El MCP puede descargar Chromium la primera vez. |
| `open-pencil` | UI (diseño visual) | CruzNess arranca `@open-pencil/mcp` con `npx`; requiere tener OpenPencil abierto con un documento cargado. |

Excluidos del proyecto origen a propósito: `sonarqube` (calidad genérica),
`docker` y `osp-marketing-tools` (infra genérica / deshabilitados), `brag`
(skill de vídeo, no frontend).

## Cada usuario define lo suyo

El baseline define servidores, nunca credenciales. Todo valor de usuario
(claves API, identidad de analytics, rutas locales, pareados) vive en su
entorno y no se commitea:

- Puedes guardar valores en `.env.local` (ignorado por Git), pero CruzNess
  no carga ese fichero automáticamente. Proporciona las credenciales al
  proceso de OpenCode o autentica cada servidor según sus instrucciones.
- CruzNess pasa las definiciones personalizadas a OpenCode sin comprobar
  credenciales. Si el servidor no debe conectarse, añade `disabled: true`.
- El pareado de navegador (si usas verificación en navegador) es por máquina
  y no sale de ella.

## Skills

- Vendored (wrappers pequeños): `frontend/skills/frontend-design` y
  `frontend/skills/design-taste-frontend`. `sync-frontend` los copia a
  `.opencode/skills/` cuando `frontend` es `true` y los borra cuando es
  `false`.
- Externas bajo demanda: `frontend/skills/REGISTRY.md` +
  `frontend/skills-lock.json` (GSAP x8, transitions x2,
  make-interfaces-feel-better, modern-web-guidance). `frontend/skills/` no
  contiene ningún `SKILL.md`, es solo el índice. Se instalan y
  actualizan desde sus repos de origen con:

```sh
node frontend/scripts/sync-skills.mjs       # instala/actualiza todo el lock
node frontend/scripts/sync-skills.mjs --dry-run  # solo muestra qué haría
```

El CLI instala copias en `.agents/skills/` y el sync las copia a
`.opencode/skills/`, que es el único directorio que OpenCode escanea. Repetirlo
actualiza las skills desde sus repos de origen. En Windows, usa una instalación
de Node.js que incluya npm.

`.opencode/skills/` está ignorado por Git: es salida generada por los dos
scripts. Una skill propia del proyecto va en `skills/` (raíz) o se añade al
baseline, no dentro de `.opencode/skills/`.
`impeccable` no está en el lock: se copia del proyecto origen solo
si se necesita (binario ~22MB, fuera del baseline).
