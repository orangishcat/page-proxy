# Page Proxy Help

Page Proxy lets you inspect, select, and restyle websites with extension tools and script APIs.

## Quick start

1. Open a supported page and click the extension icon.
2. In `Code Editor`, define selectors inside the `// ==Selectors==` block.
3. Use `Select` to inspect elements and copy properties.
4. Run the script and reload the page when needed.

## Useful links

- [Documentation](https://orangishcat.github.io/page-proxy/docs)
- [Extension usage guide](https://orangishcat.github.io/page-proxy/docs/extension-usage)
- [Permissions reference](https://orangishcat.github.io/page-proxy/docs/permissions)
- [Issue tracker](https://github.com/orangishcat/page-proxy/issues)
- [Roadmap](https://github.com/orangishcat/page-proxy/blob/main/ROADMAP.md)

## Known issues

- Strict CSP websites can block script execution (for example, `github.com` and `mozilla.org`).
- Select tool cannot inspect inside iframes.
- Loading the extension directly from files often fails.

## Planned features

- Query elements by computed CSS properties.
- Create tool improvements for settings UI and reusable components.
- Multi-file scripts.
