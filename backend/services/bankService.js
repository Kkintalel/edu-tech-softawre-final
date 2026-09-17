const createBankTransfer = async ({ amount, bankName, bankAccount, accountHolderName, reference }) => {
    const provider = String(process.env.BANK_PROVIDER || 'demo').trim().toLowerCase();

    if (provider !== 'demo') {
        return {
            success: false,
            error: `Unsupported bank provider: ${provider}. Configure a bank adapter before enabling live transfers.`
        };
    }

    const transactionId = `DEMO-BANK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    console.log(`[BANK DEMO] Transfer simulated: ${transactionId}`);
    console.log(`[BANK DEMO] Amount: ${amount}; Bank: ${bankName || 'N/A'}; Account: ${bankAccount || 'N/A'}; Holder: ${accountHolderName || 'N/A'}; Reference: ${reference || 'N/A'}`);

    return {
        success: true,
        provider: 'demo',
        transactionId,
        status: 'Submitted'
    };
};

module.exports = { createBankTransfer };
