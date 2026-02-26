# GrantBot Chatbot - E2E Test Issues

**Generated:** 2026-02-26 15:56 UTC  
**Tester:** Františka (factory-e2e sub-agent)

## Issues Found

### 🔴 CRITICAL (1)

#### ISSUE-001: Server crash pri dlhých vstupoch
- **Priority:** CRITICAL (blocker)
- **Component:** Backend API
- **Endpoint:** `POST https://api.stormlevel.com/api/chat`
- **Description:** Server crashuje s HTTP 500 keď dostane input > 1000 znakov
- **Repro steps:**
  1. Odošli POST request s `message` obsahujúcim 2850+ znakov
  2. Server okamžite vráti HTTP 500 Internal Server Error
- **Expected behavior:** 
  - Buď HTTP 400 s validačnou chybou "Text je príliš dlhý (max 500 znakov)"
  - Alebo automaticky truncate input na prvých 1000 znakov + warning v odpovedi
- **Impact:** 
  - Používateľ môže nechtiac crashnúť chatbot (copy-paste dlhého textu)
  - API je vulnerable na DoS cez veľké payloady
- **Fix recommendation:**
  ```javascript
  // Backend validation
  if (req.body.message.length > 1000) {
    return res.status(400).json({
      error: "Tvoja správa je príliš dlhá. Prosím skráť ju na max 1000 znakov."
    });
  }
  ```
- **Evidence:** `/home/clawd/Projects/grant-viewer/e2e-screenshots/api-responses/test-7-response.json`
- **Test case:** Test 7 (Stress test)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| MEDIUM | 0 |
| LOW | 0 |
| **TOTAL** | **1** |

**Verdikt:** ⚠️ NEEDS_FIX (1 blocker issue)

---

## Next Steps

1. ✅ Report vytvorený
2. ⏳ Developer opraví ISSUE-001
3. ⏳ Re-test Test 7 po oprave
4. ⏳ Verdikt → PASS
