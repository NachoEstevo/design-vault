(() => {
  let stylesheet;
  async function shadowShell() {
    const host = document.createElement("div");
    host.dataset.designShelf = "";
    const root = host.attachShadow({ mode: "open" });
    if (!stylesheet) {
      const response = await fetch(chrome.runtime.getURL("content/modal.css"));
      if (!response.ok)
        throw new Error("No se pudo cargar el modal. Recargá la extensión.");
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      stylesheet = sheet;
    }
    root.adoptedStyleSheets = [stylesheet];
    document.documentElement.append(host);
    return { host, root };
  }
  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, className) {
    const el = element("button", text, className);
    el.type = "button";
    return el;
  }
  async function notify(text, error = false) {
    try {
      const { host, root } = await shadowShell();
      const notice = element("div", text, `notice${error ? " error" : ""}`);
      notice.setAttribute("role", "status");
      root.append(notice);
      setTimeout(() => host.remove(), 6000);
    } catch {
      console.warn("Design Shelf:", text);
    }
  }
  async function open(post, options) {
    const { host, root } = await shadowShell();
    const dialog = element("dialog");
    dialog.setAttribute("aria-labelledby", "ds-heading");
    const form = element("form");
    form.noValidate = false;
    const heading = element("header");
    const brand = element("span", "ds.", "brand-mark");
    const copy = element("div");
    copy.append(element("p", "DESIGN SHELF", "eyebrow"));
    const title = element("h2", "Guardá lo que te inspira.");
    title.id = "ds-heading";
    copy.append(title);
    const close = button("×", "close");
    close.setAttribute("aria-label", "Omitir y cerrar");
    heading.append(brand, copy, close);
    form.append(heading);
    const source = element(
      "p",
      `${post.author} · ${post.text.slice(0, 180)}`,
      "source",
    );
    form.append(source);
    const images = element("div", undefined, "images");
    const checks = [];
    for (const [index, image] of post.images.entries()) {
      const label = element("label", undefined, "image-choice");
      const input = element("input");
      input.type = "checkbox";
      input.checked = true;
      input.setAttribute("aria-label", `Guardar imagen ${index + 1}`);
      checks.push(input);
      const preview = element("img");
      preview.src = image.sourceUrl;
      preview.alt = `Imagen ${index + 1} del post`;
      preview.referrerPolicy = "no-referrer";
      label.append(
        preview,
        input,
        element("span", String(index + 1), "image-number"),
      );
      images.append(label);
    }
    form.append(images);
    const noteLabel = element(
      "label",
      "¿Qué te gustó de esta referencia?",
      "field",
    );
    noteLabel.htmlFor = "ds-note";
    const note = element("textarea");
    note.id = "ds-note";
    note.name = "note";
    note.required = true;
    note.maxLength = 10000;
    note.rows = 3;
    note.placeholder =
      "La jerarquía, los colores, ese detalle que querés recordar…";
    noteLabel.append(note);
    form.append(noteLabel);
    const row = element("div", undefined, "field-row");
    const categoryLabel = element("label", "Carpeta", "field");
    categoryLabel.htmlFor = "ds-category";
    const select = element("select");
    select.id = "ds-category";
    select.required = true;
    const categories = [...options.settings.categories];
    function categoryOptions(selected) {
      select.replaceChildren();
      for (const category of categories) {
        const option = element("option", category.label);
        option.value = category.id;
        select.append(option);
      }
      if (selected) select.value = selected;
    }
    categoryOptions();
    categoryLabel.append(select);
    const add = button("+ Crear carpeta", "text-button");
    categoryLabel.append(add);
    const tagsLabel = element("label", "Etiquetas", "field");
    tagsLabel.htmlFor = "ds-tags";
    const tags = element("input");
    tags.id = "ds-tags";
    tags.placeholder = "minimal, dark, pricing";
    tags.maxLength = 2000;
    tagsLabel.append(tags, element("small", "Separadas por comas.", "hint"));
    row.append(categoryLabel, tagsLabel);
    form.append(row);
    const quickLabel = element("p", "Me interesa:", "quick-label");
    form.append(quickLabel);
    const quick = element("div", undefined, "quick");
    const chosen = new Set();
    for (const tag of [
      "Composición",
      "Color",
      "Tipografía",
      "Espaciado",
      "Interacción",
    ]) {
      const chip = button(tag, "chip");
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", () => {
        if (chosen.has(tag)) {
          chosen.delete(tag);
        } else {
          chosen.add(tag);
        }
        chip.setAttribute("aria-pressed", String(chosen.has(tag)));
      });
      quick.append(chip);
    }
    form.append(quick);
    const newCategory = element("div", undefined, "new-category");
    newCategory.hidden = true;
    const newName = element("input");
    newName.placeholder = "Nombre de la nueva carpeta";
    newName.maxLength = 80;
    newName.setAttribute("aria-label", "Nombre de la nueva carpeta");
    const create = button("Crear", "secondary");
    newCategory.append(newName, create);
    form.append(newCategory);
    const feedback = element("p", undefined, "feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    form.append(feedback);
    const folder = element("p", undefined, "folder");
    const library = button(
      options.settings.folder
        ? `↗ ${options.settings.folder.name}`
        : "Conectar mi carpeta",
      "text-button",
    );
    folder.append(
      element(
        "span",
        options.settings.folder
          ? "Se guarda en "
          : "Primero elegí dónde guardar. ",
      ),
      library,
    );
    form.append(folder);
    if (
      options.settings.folder?.permission !== "granted" &&
      options.settings.folder
    )
      feedback.textContent =
        "El acceso a la carpeta necesita renovarse. Podés conservar el guardado pendiente y reintentarlo desde la biblioteca.";
    const footer = element("footer");
    const skip = button("Omitir", "secondary");
    const save = button("Guardar referencia ↗", "primary");
    save.type = "submit";
    footer.append(skip, save);
    form.append(footer);
    dialog.append(form);
    root.append(dialog);
    let saving = false;
    let creating = false;
    function lock(locked) {
      saving = locked;
      save.disabled = locked;
      skip.disabled = locked;
      close.disabled = locked;
      add.disabled = locked;
      create.disabled = locked;
      select.disabled = locked;
      note.disabled = locked;
      tags.disabled = locked;
      checks.forEach((c) => {
        c.disabled = locked;
      });
      quick.querySelectorAll("button").forEach((b) => {
        b.disabled = locked;
      });
      save.textContent = locked ? "Guardando…" : "Guardar referencia ↗";
    }
    add.addEventListener("click", () => {
      newCategory.hidden = !newCategory.hidden;
      if (!newCategory.hidden) newName.focus();
    });
    create.addEventListener("click", async () => {
      if (!newName.value.trim()) {
        feedback.textContent = "Escribí un nombre para la carpeta.";
        newName.focus();
        return;
      }
      creating = true;
      create.disabled = true;
      save.disabled = true;
      try {
        const result = await options.onAddCategory(newName.value);
        categories.splice(0, categories.length, ...result.categories);
        categoryOptions(result.category.id);
        newCategory.hidden = true;
        feedback.textContent = "Carpeta creada.";
        select.focus();
      } catch (error) {
        feedback.textContent = error.message;
        feedback.classList.add("error");
      } finally {
        creating = false;
        create.disabled = false;
        save.disabled = false;
      }
    });
    library.addEventListener("click", () =>
      options.onOpenLibrary().catch((error) => {
        feedback.textContent = error.message;
      }),
    );
    const completed = new Promise((resolve) => {
      dialog.addEventListener(
        "close",
        () => {
          host.remove();
          if (options.returnFocus?.isConnected) options.returnFocus.focus();
          resolve();
        },
        { once: true },
      );
    });
    close.addEventListener("click", () => {
      if (!saving) dialog.close();
    });
    skip.addEventListener("click", () => {
      if (!saving) dialog.close();
    });
    dialog.addEventListener("cancel", (event) => {
      if (saving || creating) event.preventDefault();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (saving || creating) return;
      const selected = post.images.filter((_, index) => checks[index].checked);
      if (!note.value.trim()) {
        feedback.textContent =
          "Escribí qué te gustó para guardar esta referencia.";
        note.focus();
        return;
      }
      if (!selected.length) {
        feedback.textContent = "Elegí al menos una imagen.";
        return;
      }
      lock(true);
      feedback.classList.remove("error");
      feedback.textContent = "Descargando imágenes y guardando tu nota…";
      try {
        // Folder setup can happen in the library while this draft stays open.
        options.settings = await options.onRefreshSettings();
        if (!options.settings.folder)
          throw new Error(
            "Conectá una carpeta desde la biblioteca y volvé a guardar.",
          );
        const result = await options.onSave({
          ...post,
          note: note.value,
          category: categories.find((c) => c.id === select.value),
          tags: [
            ...new Set([
              ...tags.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              ...chosen,
            ]),
          ],
          images: selected,
        });
        if (!["saved", "duplicate", "pending"].includes(result.status))
          throw new Error("Respuesta de guardado inválida.");
        dialog.close();
        notify(
          result.status === "saved"
            ? "Referencia guardada en tu biblioteca."
            : result.status === "duplicate"
              ? "Este post ya estaba en tu biblioteca."
              : `Referencia pendiente. ${result.error || "Reintentá desde la biblioteca."}`,
          result.status === "pending",
        );
      } catch (error) {
        feedback.textContent = error.message;
        feedback.classList.add("error");
        lock(false);
      }
    });
    dialog.showModal();
    note.focus();
    return completed;
  }
  globalThis.DesignShelfModal = { open, notify };
})();
