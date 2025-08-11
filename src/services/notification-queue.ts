import { EventEmitter } from 'events';
import { 
  QueuedNotification, 
  NotificationMessage, 
  NotificationStatus, 
  NotificationPriority,
  NotificationQueueStats 
} from '../types/notification';

export interface QueueOptions {
  maxConcurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
  processingTimeout?: number;
}

export class NotificationQueue extends EventEmitter {
  private queue: QueuedNotification[] = [];
  private processing: Map<string, QueuedNotification> = new Map();
  private completed: Set<string> = new Set();
  private failed: Map<string, { notification: QueuedNotification; error: string }> = new Map();
  private isProcessing = false;
  private options: Required<QueueOptions>;

  constructor(options: QueueOptions = {}) {
    super();
    this.options = {
      maxConcurrency: options.maxConcurrency || 5,
      retryDelay: options.retryDelay || 5000,
      maxRetries: options.maxRetries || 3,
      processingTimeout: options.processingTimeout || 30000
    };
  }

  /**
   * Add a notification to the queue
   */
  async enqueue(notification: QueuedNotification): Promise<void> {
    // Insert based on priority
    const insertIndex = this.findInsertIndex(notification.priority);
    this.queue.splice(insertIndex, 0, notification);
    
    this.emit('enqueued', notification);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Start processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.emit('processingStarted');

    while (this.queue.length > 0 || this.processing.size > 0) {
      // Process notifications up to max concurrency
      while (this.processing.size < this.options.maxConcurrency && this.queue.length > 0) {
        const notification = this.queue.shift()!;
        
        // Check if scheduled for future
        if (notification.scheduledAt && notification.scheduledAt > new Date()) {
          // Re-queue for later
          this.queue.push(notification);
          continue;
        }

        this.processing.set(notification.messageId, notification);
        this.processNotification(notification);
      }

      // Wait a bit before checking again
      await this.sleep(100);
    }

    this.isProcessing = false;
    this.emit('processingCompleted');
  }

  /**
   * Process a single notification
   */
  private async processNotification(notification: QueuedNotification): Promise<void> {
    try {
      this.emit('processing', notification);
      
      // Set processing timeout
      const timeoutId = setTimeout(() => {
        this.handleProcessingTimeout(notification);
      }, this.options.processingTimeout);

      // Emit for external processing
      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        this.emit('process', notification, resolve);
      });

      clearTimeout(timeoutId);

      if (result.success) {
        this.completed.add(notification.messageId);
        this.emit('completed', notification);
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      await this.handleProcessingError(notification, error as Error);
    } finally {
      this.processing.delete(notification.messageId);
    }
  }

  /**
   * Handle processing timeout
   */
  private handleProcessingTimeout(notification: QueuedNotification): void {
    const error = new Error(`Processing timeout after ${this.options.processingTimeout}ms`);
    this.handleProcessingError(notification, error);
  }

  /**
   * Handle processing error with retry logic
   */
  private async handleProcessingError(notification: QueuedNotification, error: Error): Promise<void> {
    const retryCount = (notification.metadata?.retryCount || 0) + 1;
    
    if (retryCount <= this.options.maxRetries) {
      // Retry after delay
      notification.metadata = { 
        ...notification.metadata, 
        retryCount,
        lastError: error.message 
      };
      
      setTimeout(() => {
        this.enqueue(notification);
      }, this.options.retryDelay * retryCount);
      
      this.emit('retrying', notification, error);
    } else {
      // Max retries reached
      this.failed.set(notification.messageId, { 
        notification, 
        error: error.message 
      });
      this.emit('failed', notification, error);
    }
  }

  /**
   * Find insert index based on priority
   */
  private findInsertIndex(priority: NotificationPriority): number {
    const priorityOrder = {
      [NotificationPriority.URGENT]: 0,
      [NotificationPriority.HIGH]: 1,
      [NotificationPriority.NORMAL]: 2,
      [NotificationPriority.LOW]: 3
    };

    const targetPriority = priorityOrder[priority];
    
    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorityOrder[this.queue[i].priority];
      if (queuePriority > targetPriority) {
        return i;
      }
    }
    
    return this.queue.length;
  }

  /**
   * Get queue statistics
   */
  getStats(): NotificationQueueStats {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size
    };
  }

  /**
   * Clear completed and failed notifications
   */
  cleanup(): void {
    this.completed.clear();
    this.failed.clear();
    this.emit('cleanup');
  }

  /**
   * Stop processing and clear queue
   */
  stop(): void {
    this.queue.length = 0;
    this.processing.clear();
    this.isProcessing = false;
    this.emit('stopped');
  }

  /**
   * Get failed notifications
   */
  getFailedNotifications(): Array<{ notification: QueuedNotification; error: string }> {
    return Array.from(this.failed.values());
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}