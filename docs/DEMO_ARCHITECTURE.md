# CertiTrack Demo Architecture — Phase 48.2

## Rule

The Demo is not a second product and must not develop its own visual language.

Production and Demo must share:
- `assets/styles/app.css`
- the canonical design system imported by `app.css`
- shared shell/components
- common labels, spacing, buttons, cards, typography and responsive rules

The only intended difference is the data/provider layer:

- Production -> Supabase-backed services
- Demo -> isolated mock/demo data

## Safety boundary

Demo data must never write to Supabase.
Production pages must never import demo data.

## Current Phase 48.2 status

The existing Demo remains an isolated route so it cannot accidentally write production data.
Its page is explicitly marked as Demo and uses the same canonical stylesheet/version as production.

A future refactor may move production and Demo onto one route/component tree with provider injection.
That refactor should be done only with end-to-end regression testing, because merging the routes without
tests could accidentally expose production mutations from Demo mode.

## Regression checklist

When changing UI, verify both Production and Demo for:
1. header/sidebar/footer
2. typography and spacing
3. buttons and forms
4. certificate cards/lists
5. partner/compliance views
6. mobile breakpoints
7. no Supabase writes from Demo
