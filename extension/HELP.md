# Page Proxy Help

<!--This file is fetched by the extension and displayed in the extension's help panel.-->

Page Proxy lets you inspect, select, and restyle websites with extension tools
and script APIs. It simplifies userscript creation by allowing you to turn page
interactions into code, making the process less tedious.

Looking for scripts? Try the
[examples](https://orangishcat.github.io/page-proxy/#explore) on the landing
page!

Refer to the
[extension usage guide](https://orangishcat.github.io/page-proxy/docs/extension-usage)
and [API documentation](https://orangishcat.github.io/page-proxy/docs/) to write
your first script!

## Known issues

- Select tool cannot inspect inside iframes.
- Monaco worker can be blocked by CSP in extension-owned popups. This leads to
  functions such as autocomplete breaking in popups on strict-CSP sites such as
  Github.
- Loading the extension directly from a CRX or XPI often fails, loading unpacked
  is recommended.

[Report an issue](https://github.com/orangishcat/page-proxy/issues)

## Planned features

- Query elements by computed CSS properties.
- Create tool improvements for settings UI and reusable components.
- Multi-file scripts.

[Roadmap](https://github.com/orangishcat/page-proxy/blob/main/ROADMAP.md)

This file was fetched from
[HELP.md](https://github.com/orangishcat/page-proxy/blob/main/extension/HELP.md)
