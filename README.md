# PolishKit

PolishKit is a lightweight text polishing backend for Mac Shortcuts and iPhone Shortcuts.

It exposes a small HTTP API, uses the OpenAI Responses API, and does not use a database or frontend.

## API

### `GET /health`

Returns:

```json
{ "ok": true }
```

### `POST /polish`

Requires the `X-API-Token` header. The expected token is read from `API_TOKEN`.

Request:

```json
{
  "text": "text to polish",
  "style": "professional",
  "quality": "balanced"
}
```

`text` must be 8000 characters or fewer.

Response:

```json
{
  "text": "polished text"
}
```

Supported styles:

- `natural`: natural, clear, friendly, and concise.
- `professional`: more professional and work-appropriate.
- `concise`: shorter while preserving meaning.
- `direct`: clearer and more direct, without sounding rude.

Legacy style aliases are still accepted for existing Shortcuts:

- `default` -> `natural`
- `slack` -> `professional`
- `email` -> `professional`
- `note` -> `natural`
- `shorter` -> `concise`
- `polite` -> `professional`
- `structured` -> `natural`
- `thorough` -> `professional`

Supported quality values:

- `fast`
- `balanced`
- `quality`

Clients cannot pass arbitrary model names. PolishKit maps quality internally:

- `fast` -> `gpt-5.4-nano`
- `balanced` -> `gpt-5.4-mini`
- `quality` -> `gpt-5.5`

Prompt rules:

- Polish only. Do not answer the content.
- If mostly English, polish in English.
- If mostly Chinese, polish in Chinese.
- If mixed, use the language that appears most.
- Preserve technical terms, names, Jira keys, PR links, API names, code identifiers, and error messages.
- Preserve original meaning and intent.
- Preserve the original line breaks and list structure unless changing them clearly improves readability.
- Do not add extra context.
- Do not make claims stronger than the original.
- Return only the polished text.

## Local Setup

Install dependencies:

```sh
pnpm install
```

Create a local env file:

```sh
cp .env.example .env
```

Set:

- `API_TOKEN`: a long random token used by Shortcuts
- `OPENAI_API_KEY`: your OpenAI API key
- `PORT`: optional, defaults to `3000`

Run in development:

```sh
pnpm dev
```

Build and run:

```sh
pnpm build
pnpm start
```

## Curl Example

```sh
curl -X POST http://localhost:3000/polish \
  -H "Content-Type: application/json" \
  -H "X-API-Token: replace-with-a-long-random-token" \
  -d '{
    "text": "can you help check this one, i think maybe it is not right",
    "style": "professional",
    "quality": "balanced"
  }'
```

## Mac Shortcut Example

Create a Shortcut with these actions:

1. Add `Text` or use `Shortcut Input` as the source text.
2. Add `Show Notification`.
   - Title: `PolishKit`
   - Body: `Polishing...`
3. Add `Get Contents of URL`.
4. URL: `http://localhost:3000/polish`.
5. Method: `POST`.
6. Headers:
   - `Content-Type`: `application/json`
   - `X-API-Token`: your `API_TOKEN`
7. Request Body: JSON
   - `text`: the input text
   - `style`: `natural`, `professional`, `concise`, or `direct`
   - `quality`: `fast`, `balanced`, or `quality`
8. Add `Get Dictionary Value` for `text`.
9. Copy the result to clipboard or return it from the Shortcut.
10. Add `Show Notification`.
    - Title: `PolishKit`
    - Body: `Polished text copied.`

For Mac-only local usage, keep the server running on the Mac and call `http://localhost:3000/polish`.

## iPhone Shortcut Example

An iPhone cannot call `localhost` on your Mac directly. Use one of these options:

- Run PolishKit on a reachable server.
- Expose your Mac temporarily with a secure tunnel.
- Use your Mac LAN IP, for example `http://192.168.1.10:3000/polish`, when the iPhone and Mac are on the same trusted network.

In the iPhone Shortcut:

1. Add `Text`, `Dictate Text`, or `Shortcut Input`.
2. Add `Show Notification`.
   - Title: `PolishKit`
   - Body: `Polishing...`
3. Add `Get Contents of URL`.
4. URL: your reachable PolishKit `/polish` URL.
5. Method: `POST`.
6. Headers:
   - `Content-Type`: `application/json`
   - `X-API-Token`: your `API_TOKEN`
7. Request Body: JSON
   - `text`: the input text
   - `style`: `professional`
   - `quality`: `balanced`
8. Read the `text` field from the JSON response and use it as the polished result.
9. Add `Show Notification`.
   - Title: `PolishKit`
   - Body: `Polished text ready.`

## Privacy

- Full input text is not logged.
- Requests are not stored.
- Logs only include metadata: style, quality, model, duration, success/failure, and non-content error details.
- OpenAI calls use `store: false`.

## Runtime Limits

- Request JSON body size is limited to 32 KB.
- `text` is limited to 8000 characters.
- OpenAI requests time out after 10 seconds.

## Deployment

GitHub Actions runs CI on pushes and pull requests. Pushes to `main` also deploy to the EC2 instance after the build passes.

Required GitHub Actions secrets:

- `EC2_HOST`: the EC2 public IP or DNS name.
- `EC2_USER`: the SSH user, for example `ubuntu`.
- `EC2_SSH_KEY`: the private SSH key used to connect to the EC2 instance.

Production environment variables stay on the EC2 instance in `/opt/polish-kit/.env`. Do not store `OPENAI_API_KEY` or production `API_TOKEN` in GitHub.

The deploy job runs:

```sh
cd /opt/polish-kit
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm run build
sudo systemctl restart polishkit
```
