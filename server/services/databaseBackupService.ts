import { db, pool } from "../db";
import { users, products, orders, emailTemplates, settings, passwordResetTokens, reviews } from "@shared/schema";
import type { BackupProgress, DatabaseExport } from "@shared/schema";
import { WebSocket } from "ws";
import crypto from "crypto";
import { eq } from "drizzle-orm";

const TABLES = [
  { name: 'users', table: users },
  { name: 'products', table: products },
  { name: 'orders', table: orders },
  { name: 'emailTemplates', table: emailTemplates },
  { name: 'settings', table: settings },
  { name: 'passwordResetTokens', table: passwordResetTokens },
  { name: 'reviews', table: reviews },
];

const CHUNK_SIZE = 100;

type ProgressCallback = (progress: BackupProgress) => void;

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

let cachedEncryptionKey: string | null = null;

async function getEncryptionKey(): Promise<string> {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }
  
  if (process.env.ENCRYPTION_KEY) {
    cachedEncryptionKey = process.env.ENCRYPTION_KEY;
    return cachedEncryptionKey;
  }
  
  const { db } = await import("../db");
  const { settings } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  
  const result = await db.select().from(settings).where(eq(settings.key, "encryption_key"));
  
  if (result.length > 0 && result[0].value) {
    cachedEncryptionKey = result[0].value;
    return cachedEncryptionKey;
  }
  
  const newKey = crypto.randomBytes(32).toString('hex');
  await db.insert(settings).values({ key: "encryption_key", value: newKey }).onConflictDoNothing();
  cachedEncryptionKey = newKey;
  console.log("Generated and stored new encryption key in database");
  return newKey;
}

function getEncryptionKeySync(): string {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }
  if (process.env.ENCRYPTION_KEY) {
    cachedEncryptionKey = process.env.ENCRYPTION_KEY;
    return cachedEncryptionKey;
  }
  throw new Error("Encryption key not initialized. Call initializeEncryption() first.");
}

export async function initializeEncryption(): Promise<void> {
  await getEncryptionKey();
}

export function encryptToken(token: string): string {
  const encryptionKey = getEncryptionKeySync();
  const iv = crypto.randomBytes(16);
  // Encryption key is a 64-char hex string representing 32 bytes
  const key = Buffer.from(encryptionKey, 'hex');
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  try {
    const encryptionKey = getEncryptionKeySync();
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      console.log('Token not in encrypted format, returning as-is');
      return encryptedToken;
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Try new correct method first (hex decode the full key)
    try {
      const key = Buffer.from(encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      console.log('Token decrypted successfully with new method');
      return decrypted;
    } catch (newMethodError) {
      console.log('New decryption method failed, trying legacy method...');
      // Fall back to old buggy method for backward compatibility
      try {
        const legacyKey = Buffer.from(encryptionKey.slice(0, 32).padEnd(32, '0'));
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, legacyKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        console.log('Token decrypted successfully with legacy method');
        return decrypted;
      } catch (legacyError) {
        console.error('Both decryption methods failed');
        throw legacyError;
      }
    }
  } catch (error) {
    console.error('Failed to decrypt token:', error);
    return encryptedToken;
  }
}

async function countAllRows(): Promise<{ total: number; perTable: Record<string, number> }> {
  const perTable: Record<string, number> = {};
  let total = 0;
  
  for (const { name, table } of TABLES) {
    try {
      const rows = await db.select().from(table);
      perTable[name] = rows.length;
      total += rows.length;
    } catch (error) {
      perTable[name] = 0;
    }
  }
  
  return { total, perTable };
}

export async function exportDatabase(
  jobId: string,
  onProgress: ProgressCallback
): Promise<DatabaseExport> {
  const exportData: DatabaseExport = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    tables: {},
  };

  let lastEmittedPercent = -1;

  const emitProgress = (percent: number, message: string, tableName?: string, totalRows?: number, processedRows?: number) => {
    const roundedPercent = Math.floor(percent);
    if (roundedPercent !== lastEmittedPercent && roundedPercent >= 0 && roundedPercent <= 100) {
      lastEmittedPercent = roundedPercent;
      onProgress({
        jobId,
        phase: 'exporting',
        percent: roundedPercent,
        message,
        tableName,
        totalRows,
        processedRows,
      });
    }
  };

  onProgress({
    jobId,
    phase: 'preparing',
    percent: 0,
    message: 'Counting rows for progress tracking...',
  });

  const { total: totalRows, perTable: rowCounts } = await countAllRows();
  let processedRows = 0;

  for (const { name, table } of TABLES) {
    const tableRowCount = rowCounts[name] || 0;
    
    emitProgress(
      totalRows > 0 ? (processedRows / totalRows) * 100 : 0,
      `Exporting table: ${name}`,
      name,
      tableRowCount,
      0
    );

    try {
      const rows = await db.select().from(table);
      
      // For settings table, decrypt sensitive values so they can be re-encrypted on import
      let processedData = rows as Record<string, unknown>[];
      if (name === 'settings') {
        processedData = rows.map((row: any) => {
          if (row.key === 'telegram_bot_token' && row.value) {
            try {
              const decrypted = decryptToken(row.value);
              // Mark as decrypted so import knows to encrypt it
              return { ...row, value: `PLAIN:${decrypted}` };
            } catch {
              return row;
            }
          }
          return row;
        });
      }
      
      exportData.tables[name] = {
        rowCount: rows.length,
        data: processedData,
      };

      for (let i = 0; i < rows.length; i++) {
        processedRows++;
        emitProgress(
          (processedRows / totalRows) * 100,
          `Exporting ${name}: ${i + 1}/${rows.length} rows`,
          name,
          rows.length,
          i + 1
        );
      }
    } catch (error) {
      console.error(`Error exporting table ${name}:`, error);
      exportData.tables[name] = { rowCount: 0, data: [] };
    }
  }

  onProgress({
    jobId,
    phase: 'completed',
    percent: 100,
    message: 'Database export completed successfully',
  });

  return exportData;
}

