/// @author Goke Adewuyi
/// @title LannisterPay API

const express = require('express')
const { body, validationResult} = require('express-validator');
const cors = require('cors');
const app = express()

/// @dev Middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// @dev Routes
app.post('/split-payments/compute',
    body('ID').not().isEmpty()
        .withMessage('ID is required.').trim().escape(),
    body('Amount').not().isEmpty()
        .withMessage('Amount is required.').trim().escape(),
    body('SplitInfo').custom(value => {
        if (!Array.isArray(value))
            throw new Error('SplitInfo must be an array.');
        if (value.length < 1 || value.length > 20)
            throw new Error('SplitInfo must contain a minimum of 1 split entity and a maximum of 20 entities.');
        return true;
    }),
    (req, res) => {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        const errors = [];
        validationErrors.array().forEach(cur => {
            errors.push({[cur.param]: cur.msg});
        })
        return res.status(400).json({ errors });
    }
    try {
        return res.json(processSplit(req.body));
    } catch (e) {
        return res.status(400).json({errors: e.message});
    }
})

/// @dev Define route for 404.
app.all('*',(req,res) => {
    res.status(404).json({ errors: 'Route not found' })
});

/// @notice Process the split transaction and return an object.
/// @dev Returns split breakdown.
/// @param data is the split transaction to be processed.
const processSplit = (data) => {
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
        throw new Error('Balance cannot be less than zero.')
    if (Price < 0)
        throw new Error('Split Amount cannot be less than zero.')
};

/// @dev Listen on port 3000
app.listen(process.env.PORT || 3000, () => {
    console.log('Server started on port 3000.');
});
