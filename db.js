const {MongoClient} = require('mongodb');
const bcrypt = require('bcryptjs');
const { resolveHostname } = require('nodemailer/lib/shared');

const client = new MongoClient(process.env.URL);
client.connect(err => {
    if(err) throw err;

    console.log('connected!');
})

const encrypt = str => {
    const salt = bcrypt.genSaltSync(5);
    const hash = bcrypt.hashSync(str, salt);
    return hash;
}

const decrypt = (password, hash) => { return bcrypt.compareSync(password, hash); }

const compareTitles = (games, tradeGames) => {
    const trade_length = tradeGames.length;
    let matchCount = 0;
    for(let i = 0; i < games.length; i++) {
        for(let j = 0; j < tradeGames.length; j++) {
            if(matchCount == trade_length) return true;
            if(games[i].title == tradeGames[j]) {
                matchCount++;
            }
        }
    }
    if(matchCount == trade_length) return true;
    return false;
}
const gameDB = client.db('Games');
const users = gameDB.collection('Users');
const games = gameDB.collection('Games');
class Database {    

    async api(req, res) {
        const results = await games.find().toArray(); 
        res.json({Games : results});
    };
    
    async getOwnerGames(req, res){
        const id = parseInt(req.params.id);
        // database.query(`SELECT u.user_id, g.*
        //               FROM Users u
        //               INNER JOIN Video_Games g ON g.user_id = u.user_id
        //               WHERE u.user_id = ${id}`, (err, games) => {
        //     if(err) throw err;
            
        //     database.query(`SELECT u.name
        //                   FROM Users u
        //                   WHERE u.user_id = ${id}`, (err, user) => {
        //         if(err) throw err;
        //             res.json({
        //                 user : user,
        //                 games
        //             });
        //         });
        // });
        const userGames = await games.find({user_id : id}).toArray();
        res.json({Games : userGames});
    }
    
    async searchTitle(req, res){
        const title = req.params.title;
        const gameResults = await games.find({title : title}).toArray() != 0 
            ? await games.find({title : title}).toArray() : 'no results found'
        console.log(gameResults);
        if(gameResults.length != 0) {
            res.json({
                Games : gameResults
            });
        }
    };
    
    async updateGame(req, res){
        const id = parseInt(req.params.user_id);
        const game_id  = parseInt(req.params.game_id);
        
        const gameToUpdate = await games.find({$and : [{_id : game_id}, { user_id : id}]}).toArray();

        let game = {
            title : req.body.title !== undefined ? req.body.title : gameToUpdate[0].title,
            publisher : req.body.publisher !== undefined ? req.body.publisher : gameToUpdate[0].publisher,
            release_date : req.body.release_date !== undefined ? req.body.release_date : gameToUpdate[0].release_date,
            game_condition : req.body.game_condition !== undefined ? req.body.game_condition : gameToUpdate[0].game,
            previous_owners : req.body.previous_owners !== undefined ? req.body.previous_owners : gameToUpdate[0].previous_owners,
            user_id : id
        };
        games.updateOne({$and : [{_id : game_id}, { user_id : id}]}, {$set : {title : game.title, publisher : game.publisher,
            release_date : game.release_date, game_condition : game.game_condition, previous_owners : game.previous_owners}});
        res.json({
            'old game' : gameToUpdate,
            'new game' : game
        });
    };
    
    async deleteGame(req, res) {
        const id = parseInt(req.params.user_id);
        const game_id = parseInt(req.params.game_id);
        
        await games.deleteOne({ $and : [{_id : game_id}, {user_id : id}]});
        const game = await games.find({user_id : id}).toArray();
        res.json({
            status : 'deleted',
            Games : game
        })
    }
    
    async createGame(req, res) {
        const id = parseInt(req.params.user_id);
    
        let game = {
            _id : await games.countDocuments() + 1,
            title : req.body.title,
            publisher : req.body.publisher,
            release_date : req.body.release_date,
            game_condition : req.body.game_condition,
            previous_owners : req.body.previous_owners != null ? req.body.previous_owners : 0,
            listings : [],
            user_id : id
        };

        games.insertOne(game);
        res.json({status : 'game created'});
    };
    
