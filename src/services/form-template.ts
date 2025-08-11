import { fileStorageService, FileStorageService } from './file-storage';
import * as path from 'path';

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fileName: string;
  version: string;
  category: 'registration' | 'medical' | 'insurance' | 'travel' | 'other';
  fileSize: number;
  mimeType: string;
  lastUpdated: Date;
  isActive: boolean;
}

export interface FormDownloadInfo {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiresAt: Date;
}

export class FormTemplateService {
  private fileStorage: FileStorageService;
  private formTemplates: FormTemplate[];

  constructor(fileStorage: FileStorageService = fileStorageService) {
    this.fileStorage = fileStorage;
    this.formTemplates = this.initializeFormTemplates();
  }

  /**
   * Initialize default form templates
   */
  private initializeFormTemplates(): FormTemplate[] {
    return [
      {
        id: 'tourist-registration-v1',
        name: 'Tourist Registration Form',
        description: 'Standard registration form for tourists including personal information, emergency contacts, and travel preferences',
        fileName: 'tourist-registration-form-v1.pdf',
        version: '1.0',
        category: 'registration',
        fileSize: 245760, // ~240KB
        mimeType: 'application/pdf',
        lastUpdated: new Date('2024-01-01'),
        isActive: true,
      },
      {
        id: 'medical-info-v1',
        name: 'Medical Information Form',
        description: 'Medical information and emergency contact form for health and safety purposes during tours',
        fileName: 'medical-information-form-v1.pdf',
        version: '1.0',
        category: 'medical',
        fileSize: 189440, // ~185KB
        mimeType: 'application/pdf',
        lastUpdated: new Date('2024-01-01'),
        isActive: true,
      },
      {
        id: 'travel-insurance-v1',
        name: 'Travel Insurance Form',
        description: 'Travel insurance documentation form for coverage verification and claims processing',
        fileName: 'travel-insurance-form-v1.pdf',
        version: '1.0',
        category: 'insurance',
        fileSize: 167936, // ~164KB
        mimeType: 'application/pdf',
        lastUpdated: new Date('2024-01-01'),
        isActive: true,
      },
      {
        id: 'emergency-contact-v1',
        name: 'Emergency Contact Form',
        description: 'Emergency contact information form for use during travel emergencies',
        fileName: 'emergency-contact-form-v1.pdf',
        version: '1.0',
        category: 'travel',
        fileSize: 143360, // ~140KB
        mimeType: 'application/pdf',
        lastUpdated: new Date('2024-01-01'),
        isActive: true,
      },
      {
        id: 'dietary-requirements-v1',
        name: 'Dietary Requirements Form',
        description: 'Dietary restrictions and food allergy information form for meal planning',
        fileName: 'dietary-requirements-form-v1.pdf',
        version: '1.0',
        category: 'other',
        fileSize: 122880, // ~120KB
        mimeType: 'application/pdf',
        lastUpdated: new Date('2024-01-01'),
        isActive: true,
      },
      {
        id: 'tour-feedback-v1',
        name: 'Tour Feedback Form',
        description: 'Post-tour feedback and evaluation form for service improvement',
        fileName: 'tour-feedback-form-v1.pdf',
        version: '1.0',
        category: 'other',
        fileSize: 98304, // ~96KB
        mimeType: 'application/pdf',
        lastUpdated: new Date('2024-01-01'),
        isActive: true,
      },
    ];
  }

  /**
   * Get all available form templates
   */
  async getAllForms(): Promise<FormTemplate[]> {
    return this.formTemplates.filter(form => form.isActive);
  }

  /**
   * Get forms by category
   */
  async getFormsByCategory(category: FormTemplate['category']): Promise<FormTemplate[]> {
    return this.formTemplates.filter(form => form.isActive && form.category === category);
  }

  /**
   * Get form template by ID
   */
  async getFormById(formId: string): Promise<FormTemplate | null> {
    const form = this.formTemplates.find(form => form.id === formId && form.isActive);
    return form || null;
  }

