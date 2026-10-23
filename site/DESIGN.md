# Design Vault landing — design notes

## Brief

Subject: Design Vault, an agent skill plus a capture extension. Audience: developers who build pages with Claude Code or Codex. Job: get them to run one install command, and show the owner path (capture on like) as the story. Language: English (public tooling is English).

## References used (from the owner's Design Shelf, inspected at full size)

| ID | Taken | Not adopted |
| --- | --- | --- |
| `2105644004931170616:0` (cobalt cyanotype, paper card) | Saturated cobalt field, a paper card sitting on it, vertical metadata on the card's edges | The typewriter serif, the wave texture |
| `2106242713754783778:0` (auren studio page) | A row of photographs with staggered heights crossing the page edge to edge; very large tight grotesk headings | The centered three-line statement |
| `2088269466941759966:0` (Relay) | Product interface sitting directly on a photograph | Grid-line background, numbered side index |
| `2104537313560908137:0` (Agentic Fabriq) | Pixel cells as the material of a transition | Dark navy palette, checker patterns, electric cyan |

## Concept card

```
Idea:        Your agent studies the pictures you liked and writes down what they taught, so it lasts.
Metaphor:    Cyanotype printing: light exposes an image onto paper. Here an image is exposed into words.
Signature:   "Develop": a liked photograph dissolves cell by cell into its written description while the reader scrolls (pinned, scrubbed).
Emotion:     Calm precision, with one moment of quiet magic.
Motion verb: Expose like a print: things appear by wiping and revealing, never by sliding in.
Screenshot:  The half-developed frame: photograph pixels on the left breaking into the description's words on the right.
```

Concepts considered: (1) the like as a shutter, a contact sheet of exposures (portable to any bookmarking tool); (2) a library card catalogue (portable to any archive product); (3) seen first, then written (only true of Design Vault: your agent studies the originals, and the shared service returns the written version to agents without the library). Chose 3.

## System

- Palette: cobalt `#0a3fae` (ground of hero, try, footer), deep cobalt `#062c80`, wash `#bcd6f2`, paper `#f3f3eb`, ink `#0b1530`, muted `#4f5a6e`. Paper on cobalt 8.1:1, ink on paper 16.2:1, muted on paper 6.2:1.
- Photographs: grayscale, then cobalt screened over them, so darks become cobalt and lights stay paper. One treatment for every picture.
- Type: Geist (display 600, text 400) and Geist Mono for real data only (IDs, hex values, commands, edge labels). Display tracking -0.055em at the largest size, leading 0.9.
- Grid: 12 columns, 24px gutter, margins clamp(16px, 2.5vw, 40px). Radius: 0 everywhere except inputs and buttons at 4px.
- Motion: one ease (`expo.out` for entrances, `none` for scrubs), GSAP ticker as the only clock, Lenis for smooth scroll (off under reduced motion). Entrances are clip-path wipes; hovers wipe a cobalt fill across.
- Idle: the hero's photo strip drifts slowly on the ticker; paused off screen and under reduced motion.

## Sections

```
Hero (cobalt)      [ strip of cyanotype photos, staggered heights, edge to edge ]
                   [            paper card: h1, line, two actions            ]
Develop (paper)    [ steps text (4 cols) | pinned canvas: photo -> description (8 cols) ]
Path (paper)       [ four full-width rows: big word | sentence | real artifact ]
Try (cobalt)       [ heading + form (5 cols) | result cards on cobalt (7 cols) ]
Install (paper)    [ poster-size command, agent switch, what it changes ]
Questions (paper)  [ heading (4) | two-column details (8) ]
Footer (cobalt)    [ links, credits | giant wordmark bleeding off the bottom ]
```

Stack: static HTML, CSS and one script, GSAP and Lenis pinned from jsDelivr. The repository is a skill and extension repo with no web build; the landing must not add npm dependencies to the published package.
