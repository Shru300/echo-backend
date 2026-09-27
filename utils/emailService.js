import nodemailer from 'nodemailer';

// Create reusable transporter object
// Supports both Mailgun SMTP and Gmail SMTP
// NOTE: Mailgun free/sandbox tier only allows sending to authorized recipients.
// To send to any email address with Mailgun, verify your domain (see MAILGUN_SETUP.md)
// Gmail SMTP works immediately but has daily sending limits (~500 emails/day)
const createTransporter = () => {
  // Check if using Gmail SMTP (easier setup, no domain verification needed)
  if (process.env.USE_GMAIL_SMTP === 'true' || process.env.GMAIL_USER) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn('⚠️ Gmail SMTP selected but missing GMAIL_USER or GMAIL_APP_PASSWORD');
      return null;
    }
    
    console.log('📧 Using Gmail SMTP (no domain verification needed)');
    return nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD // Use App Password, not regular password
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Default to Mailgun SMTP
  if (!process.env.MAILGUN_SMTP_HOST || !process.env.MAILGUN_SMTP_USER || !process.env.MAILGUN_SMTP_PASSWORD) {
    console.warn('⚠️ Email service not fully configured. Missing required environment variables.');
    console.warn('   Options:');
    console.warn('   1. Configure Mailgun SMTP (requires domain verification for unlimited sending)');
    console.warn('   2. Use Gmail SMTP (set USE_GMAIL_SMTP=true, GMAIL_USER, GMAIL_APP_PASSWORD)');
    return null;
  }

  const port = parseInt(process.env.MAILGUN_SMTP_PORT || '587');
  const useSecure = port === 465 || process.env.MAILGUN_SMTP_SECURE === 'true';

  console.log('📧 Using Mailgun SMTP');
  return nodemailer.createTransport({
    host: process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org',
    port: port,
    secure: useSecure, // true for 465 (SSL), false for 587 (STARTTLS)
    requireTLS: !useSecure, // Require TLS for port 587
    auth: {
      user: process.env.MAILGUN_SMTP_USER,
      pass: process.env.MAILGUN_SMTP_PASSWORD
    },
    tls: {
      // Do not fail on invalid certificates
      rejectUnauthorized: false
    }
  });
};

// Send sign-in notification email
export const sendSignInEmail = async (userEmail, userName) => {
  console.log(`\n🔔 [EMAIL SERVICE] sendSignInEmail called for: ${userEmail}, userName: ${userName}`);
  try {
    // Validate email format
    if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
      console.error(`❌ Invalid email address provided: ${userEmail}`);
      return { success: false, error: 'Invalid email address' };
    }

    const transporter = createTransporter();

    if (!transporter) {
      console.error('❌ Email service not configured. Missing environment variables.');
      console.error('   Required: MAILGUN_SMTP_HOST, MAILGUN_SMTP_USER, MAILGUN_SMTP_PASSWORD');
      return { success: false, message: 'Email service not configured' };
    }

    console.log(`✅ Transporter created successfully. Using host: ${process.env.MAILGUN_SMTP_HOST}`);

    // Determine FROM address based on email service
    let fromAddress;
    if (process.env.USE_GMAIL_SMTP === 'true' || process.env.GMAIL_USER) {
      fromAddress = process.env.EMAIL_FROM || `"EchoBoard" <${process.env.GMAIL_USER}>`;
    } else {
      fromAddress = process.env.EMAIL_FROM || `"EchoBoard" <${process.env.MAILGUN_SMTP_USER}>`;
    }

    const mailOptions = {
      from: fromAddress,
      to: userEmail,
      subject: 'Sign-In Notification - EchoBoard',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sign-In Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">EchoBoard</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Hello ${userName}!</h2>
            <p style="font-size: 16px; color: #555;">
              We noticed that you just signed in to your EchoBoard account.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                <strong>Sign-In Details:</strong><br>
                Time: ${new Date().toLocaleString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}<br>
                Account: ${userEmail}
              </p>
            </div>
            <p style="font-size: 14px; color: #777;">
              If this wasn't you, please secure your account immediately by changing your password.
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #999; margin: 0;">
                This is an automated notification. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${userName}!
        
        We noticed that you just signed in to your EchoBoard account.
        
        Sign-In Details:
        Time: ${new Date().toLocaleString()}
        Account: ${userEmail}
        
        If this wasn't you, please secure your account immediately by changing your password.
        
        This is an automated notification. Please do not reply to this email.
      `
    };

    console.log(`📧 Attempting to send sign-in email to: ${userEmail}`);
    console.log(`   From: ${mailOptions.from}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Sign-in email sent successfully to ${userEmail}`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`\n❌❌❌ ERROR sending sign-in email to ${userEmail} ❌❌❌`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error code: ${error.code || 'N/A'}`);
    console.error(`   Error command: ${error.command || 'N/A'}`);
    
    // Log specific Mailgun error codes if available
    if (error.response) {
      console.error(`   SMTP Response: ${error.response}`);
    }
    if (error.responseCode) {
      console.error(`   SMTP Response Code: ${error.responseCode}`);
    }
    if (error.stack) {
      console.error(`   Stack trace: ${error.stack}`);
    }
    
    // Check for common Mailgun sandbox errors
    const errorMsg = error.message?.toLowerCase() || '';
    const errorResponse = error.response?.toLowerCase() || '';
    
    if (errorMsg.includes('authorized') || errorMsg.includes('sandbox') || 
        errorResponse.includes('authorized') || errorResponse.includes('sandbox') ||
        errorMsg.includes('550') || errorResponse.includes('550')) {
      console.error(`\n⚠️⚠️⚠️ MAILGUN SANDBOX RESTRICTION DETECTED ⚠️⚠️⚠️`);
      console.error(`   This email address (${userEmail}) is not authorized in Mailgun sandbox.`);
      console.error(`   Solution: Add ${userEmail} to authorized recipients in Mailgun dashboard,`);
      console.error(`   or verify your domain to send to any email address.\n`);
    }
    
    // Check for FROM address issues
    if (errorMsg.includes('from') || errorMsg.includes('sender') || 
        errorResponse.includes('from') || errorResponse.includes('sender')) {
      console.error(`\n⚠️⚠️⚠️ FROM ADDRESS ISSUE DETECTED ⚠️⚠️⚠️`);
      console.error(`   The FROM address might not be authorized.`);
      console.error(`   Current FROM: ${mailOptions.from}`);
      console.error(`   Solution: Ensure EMAIL_FROM matches your verified domain in Mailgun.\n`);
    }
    
    return { success: false, error: error.message };
  }
};