export function clearEncryptionCache(): void {
  cachedEncryptionKey = null;
}

export async function reloadEncryptionKey(): Promise<void> {
  cachedEncryptionKey = null;
  await getEncryptionKey();
  console.log("Encryption key reloaded from database");
}

export async function importDatabase(
  jobId: string,
  importData: DatabaseExport,
  onProgress: ProgressCallback
): Promise<{ success: boolean; message: string; details: Record<string, number> }> {
  const details: Record<string, number> = {};
  let lastEmittedPercent = -1;

  const emitProgress = (percent: number, message: string, tableName?: string, totalRows?: number, processedRows?: number) => {
    const roundedPercent = Math.floor(percent);
    if (roundedPercent !== lastEmittedPercent && roundedPercent >= 0 && roundedPercent <= 100) {
      lastEmittedPercent = roundedPercent;
      onProgress({
        jobId,
        phase: 'importing',
        percent: roundedPercent,
        message,
        tableName,
        totalRows,
        processedRows,
      });
    }
  };

  onProgress({
    jobId,
    phase: 'preparing',
    percent: 0,
    message: 'Validating import data...',
  });

  if (!importData.version || !importData.tables) {
    onProgress({
      jobId,
      phase: 'error',
      percent: 0,
      message: 'Invalid import file format',
    });
    return { success: false, message: 'Invalid import file format', details };
  }

  // Log what we received for debugging
  console.log('=== Starting Database Import ===');
  console.log('Import file version:', importData.version);
  console.log('Export timestamp:', importData.exportedAt);
  console.log('Tables in import file:', Object.keys(importData.tables));
  for (const [tableName, tableInfo] of Object.entries(importData.tables)) {
    console.log(`  - ${tableName}: ${tableInfo.rowCount} rows`);
  }

  // CRITICAL: Import encryption_key FIRST before any other settings
  // This ensures encrypted values (telegram_bot_token, etc.) can be encrypted correctly during import
  if (importData.tables.settings?.data) {
    const encryptionKeySetting = importData.tables.settings.data.find(
      (s: any) => s.key === 'encryption_key'
    );
    if (encryptionKeySetting) {
      const settingRow = encryptionKeySetting as { key: string; value: string };
      const existing = await db.select().from(settings).where(eq(settings.key, 'encryption_key'));
      if (existing.length > 0) {
        await db.update(settings).set({ value: settingRow.value }).where(eq(settings.key, 'encryption_key'));
      } else {
        await db.insert(settings).values({ key: settingRow.key, value: settingRow.value });
      }
      // Clear the cached encryption key and reload it from database
      // This is critical so encryptToken() works correctly for telegram_bot_token
      clearEncryptionCache();
      await getEncryptionKey(); // Reload the imported key into cache
      console.log('Imported encryption_key and reloaded into cache');
    }
  }

  let totalRowsToImport = 0;
  for (const tableName of Object.keys(importData.tables)) {
    totalRowsToImport += importData.tables[tableName].data.length;
  }

  let processedRows = 0;

  for (const tableName of Object.keys(importData.tables)) {
    const tableData = importData.tables[tableName];
    const tableConfig = TABLES.find(t => t.name === tableName);
    
    if (!tableConfig) {
      console.log(`Skipping unknown table: ${tableName}`);
      continue;
    }

    emitProgress(
      totalRowsToImport > 0 ? (processedRows / totalRowsToImport) * 100 : 0,
      `Importing table: ${tableName}`,
      tableName,
      tableData.rowCount,
      0
    );

    try {
      const rows = tableData.data;
      let importedCount = 0;

      const errors: string[] = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (tableName === 'settings') {
            // Settings table has unique constraint on 'key' column
            // Use upsert: update value if key exists, otherwise insert
            const settingRow = row as { id: string; key: string; value: string };
            let valueToSave = settingRow.value;
            
            // Handle telegram_bot_token specially
            if (settingRow.key === 'telegram_bot_token' && settingRow.value) {
              if (settingRow.value.startsWith('PLAIN:')) {
                // New format: plaintext prefixed with PLAIN:
                const plainToken = settingRow.value.substring(6);
                valueToSave = encryptToken(plainToken);
                console.log('Encrypted telegram_bot_token during import (from PLAIN format)');
              } else if (settingRow.value.includes(':') && settingRow.value.split(':').length === 3) {
                // Old encrypted format - skip it, can't decrypt without original key
                // User will need to re-enter the token
                console.log('Skipping old encrypted telegram_bot_token - user must re-enter');
                valueToSave = ''; // Clear it so user knows to re-enter
              }
              // If it's a plain token (no colons, no prefix), encrypt it
              else if (!settingRow.value.includes(':')) {
                valueToSave = encryptToken(settingRow.value);
                console.log('Encrypted plain telegram_bot_token during import');
              }
            }
            
            const existing = await db.select().from(settings).where(eq(settings.key, settingRow.key));
            if (existing.length > 0) {
              await db.update(settings).set({ value: valueToSave }).where(eq(settings.key, settingRow.key));
            } else {
              await db.insert(settings).values({ key: settingRow.key, value: valueToSave });
            }
          } else if (tableName === 'users') {
            // Users table - check by email (unique) and upsert
            const userRow = row as { id: string; email: string; password: string; role: string; banned: number; createdAt: string };
            const existing = await db.select().from(users).where(eq(users.email, userRow.email));
            if (existing.length > 0) {
              // Update existing user (except password if they want to keep existing)
              await db.update(users).set({
                password: userRow.password,
                role: userRow.role,
                banned: userRow.banned,
              }).where(eq(users.email, userRow.email));
              console.log(`Updated existing user: ${userRow.email}`);
            } else {
              await db.insert(users).values({
                id: userRow.id,
                email: userRow.email,
                password: userRow.password,
                role: userRow.role,
                banned: userRow.banned,
                createdAt: userRow.createdAt,
              });
              console.log(`Inserted new user: ${userRow.email}`);
            }
          } else if (tableName === 'products') {
            // Products table - check by id and upsert
            const productRow = row as any;
            const existing = await db.select().from(products).where(eq(products.id, productRow.id));
            if (existing.length > 0) {
              await db.update(products).set({
                name: productRow.name,
                description: productRow.description,
                price: productRow.price,
                category: productRow.category,
                stock: productRow.stock,
                imageUrl: productRow.imageUrl,
                countries: productRow.countries,
                stockList: productRow.stockList,
              }).where(eq(products.id, productRow.id));
              console.log(`Updated existing product: ${productRow.name}`);
            } else {
              await db.insert(products).values(productRow);
              console.log(`Inserted new product: ${productRow.name}`);
            }
          } else if (tableName === 'orders') {
            // Orders table - check by id and upsert
            const orderRow = row as any;
            const existing = await db.select().from(orders).where(eq(orders.id, orderRow.id));
            if (existing.length > 0) {
              await db.update(orders).set({
                orderId: orderRow.orderId,
                productId: orderRow.productId,
                productName: orderRow.productName,
                quantity: orderRow.quantity,
                totalAmount: orderRow.totalAmount,
                status: orderRow.status,
                paymentId: orderRow.paymentId,
                payAddress: orderRow.payAddress,
                payCurrency: orderRow.payCurrency,
                payAmount: orderRow.payAmount,
                email: orderRow.email,
                sentStock: orderRow.sentStock,
                ipAddress: orderRow.ipAddress,
              }).where(eq(orders.id, orderRow.id));
              console.log(`Updated existing order: ${orderRow.orderId}`);
            } else {
              await db.insert(orders).values(orderRow);
              console.log(`Inserted new order: ${orderRow.orderId}`);
            }
          } else if (tableName === 'emailTemplates') {
            // Email templates - check by id and upsert
            const templateRow = row as any;
            const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.id, templateRow.id));
            if (existing.length > 0) {
              await db.update(emailTemplates).set({
                name: templateRow.name,
                subject: templateRow.subject,
                htmlContent: templateRow.htmlContent,
                isDefault: templateRow.isDefault,
              }).where(eq(emailTemplates.id, templateRow.id));
            } else {
              await db.insert(emailTemplates).values(templateRow);
            }
          } else if (tableName === 'passwordResetTokens') {
            // Password reset tokens - just insert, skip on conflict (ephemeral data)
            await db.insert(passwordResetTokens).values(row as any).onConflictDoNothing();
          } else if (tableName === 'reviews') {
            // Reviews - check by id and upsert
            const reviewRow = row as any;
            const existing = await db.select().from(reviews).where(eq(reviews.id, reviewRow.id));
            if (existing.length > 0) {
              await db.update(reviews).set({
                customerName: reviewRow.customerName,
                rating: reviewRow.rating,
                comment: reviewRow.comment,
                platform: reviewRow.platform,
                avatarUrl: reviewRow.avatarUrl,
                verified: reviewRow.verified,
              }).where(eq(reviews.id, reviewRow.id));
              console.log(`Updated existing review: ${reviewRow.id}`);
            } else {
              await db.insert(reviews).values(reviewRow);
              console.log(`Inserted new review: ${reviewRow.id}`);
            }
          } else {
            // Fallback for any other tables
            await db.insert(tableConfig.table).values(row as any).onConflictDoNothing();
          }
          importedCount++;
        } catch (err: any) {
          const errorMsg = `Error in ${tableName} row ${i}: ${err?.message || err}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
        
        processedRows++;
        emitProgress(
          (processedRows / totalRowsToImport) * 100,
          `Importing ${tableName}: ${i + 1}/${rows.length} rows`,
          tableName,
          rows.length,
          i + 1
        );
      }

      details[tableName] = importedCount;
      
      // Log summary for this table
      console.log(`=== Import summary for ${tableName}: ${importedCount}/${rows.length} rows imported ===`);
      if (errors.length > 0) {
        console.log(`Errors in ${tableName}:`, errors);
      }
    } catch (error: any) {
      console.error(`Error importing table ${tableName}:`, error?.message || error);
      details[tableName] = 0;
    }
  }
  
  // Log overall import summary
  console.log('=== Database Import Complete ===');
  console.log('Import details:', details);

  // Reload encryption key from database after import to ensure the imported key is used
  await reloadEncryptionKey();

  // Create detailed summary message
  const summaryParts = Object.entries(details).map(([table, count]) => `${table}: ${count}`);
  const summaryMessage = `Import completed. ${summaryParts.join(', ')}`;

  onProgress({
    jobId,
    phase: 'completed',
    percent: 100,
    message: summaryMessage,
  });

  return { 
    success: true, 
    message: summaryMessage, 
    details 
  };
}

export function generateJobId(): string {
  return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

let scheduledBackupInterval: NodeJS.Timeout | null = null;
let scheduledBackupCallback: (() => Promise<void>) | null = null;

export function scheduleAutoBackup(intervalHours: number, callback: () => Promise<void>): void {
  if (scheduledBackupInterval) {
    clearInterval(scheduledBackupInterval);
  }
  
  if (intervalHours <= 0) {
    scheduledBackupInterval = null;
    scheduledBackupCallback = null;
    console.log('Auto backup disabled');
    return;
  }
  
  scheduledBackupCallback = callback;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  scheduledBackupInterval = setInterval(async () => {
    console.log('Running scheduled backup...');
    try {
      if (scheduledBackupCallback) {
        await scheduledBackupCallback();
      }
    } catch (error) {
      console.error('Scheduled backup failed:', error);
    }
  }, intervalMs);
  
  console.log(`Auto backup scheduled every ${intervalHours} hours`);
}

export function getScheduledBackupStatus(): { enabled: boolean; intervalHours: number | null } {
  return {
    enabled: scheduledBackupInterval !== null,
    intervalHours: scheduledBackupInterval ? null : null,
  };
}

export function stopScheduledBackup(): void {
  if (scheduledBackupInterval) {
    clearInterval(scheduledBackupInterval);
    scheduledBackupInterval = null;
    scheduledBackupCallback = null;
  }
}
