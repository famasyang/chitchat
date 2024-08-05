const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const imageUpload = document.getElementById('imageUpload');
const messages = document.getElementById('messages');
const nicknameForm = document.getElementById('nicknameForm');
const nicknameInput = document.getElementById('nicknameInput');
const enterChat = document.getElementById('enterChat');
const phraseKeyInput = document.getElementById('phraseKeyInput');
const locationInfo = document.getElementById('locationInfo');
const chatContainer = document.querySelector('.chat-container');
const userList = document.getElementById('userList');
const changeKeyBtn = document.getElementById('changeKeyBtn');
const clearCookiesBtn = document.getElementById('clearCookiesBtn');
const addImageBtn = document.getElementById('addImageBtn');
const menuContent = document.getElementById('menuContent');
const countdown = document.getElementById('countdown');
let nickname = '';
let phraseKey = '';
let nextClearTime;

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

function toggleMenu() {
  menuContent.classList.toggle('show');
}

socket.on('location info', (location) => {
  locationInfo.textContent = `当前位置：${location}`;
  locationInfo.style.display = 'block';
});

if (localStorage.getItem('nickname') && localStorage.getItem('phraseKey')) {
  nickname = localStorage.getItem('nickname');
  phraseKey = localStorage.getItem('phraseKey');
  nicknameForm.style.display = 'none';
  chatContainer.style.display = 'flex';
  document.querySelector('.menu-container').style.display = 'flex';
  socket.emit('user joined', nickname);
  setInterval(() => {
    socket.emit('user report', nickname);
  }, 60000);
  showWelcomeMessage();
}

function showWelcomeMessage() {
  const welcomeMessage = document.createElement('li');
  welcomeMessage.textContent = '欢迎来到聊天室！请注意，聊天记录会每分钟被清除一次。';
  welcomeMessage.style.textAlign = 'center';
  welcomeMessage.style.color = '#888';
  welcomeMessage.style.fontStyle = 'italic';
  messages.appendChild(welcomeMessage);
}

enterChat.addEventListener('click', () => {
  nickname = nicknameInput.value.trim();
  phraseKey = phraseKeyInput.value.trim();

  if (nickname && phraseKey) {
    localStorage.setItem('nickname', nickname);
    localStorage.setItem('phraseKey', phraseKey);
    nicknameForm.style.display = 'none';
    chatContainer.style.display = 'flex';
    document.querySelector('.menu-container').style.display = 'flex';
    socket.emit('user joined', nickname);
    setInterval(() => {
      socket.emit('user report', nickname);
    }, 60000);
    showWelcomeMessage();
  }
});

changeKeyBtn.addEventListener('click', () => {
  phraseKey = prompt('请输入新的密钥:');
  if (phraseKey) {
    localStorage.setItem('phraseKey', phraseKey);
    alert('密钥已更新');
  }
});

addImageBtn.addEventListener('click', () => {
  imageUpload.click();
});

imageUpload.addEventListener('change', () => {
  if (imageUpload.files.length > 0) {
    const file = imageUpload.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      sendMessage(e.target.result, true);
    };
    reader.readAsDataURL(file);
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

function sendMessage(content = '', isImage = false) {
  let message = '';
  if (isImage && content) {
    message = `${nickname}: [img]${content}[/img]`;
  } else if (input.value) {
    message = `${nickname}: ${input.value}`;
  }

  if (message) {
    const encryptedMessage = encryptMessage(message, phraseKey);
    socket.emit('chat message', { msg: encryptedMessage, key: phraseKey });
    input.value = '';
    imageUpload.value = '';
  }
}

socket.on('chat message', (msg) => {
  appendMessage(msg);
});

socket.on('chat history', (history) => {
  messages.innerHTML = ''; // 清空现有消息
  history.forEach(appendMessage);
  messages.scrollTop = messages.scrollHeight;
  showWelcomeMessage();
});

socket.on('update user list', (users) => {
  userList.innerHTML = '';
  users.forEach(user => {
    const userItem = document.createElement('div');
    userItem.textContent = `${user.nickname} (${user.location})`;
    userList.appendChild(userItem);
  });
});

socket.on('chat history cleared', () => {
  messages.innerHTML = ''; // 清空消息列表
  const clearMessage = document.createElement('li');
  clearMessage.textContent = '聊天记录已被清除';
  clearMessage.style.textAlign = 'center';
  clearMessage.style.color = 'gray';
  clearMessage.style.fontStyle = 'italic';
  messages.appendChild(clearMessage);
});

socket.on('next clear time', (time) => {
  nextClearTime = time;
  updateCountdown();
});

function updateCountdown() {
  const now = Date.now();
  const timeLeft = Math.max(0, nextClearTime - now);
  const seconds = Math.ceil(timeLeft / 1000); // 向上取整，确保不会显示 0 秒
  
  countdown.textContent = `本轮聊天记录将在 ${seconds} 秒后消失`;
  
  // 当剩余时间少于10秒时，改变样式
  if (seconds <= 10) {
    countdown.style.color = 'red';
    countdown.style.fontWeight = 'bold';
  } else {
    countdown.style.color = '';
    countdown.style.fontWeight = '';
  }
  
  if (timeLeft > 0) {
    setTimeout(updateCountdown, 1000);
  } else {
    countdown.textContent = '聊天记录即将被清除...';
    countdown.style.color = 'red';
    countdown.style.fontWeight = 'bold';
  }
}

function appendMessage(msg) {
  const item = document.createElement('li');
  const decryptedMessage = decryptMessage(msg.msg, phraseKey);
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');

  const isOwnMessage = decryptedMessage.startsWith(`${nickname}:`);
  if (isOwnMessage) {
    messageContent.classList.add('message-right');
  } else {
    messageContent.classList.add('message-left');
  }

  const messageId = document.createElement('div');
  messageId.classList.add('message-id');
  const nameAndMessage = decryptedMessage.split(': ');
  messageId.textContent = nameAndMessage[0]; // 提取昵称

  const messageText = document.createElement('div');
  const contentText = nameAndMessage.slice(1).join(': '); // 提取消息内容

  // 检查是否包含图片
  const imgMatch = contentText.match(/\[img\](.*?)\[\/img\]/);
  if (imgMatch) {
    const imgUrl = imgMatch[1];
    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = '聊天图片';
    img.classList.add('message-image');
    messageText.appendChild(img);
  } else {
    messageText.textContent = contentText;
  }

  const messageTime = document.createElement('div');
  messageTime.classList.add('message-time');
  const timestamp = new Date(msg.timestamp);
  messageTime.textContent = timestamp.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  messageContent.appendChild(messageId);
  messageContent.appendChild(messageText);
  messageContent.appendChild(messageTime);

  item.appendChild(messageContent);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

clearCookiesBtn.addEventListener('click', () => {
  localStorage.removeItem('nickname');
  localStorage.removeItem('phraseKey');
  window.location.reload();
});
