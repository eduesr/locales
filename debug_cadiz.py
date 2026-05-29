import re
import os
import json
import base64
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import fetch_emails

service = fetch_emails.get_gmail_service()
results = service.users().messages().list(userId='me', q='label:locales', maxResults=10).execute()
messages = results.get('messages', [])

for msg in messages:
    msg_full = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
    headers = msg_full['payload'].get('headers', [])
    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sin Asunto')
    if "Cádiz" in subject:
        print(f"Encontrado: {subject}")
        # Copiar logica de obtencion de body
        body = ""
        html_body = ""
        if 'parts' in msg_full['payload']:
            for part in msg_full['payload']['parts']:
                if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                    body += base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                elif part['mimeType'] == 'text/html' and 'data' in part['body']:
                    html_body += base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
        else:
            data = msg_full['payload']['body'].get('data', '')
            if data:
                mimeType = msg_full['payload'].get('mimeType', 'text/plain')
                if 'html' in mimeType.lower():
                    html_body = base64.urlsafe_b64decode(data).decode('utf-8')
                    body = re.sub(r'<[^>]+>', ' ', html_body)
                else:
                    body = base64.urlsafe_b64decode(data).decode('utf-8')
        if not body:
            body = msg_full.get('snippet', '')
            
        print("Body snippets:", body[:200])
        parsed = fetch_emails.extract_data_from_text(body, html_body, subject, msg['id'])
        print("Parsed data:", parsed)
