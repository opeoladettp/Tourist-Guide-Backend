import { NotificationTemplate, NotificationType } from '../types/notification';

export class NotificationTemplateService {
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default notification templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>[] = [
      {
        templateId: 'tour-schedule-updated',
        name: 'Tour Schedule Updated',
        subject: 'Your tour schedule has been updated',
        body: `Hello {{firstName}},

The schedule for your tour "{{tourName}}" has been updated.

Tour Details:
- Tour: {{tourName}}
- Start Date: {{startDate}}
- End Date: {{endDate}}

Please check the updated schedule in your account.

Best regards,
{{providerName}}`,
        type: NotificationType.SCHEDULE_CHANGE,
        variables: ['firstName', 'tourName', 'startDate', 'endDate', 'providerName']
      },
      {
        templateId: 'registration-approved',
        name: 'Registration Approved',
        subject: 'Your tour registration has been approved',
        body: `Hello {{firstName}},

Great news! Your registration for "{{tourName}}" has been approved.

Tour Details:
- Tour: {{tourName}}
- Start Date: {{startDate}}
- End Date: {{endDate}}
- Meeting Point: {{meetingPoint}}

Please ensure you have all required documents ready.

Best regards,
{{providerName}}`,
        type: NotificationType.REGISTRATION_APPROVED,
        variables: ['firstName', 'tourName', 'startDate', 'endDate', 'meetingPoint', 'providerName']
      },
      {
        templateId: 'registration-rejected',
        name: 'Registration Rejected',
        subject: 'Your tour registration status',
        body: `Hello {{firstName}},

We regret to inform you that your registration for "{{tourName}}" could not be approved at this time.

Reason: {{rejectionReason}}

Please feel free to contact us if you have any questions.

Best regards,
{{providerName}}`,
        type: NotificationType.REGISTRATION_REJECTED,
        variables: ['firstName', 'tourName', 'rejectionReason', 'providerName']
      },
      {
        templateId: 'tour-update-general',
        name: 'Tour Update',
        subject: 'Important update about your tour',
        body: `Hello {{firstName}},

We have an important update regarding your tour "{{tourName}}".

{{updateMessage}}

If you have any questions, please don't hesitate to contact us.

Best regards,
{{providerName}}`,
        type: NotificationType.TOUR_UPDATE,
        variables: ['firstName', 'tourName', 'updateMessage', 'providerName']
      },
      {
        templateId: 'document-uploaded',
        name: 'Document Uploaded',
        subject: 'New document uploaded to your account',
        body: `Hello {{firstName}},

A new document has been uploaded to your account:

Document: {{documentName}}
Type: {{documentType}}
Uploaded by: {{uploaderName}}

You can view this document in your account dashboard.

Best regards,
{{providerName}}`,
        type: NotificationType.DOCUMENT_UPLOADED,
        variables: ['firstName', 'documentName', 'documentType', 'uploaderName', 'providerName']
      }
    ];

    defaultTemplates.forEach(template => {
      const fullTemplate: NotificationTemplate = {
        ...template,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.templates.set(template.templateId, fullTemplate);
    });
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: NotificationType): NotificationTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.type === type);
  }

  /**
   * Add or update template
   */
  setTemplate(template: NotificationTemplate): void {
    this.templates.set(template.templateId, {
      ...template,
      updatedAt: new Date()
    });
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Render template with variables
   */
  renderTemplate(templateId: string, variables: Record<string, any>): { subject: string; body: string } | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    const subject = this.replaceVariables(template.subject, variables);
    const body = this.replaceVariables(template.body, variables);

    return { subject, body };
  }

  /**
   * Replace template variables with actual values
   */
  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const value = variables[variableName];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(templateId: string, variables: Record<string, any>): { valid: boolean; missingVariables: string[] } {
    const template = this.templates.get(templateId);
    if (!template) {
      return { valid: false, missingVariables: [] };
    }

    const missingVariables = template.variables.filter(variable => 
      variables[variable] === undefined || variables[variable] === null
    );

    return {
      valid: missingVariables.length === 0,
      missingVariables
    };
  }
}