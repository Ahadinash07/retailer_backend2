const jwt = require('jsonwebtoken');
const env = require('dotenv');
env.config();

const authenticateRetailer = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    // console.log('Token received:', token); 
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log('Decoded token:', decoded); 
        req.retailerId = decoded.retailerId;
        next();
    } catch (error) {
        console.error('Token verification error:', error.message); // Debug
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = { authenticateRetailer };