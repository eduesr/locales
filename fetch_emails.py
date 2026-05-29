import os.path
import base64
import re
import json
from datetime import datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Permisos necesarios para leer Gmail
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    """Autentica y devuelve el servicio de la API de Gmail."""
    creds = None
    # El archivo token.json guarda los tokens de acceso y actualización de usuario.
    # Se crea automáticamente la primera vez que se completa la autorización.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # Si no hay credenciales (o no son válidas), el usuario debe iniciar sesión.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Guarda las credenciales para la próxima vez
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)

def extract_data_from_text(text, html_text, subject, msg_id):
    """Extrae información clave del texto del correo (precio, m2, url)."""
    
    # Extraer precio (ej. 150.000 € o 150000€)
    price_match = re.search(r'(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€', text)
    price = 0
    if price_match:
        price_str = price_match.group(1).replace('.', '').replace(',', '.')
        price = float(price_str)
        
    # Extraer metros cuadrados (ej. 150 m2, 150m2, 150 m²)
    area_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:m2|m²)', text, re.IGNORECASE)
    area = 0
    if area_match:
        area_str = area_match.group(1).replace(',', '.')
        area = float(area_str)
    
    # Extraer URL (busca un http o https de Idealista o Fotocasa)
    url_match = None
    # 1. Buscamos enlaces específicos de detalle de anuncio (inmueble, comprar, locales)
    if html_text:
        url_match = re.search(r'href=[\'"](https?://(?:www\.)?(?:idealista\.com|fotocasa\.es|milanuncios\.com)/(?:inmueble|es/comprar|locales-comerciales|venta-locales)[^\'"]+)[\'"]', html_text)
    
    if not url_match:
        url_match = re.search(r'(https?://(?:www\.)?(?:idealista\.com|fotocasa\.es|milanuncios\.com)/(?:inmueble|es/comprar|locales-comerciales|venta-locales)[^\s"\'<>]+)', text)
        
    # 2. Si no hay suerte, buscamos cualquier enlace de esos portales que NO sea el logo
    if not url_match and html_text:
        urls = re.findall(r'href=[\'"](https?://(?:www\.)?(?:idealista\.com|fotocasa\.es|milanuncios\.com)[^\'"]+)[\'"]', html_text)
        for u in urls:
            if 'utm_link=logo' not in u and 'tus-alertas' not in u and 'contacto' not in u:
                url_match = re.match(r'(.*)', u) # Creamos un falso match para aprovechar la estructura
                break
                
    url = url_match.group(1) if url_match else f"https://mail.google.com/mail/u/0/#inbox/{msg_id}"
    
    # Limpiamos saltos de línea extraños, URLs y basura de Fotocasa
    clean_text = re.sub(r'\s+', ' ', text).strip()
    clean_text = re.sub(r'https?://[^\s)]+', '', clean_text) # Quita URLs
    clean_text = clean_text.replace('%open-track%', '').replace('Fotocasa ( )', '').replace('( )', '').replace('()', '')
    clean_text = re.sub(r'\s+', ' ', clean_text).strip() # Limpia espacios dobles dejados por los reemplazos
    
    description = clean_text[:150] + "..." if len(clean_text) > 150 else clean_text
    
    # Extraer ciudad y región
    regions_mapping = {
        "Vigo": ["Vigo", "Bueu", "Pontevedra", "Cangas", "Moaña", "Redondela", "Porriño", "Nigrán", "Baiona", "Marín"],
        "Santiago": ["Santiago de Compostela", "Ames", "Teo", "Milladoiro", "Sigueiro"]
    }
    
    location = "Otras zonas"
    region = "Vigo" # Por defecto
    
    for r_name, cities in regions_mapping.items():
        for city in cities:
            if city.lower() in subject.lower() or city.lower() in clean_text.lower():
                location = city
                region = r_name
                break
        if location != "Otras zonas":
            break
            
    # Extraer imagen (buscamos la primera imagen que no parezca un logo o pixel de tracking)
    image_url = None
    if html_text:
        img_urls = re.findall(r'<img[^>]+src=[\'"]?(https?://[^\'" >\s]+)[\'"]?', html_text)
        for img in img_urls:
            img_lower = img.lower()
            if not any(x in img_lower for x in ['logo', 'pixel', 'icon', 'tracker', 'blank', 'spacer', 'transparent', 'sgt.fotocasa', 'wf/open', 'cataas', 'statics', 'badge', 'belt', 'qr', 'csat']):
                image_url = img
                break
                
    return {
        "id": msg_id,
        "title": subject,
        "price": price,
        "currency": "€",
        "area_m2": area,
        "region": region,
        "location": location,
        "description": description,
        "url": url,
        "image_url": image_url,
        "date": datetime.now().isoformat() + "Z"
    }

def main():
    print("Conectando con Gmail...")
    service = get_gmail_service()
    
    # Buscamos los mensajes con la etiqueta locales
    query = "label:locales"
    print(f"Buscando correos con la query: '{query}'...")
    
    results = service.users().messages().list(userId='me', q=query, maxResults=50).execute()
    messages = results.get('messages', [])

    if not messages:
        print("No se encontraron correos con la etiqueta 'locales'.")
        return

    print(f"Se encontraron {len(messages)} correos. Procesando...")
    
    locales_data = []

    for msg in messages:
        # Obtenemos el correo completo
        msg_full = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
        
        # Obtenemos el asunto y la fecha
        headers = msg_full['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), "Sin asunto")
        
        # Obtenemos el cuerpo del correo (puede estar en multipart)
        body = ""
        html_body = ""
        if 'parts' in msg_full['payload']:
            for part in msg_full['payload']['parts']:
                if part['mimeType'] == 'text/plain':
                    if 'data' in part['body']:
                        data = part['body']['data']
                        body += base64.urlsafe_b64decode(data).decode('utf-8')
                elif part['mimeType'] == 'text/html':
                    if 'data' in part['body']:
                        data = part['body']['data']
                        html_body += base64.urlsafe_b64decode(data).decode('utf-8')
        else:
            if 'data' in msg_full['payload']['body']:
                data = msg_full['payload']['body']['data']
                mimeType = msg_full['payload'].get('mimeType', 'text/plain')
                if 'html' in mimeType.lower():
                    html_body = base64.urlsafe_b64decode(data).decode('utf-8')
                    body = re.sub(r'<[^>]+>', ' ', html_body) # fallback texto
                else:
                    body = base64.urlsafe_b64decode(data).decode('utf-8')
                
        # Si no conseguimos cuerpo de texto, usamos el snippet
        if not body:
            body = msg_full.get('snippet', '')
            
        # Extraemos los datos
        data = extract_data_from_text(body, html_body, subject, msg['id'])
        
        # Filtramos correos que no parezcan ofertas reales (ej. sin precio, sin área, o correos de bienvenida)
        is_welcome_email = any(word in subject.lower() for word in ['welcome', 'bienvenido', 'suscripción'])
        if data['price'] > 0 and data['area_m2'] > 0 and not is_welcome_email:
            locales_data.append(data)

    # Guardamos los resultados en data.json
    output_file = 'data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(locales_data, f, ensure_ascii=False, indent=2)
        
    print(f"\n¡Éxito! Se han extraído {len(locales_data)} ofertas y se han guardado en {output_file}.")
    print("Puedes refrescar la página web para ver los resultados actualizados.")

if __name__ == '__main__':
    main()
