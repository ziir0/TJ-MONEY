## Design Concept
This deck serves as a definitive Brand Identity Guideline for a premium fintech product. Operating as a high-end marketing launch, it adopts the posture of an Apple Keynote intersecting with Swiss International Style—leveraging oversized staging, extreme negative space, and strict editorial grid discipline. The color story is anchored by a striking, high-contrast dark mode. A Deep Navy (`#081A30`) background provides a premium, immersive canvas. Instead of falling into the cliche of chaotic, glowing neon tech grids, the requested vibrant Teal (`#19D3C5`) and Gold (`#F3B63F`) are deployed as sharp, deliberate highlighters for key data and brand symbols. A mid-tone Slate bridges the high-contrast elements. The typography relies on a crisp, geometric sans-serif delivering extreme weight contrast (ExtraBold versus Light) to project monumental, tech-forward authority without raising the information density.

## Visual Language
- **Imagery**: Hero-driven but minimalist. Treat brand assets (logos, avatars, icons) as luxury physical products. Use high-contrast staging light (subtle radial gradients in dark teal) behind assets to create depth.
- **Containers**: Whitespace-first. When bounding boxes are necessary for asset protection zones or color swatches, use sharp 90-degree corners with subtle 1px Slate borders (`#31516A`). Zero border-radius permitted.
- **Icons**: Solid and geometric. Rendered exclusively in Teal or Gold, scaled massively as graphic motifs rather than tiny bullet-point decorations.
- **Dataviz**: Minimalist flat bars or geometric plots using Teal and Gold against Slate axes; gridlines must be completely suppressed to maintain the premium void.
- **Motif**: A strict 2px high-contrast horizontal line in Teal (`#19D3C5`), exactly 80px wide, placed flush left above every slide title (or top-left of the safe area on cover pages), serving as a precise editorial registration mark.

## Layout Directives
- **Global**: 64px uniform margins. No page numbers, no persistent navigation. Left-aligned typography is mandatory to preserve the strict editorial grid.
- **Cover**: Monumental center-staged typography with the logo suspended in absolute negative space; no background elements.
- **Table of Contents**: Replaced by distinct section slides; never use a standard bulleted agenda.
- **Section Dividers**: Slogan-register typography breaking the grid; a single massive word or phrase floating in the Deep Navy void.
- **Closing**: Direct echo of the cover, stripping away the subtitle to leave only the brand symbol and a final gold accent.

| id | pattern | image | density |
| :--- | :--- | :--- | :--- |
| capa | Monumental center stage logo presentation | hero | low |
| essencia | Asymmetric split with giant symbol and slogan | hero | low |
| paleta | Minimalist color swatch grid cards | supporting | medium |
| tipografia | Massive typographic scale and weight specimen | none | low |
| ativos | Centered asset staging with technical specs | hero | low |
| construcao | Geometric wireframe and spacing schematic | supporting | low |
| boas_praticas | High-contrast split layout for correct/incorrect usage | none | medium |

## Design Tokens

| token | hex | usage |
| :--- | :--- | :--- |
| bg-navy | #081A30 | Global page background, deep canvas |
| text-primary | #FFFFFF | Headings, primary copy, and high-contrast numbers (Exception to pure white ban: essential for maximum premium contrast against dark navy) |
| text-secondary | #94A8B8 | Body text, captions, and secondary specs (Lightened slate for WCAG contrast on navy) |
| border-slate | #31516A | Container borders, wireframes, and protection area outlines |
| accent-teal | #19D3C5 | Primary motif, correct-usage highlights, and key interactive accents |
| accent-teal-dark | #0F8F9B | Staging light radial centers, secondary chart series |
| accent-gold | #F3B63F | Secondary branding highlights, warning/incorrect-usage markers |
| accent-gold-light| #FFE08A | Subtle illumination details on assets |

| role | family | size (px) | applies_to |
| :--- | :--- | :--- | :--- |
| display | Inter | 64 | Cover titles, monumental numbers, standalone slogans |
| heading | Inter | 40 | Slide titles, key conceptual headers |
| body | Inter | 20 | Descriptive text, summary lines, asset explanations |
| caption | Inter | 14 | Hex codes, pixel dimensions, protection area measurements |

## Guardrails
- **Forbidden:** No rounded corners on any image, container, or swatch; strict sharp geometry is mandatory.
- **Forbidden:** No text paragraphs exceeding three lines; all copy must be compressed to a declarative slogan register.
- **Forbidden:** No pure white or light-themed slide backgrounds; the entire deck must remain in the Deep Navy environment to maintain the stage illusion.
- **Forbidden:** No standard bulleted lists; use isolated metric cards or structural typographic grids instead.
- **Size floors:** body ≥20px, caption ≥14px.
