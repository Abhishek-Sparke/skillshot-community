# Activate image and text moderation

The built-in OpenAI adapter uses `omni-moderation-latest` at the moderation endpoint, not a paid text/image-generation endpoint. OpenAI currently describes moderation as free to use, subject to account access and rate limits: [official guide](https://developers.openai.com/api/docs/guides/moderation), [model and limits](https://developers.openai.com/api/docs/models/omni-moderation-latest).

## One-time setup

1. Sign in to the [OpenAI API platform](https://platform.openai.com/) and create a project for Skillshot. Complete any account steps yourself; do not purchase credits just for this setup without checking account requirements.
2. Create a secret project API key in [API keys](https://platform.openai.com/api-keys). Restrict it to the moderation endpoint where the account's key controls support that. Do not paste the key into chat, source code, screenshots, or GitHub.
3. In Vercel → Skillshot → Environment Variables, save `OPENAI_API_KEY` as a secret for Production. Add `MODERATION_PROVIDER` = `openai` and `MODERATION_STRICT` = `true`.
4. For a separate staging environment, add the corresponding settings there too. Do not use the production database for destructive integration tests.
5. Deploy the updated source. Test one harmless synthetic picture and ordinary text; verify the avatar persists and a Skillshot publishes. Check unauthorized API requests still return 401. No live API call has been verified just by running the unit tests.

The custom provider variables can remain unset. An OpenAI key alone does not change the provider; `MODERATION_PROVIDER=openai` is required. Missing keys, invalid responses, timeouts, and rate limits never disable scanning or automatically approve content.

## Data and decisions

The server sends post/comment/profile text that already flows through the moderation hooks, and a decoded, resized image preview. It does not send account credentials, private Blob tokens, or the full original image. Review [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data) and disclose this processing to users before rollout.

- Clear results: continue through the existing upload pipeline.
- Flagged results or category scores at least 0.5: admin review. Gaming violence is not automatically blocked.
- Flagged severe categories with scores at least 0.98: block. These categories are sexual/minors, hate/threatening, harassment/threatening, illicit/violent, and self-harm/instructions.
- Provider errors or missing configuration: hold Skillshots; reject avatar replacement while preserving the current avatar.

These thresholds are initial Skillshot policy choices, not measured probabilities or a guarantee of accuracy. Evaluate them against representative gaming, artwork, and photography examples before public rollout. Model behavior can change; review false positives/negatives regularly. Only internal category/reference information is retained by the adapter; scores and provider errors are not shown to normal users. Human moderation, reports, and appeals remain necessary.

## Verification status

Mocked tests cover safe/review/block mappings, malformed results, request format, missing key, timeout/network failure, authentication/rate-limit/provider error responses, and refusal to send remote private image URLs. Account activation and real scans require the owner's key. No account, key, paid resource, or live deployment is created by the source changes alone.
