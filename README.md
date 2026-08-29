# Capsule

A speech-based journaling and cognitive-engagement web app for elderly users and their caregivers.

**Capsule is a journaling and cognitive-engagement tool. It is not a medical device and does not diagnose any condition.** It tracks a person's own speech and memory patterns over time, compared only to their own past, never to disease benchmarks. It never issues verdicts and never promises improvement.

The full disclaimer appears once, gated behind an acknowledgment checkbox, on the opening page. It stays reachable any time via the **?** button in the header. The rest of the app is kept free of repeated disclaimer copy. The ethics live in what the app *does* (own-history-only comparisons, honest bidirectional trend reporting, no diagnostic language anywhere), not in warnings stacked on every screen.

## Running it

Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8741 --directory /Users/tejeshvaddi/IdeaProjects/capsule
```

Then open http://localhost:8741 in Chrome (best speech-recognition support). Typed input works in every browser.

## Project structure

```
index.html            App shell, disclaimer overlay, CDN deps
css/style.css         Glass-morphism theme, responsive layout, palette tokens
js/icons.js           Logo SVG + all inline stroke icons (no emoji anywhere)
js/config.js          >>> Supabase URL + anon key go here to enable accounts <<<
js/data.js            Storage facade, routes to cloud or device automatically
js/cloud.js           Supabase auth + data/photo storage
js/db.js              IndexedDB (device-only mode, and pre-sign-in cache)
js/app.js             Boot, disclaimer gate, tab navigation, branding injection
js/speech.js          Web Speech API wrapper with graceful typed fallback
js/analysis.js        NLP metrics via compromise
js/graph.js           Word-adjacency graph as inline SVG (POS-colored)
js/activities.js      Tailored activity suggestions + activity logging
js/recall.js          Which old entry to resurface, date helpers
js/charts.js          Chart.js trend charts + honest trend-note generation
js/ui.js              Toasts, HTML escaping, shared speech/type composer
js/views/*.js         Six screens: journal, recall, activities, trends, history, account
supabase-schema.sql   Database tables, row-level security, photo bucket policies
```

## Metrics tracked (per entry, computed in-browser)

- Word count, unique words, vocabulary richness (unique/total)
- Noun / pronoun / adverb rates as a share of content words (research-informed)
- Word-adjacency graph: density, mean edge weight (repetition), max in-degree (hub strength)
- Disfluency per 100 words (fillers + immediate repeats). This is **a product metric, not a research-validated measure**, and it is labeled "app metric" on its chart so the distinction stays visible
- For recalls: word count + distinct content words vs. the original entry, plus overlap

Trend notes compare the recent half of the person's own history to the earlier half and state the direction honestly, whichever way it goes.

## Storage & accounts

Capsule runs in one of two modes, decided automatically by whether `js/config.js` has credentials:

| | Device-only (default) | Account mode |
|---|---|---|
| Storage | IndexedDB in the browser | Postgres + private photo bucket |
| Sign-in | none | email 6-digit code |
| Multi-device | no | yes |
| Survives clearing browser data | no | yes |

Views never branch on this. They import `db` from `js/data.js`, which routes to whichever backend is active.

### Going live (enabling accounts)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of `supabase-schema.sql` → Run. This creates the tables, turns on row-level security, and creates the private `photos` bucket.
3. **Project Settings → API** → copy the *Project URL* and the *anon public* key into `js/config.js`.
4. **Authentication → Providers → Email**: make sure Email is enabled. To get 6-digit codes rather than magic links, set the "Magic Link" email template body to include `{{ .Token }}`.
5. Reload. The Account tab now offers sign-in, and anyone with existing device-only entries gets a one-click "copy them to my account" migration.

The anon key is meant to be public, it grants no data access on its own. Every row is gated by the RLS policies in the schema, which restrict reads and writes to `auth.uid() = user_id`. Photos are in a **private** bucket with policies keyed to a per-user folder, so one user cannot enumerate or fetch another's images.

### Verifying RLS yourself

Anything committed here is world-readable once the site is public, so the anon key is only safe while RLS is genuinely on. Confirm it in **SQL Editor** at any time. This lists every table in the public schema and whether row-level security is enabled, so a table added later that missed its policy shows up immediately:

```sql
select
  c.relname                                as table_name,
  c.relrowsecurity                         as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
```

Every row must show `rls_enabled = true` with `policy_count >= 1`. A table with RLS on but zero policies denies everything (fails closed, safe but broken); a table with RLS **off** is world-readable through the anon key.

### Deploying to GitHub Pages

The app is fully static with relative asset paths, so it works from a project page at `username.github.io/repo-name/` with no build step and no path changes. Push the folder, then **Settings → Pages → Deploy from branch**. Pages serves over HTTPS, which the microphone requires, so speech input works there but would not over plain HTTP.

Two things must be configured before real users arrive:

1. **Auth URLs.** In **Authentication → URL Configuration**, set *Site URL* to your Pages URL and add it to *Redirect URLs*. Sign-in emails will not resolve correctly otherwise.
2. **Custom SMTP is required, not optional.** Supabase's built-in email sender is heavily rate-limited and is explicitly not intended for production traffic. With it, most of your users will simply never receive their sign-in code. Connect a real sender (Resend, Postmark, SendGrid, SES) under **Authentication → SMTP Settings** before launch, and raise the auth rate limits to match. **This is the most likely thing to break a launch to hundreds of people.**

### Account deletion

The Account screen has a "Delete my account" section below Sign out, behind a four-step flow: a warning listing exactly what goes, a type-`DELETE`-to-confirm gate, per-step progress, and an outcome screen. Signed-out users with entries on the device get the same flow scoped to this device.

Deletion order matters, and the reason is the gap the earlier security review found:

1. **Photos first, explicitly.** The `on delete cascade` on `auth.users` removes rows from `entries` and `activity_log`, but it does **not** touch Storage objects. Photos are listed recursively under `photos/{user_id}/` and removed before anything else, then the folder is re-listed to confirm it is empty.
2. **Database rows**, deleted explicitly rather than relying on the cascade alone.
3. **The auth user**, via the Edge Function, because `auth.admin.deleteUser` needs the service_role key and must never run in the browser.

Each step reports its own status. If any step fails the app says exactly which one, keeps the others' results, and offers a retry that is safe to run repeatedly. It never claims data is gone when it is not.

**Deploy the function** (needed before deletion works in account mode):

```bash
supabase functions deploy delete-account
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase automatically. Optionally set a salt for the audit hash:

```bash
supabase secrets set AUDIT_SALT="$(openssl rand -hex 16)"
```

The function takes the user id from the caller's verified JWT, never from the request body, so it can only ever delete the caller's own account.

**The audit table** (`deletion_audit`) records that a deletion happened and when, with a one-way hash instead of the user id, so it can confirm compliance without retaining an identifier pointing back at a person. It deliberately has **no** foreign key to `auth.users`, because a cascade would erase the very record proving the deletion. RLS is enabled with no policy at all, so only the Edge Function's service_role key can write it and nothing can read it through the public API.

### The first-run walkthrough

New users get an eight-step tour on first use and on first sign-in, covering each tab in plain language with large type. It is skippable at every step, replayable from the Account screen ("Show me around again"), and remembered per device. Deleting your data resets it, so a fresh start is genuinely fresh.

### Evening reminders

Off by default. A person turns them on from the Account screen, which writes to
`reminder_prefs` along with their browser timezone. An hourly job wakes the
function; it emails only those whose own clock reads 7pm and who have not
finished the day, at most once per person per day.

The timezone matters: without it "7pm" means 7pm wherever the server runs,
which is the middle of the night for most users.

**1. Secrets** (Terminal, from the project folder):

```bash
NEW=$(openssl rand -hex 24); echo "SAVE THIS: $NEW"
supabase secrets set RESEND_API_KEY="your_resend_key" \
  REMINDER_FROM="Capsule <noreply@capsulemem.com>" \
  REMINDER_SECRET="$NEW"
```

**2. Deploy with JWT verification off:**

```bash
supabase functions deploy daily-reminder --no-verify-jwt
```

This flag is required and is specific to this function. Edge Functions normally
demand an `Authorization` header, which a cron job has no user token to supply.
Passing the anon key in the cron headers also works but means pasting a very
long JWT into SQL, where a stray line break produces `UNAUTHORIZED_INVALID_JWT_FORMAT`.
The `x-reminder-secret` header is the real gate either way.

**Never pass `--no-verify-jwt` to `delete-account`.** That one identifies the
caller from their own JWT, which is what stops one person deleting another's
account.

**3. Enable `pg_cron` and `pg_net`** under Database, Extensions.

**4. Schedule it** (SQL editor, substituting the secret from step 1):

```sql
select cron.schedule(
  'capsule-reminders',
  '0 * * * *',
  $$ select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/daily-reminder',
       headers := jsonb_build_object('x-reminder-secret', 'YOUR_SECRET')
     ); $$
);
```

**5. Verify.** `net.http_post` is asynchronous and returns a request id, not a
result, so a scheduled job that fails looks identical to one that works until
you read the response:

```sql
select status_code, content::text, created
from net._http_response order by created desc limit 3;
```

`200` with `{"ok":true,...}` is success. `401 UNAUTHORIZED_NO_AUTH_HEADER` or
`UNAUTHORIZED_INVALID_JWT_FORMAT` are the gateway rejecting the call before the
function runs. `401 {"ok":false,"error":"unauthorised"}` is the function itself,
meaning the secret does not match.

If the secret is ever exposed, rotate it in **both** places: `supabase secrets
set` and the cron job. They must match or reminders stop silently.

### Scaling to hundreds of users

Supabase's free tier covers roughly this size; the paid tier ($25/mo) is the realistic launch target once you pass ~500MB of database or 1GB of photo storage. Photos dominate storage, so consider client-side downscaling before upload (resize to ~1600px, re-encode as JPEG) to cut usage roughly 5–10×. The analysis stays in the browser at any scale, so there is no server compute to grow.

### Privacy and security obligations

This is health-adjacent personal data about a vulnerable population. Before launching to real users:

- **Write a plain-language privacy policy** and link it from the opening page: what's collected, where it's stored, who can see it, how to delete it. Elderly users and their families deserve to understand this without legal training.
- **Deletion must actually work.** `on delete cascade` in the schema removes entries when an auth user is deleted, but photo objects need an explicit sweep. Add a "delete my account and all data" flow before launch rather than leaving it as a support-email process.
- **Regulatory posture.** Because Capsule makes no diagnostic or treatment claims, it sits outside FDA medical-device regulation. That boundary is a product commitment, not just wording, and it breaks the moment anyone adds a risk score, a disease comparison, or a clinical-sounding verdict. In the EU, journal content about cognition is likely GDPR "special category" health data. For US users, HIPAA generally does not apply to a direct-to-consumer app with no covered entity involved, but state health-privacy laws (e.g. Washington's My Health My Data) may. **Get real legal review before launch.** This section is orientation, not legal advice.
- **Caregiver access** is the obvious next feature and the most sensitive one. Build it as explicit, revocable, per-person consent granted by the journaling user, never as an account the caregiver silently controls.
- **Never train models on user journals** without separate, explicit, opt-in consent.
- Enable Supabase's daily backups (paid tier). For many users this journal will be irreplaceable.

### Backups for users

The History page's "Download my data" button exports all entries as JSON (photos not included). In device-only mode this is the only backup that exists, so it's worth encouraging periodically.

## Design

Palette: purple `#4A2E5C`, blue `#4483B0`, lavender `#C9B6E8`, dark `#211A2E`, glass `#F3EFFB`, highlight `#FAF6B0`. Word-graph node colors: noun `#7B3FA0`, verb `#4E6E7E`, adjective `#B25BB0`, adverb `#8DB3BE`, pronoun `#5E2542`. Inter font, glass panels (backdrop blur), 22px radii, large text and tap targets throughout. All iconography is inline SVG inheriting `currentColor`, no emoji, no icon-font or image requests.

## Checks

The app has no build step, so a syntax error or a bad import in any one file
takes down every screen rather than degrading part of it. That happened once
in production. `scripts/check.mjs` guards against it:

```bash
npm run check
```

It parses every JS file **as an ES module**, resolves every relative import,
checks that imported names are actually exported, verifies files referenced by
`index.html` exist, and scans for committed credentials.

It runs automatically before every push via `.githooks/pre-push`, and again in
CI on GitHub. If you clone fresh, activate the hook with:

```bash
git config core.hooksPath .githooks
```

Note that `node --check file.js` is **not** sufficient on its own. On a `.js`
path it does not parse in module mode, and it silently passed the exact missing
comma that took the site down. The checker feeds each file on stdin with
`--input-type=module`, which is how the browser actually parses them.
