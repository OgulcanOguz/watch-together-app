let socket;
let currentRoom = '';
let currentUsername = '';
let videoPlayer;
let youtubePlayer;
let vimeoPlayer;
let isUpdatingFromRemote = false;
let currentVideoType = null;

// WebRTC değişkenleri
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let screenStream = null;
let isScreenSharing = false;
let isMuted = false;
let isVideoOn = false;

// ICE sunucuları (STUN)
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// YouTube API yükleme
let youtubeAPIReady = false;
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// Vimeo API yükleme
const vimeoTag = document.createElement('script');
vimeoTag.src = "https://player.vimeo.com/api/player.js";
document.head.appendChild(vimeoTag);

function onYouTubeIframeAPIReady() {
    youtubeAPIReady = true;
}

function joinRoom() {
    const username = document.getElementById('usernameInput').value.trim();
    const roomId = document.getElementById('roomIdInput').value.trim();

    if (!username || !roomId) {
        alert('Lütfen adınızı ve oda kodunu girin!');
        return;
    }

    currentUsername = username;
    currentRoom = roomId;
    socket = io();
    socket.emit('join-room', { roomId, username });

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').classList.add('active');
    document.getElementById('currentRoom').textContent = roomId;

    setupSocketListeners();
    setupVideoPlayer();
    setupWebRTC();
}

function setupSocketListeners() {
    socket.on('user-joined', (data) => {
        addSystemMessage(`${data.username} odaya katıldı 👋`);
        updateUsersList(data.users);
        
        if (data.videoUrl) {
            loadRemoteVideo(data.videoUrl, data.currentTime, data.isPlaying, data.videoType);
        }

        // İkinci kullanıcı katıldığında WebRTC bağlantısı başlat
        if (data.users.length === 2) {
            // İlk katılan kişi offer gönderir
            if (data.users[0].username === currentUsername) {
                setTimeout(() => createOffer(), 1000);
            }
        }
    });

    socket.on('user-left', (data) => {
        addSystemMessage(`${data.username} odadan ayrıldı`);
        updateUsersList(data.users);
        closeWebRTCConnection();
    });

    socket.on('video-updated', (data) => {
        loadRemoteVideo(data.videoUrl, 0, false, data.videoType);
    });

    socket.on('play', (data) => {
        if (isUpdatingFromRemote) return;
        isUpdatingFromRemote = true;
        
        if (currentVideoType === 'youtube' && youtubePlayer) {
            youtubePlayer.seekTo(data.currentTime, true);
            youtubePlayer.playVideo();
        } else if (currentVideoType === 'vimeo' && vimeoPlayer) {
            vimeoPlayer.setCurrentTime(data.currentTime).then(() => {
                vimeoPlayer.play();
            });
        } else if (currentVideoType === 'html5' && videoPlayer) {
            videoPlayer.currentTime = data.currentTime;
            videoPlayer.play();
        }
        
        setTimeout(() => { isUpdatingFromRemote = false; }, 500);
    });

    socket.on('pause', (data) => {
        if (isUpdatingFromRemote) return;
        isUpdatingFromRemote = true;
        
        if (currentVideoType === 'youtube' && youtubePlayer) {
            youtubePlayer.seekTo(data.currentTime, true);
            youtubePlayer.pauseVideo();
        } else if (currentVideoType === 'vimeo' && vimeoPlayer) {
            vimeoPlayer.setCurrentTime(data.currentTime).then(() => {
                vimeoPlayer.pause();
            });
        } else if (currentVideoType === 'html5' && videoPlayer) {
            videoPlayer.currentTime = data.currentTime;
            videoPlayer.pause();
        }
        
        setTimeout(() => { isUpdatingFromRemote = false; }, 500);
    });

    socket.on('seek', (data) => {
        if (isUpdatingFromRemote) return;
        isUpdatingFromRemote = true;
        
        if (currentVideoType === 'youtube' && youtubePlayer) {
            youtubePlayer.seekTo(data.currentTime, true);
        } else if (currentVideoType === 'vimeo' && vimeoPlayer) {
            vimeoPlayer.setCurrentTime(data.currentTime);
        } else if (currentVideoType === 'html5' && videoPlayer) {
            videoPlayer.currentTime = data.currentTime;
        }
        
        setTimeout(() => { isUpdatingFromRemote = false; }, 500);
    });

    socket.on('chat-message', (data) => {
        addChatMessage(data.username, data.message, data.timestamp);
    });

    // WebRTC sinyal mesajları
    socket.on('webrtc-offer', async (offer) => {
        await handleOffer(offer);
    });

    socket.on('webrtc-answer', async (answer) => {
        await handleAnswer(answer);
    });

    socket.on('webrtc-ice-candidate', async (candidate) => {
        await handleIceCandidate(candidate);
    });

    socket.on('sync-request', (data) => {
        showSyncNotification(data.username);
    });
}

