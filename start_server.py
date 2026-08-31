import os
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading


class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


def start_server():
    os.chdir('dashboard')
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, CustomHandler)
    print('Starting HTTP server on port 8000...')
    print('Open: http://localhost:8000/simulation.html')
    httpd.serve_forever()


if __name__ == '__main__':
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    webbrowser.open('http://localhost:8000/simulation.html')
    try:
        while True:
            server_thread.join(1)
    except KeyboardInterrupt:
        print('Shutting down server...')
