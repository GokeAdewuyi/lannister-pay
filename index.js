const startTime = new Date().getTime();
const express = require('express')
const { body, validationResult} = require('express-validator');
const cors = require('cors');
const app = express()

/// @author Goke Adewuyi
/// @title LannisterPay API

// Middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Process Transaction
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

app.all('*',(req,res) => {
    res.status(404).json({ errors: 'Route not found' })
});


/// @notice Returns the amount of leaves the tree has.
/// @dev Returns an object.
const processSplit = (data) => {
    const {ID, Amount, SplitInfo} = data;
    let Flats = SplitInfo.filter(split => split['SplitType'] === 'FLAT'),
        Percentages = SplitInfo.filter(split => split['SplitType'] === 'PERCENTAGE'),
        Ratios = SplitInfo.filter(split => split['SplitType'] === 'RATIO'),
        RatioSum = Ratios.reduce((a, {SplitValue}) => a + SplitValue, 0),
        Payload = {ID, Balance: parseFloat(Amount), SplitBreakdown: []}

    Flats.forEach(split => {
        const Price = split['SplitValue']
        Payload['SplitBreakdown'].push({
            'SplitEntityId': split['SplitEntityId'],
            'Amount': Price
        })
        Payload['Balance'] -= Price;
        computeBalance(Payload, Price);
    })
    Percentages.forEach(split => {
        const Price = (split['SplitValue']/100) * Payload.Balance;
        Payload['SplitBreakdown'].push({
            'SplitEntityId': split['SplitEntityId'],
            'Amount': Price
        })
        Payload['Balance'] -= Price;
        computeBalance(Payload, Price);
    })

    const RatioBalance = Payload['Balance']
    Ratios.forEach(split => {
        const Price = (split['SplitValue'] / RatioSum) * RatioBalance;
        Payload['SplitBreakdown'].push({
            'SplitEntityId': split['SplitEntityId'],
            'Amount': Price
        })
        Payload['Balance'] -= Price;
        computeBalance(Payload, Price);
    })

    const endTime = new Date().getTime();
    console.log(`Start time: ${startTime}ms`)
    console.log(`End time: ${endTime}ms`)
    console.log(`Execution time: ${Math.abs((endTime - startTime) / 1000)}ms`)
    console.log('----------------------------------------------------------------')
    return Payload;
}

const computeBalance = (Payload, Price) => {
    if (Payload['Balance'] < 0)
        throw new Error('Balance cannot be less than zero.')
    if (Price < 0)
        throw new Error('Split Amount cannot be less than zero.')
};

app.listen(process.env.PORT || 3000, () => {
    console.log('Server started on port 3000.');
});
