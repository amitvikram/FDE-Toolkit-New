# Run the FDE-Toolkit website with Docker

This mode runs only the public product website. It does not require Convex, authentication, Cloudflare Workers, voice services, API keys, or a local `.env` file.

## Requirements

- Docker Desktop installed
- Docker Desktop running
- The repository cloned locally

## Start the website

From the repository root:

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

The first build downloads the Node image and installs dependencies, so it takes longer than later starts.

## Stop the website

Press `Ctrl+C`, then run:

```bash
docker compose down
```

## Start it again later

```bash
docker compose up
```

## Rebuild after code changes

```bash
docker compose up --build
```

## Troubleshooting

### Port 3000 is already in use

Change the port mapping in `compose.yaml` from:

```yaml
- "3000:3000"
```

to:

```yaml
- "3001:3000"
```

Then open `http://localhost:3001`.

### Clean rebuild

```bash
docker compose down
docker builder prune -f
docker compose up --build
```

## What public-site mode disables

- Sign-in and account creation
- Convex queries and mutations
- Customer sandboxes
- AI-generated application changes
- Voice services
- GitHub pull-request automation

These capabilities remain available in the full configured application. Public-site mode exists to make website review and marketing development simple.
