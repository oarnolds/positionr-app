# Homepage Redesign — Design Spec

**Datum:** 2026-08-19
**Scope:** alleen de marketing-homepage (`app/(marketing)/page.tsx`). Andere marketing-pages, auth en app-shell zijn expliciet buiten scope voor deze iteratie.
**Achterliggend probleem:** de huidige homepage is generiek Tailwind-SaaS zonder karakter — geen visueel anker in de hero, geen product-bewijs, geen sectie-ritme, geen herkenbare Positionr-identiteit. De copy (H1 en propositie) is inhoudelijk oké; alleen de visuele + structurele uitwerking wordt vernieuwd.
**Emotionele doelstelling:** warm-vertrouwd, MoneyBird-achtig (Nederlands, laagdrempelig, ambachtelijk), zonder illustratie-gevoel te worden — de tool is data/analyse, niet boekhouden.
**Ontwerptaal:** Apple-fluidprincipes (springs, translucent materials, direct manipulation, typografische discipline) vertaald naar een warm crème-getint palet.

---

## 1. Visuele fundament

### 1.1 Palet

| Rol | Waarde | Gebruik |
|---|---|---|
| Base | `#FBF9F5` (crème, warm off-white) | Body-achtergrond, ipv puur wit |
| Kaart-tint | `#F5EFE4` @ 40% opacity | Wetenschap-sectie + slot-CTA-blok |
| Ink-hoog | `#1A1A1F` (bijna-zwart, licht warm) | Koppen |
| Ink-mid | `#4A4A55` | Body-tekst |
| Ink-mut | `#8A8A95` | Micro-copy, muted labels |
| Primary (paars) | `hsl(262 55% 55%)` — iets warmer dan huidig `262 83% 58%` | Accents, chips, secundaire CTA-tekst, nummers |
| Accent (koraal) | `#E56A50` | **Uitsluitend** primaire CTA-knoppen. Één per view. |
| Support (muntgroen) | `#6DB396` | Succes-chips, checkmarks, positive-score-indicators |
| Border-mut | `rgba(0,0,0,0.08)` | Kaart-ringen, dividers |

**Regels:**
- Nooit koraal als tekstkleur of border. Alleen als knop-fill.
- Paars is karakter, niet decoratie — houdt zijn effect als het schaars ingezet wordt.
- Support-groen alleen als data-indicator, niet als achtergrond of accent.
- Materialen: sticky navbar krijgt `background: rgba(251,249,245,0.7); backdrop-filter: blur(20px) saturate(180%);`. Content scrollt eronderdoor — geen opake balk (Apple-skill §12).

### 1.2 Typografie

| Rol | Font | Details |
|---|---|---|
| Display (H1, section H2) | **Fraunces** (variable serif, Google Fonts) | `font-optical-sizing: auto`, `letter-spacing: -0.02em` op ≥ `text-4xl`, `line-height: 1.05` op display, `1.15` op H2 |
| UI/body | **Inter** (variable) | Body `1rem` / `line-height: 1.65`, kleinere labels `text-sm` / `1.5` |
| CTA buttons | Inter | `text-[15px] font-semibold tracking-[0.01em]` |
| Eyebrows | Inter | `text-xs font-semibold uppercase tracking-[0.12em]` in paars |
| Nummers "1/2/3" in verhaal-sectie | Fraunces | `text-6xl`, paars, decoratief (niet als lijst-marker) |

**Loading strategie:** Fraunces + Inter via `next/font/google` met `display: swap` en `preload: true` voor Inter (kritisch), Fraunces alleen op de homepage bundled (niet globaal — anders zit hij ook op app-shell en pricing waar hij niet nodig is).

**Regels (Apple-skill §15):**
- Nooit één `letter-spacing`-waarde voor alle groottes.
- Body-`line-height` altijd `1.5+` voor comfort.
- Spacing in `rem`, respecteer Dynamic Type / browser text-zoom.

### 1.3 Spacing en radius

