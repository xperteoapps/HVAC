# Atrapa API imoje do testów e2e (POST /v1/merchant/{id}/payment → payment.url). Uruchomienie:
# docker run -d --name imoje-mock --network supabase_network_hvac -v "$PWD/scripts/imoje-mock:/app:ro" python:3.12-alpine python /app/server.py
import json, uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
LOG = []
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        auth = self.headers.get('Authorization', '')
        LOG.append({'path': self.path, 'auth': auth, 'body': json.loads(body or '{}')})
        if auth != 'Bearer lokalny-token':
            self.send_response(401); self.end_headers(); self.wfile.write(b'{"error":"unauthorized"}'); return
        if self.path.endswith('/payment'):
            pid = str(uuid.uuid4())
            out = {'payment': {'id': pid, 'url': f'https://sandbox.paywall.imoje.pl/pl/payment/{pid}', 'status': 'new'}}
        else:
            out = {'error': 'unknown path'}
        data = json.dumps(out).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        data = json.dumps(LOG[-5:]).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(data)
    def log_message(self, *a): pass
HTTPServer(('0.0.0.0', 8090), H).serve_forever()
