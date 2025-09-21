# Configuración para tracking multitenant
# Acepta ilove.hollytrack.com y CUALQUIER dominio personalizado

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_TRACK} _;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # Acepta ${DOMAIN_TRACK} y CUALQUIER dominio personalizado
    server_name ${DOMAIN_TRACK} _;

    # SSL - Usa certificado de Let's Encrypt compartido (${DOMAIN_APP})
    ssl_certificate /etc/letsencrypt/live/${DOMAIN_APP}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_APP}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers off;

    # Logging
    access_log /var/log/nginx/tracking-access.log;
    error_log /var/log/nginx/tracking-error.log;

    # Ruta para el script de tracking - DIRECTO sin /api/tracking
    location = /snip.js {
        proxy_pass http://localhost:3002/api/tracking/snip.js;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Original-Host $host;

        # NO agregar headers CORS aquí - Node.js los maneja
        # Solo agregar Cache-Control
        add_header Cache-Control "no-cache, must-revalidate" always;
    }

    # Ruta para collect - DIRECTO sin /api/tracking
    location = /collect {
        # NO manejar OPTIONS aquí - dejar que Node.js lo haga
        proxy_pass http://localhost:3002/api/tracking/collect;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Original-Host $host;

        # NO agregar headers CORS aquí - Node.js los maneja
    }

    # PROHIBIDO: Solo tracking - no frontend
    # Cualquier otra ruta redirige a la app principal (usando variable)
    location / {
        return 301 https://${DOMAIN_APP}$request_uri;
    }
}