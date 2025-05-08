/* eslint-disable no-console */
export const commitWithRetry = async (session) => {
  try {
    await session.commitTransaction()
    console.log('Transaction committed.')
  } catch (error) {
    if (error.hasErrorLabel('UnknownTransactionCommitResult')) {
      console.log('UnknownTransactionCommitResult, retrying commit ...')
      await commitWithRetry(session)
    } else {
      throw error
    }
  }
}

export const runTransactionWithRetry = async (txnFunc, client, session) => {
  try {
    await txnFunc(session)
  } catch (error) {
    if (error.hasErrorLabel?.('TransientTransactionError')) {
      console.log('TransientTransactionError, retrying transaction ...')
      await runTransactionWithRetry(txnFunc, client, session)
    } else {
      throw error
    }
  }
}
