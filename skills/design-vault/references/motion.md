# Landing-page motion

A warm, professional landing can have clearly visible movement. Choose two or three compatible devices and choreograph them rather than fading everything identically or copying a product demo that does not exist in the project.

## Adaptable patterns

These patterns are independent of the author's local projects. Use only what serves the content and verify it in a browser.

- **Editorial entrance:** words rise from masks while images open and settle. Keep text selectable and accessible, with natural wrapping and bounded stagger.
- **Product depth:** a product frame enters with depth; a manipulable object represents real product information. An interaction needs an object and a reason. Do not add stickers or dragging as decoration.
- **Layered pieces:** folders, sheets, or packaging enter in a sequence and lift on hover. Adapt this to actual deliverables, with clear reading order and function.

## Choose and verify

1. Define the principal moment: hero, work, or demonstration. Decide what the visitor should recognize. An entrance may last longer than control feedback, but must not delay actions.
2. Give entrance and pointer response distinct wrappers or property ownership. Prefer transform/opacity. A text/image `clip-path` may help; check clipping and performance in the target browser rather than assuming all masks are free or accelerated.
3. Review at normal speed. The effect should be apparent without searching for it. Scale amplitude and rhythm to each element rather than using one displacement for headings, images, and buttons. Keep reading stable between a few prominent moments.
4. Check hover in both directions, quick clicks, keyboard focus, touch, scroll entry, and reduced-motion changes during a session. Do not leave objects hidden, covering text, or blocking content. Revealing on Tab must not move a pointer target between pointerdown and click. Test during entrances and retain static fallbacks without JavaScript or optional APIs.
5. Record intermediate and final states. For word-based headings, check accessible names, selection, accents/descenders, and two-line limits after fonts load. Leave horizontal and vertical mask margins around glyphs, especially with negative tracking; compensate without changing wrapping. Remove clipping after entry and in static, focus, and reduced-motion states. A fitting text box does not prove glyphs are intact; inspect the rendered font.
