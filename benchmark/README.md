# Proxy class benchmark — what 20 real targets do to each proxy type

132,020 requests from one harness, four proxy classes, 20 fixed targets. We publish the cached verdicts, the request counts and the Wilson 95% intervals so anyone can recompute the table below.

This exists because "residential works, datacenter gets blocked" is folklore in this industry and almost nobody measures it per target. The numbers are less flattering than the marketing in both directions.

## Results

`ok` = the response body arrived and passed the check for that target (a 200 with a login wall or a challenge page counts as a failure). Connectivity errors are excluded from the denominator; the excluded count is in `summary.csv` under `*_n` vs the raw row count.

| Target | Kind | Direct | ISP | Residential | Mobile |
|---|---|---|---|---|---|
| `amazon_pdp` | commerce | 94.3% (916/971) | 0.0% (0/440) | 0.0% (0/140) | 0.0% (0/296) |
| `booking_search` | geo | 0.0% (0/971) | 0.0% (0/440) | 0.0% (0/140) | 0.0% (0/295) |
| `cloudflare_demo` | challenge | 0.0% (0/971) | 100.0% (440/440) | 100.0% (139/139) | 99.7% (296/297) |
| `control_example` | control | 100.0% (971/971) | 100.0% (440/440) | 100.0% (140/140) | 99.3% (295/297) |
| `control_httpbin` | control | 100.0% (971/971) | 100.0% (440/440) | 100.0% (140/140) | 99.7% (296/297) |
| `control_wikipedia` | control | 100.0% (971/971) | 100.0% (440/440) | 99.3% (139/140) | 98.6% (291/295) |
| `dataforseo_blog` | data | 100.0% (971/971) | 100.0% (440/440) | 100.0% (138/138) | 99.7% (295/296) |
| `etsy_search` | commerce | 0.0% (0/971) | 0.0% (0/440) | 0.0% (0/140) | 0.0% (0/298) |
| `glassdoor_reviews` | data | 0.0% (0/971) | 0.0% (0/440) | 0.0% (0/140) | 0.0% (0/296) |
| `google_serp` | geo | 99.8% (969/971) | 100.0% (440/440) | 100.0% (140/140) | 94.9% (282/297) |
| `idealista_search` | geo | 0.0% (0/971) | 0.0% (0/440) | 0.0% (0/140) | 0.0% (0/296) |
| `indeed_search` | data | 0.0% (0/971) | 0.0% (0/440) | 0.0% (0/140) | 0.0% (0/297) |
| `mercado_livre` | geo | 100.0% (971/971) | 99.8% (439/440) | 99.3% (137/138) | 99.0% (291/294) |
| `nike_list` | commerce | 100.0% (971/971) | 99.8% (439/440) | 100.0% (140/140) | 99.3% (293/295) |
| `rakuten_jp` | geo | 100.0% (971/971) | 100.0% (439/439) | 100.0% (138/138) | 99.3% (294/296) |
| `reddit_thread` | social | 0.0% (0/971) | 0.0% (0/440) | 100.0% (140/140) | 99.3% (293/295) |
| `tls_peer_fingerprint` | challenge | 99.5% (966/971) | 99.5% (438/440) | 100.0% (138/138) | 99.3% (292/294) |
| `trustpilot_page` | social | 0.0% (0/971) | 0.0% (0/440) | 0.0% (0/140) | 0.0% (0/296) |
| `walmart_search` | commerce | 100.0% (971/971) | 100.0% (440/440) | 100.0% (140/140) | 99.3% (295/297) |
| `zillow_search` | data | 0.0% (0/971) | 0.2% (1/440) | 94.3% (132/140) | 57.8% (171/296) |

## What the table actually says

- **Datacenter exits still do most of the job.** 12 of 20 targets are 100% on datacenter. Buying residential for `walmart`, `nike`, `google` or `rakuten` at this request volume is paying for nothing.
- **`etsy`, `idealista`, `booking`, `indeed`, `glassdoor`, `trustpilot` fail on every class** — all four columns 0%. Those need a real browser (TLS/JS fingerprint), not a better IP.
- **`amazon` is the opposite of datacenter-friendly** (94% direct, 0% on every proxy class).
- **`zillow` is the only target where residential clearly wins** (94% vs 0% direct) and mobile is worse than residential (58%).
- **`reddit` needs a residential IP** (0% datacenter and ISP, 100% residential) — a datacenter or hosting-ASN exit is rejected outright.
- **ISP behaves like mobile, not like residential** on the social targets, and matches datacenter on `cloudflare_demo`.

## Method

- Harness: [`scripts/benchmark.mjs`](scripts/benchmark.mjs). Fixed target list, equal request count per target per class, one identity per target per round, rotation between rounds.
- Verdicts are read from the response body, not from the status code.
- Control targets (`example.com`, Wikipedia, `httpbin`) are 100% everywhere, so control failures mean a dead exit rather than a block.
- Two independent rounds, and every class ran the same fixed target set.
- 95% intervals are Wilson score intervals. Read the ones with thin `n` (residential/mobile lost part of their run to an exhausted provider balance) before quoting a single target.

## Reproduce

```bash
npm i undici
node scripts/benchmark.mjs --type=residential \
  --endpoint=HOST:PORT --user='USER-session-{target}{round}-country-{country}' --pass=PASS \
  --rounds-total=288 --gap=300000 --countries=us,de
node scripts/benchmark.mjs --type=direct   # no --endpoint = your own uplink
python3 scripts/analyze.py data            # writes summary.csv
```

`{target}`, `{round}`, `{country}` are filled per request. Omit them for a static identity.

## Data

`data/*.jsonl.gz`, one gzipped JSONL per class: `residential`, `mobile`, `isp`, `direct`. One object per request:

```json
{"ts":"2026-11-23T13:30:21.119Z","type":"isp","round":1,"country":"gb",
  "target":"control_example","kind":"control","status":200,"verdict":"ok",
  "latency_ms":150,"bytes":577}
```

`verdict` is one of `ok`, `blocked`, `challenge`, `non200`, `rate_limited`, `error`, `timeout`, `upstream_error`. No credentials, no proxy IPs, no customer data.

## Caveats

- One vantage point (one host, one upstream ASN) and one run per class. This is a snapshot, not a monthly series.
- `direct` is that host's own datacenter uplink, not a commercial datacenter proxy — it is a baseline, not a purchase.
- Verdict heuristics are per target and deliberately conservative; a soft block that still returns HTML with a 200 will be scored `ok`.
- Residential and mobile lost 5–12% of their scheduled requests to an exhausted balance. Denominator differences are the reason the sample sizes differ.
- Providers are unnamed; swap in your own endpoint and the harness reproduces.
- The `isp` leg was still running when this snapshot was taken (2 requests/target/round, ~6 minutes apart). Its row counts grow over time; rates in the table above are recomputed from the file in `data/`.

## License

Code MIT. Data CC BY 4.0 — use it, cite `github.com/proxycrown/proxy-benchmark`.

Long form write-up with the same numbers: [proxycrown.com/blog/residential-vs-datacenter-vs-isp-benchmarks](https://www.proxycrown.com/blog/residential-vs-datacenter-vs-isp-benchmarks).
