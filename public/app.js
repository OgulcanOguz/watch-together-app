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
let isMuted = true;
let isVideoOn = false;
let micGainNode = null;
let audioContext = null;
let isInitiator = false;

// ICE sunucuları - daha fazla STUN server
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
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

async function joinRoom() {
    const username = document.getElementById('usernameInput').value.trim();
    const roomId = document.getElementById('roomIdInput').value.trim();

    if (!username || !roomId) {
        alert('Lütfen adınızı ve oda kodunu girin!');
        return;
    }

    currentUsername = username;
    currentRoom = roomId;
    socket = io();
    
    console.log('🔌 Socket.io bağlanıyor...');
    
    socket.emit('join-room', { roomId, username });

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').classList.add('active');
    document.getElementById('currentRoom').textContent = roomId;

    setupSocketListeners();
    setupVideoPlayer();
    await setupWebRTC();
}

function setupSocketListeners() {
    socket.on('user-joined', (data) => {
        console.log('👤 Kullanıcı katıldı:', data);
        addSystemMessage(`${data.username} odaya katıldı 🐱`);
        updateUsersList(data.users);
        
        if (data.videoUrl) {
            loadRemoteVideo(data.videoUrl, data.currentTime, data.isPlaying, data.videoType);
        }

        // İlk kullanıcı = initiator
        if (data.users.length === 2) {
            if (data.users[0].username === currentUsername) {
                isInitiator = true;
                console.log('🎬 Ben initiator\'üm, 3 saniye sonra offer göndereceğim');
                setTimeout(() => {
                    console.log('📤 Offer oluşturuluyor...');
                    createOffer();
                }, 3000);
            } else {
                isInitiator = false;
                console.log('👂 Ben receiver\'üm, offer bekliyorum');
            }
        }
    });

    socket.on('user-left', (data) => {
        console.log('👋 Kullanıcı ayrıldı:', data.username);
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
    socket.on('webrtc-offer', async (data) => {
        console.log('📥 OFFER ALINDI:', data.offer.type);
        await handleOffer(data.offer);
    });

    socket.on('webrtc-answer', async (data) => {
        console.log('📥 ANSWER ALINDI:', data.answer.type);
        await handleAnswer(data.answer);
    });

    socket.on('webrtc-ice-candidate', async (data) => {
        console.log('🧊 ICE CANDIDATE ALINDI:', data.candidate.candidate);
        await handleIceCandidate(data.candidate);
    });

    socket.on('sync-request', (data) => {
        showSyncNotification(data.username);
    });

    // Socket bağlantı durumu
    socket.on('connect', () => {
        console.log('✅ Socket.io bağlandı');
    });

    socket.on('disconnect', () => {
        console.log('❌ Socket.io bağlantısı koptu');
    });
}

// ==================== WebRTC Fonksiyonları ====================

async function setupWebRTC() {
    try {
        console.log('🎤 Mikrofon erişimi isteniyor...');
        
        // Ses akışını al
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false
            }, 
            video: false 
        });
        
        console.log('✅ Mikrofon erişimi sağlandı');
        console.log('🎵 Audio tracks:', localStream.getAudioTracks().length);
        
        // Audio context ve gain node oluştur
        setupAudioGain();
        
        // Başlangıçta sessiz
        localStream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
        
        isMuted = true;
        updateMicButton();
        addSystemMessage('🎤 Mikrofon hazır');
    } catch (err) {
        console.error('❌ Mikrofon erişim hatası:', err);
        addSystemMessage('⚠️ Mikrofon erişimi reddedildi');
    }
}

function setupAudioGain() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(localStream);
        micGainNode = audioContext.createGain();
        
        micGainNode.gain.value = 1.0;
        source.connect(micGainNode);
        
        const destination = audioContext.createMediaStreamDestination();
        micGainNode.connect(destination);
        
        const oldAudioTrack = localStream.getAudioTracks()[0];
        localStream.removeTrack(oldAudioTrack);
        destination.stream.getAudioTracks().forEach(track => {
            localStream.addTrack(track);
        });
        
        console.log('✅ Mikrofon gain ayarlandı');
    } catch (err) {
        console.error('❌ Gain setup hatası:', err);
    }
}

function changeMicGain(value) {
    const gain = value / 100;
    if (micGainNode) {
        micGainNode.gain.value = gain;
        console.log(`🎚️ Mikrofon seviyesi: ${value}%`);
    }
    document.getElementById('micGainValue').textContent = value;
}

