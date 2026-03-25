import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

// ==Page Proxy==
// @title cats EVERYWHERE
// @website *://*/*
// @description sets every page's background to a cat image
// @grant run-on-page-load
// @author orangishcat
// ==/Page Proxy==

// ==Selectors==

const response = await (
  await pn.get("https://api.thecatapi.com/v1/images/search", { cache: true, cacheDuration: 60 * 60 * 1000 })
).json();
const url = response[0].url;

const div = document.createElement("div");
div.innerHTML = `<img style="position: fixed; top: 0; right: 0; opacity: 20%" src="${url}"></img>`;
document.body.appendChild(div.firstChild);
// ==/Selectors==
