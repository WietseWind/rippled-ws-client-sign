const RippledWsClient = require('rippled-ws-client')
const RippledWsClientSign = require('../') // use require('rippled-ws-client-sign') anywhere else

/**
 * The transaction is already signed. You can 
 * enter the signed transaction in the first argument.
 * The transaction object is the result of signing using
 * the sample code:
 *    tx-offline.js
 * 
 * The transaction should be an object: 
 *    { tx_blob: '...', tx_id: '...' }
 * 
 * The second argument is required; it should be
 * the variable containing the (connected)
 * `rippled-ws-client` object.
 *    https://www.npmjs.com/package/rippled-ws-client
 */

const Transaction = { 
  tx_blob: '120068400000073210343390B0B....C882F857A8E0EC7CAB70AF3D0BEB',
  tx_id: 'B85A4F0502...E4F4E468017CABB' 
}

new RippledWsClient('wss://s1.ripple.com').then((Connection) => {
  new RippledWsClientSign(Transaction, Connection).then((TransactionSuccess) => {
    /**
     * We end up over here if the transaction is sent and found 
     * in a closed ledger. We know for sure the transaction
     * is OK :) This may take a few seconds.
     */
    console.log('TransactionSuccess', TransactionSuccess)
    Connection.close()
  }).catch((TransactionError) => {
    /**
     * We end up over here if the transaction couldn't be processed
     * (error) or wasn't processed and the current Ledger Index is past
     * the LastLedgerSequence.
     */
    console.log('TransactionError', TransactionError.details)
    Connection.close()
  })
}).catch((ConnectionError) => {
  console.log('ConnectionError', ConnectionError)
})