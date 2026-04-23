# Sorteo FC 26

App web single-page para sortear equipos de EA FC 26 entre hasta 20 participantes, con **bombos armados automáticamente** y **auditoría criptográfica** (SHA-256 sobre payload canónico).

## Tabla de contenidos

1. [Setup rápido](#setup-rápido)
2. [Arquitectura](#arquitectura)
3. [Lógica de bombos y los 3 modos de sorteo](#lógica-de-bombos-y-los-3-modos-de-sorteo)
4. [API REST](#api-rest)
5. [Modelo de seguridad](#modelo-de-seguridad)
6. [Cómo editar el pool de equipos](#cómo-editar-el-pool-de-equipos)
7. [Consideraciones](#consideraciones)

---

## Setup rápido

### Opción 1 — Con `make` (recomendado)

```bash
make install   # una sola vez
make dev       # backend :8000 + frontend :5173
```

Abrir [http://localhost:5173](http://localhost:5173).

### Opción 2 — Docker

```bash
docker compose up
```

### Opción 3 — Manual

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

### Ejecutar tests backend

```bash
make test
# 55 passed
```

---

## Arquitectura

```
fc26-sorteo/
├── backend/           Python 3.11+, FastAPI, SQLite
│   ├── app/
│   │   ├── teams.py           Pool estático (20 equipos FC 26)
│   │   ├── pool_selector.py   Selección de pool efectivo
│   │   ├── bombos.py          Armado determinista de bombos
│   │   ├── sorteo.py          Los 3 modos de sorteo
│   │   ├── audit.py           Hash canónico SHA-256
│   │   ├── db.py              SQLite (stdlib)
│   │   ├── schemas.py         Pydantic v2
│   │   ├── export.py          CSV / JSON / Markdown
│   │   └── main.py            FastAPI app
│   └── tests/                 55 tests pytest
└── frontend/          React 18 + Vite + TS + Tailwind
    └── src/
        ├── pages/      NewSorteo / Resultado / Historial
        ├── components/ Participantes, Preview, Animación, Panel integridad…
        └── api/client.ts
```

**Decisiones clave:**

- **CSPRNG por default.** `secrets.SystemRandom()` para no ser predecible. Se puede pasar un `seed` entero explícito para demos públicas reproducibles.
- **Hash canónico.** Se serializa el payload con `json.dumps(..., sort_keys=True, ensure_ascii=False)` y se hace `sha256` hex sobre el resultado. Cualquier cambio (aunque sea cambiar un nombre en la asignación) rompe el hash.
- **SQLite stdlib.** Sin ORM. Parametrización en todas las queries.
- **Sin autenticación.** App local/intranet. Documentado en [Modelo de seguridad](#modelo-de-seguridad).
- **Preview en tiempo real.** El frontend llama a `/api/pool?participants=N` cada vez que cambia el número, mostrando pool y bombos antes del sorteo.

---

## Lógica de bombos y los 3 modos de sorteo

### Paso 1: Selección del pool efectivo

El pool total tiene 20 equipos (**12 clubes + 8 selecciones nacionales**). Cuando hay menos participantes que equipos, se prioriza **clubes sobre selecciones**:

- Si `N <= 12` → se usan los primeros `N` clubes ordenados por `priority`.
- Si `N > 12` → se usan los 12 clubes + las primeras `N - 12` selecciones ordenadas por `priority`.

| N | Pool efectivo |
|----|---------------|
| 4  | 4 clubes top (Real Madrid, Man City, PSG, Barcelona) |
| 8  | 8 clubes top |
| 11 | 11 clubes (los de mayor priority) |
| 12 | los 12 clubes |
| 13 | 12 clubes + Francia |
| 15 | 12 clubes + Francia, España, Argentina |
| 20 | los 20 equipos |

### Paso 2: Armado determinista de bombos

Sobre el pool efectivo:

1. **Número de bombos `B`**: `B = min(N, 4)`.
2. **Tamaño de cada bombo**: base = `N // B`, los primeros `N % B` bombos reciben un equipo extra. Ej: `N=15, B=4 → [4, 4, 4, 3]`.
3. Los equipos se ordenan por `OVR DESC` (desempate por `priority ASC`) y se reparten en ese orden: el bombo 1 recibe los de mayor OVR, el bombo `B` los de menor.
4. Esto es **determinista** — el usuario puede verificar visualmente el criterio antes de sortear.

### Paso 3: Sorteo (3 modos)

#### `simple` (default)

- Se barajan todos los equipos del pool y se asignan 1:1 a los participantes en orden de entrada.
- Los bombos sirven solo como información visual (tiering). La animación dramatiza bombo por bombo.

#### `bombo_equilibrado`

- **Solo si `N` es múltiplo de `B`** (si no, el frontend deshabilita el modo).
- Se crean `N/B` grupos de `B` participantes cada uno.
- Cada grupo recibe **exactamente un equipo de cada bombo** — útil para armar grupos balanceados de fase de liga.

#### `draft_bombos`

- Los participantes reciben un orden de pick aleatorio (1 a N).
- Se recorren los bombos de 1 a B. En cada bombo se barajan sus equipos y se entregan a los próximos participantes según el orden de pick.
- El orden de pick queda registrado en el audit log.

---

## API REST

Base: `http://localhost:8000`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/teams` | Pool completo |
| GET | `/api/pool?participants=N` | Pool efectivo + bombos + modos disponibles |
| POST | `/api/sorteo` | Ejecuta el sorteo, persiste y devuelve hash |
| GET | `/api/sorteo/{id}` | Recupera un sorteo |
| GET | `/api/sorteo/{id}/verify` | Re-calcula el hash y lo compara |
| GET | `/api/sorteo/{id}/export?format=csv\|json\|md` | Exporta con `Content-Disposition: attachment` |
| GET | `/api/sorteos?limit=20&offset=0` | Historial paginado |

Validaciones clave (`POST /api/sorteo`):

- `2 ≤ participants ≤ 20`
- nombres únicos case-insensitive, no vacíos, ≤50 caracteres
- modo `bombo_equilibrado` requiere `N` múltiplo del número de bombos → 400 con mensaje claro

### Ejemplo de payload canónico para hash

```json
{
  "assignments": [
    {"bombo": 1, "ovr": 88, "participant": "Juan", "pick_order": 1, "team": "Real Madrid"},
    {"bombo": 2, "ovr": 85, "participant": "Ana", "pick_order": 2, "team": "España"}
  ],
  "bombos": [
    {"equipos": ["Real Madrid", ...], "numero": 1},
    {"equipos": ["España", ...], "numero": 2}
  ],
  "groups": null,
  "mode": "simple",
  "participants": ["Juan", "Ana"],
  "pool_used": ["Real Madrid", ...],
  "seed": null,
  "timestamp": "2026-04-23T19:30:45.123456+00:00"
}
```

---

## Modelo de seguridad

### Superficie defendida

- **CORS**: solo `localhost:5173` por default. Configurable con la env var `FC26_CORS_ORIGIN` (coma-separado).
- **SQL injection**: todas las queries usan parametrización (`?`) de `sqlite3`; nunca se concatena.
- **XSS**: React escapa por default; no se usa `dangerouslySetInnerHTML`.
- **Validación**: Pydantic v2 valida entrada antes de tocar la lógica. Nombres >50 char, duplicados, o vacíos retornan 422.
- **CSPRNG por default**: `secrets.SystemRandom` es criptográficamente seguro. Solo se usa `random.Random(seed)` si el usuario provee semilla explícita.
- **Comparación de hash en tiempo constante**: `hmac.compare_digest`.

### Limitaciones conocidas

- **No hay autenticación**. La app asume operación local o detrás de un reverse proxy con acceso controlado.
- **Sin rate limiting**. Para exposición pública, agregar [`slowapi`](https://slowapi.readthedocs.io/):
  ```python
  from slowapi import Limiter
  limiter = Limiter(key_func=get_remote_address)
  app.state.limiter = limiter
  @limiter.limit("20/minute")
  ```
- **El backend es la fuente de verdad**. Si un atacante tiene acceso a la DB, puede reescribir tanto el resultado **como** el hash almacenado. El hash detecta modificaciones accidentales/corrupción, no un adversario con acceso total.
- Para un esquema **trustless** habría que hacer commit-reveal: cada participante envía `hash(nonce)` antes del sorteo, y la semilla final es `XOR` de los nonces revelados. **Fuera de scope** de esta app local.

---

## Cómo editar el pool de equipos

Todos los equipos están en `backend/app/teams.py`. Para agregar uno:

```python
{"name": "Nuevo Equipo", "type": "club", "ovr": 82, "att": 82, "mid": 80, "def": 82, "bombo": 4, "priority": 21},
```

Reglas:

- `type` debe ser `"club"` o `"nation"`.
- `priority` define el orden de selección cuando hay menos participantes que equipos — **debe ser único**.
- `bombo` es solo referencia histórica; los bombos reales los arma `bombos.py` dinámicamente según OVR.

Si cambiás el total de equipos, actualizá los tests en `backend/tests/test_pool_selector.py`.

---

## Consideraciones

- **OVR iguales → desempate por `priority`**. Por ejemplo, con N=15 y 5 equipos empatados en OVR 85, el orden entre ellos lo define `priority ASC`. Esto hace el armado 100% determinista.
- **Con N<4 el sorteo pierde la noción de "bombos"**. Se crea un bombo por equipo pero conceptualmente son asignaciones 1:1. Los modos siguen funcionando.
- **El modo `draft_bombos` con N<B** no aporta más que el modo `simple` porque cada bombo tiene 1 equipo. Lo dejamos disponible por consistencia.
- **Verificación post-tampering**: si alguien altera el `payload_json` en la DB, `/verify` devuelve `verified: false` y muestra `stored_hash != computed_hash`. El test `test_verify_detecta_tamper` cubre ese caso.
- **La lista `TEAMS` del código tiene 12 clubes y 8 selecciones**. Los ejemplos originales de la spec mencionaban "11 clubes + 9 selecciones" — preferimos mantener los datos tal como se definieron en el código y ajustamos la documentación.
