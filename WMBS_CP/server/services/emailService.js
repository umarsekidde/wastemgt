const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const from = process.env.MAIL_FROM || '"WMBS" <noreply@wmbs.com>';

async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER) {
    console.warn('SMTP not configured. Would send:', { to, subject });
    return { messageId: 'no-smtp' };
  }
  return transporter.sendMail({ from, to, subject, text: text || undefined, html: html || undefined });
}

async function sendPasswordReset(to, resetLink) {
  return sendMail({
    to,
    subject: 'WMBS - Password Reset',
    html: `<p>You requested a password reset. Click here: <a href="${resetLink}">${resetLink}</a>. Link expires in 1 hour.</p>`
  });
}

async function sendPaymentSuccess(to, amount, invoiceNumber) {
  return sendMail({
    to,
    subject: 'WMBS - Payment Received',
    html: `<p>Payment of ${amount} UGX received. Invoice: ${invoiceNumber}</p>`
  });
}

async function sendNewRequestToAdmin(to, requestId, address, customerName) {
  return sendMail({
    to,
    subject: 'WMBS - New collection request',
    html: `<p>A new waste collection request has been submitted.</p><p><strong>Request #${requestId}</strong></p><p>Customer: ${customerName || 'N/A'}</p><p>Address: ${address || 'N/A'}</p><p>Please log in to assign a collector.</p>`
  });
}

async function sendAssignmentToCollector(to, requestId, address) {
  return sendMail({
    to,
    subject: 'WMBS - New assignment',
    html: `<p>You have been assigned waste collection request #${requestId}.</p><p>Address: ${address || 'N/A'}</p><p>Please log in to view details.</p>`
  });
}

module.exports = { sendMail, sendPasswordReset, sendPaymentSuccess, sendNewRequestToAdmin, sendAssignmentToCollector };
