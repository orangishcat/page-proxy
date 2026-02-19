---
title: Purpose
---

# Purpose

## Introduction

Sometimes webpages just don't work the way you want them to. Maybe they're missing some features, or they're just a dumpster fire (looking at you, CollegeBoard).

(My edit prediction tool was active when I wrote the previous sentence, and it suggested "looking at you, Facebook" lol. I've never tried it. How bad is Facebook? Is it like, as bad as Twitter?)

If you've ever messed around with DevTools, you'll find that it's quite fun to mess around and change the style and behavior of webpages.

But those changes are not persistent. The moment you exit the page, they're gone.

That brings us to userscripts.

## Userscripts

Userscripts allow your changes to be persistent. When you turn your edits into code, they can be saved and re-applied deterministically whenever you visit the webpage again.

This allows you to finally add new features, or keep your UI tweaks, or even share them with others.

Those exist already in the form of browser extensions like [Tampermonkey](https://www.tampermonkey.net/).

There's just one small problem: they're not very user-friendly.

## The part where I actually explain the purpose of this project

This project aims to provide a more user-friendly way to create userscripts.

I'm starting off simple here, for now to make Page Proxy userscripts you still need to know a bit of JavaScript.

But the tools provided will help eliminate a lot of the boring work and setup.

For example, to change a specific piece of text, you need to use [CSS Selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors)
to identify the text you want to change, before actually changing it.

But with Page Proxy, you can select an element and generate a selector for it. To make sure it selects what you want it to, you
still have to learn a bit of CSS and JS, but the tools provided will help you with that and eliminate most of the repetitive copy-pasting.

**Essentially, Page Proxy aims to allow you to spend more time making cool features, while spending less time writing code to make your edits persistent.**

Here is the description I put in the README:

> Page Proxy is an all-in-one userscript manager and creator with custom tools for userscript design, so you can spend more time designing instead of converting your ideas to code.

It's a bit verbose, but hopefully it gets the message across..?

If you can word that better, tell me.
