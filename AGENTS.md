# AGENTS.md

### General code guidelines

- Prefer simplicity and elegance over complexity.
- Leave comments only when necessary.
- Do not wrap try-except blocks anywhere unless explicitly stated by the prompt.
  Explicitly state all errors that can occur and handle them appropriately.
- Respect `.editorconfig`

### Project info

- Backend: Rust web server
  - Web framework: `axum`
  - Package manager: `cargo`
- Frontend: SvelteKit with TypeScript
  - Package manager: `bun`
  - Components: `bits-ui`
  - CSS: `tailwindcss`
  - Icons: `lucide-svelte`
  - Network: `axios`
  - [Figma file](https://www.figma.com/file/1E8P0X0wBphOq6kbXWMhbW/page-proxy--)
- Auth, Database, Storage: Appwrite

### Frontend guidelines
- Prefer Svelte runes to old Svelte.
- Use base tailwind classes instead of defining custom units.
- Use `rem` instead of `px` in all places.
