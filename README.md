# elucidation.cheminfo.org

Web interface for **SECS**, which elucidates molecular structures from a ¹H NMR spectrum
and a molecular formula. Deployed at [elucidation.cheminfo.org](https://elucidation.cheminfo.org).

> Mirza, A., Patiny, L. & Jablonka, K. M. End-to-end multimodal structure elucidation from
> raw spectra combining contrastive learning and evolutionary algorithms.
> _Nature Communications_ **17**, 5013 (2026).
> [doi:10.1038/s41467-026-73846-y](https://doi.org/10.1038/s41467-026-73846-y)

This repository holds the React frontend and the deployment for the whole stack. The
elucidation backend lives in [lamalab-org/secs-app](https://github.com/lamalab-org/secs-app).

## What it does

Two ways in:

- **Examples** — 20 reference challenges published with the paper, each with its
  experimental spectrum and the ranked candidates the model produced. Precomputed and
  shipped with the site, so browsing them is instant and makes no API call.
- **Elucidate** — drop your own spectrum (JCAMP-DX, zipped Bruker, JEOL, Varian), enter a
  molecular formula, and submit. A run takes roughly 20–45 minutes; it survives closing
  the page and is listed under **Runs**.

Every run is stored in IndexedDB with the exact request that was sent — including the
full 10 000-point spectrum and the search parameters — and every response that came back,
verbatim. Opening a past run replays it from that record: the spectrum is replotted and
the candidates are re-ranked locally, with no call to the server. That is not a
convenience but a requirement, since the server identifies a run by its spectrum and
therefore cannot recompute one it has already seen (see below). Expect roughly 230 kB per
stored run; the Runs page shows the current total.

Run settings — the model and the genetic-algorithm parameters — are fixed in code and
deliberately not exposed in the interface. Because a run is identified by its spectrum
alone, changing them could never affect a spectrum that has already been submitted, so
offering them as controls would only invite users into a setting that silently does
nothing.

## Development

```sh
npm install
npm run dev        # http://localhost:10718, API calls proxied to production
npm run test       # unit tests, type-check, lint, format check
npm run playwright # end-to-end tests
```

`npm run dev` proxies `/submit`, `/jobs`, `/queue` and `/workers` to
`https://elucidation.cheminfo.org`. Point them elsewhere with `API_TARGET`. There is no
runtime endpoint override: the app always calls relative paths, since it is deployed
same-origin with the API.

## Demo data

`public/challenges/` is generated from the upstream dataset and committed. Regenerate it
when the challenge set changes:

```sh
npm run build-challenges
```

The upstream file is a single 12.7 MB JSON array. The script splits it into a metadata
index plus one spectrum per challenge, and drops the ppm axis — it is the fixed grid,
identical in every entry — cutting the payload to 1.8 MB and making the list load from a
single 132 KB request.

## Deployment

```sh
cp .env.example .env      # then uncomment one COMPOSE_FILE line
docker compose up -d
```

`compose.traefik.yaml` serves the SPA and the API **on the same origin**: Traefik routes
`/submit`, `/jobs`, `/queue`, `/workers` and `/docs` to the FastAPI service at priority
100, and everything else to the static frontend at priority 50. The frontend therefore
calls relative paths and CORS never applies.

Submissions are rate limited per source address, because each accepted job occupies a
worker for tens of minutes and the API has no authentication.

## Things worth knowing about the backend

These shape the interface, and are not obvious from the API alone:

- **A run is identified by the spectrum alone** — `sha256(spectrum.y)`. The formula, the
  model and the search parameters are not part of that hash. Resubmitting the same file
  with a different formula returns the earlier run's candidates labelled `cached`. The
  app stores what it submitted for each job and refuses to display a result whose formula
  does not match, rather than misattributing it.
- **The normalization grid is part of the contract.** Spectra are resampled to 10 000
  points between −2 and 10 ppm and rescaled to 0–1. Changing that grid changes every job
  id and invalidates every cached result, so `src/spectrum/grid.ts` must not be touched.
- **There is no real progress reporting.** The worker emits one Celery `PROGRESS` event
  before the genetic algorithm starts, with `current` fixed at 0, and nothing after. The
  UI therefore shows an indeterminate bar with elapsed time and queue depth, never a
  percentage. The API also overwrites `status` with the worker's own stage string, so any
  value that is not a known Celery state is treated as "running".
- **Results expire.** The Celery result is dropped an hour after completion and the job
  mapping after a day. Candidates are fetched once on completion and stored in IndexedDB,
  which is the only durable copy.

## Licence

MIT, except that JCAMP-DX parsing depends on
[`jcampconverter`](https://github.com/cheminfo/jcampconverter), which is
CC-BY-NC-SA-4.0.
