# AGENTS.md

### General code guidelines

- Prefer simplicity and elegance over complexity.
- If a file is over 300 lines long, split it into smaller files, grouped by functionality.
- If a function is over 50 lines long, consider splitting it into smaller functions.
- Leave comments only when necessary.
- Do not wrap try-except blocks anywhere unless explicitly stated by the prompt.
  Explicitly state all errors that can occur and handle them appropriately.
- Respect `.editorconfig`

### Project info

- Web: SvelteKit with TypeScript
- Extension: WXT with Svelte and TypeScript
    - Package manager: `bun`
    - Components: `bits-ui`
    - CSS: `tailwindcss`
    - Icons: `lucide-svelte`
    - Network: `axios`
    - Test: `vitest`
    - [Figma file](https://www.figma.com/file/1E8P0X0wBphOq6kbXWMhbW/page-proxy--)
- Always use `bits-ui` for components wherever possible.

### Development guidelines

- Clarify whether the feature is for the web or the extension.
- Prefer Svelte runes to old Svelte.
- Use the Svelte MCP's `svelte-autofixer` tool lint all code added.
- Use base tailwind classes instead of defining custom units.
- Use `loglevel` and named loggers for logging.
- Use `em` as the CSS unit in all places in the extension (for consistent sizing across webpages), and `rem` in the web and docs-site.
- Use components wherever possible.
- Use classes in `app.css` for typography.
- Use `axios` for all network requests.
- For all UI edits, assume the colors are for dark mode, and do the inverse of the action for light mode.
    - For example, if the prompt says to darken an element, make it lighter in light mode.
- After edits, use `bun run check` and `bun run lint` to check for errors, fixing issues and rerunning until clean.
- Extension UI should use all colors, styles, and components from the web UI, and resemble existing pages from the web
  UI.

### App state usage

- Treat `appState` as the source of truth for extension UI state.
- Use `appStateActions` to mutate state and `appStateSelectors` to read it from UI code.
- Hydration loads keyed storage entries, persistence writes keyed storage entries, and sync mirrors external storage changes back into `appState`.
- Storage layout:
  - `settings` -> `pageproxy:show-help-button`, `pageproxy:disable-all-grants`
  - `scriptsByName` -> `pageproxy:<scriptName>`
  - `sidepanel` local flags -> `sidepanel:toolPanelHeightPx`, `sidepanel:helpBannerDismissed`, `sidepanel:userscriptReloadBannerDismissed`
  - `recordPanelsByTabId` -> `sidepanel:recordPanel:<tabId>`
  - `session.selectedScriptByHostname` -> `sidepanel:<hostname>`
  - `session.openTabsByTabId` -> `sidepanel:openTabs`
- Avoid direct `browser.storage` reads or writes in UI code unless a module is explicitly responsible for app-state hydration, persistence, or sync.