// ==================== WebRTC Fonksiyonları ====================

function setupWebRTC() {
    // Başlangıçta ses akışını al (mikrofon)
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            localStream = stream;
            // Başlangıçta sessiz
            stream.getAudioTracks().forEach(track => track.enabled = false);
            isMuted = true;
            updateMicButton();
        })
        .catch(err => {
            console.error('Mikrofon erişimi hatası:', err);
            addSystemMessage('⚠️ Mikrofon erişimi reddedildi');
        });
}

async function createOffer() {
    try {
        peerConnection = new RTCPeerConnection(iceServers);
        setupPeerConnectionListeners();

        // Yerel akışı ekle
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('webrtc-offer', { roomId: currentRoom, offer });
        addSystemMessage('📡 Bağlantı kuruluyor...');
    } catch (err) {
        console.error('Offer oluşturma hatası:', err);
    }
}

async function handleOffer(offer) {
    try {
        peerConnection = new RTCPeerConnection(iceServers);
        setupPeerConnectionListeners();

        // Yerel akışı ekle
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', { roomId: currentRoom, answer });
    } catch (err) {
        console.error('Offer işleme hatası:', err);
    }
}

async function handleAnswer(answer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        addSystemMessage('✅ Bağlantı kuruldu!');
    } catch (err) {
        console.error('Answer işleme hatası:', err);
    }
}

async function handleIceCandidate(candidate) {
    try {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (err) {
        console.error('ICE candidate hatası:', err);
    }
}

function setupPeerConnectionListeners() {
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc-ice-candidate', { 
                roomId: currentRoom, 
                candidate: event.candidate 
            });
        }
    };

    peerConnection.ontrack = (event) => {
        if (!remoteStream) {
            remoteStream = new MediaStream();
            const remoteVideo = document.getElementById('remoteVideo');
            const remoteAudio = document.getElementById('remoteAudio');
            
            remoteVideo.srcObject = remoteStream;
            remoteAudio.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
        
        // Ekran paylaşımı mı ses mi kontrol et
        if (event.track.kind === 'video') {
            document.getElementById('remoteVideoContainer').style.display = 'block';
            addSystemMessage('📺 Ekran paylaşımı başladı');
        }
    };

    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === 'connected') {
            addSystemMessage('✅ WebRTC bağlantısı aktif');
        } else if (state === 'disconnected' || state === 'failed') {
            addSystemMessage('❌ Bağlantı koptu');
            closeWebRTCConnection();
        }
    };
}

async function toggleScreenShare() {
    if (isScreenSharing) {
        // Ekran paylaşımını durdur
        stopScreenShare();
    } else {
        // Ekran paylaşımını başlat
        await startScreenShare();
    }
}

async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                cursor: "always",
                displaySurface: "monitor"
            },
            audio: false
        });

        // Ekran akışını peer connection'a ekle
        if (peerConnection) {
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
            
            if (sender) {
                sender.replaceTrack(videoTrack);
            } else {
                peerConnection.addTrack(videoTrack, screenStream);
            }

            // Kullanıcı paylaşımı durdurduğunda
            videoTrack.onended = () => {
                stopScreenShare();
            };
        }

        isScreenSharing = true;
        updateScreenShareButton();
        addSystemMessage('📺 Ekran paylaşımı başlatıldı');
    } catch (err) {
        console.error('Ekran paylaşımı hatası:', err);
        addSystemMessage('⚠️ Ekran paylaşımı başlatılamadı');
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    // Peer connection'dan video track'i kaldır
    if (peerConnection) {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
            sender.replaceTrack(null);
        }
    }

    isScreenSharing = false;
    updateScreenShareButton();
    document.getElementById('remoteVideoContainer').style.display = 'none';
    addSystemMessage('📺 Ekran paylaşımı durduruldu');
}

function toggleMicrophone() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        isMuted = !audioTracks[0].enabled;
        updateMicButton();
        addSystemMessage(isMuted ? '🔇 Mikrofon kapatıldı' : '🎤 Mikrofon açıldı');
    }
}

