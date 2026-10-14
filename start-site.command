#!/bin/zsh

set -e

cd -- "${0:A:h}"

SITE_PORT=8000
SITE_URL="http://localhost:${SITE_PORT}/projects/zavodnoi-apelsin/index.html"

if ! command -v python3 >/dev/null 2>&1; then
  print "Не найден Python 3. Установите Python 3 и запустите файл ещё раз."
  read -r "?Нажмите Enter, чтобы закрыть окно."
  exit 1
fi

print "Сайт запускается: ${SITE_URL}"
print "Чтобы остановить сервер, нажмите Control + C."

exec python3 -c '
import http.server
import errno
import sys
import threading
import webbrowser

port = int(sys.argv[1])
url = sys.argv[2]

try:
    server = http.server.ThreadingHTTPServer(("", port), http.server.SimpleHTTPRequestHandler)
except OSError as error:
    if error.errno == errno.EADDRINUSE:
        print("Сервер уже работает. Открываю страницу в браузере.")
        webbrowser.open(url)
        sys.exit(0)
    raise

threading.Timer(0.8, lambda: webbrowser.open(url)).start()

try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nСервер остановлен.")
finally:
    server.server_close()
' "${SITE_PORT}" "${SITE_URL}"
