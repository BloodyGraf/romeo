const startBtn = document.getElementById('startBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const logs = document.getElementById('logs');

function log(...args) {
    console.log(...args);
    const span = document.createElement('div');
    span.textContent = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logs.appendChild(span);
    logs.scrollTop = logs.scrollHeight;
}

async function start() {
    try {
        log('1) Requesting camera...');
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        log('2) Got local stream:', localStream);
        localVideo.srcObject = localStream;

        const pc1 = new RTCPeerConnection();
        const pc2 = new RTCPeerConnection();

        pc1.onicecandidate = e => {
            log('pc1 ICE candidate', e.candidate);
            if (e.candidate) pc2.addIceCandidate(e.candidate).catch(err => log('pc2.addIceCandidate error', err));
        };
        pc2.onicecandidate = e => {
            log('pc2 ICE candidate', e.candidate);
            if (e.candidate) pc1.addIceCandidate(e.candidate).catch(err => log('pc1.addIceCandidate error', err));
        };

        pc2.ontrack = e => {
            log('pc2 ontrack, streams:', e.streams);
            remoteVideo.srcObject = e.streams[0];
        };

        localStream.getTracks().forEach(track => {
            log('pc1 adding track', track.kind);
            pc1.addTrack(track, localStream);
        });

        log('3) Creating offer...');
        const offer = await pc1.createOffer();
        log('Offer created:', offer.type);
        await pc1.setLocalDescription(offer);
        log('pc1 setLocalDescription done');

        await pc2.setRemoteDescription(offer);
        log('pc2 setRemoteDescription done');

        log('4) Creating answer...');
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        log('pc2 setLocalDescription done');

        await pc1.setRemoteDescription(answer);
        log('pc1 setRemoteDescription done');

        log('✅ Local loop established');
    } catch (err) {
        log('!!! ERROR:', err);
        console.error(err);
        // Показать диалог если запрещено
        if (err.name === 'NotAllowedError') {
            alert('Доступ к камере запрещён. Разреши камеру в настройках сайта (значок замка рядом с URL).');
        } else if (err.name === 'NotFoundError') {
            alert('Камера не найдена. Подключи камеру или проверь драйверы.');
        } else {
            alert('Ошибка: ' + (err.message || err));
        }
    }
}

startBtn.onclick = start;
log('Page loaded. Click "Start Local Call".');