- **Grid**: 12-koloms op `≥ lg` (1024px), 6 op `md`, 1 op mobile.
- **Section padding**: `py-24 md:py-32` — meer lucht dan huidig `py-16`.
- **Radius-schaal**: `rounded-xl` (12px) voor mockup-frames, `rounded-2xl` voor pakket-cards, `rounded-3xl` voor slot-CTA-blok. Nooit `rounded-full` op knoppen (pill-buttons voelen niet MoneyBird — gebruik `rounded-lg`).
- **Shadows**: alleen `shadow-sm shadow-black/5` op cards. Mockups krijgen `shadow-2xl shadow-black/10`. Nooit gekleurde shadows.

---

## 2. Sectie-structuur (top → bottom)

1. Sticky nav (translucent)
2. **Hero** — asymmetrisch, tekst-links + productmockup-rechts
3. **3-staps verhaal** — "Zo werkt het" met zigzag-layout en echte screenshots
4. **Wetenschappelijke fundering** — Cialdini / Ritson / Kotler kaarten
5. **Bureau vs Positionr** — driekoloms feit-naast-feit
6. **Pakketten-teaser** — 3 cards, link naar `/prijzen`
7. **FAQ** — accordion, 6 vragen
8. **Slot-CTA** — crème-blok, "Doe de gratis check"
9. **Footer** — 3 kolommen + copyright

### 2.1 Hero

**Layout ≥ lg**: 12-kol grid, tekst kol 1–5, mockup kol 6–12. Verticale align: tekst top-baseline, mockup licht overhangend (translate-y `-1rem`).
**Layout < lg**: tekst boven, mockup daaronder in eigen `overflow-x-auto` container zodat hij niet forceert.

**Links:**
- Pill-chip bovenaan: "Marketinganalyse voor MKB" — crème, `border border-black/8`, `text-xs`, paarse `Sparkles`-icon.
- H1 (Fraunces, `text-5xl md:text-6xl lg:text-7xl`): "De second opinion voor je marketingbeslissingen."
- Sub (Inter, `text-lg`, `text-slate-600`): "Wat een bureau in dagen doet, krijg jij in minuten. Concreet, direct toepasbaar, met wetenschappelijke basis."
- CTAs (horizontale rij, gestapeld < sm):
  - Primair (koraal, `bg-[#E56A50] text-white`, `rounded-lg px-5 py-3`): "Probeer de gratis Website Check" → `/gratis-check`
  - Secundair (link, `text-slate-700 hover:text-slate-900`, underline-on-hover): "Bekijk de pakketten" → `/prijzen`
- Micro-copy onder de knoppen: "Geen credit card. Klaar in ± 2 minuten."

**Rechts:**
Een gerenderde Website Check-mockup in een browser-frame — traffic-light dots links boven (macOS-stijl), radius `xl`, `shadow-2xl`. Inhoud: paarse score-banner ("8.2 / 10" + fictieve bedrijfsnaam "Voorbeeld B.V."), daaronder één "Score per onderdeel"-card met 3–4 rijen. Rest afgesneden onderin met soft mask-gradient → suggereert "er zit meer".

**Achtergrond hero:**
Absolute-positioned paarse blob linksonder (`w-[480px] h-[480px]`, `bg-primary/5`, `blur-[120px]`, `-z-10`). Rechts, achter de mockup, subtiele koraal-blob (`bg-[#E56A50]/[0.04]`, blur `100px`).

**Motion:**
- Bij load: mockup slidet 12px omhoog met spring `bounce: 0.15, duration: 0.4`. Één-shot.
- Twee "onboard-badges" (bv. "AI-analyse", "In < 3 min") verschijnen sequentieel bij scroll-into-view.
- Chip + H1 + sub + CTAs: fade + 4px slide-up, stagger 60ms, `duration: 0.35, bounce: 0`.
- Alle interruptible (§3 Apple-skill).

### 2.2 3-staps verhaal