// Send welcome email (for registration)
export const sendWelcomeEmail = async (userEmail, userName) => {
  console.log(`\n🔔 [EMAIL SERVICE] sendWelcomeEmail called for: ${userEmail}, userName: ${userName}`);
  try {
    // Validate email format
    if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
      console.error(`❌ Invalid email address provided: ${userEmail}`);
      return { success: false, error: 'Invalid email address' };
    }

    const transporter = createTransporter();

    if (!transporter) {
      console.error('❌ Email service not configured. Missing environment variables.');
      console.error('   Required: MAILGUN_SMTP_HOST, MAILGUN_SMTP_USER, MAILGUN_SMTP_PASSWORD');
      return { success: false, message: 'Email service not configured' };
    }

    console.log(`✅ Transporter created successfully. Using host: ${process.env.MAILGUN_SMTP_HOST}`);

    // Determine FROM address based on email service
    let fromAddress;
    if (process.env.USE_GMAIL_SMTP === 'true' || process.env.GMAIL_USER) {
      fromAddress = process.env.EMAIL_FROM || `"EchoBoard" <${process.env.GMAIL_USER}>`;
    } else {
      fromAddress = process.env.EMAIL_FROM || `"EchoBoard" <${process.env.MAILGUN_SMTP_USER}>`;
    }

    const mailOptions = {
      from: fromAddress,
      to: userEmail,
      subject: 'Welcome to EchoBoard!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to EchoBoard</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to EchoBoard!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Hello ${userName}!</h2>
            <p style="font-size: 16px; color: #555;">
              Thank you for joining EchoBoard! We're excited to have you as part of our community.
            </p>
            <p style="font-size: 14px; color: #666;">
              Your account has been successfully created. You can now start sharing posts, engaging with the community, and connecting with others.
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #999; margin: 0;">
                If you have any questions, feel free to reach out to our support team.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to EchoBoard!
        
        Hello ${userName}!
        
        Thank you for joining EchoBoard! We're excited to have you as part of our community.
        
        Your account has been successfully created. You can now start sharing posts, engaging with the community, and connecting with others.
        
        If you have any questions, feel free to reach out to our support team.
      `
    };

    console.log(`📧 Attempting to send welcome email to: ${userEmail}`);
    console.log(`   From: ${mailOptions.from}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent successfully to ${userEmail}`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`\n❌❌❌ ERROR sending welcome email to ${userEmail} ❌❌❌`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error code: ${error.code || 'N/A'}`);
    console.error(`   Error command: ${error.command || 'N/A'}`);
    
    // Log specific Mailgun error codes if available
    if (error.response) {
      console.error(`   SMTP Response: ${error.response}`);
    }
    if (error.responseCode) {
      console.error(`   SMTP Response Code: ${error.responseCode}`);
    }
    if (error.stack) {
      console.error(`   Stack trace: ${error.stack}`);
    }
    
    // Check for common Mailgun sandbox errors
    const errorMsg = error.message?.toLowerCase() || '';
    const errorResponse = error.response?.toLowerCase() || '';
    
    if (errorMsg.includes('authorized') || errorMsg.includes('sandbox') || 
        errorResponse.includes('authorized') || errorResponse.includes('sandbox') ||
        errorMsg.includes('550') || errorResponse.includes('550')) {
      console.error(`\n⚠️⚠️⚠️ MAILGUN SANDBOX RESTRICTION DETECTED ⚠️⚠️⚠️`);
      console.error(`   This email address (${userEmail}) is not authorized in Mailgun sandbox.`);
      console.error(`   Solution: Add ${userEmail} to authorized recipients in Mailgun dashboard,`);
      console.error(`   or verify your domain to send to any email address.\n`);
    }
    
    // Check for FROM address issues
    if (errorMsg.includes('from') || errorMsg.includes('sender') || 
        errorResponse.includes('from') || errorResponse.includes('sender')) {
      console.error(`\n⚠️⚠️⚠️ FROM ADDRESS ISSUE DETECTED ⚠️⚠️⚠️`);
      console.error(`   The FROM address might not be authorized.`);
      console.error(`   Current FROM: ${mailOptions.from}`);
      console.error(`   Solution: Ensure EMAIL_FROM matches your verified domain in Mailgun.\n`);
    }
    
    return { success: false, error: error.message };
  }
};

