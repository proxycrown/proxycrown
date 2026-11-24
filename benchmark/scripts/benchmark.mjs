#!/usr/bin/env node
/**
 * Scripted proxy benchmark: fixed target set, equal request counts per type,
 * 48-hour window.
 *
 * Measures, per proxy type, what the product pages claim an operator cares about:
 * does the request get through, how often, and how long it takes.
 *
 * Usage, one process per type:
 *   node scripts/benchmark.mjs --type=mobile --endpoint=gw.example.com:823 \
 *     --user='USER-session-{target}{round}-country-{country}' --pass=PASS
 *
 * `--user` is a template. The placeholders {target} {round} {country} are filled
 * per request, so rotation behaviour is explicit instead of guessed from the
 * username's substrings. Omit the placeholders for a fully static identity.
 * A run with no --endpoint is labelled `direct`: the datacenter baseline.
 *
 * Design rules, so the numbers survive scrutiny:
 *  - TARGETS is fixed in this file. Every type issues the same count per target.
 *  - Fixed number of rounds (`--rounds-total`, default 288) rather than "until the
 *    clock runs out", so a slow or heavily blocked type does not end up with fewer
 *    samples than a fast one. `--hours` is a safety cap only.
 *  - Sticky per round: one identity per target per round, rotation happens between
 *    rounds, which is how a real crawl uses a rotating pool.
 *  - Append-only JSONL per type and per run; a restart resumes the same file and
 *    the same round counter instead of silently forking a second dataset.
 */
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { Agent, ProxyAgent, interceptors, request } from 'undici';

const argv = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, ...v] = a.replace(/^--/, '').split('=');
        return [k, v.join('=')];
    })
);

const TYPE = argv.type || 'direct';
const ENDPOINT = argv.endpoint || '';
const USER = argv.user || '';
const PASS = argv.pass || '';
const HOURS = Number(argv.hours || 48);
const ROUNDS = Number(argv.rounds || 2);
const ROUNDS_TOTAL = Number(argv['rounds-total'] || 288);
const GAP_MS = Number(argv.gap || 300000);
const COUNTRIES = (argv.countries || 'us,de').split(',');

