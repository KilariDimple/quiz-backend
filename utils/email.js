const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendRegistrationEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"AI Quiz App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Registration Successful - AI Powered Quiz Application',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); border-radius: 16px; overflow: hidden;">
          <div style="padding: 40px 30px; text-align: center;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 36px;">🎓</span>
            </div>
            <h1 style="color: #ffffff; margin: 0 0 10px; font-size: 28px;">Welcome, ${name}!</h1>
            <p style="color: #a0aec0; font-size: 16px; line-height: 1.6;">
              You have successfully registered for the <strong style="color: #667eea;">AI Powered Quiz Application</strong>.
            </p>
          </div>
          <div style="padding: 30px; background: rgba(255,255,255,0.05);">
            <p style="color: #cbd5e0; font-size: 14px; line-height: 1.8; margin: 0;">
              You can now log in to your account and start taking quizzes. 
              Use your username or email along with your password to access the platform.
            </p>
            <div style="text-align: center; margin-top: 25px;">
              <a href="${process.env.CLIENT_URL}" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px;">
                Go to Dashboard
              </a>
            </div>
          </div>
          <div style="padding: 20px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="color: #718096; font-size: 12px; margin: 0;">
              © 2026 AI Powered Quiz Application. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Registration email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    throw error;
  }
};

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"AI Quiz App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    throw error;
  }
};

module.exports = { sendRegistrationEmail, sendEmail };
