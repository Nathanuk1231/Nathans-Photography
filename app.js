(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.querySelector(".menu-toggle");
  const menu = document.querySelector(".mobile-menu");
  function setMenu(open) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("locked", open);
  }
  menuButton?.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  menu?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setMenu(false)));
  window.addEventListener("resize", () => { if (window.innerWidth > 760) setMenu(false); });

  const filters = [...document.querySelectorAll(".filter")];
  const items = [...document.querySelectorAll(".gallery-item")];
  filters.forEach(button => button.addEventListener("click", () => {
    filters.forEach(filter => {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    items.forEach(item => {
      item.classList.toggle("is-hidden", button.dataset.filter !== "all" && item.dataset.category !== button.dataset.filter);
    });
    if (!reduced && window.gsap) {
      gsap.fromTo(items.filter(item => !item.classList.contains("is-hidden")),
        { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .35, stagger: .045, ease: "power2.out", clearProps: "transform" });
    }
  }));

  const lightbox = document.querySelector(".lightbox");
  const image = document.querySelector(".lightbox-image");
  const title = document.querySelector(".lightbox-title");
  const description = document.querySelector(".lightbox-description");
  const count = document.querySelector(".lightbox-count");
  const closeButton = document.querySelector(".lightbox-close");
  let active = null;
  let lastFocus = null;
  const visible = () => items.filter(item => !item.classList.contains("is-hidden"));

  function updateLightbox() {
    if (!active) return;
    const source = active.querySelector("img");
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    title.textContent = active.dataset.title || "";
    description.textContent = active.dataset.description || "";
    const list = visible();
    count.textContent = `${String(list.indexOf(active) + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
  }
  function openLightbox(item) {
    active = item;
    lastFocus = document.activeElement;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    updateLightbox();
    closeButton.focus();
  }
  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
    image.removeAttribute("src");
    active = null;
    if (lastFocus) lastFocus.focus();
  }
  function step(direction) {
    const list = visible();
    if (!active || !list.length) return;
    active = list[(list.indexOf(active) + direction + list.length) % list.length];
    updateLightbox();
  }
  items.forEach(item => item.addEventListener("click", () => openLightbox(item)));
  closeButton.addEventListener("click", closeLightbox);
  document.querySelector(".lightbox-prev").addEventListener("click", () => step(-1));
  document.querySelector(".lightbox-next").addEventListener("click", () => step(1));
  lightbox.addEventListener("click", event => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", event => {
    if (!lightbox.classList.contains("open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
    if (event.key === "Tab") {
      const controls = [...lightbox.querySelectorAll("button")];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
    }
  });

  function initMotion() {
    if (!window.gsap || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.from(".hero-heading .eyebrow", { y: 12, opacity: 0, duration: .55, ease: "power2.out" });
    gsap.from(".hero h1", { y: 28, opacity: 0, duration: .85, delay: .08, ease: "power3.out" });
    gsap.from(".hero-intro", { y: 12, opacity: 0, duration: .6, delay: .25, ease: "power2.out" });
    gsap.from(".hero-photo", { clipPath: "inset(8% 0 8% 0)", opacity: 0, duration: 1, delay: .2, ease: "power2.out" });
    gsap.utils.toArray(".section-heading, .gallery-item, .interlude-quote, .about-photo, .about-copy, .contact-row, .contact-note").forEach(element => {
      gsap.from(element, {
        y: 18, opacity: 0, duration: .65, ease: "power2.out",
        scrollTrigger: { trigger: element, start: "top 88%", once: true }
      });
    });
    gsap.to(".hero-photo img", {
      yPercent: -4, ease: "none",
      scrollTrigger: { trigger: ".hero-photo", start: "top bottom", end: "bottom top", scrub: true }
    });
  }
  if (document.readyState === "complete") initMotion();
  else window.addEventListener("load", initMotion, { once: true });
})();