async function createOffer() {
    try {
        console.log('═══════════════════════════════');
        console.log('📤 OFFER OLUŞTURULUYOR...');
        console.log('═══════════════════════════════');
        
        peerConnection = new RTCPeerConnection(iceServers);
        console.log('✅ PeerConnection oluşturuldu');
        
        setupPeerConnectionListeners();

        // Yerel ses akışını ekle
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log('➕ LOCAL TRACK EKLENIYOR:');
                console.log('   - Kind:', track.kind);
                console.log('   - ID:', track.id);
                console.log('   - Label:', track.label);
                console.log('   - Enabled:', track.enabled);
                peerConnection.addTrack(track, localStream);
            });
        }

        console.log('📋 Offer oluşturuluyor...');
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        
        console.log('📋 Local description ayarlanıyor...');
        await peerConnection.setLocalDescription(offer);
        
        console.log('✅ Offer hazır, gönderiliyor...');
        console.log('   - Type:', offer.type);
        console.log('   - SDP uzunluğu:', offer.sdp.length);
        
        socket.emit('webrtc-offer', { roomId: currentRoom, offer });
        
        console.log('✅ OFFER GÖNDERİLDİ');
        console.log('═══════════════════════════════');
        addSystemMessage('📡 Bağlanıyor...');
    } catch (err) {
        console.error('❌ OFFER HATASI:', err);
        addSystemMessage('❌ Bağlantı hatası');
    }
}

async function handleOffer(offer) {
    try {
        console.log('═══════════════════════════════');
        console.log('📥 OFFER İŞLENİYOR...');
        console.log('═══════════════════════════════');
        
        peerConnection = new RTCPeerConnection(iceServers);
        console.log('✅ PeerConnection oluşturuldu');
        
        setupPeerConnectionListeners();

        // Yerel ses akışını ekle
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log('➕ LOCAL TRACK EKLENIYOR:');
                console.log('   - Kind:', track.kind);
                console.log('   - ID:', track.id);
                console.log('   - Label:', track.label);
                peerConnection.addTrack(track, localStream);
            });
        }

        console.log('📋 Remote description ayarlanıyor...');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        console.log('📋 Answer oluşturuluyor...');
        const answer = await peerConnection.createAnswer();
        
        console.log('📋 Local description ayarlanıyor...');
        await peerConnection.setLocalDescription(answer);
        
        console.log('✅ Answer hazır, gönderiliyor...');
        socket.emit('webrtc-answer', { roomId: currentRoom, answer });
        
        console.log('✅ ANSWER GÖNDERİLDİ');
        console.log('═══════════════════════════════');
    } catch (err) {
        console.error('❌ OFFER İŞLEME HATASI:', err);
    }
}

async function handleAnswer(answer) {
    try {
        console.log('═══════════════════════════════');
        console.log('📥 ANSWER İŞLENİYOR...');
        console.log('═══════════════════════════════');
        
        console.log('📋 Remote description ayarlanıyor...');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        
        console.log('✅ ANSWER İŞLENDİ - BAĞLANTI KURULDU!');
        console.log('═══════════════════════════════');
        addSystemMessage('✅ Bağlantı aktif');
    } catch (err) {
        console.error('❌ ANSWER İŞLEME HATASI:', err);
    }
}

async function handleIceCandidate(candidate) {
    try {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('✅ ICE candidate eklendi');
        } else {
            console.warn('⚠️ Remote description yok, ICE candidate bekletiliyor');
        }
    } catch (err) {
        console.error('❌ ICE CANDIDATE HATASI:', err);
    }
}

