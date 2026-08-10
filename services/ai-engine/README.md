# Pregit AI Engine

`ensemble-sim-v1`: poisson model + seeded minute-by-minute XI simulation.

```bash
cd services/ai-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set `AI_ENGINE_URL=http://127.0.0.1:8000` in the Next.js `.env.local`.

`POST /predict` body:

```json
{
  "fixture_id": "fx-001",
  "features": {},
  "iterations": 10000
}
```
