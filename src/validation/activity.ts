import Joi from 'joi';

// Create activity validation schema
export const createActivitySchema = Joi.object({
  tourEventId: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Tour event ID is required',
      'string.empty': 'Tour event ID cannot be empty'
    }),
    
  activityDate: Joi.date()
    .required()
    .messages({
      'any.required': 'Activity date is required',
      'date.base': 'Activity date must be a valid date'
    }),
    
  startTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'any.required': 'Start time is required',
      'string.pattern.base': 'Start time must be in HH:MM format (24-hour)'
    }),
    
  endTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'any.required': 'End time is required',
      'string.pattern.base': 'End time must be in HH:MM format (24-hour)'
    }),
    
  activityName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Activity name is required',
      'string.max': 'Activity name cannot exceed 200 characters',
      'any.required': 'Activity name is required'
    }),
    
  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    
  location: Joi.string()
    .trim()
    .max(300)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Location cannot exceed 300 characters'
    }),
    
  activityType: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Activity type is required',
      'string.max': 'Activity type cannot exceed 100 characters',
      'any.required': 'Activity type is required'
    }),
    
  isOptional: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      'boolean.base': 'isOptional must be a boolean value'
    })
});

// Update activity validation schema
export const updateActivitySchema = Joi.object({
  activityDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Activity date must be a valid date'
    }),
    
  startTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format (24-hour)'
    }),
    
  endTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format (24-hour)'
    }),
    
  activityName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Activity name cannot be empty',
      'string.max': 'Activity name cannot exceed 200 characters'
    }),
    
  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    
  location: Joi.string()
    .trim()
    .max(300)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Location cannot exceed 300 characters'
    }),
    
  activityType: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Activity type cannot be empty',
      'string.max': 'Activity type cannot exceed 100 characters'
    }),
    
  isOptional: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'isOptional must be a boolean value'
    })
});

// Activity ID validation schema
export const activityIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Activity ID is required',
    'string.empty': 'Activity ID cannot be empty'
  });

// Time validation helper
export function validateTimeOrder(startTime: string, endTime: string): boolean {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  return startMinutes < endMinutes;
}

// Activity conflict detection helper
export function checkActivityConflict(
  newActivity: { activityDate: Date; startTime: string; endTime: string },
  existingActivities: { activityDate: Date; startTime: string; endTime: string }[]
): boolean {
  const newDate = newActivity.activityDate.toDateString();
  
  return existingActivities.some(activity => {
    const activityDate = activity.activityDate.toDateString();
    
    // Only check conflicts on the same date
    if (activityDate !== newDate) {
      return false;
    }
    
    // Check time overlap
    const newStart = timeToMinutes(newActivity.startTime);
    const newEnd = timeToMinutes(newActivity.endTime);
    const existingStart = timeToMinutes(activity.startTime);
    const existingEnd = timeToMinutes(activity.endTime);
    
    // Check if times overlap
    return (newStart < existingEnd && newEnd > existingStart);
  });
}

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Default activity types
export const defaultActivityTypes = [
  'Transportation',
  'Sightseeing',
  'Religious Visit',
  'Cultural Experience',
  'Meal',
  'Rest',
  'Shopping',
  'Educational',
  'Entertainment',
  'Free Time',
  'Check-in/Check-out',
  'Meeting',
  'Other'
];