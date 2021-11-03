const Web3 = require("web3");

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
    }

    addNewBlockListener()
    {
        const obj = this;
        this.client.eth.subscribe("newBlockHeaders", async (error, event) => {
            if(error) return;
            obj.fetchAndSaveBlock(event.number);
        });
    }
    async fetchAndSaveTransaction(hash)
    {
        const transaction = await this.client.eth.getTransaction(hash);
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

        console.log(haveToFetch+" blocks behind.");
        let startTime = Date.now();
        let totalTransactions = 0;
        let concurrent = 0;
        for(let i = lastParsedBlock; i < currentBlock; i++)
        {
            concurrent += 1;
            this.addConcurent(() => this.fetchAndSaveBlock(i), (result) => { concurrent -= 1; });
            if(i !=0 && i % 2500 == 0)
            {
                let endTime = Date.now();
                console.log("Executed "+(i-lastParsedBlock)+" operations");
                const total = (endTime-startTime);
                console.log("Took "+(total/1000)+"s (Average: "+(total/2500)+"ms)");
                startTime = Date.now();
            }
            while(concurrent >= this.maxConcurrent) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 50);
                });
            }
            // console.log(concurrent+" concurrents");
        }
    }
}

module.exports = {
    Indexer: Indexer
}
