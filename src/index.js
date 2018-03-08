'use strict'

const RippleKeypairs = require('ripple-keypairs')
const RippleBinaryCodec = require('ripple-binary-codec')
const RippleHashes = require('ripple-hashes')

class RippledWsClientSignError extends Error {
  constructor (Message, Details) {
    super(Message)
    Object.assign(this, {
      details: Details,
      toString () {
        return Details
      }
    })
  }
}

class RippledWsClientSign {
  constructor (Transaction, SeedOrKeypair, RippledWsClient) {
    const SignTransaction = (Transaction, Keypair) => {
      let TxBlob
      let TxId

      Transaction.SigningPubKey = Keypair.publicKey
      Transaction.TxnSignature = RippleKeypairs.sign(RippleBinaryCodec.encodeForSigning(Transaction), Keypair.privateKey)

      TxBlob = RippleBinaryCodec.encode(Transaction)
      TxId = RippleHashes.computeBinaryTransactionHash(TxBlob)

      return {
        tx_blob: TxBlob,
        tx_id: TxId
      }
    }

    return new Promise((resolve, reject) => {
      let Keypair
      const SendTransaction = (Transaction) => {
        let DecodedTransaction
        try {
          DecodedTransaction = RippleBinaryCodec.decode(Transaction.tx_blob)
        } catch (e) {
          reject(new RippledWsClientSignError('Error decoding transaction', {
            type: 'transaction_invalid',
            message: 'Error decoding transaction',
            error: e
          }))
        }

        RippledWsClient.send({
          command: 'subscribe',
          streams: [ 'ledger' ],
          accounts: [ DecodedTransaction.Account ]
        }).then(() => {
          RippledWsClient.send({
            command: 'submit',
            tx_blob: Transaction.tx_blob
          }).then((submit) => {
            /**
             * The transaction is sent, but we can't be 100%
             * sure the transaction will make it to a closed
             * ledger. The state is tentative.
             */
            if (typeof submit.engine_result !== 'undefined' && submit.engine_result.match(/^tes|terQUEUED/)) {
              // (Possible) Success

              /**
               * We create a new promise. Within the promise
               * we will watch for whatever comes first:
               *  - A ledger closes > the LastLedgerSequence
               *    for our TX. The TX didn't make it into
               *    a ledger. It timed out. We reject.
               *  - We see our own transaction in the
               *    transaction stream of our destination
               *    wallet. The ledger is closed, so
               *    the transaction is definitely OK.
               *    We resolve.
               */
              new Promise((resolve, reject) => {
                RippledWsClient.on('ledger', (ledgerInfo) => {
                  if (typeof DecodedTransaction.LastLedgerSequence !== 'undefined' && DecodedTransaction.LastLedgerSequence && ledgerInfo.ledger_index > DecodedTransaction.LastLedgerSequence) {
                    reject(new RippledWsClientSignError('Timeout, ledger_index > tx LastLedgerSequence'))
                  }
                })
                RippledWsClient.on('transaction', (transaction) => {
                  if (transaction.engine_result === 'tesSUCCESS' && transaction.type === 'transaction') {
                    if (typeof transaction.transaction === 'object' && typeof transaction.transaction.hash !== 'undefined') {
                      if (transaction.transaction.hash === Transaction.tx_id) {
                        if (transaction.status === 'closed' && transaction.validated === true) {
                          resolve(transaction.transaction)
                        }
                      }
                    }
                  }
                })
              }).then((TransactionOk) => {
                resolve(TransactionOk)
              }).catch((TransactionError) => {
                reject(new RippledWsClientSignError('Transaction not processed', {
                  type: 'transaction_error',
                  message: 'Transaction not processed',
                  error: TransactionError
                }))
              })
            } else {
              let MessageAppend = ''
              if (typeof submit.engine_result !== 'undefined') {
                MessageAppend += ': ' + submit.engine_result
              }
              if (typeof submit.engine_result_message !== 'undefined') {
                MessageAppend += ', ' + submit.engine_result_message
              }
              reject(new RippledWsClientSignError('Transaction result not tes(SUCCESS) / terQUEUED' + MessageAppend, {
                type: 'transaction_submit_non_tes_or_queued',
                message: 'Transaction result not tes(SUCCESS) / terQUEUED' + MessageAppend,
                error: submit
              }))
            }
          }).catch((TxSubmitError) => {
            reject(new RippledWsClientSignError('Transaction not sent or not accepted', {
              type: 'transaction_submit_error',
              message: 'Transaction not sent or not accepted',
              error: TxSubmitError
            }))
          })
        }).catch((e) => {
          reject(new RippledWsClientSignError('Cannot subscribe to account (listen for account transaction events)', {
            type: 'subscribe_error',
            message: 'Cannot subscribe to account (listen for account transaction events)',
            error: e
          }))
        })
      }

      if (typeof SeedOrKeypair === 'string') {
        if (SeedOrKeypair.trim().match(/^s[0-9a-zA-Z]{15,}$/)) {
          try {
            Keypair = RippleKeypairs.deriveKeypair(SeedOrKeypair.trim())
          } catch (e) {
            reject(new RippledWsClientSignError('Invalid seed / secret (sXXX...) entered', {
              type: 'seed_invalid',
              message: 'Invalid seed / secret (sXXX...) entered',
              error: e
            }))
          }
        }
      }

      if (typeof Transaction === 'string' && Transaction.match(/^[A-F0-9]{10,}$/)) {
        // Probably signed TX, but only blob / id
        reject(new RippledWsClientSignError('Invalid transaction, no TX JSON, not signed object { tx_blob: ..., tx_id: ... }', {
          type: 'transaction_invalid_no_signed_object',
          message: 'Invalid transaction, no TX JSON, not signed object { tx_blob: ..., tx_id: ... }'
        }))
      }

      if (typeof Transaction === 'object' && Transaction && typeof Transaction.tx_blob !== 'undefined' && typeof Transaction.tx_id !== 'undefined') {
        // Signed TX
        if (typeof SeedOrKeypair === 'object' && typeof RippledWsClient === 'undefined') {
          if (SeedOrKeypair.constructor.name === 'RippledWsClient') {
            // Second argument = Client
            RippledWsClient = SeedOrKeypair
          }
        }

        SendTransaction(Transaction)
      } else {
        if (typeof SeedOrKeypair === 'object' && SeedOrKeypair) {
          if (typeof SeedOrKeypair.privateKey === 'undefined' || typeof SeedOrKeypair.publicKey === 'undefined') {
            reject(new RippledWsClientSignError('Invalid keypair, .privateKey and/or .publicKey properties missing', {
              type: 'keypair_invalid_keys',
              message: 'Invalid keypair, .privateKey and/or .publicKey properties missing'
            }))
          } else {
            if (!SeedOrKeypair.privateKey.match(/^[A-F0-9]{24,}$/) || !SeedOrKeypair.publicKey.match(/^[A-F0-9]{24,}$/)) {
              reject(new RippledWsClientSignError('Invalid keypair, .privateKey and/or .publicKey not hexadecimal', {
                type: 'keypair_invalid_hex',
                message: 'Invalid keypair, .privateKey and/or .publicKey not hexadecimal'
              }))
            }
          }
        }

        // TX Json
        if (typeof Keypair === 'undefined') {
          reject(new RippledWsClientSignError('Invalid keypair, no valid seed / secret / keypair entered', {
            type: 'keypair_invalid',
            message: 'Invalid keypair, no valid seed / secret / keypair entered'
          }))
        } else {
          let SubmitTxOnline = false
          if (typeof RippledWsClient !== 'undefined') {
            // RippledWsClient present, check if valid
            if (typeof RippledWsClient === 'object' && RippledWsClient.constructor.name === 'RippledWsClient') {
              SubmitTxOnline = true
            } else {
              reject(new RippledWsClientSignError('Invalid WebSocket Client class, expected instanceof RippledWsClient (npm: rippled-ws-client)', {
                type: 'invalid_wsclient',
                message: 'Invalid WebSocket Client class, expected instanceof RippledWsClient (npm: rippled-ws-client)'
              }))
            }
          }

          if (typeof Transaction === 'string' && Transaction.trim().substring(0, 1) === '{') {
            // Probably JSON, try to decode
            try {
              Transaction = JSON.parse(Transaction.trim())
            } catch (e) {
              reject(new RippledWsClientSignError('The transaction looks like a JSON string, but could not be decoded', {
                type: 'invalid_transaction_jsonstring',
                message: 'The transaction looks like a JSON string, but could not be decoded',
                error: e
              }))
            }
          }

          if (typeof Transaction === 'object') {
            if (typeof Transaction.Account === 'string') {
              if (!SubmitTxOnline) {
                // Offline, so sequence & fee cannot be retrieved.
                // Check if they are present
                if (typeof Transaction.Sequence === 'undefined') {
                  reject(new RippledWsClientSignError('The .Sequence property is required for offline signing', {
                    type: 'sequence_required_offline',
                    message: 'The .Sequence property is required for offline signing'
                  }))
                }
                if (typeof Transaction.Fee === 'undefined') {
                  reject(new RippledWsClientSignError('The .Fee property is required for offline signing', {
                    type: 'fee_required_offline',
                    message: 'The .Fee property is required for offline signing'
                  }))
                }
              }

              if (typeof Transaction.Fee !== 'undefined') Transaction.Fee += ''
              if (typeof Transaction.Amount !== 'undefined') Transaction.Amount += ''

              if (typeof Transaction.Sequence === 'string') {
                Transaction.Sequence = parseInt(Transaction.Sequence)
                if (isNaN(Transaction.Sequence)) {
                  reject(new RippledWsClientSignError('The .Sequence property is invalid (expected number)', {
                    type: 'sequence_not_a_number',
                    message: 'The .Sequence property is invalid (expected number)'
                  }))
                }
              }

              if (!SubmitTxOnline) {
                try {
                  let SignedTransaction = SignTransaction(Transaction, Keypair)
                  resolve(SignedTransaction)
                } catch (e) {
                  reject(new RippledWsClientSignError('Error signing the transaction', {
                    type: 'sign_error',
                    message: 'Error signing the transaction',
                    error: e
                  }))
                }
              } else {
                const SignAndSubmit = () => {
                  if (typeof Transaction.Fee === 'undefined') {
                    Transaction.Fee = RippledWsClient.getState().fee.avg + ''
                  }
                  if (typeof Transaction.LastLedgerSequence !== 'undefined' && Transaction.LastLedgerSequence === null) {
                    Transaction.LastLedgerSequence = RippledWsClient.getState().ledger.last + 5
                  }
                  try {
                    let SignedTransaction = SignTransaction(Transaction, Keypair)
                    SendTransaction(SignedTransaction)
                  } catch (e) {
                    reject(new RippledWsClientSignError('Error signing the transaction', {
                      type: 'sign_error',
                      message: 'Error signing the transaction',
                      error: e
                    }))
                  }
                }
                if (typeof Transaction.Sequence === 'undefined') {
                  RippledWsClient.send({
                    command: 'account_info',
                    account: Transaction.Account
                  }).then((AccountInfo) => {
                    if (typeof AccountInfo.account_data !== 'undefined') {
                      Transaction.Sequence = AccountInfo.account_data.Sequence
                      SignAndSubmit()
                    } else {
                      let MessageAppend = ''
                      if (typeof AccountInfo.error_message !== 'undefined') {
                        MessageAppend += ': ' + AccountInfo.error_message
                      }
                      reject(new RippledWsClientSignError('No account_data from account_info request' + MessageAppend, {
                        type: 'account_info_invalid',
                        message: 'No account_data from account_info request' + MessageAppend,
                        error: AccountInfo
                      }))
                    }
                  }).catch((e) => {
                    reject(new RippledWsClientSignError('Error retrieving account_info', {
                      type: 'account_info_error',
                      message: 'Error retrieving account_info',
                      error: e
                    }))
                  })
                } else {
                  SignAndSubmit()
                }
              }
            } else {
              reject(new RippledWsClientSignError('Invalid transaction object, .Account property not found', {
                type: 'invalid_transaction_json',
                message: 'Invalid transaction object, .Account property not found'
              }))
            }
          } else {
            reject(new RippledWsClientSignError('Invalid transaction, expecting Ripple TX object (JSON) or JSON encoded string', {
              type: 'invalid_transaction_type',
              message: 'Invalid transaction, expecting Ripple TX object (JSON) or JSON encoded string'
            }))
          }
        }
      }
    })
  }
}

module.exports = RippledWsClientSign
