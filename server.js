const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');
const moment = require('moment');
const redis = require('redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');

const app = express();
const httpServer = http.createServer(app);
const io = socketIO(httpServer);
const upload = multer({ dest: 'uploads/' });

let client;
let onlineUsers = {};

const sonnets = [
  "真？",
  "我是素食主义者。",
  "瓦 真的弱智游戏。",
  "昨天下午三点钟起的",
  "为了杜绝饰品被贩卖以及盗号等一切风险，本人电脑一概不出借。",
  "那要三百年后了。",
  "水无定势 兵无常形  不要老是打不过硬打 要学会规避劣势 发挥优势。",
  "我以为我们的关系更像四川和重庆 看来我想多了 你们还是把我当成外人了。",
  "三百年后就没的活路了。",
  "到时候我找你要坐三个小时飞船去月亮找你了",
  "或者可能直接住在环太空卫星带上",
  "那时候我就找不了你了。",
  "也许是话题太沉重，也许是我下手没轻重。",
  "挺好的 工作了之后喜欢保持距离了 所以没得几个朋友嘚 下次有机会再出来嘛 但是我就不专门凑时间了 我现在凑一次时间会累几天 如果每次都是元旦那样水掉我可能还是会比较失望 感觉有点得不偿失。",
  "也不像以前 时间很多 有很多相处的时间 我最少希望每次我们打游戏或者啥子的是愉快的进行和结束的 所以我会避免争吵和冲突 所以下次搞个轻松点的吧。",
  "过去就要被当成贱民被安保公司突突了。",
  "最后在火星上躺在躺椅上看着太阳风暴把聚居地的生态膜撕烂 我就坐在躺椅上被烧成飞灰。",
  "你站在飞船顶层看着太阳风暴肆虐过了火星表面 静静的喝了一口冥王星产的红酒 眼神中只有冷漠 回头对助理说 这次招标 我要拿下火星一半的土地。",
  "和和又平平？",
  "？跑了"
];

async function connectRedis() {
  client = redis.createClient({
    url: 'redis://127.0.0.1:6379'
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/upload', upload.single('image'), (req, res) => {
  if (req.file) {
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
  } else {
    res.status(400).send('No file uploaded');
  }
});

async function clearChatHistory() {
  if (client && client.isReady) {
    try {
      await client.del('chatHistory');
      console.log('Chat history cleared');
      io.emit('chat history cleared');
      
      const nextClearTime = Date.now() + 60 * 1000;
      io.emit('next clear time', nextClearTime);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  }
}

app.get('/clear-chat-history', async (req, res) => {
  await clearChatHistory();
  res.send('Chat history cleared');
});

function encryptMessage(message, key) {
  return CryptoJS.AES.encrypt(message, key).toString();
}

function decryptMessage(encryptedMsg, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedMsg, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Error decrypting message:', error);
    return '解密错误：无效的密钥';
  }
}

function sendRandomSonnetLine() {
  const randomLine = sonnets[Math.floor(Math.random() * sonnets.length)];
  const message = {
    id: Date.now().toString(),
    msg: encryptMessage("黄少:" + randomLine, "sonnet_key"),
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
    key: "sonnet_key"
  };
  io.emit('chat message', message);
}

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
      const chatHistory = await client.lRange('chatHistory', 0, -1);
      chatHistory.reverse();
      socket.emit('chat history', chatHistory.map(JSON.parse));
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  } else {
    console.error('Redis client is not ready');
  }

  const nextClearTime = Date.now() + 60 * 1000;
  socket.emit('next clear time', nextClearTime);

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
    const messageId = Date.now().toString();
    const messageWithTimestamp = { id: messageId, msg: data.msg, timestamp, key: data.key, readBy: [] };
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

  socket.on('message read', (messageId) => {
    io.emit('message read', { messageId, readBy: socket.nickname });
  });

  socket.on('decrypt sonnet', (encryptedMsg) => {
    const decryptedMsg = decryptMessage(encryptedMsg, "sonnet_key");
    socket.emit('decrypted sonnet', decryptedMsg);
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  const redisConnected = await connectRedis();
  if (redisConnected) {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
    setInterval(sendRandomSonnetLine, 5000);
    setInterval(clearChatHistory, 60 * 1000);
    
    setInterval(() => {
      const uploadDir = path.join(__dirname, 'uploads');
      fs.readdir(uploadDir, (err, files) => {
        if (err) {
          console.error('Error reading uploads directory:', err);
          return;
        }
        files.forEach(file => {
          const filePath = path.join(uploadDir, file);
          fs.stat(filePath, (err, stats) => {
            if (err) {
              console.error('Error getting file stats:', err);
              return;
            }
            const now = Date.now();
            const fileAge = now - stats.mtimeMs;
            if (fileAge > 60 * 1000) {
              fs.unlink(filePath, (err) => {
                if (err) {
                  console.error('Error deleting file:', err);
                } else {
                  console.log(`Deleted file: ${file}`);
                }
              });
            }
          });
        });
      });
    }, 60 * 1000);
  } else {
    console.error('Failed to start server due to Redis connection issue');
    process.exit(1);
  }
}

startServer();