Eyebrow "Zo werkt het." H2 (Fraunces, `text-4xl`): "Van vraag tot toepasbaar antwoord in drie stappen."

**Drie rijen, zigzag-alternerend:**
| Rij | Layout ≥ lg | Nummer |
|---|---|---|
| 1 | tekst kol 1–5, screenshot kol 7–12 | `1` (Fraunces `text-6xl` paars) linksboven de tekst |
| 2 | screenshot kol 1–6, tekst kol 8–12 | `2` |
| 3 | tekst kol 1–5, screenshot kol 7–12 | `3` |

**Rij-inhoud:**
1. **"Stel je vraag of upload je URL"** — screenshot: het gratis-check-formulier met invulveld actief. Body: "Kies een module — Website Check, ICP-analyse, Concurrentieanalyse — en geef ons je bedrijf. Meer heb je niet nodig."
2. **"Onze AI analyseert je situatie"** — screenshot: de "Bezig met analyseren…"-progress met 3 fase-bullets. Body: "In ± 2 minuten combineren we jouw input met wetenschappelijk gefundeerde raamwerken (Cialdini, Ritson, Kotler). Geen algoritme-magie — je ziet exact wat we doen."
3. **"Krijg concrete, geprioriteerde acties"** — screenshot: een echte Website Check result-view met top-5 acties + impact-badges. Body: "Geen 40-pagina rapport dat op de plank belandt. Vijf acties met impact-score, direct toepasbaar deze week."

**Screenshot-styling:**
Zelfde browser-frame als hero-mockup, `rotate-[-1deg]` op rij 1+3, `rotate-[1deg]` op rij 2. Op mobile: `rotate-0` en volle breedte.

**Motion:**
Rijen fade + 8px slide-up bij `IntersectionObserver` (rootMargin `-15%`), één-shot, `duration: 0.35, bounce: 0`. Elke rij eigen trigger; niet gestagger'd binnen dezelfde rij.

### 2.3 Wetenschappelijke fundering

Sectie-achtergrond: full-bleed `bg-[#F5EFE4]/40`, `py-32`. Innerlijk `max-w-6xl` container.

Eyebrow "De basis." H2 (Fraunces, `text-4xl`): "Geen buikgevoel, maar 60 jaar marketingwetenschap." Sub (`text-slate-600`): "Elke aanbeveling komt uit raamwerken die aan universiteiten en de sterkste bureaus dagelijks worden toegepast — vertaald naar jouw context."

**Drie kaarten** (3-koloms grid ≥ md, gestapeld < md):

| Kaart | Icoon (paars, 40×40) | Label | Kop (Fraunces `text-xl`) | Body (Inter, `text-slate-600`) |
|---|---|---|---|---|
| 1 | Cirkel met "6" | Cialdini | Waarom mensen 'ja' zeggen. | Zes principes van invloed — reciprociteit, sociale bewijskracht, autoriteit, sympathie, schaarste, commitment — gebruikt om je propositie en CTAs te toetsen. |
| 2 | Diagnose-piramide | Mark Ritson | Diagnose vóór creatie. | Wij analyseren eerst je categorie, doelgroep en positionering — dan pas de tactiek. De aanpak die grote adverteerders van sub-schaal onderscheidt. |
| 3 | 4P-matrix | Philip Kotler | Klassieke marketingmix, modern toegepast. | Product, prijs, plaats, promotie — met de aanvullingen uit Kotler's latere werk over CX en H2H (human-to-human). |

**Kaart-styling:** `bg-white`, `rounded-2xl`, `p-8`, `shadow-sm shadow-black/5`, geen expliciete border. Label als kleine `text-xs uppercase tracking-wider text-slate-500` boven de kop.

**Onderaan:** "Meer weten? [Lees onze methodiek →](/methodiek)" — **alleen tonen als `/methodiek` bestaat**. Voor v1: weglaten.

**Motion:** kaarten fade + 8px slide-up bij intersect, 80ms stagger.

