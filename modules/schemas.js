const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const blockSchema = new Schema({
    blockExtraData: String,
    difficulty: Number,
    extDataHash: String,
    proofOfAuthorityData: String,
    gasLimit: Number,
    gasUsed: Number,
    hash: String,
    logsBloom: String,
    miner: String,
    mixHash: String,
    nonce: String,
    number: Number,
    parentHash: String,
    receiptsRoot: String,
    sha3Uncles: String,
    size: Number,
    stateRoot: String,
    timestamp: Number,
    totalDifficulty: Number,
    transactions: [String],
    transactionsRoot: String,
    uncles: [String]
}, {
    collection: "blocks"
});
const Block = mongoose.model("Block", blockSchema);

const transactionSchema = new Schema({
    blockHash: String,
    blockNumber: Number,
    from: String,
    gas: Number,
    gasPrice: String,
    hash: String,
    input: String,
    nonce: Number,
    r: String,
    s: String,
    to: String,
    transactionIndex: Number,
    type: Number,
    v: String,
    value: String
}, {
    collection: "transactions"
});
const Transaction = mongoose.model("Transaction", transactionSchema);

const contractSchema = new Schema({
    address: String,
    name: String | null,
    symbol: String | null,
    creator: String | null,
    totalSupply: Number | null,
    type: [String],
    bytecode: String,

    versionTimestamp: Number
}, { collection: "contracts" });
const Contract = mongoose.model("Contract", contractSchema);

module.exports = {
    Block: Block,
    Transaction: Transaction,
    Contract: Contract
};
