# Design guidelines

## Editable preferences

These defaults reflect the original owner's preferences. Apply them unless the user requests an exception or an existing brand creates a conflict that needs explicit resolution. A reference screenshot does not override them.

- Do not add decorative labels above headings: eyebrows, overlines, or numbered captions. Avoid decorative dot-plus-label combinations. Functional list bullets and real status indicators are allowed.
- Put descriptions directly below their heading with the same left or center alignment. Do not separate a title on the left from its subtitle in a right-hand column. Functional metadata belongs to its own element.
- Use horizontal space. Avoid artificially narrow title/subtitle columns and forced breaks that fragment sentences. Allow natural mobile wrapping and comfortable line lengths for prose.
- Main and section headings may take at most two lines. Adjust width, responsive scale, and copy without truncation, clamping, clipping, or tiny text. Check loaded fonts on mobile, desktop, and ultrawide. Resolve imposed headings that cannot fit legibly with the user.
- Never use `✳` or a substitute decorative star/asterisk serving the same purpose.
- Define what a custom icon communicates before adding it. Omit corner decoration without meaning. Useful icons should be specific, legible, and coherent rather than unrelated basic geometry.
- Use arrows only to clarify actions or direction. Do not repeat `↗` on every CTA, card, or internal link. Clear wording may be enough.
- Use viewport-height composition only where the content warrants it. Prefer `min-height` and appropriate viewport units, subtracting the header where needed. Avoid fixed heights that crop content, mandatory scroll snapping, and huge mobile gaps. Content may exceed the viewport.
- Keep short transitions compact or integrate them into the next section. Air should support reading and comparison, not create an empty screen. Add content only to answer real visitor questions.
- Check both viewport width and height on desktop and ultrawide. Use grids, images, and wide headings without stretching reading paragraphs indefinitely or trapping everything in a narrow column.
- Contain large-screen compositions with a responsive maximum width. Backgrounds may remain full width; content and cards should not grow endlessly edge to edge.
- Include purposeful reveals, brief entrance choreography, and relevant microinteractions when appropriate. Define each effect's role: hierarchy, orientation, feedback, or expression. Do not add loops, parallax, or movement everywhere. Coordinate easing and short staggers; usually reveal once.
- Expressive landing motion should be visible at normal speed, beyond a faint fade and tiny hover everywhere. Choose a few recognizable moments: masked text, settling images, layered pieces, or meaningful object responses. Adapt intensity to scale and context. See [motion.md](motion.md) and review video without making reading or scrolling a wait.
- Prefer `transform` and `opacity`, with color feedback where appropriate. Avoid layout animation and `transition: all`. Restrict hover to capable pointers, with keyboard and touch feedback. Never delay functional clicks or focus for motion.
- Respect `prefers-reduced-motion`, including changes during a session. Keep content visible without JavaScript or optional observation APIs. Immediately reveal keyboard-focused content. Check entrances, scroll, hover/press, dialogs, and reduced motion; still images do not verify animation.

## Avoid the default template

Generated pages tend to converge on one layout. Treat these as signals to reconsider, not as banned shapes; keep one when the content genuinely calls for it:

- A centered hero, a row of three identical icon cards, a logo strip, and a gradient CTA band, in that order.
- Purple-to-blue or mesh gradients, glass panels, and glow used as a substitute for a palette decision.
- Generic icons in tinted circles standing in for real content, screenshots, or samples.
- Every section with the same width, alignment, padding, and heading size.
- Invented testimonials, logos, metrics, or "trusted by" rows.

Instead, let one reference set the composition, vary section rhythm by content (a full-bleed moment, a dense comparison, a quiet text block), and show the actual product: real commands, real output, real interface states.

## General criteria

- Resolve content, hierarchy, audience, and the primary action before decoration. Preserve project brands and components unless redesign is requested.
- Headings should state what is offered, delivered, solved, or happening. Avoid abstract phrases that imitate identity without meaning. Write the proposition plainly first, then add character. Subtitles add information rather than another abstraction. Do not invent customers, outcomes, metrics, or advantages.
- Derive one coherent direction from a primary reference and a few compatible contributions. Explain what is useful and what belongs only to the source screenshot.
- Let content determine component anatomy. A service card may need a sample, scope, included items, and an action. Do not default every card to title + paragraph + list. Product imagery can demonstrate an approach without importing another product or inventing data. Identify illustrative samples; apparently interactive controls must work.
- Make type scale, color, spacing, grid, border, and state decisions reusable. Avoid arbitrary differences between equivalent elements.
- Give texture, illustration, and motion a function. The vault requires neither minimalism nor permanent decoration.
- Check realistic long text, loading, empty, error, and success states. A screenshot's appearance does not prove interaction.
- Check small screens, keyboard navigation, visible focus, contrast, and reduced motion. Essential text and controls must not exist only inside images.
- Choose type for function and character using [typography.md](typography.md). Do not guess an exact family from a screenshot.
- Build color by role using [color.md](color.md): one accent with a job, neutrals with a temperature, and checked contrast.
- Give the design its own rationale: composition from one reference, rhythm from another, a compatible palette from a third. Do not combine complete competing visual languages.
- Retain reference IDs and source links. Distinguish observations, the user's written intent, and new decisions.

Variety applies among relevant choices. Iterations retain a project's direction; new projects or explicit alternatives may explore another. Do not promise difference when the catalog lacks options.
