# -*- coding: utf-8 -*-
"""
Servidor local del juego.

Es el `python -m http.server` de siempre, pero con una diferencia importante:
le dice al navegador que NO guarde copias de los archivos.

Sin esto, cuando se cambia el código el navegador sigue mostrando la versión
vieja que tenía guardada, y hay que acordarse de apretar Ctrl+F5. Así no hace
falta: cada vez que se abre el juego, se baja todo de nuevo.
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PUERTO = 8123


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        # Sin el registro de cada archivo pedido, que llena la ventana de ruido.
        pass


def main():
    # Servir siempre desde la carpeta del juego, sin importar desde dónde se llame.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else PUERTO

    try:
        servidor = ThreadingHTTPServer(("127.0.0.1", puerto), SinCache)
    except OSError as e:
        print()
        print("  No pude usar el puerto %d." % puerto)
        print("  Casi seguro que ya hay otra ventana del servidor abierta.")
        print("  Cerrala y volvé a intentar.")
        print()
        print("  (detalle tecnico: %s)" % e)
        input("  Enter para cerrar...")
        return 1

    print()
    print("  La Estrella de Mar - servidor")
    print("  ----------------------------------------")
    print("  Andando en http://localhost:%d/" % puerto)
    print()
    print("  DEJA ESTA VENTANA ABIERTA mientras jugas.")
    print("  Para apagar el juego, cerra esta ventana.")
    print()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
