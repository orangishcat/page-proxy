import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

// ==Page Proxy==
// @title Fix overdue list
// @website https://*.schoology.com
// https://*.schoology.com/
// https://*.schoology.com/home
// @description Gives overdue and upcoming their own sections, and makes overdue scrollable
// @grant run-on-page-load
// @author orangishcat
// ==/Page Proxy==

// ==Selectors==
const popupLink = pq.selector({
  name: "overdue link",
  baseSelector:
    "aside > div.overdue-submissions.overdue-submissions-wrapper:nth-of-type(1) > div.upcoming-list > a.popups.upcoming-events-popup",
  matches: (e) => true,
});

ps.injectCSS(`
#popups-overlay,.overdue-popups-large,#popups-loading {
  display: none;
}
#overdue-submissions h4 {
  margin: 5px 0 !important;
}

header {
  border: none !important;
}
`);

const overduePopup = pq.selector({
  name: "overdue popup",
  baseSelector: ".overdue-popups-large",
  matches: (e) => true,
});

const overdueList = pq.selector({
  name: "overdue list",
  baseSelector:
    "div.todo.todo-wrapper:nth-of-type(1) > aside > div.overdue-submissions.overdue-submissions-wrapper:nth-of-type(1) > div.upcoming-list",
  matches: (e) => true,
});

const rightCol = pq.selector({
  name: "right column inner",
  baseSelector: "#right-column-inner",
  matches: (e) => true,
});

const overdueWrapper = pq.selector({
  name: "main div wrapper with id",
  baseSelector: "#overdue-submissions",
  matches: (e) => true,
});

const todoHeader = pq.selector({
  name: "todo header",
  baseSelector: "div > div.todo.todo-wrapper:nth-of-type(2) > aside > h3.h3-med.todo-header",
  matches: (e) => true,
});

const submissionTitle = pq.selector({
  name: "overdue or upcoming text",
  baseSelector: "div.sHome-processed > div h4.submissions-title",
  matches: (e) => true,
});

const todoContainer = pq.selector({
  name: "upcoming assignment container",
  baseSelector: ".upcoming-submissions > .upcoming-list",
  matches: (e) => true,
});

// ==/Selectors==

// open popup, read contents
popupLink.onElementMatches((e) => e.click());

// add it to the main page
const popupEl = await overduePopup.waitUntilMatch();
const assignmentHTML = popupEl.querySelector(".popups-body .upcoming-events").innerHTML;
let listEl = overdueList.query();
ps.applyStyle(listEl, {
  "max-height": "19rem",
  "overflow-y": "auto",
});
ps.applyStyle(await todoContainer.waitUntilMatch(), {
  "max-height": "38rem",
  "overflow-y": "auto",
});
listEl.innerHTML = assignmentHTML;

listEl = overdueList.query().querySelector(".upcoming-list-popup");
const nodes = Array.from(listEl.childNodes);
nodes.reverse();
listEl.replaceChildren(...nodes);

pa.moveNode(overdueWrapper.query(), 0, rightCol.query());
todoHeader.query().remove();

submissionTitle.onElementMatches((e) => {
  const title = e.innerText.charAt(0).toUpperCase() + e.innerText.slice(1).toLowerCase();
  e.outerHTML = `<h3 class="h3-med todo-header">${title}</h3>`;
});

// close popup
pv.pressKey("escape");
