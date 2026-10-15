"""
Agente local do JobFinder.

Roda no seu computador e busca vagas em sites que bloqueiam servidores na nuvem
(Indeed e Glassdoor, via JobSpy). O JobFinder — local ou hospedado — conversa com
ele pelo navegador em http://127.0.0.1:8765. Nada é enviado para terceiros: o
agente só consulta os sites de vagas e devolve a lista para a sua própria tela.
"""
import json
import logging
import os
import re
import sys
import time
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

warnings.filterwarnings("ignore")
# O console do Windows nem sempre usa UTF-8: troca caracteres que ele não sabe mostrar em vez de quebrar
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
logging.getLogger("JobSpy").setLevel(logging.CRITICAL)

VERSION = "1.0.0"
HOST = "127.0.0.1"  # só aceita conexões deste computador
PORT = int(os.environ.get("JOBFINDER_AGENTE_PORTA", "8765"))

# Sites que podem chamar o agente: o app rodando localmente e, opcionalmente,
# o endereço onde o JobFinder estiver hospedado (ex: https://meu-jobfinder.onrender.com)
EXTRA_ORIGINS = [o.strip().rstrip("/") for o in os.environ.get("JOBFINDER_ORIGENS", "").split(",") if o.strip()]
LOCAL_ORIGIN = re.compile(r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$")

try:
    from jobspy import scrape_jobs
except ImportError:  # pragma: no cover
    print("JobSpy não está instalado. Rode o iniciar.bat (Windows) ou iniciar.sh (Mac/Linux).")
    sys.exit(1)

SOURCES = {
    "indeed": "Indeed",
    "glassdoor": "Glassdoor",
}


def origin_allowed(origin):
    return bool(origin) and (LOCAL_ORIGIN.match(origin) or origin.rstrip("/") in EXTRA_ORIGINS)


def to_iso(value):
    if value is None or value != value:  # NaN
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def clean(value, limit=None):
    if value is None or value != value:
        return ""
    s = str(value).strip()
    return s[:limit] if limit else s


def number(value):
    """Número ou None (o JobSpy usa NaN para campos vazios)."""
    try:
        v = float(value)
        return v if v == v and v > 0 else None
    except (TypeError, ValueError):
        return None


def run_site(site, query, filters):
    """Uma consulta ao JobSpy, já convertida para o formato do JobFinder."""
    br = filters.get("region", "br") != "world"
    remote = filters.get("workMode", "remote_hybrid") != "any"
    city = clean(filters.get("location"))
    plans = []
    if remote:
        plans.append({"location": "Brasil" if br else "", "is_remote": True})
        if filters.get("workMode") == "remote_hybrid" and city and br:
            plans.append({"location": city, "is_remote": False})
    else:
        plans.append({"location": city or ("Brasil" if br else ""), "is_remote": False})

    out = []
    for plan in plans:
        kwargs = dict(
            site_name=[site],
            search_term=query,
            location=plan["location"] or None,
            results_wanted=50 if site == "indeed" else 30,
            country_indeed="Brazil" if br else "USA",
            verbose=0,
        )
        # No Indeed, "remoto" e "data de publicação" não podem ser usados juntos;
        # o JobFinder já filtra pela data depois, então priorizamos o filtro de remoto.
        if plan["is_remote"]:
            kwargs["is_remote"] = True
        elif filters.get("days"):
            kwargs["hours_old"] = int(filters["days"]) * 24
        df = scrape_jobs(**kwargs)
        for _, r in df.iterrows():
            location = clean(r.get("location"))
            mode = "remote" if (r.get("is_remote") is True and (site == "indeed" or "remot" in location.lower())) else "unknown"
            tags = [clean(r.get("job_type"))]
            lo, hi = number(r.get("min_amount")), number(r.get("max_amount"))
            if lo or hi:
                faixa = f"{int(lo or hi)}-{int(hi)}" if lo and hi and hi != lo else f"{int(lo or hi)}"
                tags.append(f"{clean(r.get('currency'))} {faixa}/{clean(r.get('interval'))}".strip())
            out.append({
                "title": clean(r.get("title"), 200),
                "company": clean(r.get("company"), 120),
                "url": clean(r.get("job_url_direct")) or clean(r.get("job_url")),
                "location": location,
                "date": to_iso(r.get("date_posted")),
                "mode": mode,
                "desc": clean(r.get("description"), 8000),
                "tags": [t for t in tags if t],
                "source": SOURCES[site],
            })
    return out


def search(filters):
    queries = [q for q in (filters.get("queries") or []) if isinstance(q, str) and q.strip()][:4] or ["emprego"]
    sites = [s for s in (filters.get("sites") or list(SOURCES)) if s in SOURCES]
    status, jobs = {}, []
    started = time.time()
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(run_site, s, q, filters): (s, q) for s in sites for q in queries}
        for fut in as_completed(futures):
            site, _ = futures[fut]
            st = status.setdefault(site, {"ok": True, "raw": 0})
            try:
                found = fut.result()
                st["raw"] += len(found)
                jobs.extend(found)
            except Exception as e:  # um site falhar não derruba os outros
                st["ok"] = st["raw"] > 0
                st["error"] = f"{type(e).__name__}: {str(e)[:160]}"
    print(f"[{datetime.now():%H:%M:%S}] busca {queries}: {len(jobs)} vagas em {time.time() - started:.1f}s "
          + " ".join(f"{k}={v['raw']}" for k, v in status.items()))
    return {"jobs": jobs, "status": status}


class Handler(BaseHTTPRequestHandler):
    server_version = f"JobFinderAgente/{VERSION}"

    def _cors(self):
        origin = self.headers.get("Origin")
        if origin_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            # Necessário para um site hospedado (https) falar com o 127.0.0.1 no Chrome
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204 if origin_allowed(self.headers.get("Origin")) else 403)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") in ("", "/status"):
            return self._json(200, {"ok": True, "app": "jobfinder-agente", "version": VERSION, "sources": list(SOURCES.values())})
        self._json(404, {"error": "não encontrado"})

    def do_POST(self):
        if self.path.rstrip("/") != "/search":
            return self._json(404, {"error": "não encontrado"})
        if self.headers.get("Origin") and not origin_allowed(self.headers.get("Origin")):
            return self._json(403, {"error": "origem não autorizada"})
        try:
            length = min(int(self.headers.get("Content-Length") or 0), 100_000)
            filters = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "JSON inválido"})
        try:
            result = search(filters)
        except Exception as e:  # nunca deixa a tela sem resposta
            return self._json(500, {"error": f"{type(e).__name__}: {str(e)[:200]}"})
        self._json(200, result)

    def log_message(self, *args):  # silencia o log padrão de cada requisição
        pass


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Agente do JobFinder v{VERSION} rodando em http://{HOST}:{PORT}")
    print(f"Fontes: {', '.join(SOURCES.values())}. Deixe esta janela aberta enquanto usa o JobFinder.")
    if EXTRA_ORIGINS:
        print("Sites autorizados além do local:", ", ".join(EXTRA_ORIGINS))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAgente encerrado.")


if __name__ == "__main__":
    main()
