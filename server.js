const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: [], videoUrl: '', currentTime: 0, isPlaying: false });
    }

    const room = rooms.get(roomId);
    room.users.push({ id: socket.id, username });

    io.to(roomId).emit('user-joined', {
      username, users: room.users, videoUrl: room.videoUrl,
      currentTime: room.currentTime, isPlaying: room.isPlaying
    });

    console.log(`${username} ${roomId} odasına katıldı`);
  });

  socket.on('update-video', ({ roomId, videoUrl }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.videoUrl = videoUrl;
      room.currentTime = 0;
      room.isPlaying = false;
      socket.to(roomId).emit('video-updated', { videoUrl });
    }
  });

  socket.on('play', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.isPlaying = true;
      room.currentTime = currentTime;
      socket.to(roomId).emit('play', { currentTime });
    }
  });

  socket.on('pause', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.isPlaying = false;
      room.currentTime = currentTime;
      socket.to(roomId).emit('pause', { currentTime });
    }
  });

  socket.on('seek', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.currentTime = currentTime;
      socket.to(roomId).emit('seek', { currentTime });
    }
  });

  socket.on('chat-message', ({ roomId, message }) => {
    io.to(roomId).emit('chat-message', {
      username: socket.username, message,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.users = room.users.filter(u => u.id !== socket.id);
        if (room.users.length === 0) {
          rooms.delete(socket.roomId);
        } else {
          io.to(socket.roomId).emit('user-left', {
            username: socket.username, users: room.users
          });
        }
      }
    }
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎬 Birlikte İzle sunucusu ${PORT} portunda çalışıyor!`);
  console.log(`Tarayıcınızda http://localhost:${PORT} adresini açın`);
});
