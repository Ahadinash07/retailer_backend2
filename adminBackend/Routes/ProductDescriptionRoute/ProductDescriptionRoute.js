const express = require('express');
const router = express.Router();
const { upload, uploadToS3 } = require('../../middleware/awsmiddleware');
const {
  AddProductDescriptionController,
  GetProductDescriptionController
} = require('../../Controllers/ProductDescriptionController/ProductDescriptionController');


router.post('/uploadMedia', upload.array('files', 7), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    if (!req.body.productId || !req.body.type) {
      return res.status(400).json({ success: false, error: 'Missing productId or type in request body' });
    }

    const validTypes = ['image', 'video'];
    if (!validTypes.includes(req.body.type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Must be "image" or "video"' });
    }

    // Upload multiple files to S3
    const uploadResults = await Promise.all(
      req.files.map(async (file) => {
        try {
          const url = await uploadToS3(file);
          return { url, filename: file.originalname };
        } catch (error) {
          console.error(`Failed to upload ${file.originalname}:`, error);
          return null;
        }
      })
    );

    const successfulUploads = uploadResults.filter(result => result !== null);

    if (successfulUploads.length === 0) {
      return res.status(500).json({ success: false, error: 'All file uploads failed' });
    }

    return res.json({
      success: true,
      uploads: successfulUploads,
      productId: req.body.productId,
      type: req.body.type
    });

  } catch (error) {
    console.error('Upload failed:', error);
    return res.status(500).json({ success: false, error: 'File upload failed', details: error.message });
  }
});

// // File upload endpoint
// router.post('/uploadMedia', upload.single('file'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'No file uploaded' 
//       });
//     }

//     if (!req.body.productId || !req.body.type) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Missing productId or type in request body' 
//       });
//     }

//     // Validate file type
//     const validTypes = ['image', 'video'];
//     if (!validTypes.includes(req.body.type)) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Invalid type. Must be "image" or "video"' 
//       });
//     }

//     // Upload to S3
//     const url = await uploadToS3(req.file);
    
//     return res.json({ 
//       success: true,
//       url,
//       productId: req.body.productId,
//       type: req.body.type
//     });

//   } catch (error) {
//     console.error('Upload failed:', error);
//     return res.status(500).json({ 
//       success: false, 
//       error: 'File upload failed',
//       details: error.message
//     });
//   }
// });

// // Main endpoints
// router.post('/productDescriptions', 
//   upload.fields([
//     { name: 'images', maxCount: 5 },
//     { name: 'videos', maxCount: 2 }
//   ]),
//   AddProductDescriptionController
// );

router.post('/productDescriptions', 
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ]),
  AddProductDescriptionController
);

router.get('/productDescriptions/:productId', GetProductDescriptionController);

module.exports = router;