const mongoose = require('mongoose');
const { Block, Transaction, Contract } = require('./schemas.js');

const infos = global.config.mongodb;
const connectionURI = "mongodb://"+infos.username+":"+infos.password+"@"+infos.host+":"+infos.port+"/"+global.config.mongodb.database+"?authSource="+infos.authSource+"&directConnection=true";

let IS_CONNECTED = false;

const collections = [
    "blocks",
    "transactions",
    "contracts"
];
COLLECTIONS = {
    BLOCKS: "blocks",
    TRANSACTIONS: "transactions"
};

async function run(callback = null)
{
    try
    {
        console.log("Connecting to database...")
        await mongoose.connect(connectionURI, {useNewUrlParser: true, useUnifiedTopology: true});
        await mongoose.connection.db.command({ping: 1});
        console.log("Connected to the database");
        IS_CONNECTED = true;
        if(callback != null) {
            callback();
        }
    }
    catch(error)
    {
        console.log(error);
        console.error("Could not connect to the database");
        process.exit(-1);
    }
}
run(async () => {

    collections.forEach((name) => {
        getDatabase().createCollection(name).catch(() => {}); // Probably just collection already created
    });

});

async function waitForDatabaseConnected() {
    while(!IS_CONNECTED) {
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }
    return;
}

function getDatabase() {
    return mongoose.connection.db;
}
function getCollection(collectionName) {
    return getDatabase().collection(collectionName);
}

async function getLastParsedBlock() {
    const last = (await Block.find().sort({_id: -1}).limit(1).exec())[0];
    if(last == undefined) return null;
    return last.number;
}
async function insertBlock(infos, skipCheck = false) {
    if(!skipCheck) {
        if(await Block.findOne({number: infos.number}) != null) return;
    }
    await Block.create(infos);
}
async function getBlock(id)
{
    return await Block.findOne({number: id});
}

async function getLastParsedTransactionBlockNumber() {
    const last = (await Transaction.find().sort({_id: -1}).limit(1).exec())[0];
    if(last == undefined) return null;
    return last.blockNumber;
}
async function insertTransaction(infos, skipCheck = false)
{
    if(!skipCheck)
    {
        if(await Transaction.findOne({blockHash: infos.blockHash}) != null) return;
    }
    await Transaction.create(infos);
}
async function getTransaction(hash)
{
    return await Transaction.findOne({blockHash: infos.blockHash});
}

module.exports = {
    COLLECTIONS: COLLECTIONS,
    getDatabase: getDatabase,
    getCollection: getCollection,
    waitForDatabaseConnected: waitForDatabaseConnected,

    getLastParsedBlock: getLastParsedBlock,
    insertBlock: insertBlock,
    getBlock: getBlock,

    getLastParsedTransactionBlockNumber: getLastParsedTransactionBlockNumber,
    insertTransaction: insertTransaction,
    getTransaction: getTransaction
};
