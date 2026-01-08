import axios from 'axios';
import penpalBundle from '$lib/preview/penpal.min.js?raw';
import type {RequestHandler} from './$types';

const safePenpalBundle = penpalBundle.replace(/<\/script>/g, '<\\/script>');
const selectionStyles = `\n<style>\n.pp-hover {\n  outline: 2px solid #86d24b !important;\n  outline-offset: 2px !important;\n}\n.pp-selected {\n  outline: 2px solid #bb9348 !important;\n  outline-offset: 2px !important;\n}\n</style>\n`;

const selectionScript = `
<script>${safePenpalBundle}</script>
<script>
(() => {
  const { connect, WindowMessenger } = window.Penpal;
  const hoverClass = 'pp-hover';
  const selectedClass = 'pp-selected';
  const messageSource = 'page-proxy';
  let selectionEnabled = false;
  let hovered = null;
  let selected = null;
  let parentApi = null;

  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\]^{}|~])/g, '\\\\$1');
  };

  const buildSelector = (element) => {
    if (element.id) {
      return '#' + escapeSelector(element.id);
    }
    const parent = element.parentElement;
    if (parent && parent.id) {
      return (
        '#' +
        escapeSelector(parent.id) +
        ' > ' +
        element.tagName.toLowerCase()
      );
    }
    if (element.classList && element.classList.length > 0) {
      return '.' + escapeSelector(element.classList[0]);
    }
    return element.tagName.toLowerCase();
  };

  const getInfo = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      name: element.getAttribute('name'),
      className: element.className || null,
      selector: buildSelector(element),
      boundingBox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    };
  };

  const clearHover = () => {
    if (hovered) {
      hovered.classList.remove(hoverClass);
      hovered = null;
    }
  };

  const postToParent = (type, payload) => {
    if (!window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage({source: messageSource, type, payload}, '*');
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.source !== messageSource) return;
    if (data.type === 'selection-enabled') {
      selectionEnabled = data.enabled === true;
      if (!selectionEnabled) {
        clearHover();
      }
    }
  });

  window.addEventListener(
    'mousemove',
    (event) => {
      if (!selectionEnabled) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (hovered && hovered !== target) {
        hovered.classList.remove(hoverClass);
      }
      hovered = target;
      hovered.classList.add(hoverClass);
      const info = getInfo(target);
      if (parentApi) {
        parentApi.handleHover(info);
      } else {
        postToParent('hover', info);
      }
    },
    {capture: true}
  );

  window.addEventListener(
    'click',
    (event) => {
      if (!selectionEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (selected && selected !== target) {
        selected.classList.remove(selectedClass);
      }
      selected = target;
      selected.classList.add(selectedClass);
      const info = getInfo(target);
      if (parentApi) {
        parentApi.handleSelect(info);
      } else {
        postToParent('select', info);
      }
    },
    {capture: true}
  );

  const messenger = new WindowMessenger({
    remoteWindow: window.parent,
    allowedOrigins: ['null', window.location.origin]
  });
  const connection = connect({
    messenger,
    methods: {
      setSelectionEnabled(enabled) {
        selectionEnabled = enabled === true;
        if (!selectionEnabled) {
          clearHover();
        }
      }
    }
  });
  connection.promise.then((parent) => {
    parentApi = parent;
  });
})();
</script>
`;


const injectPreviewRuntime = (html: string, targetUrl: string) => {
  let updated = html;
  updated = updated.replace(
    /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    ''
  );

  const escapedTargetUrl = targetUrl.replace(/"/g, '&quot;');
  const baseTag = updated.match(/<base\s/i)
    ? ''
    : `\n<base href="${escapedTargetUrl}">`;
  const headInsert = `${baseTag}${selectionStyles}`;

  if (updated.match(/<\/head>/i)) {
    updated = updated.replace(/<\/head>/i, `${headInsert}\n</head>`);
  } else {
    updated = `${headInsert}\n${updated}`;
  }

  if (updated.match(/<\/body>/i)) {
    updated = updated.replace(/<\/body>/i, `${selectionScript}\n</body>`);
  } else {
    updated = `${updated}\n${selectionScript}`;
  }

  return updated;
};

export const GET: RequestHandler = ({url}) => {
  const target = url.searchParams.get('url');
  if (!target) {
    return new Response('Missing url parameter.', {status: 400});
  }
  if (!URL.canParse(target)) {
    return new Response('Invalid url parameter.', {status: 400});
  }

  const parsed = new URL(target);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response('Only http and https urls are supported.', {status: 400});
  }

  return axios
    .get(target, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Page Proxy'
      }
    })
    .then((response) => {
      const contentType = response.headers['content-type'] ?? '';
      const responseBytes =
        response.data instanceof ArrayBuffer
          ? new Uint8Array(response.data)
          : response.data instanceof Uint8Array
            ? response.data
            : new Uint8Array(response.data);

      if (response.status >= 400) {
        const message = `Upstream request failed (${response.status}).`;
        return new Response(message, {status: response.status});
      }

      if (contentType.includes('text/html')) {
        const html = new TextDecoder('utf-8').decode(responseBytes);
        const updatedHtml = injectPreviewRuntime(html, target);
        const headers = new Headers({
          'content-type': contentType || 'text/html; charset=utf-8'
        });
        return new Response(updatedHtml, {status: response.status, headers});
      }

      const headers = new Headers({
        'content-type': contentType || 'application/octet-stream'
      });
      return new Response(responseBytes, {status: response.status, headers});
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Proxy request failed.';
      return new Response(message, {status: 502});
    });
};