function setupPeerConnectionListeners() {
    // ICE candidate
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('🧊 YENİ ICE CANDIDATE:', event.candidate.candidate.substring(0, 50) + '...');
            socket.emit('webrtc-ice-candidate', { 
                roomId: currentRoom, 
                candidate: event.candidate 
            });
        } else {
            console.log('🧊 ICE gathering tamamlandı');
        }
    };

    // ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
        console.log('🧊 ICE gathering state:', peerConnection.iceGatheringState);
    };

    // Track geldiğinde
    peerConnection.ontrack = (event) => {
        console.log('═══════════════════════════════');
        console.log('📥 UZAK TRACK ALINDI!');
        console.log('   - Kind:', event.track.kind);
        console.log('   - ID:', event.track.id);
        console.log('   - Label:', event.track.label);
        console.log('   - ReadyState:', event.track.readyState);
        console.log('   - Enabled:', event.track.enabled);
        console.log('═══════════════════════════════');
        
        if (!remoteStream) {
            remoteStream = new MediaStream();
            console.log('✅ Yeni remote stream oluşturuldu');
        }
        
        remoteStream.addTrack(event.track);
        console.log('✅ Track remote stream\'e eklendi');
        
        if (event.track.kind === 'audio') {
            console.log('🔊 SES TRACK\'İ İŞLENİYOR...');
            const remoteAudio = document.getElementById('remoteAudio');
            remoteAudio.srcObject = remoteStream;
            remoteAudio.play().then(() => {
                console.log('✅ Remote audio çalıyor');
            }).catch(e => {
                console.error('❌ Audio autoplay hatası:', e);
            });
            addSystemMessage('🔊 Ses aktif');
        } else if (event.track.kind === 'video') {
            console.log('📺 VİDEO TRACK\'İ İŞLENİYOR...');
            showRemoteVideo(remoteStream);
            console.log('✅ Remote video gösteriliyor');
            addSystemMessage('📺 Ekran paylaşımı aktif');
        }
    };

    // Connection state
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('🔄 CONNECTION STATE:', state);
        
        if (state === 'connected') {
            console.log('✅ PEER CONNECTION BAŞARILI!');
            addSystemMessage('✅ WebRTC bağlandı');
        } else if (state === 'disconnected') {
            console.log('⚠️ BAĞLANTI KOPTU');
            addSystemMessage('⚠️ Bağlantı koptu');
        } else if (state === 'failed') {
            console.log('❌ BAĞLANTI BAŞARISIZ');
            addSystemMessage('❌ Bağlantı başarısız');
            closeWebRTCConnection();
        }
    };

    // ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE CONNECTION STATE:', peerConnection.iceConnectionState);
        
        if (peerConnection.iceConnectionState === 'connected') {
            console.log('✅ ICE BAĞLANTISI BAŞARILI!');
        } else if (peerConnection.iceConnectionState === 'failed') {
            console.log('❌ ICE BAĞLANTISI BAŞARISIZ!');
        }
    };

    // Signaling state
    peerConnection.onsignalingstatechange = () => {
        console.log('📡 SIGNALING STATE:', peerConnection.signalingState);
    };
}

function showRemoteVideo(stream) {
    console.log('📺 showRemoteVideo çağrıldı');
    
    // Video player'ı gizle
    document.getElementById('videoPlayerSection').style.display = 'none';
    console.log('   - Video player gizlendi');
    
    // Remote video container'ı göster
    const remoteContainer = document.getElementById('remoteVideoContainer');
    remoteContainer.style.display = 'flex';
    console.log('   - Remote container gösterildi');
    
    // Remote video'yu ayarla
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = stream;
    console.log('   - Stream remote video\'ya bağlandı');
    
    remoteVideo.play().then(() => {
        console.log('✅ Remote video çalıyor!');
    }).catch(e => {
        console.error('❌ Video play hatası:', e);
    });
}

function hideRemoteVideo() {
    console.log('📺 hideRemoteVideo çağrıldı');
    document.getElementById('remoteVideoContainer').style.display = 'none';
    document.getElementById('videoPlayerSection').style.display = 'flex';
    
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = null;
}

async function toggleScreenShare() {
    if (isScreenSharing) {
        stopScreenShare();
    } else {
        await startScreenShare();
    }
}

