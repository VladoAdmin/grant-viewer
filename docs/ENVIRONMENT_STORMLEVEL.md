# StormLevel.com Environment Documentation
## GrantBot / GrantViewer Hosting Environment

**Dátum vytvorenia:** 2026-02-26  
**Posledná aktualizácia:** 2026-02-26

---

## 🌐 Hosting Provider

**WebSupport.sk** - Shared hosting / VPS hybrid
- **Server:** shell.r5.websupport.sk
- **Port:** 25254
- **Typ:** Linux-based hosting (presná distribúcia neznáma)
- **Prístup:** SSH + SFTP/FTP (vyžaduje SSH kľúč, nie password)

### DNS Záznamy
```
stormlevel.com
  A:     37.9.175.189
  AAAA:  2a00:4b40:aaaa:2008::6
  MX:    (email servery WebSupport)
  NS:    ns1.websupport.sk, ns2.websupport.sk

*.stormlevel.com
  A:     37.9.175.189
```

### Bežiace služby (verejne dostupné)
| Služba | URL | Status | Poznámka |
|--------|-----|--------|----------|
| StormLevel Web | https://stormlevel.com/ | ✅ Beží | Hlavná web stránka |
| GrantViewer | https://stormlevel.com/grant-viewer/ | ✅ Beží | React aplikácia |
| API | https://api.stormlevel.com/ | ❌ 404 | API nie je nasadené |
| WebShell | https://shell.r5.websupport.sk:25254 | ? | Prístup cez browser

---

## 📁 Dôležité cesty

```
# Hlavný web root
/data/c/4/c4830825-2b90-47cd-b33d-145e854f9393/stormlevel.com/

# GrantViewer deployment
/data/c/4/c4830825-2b90-47cd-b33d-145e854f9393/stormlevel.com/grant-viewer/

# Chatbot API (ak bude nasadený)
# Možné umiestnenia:
# - /data/c/4/c4830825-2b90-47cd-b33d-145e854f9393/stormlevel.com/api/
# - Alebo samostatný port cez proxy
```

---

## 🔧 Technológie

### Web Server
- **Apache alebo Nginx** (presný typ treba overiť na serveri)
- Podporuje: PHP, statické súbory, prípadne Node.js (treba overiť)

### Databáza
- **Externá:** Supabase PostgreSQL (cloudová)
- **URL:** `https://kapgabgnezcurmgcrvif.supabase.co`
- **Pooling:** `aws-1-eu-central-1.pooler.supabase.com:6543`
- **Použitie:** `grant_calls_v2`, `call_chunks` (vector DB)

### LLM / AI
- **Plánované:** OpenAI GPT-4o-mini cez API
- **Alternatíva:** Ollama na VPS 31.97.46.222 (n8n server)
- **Lokálne embeddings:** N/A na stormlevel.com (používame OpenAI)

### Frontend (GrantViewer)
- **Framework:** React + TypeScript + Vite
- **Build:** Static files (HTML/CSS/JS)
- **Deploy:** Manuálny upload cez FTP/SFTP alebo SSH
- **Aktuálna verzia:** Vo `dist/` adresári

---

## 🔑 Prístupy a Credentials

**⚠️ Všetky heslá a citlivé údaje sú v samostatnom súbore:**
📄 **`/home/clawd/.openclaw/.credentials/stormlevel.env`**

*Tento súbor NIKDY necommitovať do Gitu! Je v .gitignore.*

### Rýchly prístup (pre CLI použitie)
```bash
# SSH na stormlevel.com hosting
ssh -p 25254 uid1125075@shell.r5.websupport.sk

# SSH na VPS (n8n server)
ssh root@31.97.46.222

# SFTP na stormlevel.com
sftp -P 25254 uid1125075@shell.r5.websupport.sk
```

