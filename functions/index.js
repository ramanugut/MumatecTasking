const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.sendInviteEmail = functions.firestore
  .document('invites/{inviteId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data.email || !data.token) return null;
    const mail = {
      from: process.env.SMTP_FROM,
      to: data.email,
      subject: 'You\'re invited to Mumatec Tasking',
      text: `You have been invited to Mumatec Tasking. Use this token during sign up: ${data.token}`
    };
    try {
      await transporter.sendMail(mail);
      return snap.ref.update({ emailSent: true, emailedAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error('Invite email failed', err);
      return snap.ref.update({ emailSent: false, emailError: err.message });
    }
  });

exports.sendNotificationEmail = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notif = snap.data();
    if (!notif.recipientId) return null;
    const userSnap = await db.collection('users').doc(notif.recipientId).get();
    if (!userSnap.exists) return null;
    const userData = userSnap.data();
    if (!userData.notifications || userData.notifications.email !== true) return null;
    const mail = {
      from: process.env.SMTP_FROM,
      to: userData.email,
      subject: 'Mumatec Notification',
      text: notif.message || 'You have a new notification.'
    };
    try {
      await transporter.sendMail(mail);
      return snap.ref.update({ emailSent: true, emailedAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error('Notification email failed', err);
      return snap.ref.update({ emailSent: false, emailError: err.message });
    }
  });
