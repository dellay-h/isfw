# ISFW local server.
# Serves this folder at http://localhost:8000 with caching off, so edited files
# are always reloaded fresh, and lets the dev screens save their data:
#   GET  /api/ping           -> identifies this server (the dev screens check it)
#   POST /api/enemies?base=  -> overwrites js/enemies.js
#   POST /api/skills?base=   -> overwrites js/skills.js
#   POST /api/shop?base=     -> overwrites js/shop.js
# base is the sha-256 of the file the page last loaded or saved; if the file
# changed since (edited elsewhere), the save is refused with 409 so an old page
# can never overwrite newer data.
import hashlib
import http.server
import json
import os
import socket
import sys
import urllib.parse
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
FILES = {'enemies': 'ENEMIES', 'skills': 'SKILLS', 'shop': 'SHOP'}  # name -> export it must contain
os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def reply(self, code, body=''):
        data = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json' if body.startswith('{') else 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/api/ping':
            self.reply(200, json.dumps({'server': 'isfw', 'version': 3, 'saves': list(FILES)}))
            return
        super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlsplit(self.path)
        base = urllib.parse.parse_qs(url.query).get('base', [''])[0]
        name = url.path[len('/api/'):] if url.path.startswith('/api/') else ''
        if name not in FILES:
            self.reply(404, 'unknown file')
            return
        size = int(self.headers.get('Content-Length') or 0)
        text = self.rfile.read(size).decode('utf-8') if 0 < size < 2_000_000 else ''
        if f'export const {FILES[name]}' not in text:
            self.reply(400, f'not a {name} file')
            return
        target = os.path.join(ROOT, 'js', f'{name}.js')
        try:
            with open(target, 'rb') as f:
                current = hashlib.sha256(f.read()).hexdigest()
        except OSError:
            current = ''
        if base != current:
            self.reply(409, f'js/{name}.js changed on disk since the page loaded it')
            print(f'refused an outdated save of js/{name}.js (reload the page)')
            return
        tmp = target + '.tmp'
        try:
            with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
                f.write(text)
            os.replace(tmp, target)
        except OSError as err:
            self.reply(500, f'could not write js/{name}.js: {err}')
            return
        print(f'saved js/{name}.js')
        self.reply(200, '{"ok": true}')

    def log_message(self, fmt, *args):
        pass  # keep the window quiet


class Server(http.server.ThreadingHTTPServer):
    # Python's default (SO_REUSEADDR) lets a second server share the port on
    # Windows, so requests could reach an older server that cannot save.
    # Claim the port exclusively instead, and fail loudly if it is taken.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


try:
    server = Server(('localhost', PORT), Handler)
except OSError:
    print(f'Port {PORT} is already in use, probably by another ISFW server window.')
    print('Close the other server window (or the program using that port) and run start.bat again.')
    input('Press Enter to close.')
    sys.exit(1)

url = f'http://localhost:{PORT}/'
print(f'ISFW running at {url}  (close this window to stop it)')
webbrowser.open(url)
server.serve_forever()