### 2.4 Bureau vs Positionr

Kleine sectie (`py-16`), niet full-bleed, geen eigen achtergrond. Voelt als een tussenblok. Eyebrow "Wat het verschil maakt." H3 (Fraunces, `text-2xl`): "Bureau of Positionr — dit weegt anders."

**Drie kolommen**, elk met pictogram (paars 32×32) + Fraunces `text-xl` kop + twee `text-slate-600`-regels ("Bureau: …", "Positionr: …"):

| Kolom | Icoon | Kop |
|---|---|---|
| Tijd | Clock | Bureau: dagen tot weken. Positionr: minuten. |
| Prijs | Coins | Bureau: € 5.000 – € 30.000+. Positionr: één jaarbedrag. |
| Controle | ThumbsUp / Hand | Bureau: extern advies. Positionr: in eigen handen. |

Geen tabel-borders. Kolommen simpelweg naast elkaar in een `grid-cols-3 gap-8` op ≥ md.

**Regel:** géén "bureau slecht, Positionr goed"-toon. Feit-naast-feit; de bezoeker trekt zelf de conclusie.

### 2.5 Pakketten-teaser

Sectie `py-24`. H2 (Fraunces `text-4xl`): "Eén jaarbedrag, alle modules in je pakket." Sub: "Geen uurtarieven, geen consultancy-add-ons. Een fractie van wat één bureau-traject kost."

**Drie pakket-cards** (`grid-cols-3 gap-6` ≥ lg, gestapeld < lg):

| Pakket | Focus | Populair? |
|---|---|---|
| Fundament | "Weten wat er speelt." | Nee |
| Groei | "Actie ondernemen, gefundeerd." | **Ja** (subtiele "Populair"-badge) |
| Strategie | "Structureel sterker positioneren." | Nee |

**Card-styling:**
- `bg-[#F5EFE4]/40`, `rounded-2xl`, `p-8`, `ring-1 ring-black/5`.
- Populair-card: extra `border-t-2 border-primary`, `translate-y-[-4px]`.
- Inhoud: pakket-naam (Fraunces `text-2xl`), 1-regel propositie (`text-slate-600`), jaarprijs (Fraunces `text-4xl` + kleine `text-sm text-slate-500 /jaar` erachter), knop "Kies dit pakket" (koraal op populair-card, secundair op anderen).
- **Geen feature-lijst** — alleen naam/propositie/prijs/CTA. Onder de cards: "Bekijk alle features per pakket → [/prijzen]".

**Motion:** hover-lift `translateY(-2px)` met spring `bounce: 0, duration: 0.2`.

### 2.6 FAQ

Sectie `py-24`, `max-w-3xl mx-auto`. H2 (Fraunces `text-3xl`): "Wat vragen mensen ons vaak?"

**Accordion (native `<details>` of custom):**
- Rij: `border-b border-slate-200`, `py-5`. Zomertekst kop `text-[17px] font-medium`.
- Chevron rechts, 90° rotatie op open (spring `bounce: 0, duration: 0.25`).
- Body: `text-slate-600`, `mt-3`, `pr-8`. Height-animation via `grid-template-rows: 0fr → 1fr` truc (JS-loos, animatable).
- Één rij open tegelijk (Apple-support-style). Bij openen: sluit anderen automatisch.

**Initiële vragen (kunnen later worden aangepast):**
1. Kan ik dit ook zonder marketing-achtergrond gebruiken?
2. Wat gebeurt er met mijn data?
3. Werkt dit ook voor mijn sector?
4. Kan ik opzeggen?
5. Hoe verhoudt Positionr zich tot mijn huidige bureau?
6. Wat als ik meer hulp nodig heb dan de tool geeft?

Concrete antwoord-copy is content-werk voor Olivier — spec toont slechts de vragen, plan zal placeholders bevatten met "TODO: copy invullen".

### 2.7 Slot-CTA

