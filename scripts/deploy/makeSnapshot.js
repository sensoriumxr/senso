const NodeEndpoint =
    'https://mainnet.infura.io/v3/ab2589f7f0824040873c989e7f1b7cff';
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(NodeEndpoint));

const TransfersInTx = 140;
const TokenAddress = '0xba6db13aeae3607d400ddffd675aa4e88ecc9a69';
const TokenAbi = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'address',
                name: 'from',
                type: 'address',
            },
            {
                indexed: true,
                internalType: 'address',
                name: 'to',
                type: 'address',
            },
            {
                indexed: false,
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
            },
        ],
        name: 'Transfer',
        type: 'event',
    },
];

async function fetchTransferEvents() {
    const token = new web3.eth.Contract(TokenAbi, TokenAddress);
    const events = await token.getPastEvents('Transfer', {
        fromBlock: 8529859,
        toBlock: 'latest',
    });

    return events;
}

function createSnapshot(events) {
    const tokenInfo = {};
    function processTransferEvent(from, to, value) {
        from = from.toLowerCase();
        to = to.toLowerCase();

        if (tokenInfo[from] === undefined) {
            tokenInfo[from] = 0;
        }
        if (tokenInfo[to] === undefined) {
            tokenInfo[to] = 0;
        }

        tokenInfo[to] += value;
        tokenInfo[from] -= value;
    }

    for (const {
        returnValues: { from, to, value },
    } of events) {
        processTransferEvent(from, to, Number(value));
    }

    //change hacker address
    tokenInfo["0xe10332741c59CED2BA96db514a9eD865dDF99b6a"] = tokenInfo["0xeb31973e0febf3e3d7058234a5ebbae1ab4b8c23"];
    delete tokenInfo["0xeb31973e0febf3e3d7058234a5ebbae1ab4b8c23"];

    //delete null values
    Object.keys(tokenInfo).forEach((element) => {
        if (tokenInfo[element] <= 0) {
            delete tokenInfo[element];
        }
    });

    return tokenInfo;
}

function splitChunks(snapshot) {
    const entries = Object.entries(snapshot);
    const totalTx = entries.length / TransfersInTx + 1;

    let txs = [];
    for (let i = 0; i < totalTx; i++) {
        const snapshotSlice = entries.slice(
            i * TransfersInTx,
            (i + 1) * TransfersInTx
        );
        txs.push({
            addresses: snapshotSlice.map((item) => item[0]),
            balances: snapshotSlice.map((item) => item[1]),
        });
    }

    return txs;
}

async function main() {
    //const events = require('./events.js');
    const events = await fetchTransferEvents();
    // console.log(JSON.stringify(events, '/t'));
    const snapshot = createSnapshot(events);
    console.log(JSON.stringify(splitChunks(require('./snapshot')), '/t'));
}

main().then(console.log('Done!'));