    async createUser(req, res) {
        const password = req.body.password;
        const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]{4,}.[a-zA-Z]{2,}$/;
        const passwordRegex = /^(?=.*[A-Z])(?=.*[@$!%*?&])(?=.*\d)[A-Za-z\d@$<>-_!%*?&]{8,}$/;
        if(emailRegex.test(req.body.email) && passwordRegex.test(password)) {
            const encrypted = encrypt(password);
            const user =  {
                _id : await users.countDocuments() + 1,
                name : req.body.name,
                password : encrypted,
                email : req.body.email,
                address : req.body.address
            };
            users.insertOne(user);
            res.json({status : 'user created'});
        } else {
            res.json({
                error : "Email is incorrect or password does not contain 1 uppercase, lowercase, number, and special character"
            });
        }
    }
    
    async requestListing(req, res) {
        let listing = {
            listing_id : 0,
            user_id : parseInt(req.body.user),
            message : req.body.trade_message,
            trade_titles : req.body.trade_titles,
            receive_titles : req.body.receive_titles,
            completed : null,
            date : null,
            sender_id : parseInt(req.params.user_id)
        }
        const results = await games.find({user_id : listing.user_id}).toArray();

        if(compareTitles(results, listing.trade_titles)) {
            const size = await games.aggregate([ {$project : { count : {$size : "$listings"}}}]).toArray();
            let num = 0;
            for(let i = 0; i < size.length; i++) {
                if(size[i].count > num) num = size[i].count;
            }
            for(let i = 0; i < listing.trade_titles.length; i++) {
                listing.listing_id = num + 1;
                await games.updateOne({ $and : [ {user_id : listing.sender_id},
                    {title : listing.receive_titles[i]}]}, {$push : {listings : listing}});
                await games.updateOne({$and : [{user_id : listing.user_id},
                    {title : listing.trade_titles[i]}]}, {$push : {listings : listing}});
            }
            res.json({status : 'listing successfully sent'});
            return;
        } else {
            res.json({status : 'error uploading listing'});
            return;
        }
    }
    
    async getListing(req, res) {
        let totalTrades = [];
        const id = parseInt(req.params.user_id);
        const status = req.body.status != undefined ? req.body.status : null;
        const sender = req.body.sender_id != undefined ? req.body.sender_id : null;
        
        //console.log(await games.find({listings : {$elemMatch : {user_id : {$eq : id}}}}).toArray());
        //search by status
        if(status != null) {
            const result = await games.find({listings : {$elemMatch : {$and : [{user_id : {$eq : id}}, {completed : status}]}}}).toArray();
            
            res.json({trades : result});
            return;

          //search by sender  
        } else if(sender != null) {
            const result = await games.find({listings : {$elemMatch : {$and : [{user_id : {$eq : id}}, {sender_id : sender}]}}}).toArray();
            res.json({trades : result});
            return;
        } else {
            const result = await games.find({listings : {$elemMatch : {user_id : {$eq : id}}}}).toArray();
            res.json({trades : result});
            return;   
        }
    }
    
    async confirmListing(req, res) {
        const trade_id = parseInt(req.params.trade);
        const id = parseInt(req.params.user_id);
        const bool = req.body.status;
        const game = await games.findOne({listings : {$elemMatch : {$and : [{listing_id : trade_id},
            {user_id : id}, {completed : null}]}}});
        if(bool) {
            await games.updateMany({listings : {$elemMatch : {$and : [{listing_id : trade_id},
                {user_id : id}, {completed : null}]}}}, {$set : {"listings.$.completed" : true,
                 previous_owners : (parseInt(game.previous_owners) + 1), "listings.$.date" :  new Date().toISOString().slice(0,10)}});
        } else {
            await games.updateMany({listings : {$elemMatch : {$and : [{listing_id : trade_id},
                {user_id : id}, {completed : null}]}}}, {$set : {"listings.$.completed" : false, "listings.$.date" : new Date().toISOString().slice(0,10)}})
        }
        res.json({status : 'trade success'});
        return;
    }
    
    async login(req, res) {
        const email = String(req.body.email).toLowerCase();
        const password = req.body.password;
        
        if((email && password) != null) {
            const result = await users.findOne({email : email});
            if(decrypt(password, result.password)) {
                req.session.user = {
                    user_id : result._id,
                    isAuthenticated : true,
                    email : result.email
                };
                res.json({status : 'logged in'});
                return;
            } else {
                res.json({status : 'incorrect credentials'});
                return;
            }  
        }  
    }
    
    logout(req, res) {
        req.session.destroy(err => {
            if(err) throw err;
            res.json({
                session : "signed out"
            });
            return;
        });
    }
    
    sendRecoveryEmail(res, password, email) {
        users.updateOne({email : email}, {$set : {password : password}});
        res.json({status : 'password updated'});
        return;
    }
    
    updatePassword(req, res) {
        const passwordRegex = /^(?=.*[A-Z])(?=.*[@$!%*?&])(?=.*\d)[A-Za-z\d@$<>-_!%*?&]{8,}$/;
        const email = req.params.email;
        const password = `'${req.params.password}'`;
        const newPassword = req.body.newPassword;
        if(passwordRegex.test(newPassword)) {
            users.updateOne({email : email}, {$set : {password : encrypt(newPassword)}});
            res.json({status : 'password updated'});
            return;
        }   
    }
}

module.exports = Database;