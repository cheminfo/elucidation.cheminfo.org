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
  molecular formula, and submit. A run takes a couple of minutes (see
  [Run duration](#run-duration)); it survives closing the page and is listed under
  **Runs**.

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

Submissions are rate limited per source address (HTTP 429 with a `retry-after` header,
currently around 30 s), because the API has no authentication and one job occupies the
single worker slot for the duration of the run.

The stack is sized for **the latency of one run**, not for throughput: the Celery worker
runs `--concurrency=1`, so a second submission queues rather than competing for the same
two sidecars. The three compute services (`worker`, `vectordb`, `forward_synthesis`) are
each given a quota of 8 CPUs on a 20-core host — deliberately summing above the core
count, since with one job in flight they are active in turn and a `cpus:` quota is a
ceiling rather than a reservation. Their `OMP_NUM_THREADS` is pinned to the same number,
because `cpus:` is a CFS quota and not an affinity mask: left unset, each container sees
all 20 host cores and sizes its thread pools to 20, then spins at barriers inside a much
smaller quota.

### Run duration

Measured against the deployment on 2026-07-27 with the ethyl vinyl ether reference
spectrum, one point perturbed per probe to defeat the result cache:

| `gens_ga` × `offspring_ga`          | `pop_ga` | candidates scored | wall clock | usable candidates | rank of the answer |
| ----------------------------------- | -------- | ----------------- | ---------- | ----------------- | ------------------ |
| 1 × 64 (first run after a redeploy) | 50       | 64                | 112 s      | 6                 | 1                  |
| 1 × 64 (containers warm)            | 50       | 64                | 91 s       | 6                 | 1                  |
| 5 × 256                             | 50       | 1 280             | 96 s       | 1                 | 1                  |
| 5 × 256 ← **the defaults**          | 512      | 1 280             | 101 s      | 41                | 1                  |
| 10 × 1024 (the paper's setting)     | 512      | 10 240            | 201 s      | 6                 | 1                  |
| 20 × 2048                           | 512      | 40 960            | 452 s      | 1                 | 1                  |

"Usable candidates" counts those whose molecular formula matches the query: the formula
enters the fitness function only as a penalty, so most returned structures are rejected
before the user sees them. Four things follow, and all are load-bearing for how the
parameters are chosen:

- **A run is mostly fixed cost.** Roughly 87 s goes to model loading, the encoder pass and
  retrieval before any candidate is scored, and about 11 ms per candidate after that. The
  first 1 280 candidates are close to free.
- **`pop_ga` is nearly free and it is what the user receives.** It sets the length of the
  result list. At 50 this spectrum yields a single admissible structure; at 512 it yields
  41, for five extra seconds. It is set to 512 for that reason alone.
- **A larger search made the result worse, not just slower.** Usable candidates fall from
  41 to 6 to 1 as the search grows, and the best formula-matching score drifts down
  (0.823 → 0.815 → 0.807): the formula is only a fitness penalty, so extra generations
  are spent converging on high-scoring structures that then get rejected for having the
  wrong formula. This is one easy molecule and one seed, so read it as evidence against
  paying 4× by default rather than proof that the search size never helps — a harder
  spectrum may still need it.
- **A cold container costs ~21 s.** The first run after a redeploy pays for model loading;
  it is not a property of the run.

For reference, the same 5 × 256 run took **365 s** before the stack was retuned for
single-run latency — the sizing was worth 3.8×. The effect is far larger on a big search:
10 × 1024 was still running after **an hour** on the old sizing, and the identical job
finished in ~200 s once it was requeued onto the retuned stack.

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
  before the genetic algorithm starts, with `current` fixed at 0, and nothing after —
  `total` does carry `gens_ga`, but `current` never moves off 0. `/jobs/{id}/result`
  answers 400 until the run ends, and no other endpoint exists. The bar is therefore
  driven by elapsed time against an estimate computed from the run's own GA parameters
  (`src/api/duration.ts`), it stops at 95 % rather than reaching the end, and both the
  bar and the sentence under it say it is a projection. The API also overwrites `status`
  with the worker's own stage string, so any value that is not a known Celery state is
  treated as "running".
- **Results expire.** The Celery result is dropped an hour after completion and the job
  mapping after a day. Candidates are fetched once on completion and stored in IndexedDB,
  which is the only durable copy.

## Licence

MIT, except that JCAMP-DX parsing depends on
[`jcampconverter`](https://github.com/cheminfo/jcampconverter), which is
CC-BY-NC-SA-4.0.
