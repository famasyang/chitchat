# chitchat
anonymous chatroom
匿名聊天室
### 特点
- 端对端加密
- 支持图片上传
- 左侧显示在线用户ID以及IP地址
- material 3 设计
- 所有聊天记录默认12小时内清除
### 部署初始化步骤
```
npm init -y
```
然后，确保你安装了express、socket.io、moment和axios模块。如果没有，使用以下命令安装：
```
npm install express socket.io moment axios
```
### 文件树构成
```
project-root/
├── public/
│   ├── index.html
│   └── socket.io.js (从socket.io下载的客户端脚本，可以直接从CDN加载)
├── server.js
├── package.json
├── package-lock.json
└── node_modules/
```
