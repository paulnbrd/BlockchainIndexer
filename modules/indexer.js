const Web3 = require("web3");
const { Contract } = require("./schemas.js");
const address0 = "0x0000000000000000000000000000000000000000";

const sayEachOperations = 250;

class Indexer
{
    constructor(
        ws_url,
        database_handler
    ) {
        this.ws_url = ws_url;
        this.client = new Web3(this.ws_url);
        this.database_handler = database_handler;

        this.maxConcurrent = 5;
        
        this.fetchMissingBlocks();
        // this.addNewTransactionListener();
    }

    addNewBlockListener()
    {
        const obj = this;
        this.client.eth.subscribe("newBlockHeaders", async (error, event) => {
            if(error) return;
            obj.fetchAndSaveBlock(event.number);
        });
    }
    addNewTransactionListener()
    {
        const obj = this;
        this.client.eth.subscribe("pendingTransactions", async (error, result) => {
            if(error) return;
            obj.fetchAndSaveTransaction(result);
        });
    }

    async contractHasMethod(contractAddress, signature, code = null) {
        const w3 = this.client;
        if(code === null)
        {
            code = await w3.eth.getCode(contractAddress);
        }
        const functionSignature = w3.eth.abi.encodeFunctionSignature(signature);
        return code.indexOf(functionSignature.slice(2, functionSignature.length)) > 0;
    }
    async contractHasEvent(contractAddress, signature, code = null) {
        const w3 = this.client;
        if(code === null)
        {
            code = await w3.eth.getCode(contractAddress);
        }
        const functionSignature = w3.eth.abi.encodeEventSignature(signature);
        return code.indexOf(functionSignature.slice(2, functionSignature.length)) > 0;
    }

