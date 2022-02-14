require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT;
const Database = require('./database/db');
const database = new Database();
const bodyParser = require('body-parser');
app.use(bodyParser.json());

const time = new Date();
console.log(time.toISOString().slice(0,10));

const day = 1000 * 60 * 60 * 24;
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge : day }
}));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    next();
});

const checkAuth =  (req, res, next) => {
    //console.log(req.params.user);
    //console.log(req.session.user.user_id == req.params.user_id && req.session.user.isAuthenticated)
    if(req.session.user === undefined) {
        res.json({ session : "not logged in"});
        return;
    }else {
        if(req.session.user.user_id == req.params.user_id && req.session.user.isAuthenticated) {
            next();
        }
    }
};

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/create/user', (req, res) => { database.createUser(req, res); });

app.post('/create/game/:user_id', checkAuth, (req, res) => { database.createGame(req, res); });

app.delete('/delete/game/:user_id/:game_id', checkAuth, (req, res) => { database.deleteGame(req, res); });

app.patch('/update/game/:user_id/:game_id', checkAuth, (req, res) => { database.updateGame(req, res); });

app.get('/api/user/games/:id', (req, res) => { database.getOwnerGames(req, res); });

app.get('/api/game/:title', (req, res) => { database.searchTitle(req, res); });

app.get('/api', (req, res) => { database.api(req, res); });

app.post('/request/trade/:user_id', checkAuth, (req, res) => { database.requestListing(req, res); });

app.get('/user/trades/:user_id', checkAuth, (req, res) => { database.getListing(req, res); });

app.patch('/user/trade/:user_id/:trade', checkAuth, (req, res) => { database.confirmListing(req, res); });

app.post('/login', (req, res) => { database.login(req, res); });

app.get('/logout', (req, res) => { database.logout(req, res); });

app.post('/reset/password/', (req, res) => {
    const email = req.body.email;
    const transporter = mailer.createTransport({
        service : "Outlook365",
        auth : {
            user : `${process.env.EMAIL}`,
            pass : `${process.env.EMAIL_PASSWORD}`
        }
    });
    const passwords = [
        'J@_xQuNF7ftpj7n',
        'J5@-aY22wVTtjbm',
        '$RH#XuDJ_X9g@2V',
        '4TV#fdub@9PDMJA',
        'K7_AC@HVcDGqY7c',
        'rqkVK-LcV#24YgW',
        '#s2W5Lwj6H2rCb7',
        'E$323$cMFEkx43F',
        'yN#m5h5Xp_KL$@e',
        '7uZP#GzwNs5-9_q',
        '64Eq_y_jV$AZmDQ',
        '5_etj9F@@MDutJo',
        '#7#coS4JyjU7y7p',
        'H_#$n4s7V6wJDu2',
        'o924qWzHm_tmv-J',
        'vqQwaD$CTL-62bv',
        'Wr#vrG@zQ69aE2o',
        '6gVvG$4mA@Lc4S9'
    ];

    const password = passwords[Math.floor(Math.random() * passwords.length)];
    const options = {
        from : `${process.env.EMAIL}`,
        to : email,
        subject : "testing email service",
        html : `<p>Temporary password: ${password}<br></br>You can continue to use this password or you can reset it, clicking the link below<br></br>
                <br></br><a href='http://localhost:3000/reset/password/confirmed/${req.body.email}/${password}'>Click me to reset password</a></p>'`
    };

    transporter.sendMail(options, err => {
        if(err) throw err;

        database.sendRecoveryEmail(res, password, email)
    });
});

app.patch('/reset/password/confirmed/:email/:password', (req, res) => { database.updatePassword(req, res); });

app.listen(PORT | 3000, console.log(`listening on port ${PORT}!`));