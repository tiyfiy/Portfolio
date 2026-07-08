# Prompt — rewrite my portfolio copy in my voice

Paste everything below into the model. Fill the two `[...]` gaps if you want; otherwise leave them.

---

You're writing copy for my personal developer portfolio. Write it **as me**, not as an AI. Output should pass as something I actually wrote.

## Who I am
Engineering/CS student, freelancing and building toward my own company while job searching. Full-stack developer. I care about deep understanding and simplicity — solving a problem the simplest way that holds up, and knowing *why* it works. I don't ship things I can't explain. I like clean, readable code and well-reasoned choices. I've been going deep on WebGL and motion lately.

## Voice — professional-casual (this is the register)
- Relaxed but clearly competent. Friendly, a little lowercase-ish, but it's obvious I know the work.
- Contractions and light slang are fine (gonna, kinda, you'll). Keep some personality — don't flatten it to sound "professional".
- Plain and honest. Say what the thing actually does. No hype.
- Vary sentence length — mix short jabs with longer runs. No metronome rhythm.

## Hard rules (do not break)
- No corporate buzzwords: synergy, leverage, circle back, touch base, align.
- Banned words: delve, crucial, pivotal, leverage, comprehensive, underscore, tapestry, intricate, boasts, garner, landscape, meticulous, foster, robust, seamless, elevate.
- No **"it's not X, it's Y"** framing. No **"from X to Y"** range phrasing.
- No **rule-of-three** stacking ("fast, clean, and reliable"). Vary it.
- No trailing **"-ing" clauses** ("..., enabling real-time insights").
- No **"ta-da" reveals** ("here's the truth", "here's what nobody tells you").
- No em-dash overuse, no Moreover/Furthermore/Consequently pileups, no "Title: Subtitle" headers.
- No clichéd openers ("In today's fast-paced world"), no hedging ("it's worth noting", "generally speaking").
- Keep contractions. A little roughness is good. If it reads mechanical, rewrite it.

## What to write
1. **Hero tagline** — one line, under my name/role. Punchy, honest, says what I build.
2. **About** — a short lead sentence + 1–2 short paragraphs. What I build and how I think about the work.
3. **MBUSI project** — title + a 2–3 sentence description (portfolio card style). Optional one-liner tags list.
4. **Shopify project** — same format.

For each project, lead with what it does and what I actually built, then the interesting technical bit. No filler.

## Project facts — use these, don't invent beyond them

### MBUSI project
A digital twin of city bus public transport with real-time data. Predicts bus locations from user data. What I built: an admin dashboard, an Android mobile app, a desktop app in libGDX, a Go backend, the database, the frontend, MQTT for the live data, and a blockchain layer for storing the important/tamper-sensitive records.
[Add: outcome/impact, team size, timeframe, link — optional]

### Shopify project
An embedded Shopify app for invoice compliance. What I built: auth integrated in a Go backend, and webhooks handling the data flow.
[Add: what compliance/regulation, outcome, link — optional]

## Output format
Give me plain text I can drop into the site, labeled by section (Hero tagline / About / MBUSI / Shopify). Give 2 tagline options. No preamble, no explanation after — just the copy.
