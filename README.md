## Holding Reconciliation Platform

Monorepo with:

- `backend/`: Flask API (JWT auth, MongoDB, file upload + preview)
- `frontend/`: React (Vite + TypeScript + Tailwind)

### Prereqs

- Node.js (v18+)
- Python (3.11+ recommended)
- MongoDB (local Docker or remote cluster)

### Quick start (local development)

1. Copy environment file and set your MongoDB URI:

```bash
cd backend
copy .env.example .env
```

Example remote MongoDB:

```env
MONGO_URI=mongodb://USER:PASS@HOST:27017/holding_app?authSource=USER&tls=false
```

2. Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m flask --app app run --port 5000 --debug --no-reload
```

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

Check API health: `http://127.0.0.1:5000/api/health` — `mongoMode` should be `"mongo"` when connected.

### Default dev user

When `SEED_DEV_DATA=true` (default in development), the backend seeds:

- email: `admin@local`
- password: `admin1234`

### Step-by-step onboarding

#### 1. Users (Admin → Users)

1. Log in as admin.
2. Create **Reconciliations** team users (performers + reviewers).
3. Create **Operations** team users (view reviewed EU reconciliations only).
4. Assign jurisdictions (e.g. `EU`) for each user.

#### 2. Brokers (Admin → Brokers)

1. **Step 1** — Add a broker name and jurisdiction (e.g. `CACEIS`, `EU`).
2. **Step 2** — Select the broker and add one or more accounts.
3. Brokers appear in **New reconciliation** when your login jurisdiction matches.

**Broker templates (backend only)** — Each broker + reconciliation type (trade / position / fi) needs its own backend template. This is **not** created through the app UI.

Currently implemented:
- **CACEIS + Position** → `caceis_holdings`
- **CACEIS + Trade** → not implemented yet
- **CACEIS + FI** → not implemented yet

To add a template:

1. Implement the builder in `backend/src/utils/` (see `recon_caceis.py` for position).
2. Register it in `backend/src/utils/broker_templates.py` with a `templateKey` and map it to the recon type.
3. Set `templateKeys` on the broker in MongoDB, e.g.:

```js
db.brokers.updateOne(
  { name: "CACEIS" },
  { $set: { templateKeys: { position: "caceis_holdings", trade: "caceis_trade" } } }
)
```

The app only enables Trade/FI in the UI when a matching template is registered.

#### 3. First reconciliation

1. Log in as a Reconciliations user with matching jurisdiction (e.g. `EU`).
2. **New reconciliation** → pick broker, account, value date, reviewer.
3. Upload our + counterparty files → preview → build → submit for review.
4. Reviewer approves in **Review queue**.
5. Operations users see reviewed items under **Completed** (Today / Last 7 days).

### Production deployment

Set in `backend/.env`:

```env
FLASK_ENV=production
SEED_DEV_DATA=false
JWT_SECRET_KEY=<32+ character random secret>
MONGO_URI=mongodb://...
CORS_ORIGINS=https://your-frontend-domain
MAX_UPLOAD_MB=50
```

Run with Gunicorn:

```bash
cd backend
gunicorn -b 0.0.0.0:5000 -w 4 --timeout 120 app:app
```

Or use Docker Compose (backend + frontend):

```bash
docker compose up -d --build
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5000`

Optional local MongoDB only:

```bash
docker compose --profile local-mongo up -d mongo
```

### Security notes

- Login is rate-limited (8 attempts per 5 minutes per IP/email).
- Production refuses to start without a strong `JWT_SECRET_KEY`.
- Production refuses to start if MongoDB is unreachable.
