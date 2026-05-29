import twilio from 'twilio';

// In a real offline app, these would be configured via settings and stored in SQLite
// For simplicity we will assume they are passed when calling this service
export async function sendExpirationSMS(
  accountSid: string, 
  authToken: string, 
  fromNumber: string, 
  toNumber: string, 
  memberName: string, 
  daysLeft: number
) {
  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    throw new Error('Missing Twilio credentials or phone numbers');
  }

  const client = twilio(accountSid, authToken);
  
  const message = daysLeft === 0 
    ? `Hello ${memberName}, your gym membership has expired today. Please renew to continue your training.`
    : `Hello ${memberName}, your gym membership expires in ${daysLeft} days. Please renew soon!`;

  try {
    const response = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });
    return { success: true, messageId: response.sid };
  } catch (error: any) {
    console.error('Twilio Error:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}
