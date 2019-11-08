const {Room} = require("colyseus/lib/index");
const schema = require('@colyseus/schema');
const Schema = schema.Schema;
const MapSchema = schema.MapSchema;

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
        this.playerMoves[client.id] = data;
        if (this.clients.every(client => this.playerMoves[client.id] !== undefined)) {
            this.doTurn();
            this.playerMoves = {};
            this.timer.reset();
        }
    }

    onLeave (client) {
        console.log(client.id, "left");
    }

    onDispose() {
        console.log(`Disposing room ${this.battleName}`)
    }

    doTurn() {
        Object.keys(this.state.players).forEach(id => {
            this.state.players[id].health -= 10;
        });
    }
}

module.exports = {BattleRoom};
