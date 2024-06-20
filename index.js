const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const uniquid = require('uniqid');
const dotenv = require('dotenv');





// Load environment variables from .env file


const PHONE_PAY_HOST_URL = "https://api.phonepe.com/apis/hermes";
const MERCHANT_ID = "M22RVI5EFV8KB";
const SALT_INDEX = 1;
const SALT_KEY = "05421b16-18e2-4989-b583-e69e980deaec";

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));

// Set the view engine to ejs
app.set('view engine', 'ejs');

app.post("/pay", (req, res) => {
    const payEndpoint = "/pg/v1/pay";
    const merchantTransactionId = uniquid();
    const userid = 123;
    const total = req.body.totalAmount; // Retrieve the total amount from the request body

    if (typeof total === 'undefined') {
        return res.status(400).send({ error: "Total amount is missing in the request body" });
    }

    const payload = {
        "merchantId": MERCHANT_ID,
        "merchantTransactionId": merchantTransactionId,
        "merchantUserId": userid,
        "amount": total * 100,
        "redirectUrl": `http://fahnevents/redirect-url/${merchantTransactionId}`,
        "redirectMode": "REDIRECT",
        "callbackUrl": `http://fahnevents/callback-url/${merchantTransactionId}`,
        "mobileNumber": "9880822866",
        "paymentInstrument": {
            "type": "PAY_PAGE"
        }
    };

    // Convert payload to base64
    const bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
    const base64EncodedPayload = bufferObj.toString("base64");

    // Compute X-VERIFY header
    const hash = crypto.createHash('sha256');
    hash.update(base64EncodedPayload + payEndpoint + SALT_KEY);
    const xVerify = hash.digest('hex') + "###" + SALT_INDEX;

    const options = {
        method: 'post',
        url: `${PHONE_PAY_HOST_URL}${payEndpoint}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify
        },
        data: {
            request: base64EncodedPayload
        }
    };

    axios.request(options)
        .then(function (response) {
            console.log(response.data);
            const url = response.data.data.instrumentResponse.redirectInfo.url;
            res.redirect(url); // Redirect to PhonePe payment page
        })
        .catch(function (error) {
            console.error(error);
            res.status(500).send(error);
        });
});

// Endpoint to handle redirect callback
app.get('/redirect-url/:merchantTransactionId', (req, res) => {
    const { merchantTransactionId } = req.params;
    console.log('merchantTransactionId', merchantTransactionId);
    if (merchantTransactionId) {
        const payEndpoint = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
        const hash = crypto.createHash('sha256');
        hash.update(payEndpoint + SALT_KEY);
        const xVerify = hash.digest('hex') + '###' + SALT_INDEX;
        const options = {
            method: 'get',
            url: `${PHONE_PAY_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-MERCHANT-ID': MERCHANT_ID,
                'X-VERIFY': xVerify
            },
        };

        axios.request(options)
            .then(function (response) {
                console.log(response.data);
                res.send(response.data);
                if (response.data.code == 'PAYMENT_SUCCESS') {
                    // Handle payment success logic here (e.g., update database)
                    res.redirect('/success');
                }
            })
            .catch(function (error) {
                console.error(error);
                res.status(500).send(error);
            });
    } else {
        res.status(400).send({ error: 'Invalid transaction ID' });
    }
});

// Middleware to parse JSON and URL-encoded bodies

// Serve static files

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/tickets", (req, res) => {
    res.render("tickets");
});

app.get("/learnmore", (req, res) => {
    res.render("learn");
});

app.get('/checkout/success', (req, res) => {
    // Generate order ID (incremental starting from 1000)
    const orderId = 1000 + Math.floor(Math.random() * 1000); // Adjust as needed

    // Render success page with order details
    res.render('success', { orderId });
});

app.get("/policy", (req, res) => {
    res.render("policies");
});

app.get("/contact", (req, res) => {
    res.render("contact");
});

app.get('/general', (req, res) => {
    const { ticketType } = req.query;
    res.render('general', { ticketType });
});

app.get('/vip', (req, res) => {
    const { ticketType } = req.query;
    res.render('vip', { ticketType });
});

app.get('/checkout', (req, res) => {
    const checkoutData = {
        generalQuantity: req.query.generalQuantity || 0,
        vipQuantity: req.query.vipQuantity || 0,
        vvipQuantity: req.query.vvipQuantity || 0
    };
    res.render('checkout', { checkoutData });
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.post('/checkout', (req, res) => {
    const { generalQuantity, vipQuantity, vvipQuantity } = req.body;
    res.render('checkout', { generalQuantity, vipQuantity, vvipQuantity });
});

app.post('/purchase', (req, res) => {
    const { generalQuantity, vipQuantity, vvipQuantity } = req.body;
    const qrCodesData = generateQRCodeData(generalQuantity, vipQuantity, vvipQuantity);

    // Save the QR code data into a JSON file
    saveQRCodeData(qrCodesData);

    // Send response indicating purchase complete
    res.send('Purchase complete');
});

app.post('/checkout/success', (req, res) => {
    // Handle any processing related to the successful checkout here
    res.render('success');
});

// Function to generate QR code data
function generateQRCodeData(generalQuantity, vipQuantity, vvipQuantity) {
    const qrCodesData = [];

    // Generate QR code data for each ticket type
    for (let i = 0; i < generalQuantity; i++) {
        qrCodesData.push({ ticketType: 'General', qrCodeId: uuidv4() });
    }
    for (let i = 0; i < vipQuantity; i++) {
        qrCodesData.push({ ticketType: 'VIP', qrCodeId: uuidv4() });
    }
    for (let i = 0; i < vvipQuantity; i++) {
        qrCodesData.push({ ticketType: 'VVIP', qrCodeId: uuidv4() });
    }

    return qrCodesData;
}

// Function to save QR code data into a JSON file
function saveQRCodeData(data) {
    const jsonData = JSON.stringify(data);

    fs.writeFile('qr_codes.json', jsonData, (err) => {
        if (err) {
            console.error('Error saving QR code data:', err);
        } else {
            console.log('QR code data saved successfully');
        }
    });
}

// Start server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
