/*
==========================================================
 NATHAN LLOYD PHOTOGRAPHY  (NL VISUALS)  —  README
==========================================================

WHAT THIS IS
  A single-page photography portfolio: index.html (HTML + CSS + JS in one file).
  Uses GSAP + ScrollTrigger from cdnjs for the animation. No build step.

SECTIONS
  Hero (auto-cycling photos) · Portfolio (filters + viewer) · category marquee ·
  Featured (pinned horizontal scroll on desktop, swipe on mobile) · About ·
  Contact (Formspree form) · Footer.

RUNNING IT
  Local:    open index.html in a browser (or run `npx serve` in this folder).
  Hosting:  upload index.html to GitHub Pages / Netlify / any static host.
  NOTE:     The claude.ai preview blocks outside requests, so Supabase photos
            and the contact form only work once the file is on your own hosting.

WHERE TO EDIT  (all inside index.html)
  CONFIG block (top of the <script>)
    CATEGORIES   filter names shown above the gallery
    PHOTOS       placeholder photos used if Supabase can't be reached
                 fields: id, title, cat, ratio (width/height), src, pos, alt,
                         date, hue, featured
  SB block (Supabase loader, near the end of the <script>)
    url / key    project URL + PUBLISHABLE key only (never the service_role key
                 or database password)
    table        default 'photos'
    bucket       default 'photos'
  Brand, socials, email
    Search for: nathans_photography_2010, tiktok.com/@nathans_photography,
                youtube.com/@nathans_photography_2010, nathanjlloyd123@gmail.com
  Colours / fonts
    :root variables at the top of the <style> block (--bg, --blue, --pink, ...)
  Contact form
    Posts to https://formspree.io/f/mykovrop — confirm your email in Formspree
    after the first test submission.

ADDING PHOTOS WITH SUPABASE
  1. Storage > create a PUBLIC bucket named "photos" and upload your images.
  2. (Optional, for categories/titles) create a table:

       create table photos (
         id bigint generated always as identity primary key,
         title text,
         category text,        -- e.g. Landscape, Nature & Wildlife, Urban, Creative
         image_url text,       -- full URL, or file path inside the bucket
         alt text,
         featured boolean default false,  -- true = hero + featured section
         width int, height int,           -- optional; measured automatically if empty
         date text
       );
       alter table photos enable row level security;
       create policy "public read" on photos for select using (true);

  3. Insert a row per photo. With no table, the site lists the bucket instead
     (titles come from filenames, all in one "Gallery" category).
  If photos don't load, the page shows a pink note saying why
  (HTTP 404 = wrong name, 401/403 = missing policy, failed = blocked/not hosted).

ACCESSIBILITY
  Keyboard nav, focus trap in the viewer (Esc / arrows), skip-friendly headings,
  alt text per photo, and prefers-reduced-motion turns off parallax, pinning,
  the marquee and the hero slideshow.

NOT INCLUDED (on purpose)
  No prices, booking, testimonials or credentials. About copy is your own draft —
  edit it freely.

TODO IDEAS
  Real favicon + share image · custom domain in <link rel="canonical"> ·
  bundled fonts instead of Google Fonts · Flip animation into the viewer.
*/
