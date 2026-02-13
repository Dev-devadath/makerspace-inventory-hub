// Email service using Brevo (Sendinblue)
// Sends alerts for borrow and return transactions

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY as string;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL as string;
const FROM_NAME = import.meta.env.VITE_FROM_NAME || "Makerspace Inventory";

interface EmailParams {
  userId: string;
  component: string;
  quantity: number;
  caseName?: string;
}

/**
 * Send email via Brevo API
 */
async function sendBrevoEmail(
  to: string,
  subject: string,
  htmlContent: string,
): Promise<void> {
  if (!BREVO_API_KEY) {
    console.warn("VITE_BREVO_API_KEY not set. Skipping email notification.");
    return;
  }

  if (!ADMIN_EMAIL || !FROM_EMAIL) {
    console.warn("Email configuration incomplete. Skipping notification.");
    return;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL,
        },
        to: [
          {
            email: to,
            name: "Admin",
          },
        ],
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send email via Brevo:", error);
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

/**
 * Send borrow alert email
 */
export async function sendBorrowAlert({
  userId,
  component,
  quantity,
  caseName,
}: EmailParams): Promise<void> {
  const timestamp = new Date().toLocaleString();
  const subject = `📦 Inventory Alert: ${component} Borrowed`;

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">Component Borrowed</h2>
          
          <div style="background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; font-weight: bold; width: 140px;">User ID:</td>
                <td style="padding: 10px;">${userId}</td>
              </tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; font-weight: bold;">Component:</td>
                <td style="padding: 10px;">${component}</td>
              </tr>
              ${
                caseName
                  ? `
              <tr>
                <td style="padding: 10px; font-weight: bold;">Case:</td>
                <td style="padding: 10px;">${caseName}</td>
              </tr>
              `
                  : ""
              }
              <tr style="${!caseName ? "background-color: #f8f9fa;" : ""}">
                <td style="padding: 10px; font-weight: bold;">Quantity:</td>
                <td style="padding: 10px; color: #dc2626; font-weight: bold;">${quantity} units</td>
              </tr>
              <tr ${caseName ? 'style="background-color: #f8f9fa;"' : ""}>
                <td style="padding: 10px; font-weight: bold;">Timestamp:</td>
                <td style="padding: 10px;">${timestamp}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This is an automated notification from the Makerspace Inventory Hub.
          </p>
        </div>
      </body>
    </html>
  `;

  await sendBrevoEmail(ADMIN_EMAIL, subject, htmlContent);
}

/**
 * Send return alert email
 */
export async function sendReturnAlert({
  userId,
  component,
  quantity,
}: EmailParams): Promise<void> {
  const timestamp = new Date().toLocaleString();
  const subject = `✅ Inventory Alert: ${component} Returned`;

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #16a34a; margin-top: 0;">Component Returned</h2>
          
          <div style="background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; font-weight: bold; width: 140px;">User ID:</td>
                <td style="padding: 10px;">${userId}</td>
              </tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; font-weight: bold;">Component:</td>
                <td style="padding: 10px;">${component}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold;">Quantity:</td>
                <td style="padding: 10px; color: #16a34a; font-weight: bold;">${quantity} units</td>
              </tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 10px; font-weight: bold;">Timestamp:</td>
                <td style="padding: 10px;">${timestamp}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This is an automated notification from the Makerspace Inventory Hub.
          </p>
        </div>
      </body>
    </html>
  `;

  await sendBrevoEmail(ADMIN_EMAIL, subject, htmlContent);
}
