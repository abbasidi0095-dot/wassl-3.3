# Wassl 12.0 — Deployment guide

## Current state

- Branch: `feat/wassl-12`
- Production: `main` at `7c17a01`
- No deployment has been performed from this branch.
- Production remains on `wassl.service`, `127.0.0.1:3000`,
  `https://wassl.shop`.

## Pre-deployment checklist

```bash
cd /opt/wassl
git status
git log --oneline -5
npm run typecheck
npm run test
```

- Confirm no `.env*`, tokens, keys or credentials are staged.
- Back up the database:

```bash
cp /var/lib/wassl/db.json /var/lib/wassl/db.backup-$(date -u +%Y%m%dT%H%M%SZ).json
```

- Confirm `/etc/wassl.env` is unchanged and readable by the service.
- Confirm images in `public/images/products/` exist.

## Build and deploy

```bash
cd /opt/wassl

sudo systemctl stop wassl
npm run build
sudo systemctl start wassl
sleep 5

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "%{http_code}\n" https://wassl.shop/
journalctl -u wassl --since "5 minutes ago" --no-pager
```

Never rebuild `.next` while the service is running.

## Post-deployment checks

- Home, city, store, grocery, search, cart, checkout, taxi, account,
  login, orders.
- Search in EN/FR/ES/AR and Darija terms.
- Cross-store comparison cards.
- Product images and store covers.
- 1440 / 1024 / 768 / 390 widths.
- No horizontal overflow, no broken images, no unexpected console errors.
- axe WCAG 2.2 AA on customer routes.
- Mobile tab bar remains fixed after scrolling.

## Rollback

Code:

```bash
git reset --hard 7c17a01
sudo systemctl stop wassl
npm run build
sudo systemctl start wassl
```

Data:

```bash
cp /var/lib/wassl/db.backup-<timestamp>.json /var/lib/wassl/db.json
sudo systemctl restart wassl
```

## Approval

Deployment requires explicit approval. Do not restart production or run
any destructive migration from this branch without it.