async function startScreenShare() {
    try {
        console.log('═══════════════════════════════');
        console.log('📺 EKRAN PAYLAŞIMI BAŞLATILIYOR...');
        console.log('═══════════════════════════════');
        
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                cursor: "always",
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: true
        });

        console.log('✅ Ekran yakalandı');
        console.log('📹 Video tracks:', screenStream.getVideoTracks().length);
        console.log('🔊 Audio tracks:', screenStream.getAudioTracks().length);

        const videoTrack = screenStream.getVideoTracks()[0];
        console.log('📹 Video track detayları:');
        console.log('   - ID:', videoTrack.id);
        console.log('   - Label:', videoTrack.label);
        console.log('   - ReadyState:', videoTrack.readyState);
        console.log('   - Enabled:', videoTrack.enabled);
        
        if (peerConnection) {
            console.log('🔄 Video track peer connection\'a ekleniyor...');
            
            const senders = peerConnection.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            
            if (videoSender) {
                console.log('🔄 Mevcut video track değiştiriliyor...');
                await videoSender.replaceTrack(videoTrack);
                console.log('✅ Video track değiştirildi');
            } else {
                console.log('➕ Yeni video track ekleniyor...');
                const sender = peerConnection.addTrack(videoTrack, screenStream);
                console.log('✅ Video track eklendi, sender:', sender);
            }

            // Sistem sesini de ekle
            const audioTracks = screenStream.getAudioTracks();
            if (audioTracks.length > 0) {
                console.log('🔊 Sistem sesi ekleniyor...');
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio' && s.track.label.includes('system'));
                if (!audioSender) {
                    peerConnection.addTrack(audioTracks[0], screenStream);
                    console.log('✅ Sistem sesi eklendi');
                }
            }
            
            // ICE gathering'i yeniden başlat
            console.log('🧊 ICE gathering yeniden başlatılıyor...');
        } else {
            console.warn('⚠️ PeerConnection yok!');
        }

        // Kendi ekranını da göster
        showRemoteVideo(screenStream);
        console.log('✅ Kendi ekranın gösteriliyor');

        // Paylaşım durdurulduğunda
        videoTrack.onended = () => {
            console.log('📺 Ekran paylaşımı kullanıcı tarafından durduruldu');
            stopScreenShare();
        };

        isScreenSharing = true;
        updateScreenShareButton();
        addSystemMessage('📺 Ekran paylaşımınız başladı');
        
        console.log('✅ EKRAN PAYLAŞIMI BAŞLATILDI');
        console.log('═══════════════════════════════');
    } catch (err) {
        console.error('❌ EKRAN PAYLAŞIMI HATASI:', err);
        addSystemMessage('⚠️ Ekran paylaşımı iptal edildi');
    }
}

function stopScreenShare() {
    console.log('📺 EKRAN PAYLAŞIMI DURDURULUYOR...');
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => {
            track.stop();
            console.log('⏹️ Track durduruldu:', track.kind);
        });
        screenStream = null;
    }

    // Video track'i kaldır
    if (peerConnection) {
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
            if (sender.track && sender.track.kind === 'video') {
                sender.replaceTrack(null);
                console.log('🔄 Video track kaldırıldı');
            }
        });
    }

    isScreenSharing = false;
    updateScreenShareButton();
    hideRemoteVideo();
    addSystemMessage('📺 Ekran paylaşımı durduruldu');
    
    console.log('✅ EKRAN PAYLAŞIMI DURDURULDU');
}

function toggleMicrophone() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        isMuted = !audioTracks[0].enabled;
        updateMicButton();
        
        const status = isMuted ? 'kapatıldı' : 'açıldı';
        addSystemMessage(`🎤 Mikrofon ${status}`);
        console.log(`🎤 Mikrofon ${status}`);
    }
}

async function toggleCamera() {
    if (isVideoOn) {
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.stop();
                localStream.removeTrack(track);
            });
        }
        
        const localPreview = document.getElementById('localCameraPreview');
        localPreview.srcObject = null;
        localPreview.style.display = 'none';
        
        isVideoOn = false;
        updateCameraButton();
        addSystemMessage('📷 Kamera kapatıldı');
    } else {
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            const videoTrack = videoStream.getVideoTracks()[0];
            
            if (localStream) {
                localStream.addTrack(videoTrack);
            } else {
                localStream = videoStream;
            }

            const localPreview = document.getElementById('localCameraPreview');
            localPreview.srcObject = new MediaStream([videoTrack]);
            localPreview.style.display = 'block';

            if (peerConnection) {
                const senders = peerConnection.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                
                if (videoSender) {
                    await videoSender.replaceTrack(videoTrack);
                } else {
                    peerConnection.addTrack(videoTrack, localStream);
                }
            }

            isVideoOn = true;
            updateCameraButton();
            addSystemMessage('📷 Kamera açıldı');
        } catch (err) {
            console.error('❌ Kamera hatası:', err);
            addSystemMessage('⚠️ Kamera açılamadı');
        }
    }
}

