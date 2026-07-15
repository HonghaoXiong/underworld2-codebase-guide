(() => {
  "use strict";

  const config = window.UWGuideConfig || {};
  const article = document.getElementById("article");
  const toc = document.getElementById("toc");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const currentSection = document.getElementById("current-section");
  const themeToggle = document.getElementById("theme-toggle");
  const siteTitle = document.getElementById("site-title");
  const siteSummary = document.getElementById("site-summary");
  const repositoryLink = document.getElementById("repository-link");
  const linkStatusText = document.getElementById("link-status-text");
  const searchInput = document.getElementById("guide-search");
  const searchStatus = document.getElementById("search-status");
  const tocToggle = document.getElementById("toc-toggle");
  const backToTop = document.getElementById("back-to-top");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const storedTheme = localStorage.getItem("uw-guide-theme");
  document.documentElement.dataset.theme = storedTheme || "dark";

  if (siteTitle && config.siteTitle) siteTitle.textContent = config.siteTitle;
  if (siteSummary && config.siteSummary) siteSummary.textContent = config.siteSummary;
  if (repositoryLink && config.repositoryHomeUrl) repositoryLink.href = config.repositoryHomeUrl;
  document.title = "Underworld2 · Codebase Field Guide";

  marked.setOptions({ gfm: true, breaks: false });

  function normalizeHeadingId(text) {
    return text
      .toLowerCase()
      .replace(/[`'"“”‘’]/g, "")
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function assignHeadingIds() {
    const used = new Map();
    article.querySelectorAll("h1, h2, h3, h4").forEach((heading) => {
      const base = normalizeHeadingId(heading.textContent) || "section";
      const seen = used.get(base) || 0;
      used.set(base, seen + 1);
      heading.id = seen ? `${base}-${seen + 1}` : base;
      heading.tabIndex = -1;
    });
  }

  function decorateTables() {
    article.querySelectorAll("table").forEach((table) => {
      if (table.parentElement?.classList.contains("table-scroll")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table-scroll reveal-node";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function decorateCodeBlocks() {
    article.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector("code.language-mermaid")) return;
      const code = pre.querySelector("code");
      if (!code) return;
      const languageClass = [...code.classList].find((name) => name.startsWith("language-"));
      const language = languageClass?.replace("language-", "") || "text";
      const header = document.createElement("div");
      header.className = "code-header";
      header.innerHTML = `<span>${language}</span>`;
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy";
      copy.setAttribute("aria-label", `Copy ${language} code`);
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          copy.textContent = "Copied";
          setTimeout(() => (copy.textContent = "Copy"), 1400);
        } catch {
          copy.textContent = "Select text";
        }
      });
      header.appendChild(copy);
      pre.before(header);
      pre.classList.add("has-code-header", "reveal-node");
    });
  }

  function enhanceLinks() {
    const links = [...article.querySelectorAll("a[href]")];
    let sourceCount = 0;
    let localCount = 0;

    links.forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (href.startsWith("file:///")) {
        anchor.classList.add("broken-local-link");
        localCount += 1;
        return;
      }
      if (/^https?:\/\//.test(href)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        if (href.includes("github.com/underworldcode/underworld2/")) {
          anchor.classList.add("source-link");
          sourceCount += 1;
        }
      }
    });

    if (localCount) {
      linkStatusText.textContent = `${sourceCount} official links ready; ${localCount} local path${localCount === 1 ? "" : "s"} need attention.`;
      return;
    }
    linkStatusText.textContent = `${sourceCount} references resolve to the official Underworld2 v2.17.x source tree.`;
  }

  function buildToc() {
    toc.innerHTML = "";
    const headings = [...article.querySelectorAll("h2, h3")];
    const sections = [];
    let current = null;

    headings.forEach((heading) => {
      if (heading.tagName === "H2") {
        current = { heading, children: [] };
        sections.push(current);
      } else if (current) {
        current.children.push(heading);
      }
    });

    sections.forEach(({ heading, children }) => {
      const group = document.createElement("div");
      group.className = "toc-section";
      group.dataset.section = heading.id;
      const sectionText = [];
      let sibling = heading.nextElementSibling;
      while (sibling && sibling.tagName !== "H2") {
        sectionText.push(sibling.textContent || "");
        sibling = sibling.nextElementSibling;
      }
      group.dataset.search = [heading.textContent, ...children.map((item) => item.textContent), ...sectionText]
        .join(" ")
        .toLowerCase();

      const chapterLink = document.createElement("a");
      chapterLink.className = "toc-chapter";
      chapterLink.href = `#${heading.id}`;
      chapterLink.innerHTML = `<span>${heading.textContent.match(/^\d+/)?.[0] || "·"}</span><strong>${heading.textContent.replace(/^\d+\.\s*/, "")}</strong>`;
      group.appendChild(chapterLink);

      if (children.length) {
        const childList = document.createElement("div");
        childList.className = "toc-children";
        children.forEach((child) => {
          const link = document.createElement("a");
          link.href = `#${child.id}`;
          link.textContent = child.textContent.replace(/^\d+(?:\.\d+)+\s*/, "");
          childList.appendChild(link);
        });
        group.appendChild(childList);
      }
      toc.appendChild(group);
    });

    const chapterCount = document.getElementById("chapter-count");
    if (chapterCount) chapterCount.textContent = `${sections.length} sections`;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;
        toc.querySelectorAll(".toc-section").forEach((group) => group.classList.remove("active-section"));
        const activeGroup = toc.querySelector(`[data-section="${visible.target.id}"]`);
        activeGroup?.classList.add("active-section");
        if (currentSection) currentSection.textContent = visible.target.textContent;
      },
      { rootMargin: "-14% 0px -74% 0px", threshold: 0 }
    );
    sections.forEach(({ heading }) => observer.observe(heading));
  }

  function setupSearch() {
    if (!searchInput) return;
    const filter = () => {
      const query = searchInput.value.trim().toLowerCase();
      const groups = [...toc.querySelectorAll(".toc-section")];
      let matches = 0;
      groups.forEach((group) => {
        const match = !query || group.dataset.search.includes(query);
        group.hidden = !match;
        group.classList.toggle("search-match", Boolean(query && match));
        if (match) matches += 1;
      });
      searchStatus.textContent = query ? `${matches} matching chapter${matches === 1 ? "" : "s"}` : "";
    };
    searchInput.addEventListener("input", filter);
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && document.activeElement !== searchInput) {
        event.preventDefault();
        searchInput.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchInput) {
        searchInput.value = "";
        filter();
        searchInput.blur();
      }
    });
  }

  async function enhanceMermaidBlocks() {
    const blocks = [...article.querySelectorAll("pre code.language-mermaid")];
    if (!blocks.length || !window.mermaid) return;
    blocks.forEach((block, index) => {
      const pre = block.parentElement;
      const shell = document.createElement("figure");
      shell.className = "diagram-shell reveal-node";
      const header = document.createElement("figcaption");
      header.className = "diagram-header";
      header.innerHTML = `
        <span class="diagram-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="diagram-title">System map</span>
        <span class="diagram-legend" aria-hidden="true"><i></i><i></i><i></i></span>
      `;
      const container = document.createElement("div");
      container.className = "mermaid";
      container.textContent = block.textContent;
      container.id = `mermaid-${index}`;
      shell.append(header, container);
      pre.replaceWith(shell);
    });
    const isDark = document.documentElement.dataset.theme === "dark";
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      flowchart: {
        curve: "basis",
        htmlLabels: true,
        nodeSpacing: 42,
        rankSpacing: 58,
        padding: 18,
        useMaxWidth: true,
      },
      sequence: {
        actorMargin: 52,
        boxMargin: 12,
        messageMargin: 32,
        diagramMarginX: 26,
        diagramMarginY: 22,
        useMaxWidth: true,
      },
      themeVariables: {
        background: "transparent",
        primaryColor: isDark ? "#16343a" : "#dceee8",
        primaryTextColor: isDark ? "#edf6f1" : "#173831",
        primaryBorderColor: isDark ? "#5db49b" : "#2f806c",
        secondaryColor: isDark ? "#49291f" : "#f5dfd1",
        secondaryTextColor: isDark ? "#fff1e8" : "#542c20",
        secondaryBorderColor: isDark ? "#d87948" : "#b45d34",
        tertiaryColor: isDark ? "#18283b" : "#dfe9f3",
        tertiaryTextColor: isDark ? "#eaf2fb" : "#243c52",
        tertiaryBorderColor: isDark ? "#6f9bc4" : "#547da4",
        lineColor: isDark ? "#82c8b4" : "#397b6c",
        edgeLabelBackground: isDark ? "#10191e" : "#f7f7f1",
        clusterBkg: isDark ? "#0d171c" : "#f2f4ee",
        clusterBorder: isDark ? "#294248" : "#afc6bf",
        mainBkg: isDark ? "#16343a" : "#dceee8",
        nodeBorder: isDark ? "#5db49b" : "#2f806c",
        actorBkg: isDark ? "#17343a" : "#dceee8",
        actorBorder: isDark ? "#5db49b" : "#2f806c",
        actorTextColor: isDark ? "#edf6f1" : "#173831",
        signalColor: isDark ? "#8bd6b9" : "#2f7563",
        signalTextColor: isDark ? "#dce9e4" : "#29463f",
        labelBoxBkgColor: isDark ? "#2e211c" : "#f4e3d6",
        labelBoxBorderColor: isDark ? "#cf7044" : "#b45d34",
        labelTextColor: isDark ? "#fff0e7" : "#542c20",
        loopTextColor: isDark ? "#e7eee9" : "#29463f",
        noteBkgColor: isDark ? "#3d321d" : "#fff1c9",
        noteBorderColor: isDark ? "#d6a94d" : "#aa7923",
        noteTextColor: isDark ? "#fff6d9" : "#503a12",
        fontSize: "15px",
        fontFamily: "Manrope, sans-serif",
      },
    });
    try {
      await mermaid.run({ nodes: article.querySelectorAll(".mermaid") });
      article.querySelectorAll(".mermaid svg").forEach((svg) => {
        svg.querySelectorAll("g.node").forEach((node, nodeIndex) => {
          node.classList.add(`diagram-tone-${nodeIndex % 4}`);
        });
      });
    } catch (error) {
      console.warn("A Mermaid diagram could not be rendered", error);
    }
  }

  function setupRevealAnimations() {
    const nodes = article.querySelectorAll(
      ".reveal-node, h2, h3, blockquote, .mermaid"
    );
    if (reduceMotion.matches) {
      nodes.forEach((node) => node.classList.add("is-revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }
    );
    nodes.forEach((node) => observer.observe(node));
  }

  function updateProgress() {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = distance > 0 ? window.scrollY / distance : 0;
    const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}%`;
    backToTop?.classList.toggle("visible", window.scrollY > window.innerHeight * 0.8);
  }

  function setupControls() {
    themeToggle?.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("uw-guide-theme", next);
    });
    tocToggle?.addEventListener("click", () => {
      const collapsed = toc.classList.toggle("collapsed");
      tocToggle.textContent = collapsed ? "+" : "−";
      tocToggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} table of contents`);
    });
    backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" }));
  }

  function setupGeodynamicsCanvas() {
    const canvas = document.getElementById("geodynamics-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let particles = [];
    let pointer = { x: -1000, y: -1000 };

    const makeParticle = () => ({
      x: Math.random(),
      y: Math.random(),
      age: Math.random() * 240,
      life: 180 + Math.random() * 180,
      size: 0.45 + Math.random() * 1.2,
    });

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.max(42, Math.round((width * height) / 15000)));
      particles = Array.from({ length: count }, makeParticle);
    }

    function velocity(x, y, time) {
      const phase = time * 0.000035;
      const cells = Math.PI * 2;
      const vx = Math.sin(cells * x + phase) * Math.cos(Math.PI * y);
      const vy = -1.45 * Math.cos(cells * x + phase) * Math.sin(Math.PI * y);
      return { x: vx, y: vy };
    }

    function draw(time = 0) {
      ctx.clearRect(0, 0, width, height);
      const isLight = document.documentElement.dataset.theme === "light";
      ctx.globalCompositeOperation = isLight ? "multiply" : "screen";
      particles.forEach((particle, index) => {
        const v = velocity(particle.x, particle.y, time);
        const oldX = particle.x;
        const oldY = particle.y;
        const px = particle.x * width;
        const py = particle.y * height;
        const dx = px - pointer.x;
        const dy = py - pointer.y;
        const pointerDistance = Math.max(80, Math.hypot(dx, dy));
        const pointerForce = pointerDistance < 220 ? (220 - pointerDistance) / 220 : 0;
        particle.x += v.x * 0.00016 + (dx / pointerDistance) * pointerForce * 0.00018;
        particle.y += v.y * 0.00011 + (dy / pointerDistance) * pointerForce * 0.00018;
        particle.age += 1;

        if (particle.x < 0 || particle.x > 1 || particle.y < 0 || particle.y > 1 || particle.age > particle.life) {
          particles[index] = makeParticle();
          return;
        }

        const alpha = Math.min(1, particle.age / 35, (particle.life - particle.age) / 35) * (isLight ? 0.4 : 0.22);
        const hue = isLight ? 165 - particle.y * 136 : 18 + particle.y * 25;
        const lightness = isLight ? 34 + particle.y * 4 : 62 - particle.y * 12;
        ctx.beginPath();
        ctx.moveTo(oldX * width, oldY * height);
        ctx.lineTo(particle.x * width, particle.y * height);
        ctx.strokeStyle = `hsla(${hue}, ${isLight ? 66 : 78}%, ${lightness}%, ${alpha})`;
        ctx.lineWidth = particle.size * (isLight ? 1.22 : 1);
        ctx.stroke();
      });
      ctx.globalCompositeOperation = "source-over";
      if (!reduceMotion.matches) frame = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", (event) => {
      pointer = { x: event.clientX, y: event.clientY };
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && frame) cancelAnimationFrame(frame);
      if (!document.hidden && !reduceMotion.matches) frame = requestAnimationFrame(draw);
    });
    resize();
    draw();
  }

  async function loadGuide() {
    try {
      const response = await fetch(config.markdownPath || "./underworld2_codebase_guide.md");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      article.innerHTML = marked.parse(await response.text());
      assignHeadingIds();
      currentSection.textContent = article.querySelector("h1")?.textContent || "Underworld2 Codebase Guide";
      decorateTables();
      decorateCodeBlocks();
      enhanceLinks();
      buildToc();
      setupSearch();
      await enhanceMermaidBlocks();
      setupRevealAnimations();
      updateProgress();
    } catch (error) {
      article.innerHTML = `<div class="error-state"><p>Unable to load the guide.</p><code>${String(error.message || error)}</code></div>`;
      linkStatusText.textContent = "The Markdown source could not be loaded.";
      currentSection.textContent = "Guide unavailable";
    }
  }

  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });
  setupControls();
  setupGeodynamicsCanvas();
  loadGuide();
})();
