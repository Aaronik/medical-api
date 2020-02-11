"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var Knex = __importStar(require("knex"));
var apollo_server_1 = require("apollo-server");
var schema_1 = __importDefault(require("./src/schema"));
var knexConfig = require('./knexfile');
var knex = Knex(knexConfig);
knex.raw('show tables;').then(function (resp) { return console.log(resp[0]); });
var server = new apollo_server_1.ApolloServer({ typeDefs: schema_1.default });
server.listen().then(function (_a) {
    var url = _a.url;
    console.log("\uD83D\uDE80 Server ready at " + url);
});
