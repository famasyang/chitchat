const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');
const moment = require('moment');
const redis = require('redis');

const app = express();
const httpServer = http.createServer(app);
const io = socketIO(httpServer);

let client;
let onlineUsers = {};

async function connectRedis() {
  client = redis.createClient({
    url: 'redis://127.0.0.1:6379'
    // 如果有密码认证，请取消下面这行的注释并填入密码
    // password: 'your_redis_password'
  });

  client.on('error', (err) => console.error('Redis Client Error', err));

  try {
    await client.connect();
    console.log('Successfully connected to Redis');
    return true;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    return false;
  }
}

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', async (socket) => {
  console.log('A user connected');
  
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '';
  let location = '未知地区';
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    location = response.data.city || '未知地区';
  } catch (error) {
    console.error('Error fetching IP info:', error);
  }
  socket.emit('location info', location);

  if (client && client.isReady) {
    try {
      const chatHistory = await client.lRange('chatHistory', 0, -1); // 获取所有记录
      chatHistory.reverse(); // 反转记录顺序，以便最新的记录在最前面
      socket.emit('chat history', chatHistory.map(JSON.parse));
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  } else {
    console.error('Redis client is not ready');
  }

  socket.on('user joined', (nickname) => {
    socket.nickname = nickname;
    onlineUsers[socket.id] = { nickname, location };
    io.emit('update user list', Object.values(onlineUsers));
  });

  socket.on('user report', (nickname) => {
    if (onlineUsers[socket.id]) {
      onlineUsers[socket.id].nickname = nickname;
      io.emit('update user list', Object.values(onlineUsers));
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    delete onlineUsers[socket.id];
    io.emit('update user list', Object.values(onlineUsers));
  });

  socket.on('chat message', async (data) => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const messageWithTimestamp = { msg: data.msg, timestamp, key: data.key };
    if (client && client.isReady) {
      try {
        await client.lPush('chatHistory', JSON.stringify(messageWithTimestamp));
        io.emit('chat message', messageWithTimestamp);
      } catch (error) {
        console.error('Error saving message to Redis:', error);
      }
    } else {
      console.error('Redis client is not ready');
    }
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  const redisConnected = await connectRedis();
  if (redisConnected) {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    console.error('Failed to start server due to Redis connection issue');
    process.exit(1);
  }
}

startServer();