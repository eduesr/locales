import re
import os
import json
import base64
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    return build('gmail', 'v1', credentials=creds)

service = get_gmail_service()
results = service.users().messages().list(userId='me', q='label:locales', maxResults=10).execute()
messages = results.get('messages', [])

for msg in messages:
    msg_full = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
    headers = msg_full['payload'].get('headers', [])
    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sin Asunto')
    print(f"\n--- EMAIL: {subject} ---")
    
    parts = msg_full['payload'].get('parts', [])
    text = ""
    for part in parts:
        if part['mimeType'] == 'text/plain':
            text = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
            break
            
    if not text and 'body' in msg_full['payload'] and 'data' in msg_full['payload']['body']:
        text = base64.urlsafe_b64decode(msg_full['payload']['body']['data']).decode('utf-8')
        
    price_match = re.search(r'(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€', text)
    price = 0
    if price_match:
        price = float(price_match.group(1).replace('.', '').replace(',', '.'))
        
    area_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:m2|m²)', text, re.IGNORECASE)
    area = 0
    if area_match:
        area = float(area_match.group(1).replace(',', '.'))
        
    print(f"Price extracted: {price}")
    print(f"Area extracted: {area}")
    if price <= 0 or area <= 0:
        print("-> SKIPPED (No price or area found)")
    else:
        print("-> KEPT")