Full-bleed sectie `py-24`, binnen container: `bg-[#F5EFE4]`, `rounded-3xl`, `p-16 md:p-24`, gecentreerde tekst.

- H2 (Fraunces `text-4xl`): "Klaar om zelf grip te krijgen?"
- Sub (`text-lg text-slate-600`): "Begin met een gratis Website Check — geen account, ± 2 minuten."
- Knoppen: primair koraal "Doe de gratis check →", secundair link "Of bekijk eerst de pakketten".
- Micro-copy onder: "Ruim 90% van de tijd zit je binnen 5 minuten met een concreet rapport voor je."

### 2.8 Footer

`bg-[#FBF9F5]`, `border-t border-slate-200/60`, `py-16`. Container `max-w-6xl mx-auto`.

Drie kolommen op ≥ md, gestapeld op mobile:
- **Product**: Modules, Pakketten, Gratis check, Log in
- **Bedrijf**: Over ons, Methodiek, Contact
- **Juridisch**: Voorwaarden, Privacy, Cookiebeleid

Onderin (flex, space-between): Logo (klein, 24px hoogte) links; rechts `text-sm text-slate-500`: "© 2026 Positionr · Gemaakt in Nederland".

---

## 3. Interactie & motion — samenvattend

Elk animeerbaar element volgt de Apple-skill principes:

