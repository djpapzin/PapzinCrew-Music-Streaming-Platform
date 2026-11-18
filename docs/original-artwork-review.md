# Original artwork restoration — 13 October 2026

134 original covers supply 136 catalog entries (two birthday mixes have duplicate catalog entries). Sources are recorded with original SHA-256 checksums in `original-artwork-sources.json`. Website derivatives are WebP, at most 1000 pixels per side, preserving aspect ratio and the full design. Unmodified downloads remain in the local artwork archive.

The frontend registry checks both catalog ID and exact title before choosing an original. This restores covers across discovery, track pages and the player without reuploading audio or consuming additional B2 storage. Database cover URLs remain unchanged. A title change invalidates the override until reviewed. TPW catalog entries 182–231 and existing TPW artwork are untouched.

## Review results

- 125 initial candidate entries checked against cover text/series/artist/date.
- Ten further entries resolved visually: Guest 25 (98), Honey Bee (90), Thatso (79), King Poqoza dedications (167, 169, 170), King Poqoza birthday (154), Megamix 05 (136), King Sxova Megamix 11 (137), Ultimix 39 (128).
- Buckzen birthday (233): original downloaded from the verified HearThis release page, replacing the generated cover on the website.
- Guest 40 (112): exact artist and volume match; original art says 08 August 2020 while catalog says 07 August 2020. Preserve both source artwork and existing catalog metadata pending date confirmation.
- CF 53–83 artwork (except absent CF 78) has no corresponding entry in the current catalog. Keep archived; do not create audio entries from images.
- Artist portraits (PrizyDee, DJ Papzin, Freezo, Gabby, RealPro), generic logos and request-a-mix pricing flyers are not specific mix covers.
- `G ft P.jpg` has insufficient identifying release information: leave unapplied.
- `Appreciation Mix.jpg` is the same 2000 Likes design already represented by `2000 Likes.jpg`; do not assign it to an unspecified appreciation mix.
- `DJ Papzin - TPW.jpg` explicitly deferred.

No generative artwork was created during this restoration.

## Owner-approved replacement — 18 November 2026

DJ supplied the blue DJ Papzin logo crop for **Many More @ It Aagain** (track 237). This is an approved replacement for this mix. Its original reddish cover remains unverified. The supplied PNG is stored verbatim at `/artwork/replacements/many-more-it-aagain.png`. A reviewed original or a catalog cover takes precedence.

## Cruize Friday 10 replacement preview — 18 November 2026

DJ selected the vintage birthday-mix flyer as a replacement for **Cruize Friday 10 (Special Edition)** (track 31). The JPEG was copied without re-encoding from the attached image in the cached MP3 and matches the flyer shown in the [official upload](https://youtu.be/kQnjpPtlICs). The episode-specific cover remains unverified.

## 2022 Sghubu Sa Pitori birthday flyer preview — 18 November 2026

DJ selected the same vintage birthday-mix flyer for **Papzin's Birthday Mix (Sghubu Sa Pitori)** (track 125, 31 July 2022). The fallback reuses the existing JPEG. The original 2022 cover remains unverified, and a catalog cover takes precedence.