function closeWebRTCConnection() {
    console.log('🔌 WebRTC bağlantısı kapatılıyor...');
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        console.log('✅ PeerConnection kapatıldı');
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    if (remoteStream) {
        remoteStream = null;
    }
    
    hideRemoteVideo();
    
    const remoteAudio = document.getElementById('remoteAudio');
    remoteAudio.srcObject = null;
}

function updateScreenShareButton() {
    const btn = document.getElementById('screenShareBtn');
    if (btn) {
        const icon = btn.querySelector('.btn-icon');
        const label = btn.querySelector('.btn-label');
        
        if (isScreenSharing) {
            if (icon) icon.textContent = '⏹️';
            if (label) label.textContent = 'stop';
            btn.classList.add('active');
        } else {
            if (icon) icon.textContent = '📺';
            if (label) label.textContent = 'screen';
            btn.classList.remove('active');
        }
    }
}

function updateMicButton() {
    const btn = document.getElementById('micBtn');
    if (btn) {
        const icon = btn.querySelector('.btn-icon');
        const label = btn.querySelector('.btn-label');
        
        if (isMuted) {
            if (icon) icon.textContent = '🔇';
            if (label) label.textContent = 'mic';
            btn.classList.remove('active');
        } else {
            if (icon) icon.textContent = '🎤';
            if (label) label.textContent = 'mic';
            btn.classList.add('active');
        }
    }
}

function updateCameraButton() {
    const btn = document.getElementById('cameraBtn');
    if (btn) {
        const icon = btn.querySelector('.btn-icon');
        const label = btn.querySelector('.btn-label');
        
        if (isVideoOn) {
            if (icon) icon.textContent = '📷';
            if (label) label.textContent = 'camera';
            btn.classList.add('active');
        } else {
            if (icon) icon.textContent = '📷';
            if (label) label.textContent = 'camera';
            btn.classList.remove('active');
        }
    }
}

// ==================== Senkronizasyon ====================

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
            addSystemMessage('▶️ BAŞLIYOR!');
            clearInterval(interval);
            setTimeout(() => playVideo(), 100);
        }
    }, 1000);
}

function playVideo() {
    if (currentVideoType === 'youtube' && youtubePlayer) {
        youtubePlayer.playVideo();
        const currentTime = youtubePlayer.getCurrentTime();
        socket.emit('play', { roomId: currentRoom, currentTime });
    } else if (currentVideoType === 'vimeo' && vimeoPlayer) {
        vimeoPlayer.play();
        vimeoPlayer.getCurrentTime().then((time) => {
            socket.emit('play', { roomId: currentRoom, currentTime: time });
        });
    } else if (currentVideoType === 'html5' && videoPlayer) {
        videoPlayer.play();
        socket.emit('play', { roomId: currentRoom, currentTime: videoPlayer.currentTime });
    }
}

function showSyncNotification(username) {
    addSystemMessage(`⏱️ ${username} başlatıyor...`);
    startCountdown();
}

// ==================== Video Kontrolleri ====================

function toggleFullscreen() {
    const container = document.getElementById('remoteVideoContainer').style.display !== 'none' 
        ? document.getElementById('remoteVideoContainer')
        : document.querySelector('.video-player');
    
    if (!document.fullscreenElement) {
        container.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function changeVolume(value) {
    const volume = value / 100;
    
    const remoteVideo = document.getElementById('remoteVideo');
    const remoteAudio = document.getElementById('remoteAudio');
    
    if (remoteVideo) remoteVideo.volume = volume;
    if (remoteAudio) remoteAudio.volume = volume;
    if (videoPlayer) videoPlayer.volume = volume;
    
    document.getElementById('volumeValue').textContent = value;
}

// ==================== Video Player ====================

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
    
    if (isScreenSharing) {
        stopScreenShare();
    }
    
    hideRemoteVideo();
    document.getElementById('videoPlayerSection').style.display = 'flex';

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
    hideRemoteVideo();
    document.getElementById('videoPlayerSection').style.display = 'flex';

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

// ==================== UI ====================

function updateUsersList(users) {
    const usersList = document.getElementById('usersList');
    const catEmoji = users.length > 1 ? '🐱🐱' : '🐱';
    usersList.innerHTML = `${catEmoji} ${users.length}: ${users.map(u => u.username).join(', ')}`;
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

window.addEventListener('beforeunload', () => {
    if (socket && socket.connected) {
        closeWebRTCConnection();
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
            audioContext.close();
        }
    }
});
