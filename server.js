const express = require('express');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const moment = require('moment');

// 用于存储聊天记录
let chatHistory = [];

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', async (socket) => {
  console.log('A user connected');
  
  // 获取用户IP地址
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '';
  let location = '未知地区';

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    location = response.data.city || '未知地区';
  } catch (error) {
    console.error('Error fetching IP info:', error);
  }

  // 发送地理位置信息给新用户
  socket.emit('location info', location);

  // 发送聊天记录给新用户
  socket.emit('chat history', chatHistory);

  socket.on('chat message', (msg) => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const messageWithTimestamp = { msg, timestamp };
    
    // 保存消息到历史记录
    chatHistory.push(messageWithTimestamp);

    // 保留24小时内的消息
    chatHistory = chatHistory.filter(message => moment(message.timestamp).isAfter(moment().subtract(24, 'hours')));

    io.emit('chat message', messageWithTimestamp);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
