let socket;
let currentRoom = '';
let currentUsername = '';
let videoPlayer;
let isUpdatingFromRemote = false;

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
}

function setupSocketListeners() {
    socket.on('user-joined', (data) => {
        addSystemMessage(`${data.username} odaya katıldı`);
        updateUsersList(data.users);
        
        if (data.videoUrl) {
            loadRemoteVideo(data.videoUrl, data.currentTime, data.isPlaying);
        }
    });

    socket.on('user-left', (data) => {
        addSystemMessage(`${data.username} odadan ayrıldı`);
        updateUsersList(data.users);
    });

    socket.on('video-updated', (data) => {
        loadRemoteVideo(data.videoUrl, 0, false);
    });

    socket.on('play', (data) => {
        if (videoPlayer && !isUpdatingFromRemote) {
            isUpdatingFromRemote = true;
            videoPlayer.currentTime = data.currentTime;
            videoPlayer.play();
            setTimeout(() => { isUpdatingFromRemote = false; }, 500);
        }
    });

    socket.on('pause', (data) => {
        if (videoPlayer && !isUpdatingFromRemote) {
            isUpdatingFromRemote = true;
            videoPlayer.currentTime = data.currentTime;
            videoPlayer.pause();
            setTimeout(() => { isUpdatingFromRemote = false; }, 500);
        }
    });

    socket.on('seek', (data) => {
        if (videoPlayer && !isUpdatingFromRemote) {
            isUpdatingFromRemote = true;
            videoPlayer.currentTime = data.currentTime;
            setTimeout(() => { isUpdatingFromRemote = false; }, 500);
        }
    });

    socket.on('chat-message', (data) => {
        addChatMessage(data.username, data.message, data.timestamp);
    });
}

function setupVideoPlayer() {
    videoPlayer = document.getElementById('videoPlayer');

    videoPlayer.addEventListener('play', () => {
        if (!isUpdatingFromRemote) {
            socket.emit('play', { roomId: currentRoom, currentTime: videoPlayer.currentTime });
        }
    });

    videoPlayer.addEventListener('pause', () => {
        if (!isUpdatingFromRemote) {
            socket.emit('pause', { roomId: currentRoom, currentTime: videoPlayer.currentTime });
        }
    });

    videoPlayer.addEventListener('seeked', () => {
        if (!isUpdatingFromRemote) {
            socket.emit('seek', { roomId: currentRoom, currentTime: videoPlayer.currentTime });
        }
    });
}

function loadVideo() {
    const videoUrl = document.getElementById('videoUrlInput').value.trim();
    
    if (!videoUrl) {
        alert('Lütfen bir video URL\'si girin!');
        return;
    }

    videoPlayer.src = videoUrl;
    videoPlayer.style.display = 'block';
    document.getElementById('placeholder').style.display = 'none';

    socket.emit('update-video', { roomId: currentRoom, videoUrl });
    addSystemMessage('Video yüklendi');
}

function loadRemoteVideo(videoUrl, currentTime, isPlaying) {
    videoPlayer.src = videoUrl;
    videoPlayer.style.display = 'block';
    document.getElementById('placeholder').style.display = 'none';
    
    videoPlayer.currentTime = currentTime;
    if (isPlaying) {
        videoPlayer.play();
    }
}

function updateUsersList(users) {
    const usersList = document.getElementById('usersList');
    usersList.textContent = `Katılımcılar (${users.length}): ${users.map(u => u.username).join(', ')}`;
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
        e.preventDefault();
        e.returnValue = '';
    }
});
