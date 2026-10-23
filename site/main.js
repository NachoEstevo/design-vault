// Design Vault landing. One clock (GSAP's ticker), one signature: a picture developed into words.
(() => {
  const SERVICE = "https://design-vault.nachoestevo.workers.dev";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const animated = Boolean(gsap && ScrollTrigger) && !reduced;

  // ---------------------------------------------------------------------------
  // The plate: a cyanotype of the photograph, dissolving cell by cell into the
  // description underneath. Only drawing is used, so the image needs no CORS.
  // ---------------------------------------------------------------------------
  const plate = $("[data-plate]");
  const plateImg = $("[data-plate-img]");
  const platePct = $("[data-plate-pct]");
  const steps = $$("[data-steps] li");
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const ctx = plate.getContext("2d");
  let tone, cells, grid, progress = 0, ready = false;

  function cover(target, w, h) {
    const scale = Math.max(w / plateImg.naturalWidth, h / plateImg.naturalHeight);
    const dw = plateImg.naturalWidth * scale, dh = plateImg.naturalHeight * scale;
    target.drawImage(plateImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function cyanotype(canvas) {
    const c = canvas.getContext("2d");
    c.globalCompositeOperation = "screen";
    c.fillStyle = "#0a3fae";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.globalCompositeOperation = "source-over";
  }

  function preparePlate() {
    if (!plateImg.complete || !plateImg.naturalWidth) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const box = plate.getBoundingClientRect();
    if (!box.width) return;
    plate.width = Math.round(box.width * dpr);
    plate.height = Math.round(box.height * dpr);
    const cell = Math.max(10, Math.round(box.width / 34)) * dpr;
    grid = { cols: Math.ceil(plate.width / cell), rows: Math.ceil(plate.height / cell), cell };

    tone = document.createElement("canvas");
    tone.width = plate.width;
    tone.height = plate.height;
    const t = tone.getContext("2d");
    t.filter = "grayscale(1) contrast(1.2) brightness(1.06)";
    cover(t, tone.width, tone.height);
    t.filter = "none";
    cyanotype(tone);

    // One pixel per cell: the averaged colour each block shows while it breaks up.
    cells = document.createElement("canvas");
    cells.width = grid.cols;
    cells.height = grid.rows;
    const s = cells.getContext("2d");
    s.imageSmoothingQuality = "high";
    s.drawImage(tone, 0, 0, grid.cols, grid.rows);
    ready = true;
    drawPlate(progress);
  }

  function drawPlate(p) {
    progress = p;
    platePct.textContent = `${Math.round(p * 100)}%`;
    const active = p < 0.22 ? 0 : p < 0.66 ? 1 : 2;
    steps.forEach((step, i) => step.classList.toggle("is-on", reduced || i === active));
    if (!ready) return;
    const { cols, rows, cell } = grid;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, plate.width, plate.height);
    ctx.drawImage(tone, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sweep = p * 1.45 - 0.2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const threshold = 0.66 * (i / cols) + 0.08 * (j / rows) + 0.3 * BAYER[(j % 4) * 4 + (i % 4)];
        const t = Math.min(1, Math.max(0, (sweep - threshold) / 0.22));
        if (t === 0) continue;
        const x = i * cell, y = j * cell;
        ctx.clearRect(x, y, cell, cell);
        if (t >= 1) continue;
        const size = cell * (1 - t) * 0.92;
        ctx.drawImage(cells, i, j, 1, 1, x + (cell - size) / 2, y + (cell - size) / 2, size, size);
      }
    }
  }

  plateImg.addEventListener("load", preparePlate);
  preparePlate();
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(preparePlate, 150); });

  // ---------------------------------------------------------------------------
  // Without motion (reduced motion, or the libraries did not load): a composed
  // still. Everything visible, the plate held at its half-developed frame.
  // ---------------------------------------------------------------------------
  if (!animated) {
    $$("[data-reveal], [data-intro]").forEach((el) => { el.style.opacity = 1; });
    drawPlate(0.55);
    wireInteractions(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const lenis = window.Lenis ? new window.Lenis({ autoRaf: false, lerp: 0.11 }) : null;
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Hero intro: the references expose from the bottom, the card opens, the words rise.
  const title = $("[data-split]");
  title.innerHTML = title.textContent.trim().split(/\s+/)
    .map((word) => `<span class="split-word"><span>${word}</span></span>`).join(" ");
  const shots = $$(".shot");
  const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
  intro
    .fromTo(shots, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.4, stagger: 0.06 }, 0)
    .fromTo("[data-card]", { clipPath: "inset(48% 0 48% 0)" }, { clipPath: "inset(0% 0 0% 0)", duration: 1.2, clearProps: "clipPath" }, 0.25)
    .fromTo(".split-word > span", { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.05 }, 0.55)
    .fromTo("[data-intro]", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.85)
    .fromTo(".card .edge", { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.0);

  // Idle: the strip of references drifts on the shared clock, faster while scrolling.
  const track = $("[data-strip]");
  [...track.children].forEach((shot) => track.append(shot.cloneNode(true)));
  let drift = 0, stripVisible = true;
  gsap.ticker.add((time, delta) => {
    if (!stripVisible) return;
    const velocity = lenis ? Math.abs(lenis.velocity) : 0;
    drift -= (delta / 1000) * (22 + velocity * 9);
    const loop = track.scrollWidth / 2;
    if (-drift >= loop) drift += loop;
    gsap.set(track, { x: drift });
  });
  ScrollTrigger.create({ trigger: ".hero", start: "top bottom", end: "bottom top", onToggle: (self) => { stripVisible = self.isActive; } });
  gsap.to("[data-card]", { yPercent: -10, scale: 0.96, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  // The signature: pinned while the photograph is developed into its description.
  ScrollTrigger.create({
    trigger: "[data-develop]",
    start: "top top",
    end: () => `+=${innerHeight * 1.7}`,
    pin: true,
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => drawPlate(self.progress),
  });

  // Entrances: each part wipes in once, in reading order.
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: (batch) => gsap.fromTo(batch.filter((el) => !el.dataset.shown && (el.dataset.shown = "1")),
      { opacity: 0, y: 28, clipPath: "inset(0 0 100% 0)" },
      { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 1.1, ease: "expo.out", stagger: 0.07, clearProps: "clipPath,transform" }),
  });
  // Keyboard focus never waits for an entrance.
  document.addEventListener("focusin", (event) => {
    const hidden = event.target.closest?.("[data-reveal]");
    if (hidden) { hidden.dataset.shown = "1"; gsap.killTweensOf(hidden); gsap.set(hidden, { opacity: 1, y: 0, clipPath: "none" }); }
  });

  // The index words expose with the scroll, left to right.
  $$(".row-word").forEach((word) => gsap.fromTo(word, { clipPath: "inset(0 100% 0 0)" }, {
    clipPath: "inset(0 0% 0 0)", ease: "none",
    scrollTrigger: { trigger: word, start: "top 92%", end: "top 55%", scrub: true },
  }));

  // The giant name rises out of the footer.
  gsap.fromTo(".giant", { yPercent: 40 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: true } });

  // Navigation: its tone follows the section under it; it steps aside while reading down.
  const nav = $("[data-nav]");
  $$(".hero, .develop, .path, .try, .install, .faq, .foot").forEach((section) => {
    const tone = section.matches(".hero, .try, .foot") ? "cobalt" : "paper";
    ScrollTrigger.create({
      trigger: section, start: "top 36px", end: "bottom 36px",
      onToggle: (self) => { if (self.isActive) document.documentElement.dataset.tone = tone; },
    });
  });
  if (lenis) lenis.on("scroll", ({ direction, scroll }) => nav.classList.toggle("is-hidden", direction > 0 && scroll > innerHeight * 0.6));

  wireInteractions(lenis);
  addEventListener("load", () => ScrollTrigger.refresh());

  // ---------------------------------------------------------------------------
  // Interactions that work with or without motion.
  // ---------------------------------------------------------------------------
  function wireInteractions(scroller) {
    $$('a[href^="#"]').forEach((link) => link.addEventListener("click", (event) => {
      const target = link.getAttribute("href") === "#top" ? document.body : $(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      if (scroller) scroller.scrollTo(target, { duration: 1.4 });
      else target.scrollIntoView();
      history.replaceState(null, "", link.getAttribute("href"));
    }));

    function radios(group, onChange) {
      const options = $$('[role="radio"]', group);
      const choose = (option) => {
        options.forEach((o) => { o.setAttribute("aria-checked", String(o === option)); o.tabIndex = o === option ? 0 : -1; });
        onChange(option);
      };
      options.forEach((option) => option.addEventListener("click", () => choose(option)));
      group.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        const index = options.indexOf(document.activeElement);
        const next = options[(index + (/Right|Down/.test(event.key) ? 1 : -1) + options.length) % options.length];
        next.focus();
        choose(next);
      });
    }

    const el = (tag, className, text) => Object.assign(document.createElement(tag), className ? { className } : {}, text != null ? { textContent: text } : {});

    // Install: the same installer, pointed at each agent's skills folder. Each button copies its own.
    const base = "npx --yes --package=github:NachoEstevo/design-vault design-vault";
    const commands = {
      "claude-win": { label: "Claude Code on Windows", shell: "PowerShell", text: `${base} --skills-root "$env:USERPROFILE\\.claude\\skills"` },
      "claude-unix": { label: "Claude Code on macOS or Linux", shell: "your terminal", text: `${base} --skills-root ~/.claude/skills` },
      codex: { label: "Codex", shell: "your terminal", text: base },
    };
    const list = $("[data-commands]");
    Object.values(commands).forEach(({ label, text }) => {
      const value = el("dd");
      value.append(el("code", "", text));
      list.append(el("dt", "", label), value);
    });
    const status = $("[data-install-status]");
    const suggested = /Win/.test(navigator.userAgent) ? "claude-win" : "claude-unix";
    $(`[data-installer="${suggested}"]`).classList.add("is-yours");
    $$("[data-installer]").forEach((button) => button.addEventListener("click", async () => {
      const { label, shell, text } = commands[button.dataset.installer];
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
      const name = $("[data-label]", button);
      if (ok) {
        button.classList.add("is-copied");
        $("use", $(".installer-act", button)).setAttribute("href", "#i-check");
        name.textContent = "Copied";
        status.textContent = `Copied the ${label} command. Paste it in ${shell}.`;
        setTimeout(() => {
          button.classList.remove("is-copied");
          $("use", $(".installer-act", button)).setAttribute("href", "#i-copy");
          name.textContent = "Copy command";
        }, 2200);
      } else {
        list.closest("details").open = true;
        status.textContent = "Your browser blocked the clipboard. The commands are listed below.";
      }
    }));

    // Try a brief: a real request to the shared description service.
    const form = $("[data-try]");
    const results = $("[data-results]");
    const go = $("[data-go]");
    let components = ["hero", "cards", "footer"];
    radios($(".scope", form), (option) => { components = option.dataset.components.split(" "); });
    const session = `landing-${Math.random().toString(36).slice(2, 10)}`;

    function card(ref) {
      const item = el("article", "ref");
      item.append(el("p", "edge edge-l", ref.category || "reference"), el("p", "edge edge-r", String(ref.id || "").slice(0, 8)));
      $$(".edge", item).forEach((edge) => edge.setAttribute("aria-hidden", "true"));
      item.append(el("p", "ref-body", ref.description || "Metadata only; not reviewed yet."));
      if (ref.signature) item.append(el("p", "ref-body", `Worth taking: ${ref.signature}`));
      if (ref.colors?.length) {
        const swatches = el("p", "swatches");
        ref.colors.slice(0, 5).forEach((hex) => { const s = el("code", "", hex); s.style.setProperty("--c", hex); swatches.append(s); });
        item.append(swatches);
      } else if (ref.palette?.length) {
        item.append(el("p", "ref-meta", ref.palette.slice(0, 4).join(" · ")));
      }
      if (ref.uncertainty) item.append(el("p", "ref-unc", ref.uncertainty));
      return item;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = $("#brief").value.trim();
      if (!query) { $("#brief").focus(); return; }
      const button = go.closest("button");
      button.disabled = true;
      go.textContent = "Reading the vault…";
      try {
        const response = await fetch(`${SERVICE}/v1/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, components, session, limit: 5 }),
        });
        if (response.status === 429) throw new Error("The shared vault is busy. Try again in a minute.");
        if (!response.ok) throw new Error("The vault did not answer this time. Try again shortly.");
        const data = await response.json();
        const refs = Array.isArray(data.references) ? data.references.slice(0, 5) : [];
        results.replaceChildren(...(refs.length ? refs.map(card) : [el("p", "ref-error", "No reviewed reference fits that brief yet. Name a layout, a mood or a component.")]));
        if (gsap && !reduced) gsap.fromTo(results.children, { clipPath: "inset(0 0 100% 0)", y: 24 }, { clipPath: "inset(0 0 0% 0)", y: 0, duration: 0.9, ease: "expo.out", stagger: 0.07, clearProps: "clipPath,transform" });
      } catch (error) {
        results.replaceChildren(el("p", "ref-error", error.message.startsWith("The") ? error.message : "Could not reach the vault. Check your connection and try again."));
      } finally {
        button.disabled = false;
        go.textContent = "Get references";
        ScrollTrigger?.refresh();
      }
    });

    // Answer the sample brief once, when the section first comes into view.
    if ("IntersectionObserver" in window) {
      const once = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        once.disconnect();
        form.requestSubmit();
      }, { rootMargin: "0px 0px -30% 0px" });
      once.observe(results);
    }
  }
})();
