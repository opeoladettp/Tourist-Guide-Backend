import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  NotificationDeliveryService, 
  EmailDeliveryProvider, 
  PushDeliveryProvider, 
  SMSDeliveryProvider, 
  InAppDeliveryProvider 
} from '../../services/notification-delivery';
import { NotificationChannel, NotificationPriority } from '../../types/notification';

describe('NotificationDeliveryService', () => {
  let deliveryService: NotificationDeliveryService;

  beforeEach(() => {
    deliveryService = new NotificationDeliveryService();
  });

  describe('deliver', () => {
    it('should deliver email notification', async () => {
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      const result = await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-1');
      expect(result.channel).toBe(NotificationChannel.EMAIL);
      expect(result.sentAt).toBeInstanceOf(Date);
    });

    it('should deliver push notification', async () => {
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.NORMAL
      };

      const result = await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.PUSH);
    });

    it('should deliver SMS notification', async () => {
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.SMS,
        priority: NotificationPriority.NORMAL
      };

      const result = await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.SMS);
    });

    it('should deliver in-app notification', async () => {
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.IN_APP,
        priority: NotificationPriority.NORMAL
      };

      const result = await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.IN_APP);
    });

    it('should handle unsupported channel', async () => {
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: 'UNSUPPORTED' as NotificationChannel,
        priority: NotificationPriority.NORMAL
      };

      const result = await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('No delivery provider configured');
    });
  });

  describe('registerProvider', () => {
    it('should register custom provider', async () => {
      const customProvider = {
        send: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'msg-1',
          channel: NotificationChannel.EMAIL,
          sentAt: new Date()
        })
      };

      deliveryService.registerProvider(NotificationChannel.EMAIL, customProvider);
      
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      expect(customProvider.send).toHaveBeenCalledWith(notification, 'Test Subject', 'Test Body');
    });
  });

  describe('getAvailableChannels', () => {
    it('should return all available channels', () => {
      const channels = deliveryService.getAvailableChannels();
      
      expect(channels).toContain(NotificationChannel.EMAIL);
      expect(channels).toContain(NotificationChannel.PUSH);
      expect(channels).toContain(NotificationChannel.SMS);
      expect(channels).toContain(NotificationChannel.IN_APP);
    });
  });

  describe('in-app message management', () => {
    it('should store and retrieve in-app messages', async () => {
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.IN_APP,
        priority: NotificationPriority.NORMAL
      };

      await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      const messages = deliveryService.getUserInAppMessages('user-1');
      
      expect(messages).toHaveLength(1);
      expect(messages[0].subject).toBe('Test Subject');
      expect(messages[0].body).toBe('Test Body');
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should clear user in-app messages', async () => {
      const notification = {
        messageId: 'msg-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.IN_APP,
        priority: NotificationPriority.NORMAL
      };

      await deliveryService.deliver(notification, 'Test Subject', 'Test Body');
      
      let messages = deliveryService.getUserInAppMessages('user-1');
      expect(messages).toHaveLength(1);
      
      deliveryService.clearUserInAppMessages('user-1');
      
      messages = deliveryService.getUserInAppMessages('user-1');
      expect(messages).toHaveLength(0);
    });
  });
});

describe('EmailDeliveryProvider', () => {
  let provider: EmailDeliveryProvider;

  beforeEach(() => {
    provider = new EmailDeliveryProvider();
  });

  it('should send email successfully', async () => {
    const notification = {
      messageId: 'msg-1',
      userId: 'user-1',
      templateId: 'template-1',
      variables: {},
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL
    };

    const result = await provider.send(notification, 'Test Subject', 'Test Body');
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-1');
    expect(result.channel).toBe(NotificationChannel.EMAIL);
    expect(result.sentAt).toBeInstanceOf(Date);
  });
});

describe('PushDeliveryProvider', () => {
  let provider: PushDeliveryProvider;

  beforeEach(() => {
    provider = new PushDeliveryProvider();
  });

  it('should send push notification successfully', async () => {
    const notification = {
      messageId: 'msg-1',
      userId: 'user-1',
      templateId: 'template-1',
      variables: {},
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.NORMAL
    };

    const result = await provider.send(notification, 'Test Subject', 'Test Body');
    
    expect(result.success).toBe(true);
    expect(result.channel).toBe(NotificationChannel.PUSH);
  });
});

describe('SMSDeliveryProvider', () => {
  let provider: SMSDeliveryProvider;

  beforeEach(() => {
    provider = new SMSDeliveryProvider();
  });

  it('should send SMS successfully', async () => {
    const notification = {
      messageId: 'msg-1',
      userId: 'user-1',
      templateId: 'template-1',
      variables: {},
      channel: NotificationChannel.SMS,
      priority: NotificationPriority.NORMAL
    };

    const result = await provider.send(notification, 'Test Subject', 'Test Body');
    
    expect(result.success).toBe(true);
    expect(result.channel).toBe(NotificationChannel.SMS);
  });
});

describe('InAppDeliveryProvider', () => {
  let provider: InAppDeliveryProvider;

  beforeEach(() => {
    provider = new InAppDeliveryProvider();
  });

  it('should store in-app notification', async () => {
    const notification = {
      messageId: 'msg-1',
      userId: 'user-1',
      templateId: 'template-1',
      variables: {},
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.NORMAL
    };

    const result = await provider.send(notification, 'Test Subject', 'Test Body');
    
    expect(result.success).toBe(true);
    expect(result.channel).toBe(NotificationChannel.IN_APP);
    
    const messages = provider.getUserMessages('user-1');
    expect(messages).toHaveLength(1);
    expect(messages[0].subject).toBe('Test Subject');
    expect(messages[0].body).toBe('Test Body');
  });

  it('should manage user messages', () => {
    const notification = {
      messageId: 'msg-1',
      userId: 'user-1',
      templateId: 'template-1',
      variables: {},
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.NORMAL
    };

    provider.send(notification, 'Test Subject', 'Test Body');
    
    let messages = provider.getUserMessages('user-1');
    expect(messages).toHaveLength(1);
    
    provider.clearUserMessages('user-1');
    
    messages = provider.getUserMessages('user-1');
    expect(messages).toHaveLength(0);
  });
});