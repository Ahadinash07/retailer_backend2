const db = require('../../Models/db');
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const env = require('dotenv');
env.config();


const RetailerRegistationController = async (req, res) => {
    const { Retailer_Name, email, password } = req.body;

    try {
        const checkUserQuery = `SELECT * FROM RetailerRegistration WHERE email = ?`;
        db.query(checkUserQuery, [email], async (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            if (results.length > 0) {
                return res.status(400).json({ message: 'User already exists' });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const insertUserQuery = `INSERT INTO RetailerRegistration (retailerId, Retailer_Name, email, password) VALUES (UUID(), ?, ?, ?)`;
            db.query(insertUserQuery, [Retailer_Name, email, hashedPassword], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Error in retailer registration' });
                }
                return res.status(201).json({ message: 'User registered successfully', result });
            });
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};
    

const RetailerLoginController = async (req, res) => {
    const { email, password } = req.body;

    try {
        const checkUserQuery = `SELECT * FROM RetailerRegistration WHERE email = ?`;
        db.query(checkUserQuery, [email], async (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            if (results.length === 0) {
                return res.status(400).json({ message: 'User not found' });
            }

            const user = results[0];
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const updateStatusQuery = `UPDATE RetailerRegistration SET status = 'Active' WHERE retailerId = ?`;
            db.query(updateStatusQuery, [user.retailerId], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Error updating status' });
                }

                const token = jwt.sign({ retailerId: user.retailerId }, process.env.JWT_SECRET, { expiresIn: '1h' });

                return res.status(200).json({ message: 'Login successful', token, retailer: {retailerId: user.retailerId, Retailer_Name: user.Retailer_Name, email: user.email, },});
            });
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};


const RetailerLogoutController = async (req, res) => {
    const { retailerId } = req.body;

    if (!retailerId) {
        return res.status(400).json({ message: 'Retailer ID is required' });
    }

    try {
        const updateStatusQuery = `UPDATE RetailerRegistration SET status = 'Inactive' WHERE retailerId = ?`;
        
        db.query(updateStatusQuery, [retailerId], (err, result) => {
            if (err) {
                console.error('Error updating status:', err);
                return res.status(500).json({ message: 'Error updating status' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Retailer not found' });
            }

            return res.status(200).json({ message: 'Logout successful' });
        });
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


const RetailerUpdateController = async (req, res) => {
    const { Retailer_Name, email, password } = req.body;

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const updateUserQuery = `UPDATE RetailerRegistration SET Retailer_Name = ?, email = ?, password = ? WHERE retailerId = ?`;
        db.query(updateUserQuery, [ Retailer_Name, email, hashedPassword, req.params.retailerId ], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            return res.status(200).json({ message: 'User updated successfully' });
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};


const RetailerUpdatePasswordController = async (req, res) => {
    const { password } = req.body;

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const updatePasswordQuery = `UPDATE RetailerRegistration SET password = ? WHERE retailerId = ?`;
        db.query(updatePasswordQuery, [hashedPassword, req.params.retailerId], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            return res.status(200).json({ message: 'Password updated successfully' });
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};


const RetailerDeleteController = async (req, res) => {
    const deleteUserQuery = `DELETE FROM RetailerRegistration WHERE retailerId = ?`;
    db.query(deleteUserQuery, [req.params.retailerId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        return res.status(200).json({ message: 'User deleted successfully' });
    });
};


const getRetailerDetails = async (req, res) => {
    const getRetailerQuery = `SELECT retailerId, Retailer_Name, email, status, Registered_at FROM RetailerRegistration WHERE retailerId = ?`;
    db.query(getRetailerQuery, [req.params.retailerId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        return res.status(200).json({ message: 'Retailer details', result });
    });
};


const RetailerUpdateStatusController = async (req, res) => {
    const { status } = req.body;

    const updateStatusQuery = `UPDATE RetailerRegistration SET status = ? WHERE retailerId = ?`;
    db.query(updateStatusQuery, [status, req.params.retailerId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        return res.status(200).json({ message: 'Retailer status updated successfully' });
    });
};



const getRetailerOrders = async (req, res) => {
    const retailerId = req.retailerId;
    const query = `
        SELECT DISTINCT
            o.order_id, 
            o.user_id, 
            CAST(o.total_amount AS DECIMAL(10,2)) AS total_amount, 
            o.order_status, 
            o.payment_status, 
            o.created_at,
            GROUP_CONCAT(DISTINCT p.productName ORDER BY p.productName SEPARATOR ', ') AS productName,
            SUM(oi.quantity) AS quantity,
            u.first_name, 
            u.last_name, 
            u.email,
            a.address_line, 
            a.city, 
            a.state, 
            a.zip_code, 
            a.phone,
            ot.status AS tracking_status, 
            ot.notes AS tracking_notes
        FROM 
            orders o
            INNER JOIN order_items oi ON o.order_id = oi.order_id
            INNER JOIN product p ON oi.product_id = p.productId
            INNER JOIN users u ON o.user_id = u.user_id
            INNER JOIN addresses a ON o.address_id = a.address_id
            LEFT JOIN (
                SELECT 
                    order_id, 
                    status, 
                    notes,
                    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY update_time DESC) as rn
                FROM 
                    order_tracking
            ) ot ON o.order_id = ot.order_id AND ot.rn = 1
        WHERE 
            p.retailerId = ?
        GROUP BY 
            o.order_id, 
            o.user_id, 
            o.total_amount, 
            o.order_status, 
            o.payment_status, 
            o.created_at,
            u.first_name, 
            u.last_name, 
            u.email,
            a.address_line, 
            a.city, 
            a.state, 
            a.zip_code, 
            a.phone,
            ot.status, 
            ot.notes
        ORDER BY 
            o.created_at DESC
    `;
    db.query(query, [retailerId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        // Log results to check for duplicates
        console.log('Fetched orders:', JSON.stringify(results, null, 2));
        // Check for duplicate order_id in results
        const orderIds = results.map((order) => order.order_id);
        const duplicates = orderIds.filter((id, index) => orderIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            console.warn('Duplicate order IDs in backend response:', duplicates);
        }
        return res.status(200).json({ message: 'Orders fetched successfully', orders: results });
    });
};

const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    const retailerId = req.retailerId;

    console.log('Updating order status for orderId:', orderId, 'to status:', status);

    if (!status) {
        return res.status(400).json({ message: 'Order status is required' });
    }

    try {
        const orderQuery = `
            SELECT o.order_id, o.order_status
            FROM orders o
            INNER JOIN order_items oi ON o.order_id = oi.order_id
            INNER JOIN product p ON oi.product_id = p.productId
            WHERE o.order_id = ? AND p.retailerId = ?
        `;
        db.query(orderQuery, [orderId, retailerId], (err, results) => {
            if (err) {
                console.error('Database error (order check):', err);
                return res.status(500).json({ message: 'Database error', error: err.message });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Order not found or not associated with this retailer' });
            }

            const order = results[0];
            if (order.order_status === 'Cancelled') {
                return res.status(403).json({ message: 'Cannot modify status for canceled orders' });
            }

            const updateQuery = `
                UPDATE orders
                SET order_status = ?, updated_at = NOW()
                WHERE order_id = ?
            `;
            db.query(updateQuery, [status, orderId], (err) => {
                if (err) {
                    console.error('Database error (status update):', err);
                    return res.status(500).json({ message: 'Database error', error: err.message });
                }

                return res.status(200).json({ message: 'Order status updated successfully' });
            });
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const updateOrderTracking = async (req, res) => {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    const retailerId = req.retailerId;

    console.log('Updating tracking for orderId:', orderId, 'with status:', status, 'notes:', notes);

    if (!status) {
        return res.status(400).json({ message: 'Tracking status is required' });
    }

    try {
        const orderQuery = `
            SELECT o.order_id, o.order_status
            FROM orders o
            INNER JOIN order_items oi ON o.order_id = oi.order_id
            INNER JOIN product p ON oi.product_id = p.productId
            WHERE o.order_id = ? AND p.retailerId = ?
        `;
        db.query(orderQuery, [orderId, retailerId], (err, results) => {
            if (err) {
                console.error('Database error (order check):', err);
                return res.status(500).json({ message: 'Database error', error: err.message });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Order not found or not associated with this retailer' });
            }

            const order = results[0];
            if (order.order_status === 'Cancelled') {
                return res.status(403).json({ message: 'Cannot modify tracking for canceled orders' });
            }

            const trackingQuery = `
                INSERT INTO order_tracking (tracking_id, order_id, status, notes, update_time)
                VALUES (UUID(), ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    status = VALUES(status),
                    notes = VALUES(notes),
                    update_time = NOW()
            `;
            db.query(trackingQuery, [orderId, status, notes || ''], (err) => {
                if (err) {
                    console.error('Database error (tracking update):', err);
                    return res.status(500).json({ message: 'Database error', error: err.message });
                }

                return res.status(200).json({ message: 'Tracking updated successfully' });
            });
        });
    } catch (error) {
        console.error('Error updating tracking:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};


// const getRetailerOrders = async (req, res) => {
//     const retailerId = req.retailerId;
//     const query = `
//         SELECT 
//             o.order_id, o.user_id, o.total_amount, o.order_status, o.payment_status, o.created_at,
//             oi.product_id, oi.quantity, oi.price, p.productName,
//             u.first_name, u.last_name, u.email,
//             a.address_line, a.city, a.state, a.zip_code, a.phone,
//             ot.status AS tracking_status, ot.notes AS tracking_notes
//         FROM 
//             orders o
//             INNER JOIN order_items oi ON o.order_id = oi.order_id
//             INNER JOIN product p ON oi.product_id = p.productId
//             INNER JOIN users u ON o.user_id = u.user_id
//             INNER JOIN addresses a ON o.address_id = a.address_id
//             LEFT JOIN order_tracking ot ON o.order_id = ot.order_id
//         WHERE 
//             p.retailerId = ?
//         ORDER BY 
//             o.created_at DESC
//     `;
//     db.query(query, [retailerId], (err, results) => {
//         if (err) {
//             console.error('Database error:', err);
//             return res.status(500).json({ message: 'Database error' });
//         }
//         return res.status(200).json({ message: 'Orders fetched successfully', orders: results });
//     });
// };


// const updateOrderStatus = async (req, res) => {
//     const { orderId } = req.params;
//     const { status } = req.body;
//     const retailerId = req.retailerId;

//     console.log('Updating order status for orderId:', orderId, 'to status:', status); // Debug

//     // Validate input
//     if (!status) {
//         return res.status(400).json({ message: 'Order status is required' });
//     }

//     try {
//         // Check if the order exists and belongs to the retailer
//         const orderQuery = `
//             SELECT o.order_id, o.order_status
//             FROM orders o
//             INNER JOIN order_items oi ON o.order_id = oi.order_id
//             INNER JOIN product p ON oi.product_id = p.productId
//             WHERE o.order_id = ? AND p.retailerId = ?
//         `;
//         db.query(orderQuery, [orderId, retailerId], (err, results) => {
//             if (err) {
//                 console.error('Database error (order check):', err);
//                 return res.status(500).json({ message: 'Database error', error: err.message });
//             }

//             if (results.length === 0) {
//                 return res.status(404).json({ message: 'Order not found or not associated with this retailer' });
//             }

//             const order = results[0];
//             if (order.order_status === 'Cancelled') {
//                 return res.status(403).json({ message: 'Cannot modify status for canceled orders' });
//             }

//             // Update order status
//             const updateQuery = `
//                 UPDATE orders
//                 SET order_status = ?, updated_at = NOW()
//                 WHERE order_id = ?
//             `;
//             db.query(updateQuery, [status, orderId], (err) => {
//                 if (err) {
//                     console.error('Database error (status update):', err);
//                     return res.status(500).json({ message: 'Database error', error: err.message });
//                 }

//                 return res.status(200).json({ message: 'Order status updated successfully' });
//             });
//         });
//     } catch (error) {
//         console.error('Error updating order status:', error);
//         return res.status(500).json({ message: 'Server error', error: error.message });
//     }
// };

// const updateOrderTracking = async (req, res) => {
//     const { orderId } = req.params;
//     const { status, notes } = req.body;
//     const retailerId = req.retailerId;

//     console.log('Updating tracking for orderId:', orderId, 'with status:', status, 'notes:', notes); // Debug

//     // Validate input
//     if (!status) {
//         return res.status(400).json({ message: 'Tracking status is required' });
//     }

//     try {
//         // Check if the order exists and belongs to the retailer
//         const orderQuery = `
//             SELECT o.order_id, o.order_status
//             FROM orders o
//             INNER JOIN order_items oi ON o.order_id = oi.order_id
//             INNER JOIN product p ON oi.product_id = p.productId
//             WHERE o.order_id = ? AND p.retailerId = ?
//         `;
//         db.query(orderQuery, [orderId, retailerId], (err, results) => {
//             if (err) {
//                 console.error('Database error (order check):', err);
//                 return res.status(500).json({ message: 'Database error', error: err.message });
//             }

//             if (results.length === 0) {
//                 return res.status(404).json({ message: 'Order not found or not associated with this retailer' });
//             }

//             const order = results[0];
//             if (order.order_status === 'Cancelled') {
//                 return res.status(403).json({ message: 'Cannot modify tracking for canceled orders' });
//             }

//             // Update or insert tracking information
//             const trackingQuery = `
//                 INSERT INTO order_tracking (order_id, status, notes, created_at, updated_at)
//                 VALUES (?, ?, ?, NOW(), NOW())
//                 ON DUPLICATE KEY UPDATE
//                     status = VALUES(status),
//                     notes = VALUES(notes),
//                     updated_at = NOW()
//             `;
//             db.query(trackingQuery, [orderId, status, notes || ''], (err) => {
//                 if (err) {
//                     console.error('Database error (tracking update):', err);
//                     return res.status(500).json({ message: 'Database error', error: err.message });
//                 }

//                 return res.status(200).json({ message: 'Tracking updated successfully' });
//             });
//         });
//     } catch (error) {
//         console.error('Error updating tracking:', error);
//         return res.status(500).json({ message: 'Server error', error: error.message });
//     }
// };


// // Update Order Status
// // const updateOrderStatus = async (req, res) => {
// //     const { orderId } = req.params;
// //     const { status } = req.body;
// //     const retailerId = req.retailerId;
// //     const validStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

// //     if (!validStatuses.includes(status)) {
// //         return res.status(400).json({ message: 'Invalid status' });
// //     }

// //     const query = `
// //         UPDATE orders o
// //         INNER JOIN order_items oi ON o.order_id = oi.order_id
// //         INNER JOIN product p ON oi.product_id = p.productId
// //         SET o.order_status = ?
// //         WHERE o.order_id = ? AND p.retailerId = ?
// //     `;

// //     db.query(query, [status, orderId, retailerId], (err, result) => {
// //         if (err) {
// //             console.error('Database error:', err);
// //             return res.status(500).json({ message: 'Database error' });
// //         }
// //         if (result.affectedRows === 0) {
// //             return res.status(403).json({ message: 'Order not found or not authorized' });
// //         }
// //         return res.status(200).json({ message: 'Order status updated successfully' });
// //     });
// // };

// // // Update Tracking Information


// // const updateOrderTracking = async (req, res) => {
// //     const { orderId } = req.params;
// //     const { status, notes } = req.body;
// //     const retailerId = req.retailerId;

// //     console.log('Updating tracking for orderId:', orderId, 'with status:', status, 'notes:', notes); // Debug

// //     // Validate input
// //     if (!status) {
// //         return res.status(400).json({ message: 'Tracking status is required' });
// //     }

// //     try {
// //         // Check if the order exists and belongs to the retailer
// //         const orderQuery = `
// //             SELECT o.order_id, o.order_status
// //             FROM orders o
// //             INNER JOIN order_items oi ON o.order_id = oi.order_id
// //             INNER JOIN product p ON oi.product_id = p.productId
// //             WHERE o.order_id = ? AND p.retailerId = ?
// //         `;
// //         db.query(orderQuery, [orderId, retailerId], (err, results) => {
// //             if (err) {
// //                 console.error('Database error (order check):', err);
// //                 return res.status(500).json({ message: 'Database error', error: err.message });
// //             }

// //             if (results.length === 0) {
// //                 return res.status(404).json({ message: 'Order not found or not associated with this retailer' });
// //             }

// //             const order = results[0];
// //             if (order.order_status === 'Cancelled') {
// //                 return res.status(403).json({ message: 'Cannot modify tracking for canceled orders' });
// //             }

// //             // Update or insert tracking information
// //             const trackingQuery = `
// //                 INSERT INTO order_tracking (order_id, status, notes, created_at, updated_at)
// //                 VALUES (?, ?, ?, NOW(), NOW())
// //                 ON DUPLICATE KEY UPDATE
// //                     status = VALUES(status),
// //                     notes = VALUES(notes),
// //                     updated_at = NOW()
// //             `;
// //             db.query(trackingQuery, [orderId, status, notes || ''], (err) => {
// //                 if (err) {
// //                     console.error('Database error (tracking update):', err);
// //                     return res.status(500).json({ message: 'Database error', error: err.message });
// //                 }

// //                 return res.status(200).json({ message: 'Tracking updated successfully' });
// //             });
// //         });
// //     } catch (error) {
// //         console.error('Error updating tracking:', error);
// //         return res.status(500).json({ message: 'Server error', error: error.message });
// //     }
// // };


// // const updateOrderTracking = async (req, res) => {
// //     const { orderId } = req.params;
// //     const { status, notes } = req.body;
// //     const retailerId = req.retailerId;
// //     const validStatuses = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

// //     if (!validStatuses.includes(status)) {
// //         return res.status(400).json({ message: 'Invalid tracking status' });
// //     }

// //     const query = `
// //         INSERT INTO order_tracking (tracking_id, order_id, status, notes)
// //         SELECT UUID(), ?, ?, ?
// //         FROM order_items oi
// //         INNER JOIN product p ON oi.product_id = p.productId
// //         WHERE oi.order_id = ? AND p.retailerId = ?
// //     `;

// //     db.query(query, [orderId, status, notes, orderId, retailerId], (err, result) => {
// //         if (err) {
// //             console.error('Database error:', err);
// //             return res.status(500).json({ message: 'Database error' });
// //         }
// //         if (result.affectedRows === 0) {
// //             return res.status(403).json({ message: 'Order not found or not authorized' });
// //         }
// //         return res.status(200).json({ message: 'Tracking updated successfully' });
// //     });
// // };



module.exports = { RetailerRegistationController, RetailerLoginController, RetailerLogoutController, RetailerUpdateController, RetailerUpdatePasswordController, RetailerDeleteController, getRetailerDetails, RetailerUpdateStatusController, getRetailerOrders, updateOrderStatus, updateOrderTracking };