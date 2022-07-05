/// @author Goke Adewuyi
/// @title LannisterPay API

const fastify = require('fastify')({ logger: true })

// @dev Define route to process transaction.
fastify.post('/split-payments/compute', async (request, reply) => {
    try {
        return await processSplit(request.body);
    } catch (e) {
        return reply.status(400).send(JSON.parse(e.message));
    }
})

/// @dev Define route for 404.
fastify.all('*', (request,reply) => {
    reply.status(404).send({ errors: 'Route not found' })
});

/// @notice Process the split transaction and return an object.
/// @dev Returns split breakdown.
/// @param data is the split transaction to be processed.
const processSplit = async (data) => {
    /// @dev Validate the request.
    validator(data);

    /// @dev Get transaction data.
    const {ID, Amount, SplitInfo} = data;

    /// @dev Get splits of type FLAT.
    let Flats = SplitInfo.filter(split => split['SplitType'] === 'FLAT'),

        /// @dev Get splits of type PERCENTAGE.
        Percentages = SplitInfo.filter(split => split['SplitType'] === 'PERCENTAGE'),

        /// @dev Get splits of type RATIO.
        Ratios = SplitInfo.filter(split => split['SplitType'] === 'RATIO'),

        /// @dev Get total ratio.
        RatioSum = Ratios.reduce((a, {SplitValue}) => a + SplitValue, 0),

        /// @dev Define response payload.
        Payload = {ID, Balance: parseFloat(Amount), SplitBreakdown: []}

    /// @dev Process flat splits
    Flats.forEach(split => {
        /// @dev Compute split value
        const Price = split['SplitValue']

        /// @dev Update split breakdown in response payload
        Payload['SplitBreakdown'].push({
            'SplitEntityId': split['SplitEntityId'],
            'Amount': Price
        })

        /// @dev Deduct split value from balance
        Payload['Balance'] -= Price;

        /// @dev Check if balance and split value is greater than zero.
        computeBalance(Payload, Price);
    })

    /// @dev Process percentage splits
    Percentages.forEach(split => {
        /// @dev Compute split value
        const Price = (split['SplitValue']/100) * Payload.Balance;

        /// @dev Update split breakdown in response payload
        Payload['SplitBreakdown'].push({
            'SplitEntityId': split['SplitEntityId'],
            'Amount': Price
        })

        /// @dev Deduct split value from balance
        Payload['Balance'] -= Price;

        /// @dev Check if balance and split value is greater than zero.
        computeBalance(Payload, Price);
    })

    /// @dev Compute ratio balance
    const RatioBalance = Payload['Balance']

    /// @dev Process ratio splits
    Ratios.forEach(split => {
        /// @dev Compute split value
        const Price = (split['SplitValue'] / RatioSum) * RatioBalance;

        /// @dev Update split breakdown in response payload
        Payload['SplitBreakdown'].push({
            'SplitEntityId': split['SplitEntityId'],
            'Amount': Price
        })

        /// @dev Deduct split value from balance
        Payload['Balance'] -= Price;

        /// @dev Check if balance and split value is greater than zero.
        computeBalance(Payload, Price);
    })
    return Payload;
}

/// @notice Throws an error if the balance and current split value is less than zero.
/// @dev Check if the balance and current split value is greater than zero.
/// @param Payload is the response payload.
/// @param Price is the current split value.
const computeBalance = (Payload, Price) => {
    if (Payload['Balance'] < 0)
        throw new Error(JSON.stringify({ errors: 'Balance cannot be less than zero.' }))
    if (Price < 0)
        throw new Error(JSON.stringify({ errors: 'Split Amount cannot be less than zero.' }))
};

/// @dev Validate request.
/// @param data is the request to be validated.
const validator = (data) => {
    let errors = [];
    if (!data['ID'])
        errors.push({'ID' : 'ID is required.' });
    if (!data['Amount'])
        errors.push({'Amount' : 'Amount is required.' });
    if (data['SplitInfo'].length < 1 || data['SplitInfo'].length > 20)
        errors.push({'SplitInfo' : 'SplitInfo must contain a minimum of 1 split entity and a maximum of 20 entities.' });
    if (errors.length > 0)
        throw new Error(JSON.stringify({ errors }));
}

/// @dev Run the server!
const start = async () => await fastify.listen({ port: process.env.PORT || 3000 })
start();
