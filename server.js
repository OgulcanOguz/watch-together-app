const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

// Odaları takip etmek için
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);

  // Odaya katılma
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;

    // Oda bilgisini güncelle
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: [],
        videoUrl: '',
        videoType: 'html5',
        currentTime: 0,
        isPlaying: false
      });
    }

    const room = rooms.get(roomId);
    room.users.push({ id: socket.id, username });

    // Odadaki herkese yeni kullanıcıyı bildir
    io.to(roomId).emit('user-joined', {
      username,
      users: room.users,
      videoUrl: room.videoUrl,
      videoType: room.videoType,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying
    });

    console.log(`${username} odaya katıldı: ${roomId} (Toplam: ${room.users.length})`);
  });

  // Video URL'si değiştiğinde
  socket.on('update-video', ({ roomId, videoUrl, videoType }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.videoUrl = videoUrl;
      room.videoType = videoType || 'html5';
      room.currentTime = 0;
      room.isPlaying = false;
      socket.to(roomId).emit('video-updated', { 
        videoUrl, 
        videoType: room.videoType 
      });
    }
  });

  // Video oynatma
  socket.on('play', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.isPlaying = true;
      room.currentTime = currentTime;
      socket.to(roomId).emit('play', { currentTime });
    }
  });

  // Video duraklama
  socket.on('pause', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.isPlaying = false;
      room.currentTime = currentTime;
      socket.to(roomId).emit('pause', { currentTime });
    }
  });

  // Video zaman değişikliği (seek)
  socket.on('seek', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.currentTime = currentTime;
      socket.to(roomId).emit('seek', { currentTime });
    }
  });

  // Chat mesajı
  socket.on('chat-message', ({ roomId, message }) => {
    io.to(roomId).emit('chat-message', {
      username: socket.username,
      message,
      timestamp: new Date().toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    });
  });

  // ==================== WebRTC Sinyal Mesajları ====================

  // WebRTC Offer
  socket.on('webrtc-offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('webrtc-offer', offer);
    console.log(`WebRTC offer gönderildi - Oda: ${roomId}`);
  });

  // WebRTC Answer
  socket.on('webrtc-answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('webrtc-answer', answer);
    console.log(`WebRTC answer gönderildi - Oda: ${roomId}`);
  });

  // WebRTC ICE Candidate
  socket.on('webrtc-ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc-ice-candidate', candidate);
  });

  // Senkronizasyon isteği
  socket.on('sync-request', ({ roomId, username }) => {
    socket.to(roomId).emit('sync-request', { username });
    console.log(`${username} senkronizasyon başlattı - Oda: ${roomId}`);
  });

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.users = room.users.filter(u => u.id !== socket.id);
        
        if (room.users.length === 0) {
          rooms.delete(socket.roomId);
          console.log(`Oda silindi: ${socket.roomId}`);
        } else {
          io.to(socket.roomId).emit('user-left', {
            username: socket.username,
            users: room.users
          });
        }
      }
    }
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎬 Birlikte İzle v3.0 sunucusu ${PORT} portunda çalışıyor!`);
  console.log(`✨ Özellikler: YouTube, Vimeo, MP4, WebRTC Ekran Paylaşımı, Sesli Görüşme`);
  console.log(`Tarayıcınızda http://localhost:${PORT} adresini açın`);
});