async function toggleCamera() {
    if (isVideoOn) {
        // Kamerayı kapat
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.stop();
                localStream.removeTrack(track);
            });
        }
        isVideoOn = false;
        updateCameraButton();
        addSystemMessage('📷 Kamera kapatıldı');
    } else {
        // Kamerayı aç
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const videoTrack = videoStream.getVideoTracks()[0];
            
            if (localStream) {
                localStream.addTrack(videoTrack);
            }

            if (peerConnection) {
                peerConnection.addTrack(videoTrack, localStream);
            }

            isVideoOn = true;
            updateCameraButton();
            addSystemMessage('📷 Kamera açıldı');
        } catch (err) {
            console.error('Kamera erişim hatası:', err);
            addSystemMessage('⚠️ Kamera açılamadı');
        }
    }
}

function closeWebRTCConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    if (remoteStream) {
        remoteStream = null;
    }
    document.getElementById('remoteVideoContainer').style.display = 'none';
}

function updateScreenShareButton() {
    const btn = document.getElementById('screenShareBtn');
    if (btn) {
        btn.textContent = isScreenSharing ? '⏹️ Paylaşımı Durdur' : '📺 Ekran Paylaş';
        btn.classList.toggle('active', isScreenSharing);
    }
}

function updateMicButton() {
    const btn = document.getElementById('micBtn');
    if (btn) {
        btn.textContent = isMuted ? '🔇 Mikrofon Kapalı' : '🎤 Mikrofon Açık';
        btn.classList.toggle('active', !isMuted);
    }
}

function updateCameraButton() {
    const btn = document.getElementById('cameraBtn');
    if (btn) {
        btn.textContent = isVideoOn ? '📷 Kamera Açık' : '📷 Kamera Kapalı';
        btn.classList.toggle('active', isVideoOn);
    }
}

// Senkronizasyon fonksiyonları
function requestSync() {
    socket.emit('sync-request', { roomId: currentRoom, username: currentUsername });
    startCountdown();
}

function startCountdown() {
    let count = 3;
    const interval = setInterval(() => {
        if (count > 0) {
            addSystemMessage(`⏱️ ${count}...`);
            count--;
        } else {
            addSystemMessage('▶️ BAŞLA!');
            clearInterval(interval);
        }
    }, 1000);
}

function showSyncNotification(username) {
    addSystemMessage(`⏱️ ${username} senkronizasyon başlatıyor...`);
    startCountdown();
}

// ==================== Video Player Fonksiyonları ====================

function setupVideoPlayer() {
    videoPlayer = document.getElementById('videoPlayer');

    videoPlayer.addEventListener('play', () => {
        if (!isUpdatingFromRemote && currentVideoType === 'html5') {
            socket.emit('play', { roomId: currentRoom, currentTime: videoPlayer.currentTime });
        }
    });

    videoPlayer.addEventListener('pause', () => {
        if (!isUpdatingFromRemote && currentVideoType === 'html5') {
            socket.emit('pause', { roomId: currentRoom, currentTime: videoPlayer.currentTime });
        }
    });

    videoPlayer.addEventListener('seeked', () => {
        if (!isUpdatingFromRemote && currentVideoType === 'html5') {
            socket.emit('seek', { roomId: currentRoom, currentTime: videoPlayer.currentTime });
        }
    });
}

function detectVideoType(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return 'youtube';
    } else if (url.includes('vimeo.com')) {
        return 'vimeo';
    } else {
        return 'html5';
    }
}

function extractYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function extractVimeoID(url) {
    const regExp = /vimeo.*\/(\d+)/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

function loadVideo() {
    const videoUrl = document.getElementById('videoUrlInput').value.trim();
    
    if (!videoUrl) {
        alert('Lütfen bir video URL\'si girin!');
        return;
    }

    const videoType = detectVideoType(videoUrl);
    currentVideoType = videoType;

    clearCurrentVideo();

    if (videoType === 'youtube') {
        loadYouTubeVideo(videoUrl);
    } else if (videoType === 'vimeo') {
        loadVimeoVideo(videoUrl);
    } else {
        loadHTML5Video(videoUrl);
    }

    socket.emit('update-video', { roomId: currentRoom, videoUrl, videoType });
    addSystemMessage(`Video yüklendi (${videoType.toUpperCase()})`);
}

function loadRemoteVideo(videoUrl, currentTime, isPlaying, videoType) {
    currentVideoType = videoType || detectVideoType(videoUrl);
    
    clearCurrentVideo();

    if (currentVideoType === 'youtube') {
        loadYouTubeVideo(videoUrl, currentTime, isPlaying);
    } else if (currentVideoType === 'vimeo') {
        loadVimeoVideo(videoUrl, currentTime, isPlaying);
    } else {
        loadHTML5Video(videoUrl, currentTime, isPlaying);
    }
}

function clearCurrentVideo() {
    if (videoPlayer) {
        videoPlayer.style.display = 'none';
        videoPlayer.pause();
        videoPlayer.src = '';
    }

    const ytContainer = document.getElementById('youtubePlayer');
    if (ytContainer) {
        ytContainer.remove();
    }
    youtubePlayer = null;

    const vimeoContainer = document.getElementById('vimeoPlayer');
    if (vimeoContainer) {
        vimeoContainer.remove();
    }
    vimeoPlayer = null;

    document.getElementById('placeholder').style.display = 'none';
}

function loadYouTubeVideo(url, startTime = 0, autoplay = false) {
    const videoId = extractYouTubeID(url);
    if (!videoId) {
        alert('Geçersiz YouTube URL!');
        return;
    }

    const playerDiv = document.getElementById('youtubePlayer') || createPlayerDiv('youtubePlayer');
    
    const loadPlayer = () => {
        youtubePlayer = new YT.Player('youtubePlayer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': autoplay ? 1 : 0,
                'start': Math.floor(startTime),
                'controls': 1,
                'rel': 0,
                'modestbranding': 1
            },
            events: {
                'onStateChange': onYouTubePlayerStateChange
            }
        });
    };

    if (youtubeAPIReady) {
        loadPlayer();
    } else {
        setTimeout(() => loadPlayer(), 1000);
    }
}

function onYouTubePlayerStateChange(event) {
    if (isUpdatingFromRemote) return;

    const state = event.data;
    const currentTime = youtubePlayer.getCurrentTime();

    if (state === 1) {
        socket.emit('play', { roomId: currentRoom, currentTime });
    } else if (state === 2) {
        socket.emit('pause', { roomId: currentRoom, currentTime });
    }
}

function loadVimeoVideo(url, startTime = 0, autoplay = false) {
    const videoId = extractVimeoID(url);
    if (!videoId) {
        alert('Geçersiz Vimeo URL!');
        return;
    }

    const playerDiv = document.getElementById('vimeoPlayer') || createPlayerDiv('vimeoPlayer');
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.vimeo.com/video/${videoId}`;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; fullscreen';
    iframe.allowFullscreen = true;
    
    playerDiv.appendChild(iframe);

    setTimeout(() => {
        vimeoPlayer = new Vimeo.Player(iframe);
        
        if (startTime > 0) {
            vimeoPlayer.setCurrentTime(startTime);
        }
        
        if (autoplay) {
            vimeoPlayer.play();
        }

        vimeoPlayer.on('play', () => {
            if (!isUpdatingFromRemote) {
                vimeoPlayer.getCurrentTime().then((time) => {
                    socket.emit('play', { roomId: currentRoom, currentTime: time });
                });
            }
        });

        vimeoPlayer.on('pause', () => {
            if (!isUpdatingFromRemote) {
                vimeoPlayer.getCurrentTime().then((time) => {
                    socket.emit('pause', { roomId: currentRoom, currentTime: time });
                });
            }
        });

        vimeoPlayer.on('seeked', () => {
            if (!isUpdatingFromRemote) {
                vimeoPlayer.getCurrentTime().then((time) => {
                    socket.emit('seek', { roomId: currentRoom, currentTime: time });
                });
            }
        });
    }, 500);
}

function loadHTML5Video(url, startTime = 0, autoplay = false) {
    videoPlayer.src = url;
    videoPlayer.style.display = 'block';
    videoPlayer.currentTime = startTime;
    
    if (autoplay) {
        videoPlayer.play();
    }
}

function createPlayerDiv(id) {
    const container = document.querySelector('.video-player');
    const div = document.createElement('div');
    div.id = id;
    div.style.width = '100%';
    div.style.height = '100%';
    container.appendChild(div);
    return div;
}

// ==================== UI Fonksiyonları ====================

function updateUsersList(users) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = `Katılımcılar (${users.length}): ${users.map(u => u.username).join(', ')}`;
}

function addSystemMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addChatMessage(username, message, timestamp) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    const isOwnMessage = username === currentUsername;
    
    messageDiv.innerHTML = `
        <div class="username">${username}${isOwnMessage ? ' (Siz)' : ''}</div>
        <div class="text">${escapeHtml(message)}</div>
        <div class="timestamp">${timestamp}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    socket.emit('chat-message', { roomId: currentRoom, message });
    messageInput.value = '';
}

function handleMessageKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('beforeunload', (e) => {
    if (socket && socket.connected) {
        closeWebRTCConnection();
        e.preventDefault();
        e.returnValue = '';
    }
});
