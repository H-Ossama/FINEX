import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Open local database using the new sync API
const db = SQLite.openDatabaseSync('fintracker.db');

export interface LocalWallet {
  id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER';
  balance: number;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSynced?: string;
  isDirty?: boolean; // Changed since last sync
}

export interface LocalTransaction {
  id: string;
  amount: number;
  description?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
  notes?: string;
  walletId: string;
  categoryId?: string;
  createdAt: string;
  updatedAt: string;
  lastSynced?: string;
  isDirty?: boolean;
}

export interface LocalCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
  lastSynced?: string;
  isDirty?: boolean;
}

class LocalStorageService {

  async initializeDatabase(): Promise<void> {
    try {
      // Create wallets table
      db.execSync(`
        CREATE TABLE IF NOT EXISTS wallets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          balance REAL DEFAULT 0,
          color TEXT DEFAULT '#3B82F6',
          icon TEXT DEFAULT 'wallet',
          isActive INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          lastSynced TEXT,
          isDirty INTEGER DEFAULT 1
        );
      `);

      // Create transactions table
      db.execSync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          amount REAL NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          date TEXT NOT NULL,
          notes TEXT,
          walletId TEXT NOT NULL,
          categoryId TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          lastSynced TEXT,
          isDirty INTEGER DEFAULT 1,
          FOREIGN KEY (walletId) REFERENCES wallets (id)
        );
      `);

      // Create categories table
      db.execSync(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          isCustom INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          lastSynced TEXT,
          isDirty INTEGER DEFAULT 1
        );
      `);

