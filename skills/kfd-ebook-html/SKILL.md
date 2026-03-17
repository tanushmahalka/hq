---
name: kfd-ebook-html
description: Create or revise KFD-style editorial ebooks in fixed-layout semantic HTML for clean browser preview and reliable PDF export. Use when converting a PDF, brief, or existing issue into a multi-page A4 landscape document with explicit page sections, print-safe CSS, stable data-block-id markers, and a consistent KFD visual system across the cover, interior pages, and closing CTA page.
---

# KFD Ebook HTML

Create KFD ebook pages as paper-first HTML, not as a responsive website.

## Core Rules

- Treat every source PDF page as one HTML page section.
- Use `<main class="document">`.
- Use `<section class="page" data-page="N">` for every page.
- Use semantic blocks: `header`, `section`, `article`, `figure`, `table`, `footer`.
- Use `data-block-id` on every editable content block.
- Keep the DOM shallow and well-labeled.
- Keep all layout dimensions in `mm`, `pt`, or `%`.
- Never let content spill below a page. If content does not fit, create another `.page`.
- Do not rely on JS, sticky UI, fixed UI chrome, animations, or viewport-based sizing.
- Design for both screen preview and print export from the same HTML.

## Print-Safe Foundation

Start from this structure and keep it intact:

```html
<style>
    @page { size: A4 landscape; margin: 0; }

    .page {
      width: 297mm;
      height: 210mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
  }
</style>

<main class="document">
  <section class="page" data-page="1">
    <!-- page content -->
  </section>
</main>
```

Use an inner wrapper with `padding` in `mm`. Keep the page box fixed. Let cards and figures fit inside the page instead of pushing the page taller.

## KFD Visual System

Keep these tokens consistent across the whole ebook, especially page 1 and the last page:

```css
:root {
  --page-width: 297mm;
  --page-height: 210mm;
  --page-pad-x: 16mm;
  --page-pad-y: 13mm;

  --navy: #18314d;
  --navy-deep: #10263f;
  --ink: #17304f;
  --ink-soft: #4f617a;
  --accent: #2f57f4;
  --accent-deep: #173eaf;
  --paper: #f7f8fb;
  --paper-strong: #ffffff;
  --paper-soft: #eef2f8;
  --rule: #dbe2f0;

  --display-font: "Iowan Old Style", "Palatino Linotype", "Book Antiqua",
    Georgia, serif;
  --body-font: "Avenir Next", "Helvetica Neue", Arial, sans-serif;

  --text-xs: 8.2pt;
  --text-sm: 9.1pt;
  --text-md: 10.2pt;
  --text-lg: 12.4pt;
  --display-md: 28pt;
  --display-lg: 38pt;
}
```

### Typography

- Use a serif display face for headlines and key editorial moments.
- Use a clean sans for body copy, metadata, tables, and captions.
- Keep the same font pairing on page 1, interior pages, and the last page.
- Highlight selective words in headings with the blue accent. Do not overuse.
- Keep line lengths editorial and readable. Do not create dense newspaper columns.

### Color

- Use a navy base plus bright blue accent.
- Use light neutral paper backgrounds on interior pages.
- Use white or near-white text on dark cover and CTA pages.
- Keep blue highlight usage consistent from the first story page through the final CTA.

## Cover And Last Page

Treat the first and last page as visual bookends. They should clearly belong to the same issue.

### Page 1

- Use a dark navy gradient background.
- Place the KFD mark at the top-left.
- Use a large serif headline with white text.
- Keep supporting copy short and calm.
- Add issue/date metadata and 2-4 summary callouts only if they fit cleanly.

### Last Page

- Reuse the same navy background family as page 1.
- Reuse the same font pairing, white text treatment, and accent link color.
- Place the KFD mark in the same top-left area.
- Keep the CTA copy short and prominent.
- Include the QR code in a contained figure that cannot overflow.

Use these placeholders in the skill output and replace them later:

- KFD logo URL: `{{KFD_LOGO_URL}}`
- Last-page QR image URL: `{{KFD_QR_IMAGE_URL}}`
- Optional CTA target URL: `{{KFD_CTA_LINK_URL}}`

Example:

```html
<img src="{{KFD_LOGO_URL}}" alt="KFD logo" />
<img
  src="{{KFD_QR_IMAGE_URL}}"
  alt="QR code linking to the KFD call to action"
/>
```

## Page Architecture

Build each page with a fixed shell:

1. `header` for page title, kicker, deck, or issue metadata.
2. `section` or `article` blocks for the main content.
3. `figure` for illustrations or bounded image regions.
4. `table` only when the page naturally needs structured comparison.
5. `footer` for brand/site and page number.

Prefer:

- Two-column editorial layouts
- Split comparison cards
- Three-up insight cards
- Simple, printable tables
- Short banners and quote bars

Avoid:

- Deep nesting
- Absolute positioning for normal content
- Floating elements that depend on browser quirks
- Long paragraphs stacked without visual rhythm

## Workflow

### 1. Read the source like a document, not a webpage

- Count the source PDF pages first.
- Identify page roles: cover, opener, list page, comparison page, table page, CTA page.
- Preserve that pacing in HTML.

### 2. Map one source page to one HTML page

- Start with a page outline before writing CSS details.
- Do not combine two source pages into one HTML page.
- Do not let one long source page overflow into a clipped HTML page.

### 3. Establish shared CSS once

- Put all reusable tokens in a single `<style>` block.
- Create reusable classes for cards, figures, banners, tables, and footers.
- Keep print rules and screen preview rules in the same stylesheet.

### 4. Fit content deliberately

- Keep figure heights bounded.
- Use shorter body sizes on dense analytical pages.
- Convert long prose into cards, bullets, tables, or short pull quotes when needed.
- If a page still feels crowded, split it into another `.page`.

### 5. Validate export safety

Check all of these before finishing:

- Page count matches the intended document structure.
- Every page has `data-page="N"`.
- Every editable block has `data-block-id`.
- No content depends on JS.
- No element uses `vh` or `vw` for page sizing.
- Images use `max-width: 100%`, bounded heights, and `object-fit`.
- Tables remain simple and legible in print.
- Cover and closing CTA clearly share the same visual language.

## Export-Safe CSS Patterns

Use patterns like these:

```css
.document {
  display: grid;
  justify-content: center;
  gap: 8mm;
}

.page__inner {
  height: 100%;
  padding: 13mm 16mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}

.figure-shell {
  overflow: hidden;
  border: 1px solid var(--rule);
  background: var(--paper-strong);
}

.figure-shell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media print {
  body {
    padding: 0;
    background: transparent;
  }
  .document {
    display: block;
  }
  .page {
    box-shadow: none;
  }
}
```

## Editing Standards

- Comment major editable regions with HTML comments.
- Name `data-block-id` values by page and role, such as `p7-title`, `p7-table`, `p20-qr`.
- Keep section and class names reusable instead of page-specific whenever possible.
- Keep copy blocks modular so they can be revised without reshaping the entire page.

## Do Not Do These

- Do not think in terms of responsive hero sections.
- Do not make the layout depend on browser height.
- Do not let text auto-flow past the bottom edge and hope print will fix it.
- Do not put the logo or QR in inconsistent positions between issues.
- Do not switch font systems between cover, body, and CTA.
- Do not use one-off inline styles unless a locked template requires it.