// Fixed target set: bot-defended commerce, geo-sensitive catalogues, plain reads as a
// control group so a broken exit shows up as control failures rather than as blocks.
const TARGETS = [
    { id: 'control_example', url: 'https://example.com/', kind: 'control' },
    { id: 'control_wikipedia', url: 'https://en.wikipedia.org/wiki/Proxy_server', kind: 'control' },
    { id: 'control_httpbin', url: 'https://httpbin.org/get', kind: 'control' },
    { id: 'amazon_pdp', url: 'https://www.amazon.com/dp/B08N5WRWNW', kind: 'commerce' },
    { id: 'walmart_search', url: 'https://www.walmart.com/search?q=usb+hub', kind: 'commerce' },
    { id: 'etsy_search', url: 'https://www.etsy.com/search?q=ceramic+mug', kind: 'commerce' },
    { id: 'nike_list', url: 'https://www.nike.com/w/mens-shoes-nik1zy7ok', kind: 'commerce' },
    { id: 'zillow_search', url: 'https://www.zillow.com/homes/for_sale/', kind: 'data' },
    { id: 'idealista_search', url: 'https://www.idealista.com/venta-viviendas/madrid-madrid/', kind: 'geo' },
    { id: 'google_serp', url: 'https://www.google.com/search?q=residential+proxy', kind: 'geo' },
    { id: 'booking_search', url: 'https://www.booking.com/searchresults.html?ss=Lisbon', kind: 'geo' },
    { id: 'reddit_thread', url: 'https://www.reddit.com/r/webscraping/', kind: 'social' },
    { id: 'indeed_search', url: 'https://www.indeed.com/jobs?q=python', kind: 'data' },
    { id: 'glassdoor_reviews', url: 'https://www.glassdoor.com/Reviews/index.htm', kind: 'data' },
    { id: 'trustpilot_page', url: 'https://www.trustpilot.com/review/www.booking.com', kind: 'social' },
    { id: 'cloudflare_demo', url: 'https://nowsecure.nl/', kind: 'challenge' },
    { id: 'tls_peer_fingerprint', url: 'https://tls.peet.ws/api/all', kind: 'challenge' },
    { id: 'dataforseo_blog', url: 'https://dataforseo.com/blog', kind: 'data' },
    { id: 'mercado_livre', url: 'https://www.mercadolivre.com.br/', kind: 'geo' },
    { id: 'rakuten_jp', url: 'https://www.rakuten.co.jp/', kind: 'geo' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

// Checked against the body only, uniformly. Most anti-bot vendors answer 200 with a
// challenge or denial page, so a 200 alone must never count as success.
const MARKS = [
    ['challenge', [/just a moment/i, /cf-mitigated/i, /checking your browser/i, /px-captcha/i, /_Incapsula_/i, /captcha-delivery/i, /verify you are (?:a )?human/i]],
    ['rate_limited', [/too many requests/i, /rate limit exceeded/i]],
    ['blocked', [/access denied/i, /request blocked/i, /you have been blocked/i, /unusual traffic/i]],
];

function classify(status, body) {
    const head = body.slice(0, 6000);
    if (status === 403) return 'blocked';
    if (status === 429) return 'rate_limited';
    if (status === 407) return 'auth_error';
    if (status >= 500) return 'upstream_error';
    if (status === 202) return 'challenge';
    for (const [verdict, patterns] of MARKS) if (patterns.some((p) => p.test(head))) return verdict;
    if (status === 200) return 'ok';
    return 'non200';
}

function identity(country, targetId, round) {
    return (USER || 'anon')
        .replaceAll('{country}', country)
        .replaceAll('{target}', targetId)
        .replaceAll('{round}', String(round));
}

function secret(country, targetId, round) {
    // session ids must be alphanumeric, so {target} is sanitised here (ids carry underscores)
    const tid = String(targetId).replace(/[^a-z0-9]/gi, '').slice(0, 6);
    return (PASS || '').replaceAll('{country}', country).replaceAll('{target}', tid).replaceAll('{round}', String(round));
}

function agentFor(country, targetId, round) {
    const redirect = interceptors.redirect({ maxRedirections: 3 });
    if (!ENDPOINT) return new Agent().compose(redirect);
    const auth = `${encodeURIComponent(identity(country, targetId, round))}:${encodeURIComponent(secret(country, targetId, round))}`;
    return new ProxyAgent(`http://${auth}@${ENDPOINT}`).compose(redirect);
}

async function one(country, target, round) {
    const started = Date.now();
    const agent = agentFor(country, target.id, round);
    try {
        const res = await request(target.url, {
            method: 'GET',
            dispatcher: agent,
            headersTimeout: 25000,
            bodyTimeout: 25000,
            headers: { 'user-agent': UA, 'accept-language': country, accept: 'text/html,*/*' },
        });
        const body = await res.body.text();
        return { status: res.statusCode, verdict: classify(res.statusCode, body), latency_ms: Date.now() - started, bytes: body.length };
    } catch (err) {
        const timeout = /timeout|ETIMEDOUT/i.test(String(err));
        return { status: 0, verdict: timeout ? 'timeout' : 'error', latency_ms: Date.now() - started, bytes: 0, error: String(err).slice(0, 120) };
    } finally {
        if (agent) await agent.close().catch(() => {});
    }
}

async function resolveFile() {
    await mkdir('benchmark', { recursive: true });
    if ('resume' in argv) return { file: argv.resume, round: await lastRound(argv.resume) };
    const existing = (await readdir('benchmark')).filter((f) => f.startsWith(`results-${TYPE}-`) && f.endsWith('.jsonl')).sort();
    const latest = existing.at(-1);
    if (latest && 'cont' in argv) return { file: `benchmark/${latest}`, round: await lastRound(`benchmark/${latest}`) };
    return { file: `benchmark/results-${TYPE}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`, round: 0 };
}

async function lastRound(file) {
    const rows = (await readFile(file, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean);
    return rows.length ? Math.max(...rows.map((l) => JSON.parse(l).round || 0)) : 0;
}

async function main() {
    const { file, round: done } = await resolveFile();
    if (!done) await writeFile(file, '');
    const end = Date.now() + HOURS * 3600_000;
    let round = done;

    console.log(
        `type=${TYPE} file=${file} resuming_at_round=${done} targets=${TARGETS.length} countries=${COUNTRIES.join(',')} ` +
            `rounds/round=${ROUNDS} rounds_total=${ROUNDS_TOTAL} gap_ms=${GAP_MS} cap_hours=${HOURS}`
    );
    console.log(`identity template: ${USER ? USER.replaceAll('{country}', '$country').replaceAll('{target}', '$target').replaceAll('{round}', '$round') : '(static anon)'}`);

    while (round < ROUNDS_TOTAL && Date.now() < end) {
        round += 1;
        for (const country of COUNTRIES) {
            for (const target of TARGETS) {
                for (let r = 0; r < ROUNDS; r++) {
                    const row = { ts: new Date().toISOString(), type: TYPE, round, country, target: target.id, kind: target.kind, ...(await one(country, target, round)) };
                    await appendFile(file, JSON.stringify(row) + '\n');
                    process.stdout.write(row.verdict === 'ok' ? '.' : 'x');
                }
            }
        }
        console.log(` round ${round}/${ROUNDS_TOTAL}`);
        if (round < ROUNDS_TOTAL && Date.now() + GAP_MS < end) await new Promise((res) => setTimeout(res, GAP_MS));
    }
    console.log(`stopped at round ${round}${round >= ROUNDS_TOTAL ? ' (all rounds done)' : ' (time cap)'}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
