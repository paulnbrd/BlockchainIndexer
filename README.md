# BlockchainIndexer
A simple Blockchain Indexer

Easily index a blockchain, with all the smart contracts, with an HTTP API to interact with it (not implemented yet ^^, I need to work on indexing data efficiently first)

# Installation

Run `npm i` to install the dependencies.

You need a mongodb database, and you just need to put the credentials and connection details in config.json. You also need to change the network ws endpoint under the `network` section

Then, run `node main` to start the indexer. It will put the data in 3 collections (for now): `blocks`, `transactions`, and `contracts`.

# Command line argument

If you run `node main`, it will choose the config.json in the directory. You can change the path to the config file to easily create multiple instances of blockchain indexer.

The argument is `--config` (or `-c`)

# Help plz

Feel free to help !
