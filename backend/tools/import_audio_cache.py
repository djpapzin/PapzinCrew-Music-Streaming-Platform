"""Import exact public source copies using private, one-use Dropbox URLs.

Input: a mode-0600 JSON file of {id, size, file_hash, download_url} records.
The input is removed after reading. URLs are never logged or persisted in cache
metadata. Dropbox is read only; B2 is only HEAD-checked by the seeding tool.
"""
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path
from urllib.parse import urlparse
import requests
from app.services.audio_cache import directory
from tools.seed_audio_cache import main as seed


class ImportCheckError(RuntimeError):
    pass


def main():
    incoming=Path(sys.argv[1])
    if incoming.stat().st_mode & 0o077:
        raise RuntimeError('Import credentials file must be private')
    jobs=json.loads(incoming.read_text());incoming.unlink()
    root=directory();root.mkdir(parents=True,exist_ok=True,mode=0o700)
    for job in jobs:
        ident=int(job['id']);size=int(job['size']);origin=urlparse(job['download_url'])
        if origin.scheme!='https' or not (origin.hostname or '').endswith('.dropboxusercontent.com'):
            raise RuntimeError('Unexpected download host')
        if not 0<size<=500000000 or shutil.disk_usage(root).free-2*size<15000000000:
            raise RuntimeError('Import storage safety limit reached')
        scratch=root/f'.import-{ident}.part'
        try:
            with requests.get(job['download_url'],stream=True,timeout=(10,120),
                              allow_redirects=False,headers={'Accept-Encoding':'identity'}) as response:
                if response.status_code!=200: raise ImportCheckError('source_http_'+str(response.status_code))
                if int(response.headers.get('Content-Length',size))!=size: raise ImportCheckError('source_size_changed')
                sha=hashlib.sha256();received=0
                with scratch.open('wb') as output:
                    os.chmod(scratch,0o600)
                    for chunk in response.iter_content(1048576):
                        received+=len(chunk)
                        if received>size: raise ImportCheckError('source_size_exceeded')
                        sha.update(chunk);output.write(chunk)
                if received!=size or (job.get('file_hash') and sha.hexdigest()!=job['file_hash']):
                    raise ImportCheckError('catalog_hash_mismatch')
            sys.argv=['seed_audio_cache.py','--mix-id',str(ident),'--file',str(scratch)]
            seed()
        except Exception as error:
            # Never log requests exceptions: they can contain the signed URL.
            print(json.dumps({'mix':ident,'import_skipped':True,'reason':str(error) if isinstance(error,ImportCheckError) else type(error).__name__}),flush=True)
        finally:
            scratch.unlink(missing_ok=True)


if __name__=='__main__': main()