      // Create user preferences table
      db.execSync(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create sync log table
      db.execSync(`
        CREATE TABLE IF NOT EXISTS sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          syncDate TEXT NOT NULL,
          status TEXT NOT NULL,
          itemsUploaded INTEGER DEFAULT 0,
          itemsDownloaded INTEGER DEFAULT 0,
          errors TEXT
        );
      `);

      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  // Wallet Operations
  async createWallet(wallet: Omit<LocalWallet, 'id' | 'createdAt' | 'updatedAt' | 'isDirty'>): Promise<LocalWallet> {
    const id = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newWallet: LocalWallet = {
      ...wallet,
      id,
      createdAt: now,
      updatedAt: now,
      isDirty: true
    };

    try {
      const statement = db.prepareSync(`
        INSERT INTO wallets (id, name, type, balance, color, icon, isActive, createdAt, updatedAt, isDirty) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      statement.executeSync([
        newWallet.id,
        newWallet.name,
        newWallet.type,
        newWallet.balance,
        newWallet.color,
        newWallet.icon,
        newWallet.isActive ? 1 : 0,
        newWallet.createdAt,
        newWallet.updatedAt,
        1
      ]);

      return newWallet;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  }

  async getWallets(): Promise<LocalWallet[]> {
    try {
      const result = db.getAllSync('SELECT * FROM wallets WHERE isActive = 1 ORDER BY createdAt ASC');
      return result.map(row => ({
        ...(row as any),
        isActive: Boolean((row as any).isActive),
        isDirty: Boolean((row as any).isDirty)
      })) as LocalWallet[];
    } catch (error) {
      console.error('Error getting wallets:', error);
      throw error;
    }
  }

  async updateWallet(id: string, updates: Partial<LocalWallet>): Promise<void> {
    const now = new Date().toISOString();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'createdAt')
        .map(key => `${key} = ?`)
        .join(', ');

      const values = Object.entries(updates)
        .filter(([key]) => key !== 'id' && key !== 'createdAt')
        .map(([_, value]) => value);

      const statement = db.prepareSync(`UPDATE wallets SET ${setClause}, updatedAt = ?, isDirty = 1 WHERE id = ?`);
      statement.executeSync([...values, now, id]);
    } catch (error) {
      console.error('Error updating wallet:', error);
      throw error;
    }
  }

  async deleteWallet(id: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      const statement = db.prepareSync('UPDATE wallets SET isActive = 0, updatedAt = ?, isDirty = 1 WHERE id = ?');
      statement.executeSync([now, id]);
    } catch (error) {
      console.error('Error deleting wallet:', error);
      throw error;
    }
  }

  // Transaction Operations
  async createTransaction(transaction: Omit<LocalTransaction, 'id' | 'createdAt' | 'updatedAt' | 'isDirty'>): Promise<LocalTransaction> {
    const id = `transaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newTransaction: LocalTransaction = {
      ...transaction,
      id,
      createdAt: now,
      updatedAt: now,
      isDirty: true
    };

    try {
      // Start transaction
      db.withTransactionSync(() => {
        // Insert transaction
        const insertStatement = db.prepareSync(`
          INSERT INTO transactions (id, amount, description, type, date, notes, walletId, categoryId, createdAt, updatedAt, isDirty) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStatement.executeSync([
          newTransaction.id,
          newTransaction.amount,
          newTransaction.description || null,
          newTransaction.type,
          newTransaction.date,
          newTransaction.notes || null,
          newTransaction.walletId,
          newTransaction.categoryId || null,
          newTransaction.createdAt,
          newTransaction.updatedAt,
          1
        ]);

        // Update wallet balance
        const balanceChange = newTransaction.type === 'INCOME' ? newTransaction.amount : -newTransaction.amount;
        const updateStatement = db.prepareSync('UPDATE wallets SET balance = balance + ?, updatedAt = ?, isDirty = 1 WHERE id = ?');
        updateStatement.executeSync([balanceChange, now, newTransaction.walletId]);
      });

      return newTransaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  async getTransactions(walletId?: string, limit?: number): Promise<LocalTransaction[]> {
    try {
      let query = 'SELECT * FROM transactions';
      const params: any[] = [];

      if (walletId) {
        query += ' WHERE walletId = ?';
        params.push(walletId);
      }

      query += ' ORDER BY date DESC, createdAt DESC';

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      const result = db.getAllSync(query, params);
      return result.map(row => ({
        ...(row as any),
        isDirty: Boolean((row as any).isDirty)
      })) as LocalTransaction[];
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: Partial<LocalTransaction>): Promise<void> {
    const now = new Date().toISOString();
    try {
      db.withTransactionSync(() => {
        // Get old transaction for balance adjustment
        const oldTransaction = db.getFirstSync('SELECT * FROM transactions WHERE id = ?', [id]) as any;
        if (!oldTransaction) throw new Error('Transaction not found');

        const setClause = Object.keys(updates)
          .filter(key => key !== 'id' && key !== 'createdAt')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.entries(updates)
          .filter(([key]) => key !== 'id' && key !== 'createdAt')
          .map(([_, value]) => value);

        const statement = db.prepareSync(`UPDATE transactions SET ${setClause}, updatedAt = ?, isDirty = 1 WHERE id = ?`);
        statement.executeSync([...values, now, id]);

        // If amount, type or wallet changed, adjust balances
        const amountChanged = updates.amount !== undefined && updates.amount !== oldTransaction.amount;
        const typeChanged = updates.type !== undefined && updates.type !== oldTransaction.type;
        const walletChanged = updates.walletId !== undefined && updates.walletId !== oldTransaction.walletId;

        if (amountChanged || typeChanged || walletChanged) {
          // Reverse old transaction impact
          const oldBalanceChange = oldTransaction.type === 'INCOME' ? -oldTransaction.amount : oldTransaction.amount;
          db.runSync('UPDATE wallets SET balance = balance + ?, updatedAt = ?, isDirty = 1 WHERE id = ?', [oldBalanceChange, now, oldTransaction.walletId]);

          // Apply new transaction impact
          const newType = updates.type || oldTransaction.type;
          const newAmount = updates.amount !== undefined ? updates.amount : oldTransaction.amount;
          const newWalletId = updates.walletId || oldTransaction.walletId;
          const newBalanceChange = newType === 'INCOME' ? newAmount : -newAmount;
          db.runSync('UPDATE wallets SET balance = balance + ?, updatedAt = ?, isDirty = 1 WHERE id = ?', [newBalanceChange, now, newWalletId]);
        }
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      db.withTransactionSync(() => {
        // Get transaction to adjust balance
        const transaction = db.getFirstSync('SELECT * FROM transactions WHERE id = ?', [id]) as any;
        if (!transaction) return;

        // Delete the transaction
        db.runSync('DELETE FROM transactions WHERE id = ?', [id]);

        // Reverse wallet balance impact
        const balanceChange = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
        db.runSync('UPDATE wallets SET balance = balance + ?, updatedAt = ?, isDirty = 1 WHERE id = ?', [balanceChange, now, transaction.walletId]);
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

  // Category Operations
  async seedDefaultCategories(): Promise<void> {
    const defaultCategories = [
      { name: 'Food & Dining', icon: 'restaurant', color: '#FF6B6B', isCustom: false },
      { name: 'Shopping', icon: 'shopping-bag', color: '#4ECDC4', isCustom: false },
      { name: 'Transportation', icon: 'car', color: '#45B7D1', isCustom: false },
      { name: 'Bills & Utilities', icon: '🧾', color: '#96CEB4', isCustom: false },
      { name: 'Entertainment', icon: 'tv', color: '#FFEAA7', isCustom: false },
      { name: 'Healthcare', icon: 'medical', color: '#DDA0DD', isCustom: false },
      { name: 'Education', icon: 'school', color: '#98D8C8', isCustom: false },
      { name: 'Salary', icon: 'cash', color: '#6C5CE7', isCustom: false },
      { name: 'Business', icon: 'briefcase', color: '#A29BFE', isCustom: false },
      { name: 'Investment', icon: 'trending-up', color: '#FD79A8', isCustom: false },
    ];

    try {
      const statement = db.prepareSync(`
        INSERT OR IGNORE INTO categories (id, name, icon, color, isCustom, createdAt, updatedAt, isDirty) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      defaultCategories.forEach(category => {
        const id = `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        statement.executeSync([
          id,
          category.name,
          category.icon,
          category.color,
          category.isCustom ? 1 : 0,
          now,
          now,
          0 // Default categories are not dirty
        ]);
      });

      console.log('✅ Default categories seeded');
    } catch (error) {
      console.error('Error seeding categories:', error);
      throw error;
    }
  }

  async getCategories(): Promise<LocalCategory[]> {
    try {
      const result = db.getAllSync('SELECT * FROM categories ORDER BY isCustom ASC, name ASC');
      return result.map(row => ({
        ...(row as any),
        isCustom: Boolean((row as any).isCustom),
        isDirty: Boolean((row as any).isDirty)
      })) as LocalCategory[];
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  async updateCategory(id: string, updates: Partial<LocalCategory>): Promise<void> {
    const now = new Date().toISOString();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'createdAt')
        .map(key => `${key} = ?`)
        .join(', ');

      const values = Object.entries(updates)
        .filter(([key]) => key !== 'id' && key !== 'createdAt')
        .map(([_, value]) => value);

      const statement = db.prepareSync(`UPDATE categories SET ${setClause}, updatedAt = ?, isDirty = 0 WHERE id = ?`);
      statement.executeSync([...values, now, id]);
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  // User Preferences
  async setPreference(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      const statement = db.prepareSync('INSERT OR REPLACE INTO user_preferences (key, value, updatedAt) VALUES (?, ?, ?)');
      statement.executeSync([key, value, now]);
    } catch (error) {
      console.error('Error setting preference:', error);
      throw error;
    }
  }

  async getPreference(key: string): Promise<string | null> {
    try {
      const result = db.getFirstSync('SELECT value FROM user_preferences WHERE key = ?', [key]);
      return result ? (result as any).value : null;
    } catch (error) {
      console.error('Error getting preference:', error);
      return null;
    }
  }

  // Transfer Operations
  async transferMoney(transfer: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    description?: string;
    fee?: number;
  }): Promise<{
    fromTransaction: LocalTransaction;
    toTransaction: LocalTransaction;
    fromWalletBalance: number;
    toWalletBalance: number;
  }> {
    const now = new Date().toISOString();
    const { fromWalletId, toWalletId, amount, description = 'Wallet Transfer', fee = 0 } = transfer;

    try {
      let fromWalletBalance = 0;
      let toWalletBalance = 0;
      let fromTransaction: LocalTransaction;
      let toTransaction: LocalTransaction;

      // Execute as atomic transaction
      db.withTransactionSync(() => {
        // Get wallet balances and info
        const fromWallet = db.getFirstSync('SELECT * FROM wallets WHERE id = ? AND isActive = 1', [fromWalletId]) as any;
        const toWallet = db.getFirstSync('SELECT * FROM wallets WHERE id = ? AND isActive = 1', [toWalletId]) as any;

        if (!fromWallet || !toWallet) {
          throw new Error('One or both wallets not found');
        }

        // Check overdraft protection (allow overdraft only for credit cards)
        const totalDeduction = amount + fee;
        if (fromWallet.balance < totalDeduction && fromWallet.type !== 'CREDIT_CARD') {
          throw new Error('Insufficient balance for transfer including fees');
        }

        // Create transfer transactions
        const fromTransactionId = `transaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const toTransactionId = `transaction_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`;

        fromTransaction = {
          id: fromTransactionId,
          amount,
          description: `Transfer to ${toWallet.name}`,
          type: 'TRANSFER',
          date: now,
          notes: description,
          walletId: fromWalletId,
          createdAt: now,
          updatedAt: now,
          isDirty: true
        };

        toTransaction = {
          id: toTransactionId,
          amount,
          description: `Transfer from ${fromWallet.name}`,
          type: 'TRANSFER',
          date: now,
          notes: description,
          walletId: toWalletId,
          createdAt: now,
          updatedAt: now,
          isDirty: true
        };

        // Insert transactions
        const insertStatement = db.prepareSync(`
          INSERT INTO transactions (id, amount, description, type, date, notes, walletId, categoryId, createdAt, updatedAt, isDirty) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStatement.executeSync([
          fromTransaction.id,
          fromTransaction.amount,
          fromTransaction.description || null,
          fromTransaction.type,
          fromTransaction.date,
          fromTransaction.notes || null,
          fromTransaction.walletId,
          null,
          fromTransaction.createdAt,
          fromTransaction.updatedAt,
          1
        ]);

        insertStatement.executeSync([
          toTransaction.id,
          toTransaction.amount,
          toTransaction.description || null,
          toTransaction.type,
          toTransaction.date,
          toTransaction.notes || null,
          toTransaction.walletId,
          null,
          toTransaction.createdAt,
          toTransaction.updatedAt,
          1
        ]);

        // Update wallet balances
        fromWalletBalance = fromWallet.balance - totalDeduction;
        toWalletBalance = toWallet.balance + amount;

        const updateBalanceStatement = db.prepareSync('UPDATE wallets SET balance = ?, updatedAt = ?, isDirty = 1 WHERE id = ?');

        updateBalanceStatement.executeSync([fromWalletBalance, now, fromWalletId]);
        updateBalanceStatement.executeSync([toWalletBalance, now, toWalletId]);
      });

      return {
        fromTransaction: fromTransaction!,
        toTransaction: toTransaction!,
        fromWalletBalance,
        toWalletBalance
      };

    } catch (error) {
      console.error('Error transferring money:', error);
      throw error;
    }
  }

  // Get wallet transaction history
  async getWalletTransactions(walletId: string, limit: number = 50, offset: number = 0): Promise<{
    transactions: LocalTransaction[];
    total: number;
  }> {
    try {
      const transactions = db.getAllSync(`
        SELECT * FROM transactions 
        WHERE walletId = ? 
        ORDER BY date DESC, createdAt DESC 
        LIMIT ? OFFSET ?
      `, [walletId, limit, offset]);

      const totalResult = db.getFirstSync('SELECT COUNT(*) as count FROM transactions WHERE walletId = ?', [walletId]);
      const total = (totalResult as any)?.count || 0;

      return {
        transactions: transactions.map(row => ({
          ...(row as any),
          isDirty: Boolean((row as any).isDirty)
        })) as LocalTransaction[],
        total
      };
    } catch (error) {
      console.error('Error getting wallet transactions:', error);
      throw error;
    }
  }

  // Get balance history (simulate based on transactions)
  async getWalletBalanceHistory(walletId: string, days: number = 30): Promise<{
    wallet: LocalWallet | null;
    balanceHistory: Array<{ date: string; balance: number }>;
  }> {
    try {
      // Get wallet
      const walletResult = db.getFirstSync('SELECT * FROM wallets WHERE id = ? AND isActive = 1', [walletId]);
      const wallet = walletResult ? {
        ...(walletResult as any),
        isActive: Boolean((walletResult as any).isActive),
        isDirty: Boolean((walletResult as any).isDirty)
      } as LocalWallet : null;

      if (!wallet) {
        return { wallet: null, balanceHistory: [] };
      }

      // Get transactions for the period
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);

      const transactions = db.getAllSync(`
        SELECT amount, type, date 
        FROM transactions 
        WHERE walletId = ? AND date >= ? 
        ORDER BY date ASC, createdAt ASC
      `, [walletId, daysAgo.toISOString()]);

      // Calculate balance history
      const balanceHistory: Array<{ date: string; balance: number }> = [];
      let currentBalance = wallet.balance;

      // Work backwards from current balance
      const transactionsList = (transactions as any[]).reverse();

      for (const transaction of transactionsList) {
        const balanceChange = transaction.type === 'INCOME' || transaction.type === 'TRANSFER'
          ? transaction.amount
          : -transaction.amount;
        currentBalance -= balanceChange;
      }

      // Now work forwards to build history
      let runningBalance = currentBalance;
      const processedDates = new Set();

      for (const transaction of (transactions as any[])) {
        const date = transaction.date.split('T')[0]; // Get date part only

        const balanceChange = transaction.type === 'INCOME' || transaction.type === 'TRANSFER'
          ? transaction.amount
          : -transaction.amount;
        runningBalance += balanceChange;

        if (!processedDates.has(date)) {
          balanceHistory.push({
            date,
            balance: runningBalance
          });
          processedDates.add(date);
        }
      }

      // Add current balance for today if not already included
      const today = new Date().toISOString().split('T')[0];
      if (!processedDates.has(today)) {
        balanceHistory.push({
          date: today,
          balance: wallet.balance
        });
      }

      return { wallet, balanceHistory };

    } catch (error) {
      console.error('Error getting wallet balance history:', error);
      throw error;
    }
  }

  async getDirtyItems(): Promise<{
    wallets: LocalWallet[];
    transactions: LocalTransaction[];
    categories: LocalCategory[];
  }> {
    try {
      const [wallets, transactions, categories] = await Promise.all([
        this.getDirtyWallets(),
        this.getDirtyTransactions(),
        this.getDirtyCategories()
      ]);

      return { wallets, transactions, categories };
    } catch (error) {
      console.error('Error getting dirty items:', error);
      throw error;
    }
  }

  private async getDirtyWallets(): Promise<LocalWallet[]> {
    try {
      const result = db.getAllSync('SELECT * FROM wallets WHERE isDirty = 1');
      return result.map(row => ({
        ...(row as any),
        isActive: Boolean((row as any).isActive),
        isDirty: Boolean((row as any).isDirty)
      })) as LocalWallet[];
    } catch (error) {
      console.error('Error getting dirty wallets:', error);
      throw error;
    }
  }

  private async getDirtyTransactions(): Promise<LocalTransaction[]> {
    try {
      const result = db.getAllSync('SELECT * FROM transactions WHERE isDirty = 1');
      return result.map(row => ({
        ...(row as any),
        isDirty: Boolean((row as any).isDirty)
      })) as LocalTransaction[];
    } catch (error) {
      console.error('Error getting dirty transactions:', error);
      throw error;
    }
  }

  private async getDirtyCategories(): Promise<LocalCategory[]> {
    try {
      const result = db.getAllSync('SELECT * FROM categories WHERE isDirty = 1');
      return result.map(row => ({
        ...(row as any),
        isCustom: Boolean((row as any).isCustom),
        isDirty: Boolean((row as any).isDirty)
      })) as LocalCategory[];
    } catch (error) {
      console.error('Error getting dirty categories:', error);
      throw error;
    }
  }

  async markAsSynced(table: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');

    try {
      const statement = db.prepareSync(`UPDATE ${table} SET isDirty = 0, lastSynced = ? WHERE id IN (${placeholders})`);
      statement.executeSync([now, ...ids]);
    } catch (error) {
      console.error('Error marking as synced:', error);
      throw error;
    }
  }

  async logSync(status: string, itemsUploaded: number, itemsDownloaded: number, errors?: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      const statement = db.prepareSync('INSERT INTO sync_log (syncDate, status, itemsUploaded, itemsDownloaded, errors) VALUES (?, ?, ?, ?, ?)');
      statement.executeSync([now, status, itemsUploaded, itemsDownloaded, errors || null]);
    } catch (error) {
      console.error('Error logging sync:', error);
      throw error;
    }
  }

  async getLastSyncDate(): Promise<Date | null> {
    try {
      const result = db.getFirstSync('SELECT syncDate FROM sync_log WHERE status = "success" ORDER BY syncDate DESC LIMIT 1');
      if (result) {
        return new Date((result as any).syncDate);
      }
      return null;
    } catch (error) {
      console.error('Error getting last sync date:', error);
      return null;
    }
  }

  // Clear all data from database (for account deletion)
  async clearAllData(): Promise<void> {
    try {
      console.log('🗑️ Clearing local database...');

      // Delete all data from tables
      db.execSync('DELETE FROM transactions');
      db.execSync('DELETE FROM wallets');
      db.execSync('DELETE FROM categories');

      // Clear sync log as well
      try {
        db.execSync('DELETE FROM sync_log');
      } catch (error) {
        // Sync log table might not exist yet, that's okay
        console.log('Sync log table not found, skipping');
      }

      // Reset any auto-increment sequences if they exist
      try {
        db.execSync('DELETE FROM sqlite_sequence WHERE name IN ("transactions", "wallets", "categories", "sync_log")');
      } catch (error) {
        // This might fail if sequences don't exist, that's okay
        console.log('No sequences to reset');
      }

      console.log('✅ Local database cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing database:', error);
      throw error;
    }
  }

  // Restore methods that preserve original IDs (for sync purposes)
  async restoreWallet(wallet: LocalWallet): Promise<LocalWallet> {
    try {
      const now = new Date().toISOString();

      db.runSync(
        `INSERT OR REPLACE INTO wallets (
          id, name, type, balance, color, icon, isActive, 
          createdAt, updatedAt, lastSynced, isDirty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          wallet.id,
          wallet.name,
          wallet.type,
          wallet.balance,
          wallet.color,
          wallet.icon,
          wallet.isActive ? 1 : 0,
          wallet.createdAt || now,
          wallet.updatedAt || now,
          wallet.lastSynced || now,
          0 // Mark as not dirty since it's restored from cloud
        ]
      );

      return {
        ...wallet,
        createdAt: wallet.createdAt || now,
        updatedAt: wallet.updatedAt || now,
        lastSynced: wallet.lastSynced || now,
        isDirty: false,
      };
    } catch (error) {
      console.error('❌ Error restoring wallet:', error);
      throw error;
    }
  }

  async restoreTransaction(transaction: LocalTransaction): Promise<LocalTransaction> {
    try {
      const now = new Date().toISOString();

      db.runSync(
        `INSERT OR REPLACE INTO transactions (
          id, amount, description, type, date, notes, walletId, categoryId,
          createdAt, updatedAt, lastSynced, isDirty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.id,
          transaction.amount,
          transaction.description || '',
          transaction.type,
          transaction.date,
          transaction.notes || '',
          transaction.walletId,
          transaction.categoryId || null,
          transaction.createdAt || now,
          transaction.updatedAt || now,
          transaction.lastSynced || now,
          0 // Mark as not dirty since it's restored from cloud
        ]
      );

      return {
        ...transaction,
        createdAt: transaction.createdAt || now,
        updatedAt: transaction.updatedAt || now,
        lastSynced: transaction.lastSynced || now,
        isDirty: false,
      };
    } catch (error) {
      console.error('❌ Error restoring transaction:', error);
      throw error;
    }
  }
}

export const localStorageService = new LocalStorageService();