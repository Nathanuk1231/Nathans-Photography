(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector(".mobile-menu");
  const closeMenu = () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Open navigation");
    mobileMenu?.classList.remove("open");
    mobileMenu?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
  };
  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    mobileMenu.classList.toggle("open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("locked", open);
  });
  mobileMenu?.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => { if (window.innerWidth > 760) closeMenu(); });

  // Gallery category filters
  const filters = [...document.querySelectorAll(".filter")];
  const items = [...document.querySelectorAll(".gallery-item")];
  filters.forEach(button => button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filters.forEach(f => {
      const active = f === button;
      f.classList.toggle("active", active);
      f.setAttribute("aria-pressed", String(active));
    });
    items.forEach(item => {
      const show = filter === "all" || item.dataset.category === filter;
      item.classList.toggle("is-hidden", !show);
    });
    if (!reduceMotion && window.gsap) {
      gsap.fromTo(items.filter(i => !i.classList.contains("is-hidden")),
        { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .45, stagger: .06, ease: "power2.out", clearProps: "transform" });
    }
  }));

  // Accessible image lightbox with keyboard navigation
  const lightbox = document.querySelector(".lightbox");
  const lbImage = document.querySelector(".lightbox-image");
  const lbTitle = document.querySelector(".lightbox-title");
  const lbDescription = document.querySelector(".lightbox-description");
  const lbCount = document.querySelector(".lightbox-count");
  const closeButton = document.querySelector(".lightbox-close");
  const visibleItems = () => items.filter(i => !i.classList.contains("is-hidden"));
  let activeItem = null;
  let previousFocus = null;
  const openLightbox = item => {
    activeItem = item;
    previousFocus = document.activeElement;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    updateLightbox();
    closeButton.focus();
  };
  const updateLightbox = () => {
    if (!activeItem) return;
    const img = activeItem.querySelector("img");
    lbImage.src = img.src;
    lbImage.alt = img.alt;
    lbTitle.textContent = activeItem.dataset.title || "";
    lbDescription.textContent = activeItem.dataset.description || "";
    const list = visibleItems();
    lbCount.textContent = `${String(list.indexOf(activeItem) + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
  };
  const closeLightbox = () => {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
    lbImage.src = "";
    activeItem = null;
    previousFocus?.focus();
  };
  const stepLightbox = direction => {
    const list = visibleItems();
    if (!list.length || !activeItem) return;
    let index = list.indexOf(activeItem);
    index = (index + direction + list.length) % list.length;
    activeItem = list[index];
    updateLightbox();
  };
  items.forEach(item => item.addEventListener("click", () => openLightbox(item)));
  closeButton.addEventListener("click", closeLightbox);
  document.querySelector(".lightbox-prev").addEventListener("click", () => stepLightbox(-1));
  document.querySelector(".lightbox-next").addEventListener("click", () => stepLightbox(1));
  lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", e => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  // Cursor-follow glow
  const glow = document.querySelector(".cursor-glow");
  if (glow && matchMedia("(pointer:fine)").matches && !reduceMotion) {
    window.addEventListener("pointermove", e => {
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
      glow.style.opacity = ".9";
    }, { passive: true });
    document.addEventListener("pointerleave", () => glow.style.opacity = "0");
  }

  // GSAP choreography — graceful fallback if CDN is unavailable.
  const initMotion = () => {
    if (!window.gsap || reduceMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro.from(".site-header", { y: -25, opacity: 0, duration: .7 })
      .from(".hero-eyebrow", { y: 18, opacity: 0, duration: .55 }, "-=.25")
      .from(".hero-title > span:first-child", { yPercent: 110, opacity: 0, duration: .9, clipPath: "inset(0 0 100% 0)" }, "-=.2")
      .from(".title-second", { yPercent: 80, opacity: 0, duration: 1, clipPath: "inset(0 0 100% 0)" }, "-=.55")
      .from(".hero-image-wrap", { y: 55, opacity: 0, duration: 1 }, "-=.5")
      .from(".hero-meta, .hero-bottom", { opacity: 0, y: 15, duration: .55 }, "-=.45");
    gsap.to(".hero-image", { yPercent: -8, ease: "none", scrollTrigger: { trigger: ".hero-image-wrap", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.utils.toArray(".section-kicker, .display-heading, .intro-copy, .work-heading, .filters, .gallery-item, .manifesto h2, .about-image-wrap, .about-copy > *, .contact-heading, .contact-copy, .contact-link").forEach(el => {
      gsap.from(el, { y: 28, opacity: 0, duration: .75, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });
    gsap.to(".hero-orb", { x: 70, y: 35, duration: 7, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".contact-glow", { scale: 1.18, opacity: .65, duration: 4, repeat: -1, yoyo: true, ease: "sine.inOut" });
  };
  if (document.readyState === "complete") initMotion();
  else window.addEventListener("load", initMotion, { once: true });
})();