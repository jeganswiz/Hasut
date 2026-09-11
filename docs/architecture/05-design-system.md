# Design system architecture

## Visual direction

Inspired by map-first local discovery: light surfaces, strong purple primary, gold rating accent, large radii, bottom-sheet discovery, horizontal nearby cards, map rating pills. **Do not clone the reference screenshot.** HASUT should feel like patronage and support (חסות), not a copy of another product.

## Token contract

Canonical names (no hex in feature components):

| Token          | Role                                                  |
| -------------- | ----------------------------------------------------- |
| `primary`      | Actions, active cards, category chips, price emphasis |
| `secondary`    | Supporting actions                                    |
| `accent`       | Ratings (gold/yellow)                                 |
| `background`   | App canvas                                            |
| `surface`      | Cards, sheets, bars                                   |
| `text`         | Primary copy                                          |
| `mutedText`    | Distances, placeholders                               |
| `success`      | Available, verified                                   |
| `warning`      | Pending                                               |
| `danger`       | Report, block, errors                                 |
| `border`       | Hairlines                                             |
| `radius`       | Generic                                               |
| `buttonRadius` | Buttons                                               |
| `cardRadius`   | Cards, sheets, inputs                                 |

Also: `logoUrl`, `fontFamily`, `mapStyle` key, `markerStyle` — basic UI configuration from admin.

## Source of truth

1. Admin publishes a `theme_configs` row (`draft` → `published`).
2. `configuration` module serves `GET /api/v1/config/theme` (public, cacheable) and authenticated admin variants.
3. Clients never read theme from Postgres per render.

### Cache

| Layer        | Mechanism                                                          |
| ------------ | ------------------------------------------------------------------ |
| API          | Redis cache + `ETag` / `Cache-Control`; invalidate on publish      |
| Web          | Next.js fetch cache tagged `theme`; CSS variables on `:root`       |
| Mobile       | `packages/config` TTL + ETag; apply to RN theme                    |
| Admin editor | Local draft state; live preview; publish writes DB and busts cache |

Fallback: last published payload baked into `packages/ui` as **structural defaults only** for boot-before-network. Those defaults are overwritten as soon as remote theme loads. Feature screens still reference tokens, not hex.

## packages/ui

Reusable primitives (web implementation first with React; mobile maps the same names via RN wrappers or shared token objects):

- `Button`, `IconButton`
- `Card`, `NearbyCard`, `ServiceCard`
- `BottomSheet`
- `SearchBar`, `LocationBar`, `FilterChip`
- `Rating`, `CategoryTag`, `Price`
- `Avatar`, `MapRatingMarker`, `SelectedMapMarker`
- `Text`, `Stack`, `Row` as needed

Empty, loading, error, and success states are first-class variants of list/sheet components.

Web and Admin import from `@hasut/ui`. Mobile uses `@hasut/ui-native` only if RN cannot share DOM components; **tokens and component names stay aligned**. Prefer one `packages/ui` with `.web.tsx` / `.native.tsx` where Expo allows.

## Map-first UX (member)

- Map is the canvas.
- Floating search + location + category chip.
- Bottom sheet: horizontal nearby professionals/businesses; service cards below.
- Selected entity uses primary surface (active card) and a distinct map marker.
- Ratings use `accent` only.

Admin chrome is denser (tables, filters) but the same tokens.

## Accessibility

Contrast must be re-checked when admin changes `primary`/`text`/`background`. Theme publish should run a contrast warning in admin (Phase 1: warn, do not hard-block).
