const yargs = require("yargs");
const fs = require("fs");

const argv = yargs.option("config", {
    alias: "c",
    description: "The path to the config file",
    type: "string",
    default: "config.json"
}).help().argv;
global.config = require("./"+argv.config);
global.config = require("./config.json");
if(global.config.mongodb.authSource == undefined)
{
    global.config.mongodb.authSource = "admin";
}
///////

const header = fs.readFileSync("./modules/header.txt", {encoding:'utf8', flag:'r'});
console.log(header);

async function main() {
    const database = require("./modules/database.js");
    const { Indexer } = require("./modules/indexer.js");
    await database.waitForDatabaseConnected();

    const indexer = new Indexer(global.config.network.ws, database);
}
main();
