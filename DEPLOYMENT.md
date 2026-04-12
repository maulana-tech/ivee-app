# AVE Crypto Dashboard - Deployment Plan

## Current Build Status
```
✓ Build: Success
✓ Dev Server: Running (localhost:3000)
✓ All 22 Crypto Panels: Registered
```

---

## 1. Build Configuration

```bash
# Production build
npm run build

# Output: dist/
# - index.html
# - assets/main-*.js
# - sw.js (PWA service worker)
```

### Vite Config (Production)
- Mode: `production`
- PWA: Enabled (62 entries precached)
- Chunking: Enabled (large chunk warning is OK)

---

## 2. Environment Variables Required

### Required:
```
VITE_AVE_API_KEY=4jFc0Luq30MboTRHof15K7frDMkPZ8xW6Y9JGmEUlXK4dKoVcqrHMzRjF8FTfEAM
VITE_AVE_ENABLED=true
```

### Optional (for production data):
```
# CoinGecko (free tier) - already built-in fallback
# AVE API - premium features only

# Redis (optional, for caching)
REDIS_URL=redis://...

# Analytics (optional)
VITE_UMAMI_ID=...
```

---

## 3. Deploy Target

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or connect GitHub repo and deploy automatically
```

**Project Settings:**
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Alternative: Node.js Server
```bash
# Build
npm run build

# Serve with any static server
npx serve dist -p 3000
```

---

## 4. Production API Endpoints

| Endpoint | Source | Status |
|----------|--------|--------|
| `/api/market/v1/*` | Dev middleware → CoinGecko | ✅ |
| `/api/ave/*` | Vite proxy → prod.ave-api.com | ✅ |
| `/api/ai/analyze` | AI Agent service | ✅ |

### Note for Production:
- Dev middleware works in Vercel Edge Functions
- For production, recommend:
  1. Use Vercel KV (Redis) for caching, OR
  2. Use external API with longer cache headers

---

## 5. Domain Configuration

### Option A: Subdomain (Recommended)
```
crypto.ave.ai → Vercel deployment
```

### Option B: Custom Domain
```bash
# Add domain in Vercel dashboard
# Then update DNS records
```

---

## 6. Pre-Deploy Checklist

- [x] Build succeeds
- [x] All panels render without crash
- [x] Wallet connect works (dev)
- [x] PWA configuration enabled
- [ ] Update API key for production (if needed)
- [ ] Set environment variables in Vercel
- [ ] Test production build locally

---

## 7. Quick Deploy Commands

```bash
# Clone repo
git clone https://github.com/anomalyco/worldmonitor-main.git
cd worldmonitor-main

# Install
npm install

# Set env
echo "VITE_AVE_API_KEY=4jFc0Luq30MboTRHof15K7frDMkPZ8xW6Y9JGmEUlXK4dKoVcqrHMzRjF8FTfEAM" > .env.local
echo "VITE_AVE_ENABLED=true" >> .env.local

# Build
npm run build

# Deploy to Vercel
npx vercel --prod
```

---

## 8. Post-Deploy Verification

1. **Load test** - Check dashboard loads in <3s
2. **Wallet connect** - Test MetaMask connection
3. **Panel loading** - Scroll through all panels
4. **AI analysis** - Run Risk Scanner analysis
5. **Trade execution** - Test simulate trade

---

## 9. Monitoring (Optional)

```bash
# Add to Vercel Dashboard:
- Vercel Analytics (free)
- Sentry for error tracking
- Raygun for performance
```

---

## Success Criteria

- [ ] Dashboard loads on crypto.yourdomain.com
- [ ] All 22 panels visible and responsive
- [ ] Wallet connect works with MetaMask
- [ ] AI Risk Scanner shows analysis
- [ ] Trade execution flow works
- [ ] PWA installable on mobile

---

## Next Steps

1. Choose deployment target (Vercel recommended)
2. Add environment variables
3. Deploy
4. Test in production
5. Monitor and fix issues