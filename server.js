const express = require('express');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const moment = require('moment');
const CryptoJS = require('crypto-js');

let chatHistory = [];

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

  socket.on('set phrase key', (key) => {
    socket.phraseKey = key; // Store the client's phrase key
  });

  socket.on('chat message', (data) => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const encryptedMsg = data.msg;
    const phraseKey = data.key;

    try {
      const decryptedMsg = decryptMessage(encryptedMsg, phraseKey);
      const messageWithTimestamp = { msg: encryptedMsg, timestamp, key: phraseKey };

      chatHistory.push(messageWithTimestamp);
      chatHistory = chatHistory.filter(message => moment(message.timestamp).isAfter(moment().subtract(24, 'hours')));

      io.emit('chat message', messageWithTimestamp);
    } catch (error) {
      console.error('Error decrypting message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

function decryptMessage(encryptedMsg, phraseKey) {
  const bytes = CryptoJS.AES.decrypt(encryptedMsg, phraseKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
