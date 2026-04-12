# Como Iniciar o Projeto Soccer Exchange

Este documento explica como executar o projeto completo (backend + scraper + frontend).

## Requisitos

- Node.js 20+
- Python 3.11+
- npm

---

## 1. Backend (API) - Porta 3001

O backend é a API principal que processa dados e fornece os sinais.

```bash
cd /Users/lucashegouet/Documents/Antygravity/soccer-exchange
npm run dev
```

O servidor estará disponível em `http://localhost:3001`

**Verificação:**
```bash
curl http://localhost:3001/health
```

**Scripts disponíveis:**
- `npm run dev` - desenvolvimento com hot reload
- `npm run dev:run-now` - inicia + executa o pipeline imediatamente
- `npm run build` - compila para produção
- `npm run pipeline` - executa apenas o pipeline de scraping

---

## 2. Scraper Service (FastAPI) - Porta 8001

O scraper busca dados do Sofascore. É um microserviço Python separado.

```bash
cd /Users/lucashegouet/Documents/Antygravity/soccer-exchange/scraper-service
source venv/bin/activate  # ou venv\Scripts\activate no Windows
uvicorn main:app --port 8001 --reload
```

**Setup inicial (uma vez):**
```bash
cd scraper-service
pip install -r requirements.txt
python -m playwright install chromium
```

---

## 3. Frontend (Next.js) - Porta 3000

O frontend é a interface visual. Você pode usar o novo (Next.js) ou o antigo (Vite).

### Novo Frontend (recomendado)

```bash
cd /Users/lucashegouet/Documents/Antygravity/soccer-exchange/frontend-next
npm run dev
```

Acesse: `http://localhost:3000`

**Se houver problemas de node_modules corrompido:**
```bash
cd frontend-next
rm -rf node_modules package-lock.json
npm install
```

### Frontend Antigo (Vite)

```bash
cd /Users/lucashegouet/Documents/Antygravity/soccer-exchange/frontend
npm run dev
```

Acesse: `http://localhost:5173`

---

## Arquivo .env

O arquivo `.env` na raiz deve conter:

```env
OPENAI_API_KEY=
FIRECRAWL_API_KEY=fc-e7bbf092a7ca44efa3809acf181e07b9

PORT=3001
NODE_ENV=development
DB_PATH=./data/soccer.db

SCRAPING_DELAY_MS=1500
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

O `.env.local` no frontend deve ter:

```env
API_URL=http://localhost:3001
```

---

## Solução de Problemas Comuns

### "Permission denied" ao executar npm run dev

```bash
chmod +x node_modules/.bin/ts-node
```

### node_modules corrompido

```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro de TypeScript em rotas

Se houver erro com `req.params`, certifique-se de tratar como string:
```typescript
const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
```

### Favicon corrompido

Se o favicon mostrar erro "unable to decode image data":
```bash
rm app/favicon.ico
```

### Problemas com PostCSS

Se houver erro "PostCSS config is undefined", o `postcss.config.mjs` deve conter:
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

---

## Scripts do Package.json Raiz

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia backend |
| `npm run dev:run-now` | Inicia + executa pipeline |
| `npm run frontend` | Inicia frontend Next.js |
| `npm run frontend:build` | Build do frontend |
| `npm run pipeline` | Executa apenas o pipeline |

---

## Ports

- **3000**: Frontend Next.js
- **3001**: Backend API
- **8001**: Scraper Service (FastAPI)
- **5173**: Frontend Vite (antigo)