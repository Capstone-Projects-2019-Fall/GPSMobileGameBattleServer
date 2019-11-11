const {Room} = require("colyseus/lib/index");
const schema = require('@colyseus/schema');
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

class BattleRoom extends Room {

    onCreate(options) {
        this.setState(new MyState());
        this.battleName = options.battleName;
        this.playerMoves = {};
        this.maxClients = 10;
        this.state.monsterHealth = 100; // TODO: add enemy starting health as a property in the options object.
        this.timer = this.clock.setInterval(() => this.doTurn(), 10000);
    }

    onJoin (client, options) {
        console.log(client.id, "joined!");
        let me = new Player();
        me.name = options.name;
        me.health = 100;
        this.state.players[client.id] = me;
    }

    onMessage (client, data) {
        console.log(client.id, "sent message");
        //console.log(data);
        this.playerMoves[client.id] = data;
        //console.log(this.playerMoves);

        // Checks to see if all connected clients have sent a move to the server.
        // If so, everyone has made a move and the current round can continue.
        if (this.clients.every(client => this.playerMoves[client.id] !== undefined)) {
            console.log("Everyone has made their move!");
            this.doTurn();            
        }
    }

    onLeave (client) {
        console.log(client.id, "left");
    }

    onDispose() {
        console.log(`Disposing room ${this.battleName}`)
    }

    /**
     * At the end of every turn subtract the total damage given by all the connected clients
     * from the enemie's current health. The state change will be reflected across all clients.
     * Lastly, reset this round's player moves and reset the timer.
     */
    doTurn() {
        var totalDamage = 0;
        Object.keys(this.playerMoves).forEach(id => {            
            totalDamage += parseFloat( this.playerMoves[id] );
        });
        //console.log("Total Damage: " + totalDamage);
        this.state.monsterHealth -= totalDamage;
        this.playerMoves = {};
        this.timer.reset();
    }
}

module.exports = {BattleRoom};
