"""Local-only checks; no Study access, installs, external network, or persistent servers."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import subprocess, shutil, os, urllib.request, sys
ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'.local'
LOCAL.mkdir(exist_ok=True)
flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
def run(command,env=None):
    result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,encoding='utf-8',errors='replace',creationflags=flags,timeout=90)
    if result.returncode: raise RuntimeError(result.stdout+'\n'+result.stderr)
    return result.stdout
runtime=shutil.which('node')
env=os.environ.copy()
if not runtime:
    candidate=Path(os.environ.get('LOCALAPPDATA',''))/'Programs/Microsoft VS Code/Code.exe'
    if not candidate.exists(): raise SystemExit('Node.js 22+ is required for unit tests.')
    runtime=str(candidate);env['ELECTRON_RUN_AS_NODE']='1'
print(run([runtime,str(ROOT/'tests/domain.test.mjs')],env))
print(run([runtime,str(ROOT/'tests/model.test.mjs')],env))
print(run([runtime,str(ROOT/'tests/ai.test.mjs')],env))
print(run([runtime,str(ROOT/'tests/view-state.test.mjs')],env))
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
thread=Thread(target=server.serve_forever,daemon=True);thread.start()
base=f'http://127.0.0.1:{server.server_port}'
try:
    for resource in ['dist/','dist/styles.css','dist/src/app.js','dist/src/domain/demo.js','dist/mark.svg']:
        with urllib.request.urlopen(base+'/'+resource,timeout=5) as response:
            assert response.status==200
    print('PASS static HTTP serving including /dist/ subpath')
    chrome=next((p for p in [Path('C:/Program Files/Google/Chrome/Application/chrome.exe'),Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')] if p.exists()),None)
    if chrome:
        for label,width,height in [('desktop',1440,900),('mobile',390,844)]:
            profile=LOCAL/('browser-'+label)
            common=[runtime,str(ROOT/'scripts/browser-check.mjs'),str(chrome)]
            print(run(common+[base+f'/tests/browser.html?width={width}',str(profile),str(width),str(height),str(LOCAL/('browser-'+label))],env))
            print(run(common+[base+'/tests/restart.html',str(profile),str(width),str(height),str(LOCAL/('restart-'+label))],env))
            print(run(common+[base+'/dist/#demo',str(LOCAL/('preview-'+label)),str(width),str(height),str(LOCAL/label),'preview'],env))
        for label,width,height in [('desktop',1440,900),('mobile',390,844)]:
            print(run(common+[base+'/dist/',str(LOCAL/('capture-'+label)),str(width),str(height),str(LOCAL/'verification'/'v0.0.7.1'/label/'capture'),'capture'],env))
        print(run(common+[base+'/tests/backup-browser.html?mode=export',str(LOCAL/'browser-desktop'),'1440','1000',str(LOCAL/'backup-export'),'export'],env))
        print(run(common+[base+'/tests/backup-browser.html?mode=import',str(LOCAL/'backup-recipient'),'390','844',str(LOCAL/'backup-import')],env))
    else: print('SKIP real browser checks: Chrome/Edge unavailable')
finally:
    server.shutdown();server.server_close();thread.join()
print('Verification complete. Local test server stopped.')
