# Agents

### General code guidelines

- Prefer simplicity and elegance over complexity.
- Leave comments only when necessary.
- Do not wrap try-except blocks anywhere unless explicitly stated by the prompt.
  Explicitly state all errors that can occur and handle them appropriately.
- Respect `.editorconfig`

### Project info

- Backend: Rust web server with `axum`
  - Package manager: `cargo`
- Frontend: SvelteKit with TypeScript
  - Package manager: `bun`
- Auth, Database, Storage: Appwrite
