import type { BackupProgress, Order } from "@shared/schema";

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

export async function sendOrderNotification(
  botToken: string,
  channelId: string,
  order: Order,
  isStatusChange: boolean = false
): Promise<{ success: boolean; message: string }> {
  try {
    const statusEmoji = order.status === 'completed' ? '✅' : 
                        order.status === 'pending' ? '⏳' : 
                        order.status === 'confirming' ? '🔄' : 
                        order.status === 'failed' ? '❌' : 
                        order.status === 'expired' ? '⌛' : '📦';
    
    const header = isStatusChange ? '🔔 ORDER STATUS UPDATE' : '🆕 NEW ORDER';
    
    let message = `${header}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 Order ID: ${order.orderId}\n`;
    message += `🛍️ Product: ${order.productName || 'N/A'}\n`;
    message += `📦 Quantity: ${order.quantity}\n`;
    message += `💰 Amount: $${order.totalAmount?.toFixed(2) || '0.00'}\n`;
    message += `${statusEmoji} Status: ${order.status?.toUpperCase()}\n`;
    
    if (order.email) {
      message += `📧 Email: ${order.email}\n`;
    }
    
    if (order.ipAddress) {
      message += `🌐 IP: ${order.ipAddress}\n`;
    }
    
    if (order.payCurrency) {
      message += `💎 Crypto: ${order.payCurrency.toUpperCase()}\n`;
    }
    
    if (order.status === 'completed' && order.sentStock) {
      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📤 DELIVERED STOCK:\n`;
      message += `${order.sentStock}\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 ${new Date().toISOString()}`;

    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json() as TelegramResponse;
    
    if (!data.ok) {
      console.error('Telegram order notification failed:', data.description);
      return { success: false, message: `Failed: ${data.description}` };
    }

    return { success: true, message: 'Order notification sent' };
  } catch (error) {
    console.error('Telegram order notification error:', error);
    return { success: false, message: `Error: ${(error as Error).message}` };
  }
}

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

export async function testTelegramConnection(
  botToken: string,
  channelId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/getMe`);
    const data = await response.json() as TelegramResponse;
    
    if (!data.ok) {
      return { success: false, message: `Invalid bot token: ${data.description}` };
    }

    const testMessage = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: 'Database Backup Bot connected successfully!',
      }),
    });
    
    const testData = await testMessage.json() as TelegramResponse;
    
    if (!testData.ok) {
      return { success: false, message: `Cannot send to channel: ${testData.description}` };
    }

    return { success: true, message: 'Telegram connection successful!' };
  } catch (error) {
    return { success: false, message: `Connection error: ${(error as Error).message}` };
  }
}

export async function sendBackupToTelegram(
  botToken: string,
  channelId: string,
  backupData: string,
  filename: string,
  onProgress?: (progress: BackupProgress) => void,
  jobId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (onProgress && jobId) {
      onProgress({
        jobId,
        phase: 'uploading',
        percent: 50,
        message: 'Uploading backup to Telegram...',
      });
    }

    const blob = new Blob([backupData], { type: 'application/json' });
    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('document', blob, filename);
    formData.append('caption', `Database Backup\nDate: ${new Date().toISOString()}\nSize: ${(backupData.length / 1024).toFixed(2)} KB`);

    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json() as TelegramResponse;

    if (onProgress && jobId) {
      onProgress({
        jobId,
        phase: data.ok ? 'completed' : 'error',
        percent: data.ok ? 100 : 0,
        message: data.ok ? 'Backup sent to Telegram successfully!' : `Failed: ${data.description}`,
      });
    }

    if (!data.ok) {
      return { success: false, message: `Failed to send backup: ${data.description}` };
    }

    return { success: true, message: 'Backup sent to Telegram successfully!' };
  } catch (error) {
    if (onProgress && jobId) {
      onProgress({
        jobId,
        phase: 'error',
        percent: 0,
        message: `Upload error: ${(error as Error).message}`,
      });
    }
    return { success: false, message: `Upload error: ${(error as Error).message}` };
  }
}
