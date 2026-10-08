# Cyberbully Moderation Service

AI-powered text moderation microservice for Skillshot Community, powered by the open-source [`cyberbully`](https://github.com/KEA-Mindz/Cyberbully) package.

This service acts as an automated detection signal that feeds into Skillshot's existing human-in-the-loop moderation system. It never permanently deletes content on its own.

---

## Architecture Overview

```
User submits comment
       │
       ▼
Skillshot Next.js API (/api/posts/[id]/comments)
       │
       ├─► 1. Auth & Rate Limit Validation
       │
       ├─► 2. Cyberbully Service (POST /moderate) ──► (Failures gracefully logged, fallback to normal path)
       │
       ├─► 3. Existing Skillshot Moderation Hooks (moderateText / OpenAI / keyword rules)
       │
       ▼
Decisions:
 ├── Score < 0.50: Safe ──► Publish comment
 ├── Score 0.50–0.89: Review flag ──► Publish comment & Enqueue in moderation_queue (severity: BORDERLINE)
 └── Score >= 0.90: High-confidence flag ──► Publish comment & Enqueue in moderation_queue (severity: HIGH)
       │
       ▼
Automated Report Case (report_cases trigger)
       │
       ▼
Staff Moderation Dashboard (Keep / Hide / Delete / Dismiss)
```

---

## API Specification

### 1. `POST /moderate`
Classify input text for cyberbullying.

#### Headers
- `Content-Type: application/json`
- `Authorization: Bearer <CYBERBULLY_SERVICE_TOKEN>` *(optional in dev; required if configured)*

#### Request Body
```json
{
  "text": "Nobody likes you, you are pathetic"
}
```

#### Response (Cyberbullying)
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

### 2. `GET /health`
Returns service status and model readiness.

```json
{
  "status": "ok",
  "service": "cyberbully",
  "model_loaded": true,
  "error": null
}
```

---

## Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CYBERBULLY_SERVICE_URL` | `http://127.0.0.1:8001` | URL consumed by Skillshot Next.js app |
| `CYBERBULLY_SERVICE_TOKEN` | *unset* | Shared Bearer token for service-to-service auth |
| `CYBERBULLY_REVIEW_THRESHOLD` | `0.50` | Score at or above which content is flagged for review |
| `CYBERBULLY_HIGH_CONFIDENCE_THRESHOLD` | `0.90` | Score at or above which flag has `HIGH` severity |
| `CYBERBULLY_MODEL_DIR` | *unset* | Custom path for local model checkpoint files |
| `CYBERBULLY_MOCK_MODEL` | `false` | When `1` or `true`, uses heuristic test classifier |
| `CYBERBULLY_PORT` | `8001` | Port for uvicorn server |
| `CYBERBULLY_HOST` | `127.0.0.1` | Bind address for uvicorn server |

---

## Local Setup & Development

### 1. Set up Virtual Environment
```bash
cd services/cyberbully
python -m venv .venv

# On Windows:
.venv\Scripts\activate

# On Linux/macOS:
source .venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Service
```bash
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

### 4. Run Python Tests
```bash
pytest test_service.py -v
```

---

## Security & Privacy Considerations

1. **Private Internal Service**: The service is meant to be run internally or bound to `127.0.0.1` / private VPC, not exposed directly to the public internet.
2. **Server-Side Token Authentication**: When deployed across separate network zones, configure `CYBERBULLY_SERVICE_TOKEN` so only Skillshot's backend can invoke `/moderate`.
3. **No Execution of User Input**: User text is treated strictly as an immutable string and tokenized for NLP classification.
4. **Input Length Limits**: Texts are validated and bounded to 5,000 characters to prevent resource exhaustion attacks.
5. **No Secret Logging**: Passwords, tokens, cookies, and sensitive headers are never logged.
6. **User Privacy**: Model prediction scores and internal category classifications are only visible to authorized moderators in the staff dashboard; they are never sent to regular users.