### API Keys (v lokálnom .env)
- OpenAI API Key: `OPENAI_API_KEY`
- Supabase URL + Key: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`
- **Lokácia .env:** `/home/clawd/.openclaw/.env` (nikdy commitovať!)

---

## 🚀 Aktívne projekty

### 1. GrantViewer (React App)
- **URL:** https://stormlevel.com/grant-viewer/
- **Stav:** ✅ Nasadený, funkcionalizovaný
- **Funkcie:**
  - List view / Gantt view
  - Detailný modal
  - Semantic search (pgvector)
  - ChatWidget (UI ready, čaká na API)

### 2. Chatbot API (Plánované)
- **URL:** https://api.stormlevel.com/ (cez VPS proxy)
- **Stav:** ❌ Zatiaľ neimplementované
- **Cieľ:** Node.js Express API na VPS 31.97.46.222
- **Endpointy:**
  - `POST /api/chat` - hlavný chat endpoint
  - `POST /api/extract-keywords` - extrakcia kľúčových slov
  - `POST /api/analyze-categories` - analýza grantov

---

## 🔄 Deployment proces

### Aktuálny (ručný)
1. `npm run build` v `/home/clawd/Projects/grant-viewer/`
2. Upload `dist/` cez SFTP/SCP na stormlevel.com
3. Overenie na https://stormlevel.com/grant-viewer/

### Plánovaný (automatický)
- GitHub Actions → auto-deploy na push do main
- Alebo webhook z VPS po úspešnom build

---

## 🔒 Bezpečnosť

- **CORS:** api.stormlevel.com musí mať povolené origin stormlevel.com
- **HTTPS:** Všetko cez TLS (Let's Encrypt na WebSupport)
- **Env vars:** Nikdy v kóde, vždy cez .env files

---

## ⚠️ Známe obmedzenia

1. **Žiadny Node.js runtime** na stormlevel.com hostingu (len statické súbory)
2. **API musí bežať na VPS** (n8n server 31.97.46.222) a nie priamo na hostingu
3. **Manuálny deploy** - zatiaľ bez CI/CD pipeline
4. **Omedzený SSH prístup** - shared hosting environment

---

## 📝 To-do pre environment

- [ ] Overiť presný webserver (Apache vs Nginx)
- [ ] Overiť dostupnosť Node.js na hostingu
- [ ] Nastaviť automatický deploy cez GitHub Actions
- [ ] Otestovať API latency (stormlevel.com ↔ VPS 31.97.46.222)

---

## 🔗 Súvisiace systémy

| Systém | URL | Účel |
|--------|-----|------|
| GrantViewer Frontend | https://stormlevel.com/grant-viewer/ | React aplikácia |
| Chatbot API | https://api.stormlevel.com/ | Backend API (na VPS) |
| n8n admin | https://n8n.srv864938.hstgr.cloud/ | Workflow automation |
| Supabase | https://kapgabgnezcurmgcrvif.supabase.co/ | Databáza + vector search |
| n8n VPS | 31.97.46.222 | Chatbot API tu bude bežať |

---

## 🔄 Rollback Procedúry (Bezpečnostné)

### Pred každou zmenou:
1. ✅ Vytvor GitHub commit s popisom zmien
2. ✅ Ulož backup aktuálneho `dist/` pred deployom
3. ✅ Testuj lokálne (`npm run dev`) pred deployom na produkciu
4. ✅ Maj otvorený WebShell/SSH pre prípadný rollback

### Rollback stormlevel.com (GrantViewer)
```bash
# 1. Pripoj sa cez SFTP/SSH
sftp -P 25254 uid1125075@shell.r5.websupport.sk

# 2. Zálohuj aktuálnu verziu
rename grant-viewer grant-viewer-BACKUP-$(date +%Y%m%d)

# 3. Obnov predchádzajúcu verziu z backupu
rename grant-viewer-BACKUP-20260225 grant-viewer

# 4. Over na webe: https://stormlevel.com/grant-viewer/
```

### Rollback VPS (n8n / API)
```bash
# 1. SSH na VPS
ssh root@31.97.46.222

# 2. Docker compose down
cd /root && docker-compose down

# 3. Git checkout na predchádzajúci commit
git log --oneline -5  # nájdi commit hash
git checkout <commit-hash>

# 4. Reštart služieb
docker-compose up -d

# 5. Over logy: docker logs root-n8n-1 --tail=50
```

### Keď niečo pokazíš:
1. **Zostaň pokojná** — všetko je zálohované
2. **Necommituj panické fixy** — najprv si rozmysli
3. **Použi rollback** — vráť sa na poslednú funkčnú verziu
4. **Otestuj lokálne** — oprav chybu najprv lokálne
5. **Deploy znova** — až keď je všetko OK

### Kontakty pre núdzové situácie:
- **VPS root access:** Ak stratíš SSH kľúč, treba kontaktovať hosting providera
- **WebSupport support:** helpdesk@websupport.sk
- **Vlado:** (osobný kontakt)

---

**Autor:** Františka  
**Vytvorené:** 2026-02-26  
**Posledná aktualizácia:** 2026-02-26  
**Verzia dokumentu:** 1.1