import catsEverywhereSource from "../../../../static/examples/cats-everywhere.js?raw";
import fixOverdueListSource from "../../../../static/examples/fix-overdue-list.js?raw";
import knowtDeslopifierSource from "../../../../static/examples/knowt-deslopifier.js?raw";
import { createLandingExampleScript } from "./landing-example-script";

export const landingExampleScripts = [
  createLandingExampleScript({
    id: "cats-everywhere",
    fileName: "cats-everywhere.js",
    content: catsEverywhereSource,
    category: "Chaos",
    cardDescription: "adds a cat to the top right corner of every page",
  }),
  createLandingExampleScript({
    id: "knowt-deslopifier",
    fileName: "knowt-deslopifier.js",
    content: knowtDeslopifierSource,
    category: "Cleanup",
    cardDescription: "Knowt has premium badges everywhere, so I wrote a script to get rid of all of them automatically",
  }),
  createLandingExampleScript({
    id: "fix-overdue-list",
    fileName: "fix-overdue-list.js",
    content: fixOverdueListSource,
    category: "Schoology",
    cardDescription:
      "For the Schoology homepage overdue + upcoming list, the script gives overdue and upcoming their own sections, and makes overdue scrollable",
  }),
];
