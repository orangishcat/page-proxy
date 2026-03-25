import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

// ==Page Proxy==
// @title Knowt deslopifier
// @website https://knowt.com/*
// @description Remove the premium badges everywhere
// @author orangishcat
// @grant run-on-page-load
// ==/Page Proxy==

// ==Selectors==
const premiumBadge = pq.selector({
  name: "premium badge selector",
  baseSelector: "img[alt='ultra']",
  matches: (e) => true,
});
const traverseUntilButton = pq.selector({
  name: "Traverse until big element",
  baseSelector: "div.MuiBox-root,a,button",
  matches: (e) => e.clientWidth > 100,
});
premiumBadge.onElementMatches((ultraBadge) => {
  let bigElement = pq.traverseParents(ultraBadge, (e) => traverseUntilButton.matches(e));
  if (bigElement.parentElement.localName === "a") bigElement = bigElement.parentElement;
  bigElement.remove();
});
ps.injectCSS(`
textarea[rows]
{
  max-height: 32rem !important;
  overflow-y: auto !important;
}
`);

// ==/Selectors==
