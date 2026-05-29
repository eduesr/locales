import os
import base64
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
creds = Credentials.from_authorized_user_file('token.json', SCOPES)
service = build('gmail', 'v1', credentials=creds)

results = service.users().messages().list(userId='me', q='label:locales fotocasa', maxResults=1).execute()
messages = results.get('messages', [])

for msg in messages:
    msg_full = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
    html_body = ""
    if 'parts' in msg_full['payload']:
        for part in msg_full['payload']['parts']:
            if part['mimeType'] == 'text/html':
                html_body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
    else:
        html_body = base64.urlsafe_b64decode(msg_full['payload']['body']['data']).decode('utf-8')
    with open('fotocasa_email.html', 'w') as f:
        f.write(html_body)
    print("Dumped fotocasa_email.html")
