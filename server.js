const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { MongoClient } = require('mongodb');

const PORT = 3000;
const MONGODB_URI = process.env.MONGODB_URI;

let db;
let timeRecordsCollection;

// MongoDB 연결
function connectToMongoDB() {
    MongoClient.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
        if (err) {
            console.error('MongoDB 연결 실패:', err);
            return;
        }
        db = client.db('market_rates');
        timeRecordsCollection = db.collection('TimeRecord');
        console.log('MongoDB에 연결되었습니다.');
    });
}

// 서버 시작 시 MongoDB 연결
connectToMongoDB();

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    } else if (req.url === '/api/crypto-prices') {
        const url = 'https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-XRP';
        
        https.get(url, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => { data += chunk; });
            apiRes.on('end', () => {
                try {
                    const priceData = JSON.parse(data);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(priceData));
                } catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ success: false, error: 'Parse Error' }));
                }
            });
        }).on('error', (err) => {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: err.message }));
        });
    } else if (req.url === '/api/time-record' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                if (!timeRecordsCollection) {
                    res.writeHead(500);
                    return res.end(JSON.stringify({ success: false, error: 'MongoDB not connected' }));
                }
                
                // 2025년 1월 1일부터 어제까지의 전체 국채 금리 데이터 생성
                const startDate = new Date('2025-01-01');
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                // 각 날짜에 대한 국채 금리 데이터 생성
                const records = [];
                let currentDate = new Date(startDate);
                
                while (currentDate <= yesterday) {
                    const yieldRate = (Math.random() * 2 + 1).toFixed(3); // 1.000% ~ 3.000%
                    const record = {
                        timestamp: new Date(currentDate),
                        formattedTime: currentDate.toISOString(),
                        koreanTime: `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일`,
                        bondYield: parseFloat(yieldRate),
                        type: '10년물 국채 금리'
                    };
                    records.push(record);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                // 모든 기록을 한 번에 저장
                timeRecordsCollection.insertMany(records, (err, result) => {
                    if (err) {
                        console.error('TimeRecord 저장 실패:', err);
                        res.writeHead(500);
                        return res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: `${records.length}개의 국채 금리 데이터를 저장했습니다.`,
                        count: records.length
                    }));
                });
            } catch (error) {
                console.error('TimeRecord 저장 실패:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else if (req.url === '/api/time-records' && req.method === 'GET') {
        try {
            if (!timeRecordsCollection) {
                res.writeHead(500);
                return res.end(JSON.stringify({ success: false, error: 'MongoDB not connected' }));
            }
            
            timeRecordsCollection.find({}).sort({ timestamp: -1 }).limit(10).toArray((err, records) => {
                if (err) {
                    console.error('TimeRecord 조회 실패:', err);
                    res.writeHead(500);
                    return res.end(JSON.stringify({ success: false, error: err.message }));
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    records: records
                }));
            });
        } catch (error) {
            console.error('TimeRecord 조회 실패:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
