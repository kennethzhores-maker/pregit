# Pregit — Football Match Predict

Lineup-aware football predictions with a trust layer.

## Run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Model

`ensemble-sim-v2` — weighted XI quality, role-based injuries, fixture congestion,
style/set-piece proxies, Dixon-Coles scorelines, calibrated BTTS/O2.5 markets.

## Smoke

```bash
npm run predict:smoke
```
