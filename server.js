const express = require('express');
const net = require('net');
const path = require('path');

const app = express();
const PORT = 3000;
const TARGET_IP = '192.168.0.10';
const TARGET_PORT = 22;

app.use(express.static('public'));

app.get('/check-ssh', (req, res) => {
    const socket = new net.Socket();
    let status = 'Off';

    socket.setTimeout(2000); // 2초 타임아웃

    socket.on('connect', () => {
        status = 'On';
        socket.destroy();
    });

    socket.on('timeout', () => {
        status = 'Off';
        socket.destroy();
    });

    socket.on('error', (err) => {
        status = 'Off';
        socket.destroy();
    });

    socket.on('close', () => {
        res.json({ status });
    });

    socket.connect(TARGET_PORT, TARGET_IP);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
