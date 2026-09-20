# Design system architecture

## Visual direction

Inspired by map-first local discovery: light surfaces, strong purple primary, gold rating accent, large radii, bottom-sheet discovery, horizontal nearby cards. **Do not clone** third-party admin templates or Instagram. HASUT should feel like patronage and support (חסות).

**Logo:** bundled HASUT mark (SVG) in web, admin, and mobile chrome. Admin theme publish may override with `logoUrl` from `THEME_LOGO` media. Feature components consume the token/config, not a hardcoded asset path per screen.

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
- `Avatar`, `MapAvatarMarker`, `SelectedMapMarker`, `HasutLogo`
- `DataTable`, `KpiCard`, `AdminSidebar`, `PageHeader` (admin density)
- `TabBar` (member native-like chrome)
- `Text`, `Stack`, `Row` as needed

Empty, loading, error, and success states are first-class variants of list/sheet components.

Web and Admin import from `@hasut/ui`. Mobile uses `@hasut/ui-native` only if RN cannot share DOM components; **tokens and component names stay aligned**. Prefer one `packages/ui` with `.web.tsx` / `.native.tsx` where Expo allows.

## Map-first UX (member)

- Map is the canvas.
- Floating search + location + category chip.
- Bottom sheet: horizontal nearby professionals/businesses; service cards below.
- **Map pins are circular avatars** (photo or initials), not rating pills. A ring encodes availability or live presence. When `stories.live` is on, pin media priority is LIVE → video → image → profile.
- Self pin links to the presence composer (`/story`) and `/me` profile editor.
- Selected entity uses primary surface (active card) and a distinct map marker.
- Ratings use `accent` only, typically on cards rather than the pin itself.
- Small viewports: bottom tab bar (Map, Connections, Inbox, Notifications, Me), `100dvh`, safe-area, 44px targets, reduced-motion for pulses. Desktop keeps a refined top chrome + logo.
- Admin chrome: collapsible sidebar, KPI cards, dense tables (`KpiCard`, `HasutLogo`, `Avatar` in `@hasut/ui`).

Admin chrome is denser (tables, filters, sidebar) but the same tokens.

## Accessibility

Contrast must be re-checked when admin changes `primary`/`text`/`background`. Theme publish should run a contrast warning in admin (Phase 1: warn, do not hard-block).
