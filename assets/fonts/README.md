# Fonti

Pašhostēti Google Fonts (SIL Open Font License), apakškopa: ASCII + latviešu/baltu burti + € – — „ " « » … → ✓ ©.
- `plex-sans.woff2` — IBM Plex Sans, mainīgs (wght 100–700)
- `schibsted-grotesk.woff2` — Schibsted Grotesk, mainīgs (wght 400–900)
- `plex-mono.woff2` — IBM Plex Mono 400

Iegūti ar Google Fonts CSS API `&text=` parametru (viens fails katram fontam).
Rezerves fontu `size-adjust` / `*-override` (css/style.css) aprēķināti pret Arial (Liberation Sans)
pēc latviešu parauga teksta platuma; mainot fontus, pārrēķināt.
`font-display: optional` un bez preload: lēnā savienojumā pirmā lapa var palikt ar rezerves fontu, nākamās jau ar īsto; teksts nekad nepārlec (CLS 0) un pirmais saturs netiek aizkavēts.
Ja lapā parādās burts, kura nav apakškopā, tas tiek attēlots ar rezerves fontu.