- **Springs, geen `@keyframes`** voor UI-transitions. Framer Motion / motion-lib.
- **Defaults**: `bounce: 0` voor UI reveals; `bounce: 0.15` alleen op één-shot momentum (hero-mockup, hover-lifts).
- **Interruptible**: nooit `pointer-events: none` tijdens transities.
- **Scroll-reveals**: `IntersectionObserver` met `rootMargin: '0px 0px -15% 0px'`, één-shot per element (state in `useRef`).
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` — alle slides → fades (`transition: opacity 200ms`), springs → static, hero-mockup start op eind-positie.
- **Reduced transparency**: `@media (prefers-reduced-transparency: reduce)` — navbar `backdrop-filter: none`, achtergrond volledig opaak.
- **Compositor-friendly**: alleen `transform` + `opacity`. `will-change` op hero-mockup + rijen die on-scroll bewegen.
- **Rubber-banding**: niet nodig (geen native scroll-lock op de homepage).

---

## 4. Responsive breakpoints

Tailwind-defaults met bewuste keuzes op boundaries:

| Breakpoint | Layout-wijziging |
|---|---|
| `< sm` (< 640) | Alles 1-koloms. Hero-mockup krijgt overflow-x-auto container. CTA-knoppen gestapeld. Zigzag-rotaties uit. |
| `sm` — `md` | Nog 1-koloms; padding vergroot naar `py-20`. |
| `md` (≥ 768) | Bureau-vs-Positionr wordt 3-koloms. Wetenschap-kaarten worden 3-koloms. Footer 3-koloms. |
| `lg` (≥ 1024) | Hero wordt asymmetrisch (5/7). Zigzag verhaal-sectie in werking. Pakket-cards 3-koloms. |
| `xl` (≥ 1280) | Container max-width `1200px`, geen verdere layout-wijzigingen — alleen meer lucht. |

---

## 5. Toegankelijkheid

- Alle koraal-CTA's: contrast-ratio getest tegen `#FBF9F5` base (koraal `#E56A50` op crème → ~4.7:1, voldoet AA voor knop-tekst-op-fill zolang tekst wit is).
- Focus-rings: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F5]` als standaard.
- Nav en accordion volledig keyboard-navigeerbaar (Tab, Enter, Space, Escape voor close).
- Semantische landmarks: `<header>`, `<main>`, `<footer>`, `<section aria-labelledby>` per blok.
- Alt-tekst op alle mockup-screenshots: beschrijft wat je ziet (bv. "Screenshot: rapportage met een score van 8,2 uit 10 voor Voorbeeld B.V., met verbeterpunten per onderdeel").
- Reduced-motion en reduced-transparency queries volledig ondersteund (§3).

---

## 6. Buiten scope (voor v1 van deze redesign)

Bewust niet meegenomen; kan in vervolgspecs opgepakt worden zodra homepage staat:

- **Live-demo hero** (URL invullen + preview) — was alternatief B in brainstorm. Blijft interessant maar vereist rate-limiting + async UX-werk.
- **Andere marketing-pages** (`/prijzen`, `/gratis-check`, `/checkout`, `/voorwaarden`, `/privacy`). Zij houden huidige look tot volgende iteratie; visuele inconsistentie is tijdelijk geaccepteerd.
- **`/methodiek`-pagina** — link naar deze pagina zit onder wetenschap-sectie maar de pagina zelf bouwen we niet in deze PR.
- **Klant-testimonials** — geen echte klanten (nog). Later plek onder wetenschap-sectie.
- **Video / motion graphics in de hero** — te veel gewicht + performance-risico.
- **Dark mode** voor marketing-pages — huidig alleen light. Kan later.
- **i18n** — Nederlands blijft de enige taal.

---

## 7. Acceptatiecriteria

De redesign is klaar wanneer:

- [ ] Homepage laadt in ≤ 1.5s LCP op een 4G-simulatie (Vercel deploy) — Fraunces + Inter via `next/font/google` met display: swap.
- [ ] Alle 8 secties (nav → footer) live en visueel consistent met deze spec.
- [ ] Hero-mockup toont een échte rapport-render (geen placeholder-image).
- [ ] Alle motion voldoet aan Apple-skill regels (springs, interruptible, reduced-motion respected).
- [ ] Op mobile (`< 640px`) is er geen horizontal scroll van het `<body>` — alleen expliciete `overflow-x-auto` containers.
- [ ] Contrast en keyboard-navigatie voldoen (checkt: Lighthouse a11y ≥ 95).
- [ ] Bestaande copy (H1, propositie) blijft onveranderd; alleen de visuele omkadering vernieuwt.
- [ ] Geen wijzigingen aan andere pages (`/prijzen`, `/gratis-check`, etc.) — homepage-only.

---

## 8. Risico's

| Risico | Impact | Mitigatie |
|---|---|---|
| Fraunces + Inter samen = zwaarder font-payload | Iets tragere first-paint | `preload: true` alleen op Inter (kritisch); Fraunces krijgt `display: swap` en wordt alleen op homepage geïmporteerd, niet globaal. Subset naar Latin. |
| Mockup-screenshots vergen echte rapport-data | Kan visuele fake voelen als data er niet is | Voor screenshot: één echte scenario-render (Voorbeeld B.V. of anonimiseerde klant) — gebruikt in build als static asset via `next/image`. Geen live-fetch. |
| Zigzag-layout kan op tablet raar breken | Layout-glitch tussen `md` en `lg` | Op `md` breakpoint valt zigzag terug op verticale stapeling; alleen ≥ `lg` echte zigzag. |
| Nieuwe visuele taal bijt met bestaande pricing-page | Inconsistentie na klik "Bekijk pakketten" | Bewust geaccepteerd; pricing komt in volgende iteratie. Micro-copy op de teaser: "→" laat continuïteit voelen. |
| Koraal wordt overgebruikt door developer-instinct | Kleur verliest attentie-waarde | Regel expliciet in de spec: één primaire CTA per view. Code-review controle. |
| Backdrop-filter niet ondersteund in oudere Safari/FF | Nav voelt niet translucent | `@supports` fallback: opake `bg-[#FBF9F5]/95` als backdrop-filter niet beschikbaar. |

---

## 9. Volgende stap

Implementatieplan schrijven in `docs/superpowers/plans/2026-08-19-homepage-redesign.md` volgens dezelfde structuur als PR-L1 / PR-L2: bite-sized tasks, TDD waar zinvol, commit per taak, inline-op-main uitvoering.
