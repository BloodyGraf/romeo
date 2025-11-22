


LiveKit Server Deployment Guide (Romeo Project)

This document captures the full reproducible path used to deploy a self-hosted LiveKit Server on a Timeweb Cloud VPS for the Romeo project. It includes explanations, comments, and the exact commands used.

⸻

⚙️ 1. Сервер: параметры и доступ

IPv4: 37.252.20.26

SSH:

ssh root@37.252.20.26

(Пароль или SSH-ключ — введите при запросе)

❗ Пароль не рекомендуется хранить в открытом виде. Для прод-окружения — только SSH-ключи.

⸻

⚙️ 2. Подключение и подготовка системы

Обновляем пакеты и ставим инструменты, нужные для установки Docker

apt update
apt install -y ca-certificates curl gnupg

Зачем: Docker распространяется через собственный репозиторий, который требует подписей и сертификатов.

⸻

⚙️ 3. Добавляем официальный Docker репозиторий

Это позволяет ставить свежие версии Docker Engine, Buildx и Docker Compose.

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
gpg --dearmor -o /etc/apt/keyrings/docker.gpg

Добавляем новый репозиторий:

echo \
"deb [arch=$(dpkg --print-architecture) \
signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(lsb_release -cs) stable" \
> /etc/apt/sources.list.d/docker.list

Обновляем индекс пакетов и ставим Docker:

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin


⸻

⚙️ 4. Создаём директорию под LiveKit

mkdir -p /opt/livekit
cd /opt/livekit


⸻

⚙️ 5. Создаём docker-compose.yml

LiveKit будет работать в dev-режиме: это быстрее, проще и не требует ручной настройки ключей.

cat > docker-compose.yml << 'EOF'
services:
livekit:
image: livekit/livekit-server:latest
container_name: livekit
command: >
--dev
--bind 0.0.0.0
--node-ip 0.0.0.0
--port 7880
--rtc.tcp_port 7881
ports:
- "7880:7880"   # HTTP / WebSocket API
- "7881:7881"   # TCP fallback media
- "7882-7999:7882-7999/udp" # UDP media (основные WebRTC потоки)
EOF

Зачем: LiveKit — это WebRTC SFU, которому нужны TCP/UDP порты.

⸻

⚙️ 6. Логинимся в Docker Hub (если сервер ругается на rate-limit)

Если DockerHub режет скачивания по IP (часто на Timeweb), выполняем:

docker login

❗ Вводим логин/пароль DockerHub. Это снимает лимит pull-запросов.

⸻

⚙️ 7. Если всё равно ошибка rate-limit → включаем зеркала

Открываем файл конфигурации:

nano /etc/docker/daemon.json

Вставляем:

{
"registry-mirrors": [
"https://docker.m.daocloud.io",
"https://mirror.baidubce.com",
"https://registry.docker-cn.com"
]
}

Сохраняем (Ctrl+O, Enter, Ctrl+X) и перезапускаем Docker:

systemctl restart docker


⸻

⚙️ 8. Запускаем LiveKit Server

cd /opt/livekit
docker compose up -d

Проверяем статус:

docker logs livekit -f

Ожидаем увидеть примерно такое:

starting in development mode
no keys provided, using placeholder keys {"API Key": "devkey", "API Secret": "secret"}
starting LiveKit server {"portHttp": 7880, "rtc.portTCP": 7881, "rtc.portUDP": {"Start":7882}}

Это значит — сервер поднялся и слушает порты.

⸻

⚙️ 9. Проверяем доступность LiveKit извне

Открываем браузер и заходим на:

http://37.252.20.26:7880

Ожидаемый ответ:

OK

Это означает: LiveKit успешно поднялся и доступен по публичному IP.

⸻

🎉 Готово!

Теперь сервер LiveKit работает в интернете, принимает WebRTC-подключения и готов служить SFU для веб- и мобильных клиентов.

Следующие шаги:
•	настроить HTTPS + домен
•	добавить coturn
•	развернуть token-server
•	тестировать звонки с реальных устройств

🧰 Шаг 1 — ставим coturn

На VPS:
apt install coturn -y

🧰 Шаг 2 — включаем режим standalone TURN

Редактируем конфиг:
nano /etc/turnserver.conf

Вставляем (это минимальная продовая конфигурация):

listening-port=3478
tls-listening-port=5349

listening-ip=0.0.0.0
relay-ip=0.0.0.0

realm=romeo.live
server-name=Romeo-TURN

fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=666blood666

no-loopback-peers
no-multicast-peers
mobility

🧰 Шаг 3 — открываем порты для TURN:

На VPS:
ufw allow 3478/udp
ufw allow 5349/tcp

Шаг 4 — запускаем TURN
systemctl enable coturn
systemctl restart coturn

Проверка:
netstat -tulnp | grep turnserver


🧰 Шаг 5 — Добавляем TURN в LiveKit (dev-режим поддерживает!)

Правим docker-compose.yml:

services:
livekit:
image: livekit/livekit-server:latest
container_name: livekit
command: >
--dev
--bind 0.0.0.0
--node-ip 0.0.0.0
--port 7880
--rtc.tcp_port 7881
--turn.enabled=true
--turn.domain=37.252.20.26
--turn.port=3478
--turn.tls_port=5349
--turn.secret=666blood666
ports:
- "7880:7880"                     # сигналинг
- "7881:7881"                     # fallback TCP media
- "7882-7999:7882-7999/udp"       # WebRTC UDP media
- "3478:3478/udp"                 # TURN UDP
- "5349:5349"                     # TURN TLS
- 
  🎯 ШАГ 1 — создаём файл конфигурации LiveKit
  mkdir -p /opt/livekit/config
  nano /opt/livekit/config/livekit.yaml
- 
  Вставляем:
- log_level: debug

rtc:
tcp_port: 7881
udp_port: 7882
use_external_ip: true

turn:
enabled: true
domain: 37.252.20.26        # твой сервер
udp_port: 3478
tls_port: 5349
secret: "MYSECRET"          # тот же secret, что в turnserver.conf

# используем встроенный API ключ livekit (devkey/devsecret)
# для prod — потом заменим
apikey: "devkey"
apisecret: "secret"

# bind
bind_addresses:
- "0.0.0.0"



ШАГ 2 — меняем docker-compose.yml, чтобы LiveKit читал config.yaml

nano /opt/livekit/docker-compose.yml

services:
livekit:
image: livekit/livekit-server:latest
container_name: livekit
command: >
--config /livekit/config/livekit.yaml
volumes:
- ./config:/livekit/config
ports:
- "7880:7880"
- "7881:7881"
- "7882-7999:7882-7999/udp"
- 
- 
  nano /opt/livekit/config/keys.txt

СБОРКА AMD64 ОБРАЗА ЛОКАЛЬНО НА МАКЕ ЧЕРЕЗ QEMU (docker buildx)
1. Активировать buildx:
   docker buildx create --use

2. Собрать multi-arch образ:
   docker buildx build --platform linux/amd64 -t bloodbear/livekit-server:v1.12 . --push

cd /opt/livekit
docker compose pull
docker compose up -d




nano docker-compose.yml

docker images | grep livekit

docker rmi livekit/livekit-server:latest
docker rmi bloodbear/livekit:v1.12


cd /opt/livekit
docker compose down
docker compose pull
docker compose up -d

cd /opt/livekit-server
