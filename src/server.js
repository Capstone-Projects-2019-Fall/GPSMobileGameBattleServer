const colyseus = require("colyseus/lib/index");
const cors = require("cors");
const http = require("http");
const express = require("express");

const {BattleRoom} = require('./room.js');

const port = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const gameServer = new colyseus.Server({
    server: http.createServer(app),
    express: app,
});

gameServer.define('battle', BattleRoom)
    .filterBy(['battleName']);

gameServer.listen(port);

console.log('started');