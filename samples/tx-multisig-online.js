const RippledWsClient = require('rippled-ws-client')
const RippledWsClientSign = require('../') // use require('rippled-ws-client-sign') anywhere else

/**
 * MultiSig: array with (or):
 *  - familySeed (keypair derived from familySeed, account derived from publicKey)
 *  - familySeed + account (keypair derived from familySeed)
 *  - publicKey + privateKey (account derived from publicKey)
 *  - publicKey + privateKey + account
 */
let MultiSigKeypairs = [
  {
    // publicKey: '0372C2E2B0FA8CD5D66ED5DE15CB0686762A342BCB91117F0FB63AF67512DD1955',
    privateKey: '00018FFAF1911AC7C1D52833D2DD20CC36AD727C37AB7298D652BA7A1F48786C63'
    // account: 'rsAW8cc8EXkmogYse6zz3Z9NU2QEep5q3p'
  },
  {
    familySeed: 'ssPpqpaqWkq7F7yDnS5aY16S7Qu1V'
  },
  'shwxKJsHuTct5EcqcLRAx7o7mPMxn'
]

/**
 * Alternatively it's possible to supply a keypair;
 *    let SeedOrKeypair = {
 *       publicKey: 'hexkey over here',
 *       privateKey: 'hexkey over here'
 *    }
 */

/**
 * Let's build the transaction. Because we are 
 * signing offline, it is mandatory to specify 
 * the Sequence. You should enter the sequence
 * from the account (wallet address). 
 * 
 * The first argument is the Transaction object.
 * 
 * The second argument is the Seed (Secret) string
 * or a Keypair (object, hex privateKey, publicKey)
 * to sign with. 
 * 
 * The third argument is required; it should be
 * the variable containing the (connected)
 * `rippled-ws-client` object.
 *    https://www.npmjs.com/package/rippled-ws-client
 */

const Transaction = {
  TransactionType: 'Payment',
  Account: 'rhHNv2pgHF6ZjncxW9wEopgRn4msDM8oxQ',
  Destination: 'rsAW8cc8EXkmogYse6zz3Z9NU2QEep5q3p',
  DestinationTag: 1337,
  Amount: 0.25 * 1000000 // Amount in drops, so multiply (6 decimal positions)
}

/**
 * You might want to specify:
 *   Transaction.Fee
 *   Transaction.LastLedgerSequence
 *   Transaction.Sequence
 * 
 * If you don't specify the Fee, the Fee will be
 * added by the class based on the last fee 
 * retrieved from the server.
 * 
 * If you DON'T specify the LastLedgerSequence,
 * the transaction will not timeout. 
 * 
 * If you specify a LastLedgerSequence: null, the class 
 * will automatically calculate take the last closed
 * ledger index from the connected server and add
 * 5 ledgers (so if the transaction isn't included)
 * within 5 ledger closes, the transaction times out
 * and the promise will reject.
 * 
 * If you don't specify the Account Sequence, the
 * class will fetch the account_info for you, and
 * retrieve the Sequence number.
 */

new RippledWsClient('wss://s.altnet.rippletest.net:51233').then(Connection => {
  new RippledWsClientSign(Transaction, MultiSigKeypairs, Connection).then(TransactionSuccess => {
    /**
     * We end up over here if the transaction is sent and found 
     * in a closed ledger. We know for sure the transaction
     * is OK :) This may take a few seconds.
     */
    console.log('TransactionSuccess', TransactionSuccess)
    Connection.close()
  }).catch((SignError) => {
    /**
     * We end up over here if the transaction couldn't be processed
     * (error) or wasn't processed and the current Ledger Index is past
     * the LastLedgerSequence.
     */
    console.log('SignError', SignError.details)
    Connection.close()
  })
}).catch((ConnectionError) => {
  console.log('ConnectionError', ConnectionError)
})