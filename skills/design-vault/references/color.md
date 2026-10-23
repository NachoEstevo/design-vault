# Color by role

A palette is a set of roles, not a list of colors. Decide the roles first, then pick values that fit the direction and the brand.

| Role | Purpose | Typical count |
| --- | --- | --- |
| Surface | Page and section backgrounds, including one alternate surface | 2–3 |
| Ink | Headings and body text, plus one muted level for secondary text | 2 |
| Line | Borders, dividers, and input outlines | 1 |
| Accent | Primary action, focus, selection, and the signature moment | 1, rarely 2 |
| State | Success, warning, and error, only where the interface has them | as needed |

## Choosing values

- Give neutrals a temperature (warm paper, cool gray, green-black) that agrees with the accent. Pure `#000` on pure `#fff` is a choice, not a default.
- Spend the accent. If it appears on every heading, card, and icon, it no longer marks the action.
- Take a reference's palette as a relationship (dark ground with one warm accent, pale ground with ink and photography), not as exact hex values. Photographed screens shift color.
- Alternate surfaces to separate sections before adding borders, shadows, or gradients.
- Define colors as tokens and reuse them. Equivalent elements share a token.

## Checks

- Body text and essential UI reach 4.5:1 against their surface; large headings and component boundaries reach 3:1.
- Focus rings stay visible on every surface they can appear on.
- Text over images or generated backgrounds stays readable at every crop; add a scrim or move the text rather than hoping.
- If a dark theme exists, rebuild the roles for it instead of inverting values: lower accent saturation, raise muted text, and recheck contrast.
