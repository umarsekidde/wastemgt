const Joi = require('joi');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const data = property === 'body' ? req.body : property === 'query' ? req.query : req.params;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: messages, errors: error.details });
      }
      req.flash && req.flash('error', messages);
      return res.status(400).redirect('back');
    }

    if (property === 'body') req.body = value;
    else if (property === 'query') req.query = value;
    else req.params = value;
    next();
  };
};

const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
      .messages({ 'string.pattern.base': 'Password must contain uppercase, lowercase and number' }),
    phone: Joi.string().allow('', null),
    address: Joi.string().allow('', null),
    division_id: Joi.number().integer().min(1).required()
      .messages({ 'any.required': 'Please select your division', 'number.min': 'Please select your division' })
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  resetPasswordRequest: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
  }),

  updateLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    speed: Joi.number().min(0).allow(null),
    heading: Joi.number().allow(null)
  }),

  wasteRequest: Joi.object({
    address: Joi.string().min(5).required(),
    latitude: Joi.number().min(-90).max(90).allow(null),
    longitude: Joi.number().min(-180).max(180).allow(null),
    subscription_type: Joi.string().valid('monthly', 'weekly', 'on_demand').required(),
    scheduled_date: Joi.alternatives().try(Joi.date().iso(), Joi.string().allow('', null)).allow(null).optional(),
    scheduled_time_slot: Joi.string().allow('', null).optional(),
    notes: Joi.string().allow('', null).optional()
  }),

  paymentInit: Joi.object({
    request_id: Joi.number().integer().required(),
    amount: Joi.number().positive().required(),
    phone: Joi.string().optional()
  }),

  complaint: Joi.object({
    subject: Joi.string().min(3).max(255).required(),
    message: Joi.string().min(10).required(),
    request_id: Joi.number().integer().allow(null)
  }),

  division: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    code: Joi.string().max(20).allow('', null),
    is_active: Joi.boolean().optional()
  }),

  company: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    division_id: Joi.number().integer().required(),
    admin_id: Joi.number().integer().required(),
    contact_phone: Joi.string().allow('', null),
    contact_email: Joi.string().email().allow('', null)
  }),

  broadcast: Joi.object({
    title: Joi.string().min(2).max(255).required(),
    message: Joi.string().min(5).required(),
    division_id: Joi.number().integer().allow(null),
    target_roles: Joi.array().items(Joi.string().valid('customer', 'collector', 'admin', 'superadmin')).allow(null)
  })
};

module.exports = { validate, schemas };
