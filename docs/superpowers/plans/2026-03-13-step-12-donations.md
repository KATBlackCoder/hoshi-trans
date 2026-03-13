# Donations Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donations page with a Ko-fi button (opens in browser) and QR codes for BTC, USDT TRC-20, and XMR crypto addresses.

**Architecture:** Pure frontend feature. `openUrl()` from `tauri-plugin-opener` handles the Ko-fi link. `qrcode.react` generates QR codes from address strings. All addresses are constants in `src/lib/constants.ts`.

**Tech Stack:** React, qrcode.react, tauri-plugin-opener

---

## Packages to Add

```bash
pnpm add qrcode.react
```

> `tauri-plugin-opener` already present from STEP-01.

---

## File Structure

- Create: `src/lib/constants.ts` — KO_FI_URL, BTC, USDT_TRC20, XMR address constants
- Create: `src/features/donations/DonationsPage.tsx` — Ko-fi button + QR codes grid
- Create: `src/features/donations/index.ts` — re-export
- Modify: `src/App.tsx` — add Donations link in sidebar

---

## Task 1: Install qrcode.react

- [ ] **Step 1: Install package**

```bash
pnpm add qrcode.react
```

- [ ] **Step 2: Verify TypeScript types are included**

```bash
pnpm ls qrcode.react
```
Expected: Package installed (ships its own types)

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add qrcode.react"
```

---

## Task 2: Constants File

**Files:**
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Create constants.ts**

```ts
// src/lib/constants.ts
export const DONATIONS = {
  KO_FI_URL: 'https://ko-fi.com/[À REMPLIR]',
  BTC: '[À REMPLIR]',
  USDT_TRC20: '[À REMPLIR]',
  XMR: '[À REMPLIR]',
} as const
```

> ⚠️ Replace `[À REMPLIR]` placeholders with real addresses/URL before shipping.

- [ ] **Step 2: Verify TypeScript**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add donation constants (addresses TBD)"
```

---

## Task 3: DonationsPage Component

**Files:**
- Create: `src/features/donations/DonationsPage.tsx`
- Create: `src/features/donations/index.ts`

- [ ] **Step 1: Write DonationsPage**

```tsx
// src/features/donations/DonationsPage.tsx
import { openUrl } from '@tauri-apps/plugin-opener'
import { QRCodeSVG } from 'qrcode.react'
import { DONATIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface CryptoCardProps {
  name: string
  address: string
  color: string
}

function CryptoCard({ name, address, color }: CryptoCardProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 border rounded-lg">
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded"
        style={{ backgroundColor: color, color: '#fff' }}
      >
        {name}
      </span>
      <QRCodeSVG value={address} size={128} />
      <p className="text-xs font-mono text-muted-foreground break-all text-center max-w-[160px]">
        {address}
      </p>
    </div>
  )
}

export function DonationsPage() {
  return (
    <div className="flex flex-col items-center gap-8 p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Support hoshi-trans</h2>
        <p className="mt-2 text-muted-foreground">
          If this tool saves you time, consider supporting its development.
        </p>
      </div>

      <Button
        size="lg"
        onClick={() => openUrl(DONATIONS.KO_FI_URL)}
        className="bg-[#FF5E5B] hover:bg-[#e04e4b] text-white"
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Support on Ko-fi
      </Button>

      <div className="flex flex-wrap gap-6 justify-center">
        <CryptoCard
          name="Bitcoin (BTC)"
          address={DONATIONS.BTC}
          color="#F7931A"
        />
        <CryptoCard
          name="USDT TRC-20"
          address={DONATIONS.USDT_TRC20}
          color="#26A17B"
        />
        <CryptoCard
          name="Monero (XMR)"
          address={DONATIONS.XMR}
          color="#FF6600"
        />
      </div>
    </div>
  )
}
```

```ts
// src/features/donations/index.ts
export { DonationsPage } from './DonationsPage'
```

- [ ] **Step 2: Verify TypeScript**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/donations/
git commit -m "feat: add DonationsPage with Ko-fi button and crypto QR codes"
```

---

## Task 4: Wire into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Donations link to sidebar**

```tsx
// src/App.tsx — in MainLayout sidebar, add:
import { DonationsPage } from '@/features/donations'
import { Heart } from 'lucide-react'

// In the view state type: 'main' | 'settings' | 'donations'
// Add button in sidebar (near Settings button):
<button
  onClick={() => setView('donations')}
  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
  <Heart className="h-4 w-4" />
  Support
</button>

// In the main content area:
{view === 'donations' && <DonationsPage />}
```

- [ ] **Step 2: Test in app**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected:
- "Support" link visible in sidebar
- Clicking it shows the DonationsPage
- Ko-fi button opens browser (with real URL)
- QR codes render for all 3 crypto addresses
- QR codes are scannable with a phone (when addresses are filled in)

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add donations link to sidebar navigation"
```

---

## Task 5: Fill in Real Addresses

> ⚠️ Do not commit real crypto addresses to a public repo unless you intend to. Treat them like sensitive data.

- [ ] **Step 1: Update constants.ts with real values**

```ts
// src/lib/constants.ts — replace placeholders:
export const DONATIONS = {
  KO_FI_URL: 'https://ko-fi.com/YOUR_HANDLE',
  BTC: 'bc1q...YOUR_BTC_ADDRESS...',
  USDT_TRC20: 'T...YOUR_USDT_ADDRESS...',
  XMR: '4...YOUR_XMR_ADDRESS...',
} as const
```

- [ ] **Step 2: Test QR codes are scannable**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected: Each QR code scans correctly to the corresponding address

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add donation addresses"
```
