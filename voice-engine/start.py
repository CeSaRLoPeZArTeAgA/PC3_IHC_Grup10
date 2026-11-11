"""Arranque inequívoco de la VUI final en Windows/Linux.

Siempre ejecuta el servidor desde ESTA carpeta (evita abrir por accidente el proyecto viejo).
Elige un puerto libre en 8011-8019 y abre el navegador cuando /api/version responda.
"""
from __future__ import annotations
import argparse
import json
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from version import APP_NAME, BUILD, PORT

ROOT = Path(__file__).resolve().parent

def port_is_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) != 0

def select_port(requested):
    for port in range(requested, requested + 9):
        if port_is_free(port):
            return port
    raise SystemExit(f'No hay puertos disponibles entre {requested} y {requested + 8}. Cierra servidores anteriores.')

def open_when_ready(port):
    address = f'http://127.0.0.1:{port}'
    for _ in range(60):
        try:
            with urllib.request.urlopen(address + '/api/version', timeout=.5) as response:
                data = json.load(response)
            if data.get('build') == BUILD:
                webbrowser.open(address + f'/?v={BUILD}')
                return
        except Exception:
            pass
        time.sleep(.25)
    print('Abre manualmente:', address)

def main():
    parser=argparse.ArgumentParser(description='TriageVoz Rural, versión demostrativa para tarea 2.')
    parser.add_argument('--port',type=int,default=PORT)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    if not (1 <= args.port <= 65525):
        parser.error('Puerto inválido.')
    port=select_port(args.port)
    print('\n'+'='*68)
    print(f'{APP_NAME}  |  VERSIÓN VERIFICABLE: {BUILD}')
    print(f'CARPETA: {ROOT}')
    print(f'ABRE: http://127.0.0.1:{port}/?v={BUILD}')
    if port != args.port:
        print(f'ATENCIÓN: {args.port} estaba ocupado; se eligió {port}.')
    print('Tarea 2 utiliza un puerto propio. No uses los de versiones anteriores.')
    print('Detener: Ctrl + C')
    print('='*68+'\n')
    if not args.no_browser:
        threading.Thread(target=open_when_ready, args=(port,), daemon=True).start()
    import uvicorn
    # Importa explícitamente el servidor de la carpeta de este script, no otro server.py.
    sys.path.insert(0, str(ROOT))
    from server import app
    uvicorn.run(app,host='127.0.0.1',port=port,access_log=False)

if __name__ == '__main__':
    main()
