import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationTemplateService } from '../../services/notification-template';
import { NotificationType } from '../../types/notification';

describe('NotificationTemplateService', () => {
  let templateService: NotificationTemplateService;

  beforeEach(() => {
    templateService = new NotificationTemplateService();
  });

  describe('getTemplate', () => {
    it('should return existing template', () => {
      const template = templateService.getTemplate('tour-schedule-updated');
      
      expect(template).toBeDefined();
      expect(template?.templateId).toBe('tour-schedule-updated');
      expect(template?.type).toBe(NotificationType.SCHEDULE_CHANGE);
    });

    it('should return undefined for non-existent template', () => {
      const template = templateService.getTemplate('non-existent');
      
      expect(template).toBeUndefined();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all default templates', () => {
      const templates = templateService.getAllTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.templateId === 'tour-schedule-updated')).toBe(true);
      expect(templates.some(t => t.templateId === 'registration-approved')).toBe(true);
      expect(templates.some(t => t.templateId === 'registration-rejected')).toBe(true);
    });
  });

  describe('getTemplatesByType', () => {
    it('should return templates of specific type', () => {
      const scheduleTemplates = templateService.getTemplatesByType(NotificationType.SCHEDULE_CHANGE);
      
      expect(scheduleTemplates.length).toBeGreaterThan(0);
      expect(scheduleTemplates.every(t => t.type === NotificationType.SCHEDULE_CHANGE)).toBe(true);
    });

    it('should return empty array for non-existent type', () => {
      const templates = templateService.getTemplatesByType('NON_EXISTENT' as NotificationType);
      
      expect(templates).toHaveLength(0);
    });
  });

  describe('setTemplate', () => {
    it('should add new template', () => {
      const newTemplate = {
        templateId: 'custom-template',
        name: 'Custom Template',
        subject: 'Custom Subject',
        body: 'Custom body with {{variable}}',
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        variables: ['variable'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      templateService.setTemplate(newTemplate);
      
      const retrieved = templateService.getTemplate('custom-template');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Custom Template');
    });

    it('should update existing template', () => {
      const existingTemplate = templateService.getTemplate('tour-schedule-updated')!;
      const updatedTemplate = {
        ...existingTemplate,
        name: 'Updated Name'
      };

      templateService.setTemplate(updatedTemplate);
      
      const retrieved = templateService.getTemplate('tour-schedule-updated');
      expect(retrieved?.name).toBe('Updated Name');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete existing template', () => {
      // First add a template
      const template = {
        templateId: 'to-delete',
        name: 'To Delete',
        subject: 'Subject',
        body: 'Body',
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        variables: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      templateService.setTemplate(template);
      expect(templateService.getTemplate('to-delete')).toBeDefined();

      // Then delete it
      const deleted = templateService.deleteTemplate('to-delete');
      
      expect(deleted).toBe(true);
      expect(templateService.getTemplate('to-delete')).toBeUndefined();
    });

    it('should return false for non-existent template', () => {
      const deleted = templateService.deleteTemplate('non-existent');
      
      expect(deleted).toBe(false);
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variables', () => {
      const variables = {
        firstName: 'John',
        tourName: 'Amazing Tour',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
        providerName: 'Travel Co'
      };

      const rendered = templateService.renderTemplate('tour-schedule-updated', variables);
      
      expect(rendered).toBeDefined();
      expect(rendered?.subject).toContain('tour schedule has been updated');
      expect(rendered?.body).toContain('John');
      expect(rendered?.body).toContain('Amazing Tour');
      expect(rendered?.body).toContain('Travel Co');
    });

    it('should return null for non-existent template', () => {
      const rendered = templateService.renderTemplate('non-existent', {});
      
      expect(rendered).toBeNull();
    });

    it('should leave unreplaced variables as-is', () => {
      const variables = {
        firstName: 'John'
        // Missing other variables
      };

      const rendered = templateService.renderTemplate('tour-schedule-updated', variables);
      
      expect(rendered).toBeDefined();
      expect(rendered?.body).toContain('John');
      expect(rendered?.body).toContain('{{tourName}}'); // Should remain unreplaced
    });
  });

  describe('validateTemplateVariables', () => {
    it('should validate complete variables', () => {
      const variables = {
        firstName: 'John',
        tourName: 'Amazing Tour',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
        providerName: 'Travel Co'
      };

      const validation = templateService.validateTemplateVariables('tour-schedule-updated', variables);
      
      expect(validation.valid).toBe(true);
      expect(validation.missingVariables).toHaveLength(0);
    });

    it('should identify missing variables', () => {
      const variables = {
        firstName: 'John',
        tourName: 'Amazing Tour'
        // Missing startDate, endDate, providerName
      };

      const validation = templateService.validateTemplateVariables('tour-schedule-updated', variables);
      
      expect(validation.valid).toBe(false);
      expect(validation.missingVariables).toContain('startDate');
      expect(validation.missingVariables).toContain('endDate');
      expect(validation.missingVariables).toContain('providerName');
    });

    it('should handle null and undefined values as missing', () => {
      const variables = {
        firstName: 'John',
        tourName: null,
        startDate: undefined,
        endDate: '2024-01-20',
        providerName: 'Travel Co'
      };

      const validation = templateService.validateTemplateVariables('tour-schedule-updated', variables);
      
      expect(validation.valid).toBe(false);
      expect(validation.missingVariables).toContain('tourName');
      expect(validation.missingVariables).toContain('startDate');
    });

    it('should return invalid for non-existent template', () => {
      const validation = templateService.validateTemplateVariables('non-existent', {});
      
      expect(validation.valid).toBe(false);
      expect(validation.missingVariables).toHaveLength(0);
    });
  });

  describe('default templates', () => {
    it('should have tour schedule updated template', () => {
      const template = templateService.getTemplate('tour-schedule-updated');
      
      expect(template).toBeDefined();
      expect(template?.variables).toContain('firstName');
      expect(template?.variables).toContain('tourName');
      expect(template?.variables).toContain('startDate');
      expect(template?.variables).toContain('endDate');
      expect(template?.variables).toContain('providerName');
    });

    it('should have registration approved template', () => {
      const template = templateService.getTemplate('registration-approved');
      
      expect(template).toBeDefined();
      expect(template?.type).toBe(NotificationType.REGISTRATION_APPROVED);
      expect(template?.variables).toContain('firstName');
      expect(template?.variables).toContain('tourName');
    });

    it('should have registration rejected template', () => {
      const template = templateService.getTemplate('registration-rejected');
      
      expect(template).toBeDefined();
      expect(template?.type).toBe(NotificationType.REGISTRATION_REJECTED);
      expect(template?.variables).toContain('rejectionReason');
    });

    it('should have document uploaded template', () => {
      const template = templateService.getTemplate('document-uploaded');
      
      expect(template).toBeDefined();
      expect(template?.type).toBe(NotificationType.DOCUMENT_UPLOADED);
      expect(template?.variables).toContain('documentName');
      expect(template?.variables).toContain('documentType');
    });
  });
});