  /**
   * Generate download URL for form template
   */
  async generateFormDownloadUrl(
    formId: string,
    expiresIn: number = 3600
  ): Promise<FormDownloadInfo | null> {
    const form = await this.getFormById(formId);
    if (!form) {
      return null;
    }

    try {
      // In a real implementation, forms would be stored in cloud storage
      // For now, we'll generate a placeholder URL
      const formStoragePath = `forms/templates/${form.fileName}`;
      
      // Check if form exists in storage (in real implementation)
      // const exists = await this.fileStorage.fileExists(formStoragePath);
      // if (!exists) {
      //   throw new Error('Form template not found in storage');
      // }

      // Generate presigned URL (placeholder implementation)
      const downloadUrl = await this.generatePlaceholderDownloadUrl(form, expiresIn);

      return {
        downloadUrl,
        fileName: form.fileName,
        fileSize: form.fileSize,
        mimeType: form.mimeType,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (error) {
      throw new Error(`Failed to generate download URL for form ${formId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate placeholder download URL (for demonstration)
   */
  private async generatePlaceholderDownloadUrl(
    form: FormTemplate,
    expiresIn: number
  ): Promise<string> {
    // In a real implementation, this would use the file storage service
    // return await this.fileStorage.generatePresignedUrl(`forms/templates/${form.fileName}`, expiresIn);
    
    // For now, return a placeholder URL
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
    const timestamp = Date.now();
    const signature = Buffer.from(`${form.id}-${timestamp}-${expiresIn}`).toString('base64');
    
    return `${baseUrl}/documents/forms/download/${form.id}?expires=${timestamp + expiresIn * 1000}&signature=${signature}`;
  }

  /**
   * Validate form download signature (for placeholder implementation)
   */
  validateDownloadSignature(
    formId: string,
    expires: string,
    signature: string
  ): boolean {
    try {
      const expiresTime = parseInt(expires);
      if (Date.now() > expiresTime) {
        return false; // Expired
      }

      const form = this.formTemplates.find(f => f.id === formId);
      if (!form) {
        return false; // Form not found
      }

      // Simple signature validation (in real implementation, use proper signing)
      const expectedSignature = Buffer.from(`${formId}-${expiresTime - 3600 * 1000}-3600`).toString('base64');
      return signature === expectedSignature;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get form template content (placeholder implementation)
   */
  async getFormContent(formId: string): Promise<Buffer | null> {
    const form = await this.getFormById(formId);
    if (!form) {
      return null;
    }

    // In a real implementation, this would fetch from storage
    // return await this.fileStorage.getFileContent(`forms/templates/${form.fileName}`);
    
    // For now, return placeholder PDF content
    return this.generatePlaceholderPdfContent(form);
  }

  /**
   * Generate placeholder PDF content
   */
  private generatePlaceholderPdfContent(form: FormTemplate): Buffer {
    // This is a minimal PDF structure for demonstration
    // In a real implementation, you would have actual PDF templates
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 100
>>
stream
BT
/F1 12 Tf
50 750 Td
(${form.name}) Tj
0 -20 Td
(${form.description}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000424 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
521
%%EOF`;

    return Buffer.from(pdfContent);
  }

  /**
   * Search forms by name or description
   */
  async searchForms(query: string): Promise<FormTemplate[]> {
    const searchTerm = query.toLowerCase();
    return this.formTemplates.filter(form => 
      form.isActive && (
        form.name.toLowerCase().includes(searchTerm) ||
        form.description.toLowerCase().includes(searchTerm)
      )
    );
  }

  /**
   * Get form statistics
   */
  async getFormStatistics(): Promise<{
    totalForms: number;
    formsByCategory: Record<FormTemplate['category'], number>;
    totalSize: number;
    averageSize: number;
  }> {
    const activeForms = this.formTemplates.filter(form => form.isActive);
    
    const formsByCategory: Record<FormTemplate['category'], number> = {
      registration: 0,
      medical: 0,
      insurance: 0,
      travel: 0,
      other: 0,
    };

    let totalSize = 0;

    activeForms.forEach(form => {
      formsByCategory[form.category]++;
      totalSize += form.fileSize;
    });

    return {
      totalForms: activeForms.length,
      formsByCategory,
      totalSize,
      averageSize: activeForms.length > 0 ? totalSize / activeForms.length : 0,
    };
  }
}

// Export singleton instance
export const formTemplateService = new FormTemplateService();