    async isContract(address) {
        if(!this.client.utils.isAddress(address)) return false;
        try {
            const code = await this.client.eth.getCode(address);
            return code != "0x";
        } catch {
            return false;
        }
    }
    cleanString(input) {
        if(input === null) return null;
        var output = "";
        for (var i=0; i<input.length; i++) {
            if (input.charCodeAt(i) <= 127) {
                output += input.charAt(i);
            }
        }
        return output;
    }
    async handleTransaction(transaction)
    {
        if(transaction === null) {
            console.error("Received null transaction");
        }
        const receipt = await this.client.eth.getTransactionReceipt(transaction.hash);
        if(receipt === null) {
            // Transaction not confirmed, wait before retry
            console.log("Transaction with hash "+transaction.hash+" is not yet confirmed, waiting "+(global.config.network.settings.transactionNotConfirmedRetryWait/1000)+"s before retrying");
            setTimeout(() => {
                this.handleTransaction(transaction);
            }, global.config.network.settings.transactionNotConfirmedRetryWait);
            return;
        }
        const transactionReverted = !receipt.status;
        const isContractCreation = transaction.to === address0
                                    && this.client.utils.isAddress(receipt.contractAddress)
                                    && receipt.to === null;
        if(isContractCreation)
        {
            console.log("Contract creation at "+receipt.contractAddress);
        }
        const fromContract = await this.isContract(transaction.from);
        const toContract = await this.isContract(transaction.to);
        const isInteractionWithContract = fromContract || toContract;

        if(isInteractionWithContract || isContractCreation) {
            let contractAddress;
            if(isContractCreation) {
                contractAddress = receipt.contractAddress;
            } else if(fromContract) {
                contractAddress = transaction.from;
            } else if(toContract) {
                contractAddress = transaction.to;
            }
            if(!await this.isContract(contractAddress)) return;
            const creator = isContractCreation ? transaction.from : null;
            this.handleContract(contractAddress, creator);
        }
        
    }
    async getContractMethodValue(contractAddress, method, contractCode) {
        try {
            const hasMethod = this.contractHasMethod(contractAddress, method, contractCode);
            const value = hasMethod ? (await this.client.eth.call({to: contractAddress, data: this.client.eth.abi.encodeFunctionSignature(method)})) : null;
            return value;
        } catch { // Execution reverted
            return null;
        }
    }
    async getContractERCs(contractAddress, contractCode) {

        const types = {
            "ERC-20": {
                functions: [
                    "totalSupply()",
                    "balanceOf(address)",
                    "transfer(address,uint256)",
                    "transferFrom(address,address,uint256)",
                    "approve(address,uint256)",
                    "allowance(address,address)"
                ],
                events: [
                    "Transfer(address,address,uint256)",
                    "Approval(address,address,uint256)"
                ]
            },
            "ERC-721": {
                functions: [
                    "balanceOf(address)",
                    "ownerOf(uint256)",
                    "safeTransferFrom(address,address,uint256)",
                    "transferFrom(address,address,uint256)",
                    "approve(address,uint256)",
                    "setApprovalForAll(address,bool)",
                    "getApproved(uint256)",
                    "isApprovedForAll(address,address)"
                ],
                events: [
                    "Transfer(address,address,uint256)",
                    "Approval(address,address,uint256)",
                    "ApprovalForAll(address,address,bool)"
                ]
            },
            "ERC-1155": {
                function: [
                    "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
                    "balanceOf(address,uint256)",
                    "balanceOfBatch(address[],uint256[])",
                    "setApprovalForAll(address,bool)",
                    "isApprovedForAll(address,address)"
                ],
                events: [
                    "TransferSingle(address,address,address,uint256,uint256)",
                    "TransferBatch(address,address,address,uint256[],uint256[])",
                    "ApprovalForAll(address,address,bool)",
                    "URI(string,uint256)"
                ]
            }
        };
        const methodsCache = {};
        const eventsCache = {};
        const contractTypes = [];

        const keys = Object.keys(types);
        for(let key of keys) {
            const functions = types[key].functions;
            const events = types[key].events;
            let cont = true;
            for(let func in functions) {
                func = types[key].functions[func];
                let hasMethod;
                if(methodsCache[func]) {
                    hasMethod = methodsCache[func];
                } else {
                    hasMethod = await this.contractHasMethod(contractAddress, func, contractCode);
                }
                if(!hasMethod) {
                    cont = false;
                    break;
                }
            }
            if(!cont) {
                continue;
            }
            for(let evt in events) {
                evt = types[key].events[evt];
                let hasEvent;
                if(eventsCache[evt]) {
                    hasEvent = eventsCache[evt];
                } else {
                    hasEvent = await this.contractHasEvent(contractAddress, evt, contractCode);
                }
                if(!hasEvent) {
                    cont = false;
                    break;
                }
            }
            if(cont) {
                contractTypes.push(key);
            }
        }
        return contractTypes;
    }
    async handleContract(contractAddress, creator = null) {
        // if(!await this.isContract(contractAddress)) return;
        const contractCode = await this.client.eth.getCode(contractAddress);

        const contractName = this.cleanString(this.getContractMethodValue(contractAddress, "name()", contractCode));
        const contractSymbol = this.cleanString(this.getContractMethodValue(contractAddress, "symbol()", contractCode));
        const contractTotalSupply = parseInt(this.getContractMethodValue(contractAddress, "totalSupply()", contractCode));
        const timestamp = Date.now() / 1000;

        const infos = {
            address: contractAddress,
            name: contractName,
            symbol: contractSymbol,
            creator: creator,
            totalSupply: contractTotalSupply,
            type: await this.getContractERCs(contractAddress, contractCode),
            bytecode: contractCode,
        
            versionTimestamp: timestamp
        };
        if(await Contract.findOne({bytecode: contractCode})) {
            Contract.updateOne({bytecode: contractCode}, infos);
        } else {
            Contract.create(infos);
        }
    }
    async fetchAndSaveTransaction(hash)
    {
        const transaction = await this.client.eth.getTransaction(hash);
        await this.handleTransaction(transaction);
        await this.database_handler.insertTransaction(transaction);
    }
    async fetchAndSaveBlock(id)
    {
        // console.log("Fetching block #"+id);
        if(await this.database_handler.getBlock(id) != null) return;
        const block = await this.client.eth.getBlock(id);
        for(let index = 0; index < block.transactions.length; index++)
        {
            await this.fetchAndSaveTransaction(block.transactions[index]);
        }
        await this.database_handler.insertBlock(block, true);
        // console.log("Block #"+id+" inserted")
    }
    async addConcurent(func, callback)
    {
        let result = await func();
        callback(result);
    }
    async fetchMissingBlocks() {
        const currentBlock = await this.client.eth.getBlockNumber();
        let lastParsedBlock = await this.database_handler.getLastParsedBlock();
        let add = 1;
        if(lastParsedBlock === null)
        {
            lastParsedBlock = 0;
            add = 0;
        }
        console.log("(Last parsed block: "+lastParsedBlock+")");
        const haveToFetch = currentBlock - lastParsedBlock;

        console.log(haveToFetch+" blocks behind. Fetching missing blocks...");
        let startTime = Date.now();
        let concurrent = 0;
        for(let i = lastParsedBlock; i < currentBlock; i++)
        {
            concurrent += 1;
            this.addConcurent(() => this.fetchAndSaveBlock(i), (result) => { concurrent -= 1; });
            if((i - lastParsedBlock) != 0 && (i - lastParsedBlock) % sayEachOperations == 0)
            {
                let endTime = Date.now();
                const total = (endTime-startTime);
                console.log("Executed "+(i-lastParsedBlock)+" operations."+" Took "+(total/1000)+"s (Average: "+(total/sayEachOperations)+"ms)");
                startTime = Date.now();
            }
            while(concurrent >= this.maxConcurrent) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 5);
                });
            }
            // console.log(concurrent+" concurrents");
        }
    }
}

module.exports = {
    Indexer: Indexer
}
