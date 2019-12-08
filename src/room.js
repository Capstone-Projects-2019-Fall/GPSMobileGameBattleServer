const {Room} = require("colyseus/lib/index");
const schema = require('@colyseus/schema');
const request = require('request');
const Schema = schema.Schema;
const MapSchema = schema.MapSchema;

/**
 * Defines State structure. The client-side representation must match this schema definition.
 */

class Player extends Schema {
}
schema.defineTypes(Player, {
    name: "string",
    health: "number"
});

class MyState extends Schema {
    constructor () {
        super();
        this.players = new MapSchema();
    }
}
schema.defineTypes(MyState, {
    players: { map: Player },
    monsterHealth: "number"
});

var baseURL = 'https://gps-mobile-game-server.herokuapp.com';
// var baseURL = 'http://localhost:3000';

class BattleRoom extends Room {

    onCreate(options) {
        this.setState(new MyState());
        this.battleName = options.battleName;
        this.playerMoves = {};
        this.maxClients = 10;
        this.initializeEnemy();
        // this.timer = this.clock.setInterval(() => this.doTurn(), 10000);
    }

    onJoin (client, options) {
        console.log(client.id, "joined!");
        let me = new Player();
        me.name = options.name;
        me.health = options.playerHealth;
        this.state.players[client.id] = me;
    }

    onMessage (client, data) {
        console.log(client.id, "sent message");
        var move = JSON.parse(data);
        console.log(move);
        this.playerMoves[client.id] = move;
        console.log(this.playerMoves);
        this.state.players[client.id].health = move.playerHealth;

        // If not all players have made their move AND "this" player's damage
        // is enough to defeat the enemy, update the enemy's health to 0
        // and let all other clients detect that the enemy has been defeated.
        if(!this.checkPlayersMoves() && this.state.monsterHealth + move.damage <= 0){
            this.state.monsterHealth = 0;
        }
    }

    onLeave (client) {
        console.log(client.id, "left");
        delete this.state.players[client.id];

        // We may need this for the case where there are multiple players in a room
        // and everyone is waiting for the last player to make a move but gets disconnected.
        // Since checkPlayersMoves() is only called in onMessage() the last client will not
        // be able to send their move and the other players will wait indefinitely.
        // Calling this method when a player leaves could solve this problem.
        this.checkPlayersMoves();
    }

    onDispose() {
        console.log("Remaining monster health: " + this.state.monsterHealth);
        if(this.state.monsterHealth > 0)
        {
            this.updateEnemyHealth();
        }
        else
        {
            this.deleteEnemy();
            this.updateNodeStructure();
        }
        
        console.log(`Disposing room ${this.battleName}`);
    }

    checkPlayersMoves(){
        // Checks to see if all connected clients have sent a move to the server.
        // If so, everyone has made a move and the current round can continue.
        if (this.clients.every(client => this.playerMoves[client.id] !== undefined)) {
            console.log("Everyone has made their move!");
            this.doTurn();
            return true;     
        }
        return false;
    }

    /**
     * At the end of every turn subtract the total damage given by all the connected clients
     * from the enemie's current health. The state change will be reflected across all clients.
     * Lastly, reset this round's player moves and reset the timer.
     */
    doTurn() {
        var totalDamage = 0;
        var playerToPlayerMoves = {
            healing: [],
            drawCards: [],
            buff: []
        };

        Object.keys(this.playerMoves).forEach(id => {            
            totalDamage += this.playerMoves[id].damage;
            playerToPlayerMoves.healing = playerToPlayerMoves.healing.concat(this.playerMoves[id].healing);
            playerToPlayerMoves.drawCards = playerToPlayerMoves.drawCards.concat(this.playerMoves[id].drawCards);
            playerToPlayerMoves.buff = playerToPlayerMoves.buff.concat(this.playerMoves[id].buff);
        });
        
        console.log("Total Damage: " + totalDamage);
        this.state.monsterHealth = Math.max(0, this.state.monsterHealth + totalDamage);

        this.sendEnemyMove(playerToPlayerMoves);

        this.playerMoves = {};
        // this.timer.reset();
    }

    sendEnemyMove(unbroadcastedMoves)
    {        
        var enemyMove = 'default move';
        if(this.enemyMoves !== undefined && this.enemyMoves.length > 0){
            enemyMove = this.enemyMoves[Math.floor(Math.random() * this.enemyMoves.length)];
        }
        unbroadcastedMoves.attack = enemyMove;
        unbroadcastedMoves = JSON.stringify(unbroadcastedMoves);
        console.log("Sending enemy move: " + unbroadcastedMoves);        
        this.broadcast(unbroadcastedMoves);
    }

    initializeEnemy()
    {
        request(baseURL + '/enemy/' + this.battleName , { json: true }, (err, res, body) => {
            if (err)
            { 
                this.handleNetworkError(err);
                this.state.monsterHealth = 100;
                this.enemyMoves = [];
            }
            else if (res.statusCode != 200)
            {
                this.handleHTTPError(res, body);
                this.state.monsterHealth = 100;
                this.enemyMoves = [];
            }
            else
            {
                this.state.monsterHealth = body.hp;
                this.enemyMoves = body.attacks;
            }
        });
    }

    updateEnemyHealth()
    {
        var postBody = {hp: this.state.monsterHealth};
        request.post(baseURL + '/enemy/update/' + this.battleName , { body: postBody, json: true }, (err, res, body) => {
            if (err)
            { 
                this.handleNetworkError(err);
            }
            else if (res.statusCode != 200)
            {
                this.handleHTTPError(res, body);
            }
        });
    }

    deleteEnemy()
    {
        request.delete(baseURL + '/enemy/' + this.battleName , (err, res, body) => {
            if (err)
            { 
                this.handleNetworkError(err);
            }
            else if (res.statusCode != 200)
            {
                this.handleHTTPError(res, body);
            }
        });
    }

    updateNodeStructure()
    {
        var postBody = {structure: "Friendly"};
        request.post(baseURL + '/geodata/update/' + this.battleName , { body: postBody, json: true }, (err, res, body) => {
            if (err)
            { 
                this.handleNetworkError(err);
            }
            else if (res.statusCode != 200)
            {
                this.handleHTTPError(res, body);
            }
        });
    }

    handleNetworkError(err)
    {
        console.error(err); 
    }

    handleHTTPError(res, body)
    {
        console.error(res.statusCode + " " + res.statusMessage + ": " + body);
    }
}

module.exports = {BattleRoom};
