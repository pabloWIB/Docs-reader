# Docs Reader

A browser PDF reader that also reads out loud, highlighting each word on the page as it is spoken.

[![Live demo](https://img.shields.io/badge/demo-pablowib.github.io/Docs-Reader-2ea44f)](https://pablowib.github.io/Docs-Reader)
[![Hire me on Fiverr](https://img.shields.io/badge/Hire%20me%20on-Fiverr-1DBF73?style=for-the-badge&logo=fiverr&logoColor=white)](https://www.fiverr.com/pablonietop)
![Dependencies](https://img.shields.io/badge/npm%20dependencies-0-brightgreen)
![Build step](https://img.shields.io/badge/build%20step-none-lightgrey)

## Description

PDF.js draws each page to a `<canvas>`, and the Web Speech API reads the page's
text through whatever voices the operating system provides. A transparent layer
of positioned boxes sits over the canvas, and the word currently being spoken is
lit up in place, so the page you are looking at and the voice you are hearing
stay in sync.

Documents come from two places: the `pdf/` directory, listed on the opening
screen, or the reader's file picker, which opens a document straight from your
machine. There is no upload endpoint and no server-side code — a locally picked
file is read into an `ArrayBuffer` and handed to PDF.js in the same tab.

Three details are worth calling out, because they are what make the reader
usable on a four-hundred page book:

- **Pages render on demand.** Each page block reserves its space from the
  document's own aspect ratio, an `IntersectionObserver` draws it just before it
  scrolls into view, and canvases more than four pages away are released. Opening
  a 400-page book holds around 13 MB of canvas rather than 1.5 GB.
- **Text is extracted one page ahead, not all at once.** Playback starts as soon
  as a single page has been parsed, and memory does not grow with the length of
  the document.
- **Highlighting is O(1) per word.** Only the spans that changed are touched, so
  the cost of following along does not scale with the size of the book.

Word boxes are stored as percentages of the page rather than pixels, so they stay
aligned with the canvas at any window width.

The reader is installable. `site.webmanifest` and the icon set are wired up, so
it can be added to a home screen and opened as a standalone app.

## Features

- PDF rendering to canvas via PDF.js, identical across browsers.
- Read aloud through the Web Speech API, with word-level highlighting on the page.
- Voice picker grouped by language, listing every voice the system exposes.
- Speed control from 0.5× to 2.5×, applied without losing your place.
- Play, pause, resume and stop; resuming continues from the exact word.
- Page navigation by button or arrow keys, `Escape` to return to the library.
- Opens local PDFs through a file picker; nothing leaves the browser.
- Reading progress bar across the whole document.
- Installable as a PWA, with icons from 96px to 512px.
- No build step, no bundler, no npm dependencies.

## Tech stack

| Layer | Technology | Version | Role in project |
|---|---|---|---|
| Markup | HTML5 | — | `index.html` and `404.html`, both static |
| Styles | CSS custom properties | — | Three files: tokens and reset, layout, components |
| Scripts | ES modules | — | `main.js` plus four modules, no bundler |
| Rendering | PDF.js | 3.11.174, from cdnjs with SRI | Draws pages to canvas, extracts text geometry |
| Speech | Web Speech API | — | `SpeechSynthesis`, using the operating system's voices |
| Lazy rendering | IntersectionObserver | — | Decides which pages hold a live canvas |
| PWA | Web App Manifest | — | `site.webmanifest` plus the icon set |

## Browser support

Rendering and navigation work anywhere PDF.js does. Read-aloud needs
`speechSynthesis` and at least one installed voice; where that is missing the
voice controls hide themselves and the document stays readable.

Word-level highlighting depends on `boundary` events from the speech engine.
Engines that do not emit them still advance the highlight once per chunk of
about two dozen words, so the page keeps following the voice.

## Project structure

```
.
├── index.html                  # Library screen and reader screen, one page
├── 404.html                    # Error page, links back to the library
├── site.webmanifest            # PWA manifest, icons and theme colours
├── robots.txt                  # Allows the site, excludes pdf/ from indexing
├── sitemap.xml                 # One entry: the site root
├── assets/
│   ├── css/
│   │   ├── base.css            # Tokens, reset, base type, focus, utilities
│   │   ├── layout.css          # Screens, library shell, reader shell, breakpoints
│   │   └── components.css      # Buttons, book list, form controls, progress
│   ├── js/
│   │   ├── main.js             # Entry point: collects elements, wires modules
│   │   └── modules/
│   │       ├── library.js      # Book list delegation and the local file picker
│   │       ├── pdf-view.js     # Lazy page rendering and word geometry
│   │       ├── speech.js       # Web Speech wrapper, chunking, boundary mapping
│   │       └── reader.js       # Playback state and the reader UI
│   └── img/icons/              # favicon.ico, 96px, apple-touch, 192px, 512px
├── docs/
│   ├── auditoria.md            # State of the project before the reorganisation
│   └── cambios.md              # What changed, grouped by phase
└── pdf/                        # Documents listed on the library screen
```

## Running it locally

The reader **must be served over HTTP**. Under `file://` the browser blocks both
ES modules and the PDF fetch; opening `index.html` from disk shows a styled
notice saying exactly that rather than a blank page.

```bash
git clone https://github.com/pabloWIB/Docs-Reader.git
cd Docs-Reader
npx serve .
```

Open the address `serve` prints. Any static server works — for example
`python -m http.server 8000` if Node is not around.

## Adding a document

Drop the file into `pdf/` and add one entry to the list in `index.html`. The
button carries its own data, so nothing in the JavaScript needs touching:

```html
<li class="book-list__item">
  <button class="book" type="button" data-pdf="pdf/your-document.pdf"
    data-title="Your Document" data-author="Author Name">
    <span class="book__num" aria-hidden="true">03</span>
    <span class="book__body">
      <span class="book__title">Your Document</span>
      <span class="book__author">Author Name</span>
    </span>
    <span class="book__go" aria-hidden="true">→</span>
  </button>
</li>
```

Readers who just want to open something of their own do not need this: the file
picker on the library screen takes any PDF from their machine.

## Keyboard

| Key | Action |
|---|---|
| `Escape` | Leave the reader and return to the library |
| `←` | Previous page |
| `→` | Next page |

Everything else is reachable by `Tab`, in the order it appears on screen.

## The documents currently in `pdf/`

This repository is public and serves two commercially published, in-copyright
books. That is redistribution, and it should be resolved before the project is
shown as portfolio work.

Nothing in the code depends on those two files. Replace them with a document you
hold the rights to — a public-domain text, your own writing, a technical
specification — update the two entries in `index.html`, and the reader behaves
exactly the same.

## Deployment

Deployed on GitHub Pages at [pablowib.github.io/Docs-Reader](https://pablowib.github.io/Docs-Reader).
Static: publish the repository root as-is, with no build command and no output
directory. Everything under `pdf/` is served publicly.

If the host supports it, point its not-found handler at `404.html`; the page uses
root-relative asset paths so it renders correctly from any depth.

## Configuration

There are no API keys, tokens or environment variables in this project, and no
backend to hold any. The only external request is PDF.js from cdnjs, pinned to
3.11.174 and verified with a subresource integrity hash.

## Author

**Pablo Nieto Pérez** — [wib.digital](https://wib.digital)
GitHub: [@pabloWIB](https://github.com/pabloWIB)

## Hire me

I build **custom internal tools, CRMs and dashboards** for small teams, and
**conversion-focused websites** for businesses.

- [Custom internal tool, CRM or dashboard](https://www.fiverr.com/pablonietop/build-a-custom-internal-app-for-your-business) — from $45
- [Conversion-focused website](https://www.fiverr.com/pablonietop/convert-your-landing-page-design-to-code) — from $80
- [All my services on Fiverr](https://www.fiverr.com/pablonietop)
- [wib.digital](https://wib.digital)
