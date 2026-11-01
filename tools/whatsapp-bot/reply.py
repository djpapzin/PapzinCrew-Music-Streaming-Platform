"""One-shot JSON bridge; no DB writes, network access or saved conversations."""
import json
import sys
import os
from app.services.help_assistant import answer_question

request = json.loads(sys.stdin.read(8000))
with open(sys.argv[1], encoding='utf-8') as source:
    catalog = json.load(source)
print(json.dumps(answer_question(request['question'], catalog, downloads_enabled=os.getenv('WA_DOWNLOADS_ENABLED')=='1', uploads_enabled=os.getenv('WA_UPLOADS_ENABLED')=='1')))
