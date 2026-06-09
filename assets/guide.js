(() => {
  const config = window.UWGuideConfig || {};
  const article = document.getElementById("article");
  const toc = document.getElementById("toc");
  const progressBar = document.getElementById("progress-bar");
  const themeToggle = document.getElementById("theme-toggle");
  const siteTitle = document.getElementById("site-title");
  const siteSummary = document.getElementById("site-summary");
  const linkStatusText = document.getElementById("link-status-text");

  if (siteTitle && config.siteTitle) {
    siteTitle.textContent = config.siteTitle;
    document.title = config.siteTitle;
  }

  if (siteSummary && config.siteSummary) {
    siteSummary.textContent = config.siteSummary;
  }

  const savedTheme = localStorage.getItem("uw-guide-theme");
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }

  themeToggle?.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("uw-guide-theme", nextTheme);
  });

  marked.setOptions({
    gfm: true,
    breaks: false,
    headerIds: true,
    mangle: false,
  });

  function normalizeHeadingId(text) {
    return text
      .toLowerCase()
      .replace(/[`"'“”‘’]/g, "")
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function decorateTables() {
    article.querySelectorAll("table").forEach((table) => {
      const wrapper = document.createElement("div");
      wrapper.style.overflowX = "auto";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function rewriteLocalCodeLinks() {
    const anchors = article.querySelectorAll('a[href^="file:///"]');
    let mapped = 0;
    let localOnly = 0;

    anchors.forEach((anchor) => {
      const originalHref = anchor.getAttribute("href");
      const url = new URL(originalHref);
      const localPath = decodeURIComponent(url.pathname);
      const root = config.localRepoRoot || "";

      if (!localPath.startsWith(root)) {
        anchor.classList.add("local-link");
        localOnly += 1;
        return;
      }

      const relativePath = localPath.slice(root.length + 1);
      const fragment = url.hash || "";

      if (config.repositoryBaseUrl) {
        anchor.href =
          config.repositoryBaseUrl.replace(/\/$/, "") +
          "/" +
          relativePath +
          fragment;
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        mapped += 1;
      } else {
        anchor.href = "#";
        anchor.classList.add("local-link");
        anchor.title =
          "This link points to a local file path. Set repositoryBaseUrl in docs/assets/guide.config.js after uploading to GitHub.";
        anchor.addEventListener("click", (event) => event.preventDefault());
        localOnly += 1;
      }
    });

    if (!anchors.length) {
      linkStatusText.textContent =
        "No local file links were detected in the Markdown source.";
      return;
    }

    if (mapped > 0) {
      linkStatusText.textContent =
        `${mapped} code-reference links were mapped to your repository URL. ` +
        `${localOnly} remain local-only.`;
      return;
    }

    linkStatusText.textContent =
      "Code-reference links still point to local file paths. After uploading to GitHub, set repositoryBaseUrl in docs/assets/guide.config.js so they become clickable online source links.";
  }

  function buildToc() {
    toc.innerHTML = "";
    const headings = article.querySelectorAll("h2, h3");

    headings.forEach((heading) => {
      if (!heading.id) {
        heading.id = normalizeHeadingId(heading.textContent);
      }

      const item = document.createElement("a");
      item.href = `#${heading.id}`;
      item.textContent = heading.textContent;
      item.className = heading.tagName === "H3" ? "depth-3" : "depth-2";
      toc.appendChild(item);
    });

    const tocLinks = [...toc.querySelectorAll("a")];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          tocLinks.forEach((link) => link.classList.remove("active"));
          const active = toc.querySelector(`a[href="#${entry.target.id}"]`);
          active?.classList.add("active");
        });
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: 0,
      }
    );

    headings.forEach((heading) => observer.observe(heading));
  }

  function enhanceMermaidBlocks() {
    const mermaidBlocks = article.querySelectorAll("pre code.language-mermaid");

    mermaidBlocks.forEach((block, index) => {
      const pre = block.parentElement;
      const container = document.createElement("div");
      container.className = "mermaid";
      container.textContent = block.textContent;
      container.id = `mermaid-${index}`;
      pre.replaceWith(container);
    });

    if (mermaidBlocks.length) {
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
      });
      mermaid.run({ nodes: article.querySelectorAll(".mermaid") });
    }
  }

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = `${Math.min(100, Math.max(0, ratio))}%`;
  }

  async function loadGuide() {
    try {
      const response = await fetch(config.markdownPath || "./underworld2_codebase_guide.md");
      if (!response.ok) {
        throw new Error(`Failed to load Markdown: ${response.status}`);
      }

      const markdown = await response.text();
      article.innerHTML = marked.parse(markdown);
      decorateTables();
      rewriteLocalCodeLinks();
      buildToc();
      enhanceMermaidBlocks();
      updateProgress();
    } catch (error) {
      article.innerHTML = `
        <div class="error-state">
          <div>
            <p>Unable to load the Markdown source.</p>
            <p><code>${String(error.message || error)}</code></p>
          </div>
        </div>
      `;
      linkStatusText.textContent =
        "The Markdown source could not be loaded. Check markdownPath in docs/assets/guide.config.js.";
    }
  }

  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  loadGuide();
})();
