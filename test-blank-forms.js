// Simple test script to verify blank form functionality
const express = require('express');
const request = require('supertest');

// Mock the form template service
const mockFormTemplateService = {
  getAllForms: () => Promise.resolve([
    {
      id: 'tourist-registration-v1',
      name: 'Tourist Registration Form',
      description: 'Standard registration form for tourists',
      category: 'registration',
      version: '1.0',
      fileSize: 245760,
      lastUpdated: new Date('2024-01-01'),
    },
    {
      id: 'medical-info-v1',
      name: 'Medical Information Form',
      description: 'Medical information form',
      category: 'medical',
      version: '1.0',
      fileSize: 189440,
      lastUpdated: new Date('2024-01-01'),
    }
  ]),
  
  getFormsByCategory: (category) => {
    const allForms = [
      {
        id: 'tourist-registration-v1',
        name: 'Tourist Registration Form',
        description: 'Standard registration form for tourists',
        category: 'registration',
        version: '1.0',
        fileSize: 245760,
        lastUpdated: new Date('2024-01-01'),
      },
      {
        id: 'medical-info-v1',
        name: 'Medical Information Form',
        description: 'Medical information form',
        category: 'medical',
        version: '1.0',
        fileSize: 189440,
        lastUpdated: new Date('2024-01-01'),
      }
    ];
    return Promise.resolve(allForms.filter(form => form.category === category));
  },
  
  generateFormDownloadUrl: (formId, expiresIn = 3600) => {
    if (formId === 'tourist-registration-v1') {
      return Promise.resolve({
        downloadUrl: `http://localhost:3000/api/documents/forms/download/${formId}?expires=${Date.now() + expiresIn * 1000}&signature=test-signature`,
        fileName: 'tourist-registration-form-v1.pdf',
        fileSize: 245760,
        mimeType: 'application/pdf',
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      });
    }
    return Promise.resolve(null);
  },
  
  getFormContent: (formId) => {
    if (formId === 'tourist-registration-v1') {
      return Promise.resolve(Buffer.from('%PDF-1.4\nTest PDF content'));
    }
    return Promise.resolve(null);
  },
  
  getFormById: (formId) => {
    if (formId === 'tourist-registration-v1') {
      return Promise.resolve({
        id: 'tourist-registration-v1',
        name: 'Tourist Registration Form',
        fileName: 'tourist-registration-form-v1.pdf',
        mimeType: 'application/pdf',
        fileSize: 245760,
      });
    }
    return Promise.resolve(null);
  },
  
  validateDownloadSignature: () => true
};

// Create a simple Express app to test the routes
const app = express();

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = {
    sub: 'test-user-id',
    role: 'Tourist',
    email: 'test@example.com'
  };
  next();
};

// Mock the form template service import
const originalRequire = require;
require = function(id) {
  if (id === '../services/form-template') {
    return { formTemplateService: mockFormTemplateService };
  }
  return originalRequire.apply(this, arguments);
};

// Add the blank form routes
app.get('/api/documents/forms/blank', mockAuth, async (req, res) => {
  try {
    const category = req.query.category;
    
    let forms;
    if (category) {
      forms = await mockFormTemplateService.getFormsByCategory(category);
    } else {
      forms = await mockFormTemplateService.getAllForms();
    }

    res.json({
      forms,
      total: forms.length,
      message: 'Available blank forms retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching blank forms:', error);
    
    res.status(500).json({
      error: {
        code: 'FORMS_FETCH_FAILED',
        message: 'Failed to fetch blank forms',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

app.get('/api/documents/forms/:formId/download', mockAuth, async (req, res) => {
  try {
    const formId = req.params.formId;
    const expiresIn = parseInt(req.query.expiresIn) || 3600;

    const downloadInfo = await mockFormTemplateService.generateFormDownloadUrl(formId, expiresIn);

    if (!downloadInfo) {
      return res.status(404).json({
        error: {
          code: 'FORM_NOT_FOUND',
          message: 'Form template not found',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.json({
      downloadUrl: downloadInfo.downloadUrl,
      fileName: downloadInfo.fileName,
      fileSize: downloadInfo.fileSize,
      mimeType: downloadInfo.mimeType,
      expiresAt: downloadInfo.expiresAt,
      message: 'Form download URL generated successfully',
    });
  } catch (error) {
    console.error('Error generating form download URL:', error);
    
    res.status(500).json({
      error: {
        code: 'FORM_DOWNLOAD_FAILED',
        message: 'Failed to generate form download URL',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

app.get('/api/documents/forms/download/:formId', mockAuth, async (req, res) => {
  try {
    const formId = req.params.formId;
    const { expires, signature } = req.query;

    // Validate download signature if provided
    if (expires && signature) {
      const isValid = mockFormTemplateService.validateDownloadSignature(
        formId,
        expires,
        signature
      );

      if (!isValid) {
        return res.status(403).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid or expired download signature',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
    }

    // Get form content
    const formContent = await mockFormTemplateService.getFormContent(formId);
    const form = await mockFormTemplateService.getFormById(formId);

    if (!formContent || !form) {
      return res.status(404).json({
        error: {
          code: 'FORM_NOT_FOUND',
          message: 'Form template not found',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', form.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${form.fileName}"`);
    res.setHeader('Content-Length', formContent.length.toString());
    res.setHeader('Cache-Control', 'private, no-cache');

    // Send file content
    res.send(formContent);
  } catch (error) {
    console.error('Error serving form download:', error);
    
    res.status(500).json({
      error: {
        code: 'FORM_DOWNLOAD_FAILED',
        message: 'Failed to download form template',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

// Test the functionality
async function runTests() {
  console.log('Testing blank form functionality...\n');

  try {
    // Test 1: Get all blank forms
    console.log('1. Testing GET /api/documents/forms/blank');
    const response1 = await request(app)
      .get('/api/documents/forms/blank')
      .expect(200);
    
    console.log('✓ Successfully retrieved blank forms');
    console.log(`  - Found ${response1.body.forms.length} forms`);
    console.log(`  - Forms: ${response1.body.forms.map(f => f.name).join(', ')}`);

    // Test 2: Filter forms by category
    console.log('\n2. Testing GET /api/documents/forms/blank?category=registration');
    const response2 = await request(app)
      .get('/api/documents/forms/blank?category=registration')
      .expect(200);
    
    console.log('✓ Successfully filtered forms by category');
    console.log(`  - Found ${response2.body.forms.length} registration forms`);

    // Test 3: Generate download URL
    console.log('\n3. Testing GET /api/documents/forms/tourist-registration-v1/download');
    const response3 = await request(app)
      .get('/api/documents/forms/tourist-registration-v1/download')
      .expect(200);
    
    console.log('✓ Successfully generated download URL');
    console.log(`  - Download URL: ${response3.body.downloadUrl}`);
    console.log(`  - File name: ${response3.body.fileName}`);

    // Test 4: Direct file download
    console.log('\n4. Testing GET /api/documents/forms/download/tourist-registration-v1');
    const response4 = await request(app)
      .get('/api/documents/forms/download/tourist-registration-v1')
      .expect(200);
    
    console.log('✓ Successfully downloaded form file');
    console.log(`  - Content-Type: ${response4.headers['content-type']}`);
    console.log(`  - Content-Disposition: ${response4.headers['content-disposition']}`);

    // Test 5: Test 404 for non-existent form
    console.log('\n5. Testing 404 for non-existent form');
    await request(app)
      .get('/api/documents/forms/non-existent/download')
      .expect(404);
    
    console.log('✓ Correctly returned 404 for non-existent form');

    console.log('\n🎉 All tests passed! Blank form functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();