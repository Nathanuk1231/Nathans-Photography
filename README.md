# NL Visuals — 3D Photography Museum

A first-person, walk-through museum for Nathan Lloyd's photography collection.

## Controls

- **WASD** — walk
- **Mouse** — look around (click the museum to capture the mouse)
- **Space** — jump
- **Shift** — sprint
- **E** — interact with a photograph, the collection index, the hidden painting or the end portal
- **Escape** — release the mouse / close an open viewer

Touch devices use the on-screen movement stick and drag-to-look.

## Museum features

- A café and a sequence of architectural gallery rooms with different finishes and lighting
- All photography records are paginated from the public Supabase table; each available record is loaded into the museum and the photo index
- Failed image downloads are shown as labelled placeholders rather than silently omitted
- A hidden after-hours room behind a large framed photograph, with an original procedurally synthesised drum & bass loop
- A final portal that loops the visitor back to the beginning of the collection

## Run locally

Serve this folder over HTTP (for example, with `python -m http.server 8000`) and open it in a modern browser. Three.js is loaded from jsDelivr through the import map. The photography is still sourced from the existing public Supabase project; this source archive does not contain copies of the photo files themselves.

Original photography and artwork by Nathan Lloyd / NL Visuals.
