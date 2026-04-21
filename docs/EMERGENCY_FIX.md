# EMERGENCY FIX - QuotationManagement Blank Page

## 🚨 Quick Solution

The blank page is caused by **field mapping mismatch** between Supabase (snake_case) and UI (camelCase).

### Option 1: Disable RLS + Clear Browser Cache

```sql
-- Run in Supabase SQL Editor
ALTER TABLE blink_quotations DISABLE ROW LEVEL SECURITY;
```

Then in browser:
1. Hard refresh: `Cmd + Shift + R`
2. Or clear site data: DevTools → Application → Clear Storage

### Option 2: Check if Data Exists

1. Open https://nkyoszmtyrpdwfjxggmb.supabase.co
2. Table Editor → `blink_quotations`
3. If NO data → Problem is RLS blocking fetch
4. If data EXISTS → Problem is field mapping

### Option 3: Temporary Workaround

Open browser console on QuotationManagement page:

```javascript
// Check what's in state
localStorage.removeItem('blink_quotations');
location.reload();
```

## 🔍 Debug Steps

1. **Check Console Errors:**
   - F12 → Console tab
   - Look for exact error line
   - Screenshot and send

2. **Check Network:**
   - F12 → Network tab
   - Look for Supabase API calls
   - Check if returning 200 or 403

3. **Check Supabase:**
   - Does table have data?
   - Can you see rows in Table Editor?

## ✅ Most Likely Fix

Run this SQL:

```sql
-- Disable RLS
ALTER TABLE blink_quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE blink_shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE blink_tracking_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE blink_leads DISABLE ROW LEVEL SECURITY;
```

Then hard refresh browser.

**This should fix blank page!**
