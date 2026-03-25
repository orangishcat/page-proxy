import * as pq from "@page-proxy/pp/pp-query";
import * as ps from "@page-proxy/pp/pp-style";
import * as pv from "@page-proxy/pp/pp-event";

// ==Page Proxy==
// @title Knowt deslopifier
// @website https://knowt.com/*
// @description Get rid of AI slop from Knowt (by removing buttons with premium badges on them)
// @author orangishcat
// ==/Page Proxy==

// ==Selectors==
const premiumBadge = pq.selector({
  "name": "premium badge selector",
  "baseSelector": "div.MuiBox-root:has(div.MuiBox-root.knowt-4tqv34),a:has(div.MuiBox-root.knowt-4tqv34)",
  "matches": e => true,
  "postMap": e => e.parentElement.localName === 'a' ? e.parentElement : e
});

const upgradeButton = pq.selector({
  "name": "upgrade button",
  "baseSelector": "nav.flex_flex__NGgQE.flex_flexColumn___cC9I > div.flex_flex__NGgQE.flex_flexColumn___cC9I:nth-of-type(2) > div.knowt-101chhv > button.secondaryText1.MuiBox-root:nth-of-type(3)",
  "matches": e => true,
});

// ==/Selectors==

premiumBadge.onElementMatches(e => e.remove());
upgradeButton.onElementMatches(e => e.remove());
