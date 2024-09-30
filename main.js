var express = require('express');
var app = express();

var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var mssql = require('mssql');

app.use(bodyParser.json());

var port = 8080;

var config = {
    server: 'AndreyPC',
    database: 'testdb',
    user: 'test',
    password: '12345',
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
    port: 1433
};

var connectionPool;

mssql.connect(config)
    .then(pool => {
        connectionPool = pool;
        console.log('Connected to database');
    })
    .catch(err => {
        console.error('Database connection failed:', err);
        process.exit(1);
    });

app.use(cookieParser());
app.use(session({
    secret: 'supersecret',
    resave: false, // Don't save session if uninitialized
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 1000 * 60 * 60 // 1 hour
    }
}));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/login', async function (req, res) {
    const login = req.body.username; 
    const password = req.body.password;

    const transaction = new mssql.Transaction(connectionPool);

    try {
        await transaction.begin();

        let result = await transaction.request()
            .input('login', mssql.VarChar, login)
            .input('password', mssql.VarChar, password) 
            .query('SELECT login FROM login WHERE login = @login AND password = @password'); 

        console.log("Query Result: ", result.recordset); 

        if (result.recordset.length > 0) { // Check if there are results
            const foundUser = result.recordset[0].login; 
            req.session.username = foundUser; 
            console.log("Login succeeded: ", req.session.username);
            await transaction.commit(); // Commit the transaction
            res.send('Login successful: ' + 'sessionID: ' + req.session.id + '; user: ' + req.session.username);
        } else {
            console.log("Login failed: ", login);
            await transaction.rollback(); 
            res.status(401).send('Login error: Invalid username or password.');
        }
    } catch (err) {
        console.error("Database query failed: ", err);
        await transaction.rollback();
        res.status(500).send('Internal server error');
    }
});


app.get('/check', function (req, res) {
    if (req.session.username) {
        res.set('Content-Type', 'text/html');
        res.send('<h2>User ' + req.session.username + ' is logged in! </h2>');
    } else {
        res.send('not logged in');
    }
});

app.listen(port, function () {
    console.log('app running on port ' + port);
});
