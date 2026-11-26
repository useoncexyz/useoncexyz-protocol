# Once

**One look. Everything Solana is chasing, on a single board.**

[![Live site](https://img.shields.io/badge/live-useonce.xyz-black)](https://useonce.xyz)
![Chain](https://img.shields.io/badge/chain-Solana-black)

- **Chain:** Solana mainnet
- **Contract address:** `CA: not announced yet`

## Overview

Once gathers the ten most boosted Solana tokens into one quiet table, refreshes it every minute, and holds its own token's line above the rest once the contract is stated. Until then that slot holds the Once mark.

## Features

- Live market board: logo, symbol, name, price, 24h move, 24h volume, liquidity
- Ticker built from the same live data
- Own-token row pinned first, fed by DexScreener and pump.fun in parallel
- Contract slot at the top of the page, click to copy, inert until stated
- Skeleton loading, exponential backoff, last good data kept, 60 s polling that pauses while the tab is hidden
- Reduced-motion friendly: every animation has an instant fallback

## Links

- Site: https://useonce.xyz
- X: https://x.com/useoncexyz
- Docs: [docs/whitepaper.md](docs/whitepaper.md)

## Build

```
npm install
npm run build   # writes dist/
npm run prove   # builds both contract branches and checks every gate
```
