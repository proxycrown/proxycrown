<div align="center">

<a href="https://www.proxycrown.com">
  <img src="https://www.proxycrown.com/logo.webp" alt="ProxyCrown" width="150" />
</a>

# ProxyCrown

**Premium proxy infrastructure for developers, data teams, and automation at scale.**

Residential · Datacenter · Mobile · ISP proxies — **32M+ IPs across 195+ countries.**

<p>
  <a href="https://www.proxycrown.com"><img alt="Website" src="https://img.shields.io/badge/WEBSITE-proxycrown.com-0A0A0A?style=for-the-badge&logo=googlechrome&logoColor=white"></a>
  <a href="https://dash.proxycrown.com"><img alt="Dashboard" src="https://img.shields.io/badge/DASHBOARD-sign_in-00A3FF?style=for-the-badge&logo=windowsterminal&logoColor=white"></a>
  <a href="https://www.proxycrown.com/docs"><img alt="Docs" src="https://img.shields.io/badge/DOCS-read-4B32C3?style=for-the-badge&logo=readthedocs&logoColor=white"></a>
  <a href="https://status.proxycrown.com"><img alt="Status" src="https://img.shields.io/badge/STATUS-operational-2EA043?style=for-the-badge&logo=statuspage&logoColor=white"></a>
</p>

<p>
  <img alt="IPs" src="https://img.shields.io/badge/IPs-32M%2B-blueviolet?style=flat-square">
  <img alt="Countries" src="https://img.shields.io/badge/countries-195%2B-blue?style=flat-square">
  <img alt="Uptime" src="https://img.shields.io/badge/uptime-99.99%25-brightgreen?style=flat-square">
  <img alt="Pricing" src="https://img.shields.io/badge/from-%241.50%2FGB-orange?style=flat-square">
  <img alt="Protocols" src="https://img.shields.io/badge/HTTP(S)%20%2B%20SOCKS5-supported-9cf?style=flat-square">
</p>

</div>

---

## What we build

ProxyCrown is a global proxy network built for teams that **scrape, monitor, automate, and verify** the web at scale.

One gateway, a massive IP pool, and pay-as-you-go pricing — no annual contracts, no sales calls, no minimums.

```text
gw.proxycrown.com:8080    # single endpoint · HTTP(S) + SOCKS5 · rotate per request
```

## Products

| Product | Best for | Pool |
| :-- | :-- | :-- |
| **Residential Proxies** | Web scraping, price intelligence, ad verification, SERP tracking | 32M+ real-device IPs in 195+ countries |
| **Datacenter Proxies** | High-volume scraping, speed-critical workloads, concurrency | Fast, low-latency IPs across 50+ locations |
| **Mobile Proxies** | Social media automation, app testing, sneaker & ticketing | 4G/5G carrier IPs |
| **ISP Proxies** | Long sessions, static use cases, account management | Static residential, dedicated to you |

## Quickstart

Install nothing. Point your client at the gateway with your dashboard credentials:

```bash
# cURL
curl -x "http://USERNAME:PASSWORD@gw.proxycrown.com:8080" https://httpbin.org/ip
```

```python
# Python (requests)
import requests

proxies = {
    "http":  "http://USERNAME:PASSWORD@gw.proxycrown.com:8080",
    "https": "http://USERNAME:PASSWORD@gw.proxycrown.com:8080",
}
print(requests.get("https://httpbin.org/ip", proxies=proxies).text)
```

```javascript
// Node.js (axios)
import axios from "axios";

const res = await axios.get("https://httpbin.org/ip", {
  proxy: {
    host: "gw.proxycrown.com",
    port: 8080,
    auth: { username: "USERNAME", password: "PASSWORD" },
  },
});
console.log(res.data);
```

> Country, city, and ASN targeting are set directly in the username — see the [docs](https://www.proxycrown.com/docs).

## Why ProxyCrown

- **One gateway** — a single endpoint for every proxy type, rotate per request with username flags
- **Global targeting** — country, city, and ASN selection out of the box
- **Built for developers** — clean API, self-serve dashboard, no sales friction
- **Transparent uptime** — public [status page](https://status.proxycrown.com) and real-time metrics
- **No lock-in** — usage-based pricing starting from **$1.50/GB**

## Compliance & security

- GDPR & CCPA compliant
- Ethically sourced residential IPs (consented, peer-based)
- No-logs traffic policy
- Encrypted gateway access with username / IP-whitelist auth

## Connect

<p>
  <a href="https://discord.gg/proxycrown"><img alt="Discord" src="https://img.shields.io/badge/Discord-join-5865F2?style=for-the-badge&logo=discord&logoColor=white"></a>
  <a href="https://twitter.com/proxycrown"><img alt="X" src="https://img.shields.io/badge/X-follow-000000?style=for-the-badge&logo=x&logoColor=white"></a>
  <a href="https://t.me/proxycrown"><img alt="Telegram" src="https://img.shields.io/badge/Telegram-channel-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"></a>
  <a href="https://linkedin.com/company/proxycrown"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-company-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white"></a>
</p>

---

<div align="center">
<sub>© ProxyCrown — proxy infrastructure for the modern web.</sub>
</div>
