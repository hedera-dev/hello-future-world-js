const ANSI_ESCAPE_CODE_BLUE = '\x1b[34m%s\x1b[0m';
const HELLIP_CHAR = '…';

function blueLog(str) {
    console.log(ANSI_ESCAPE_CODE_BLUE, '🔵', str);
}

function convertTransactionIdForMirrorNodeApi(txId) {
    // The transaction ID has to be converted to the correct format to pass in the mirror node query (0.0.x@x.x to 0.0.x-x-x)
    let [txIdA, txIdB] = txId.toString().split('@');
    txIdB = txIdB.replace('.', '-');
    const txIdMirrorNodeFormat = `${txIdA}-${txIdB}`;
    return txIdMirrorNodeFormat;
}

module.exports = {
    ANSI_ESCAPE_CODE_BLUE,
    HELLIP_CHAR,
    blueLog,
    convertTransactionIdForMirrorNodeApi,
};
