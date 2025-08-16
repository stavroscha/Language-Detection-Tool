document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const addStockForm = document.getElementById('add-stock-form');
    const stockTableBody = document.querySelector('#stock-list tbody');

    // For Dashboard page
    if (window.location.pathname.endsWith('dashboard.html')) {
        loadUserStocks();
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const username = this.username.value;
            const email = this.email.value;
            const password = this.password.value;

            if (username.trim() === '' || email.trim() === '' || password.trim() === '') {
                return alert('Please fill in all fields.');
            }
            if (!validateEmail(email)) {
                return alert('Please enter a valid email address.');
            }

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password }),
                });
                const result = await response.json();
                alert(result.message);
                if (response.ok) {
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error('Registration failed:', error);
                alert('Registration failed. Please try again.');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const username = this.username.value;
            const password = this.password.value;

            if (username.trim() === '' || password.trim() === '') {
                return alert('Please fill in all fields.');
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                const result = await response.json();
                alert(result.message);
                if (response.ok) {
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                console.error('Login failed:', error);
                alert('Login failed. Please try again.');
            }
        });
    }

    if (addStockForm) {
        addStockForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const stockSymbol = this['stock-symbol'].value.toUpperCase();
            const stockQuantity = this['stock-quantity'].value;

            if (stockSymbol.trim() === '' || stockQuantity.trim() === '') {
                return alert('Please fill in all fields.');
            }

            try {
                const response = await fetch('/add-stock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stockSymbol, stockQuantity }),
                });
                const result = await response.json();
                alert(result.message);
                if (response.ok) {
                    stockTableBody.innerHTML = ''; // Clear table and reload
                    loadUserStocks();
                }
            } catch (error) {
                console.error('Failed to add stock:', error);
                alert('Failed to add stock. Please try again.');
            }
            this.reset();
        });
    }

    async function loadUserStocks() {
        try {
            const response = await fetch('/get-stocks');
            if (response.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            const stocks = await response.json();
            stockTableBody.innerHTML = ''; // Clear existing rows
            for (const stock of stocks) {
                fetchAndDisplayStockData(stock.symbol, stock.quantity);
            }
        } catch (error) {
            console.error('Failed to load stocks:', error);
        }
    }

    async function fetchAndDisplayStockData(symbol, quantity) {
        try {
            const response = await fetch(`/stock-data?symbol=${symbol}`);
            const data = await response.json();
            if (response.ok) {
                addStockToTable(symbol, quantity, data.nextDividend.date, data.nextDividend.amount);
            } else {
                console.warn(data.message);
                addStockToTable(symbol, quantity, 'N/A', 'N/A');
            }
        } catch (error) {
            console.error('Failed to fetch stock data for ' + symbol, error);
            addStockToTable(symbol, quantity, 'Error', 'Error');
        }
    }

    function addStockToTable(symbol, quantity, nextDividendDate, dividendPerShare) {
        const newRow = document.createElement('tr');
        const totalDividend = (parseFloat(quantity) * parseFloat(dividendPerShare)).toFixed(2);

        newRow.innerHTML = `
            <td>${symbol}</td>
            <td>${quantity}</td>
            <td>${nextDividendDate}</td>
            <td>$${isNaN(totalDividend) ? '0.00' : totalDividend}</td>
        `;
        stockTableBody.appendChild(newRow);
    }

    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
});
