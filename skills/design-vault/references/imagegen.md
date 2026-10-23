# Backgrounds and assets with ImageGen

Use the image-generation tool actually available in the session and its documented schema. Integrated tools do not require this skill to supply an API key. Do not automatically install an SDK or switch to a paid API/CLI if the tool is missing. Follow relevant guidance from an available ImageGen skill.

Select and inspect references first. View each chosen local image before supplying it as context. With `image_gen.imagegen`, use `referenced_image_paths` when every input has a local path, or the smallest sufficient `num_last_images_to_include` when an input lacks one; never both. Omit both for a new image without visual inputs. Follow other environments' documented mechanisms when different.

Define a concise brief:

- Role: hero background, card texture, illustration, object, or transparent asset.
- References: each input's contribution and what the project's direction preserves.
- Direction: composition, palette, materials, and detail.
- Integration: aspect ratio, clear text areas, contrast, and real transparency where needed.
- Constraints: avoid accidental text, unrelated logos, unnecessary content, and literal copying.

Generate an initial proposal, inspect it, and adjust with a focused change if needed. Use ImageGen for requested raster assets; use native resources for simple shapes or an existing SVG system where appropriate. Hero imagery must not contain functional interface text or buttons unless the request is a raster mockup.

Show actual generated output through the native result mechanism. Codex may save it under its generated-image directory; copy selected outputs into the project when needed using the real returned path. Do not invent destination parameters or leave project assets only in cache. Preserve transparency and do not overwrite existing assets without a replacement request.

Save final prompts and output paths with project deliverables. Never add generations to the vault automatically: it reflects user-selected references. When generation is unavailable, label a prepared specification as pending rather than a generated image.
