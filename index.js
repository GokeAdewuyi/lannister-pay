const express = require('express')
const { body, validationResult} = require('express-validator');
const cors = require('cors');
const app = express()

/// @author Goke Adewuyi
/// @title LannisterPay API
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({message: "Welcome to LannisterPay"});
})

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
    let Balance = parseFloat(Amount), SplitBreakdown = [], RatioBalance = null;
    let Ratio = getRatio(SplitInfo);
    sortSplits(SplitInfo)
    SplitInfo.forEach(split => {
        let Price, isRatio = false;
        if (split['SplitType'] === 'FLAT') Price = split['SplitValue'];
        else if (split['SplitType'] === 'PERCENTAGE') Price = (split['SplitValue'] / 100) * Balance;
        else if (split['SplitType'] === 'RATIO') {
            isRatio = true
            Price = (split['SplitValue'] / Ratio) * (RatioBalance ?? Balance);
        }
        if (Price < 0)
            throw new Error('Split amount cannot be less than 0.');
        if (isRatio) RatioBalance = RatioBalance ?? Balance;
        Balance -= Price;
        if (Balance < 0)
            throw new Error('Balance cannot be less than 0.')
        SplitBreakdown.push({
            'SplitEntityId': split['SplitEntityId'],
            'Amount': Price
        })
    })
    return {ID, Balance, SplitBreakdown};
}

const getRatio = (Arr) => {
    return Arr.filter(split => split['SplitType'] === 'RATIO').reduce((a, {SplitValue}) => a + SplitValue, 0)
}

const sortSplits = (Arr) => {
    return Arr.sort((a, b) => {
        let fa = a['SplitType'].toLowerCase(), fb = b['SplitType'].toLowerCase();
        if (fa < fb) return -1;
        if (fa > fb) return 1;
        return 0;
    })
}

app.listen(process.env.PORT || 3000, () => {
    console.log('Server started on port 3000.');
});
