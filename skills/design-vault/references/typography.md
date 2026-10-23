# Preferred typography catalog

Priority: explicitly requested font → project/brand font → vault defaults. If a requested font is unavailable, explain and suggest an alternative instead of silently substituting it.

Normally propose one or two justified options. Add display type only when it contributes character. Do not choose Inter automatically or rotate fonts during iterations of one design.

| Intended role | Options |
| --- | --- |
| Interface and reading | Inter, Geist, TikTok Sans, Liberation Sans |
| Restrained direction | Arial, Helvetica Neue |
| Display or editorial | Faculty Glyphic, DejaVu Serif |
| Geometric direction | Euclid Circular B |
| Japanese writing | Yu Gothic |
| Requires file/foundry identification | Connections, Practa, Youth Touch DEMO |
| Symbols only, never body copy or text headings | Webdings |

## Openly licensed pairings

When the project has no font and the owner's list does not fit, these pairings are distributable as webfonts (SIL OFL) and cover Latin accents. Verify the current license and files before shipping.

| Direction | Display | Text | Code or data |
| --- | --- | --- | --- |
| Product, developer tool | Geist | Geist | Geist Mono |
| Editorial, warm | Instrument Serif or Fraunces | Inter | — |
| Technical, precise | Space Grotesk | Inter | JetBrains Mono |
| Expressive, contemporary | Bricolage Grotesque | Geist | — |

## Scale and setting

- Use a few sizes from one ratio (about 1.2 for interfaces, 1.25–1.333 for landings). Fluid `clamp()` for headings; stable sizes for body and controls.
- Body: 16–18 px, line height 1.5–1.65, 60–75 characters per line.
- Large display: line height 0.95–1.1 and slightly negative tracking, tighter as size grows; loosen tracking for small uppercase or mono labels instead.
- Two families are usually enough. A mono face earns its place when the page shows code, commands, or data.

These are suggestions, not proof of availability or distribution rights. Verify files, variants, languages, accents, numbers, and weights. Desktop installation does not establish permission to redistribute a webfont. Keep relevant licenses with project assets. Avoid unverified demo versions and simulated weights.

Check actual font loading, fallbacks, wrapping, and density at the sizes used. A font-family declaration does not prove which font rendered. Check numerical readability, tabular figures where available, and ambiguous characters for dashboards.

Primary sources:

- [Inter](https://rsms.me/inter/)
- [Geist](https://github.com/vercel/geist-font)
- [TikTok Sans](https://github.com/tiktok/TikTokSans)
- [Euclid](https://www.swisstypefaces.com/fonts/euclid/)
- [Yu Gothic](https://learn.microsoft.com/en-us/typography/font-list/yu-gothic)
- [Webdings](https://learn.microsoft.com/en-us/typography/font-list/webdings)

Do not identify Connections, Practa, or Youth Touch DEMO by name alone. Ask for the file or verify its origin when needed.
