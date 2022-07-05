const express = require('express')
const bodyParser = require('body-parser');
const { body, validationResult} = require('express-validator');
const app = express()

/// @author Goke Adewuyi
/// @title LannisterPay API
app.use(bodyParser.json({
    extended: true
}));

app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', (req, res) => {
    res.json({message: "Welcome to LannisterPay"});
})

app.post('/split-payments/compute',
    body('ID').not().isEmpty()
        .withMessage('ID is required.').trim().escape(),
    body('Amount').not().isEmpty()
        .withMessage('Amount is required.').isNumeric()
        .withMessage('Amount is invalid.').trim().escape(),
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
    let data;
    try {
        data = processSplit(req.body);
    } catch (e) {
        return res.status(400).json({errors: e.message});
    }
    return res.json(data);
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Server started on port 3000.');
});

/// @notice Returns the amount of leaves the tree has.
/// @dev Returns an object.
const processSplit = (data) => {
    const {ID, Amount, SplitInfo} = data;
    let Balance = parseFloat(Amount), SplitBreakdown = [], Ratio, RatioBalance = null;
    Ratio = SplitInfo.filter(cur => cur['SplitType'] === 'RATIO').reduce((a, {SplitValue}) => a + SplitValue, 0)
    SplitInfo.sort((a, b) => {
        let fa = a['SplitType'].toLowerCase(), fb = b['SplitType'].toLowerCase();
        if (fa < fb) return -1;
        if (fa > fb) return 1;
        return 0;
    })
    SplitInfo.forEach(cur => {
        let Price, i = false;
        switch (cur['SplitType']) {
            case 'FLAT':
                Price = cur['SplitValue'];
                break;
            case 'PERCENTAGE':
                Price = (cur['SplitValue'] / 100) * Balance;
                break;
            case 'RATIO':
                i = true
                Price = (cur['SplitValue'] / Ratio) * (RatioBalance ?? Balance);
                break;
        }
        if (Price < 0)
            throw new Error('Split amount cannot be less than 0.');
        if (i) RatioBalance = RatioBalance ?? Balance;
        Balance -= Price;
        if (Balance < 0)
            throw new Error('Balance cannot be less than 0.')
        SplitBreakdown.push({
            'SplitEntityId': cur['SplitEntityId'],
            'Amount': Price
        })
    })
    return {ID, Balance, SplitBreakdown};
}
