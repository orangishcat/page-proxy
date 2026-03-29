import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

// ==Page Proxy==
// @title Make links not draggable
// @website *://*/*
// @description A tiny mouse movement between mouse button down
// and mouse button up on a button turns it into a drag instead
// of a click. This sets all links and buttons to not draggable,
// fixing this issue.
// @author orangishcat
// @grant run-on-page-load
// ==/Page Proxy==

// ==Selectors==
// ==/Selectors==

pq.selector({
  name: "a selector",
  baseSelector: "a",
  matches: (e) => true,
}).onElementMatches((a) => a.setAttribute("draggable", "false"));
