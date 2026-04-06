import catsEverywhereSource from "/examples/cats-everywhere.js?url&raw";
import knowtDeslopifierSource from "/examples/knowt-deslopifier.js?url&raw";
import makeLinksNotDraggableSource from "/examples/make-links-not-draggable.js?url&raw";
import { createLandingExampleScript } from "./landing-example-script";

export const landingExampleScripts = [
  createLandingExampleScript({
    id: "make-links-not-draggable",
    fileName: "make-links-not-draggable.js",
    content: makeLinksNotDraggableSource,
    cardDescription:
      "A tiny mouse movement between mouse button down and mouse button up on a button turns it into a drag instead of a click. This sets all links and buttons to not draggable, fixing this issue.",
  }),
  createLandingExampleScript({
    id: "cats-everywhere",
    fileName: "cats-everywhere.js",
    content: catsEverywhereSource,
    cardDescription: "adds a cat to the top right corner of every page",
  }),
  createLandingExampleScript({
    id: "knowt-deslopifier",
    fileName: "knowt-deslopifier.js",
    content: knowtDeslopifierSource,
    cardDescription: "Knowt has premium badges everywhere, so I wrote a script to get rid of all of them automatically",
  }),
];
