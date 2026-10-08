# Skillshot Moderation Architecture & Setup

Skillshot employs a multi-layered moderation pipeline combining automated safety checks with a human-in-the-loop review workflow.

1. **Cyberbully AI Text Moderation Microservice**: An open-source, specialized NLP text moderation service powered by the [`cyberbully`](https://github.com/KEA-Mindz/Cyberbully) package. Acts as an automated signal for comment screening and human review.
2. **OpenAI / Custom Scanner**: Multi-modal moderation for Skillshot images, posts, and profile text.
3. **Report Case System (`report_cases`) & Unified Moderation Queue (`moderation_queue`)**: All user reports and automated AI flags are consolidated into canonical review cases.
4. **Staff Dashboard**: Allows authorized Moderators and Admins to inspect flagged content, review AI confidence metadata, and perform actions (`KEEP`, `HIDE`, `DELETE`, `DISMISS`, `ESCALATE`, `NOTE`).

---

## 1. Cyberbully AI Text Moderation Service

The Cyberbully service is an independent FastAPI microservice located in `services/cyberbully/`. It wraps the open-source `CyberbullyingDetector` from `cyberbully` (KEA-Mindz).

### Flow Diagram

```
User Submits Comment
       │
       ▼
Next.js API (/api/posts/[id]/comments)
       │
       ├─► Authenticate & Check Rate Limits
       │
       ├─► 1. Cyberbully Moderation (POST /moderate)
       │       └── If unavailable: gracefully log and continue to standard workflow
       │
       ├─► 2. Existing Skillshot Moderation Hooks (moderateText / regex rules)
       │
       ▼
Threshold Decisions:
 ├── Score < 0.50: Safe ──► Publish comment normally (status: VISIBLE)
 ├── 0.50 <= Score < 0.90: Review ──► Publish comment & Flag in moderation_queue (severity: BORDERLINE)
 └── Score >= 0.90: High-confidence ──► Publish comment & Flag in moderation_queue (severity: HIGH)
       │
       ▼
Database Trigger (`skillshot_queue_case`)
       ├── Creates or updates canonical case in `report_cases`
       ├── Adds `AUTOMATIC_FLAG` event to `report_case_events`
       └── Audits flag in `audit_logs`
       │
       ▼
Staff Moderation Dashboard (/admin/reports/:id or /moderator/reports/:id)
       ├── Staff sees original comment & AI Moderation metadata (Provider, Category, Confidence %)
       └── Staff actions: KEEP (approve), HIDE, DELETE, DISMISS
```

### Key Safety & Privacy Principles

- **No Automatic Permanent Deletion**: AI predictions never automatically permanently delete content without human review.
- **Graceful Degradation**: If the Cyberbully service is offline, unreachable, or times out, Skillshot logs the error internally and continues normal publishing. It never crashes or blocks all users.
- **Zero Client Leakage**: Normal users NEVER receive model scores, internal categories, or provider names. This metadata is strictly restricted to authorized staff views.
- **Server-Side Authentication**: Private service communication can be authenticated via `CYBERBULLY_SERVICE_TOKEN`.
- **Bounded Inputs**: Input strings are trimmed and bounded to 1,000 characters before network transmission.

---

## 2. Configuration & Environment Variables

Add the following environment variables to `.env.local` (server-side only, never prefix with `NEXT_PUBLIC_`):

```bash
# Cyberbully Service Configuration
CYBERBULLY_SERVICE_URL=http://localhost:8001
CYBERBULLY_SERVICE_TOKEN=
CYBERBULLY_REVIEW_THRESHOLD=0.50
CYBERBULLY_HIGH_CONFIDENCE_THRESHOLD=0.90
CYBERBULLY_TIMEOUT_MS=5000

# Image & General Moderation Configuration
MODERATION_PROVIDER=custom # or 'openai'
OPENAI_API_KEY=
MODERATION_STRICT=true
```

### Threshold Descriptions

- `CYBERBULLY_REVIEW_THRESHOLD` (default: `0.50`): Comments scoring at or above this threshold trigger an entry in `moderation_queue` with `severity: 'BORDERLINE'`.
- `CYBERBULLY_HIGH_CONFIDENCE_THRESHOLD` (default: `0.90`): Comments scoring at or above this threshold receive `severity: 'HIGH'`, elevating case priority in the staff dashboard.

---

## 3. Local Development & Running Both Services

### Terminal 1: Run the Cyberbully Python Service

```bash
cd services/cyberbully

# 1. Create virtual environment
python -m venv .venv

# 2. Activate virtual environment
# Windows (PowerShell / Command Prompt):
.\.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the service
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

### Terminal 2: Run the Skillshot Next.js Application

```bash
# In the repository root
pnpm install # or npm install
pnpm dev     # or npm run dev
```

Open `http://localhost:3000`.

---

## 4. API Specification for Cyberbully Service

### `POST /moderate`

#### Request
```json
{
  "text": "Nobody likes you, you are pathetic"
}
```

#### Response (Flagged Content)
```json
{
  "label": "cyberbullying",
  "score": 0.99,
  "category": "targeted_insult_general",
  "flagged": true
}
```

#### Response (Safe Content)
```json
{
  "label": "safe",
  "score": 0.01,
  "category": null,
  "flagged": false
}
```

### `GET /health`
```json
{
  "status": "ok",
  "service": "cyberbully",
  "model_loaded": true,
  "error": null
}
```

---

## 5. Staff Moderation View

When viewing a flagged comment case in `/admin/reports/:id` or `/moderator/reports/:id`:

Staff see:
```text
Automatic flag
This is a signal for human review, not a final decision.
targeted_insult_general · Borderline / High confidence · [Date]

AI Moderation
Provider: Cyberbully
Category: targeted_insult_general
Confidence: 99%
```

Moderators have full authority to:
- **Keep content**: Resolves the report and keeps the comment visible.
- **Hide content**: Sets comment status to `HIDDEN`.
- **Delete content**: Sets comment status to `DELETED`.
- **Dismiss report**: Closes the case without altering content visibility.

---

## 6. Testing Instructions

### Run Python Cyberbully Unit Tests
```bash
cd services/cyberbully
.\.venv\Scripts\pytest.exe test_service.py -v
```

### Run Skillshot Full Test Suite (including Cyberbully integration tests)
```bash
npm test
```

Specific Cyberbully integration test suite:
```bash
node --experimental-strip-types --test tests/cyberbully-integration.test.mjs
```
