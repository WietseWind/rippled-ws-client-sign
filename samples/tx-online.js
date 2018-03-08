const RippledWsClient = require('rippled-ws-client')
const RippledWsClientSign = require('../') // use require('rippled-ws-client-sign') anywhere else

/**
 * Seed shoud be a family seed (secret)
 * valid to sign for the .Account in the 
 * transaction.
 */
let SeedOrKeypair = process.argv.length > 2 ? process.argv[2].replace(/[^a-zA-Z0-9]/g, '') : 'sXXXXXXXXXXXXX'

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
  Account: 'rXXXXXXXXXX',
  Destination: 'rYYYYYYYYYYY',
  DestinationTag: 1337,
  Amount: 0.25 * 1000000, // Amount in drops, so multiply (6 decimal positions)
  LastLedgerSequence: null
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

new RippledWsClient('wss://s1.ripple.com').then((Connection) => {
  new RippledWsClientSign(Transaction, SeedOrKeypair, Connection).then((TransactionSuccess) => {
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