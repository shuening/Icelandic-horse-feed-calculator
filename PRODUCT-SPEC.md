# Icelandic Horse Feed Calculator — Product Specification

> **Version:** 1.0 (POC)
> **Last Updated:** April 26, 2026
> **Repository:** [github.com/shuening/Icelandic-horse-feed-calculator](https://github.com/shuening/Icelandic-horse-feed-calculator)
> **Live App:** [shuening.github.io/Icelandic-horse-feed-calculator](https://shuening.github.io/Icelandic-horse-feed-calculator/)

---

## 1. Overview

A mobile-first Progressive Web App (PWA) for managing daily feed and supplement plans for a small herd of Icelandic horses. The app generates condition-aware nutritional recommendations based on veterinary and equine nutritionist guidelines, tracks supplement interactions, and syncs settings across devices in real time.

### 1.1 Problem Statement

Icelandic horse owners managing multiple horses with different health conditions (PSSM, insulin resistance, senior dental issues, hoof problems) need a way to:

- Calculate condition-specific daily forage amounts based on body weight percentages
- Track supplement dosages and catch dangerous mineral overlaps
- Get vet-backed warnings when combinations exceed safe thresholds
- Share feeding plans across family members and barn staff on different devices

### 1.2 Target Users

- Small household (< 5 users) managing 2–6 Icelandic horses
- Primary users: horse owners / caretakers
- Secondary users: barn staff, farriers, veterinarians (read-only reference)

---

## 2. Architecture

### 2.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Single-file HTML/CSS/JS (vanilla, no framework) |
| Storage (local) | `localStorage` |
| Storage (sync) | Firebase Realtime Database |
| Hosting | GitHub Pages |
| PWA | Inline Service Worker + Web App Manifest |

### 2.2 Data Flow

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│  Device A    │────▶│ Firebase Realtime  │◀────│  Device B    │
│ localStorage │     │    Database        │     │ localStorage │
└──────────────┘     │ /households/{id}/  │     └──────────────┘
                     └───────────────────┘
```

- **Offline-first:** All data persists in `localStorage`; app works without network
- **Sync:** When connected, state pushes to Firebase on every save
- **Conflict resolution:** Last-write-wins based on `_ts` timestamp
- **Household model:** Devices join via shared household ID (no login required)

---

## 3. Data Model

### 3.1 Horse Profile

```javascript
{
  id: 'tenor',              // Unique slug
  name: 'Tenor',            // Display name
  emoji: '🐎',              // Tab icon
  weight: 700,              // Current weight (lb)
  idealWeight: 800,         // Target weight (optional, for overweight horses)
  conditions: ['senior', 'teeth', 'pssm', 'hoof', 'digestive'],
  activity: 'moderate'      // light | moderate | heavy
}
```

### 3.2 Supported Conditions

| Condition | Key | Description |
|-----------|-----|-------------|
| Senior | `senior` | Older horse, may need weight support |
| Teeth Problem | `teeth` | Dental issues requiring soaked feeds |
| Digestive Sensitive | `digestive` | Prone to GI upset |
| PSSM | `pssm` | Polysaccharide Storage Myopathy |
| Hoof Care | `hoof` | Active hoof issues |
| Insulin Resistant | `ir` | Equine Metabolic Syndrome / IR |
| Overweight | `overweight` | Above ideal body weight |
| Healthy | `healthy` | No special conditions |

Mutual exclusion: `healthy` ↔ `ir`/`overweight`

### 3.3 Feed Types

| ID | Name | Unit |
|----|------|------|
| `pasture` | Free Roaming Pasture | est. (boolean) |
| `timothy_hay` | Timothy Hay (dry) | lb |
| `alfalfa_hay` | Alfalfa Hay (dry) | lb |
| `soaked_timothy` | Soaked Timothy Cubes | lb |
| `soaked_teff` | Soaked Teff Cubes | lb |
| `soaked_alfalfa` | Soaked Alfalfa Cubes | lb |
| `special_pellets` | Haystack Special Blend Pellets | lb |
| `soaked_beet` | Soaked Beet Pulps | lb |

### 3.4 Firebase Structure

```
households/
  {householdId}/
    horses/        → Array of horse profiles
    adjustments/   → { "tenor_timothy_hay": 2.5, ... }
    supplements/   → { "supp_tenor_vit_e": { active: true, dose: 0.5 }, ... }
    season/        → "summer" | "winter"
    _ts/           → Unix timestamp (ms)
```

---

## 4. Recommendation Engine

### 4.1 Daily Intake Target (% Body Weight)

| Condition | Min % BW | Max % BW | Source |
|-----------|----------|----------|--------|
| IR / Overweight | 1.2% | 1.5% | NRC / Dr. Kellon |
| All others | 1.5% | 1.8% | NRC / Merck Vet Manual |

### 4.2 Feed Distribution Logic

#### Senior + Teeth + PSSM (e.g., Tenor)

- Dry hay limited to **~15% of target** (max 2 lb) per vet dental recommendation
- Soaked feeds constitute **~80%** of total intake
- Beet pulp: 1–2.5 lb (low-starch fiber, KER-recommended for PSSM)
- Pasture: available in summer (with monitoring)
- Auto-generated notes: NSC <12%, fat supplementation, 3–4 meal splits

#### IR / Overweight (e.g., Spoi)

- **Pasture disabled by default** — must be manually enabled
- Lean toward lower end of target range (30th percentile)
- No alfalfa (high sugar risk)
- Soaked teff cubes preferred (low NSC)
- Auto-notes: grazing muzzle warning, soak hay 30–60 min, ideal weight display

#### Healthy (e.g., Odinn, Uffie)

- Standard timothy-dominant diet with small alfalfa complement
- Pasture available in summer (3 lb estimate)
- Pellets and beet pulp as minor supplements

### 4.3 Season Detection

Auto-detects summer vs winter based on US DST dates (2nd Sunday March → 1st Sunday November). Affects pasture availability and hay quantities.

---

## 5. Supplement System

### 5.1 Supplement Catalog

| ID | Product | Default Dose | Unit | Manufacturer Dose | Notes |
|----|---------|-------------|------|-------------------|-------|
| `balanced_gold` | Triple Crown Balancer Gold | 4 oz | oz | 1–1.5 lb/day | ⚠️ Below mfg; partial ration balancer |
| `amino_trace` | Mad Barn AminoTrace+ | 2 oz | oz | 3.5 oz (700 lb) | ⚠️ Below mfg; adequate with forage minerals |
| `daily_red` | Redmond Daily Red Fortified | 2 oz | oz | 2 oz | At mfg dose |
| `digest_911` | Digest 911 | 1 oz | oz | — | Digestive enzymes |
| `turmeric` | Turmeric for Horse | 1 tbsp | tbsp | — | Anti-inflammatory |
| `super_sport` | Purina Super Sport | 4 oz | oz | 6 oz (750 lb) | ⚠️ Below mfg; reduced for Se overlap |
| `gut_gold` | Assured Gut Gold | 1 oz | oz | — | Probiotics |
| `weight_accel` | Manna Pro Sr Weight Accelerator | 8 oz | oz | 8 oz | At mfg dose; 80% fat |
| `vit_e` | Health-E Max Vitamin E | 1 scoop | scoop | 1 scoop | ⚠️ Half scoop if combined with AT+ |
| `fat_oil` | Vegetable/Rice Bran Oil | 2 tbsp | tbsp | — | Fat energy for PSSM |
| `magnesium` | Magnesium Oxide | 10 g | g | — | IR insulin sensitivity |

### 5.2 Condition-Based Recommendation Rules

| Supplement | Auto-recommended when | Reason |
|-----------|----------------------|--------|
| AminoTrace+ | PSSM, IR, Hoof | Metabolic/hoof: enhanced Cu, Zn, Mg |
| Balancer Gold | Healthy | General ration balancer |
| Super Sport | PSSM | Amino acids for muscle maintenance |
| Vitamin E | PSSM | Critical antioxidant (1,000–5,000 IU) |
| Weight Accel | Senior | Calorie-dense weight support |
| Digest 911 | Digestive | Gut support |
| Gut Gold | Digestive | Microbiome support |
| Turmeric | Hoof, Senior, PSSM | Anti-inflammatory |
| Fat Oil | PSSM | Replace starch calories with fat |
| Magnesium | IR | Dr. Kellon protocol |

### 5.3 Mutual Exclusion Logic

| Rule | Logic |
|------|-------|
| BG ↔ AT+ | PSSM/IR/Hoof → AT+ recommended, BG suppressed; Healthy → BG recommended, AT+ suppressed |
| Weight Accel | Suppressed for IR/Overweight horses (calorie-dense) |

### 5.4 Interaction Warnings (5 active)

| Supplements | Severity | Issue |
|------------|----------|-------|
| AT+ + Balancer Gold | ⚠️ Warning | Both are complete vit/min; doubles Zn, Cu, Se |
| AT+ + Daily Red | ⚠️ Warning | Overlapping Se (~3 mg, 4.6× NRC), Iodine (~7.7 mg) |
| BG + Daily Red | ⚠️ Warning | Overlapping Zn, Cu, Se, Vit A/D/E |
| AT+ + Health-E Max | 💡 Info | Combined Vit E ~8,800 IU; suggest half scoop → ~4,700 IU |
| AT+ + Super Sport | 💡 Info | Combined Se ~0.93 mg (safe but don't exceed) |

### 5.5 Below-Manufacturer Dosage Highlights

Supplements with app doses lower than manufacturer recommendations are highlighted in the UI with an orange note explaining why:

- **Balancer Gold:** 4 oz vs 1–1.5 lb (used as partial ration balancer)
- **AminoTrace+:** 2 oz vs 3.5 oz (adequate when combined with forage)
- **Super Sport:** 4 oz vs 6 oz (reduced to limit selenium overlap)
- **Health-E Max:** Half scoop recommended when combined with AT+

---

## 6. UI / UX

### 6.1 Navigation

| Tab | Icon | Description |
|-----|------|-------------|
| Feed | 🥕 | Per-horse feed recommendations with adjustment controls |
| Supps | 💊 | Supplement toggles, dosage, interaction warnings |
| Summary | 📊 | Cross-horse daily feed & supplement comparison table |
| Settings | ⚙️ | Horse profiles, season, cloud sync |

Hidden tabs (reserved for scale-up): Logs (📋), Trends (📈)

### 6.2 Design Principles

- **Mobile-first:** Optimized for phone use at the barn
- **Colorblind-safe:** Wong/IBM palette for badges, charts, and status indicators
- **Offline-capable:** PWA with Service Worker; works without internet
- **Single file:** Entire app in one `index.html` for simplicity

### 6.3 Key UI Components

- **Horse tabs:** Horizontal scrollable tab strip for switching between horses
- **Target bar:** Visual progress bar showing current vs target intake range (green/yellow/red)
- **Feed rows:** +/− buttons and numeric input for each feed type
- **Supplement toggles:** On/off switches with dose inputs; grouped by recommended vs other
- **Interaction alerts:** Orange (warning) and blue (info) cards with detailed explanations
- **Manufacturer dose notes:** Orange-bordered callouts on supplements below mfg dose

---

## 7. Cloud Sync

### 7.1 Technology

- Firebase Realtime Database (Spark free plan)
- Firebase JS SDK v10.12.2 (compat build)
- WebSocket-based real-time push (< 1 second latency)

### 7.2 Sync Flow

1. User creates a **Household ID** (auto-generated `word-word-NNNN`) or joins an existing one
2. All state changes write to `localStorage` + Firebase simultaneously
3. Remote changes trigger `onValue` listener → merge if remote `_ts` > local `_ts`
4. `syncPaused` flag prevents echo loops during write operations

### 7.3 Security (Current — POC)

| Aspect | Status | Notes |
|--------|--------|-------|
| Authentication | ❌ None | Household ID is the only access control |
| Database Rules | Open read/write per household | Acceptable for < 5 users |
| API Key exposure | Expected | Firebase keys are public by design; security relies on DB rules |
| Data sensitivity | Low | Only feed quantities and supplement settings |

### 7.4 Security Roadmap (Scale-Up)

| Phase | Users | Measures |
|-------|-------|----------|
| Phase 1 | 10–50 | UUID household IDs, Firebase Anonymous Auth, authenticated DB rules |
| Phase 2 | 50–500 | Google/Email login, owner-managed invites, rate limiting |
| Phase 3 | 500+ | Migrate to Firestore, Cloud Functions validation, audit logs, Blaze plan |

---

## 8. Veterinary & Nutritional Sources

The recommendation engine is based on guidelines from:

| Source | Used For | Link |
|--------|----------|------|
| NRC (National Research Council) | Daily intake % BW, mineral requirements | [Nutrient Requirements of Horses (6th Ed.)](https://nap.nationalacademies.org/catalog/11653/nutrient-requirements-of-horses-sixth-revised-edition) |
| Merck Veterinary Manual | General equine nutritional guidelines | [Nutritional Requirements of Horses](https://www.merckvetmanual.com/management-and-nutrition/nutrition-horses/nutritional-requirements-of-horses-and-other-equids) |
| Dr. Eleanor Kellon, VMD | IR/EMS management, AminoTrace+ protocol, Mg supplementation | [ECIR Group / Dr. Kellon](https://ecirhorse.org/) |
| Kentucky Equine Research (KER) | PSSM diet (low starch, high fat, Vit E 1,000–5,000 IU) | [Diet Adjustments for PSSM Horses](https://ker.com/equinews/diet-adjustments-provide-relief-pssm-horses/) |
| Mad Barn Academy | Icelandic horse breed guide, metabolic horse feeding | [Icelandic Horse Breed Guide](https://madbarn.com/icelandic-horse-breed-guide/) · [How to Feed EMS Horses](https://madbarn.com/how-to-feed-metabolic-horse/) · [PSSM Feeding Guide](https://madbarn.com/pssm-in-horses/) |
| The Horse (thehorse.com) | Senior horse dental feeding management | [Feeding Senior Horses with Dental Dysfunction](https://thehorse.com/1108978/what-to-feed-senior-horses-with-dental-and-digestive-dysfunction/) |
| Siamber Wen Icelandics | Icelandic-specific feeding (2–2.5% BW intake) | [Feeding Your Icelandic Horse](http://www.icelandichorses.co.uk/feeding.html) |
| KER — Metabolic Horses | Forage & NSC management for IR/EMS | [Feeding Forage & Limiting NSC](https://ker.com/equinews/feeding-forage-and-limiting-nonstructural-carbohydrates-in-metabolic-horses/) |

### 8.1 Product References

| Product | Manufacturer | Guaranteed Analysis / Info |
|---------|-------------|---------------------------|
| Triple Crown Balancer Gold | Triple Crown Feed | [Product Page](https://www.triplecrownfeed.com/products/balancer-gold/) · [Mad Barn Analysis](https://madbarn.com/feeds/balancer-gold-triple-crown/) |
| Mad Barn AminoTrace+ | Mad Barn | [Product Page](https://madbarn.com/product/aminotrace/) · [Nutritional Profile](https://madbarn.com/feeds/aminotrace-vitamin-and-mineral-supplement-mad-barn/) |
| Purina SuperSport | Purina Mills | [Product Page](https://www.purinamills.com/horse-feed/products/detail/purina-supersport-amino-acid-supplement) |
| Manna Pro Sr Weight Accelerator | Manna Pro | [Mad Barn Analysis](https://madbarn.com/feeds/senior-weight-accelerator-manna-pro/) |
| Redmond Daily Red Fortified | Redmond Equine | [Product Page](https://redmondequine.com/products/daily-red) |
| Health-E Maximum Vitamin E | — | [Product Info](https://www.pbsanimalhealth.com/health-e-maximum-strength-vitamin-e-horse-supplement/p/10003/) |

---

## 9. Default Horse Profiles

| Horse | Weight | Ideal Weight | Conditions | Notes |
|-------|--------|-------------|------------|-------|
| 🐎 Tenor | 700 lb | — | Senior, Teeth, Digestive, PSSM, Hoof | Complex multi-condition; soaked feeds priority |
| 🏇 Odinn | 700 lb | — | Healthy | Standard maintenance diet |
| 🐴 Uffie | 800 lb | — | Healthy | Standard maintenance diet |
| 🐎 Spoi | 950 lb | 800 lb | IR, Overweight | Restricted diet, no pasture default |

---

## 10. Known Limitations

1. **Single-file architecture** — entire app in one HTML file; will need modularization for larger features
2. **No user authentication** — anyone with household ID can read/write
3. **No historical tracking** — Logs and Trends tabs are coded but hidden; need backend for persistence
4. **Hardcoded feed database** — feed types and nutritional values are not user-configurable
5. **No weight tracking over time** — ideal weight is static; no chart of weight progress
6. **No push notifications** — no reminders for feeding times or supplement schedules
7. **US-centric season detection** — DST-based summer/winter; doesn't work for other regions

---

## 11. Future Roadmap

| Priority | Feature | Effort |
|----------|---------|--------|
| 🟢 High | Enable Logs tab — daily snapshot persistence via Firebase | Medium |
| 🟢 High | Enable Trends tab — weight & feed charts from log history | Medium |
| 🟡 Medium | Add horse — allow creating new horse profiles beyond defaults | Low |
| 🟡 Medium | Delete horse — remove horses from the household | Low |
| 🟡 Medium | Custom feed types — user-defined feeds with nutritional values | Medium |
| 🟡 Medium | Feeding time reminders — push notifications via Service Worker | Medium |
| 🟠 Low | Multi-household support — switch between barn/household contexts | Medium |
| 🟠 Low | Vet sharing mode — read-only link for veterinarian review | Low |
| 🟠 Low | PDF export — generate printable feeding charts | Medium |
| 🔵 Scale | User authentication (Firebase Auth) | Medium |
| 🔵 Scale | Migrate to Firestore for better querying | High |
| 🔵 Scale | Mobile native app (React Native or Capacitor wrapper) | High |

---

## 12. Development & Deployment

### 12.1 Local Development

```bash
# Clone the repo
git clone https://github.com/shuening/Icelandic-horse-feed-calculator.git
cd Icelandic-horse-feed-calculator

# Serve locally (any static server works)
python3 -m http.server 8000
# Open http://localhost:8000
```

### 12.2 Deployment

- Push to `main` branch → GitHub Pages auto-deploys
- No build step required (vanilla HTML/JS)

### 12.3 Firebase Setup

1. Create project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Realtime Database (us-central1, Spark plan)
3. Register web app → config is embedded in `index.html`
4. Set database rules (see `firebase-rules.json`)

---

*This document describes the POC as built. It is a living document and should be updated as the app evolves.*
