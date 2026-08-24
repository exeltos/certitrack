# Phase 12 — EL/EN and source structure

## Language
The common header now contains a persistent EL/EN language switch. The selected language is stored locally and is applied to static and dynamically-rendered UI text.

## HTML / CSS separation
HTML is under `pages/**` and `index.html`.
CSS is under `assets/styles/**`.
`assets/styles/app.css` is only the CSS entry point and imports shared/page style modules; HTML does not contain embedded `<style>` blocks.
JavaScript is under `src/**`.

Inline layout styles that remained in the profile/supplier shell were removed in Phase 12 and replaced by CSS classes. Previously minified one-line HTML pages were formatted for easier editing/review.
