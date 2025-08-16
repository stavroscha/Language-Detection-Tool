const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(session({
    secret: 'a-super-secret-key', // Replace with a real secret key in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(express.static(path.join(__dirname)));

const usersFilePath = path.join(__dirname, 'users.json');
const userStocksFilePath = path.join(__dirname, 'user_stocks.json');

// Helper functions to read/write users.json
function readUsers(callback) {
    fs.readFile(usersFilePath, 'utf8', (err, data) => {
        if (err) return callback(err.code === 'ENOENT' ? null : err, []);
        try { callback(null, JSON.parse(data)); } catch (e) { callback(e); }
    });
}
function writeUsers(users, callback) {
    fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8', callback);
}

// Helper functions to read/write user_stocks.json
function readUserStocks(callback) {
    fs.readFile(userStocksFilePath, 'utf8', (err, data) => {
        if (err) return callback(err.code === 'ENOENT' ? null : err, []);
        try { callback(null, JSON.parse(data)); } catch (e) { callback(e); }
    });
}
function writeUserStocks(stocks, callback) {
    fs.writeFile(userStocksFilePath, JSON.stringify(stocks, null, 2), 'utf8', callback);
}

// Register endpoint
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    readUsers((err, users) => {
        if (err) return res.status(500).json({ message: 'Error reading from database' });
        if (users.find(user => user.username === username)) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        const newUser = { id: Date.now().toString(), username, email, password };
        users.push(newUser);
        writeUsers(users, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Error writing to users database' });

            readUserStocks((stockErr, userStocks) => {
                if (stockErr) return res.status(500).json({ message: 'Error reading from stocks database' });
                userStocks.push({ userId: newUser.id, stocks: [] });
                writeUserStocks(userStocks, (stockWriteErr) => {
                    if (stockWriteErr) return res.status(500).json({ message: 'Error writing to stocks database' });
                    res.status(201).json({ message: 'User registered successfully' });
                });
            });
        });
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    readUsers((err, users) => {
        if (err) return res.status(500).json({ message: 'Error reading from database' });
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        res.status(200).json({ message: 'Login successful' });
    });
});

// Add stock endpoint
app.post('/add-stock', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    const { stockSymbol, stockQuantity } = req.body;
    if (!stockSymbol || !stockQuantity) {
        return res.status(400).json({ message: 'Stock symbol and quantity are required' });
    }
    readUserStocks((err, userStocks) => {
        if (err) return res.status(500).json({ message: 'Error reading from database' });
        let userStockData = userStocks.find(s => s.userId === req.session.userId);
        if (!userStockData) {
            // This should not happen if register works correctly
            userStockData = { userId: req.session.userId, stocks: [] };
            userStocks.push(userStockData);
        }

        const existingStock = userStockData.stocks.find(s => s.symbol === stockSymbol);
        if (existingStock) {
            existingStock.quantity = (parseFloat(existingStock.quantity) + parseFloat(stockQuantity)).toString();
        } else {
            userStockData.stocks.push({ symbol: stockSymbol, quantity: stockQuantity });
        }

        writeUserStocks(userStocks, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Error writing to database' });
            res.status(200).json({ message: 'Stock added successfully' });
        });
    });
});

// Get stocks endpoint
app.get('/get-stocks', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    readUserStocks((err, userStocks) => {
        if (err) return res.status(500).json({ message: 'Error reading from database' });
        const userStockData = userStocks.find(s => s.userId === req.session.userId);
        res.status(200).json(userStockData ? userStockData.stocks : []);
    });
});

// Stock data endpoint
app.get('/stock-data', (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) {
        return res.status(400).json({ message: 'Stock symbol is required' });
    }

    // IMPORTANT: Replace with your own Polygon.io API key
    const apiKey = 'YOUR_POLYGON_API_KEY';

    if (apiKey === 'YOUR_POLYGON_API_KEY') {
        return res.status(400).json({ message: 'API key not configured on the server.' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const url = `https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&ex_dividend_date.gte=${today}&limit=1&apiKey=${apiKey}`;

    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => { data += chunk; });
        apiRes.on('end', () => {
            try {
                const jsonData = JSON.parse(data);
                if (jsonData.status === 'ERROR' || jsonData.results.length === 0) {
                    return res.status(404).json({ message: 'No upcoming dividend data found for this stock.' });
                }

                const nextDividend = jsonData.results[0];

                res.status(200).json({
                    symbol: symbol,
                    nextDividend: {
                        date: nextDividend.ex_dividend_date,
                        amount: nextDividend.cash_amount.toString()
                    }
                });

            } catch (e) {
                res.status(500).json({ message: 'Failed to parse stock data' });
            }
        });
    }).on('error', (err) => {
        res.status(500).json({ message: 'Failed to fetch stock data' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
