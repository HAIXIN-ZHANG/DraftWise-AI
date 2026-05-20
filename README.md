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
  "style": "default",
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

- `default`
- `slack`
- `email`
- `note`
- `shorter`
- `polite`
- `direct`

Supported quality values:

- `fast`
- `balanced`
- `quality`

Clients cannot pass arbitrary model names. PolishKit maps quality internally:

- `fast` -> `gpt-5.4-nano`
- `balanced` -> `gpt-5.4-mini`
- `quality` -> `gpt-5.5`

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
    "style": "slack",
    "quality": "balanced"
  }'
```

## Mac Shortcut Example

Create a Shortcut with these actions:

1. Add `Text` or use `Shortcut Input` as the source text.
2. Add `Get Contents of URL`.
3. URL: `http://localhost:3000/polish`.
4. Method: `POST`.
5. Headers:
   - `Content-Type`: `application/json`
   - `X-API-Token`: your `API_TOKEN`
6. Request Body: JSON
   - `text`: the input text
   - `style`: `default`, `slack`, `email`, `note`, `shorter`, `polite`, or `direct`
   - `quality`: `fast`, `balanced`, or `quality`
7. Add `Get Dictionary Value` for `text`.
8. Copy the result to clipboard or return it from the Shortcut.

For Mac-only local usage, keep the server running on the Mac and call `http://localhost:3000/polish`.

## iPhone Shortcut Example

An iPhone cannot call `localhost` on your Mac directly. Use one of these options:

- Run PolishKit on a reachable server.
- Expose your Mac temporarily with a secure tunnel.
- Use your Mac LAN IP, for example `http://192.168.1.10:3000/polish`, when the iPhone and Mac are on the same trusted network.

In the iPhone Shortcut:

1. Add `Text`, `Dictate Text`, or `Shortcut Input`.
2. Add `Get Contents of URL`.
3. URL: your reachable PolishKit `/polish` URL.
4. Method: `POST`.
5. Headers:
   - `Content-Type`: `application/json`
   - `X-API-Token`: your `API_TOKEN`
6. Request Body: JSON
   - `text`: the input text
   - `style`: `default`
   - `quality`: `balanced`
7. Read the `text` field from the JSON response and use it as the polished result.

## Privacy

- Full input text is not logged.
- Requests are not stored.
- Logs only include metadata: style, quality, model, duration, success/failure, and non-content error details.
- OpenAI calls use `store: false`.

## Runtime Limits

- Request JSON body size is limited to 32 KB.
- `text` is limited to 8000 characters.
- OpenAI requests time out after 20 seconds.
