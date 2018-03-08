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
 * The third argument is omitted, since we are
 * signing offline. When signing online, the
 * `rippled-ws-client` object should be here.
 */

const Transaction = {
  TransactionType: 'Payment',
  Account: 'rXXXXXXXXXX',
  Fee: 10,
  Destination: 'rYYYYYYYYYYY',
  DestinationTag: 1337,
  Amount: 1.05 * 1000000, // Amount in drops, so multiply (6 decimal positions)
  Sequence: 110
}

new RippledWsClientSign(Transaction, SeedOrKeypair).then((SignedTransaction) => {
  /**
   * Signed :D Now submit Airgapped, or using https://www.npmjs.com/package/rippled-ws-client
   * with: { command: 'submit', tx_blob: SignedTransaction.tx_blob }
   * 
   * Other relevant examples in this repo:
   *   - tx-online.js (sign and submit (promise))
   *   - tx-blob-online.js (airgapped signed submission (promise))
   */ 
  console.log('SignedTransaction', SignedTransaction)
}).catch((SignError) => {
  console.log('SignError', SignError.details)
})
