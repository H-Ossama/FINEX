import { localStorageService, LocalWallet, LocalTransaction, LocalCategory } from './localStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getBackendApiBaseUrl } from '../config/apiConfig';
import { cloudSyncDiagnostics } from '../utils/cloudSyncDiagnostics';
import { simpleCloudBackupService } from './simpleCloudBackupService';

interface HybridWallet extends Omit<LocalWallet, 'isDirty'> {
  syncStatus: 'synced' | 'local_only' | 'pending_sync' | 'conflict';
}

interface HybridTransaction extends Omit<LocalTransaction, 'isDirty'> {
  syncStatus: 'synced' | 'local_only' | 'pending_sync' | 'conflict';
}

interface AppInitResult {
  success: boolean;
  error?: string;
  syncStatus: {
    enabled: boolean;
    authenticated: boolean;
    pendingItems: number;
  };
}

class HybridDataService {
  private isInitialized = false;
  private initializationPromise: Promise<AppInitResult> | null = null;

  // Check if service is initialized
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  // Wait for initialization to complete
  public async waitForInitialization(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // If no initialization is in progress, start it
    await this.initializeApp();
  }

  // App Initialization
  async initializeApp(): Promise<AppInitResult> {
    // If already initialized, return success
    if (this.isInitialized) {
      return {
        success: true,
        syncStatus: {
          enabled: false,
          authenticated: false,
          pendingItems: 0,
        },
      };
    }

    // If initialization is already in progress, return that promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start new initialization
    this.initializationPromise = this._initializeApp();
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    return result;
  }

  private async _initializeApp(): Promise<AppInitResult> {
    try {
      // Initialize local database
      await localStorageService.initializeDatabase();

      // Seed default categories if needed
      const categories = await localStorageService.getCategories();
      if (categories.length === 0) {
        await localStorageService.seedDefaultCategories();
      }

      // Only seed demo data if explicitly requested or this is a demo account
      const shouldSeedDemoData = await this.shouldSeedDemoData();
      const isReturningUser = await this.isReturningUser();

      if (shouldSeedDemoData) {
        console.log('🎭 Seeding demo data...');
        // Seed default wallets if needed
        const wallets = await localStorageService.getWallets();
        if (wallets.length === 0) {
          await this.seedDefaultWallets();
        }

        // Seed sample transactions if needed (only for demo purposes)
        const transactions = await localStorageService.getTransactions();
        if (transactions.length === 0) {
          await this.seedSampleTransactions();
        }
      } else if (!isReturningUser) {
        console.log('✨ New user - starting with clean data');
      } else {
        console.log('👋 Welcome back!');
      }

      // Check sync status (use dynamic import to avoid circular dependency)
      let syncStatus = { enabled: false, authenticated: false, unsyncedItems: 0 };
      try {
        syncStatus = await this.getSyncStatus();

        // Check if sync reminder should be shown
        const shouldRemind = await this.shouldShowSyncReminder();
        if (shouldRemind) {
          // This will be handled by the UI component
          console.log('Sync reminder needed');
        }
      } catch (error) {
        console.log('Could not initialize cloud sync:', error);
      }

      this.isInitialized = true;

      return {
        success: true,
        syncStatus: {
          enabled: syncStatus.enabled,
          authenticated: syncStatus.authenticated,
          pendingItems: syncStatus.unsyncedItems || 0,
        },
      };
    } catch (error) {
      console.error('App initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed',
        syncStatus: {
          enabled: false,
          authenticated: false,
          pendingItems: 0,
        },
      };
    }
  }

  // Check if we should seed demo data
  private async shouldSeedDemoData(): Promise<boolean> {
    try {
      // Import AsyncStorage to check demo settings
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      // Check if this is a demo account or if user explicitly wants demo data
      const isDemoAccount = await AsyncStorage.default.getItem('is_demo_account');
      const seedDemoData = await AsyncStorage.default.getItem('seed_demo_data');

      // Only seed demo data if explicitly requested:
      // 1. It's marked as a demo account, OR
      // 2. User explicitly requested demo data
      // NEW USERS should start with empty data for privacy and clean experience
      return isDemoAccount === 'true' || seedDemoData === 'true';
    } catch (error) {
      console.log('Could not check demo settings, defaulting to no demo data');
      return false;
    }
  }

  private async isReturningUser(): Promise<boolean> {
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      // Check if user has authentication data stored
      const rememberMe = await AsyncStorage.default.getItem('remember_me');
      const userData = await AsyncStorage.default.getItem('user_data');
      const isGoogleUser = await AsyncStorage.default.getItem('google_user');

      // Consider them a returning user if:
      // 1. They have "remember me" enabled, OR
      // 2. They have user data stored, OR  
      // 3. They are a Google user
      return rememberMe === 'true' || userData !== null || isGoogleUser === 'true';
    } catch (error) {
      console.log('Could not check returning user status');
      return false;
    }
  }

  // Wallet Operations (Always work locally first)
  async createWallet(walletData: {
    name: string;
    type: 'BANK' | 'CASH' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER';
    balance?: number;
    color?: string;
    icon?: string;
  }): Promise<HybridWallet> {
    await this.waitForInitialization();

    // Create locally first
    const wallet = await localStorageService.createWallet({
      ...walletData,
      balance: walletData.balance || 0,
      color: walletData.color || '#3B82F6',
      icon: walletData.icon || 'wallet',
      isActive: true,
    });

    // Convert to hybrid format
    return this.convertWalletToHybrid(wallet);
  }

  async getWallets(): Promise<HybridWallet[]> {
    await this.waitForInitialization();

    const wallets = await localStorageService.getWallets();
    return wallets.map(wallet => this.convertWalletToHybrid(wallet));
  }

  async updateWallet(id: string, updates: Partial<LocalWallet>): Promise<void> {
    await this.waitForInitialization();

    await localStorageService.updateWallet(id, updates);
  }

  async deleteWallet(id: string): Promise<void> {
    await this.waitForInitialization();

    await localStorageService.deleteWallet(id);
  }

  // Transaction Operations
  async createTransaction(transactionData: {
    amount: number;
    description?: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date?: string;
    notes?: string;
    walletId: string;
    categoryId?: string;
  }): Promise<HybridTransaction> {
    await this.waitForInitialization();

    // Create locally first
    const transaction = await localStorageService.createTransaction({
      ...transactionData,
      date: transactionData.date || new Date().toISOString(),
    });

    // Convert to hybrid format
    return this.convertTransactionToHybrid(transaction);
  }

  // Alias for createTransaction for backward compatibility
  async addTransaction(transactionData: {
    amount: number;
    description?: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date?: string;
    notes?: string;
    walletId: string;
    categoryId?: string;
  }): Promise<HybridTransaction> {
    return this.createTransaction(transactionData);
  }

  async getTransactions(walletId?: string, limit?: number): Promise<HybridTransaction[]> {
    await this.waitForInitialization();

    const transactions = await localStorageService.getTransactions(walletId, limit);
    return transactions.map(transaction => this.convertTransactionToHybrid(transaction));
  }

  async getRecentTransactions(limit: number = 10): Promise<HybridTransaction[]> {
    return this.getTransactions(undefined, limit);
  }

  async updateTransaction(id: string, updates: Partial<LocalTransaction>): Promise<void> {
    await this.waitForInitialization();
    await localStorageService.updateTransaction(id, updates);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.waitForInitialization();
    await localStorageService.deleteTransaction(id);
  }

  // Transfer Operations
  async transferMoney(transfer: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    description?: string;
    fee?: number;
  }): Promise<{
    fromTransaction: HybridTransaction;
    toTransaction: HybridTransaction;
    fromWalletBalance: number;
    toWalletBalance: number;
  }> {
    await this.waitForInitialization();

    const result = await localStorageService.transferMoney(transfer);

    return {
      fromTransaction: this.convertTransactionToHybrid(result.fromTransaction),
      toTransaction: this.convertTransactionToHybrid(result.toTransaction),
      fromWalletBalance: result.fromWalletBalance,
      toWalletBalance: result.toWalletBalance,
    };
  }

  // Wallet Transaction History
  async getWalletTransactions(walletId: string, limit: number = 50, offset: number = 0): Promise<{
    transactions: HybridTransaction[];
    total: number;
  }> {
    await this.waitForInitialization();

    const result = await localStorageService.getWalletTransactions(walletId, limit, offset);

    return {
      transactions: result.transactions.map(transaction => this.convertTransactionToHybrid(transaction)),
      total: result.total,
    };
  }

  // Balance History
  async getWalletBalanceHistory(walletId: string, days: number = 30): Promise<{
    wallet: HybridWallet | null;
    balanceHistory: Array<{ date: string; balance: number }>;
  }> {
    await this.waitForInitialization();

    const result = await localStorageService.getWalletBalanceHistory(walletId, days);

    return {
      wallet: result.wallet ? this.convertWalletToHybrid(result.wallet) : null,
      balanceHistory: result.balanceHistory,
    };
  }

  // Category Operations
  async getCategories(): Promise<LocalCategory[]> {
    await this.waitForInitialization();

    return localStorageService.getCategories();
  }

  // Analytics (Local calculations)
  async getWalletBalance(): Promise<number> {
    const wallets = await this.getWallets();
    return wallets.reduce((total, wallet) => total + wallet.balance, 0);
  }

  async getMonthlySpending(year?: number, month?: number): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netAmount: number;
    transactionCount: number;
  }> {
    const transactions = await this.getTransactions();

    const targetDate = new Date(year || new Date().getFullYear(), month || new Date().getMonth());
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    const monthlyTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startOfMonth && transactionDate <= endOfMonth;
    });

    const totalIncome = monthlyTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = monthlyTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      transactionCount: monthlyTransactions.length,
    };
  }

  async getCategorySpending(categoryId: string, days: number = 30): Promise<{
    totalSpent: number;
    transactionCount: number;
    averagePerTransaction: number;
  }> {
    const transactions = await this.getTransactions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const categoryTransactions = transactions.filter(t =>
      t.categoryId === categoryId &&
      t.type === 'EXPENSE' &&
      new Date(t.date) >= cutoffDate
    );

    const totalSpent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = categoryTransactions.length;

    return {
      totalSpent,
      transactionCount,
      averagePerTransaction: transactionCount > 0 ? totalSpent / transactionCount : 0,
    };
  }

  // Sync Operations
  async enableCloudSync(email?: string, password?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { cloudSyncService } = await import('./cloudSyncService');
      if (email && password) {
        // Login if credentials provided
        const result = await cloudSyncService.login(email, password);
        if (!result.success) {
          return result;
        }
      }

      await cloudSyncService.enableSync();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable sync',
      };
    }
  }

  async performManualSync(onProgress?: (progress: any) => void): Promise<{
    success: boolean;
    error?: string;
    syncedData?: {
      wallets: number;
      transactions: number;
      categories: number;
      errors?: string[];
    };
  }> {
    try {
      if (!simpleCloudBackupService.isAuthenticated()) {
        return { success: false, error: 'Sign in with Google to backup to cloud' };
      }

      // Manual sync in the new model == create a cloud backup
      const result = await simpleCloudBackupService.backup((p) => {
        try {
          onProgress?.({
            operation: 'backup',
            stage: p.stage,
            progress: p.progress,
            message: p.message,
            itemsCount: (p as any).itemsCount,
            complete: p.stage === 'complete',
            failed: p.stage === 'error',
            error: p.error,
          });
        } catch { }
      });

      if (result.success) {
        try {
          await AsyncStorage.setItem('cloud_sync_enabled', 'true');
        } catch { }
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Sync failed' };
    }
  }

  async restoreFromCloud(user: any, onProgress?: (progress: any) => void): Promise<{ success: boolean; error?: string; lastSync?: string }> {
    try {
      if (!simpleCloudBackupService.isAuthenticated()) {
        return { success: false, error: 'Sign in with Google to restore from cloud' };
      }

      const result = await simpleCloudBackupService.restore((p) => {
        try {
          onProgress?.({
            operation: 'restore',
            stage: p.stage,
            progress: p.progress,
            message: p.message,
            itemsCount: (p as any).itemsCount,
            complete: p.stage === 'complete',
            failed: p.stage === 'error',
            error: p.error,
          });
        } catch { }
      });

      return { success: result.success, error: result.error, lastSync: result.timestamp };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Restore failed' };
    }
  }

  async getSyncStatus(): Promise<{
    enabled: boolean;
    authenticated: boolean;
    lastSync: Date | null;
    unsyncedItems: number;
    nextReminderDue: Date | null;
  }> {
    try {
      const enabledFlag = (await AsyncStorage.getItem('cloud_sync_enabled')) === 'true';
      const authenticated = simpleCloudBackupService.isAuthenticated();

      // Use the last backup time as "lastSync" for UI compatibility
      const times = await simpleCloudBackupService.getLastSyncTimes().catch(() => ({ lastBackup: null, lastRestore: null }));
      const lastSync = times.lastBackup ? new Date(times.lastBackup) : null;

      // Count dirty/unsynced SQLite items (AsyncStorage items aren't tracked)
      let unsyncedItems = 0;
      try {
        const [wallets, transactions, categories] = await Promise.all([
          localStorageService.getWallets(),
          localStorageService.getTransactions(),
          localStorageService.getCategories(),
        ]);
        unsyncedItems =
          wallets.filter(w => (w as any).isDirty || !(w as any).lastSynced).length +
          transactions.filter(t => (t as any).isDirty || !(t as any).lastSynced).length +
          categories.filter(c => (c as any).isDirty || !(c as any).lastSynced).length;
      } catch {
        // ignore
      }

      return {
        enabled: enabledFlag,
        authenticated,
        lastSync,
        unsyncedItems,
        nextReminderDue: null,
      };
    } catch (error) {
      return { enabled: false, authenticated: false, lastSync: null, unsyncedItems: 0, nextReminderDue: null };
    }
  }

  async getSyncOverview(): Promise<{
    wallets: number;
    transactions: number;
    categories: number;
    totalItems: number;
  }> {
    try {
      const wallets = await localStorageService.getWallets();
      const transactions = await localStorageService.getTransactions();
      const categories = await localStorageService.getCategories();

      const walletsCount = wallets.length;
      const transactionsCount = transactions.length;
      const categoriesCount = categories.length;

      return {
        wallets: walletsCount,
        transactions: transactionsCount,
        categories: categoriesCount,
        totalItems: walletsCount + transactionsCount + categoriesCount,
      };
    } catch (error) {
      console.error('Error getting sync overview:', error);
      return {
        wallets: 0,
        transactions: 0,
        categories: 0,
        totalItems: 0,
      };
    }
  }

  async getUnsyncedOverview(): Promise<{
    wallets: number;
    transactions: number;
    categories: number;
    totalItems: number;
  }> {
    try {
      const dirtyItems = await localStorageService.getDirtyItems();

      const walletsCount = dirtyItems.wallets.length;
      const transactionsCount = dirtyItems.transactions.length;
      const categoriesCount = dirtyItems.categories.length;

      return {
        wallets: walletsCount,
        transactions: transactionsCount,
        categories: categoriesCount,
        totalItems: walletsCount + transactionsCount + categoriesCount,
      };
    } catch (error) {
      console.error('Error getting unsynced overview:', error);
      return {
        wallets: 0,
        transactions: 0,
        categories: 0,
        totalItems: 0,
      };
    }
  }

  async saveLastSyncDetails(syncData: any): Promise<void> {
    try {
      const syncDetails = {
        timestamp: new Date().toISOString(),
        wallets: syncData.wallets || 0,
        transactions: syncData.transactions || 0,
        categories: syncData.categories || 0,
        errors: syncData.errors || [],
      };
      await AsyncStorage.setItem('lastSyncDetails', JSON.stringify(syncDetails));
    } catch (error) {
      console.error('Error saving last sync details:', error);
    }
  }

  async getLastSyncDetails(): Promise<{
    timestamp: string;
    wallets: number;
    transactions: number;
    categories: number;
    errors: string[];
  } | null> {
    try {
      const details = await AsyncStorage.getItem('lastSyncDetails');
      if (details) {
        return JSON.parse(details);
      }
      return null;
    } catch (error) {
      console.error('Error getting last sync details:', error);
      return null;
    }
  }

  async shouldShowSyncReminder(): Promise<boolean> {
    try {
      // Check if sync reminders are suppressed due to auto-sync
      const suppressed = await this.areSyncRemindersSuppressed();
      if (suppressed) {
        return false;
      }

      // Check if sync reminders are completely disabled by user
      const disabled = await this.areSyncRemindersDisabled();
      if (disabled) {
        return false;
      }

      // Mirror legacy behavior: show reminder when cloud backup is disabled
      // AND there is data that could be backed up.
      const cloudSyncEnabled = await AsyncStorage.getItem('cloud_sync_enabled');
      const isSyncDisabled = cloudSyncEnabled !== 'true';
      if (!isSyncDisabled) {
        return false;
      }

      const status = await this.getSyncStatus();
      return isSyncDisabled && (status.unsyncedItems > 0);
    } catch (error) {
      return false;
    }
  }

  async markSyncReminderShown(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_reminder_last_shown', new Date().toISOString());
    } catch (error) {
      console.log('Could not mark sync reminder as shown:', error);
    }
  }

  // Auto-sync settings
  async getAutoSyncSettings(): Promise<{
    enabled: boolean;
    period: 'daily' | 'weekly' | 'monthly' | 'custom';
    customInterval?: number;
    customUnit?: 'hours' | 'days' | 'weeks';
  }> {
    try {
      const settings = await AsyncStorage.getItem('auto_sync_settings');
      return settings ? JSON.parse(settings) : { enabled: false, period: 'weekly' };
    } catch (error) {
      return { enabled: false, period: 'weekly' };
    }
  }

  async setAutoSyncSettings(settings: {
    enabled: boolean;
    period: 'daily' | 'weekly' | 'monthly' | 'custom';
    customInterval?: number;
    customUnit?: 'hours' | 'days' | 'weeks';
  }): Promise<void> {
    try {
      await AsyncStorage.setItem('auto_sync_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving auto-sync settings:', error);
    }
  }

  async setSyncRemindersSuppressed(suppressed: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_reminders_suppressed', JSON.stringify(suppressed));
    } catch (error) {
      console.error('Error setting sync reminders suppression:', error);
    }
  }

  async areSyncRemindersSuppressed(): Promise<boolean> {
    try {
      const suppressed = await AsyncStorage.getItem('sync_reminders_suppressed');
      return suppressed ? JSON.parse(suppressed) : false;
    } catch (error) {
      return false;
    }
  }

  async setSyncRemindersDisabled(disabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_reminders_disabled', JSON.stringify(disabled));
    } catch (error) {
      console.error('Error setting sync reminders disabled:', error);
    }
  }

  async areSyncRemindersDisabled(): Promise<boolean> {
    try {
      const disabled = await AsyncStorage.getItem('sync_reminders_disabled');
      return disabled ? JSON.parse(disabled) : false;
    } catch (error) {
      return false;
    }
  }

  // User Authentication
  async registerUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { cloudSyncService } = await import('./cloudSyncService');
    const result = await cloudSyncService.register(
      userData.email,
      userData.password,
      userData.firstName,
      userData.lastName
    );

    if (result.success) {
      // Perform initial sync after registration
      await this.performManualSync();
    }

    return result;
  }

  async loginUser(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { cloudSyncService } = await import('./cloudSyncService');
    const result = await cloudSyncService.login(email, password);

    if (result.success) {
      // Enable sync and perform initial sync
      await cloudSyncService.enableSync();
      await this.performManualSync();
    }

    return result;
  }

  async logoutUser(): Promise<void> {
    const { cloudSyncService } = await import('./cloudSyncService');
    await cloudSyncService.logout();
  }

  async enableCloudSyncForExistingUser(user: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Enabling cloud sync for existing user:', user.email);
      const { cloudSyncService } = await import('./cloudSyncService');
      const { backendAuthService } = await import('./backendAuthService');

      await cloudSyncDiagnostics.append('info', 'Enable cloud sync requested', {
        email: user?.email,
        isGoogleUser: !!user?.isGoogleUser,
      });

      const getStoredAuthToken = async (): Promise<string | null> => {
        try {
          const token = await SecureStore.getItemAsync('user_token');
          if (token) return token;
        } catch (e) {
          console.error('SecureStore read failed:', e);
        }

        const demoToken = await AsyncStorage.getItem('demo_token_backup');
        if (demoToken) return demoToken;
        const backupToken = await AsyncStorage.getItem('auth_token_backup');
        if (backupToken) return backupToken;
        return null;
      };

      // Cloud sync requires a backend session JWT (validated by backend middleware).
      // Never invent a token locally (backend will reject it).
      let authToken: string | null = null;

      if (user?.isGoogleUser) {
        // Prefer cached backend token
        authToken = await AsyncStorage.getItem('auth_token');
        if (!authToken) {
          // Wake backend (Railway can sleep)
          try {
            const base = getBackendApiBaseUrl();
            await cloudSyncDiagnostics.append('info', 'Waking backend before Google session exchange', { url: `${base}/health` });
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            try {
              await fetch(`${base}/health`, { method: 'GET', signal: controller.signal });
            } finally {
              clearTimeout(timeoutId);
            }
          } catch { }

          // Exchange stored Google ID token for backend session
          const googleIdToken = await SecureStore.getItemAsync('google_id_token');
          if (googleIdToken) {
            await cloudSyncDiagnostics.append('info', 'Exchanging Google ID token for backend session');
            const backendLogin = await backendAuthService.loginWithGoogle(googleIdToken);
            if (backendLogin.success) {
              authToken = backendLogin.token;
              await AsyncStorage.setItem('auth_token', authToken);
            } else {
              await cloudSyncDiagnostics.append('error', 'Backend Google login failed', {
                error: backendLogin.error,
                status: (backendLogin as any).status,
                networkError: (backendLogin as any).networkError,
              });

              const status = (backendLogin as any).status as number | undefined;
              const networkError = (backendLogin as any).networkError as boolean | undefined;
              const baseMessage = backendLogin.error || 'Backend Google login failed';
              const enrichedMessage = networkError
                ? `${baseMessage}. Check your internet connection and try again.`
                : typeof status === 'number'
                  ? `${baseMessage} (HTTP ${status})`
                  : baseMessage;

              return { success: false, error: enrichedMessage };
            }
          } else {
            await cloudSyncDiagnostics.append('error', 'Missing google_id_token in SecureStore');
          }
        }
      } else {
        // Email/password users should already have a backend session token stored.
        authToken = user?.accessToken || user?.idToken || null;
        if (!authToken) {
          authToken = await getStoredAuthToken();
        }
      }

      if (!authToken) {
        await cloudSyncDiagnostics.append('error', 'Missing backend session token after enable attempt', {
          email: user?.email,
          isGoogleUser: !!user?.isGoogleUser,
        });
        return {
          success: false,
          error: 'Missing backend session token. Please sign in again, then retry cloud sync.',
        };
      }

      console.log('🔑 Setting auth token for cloud sync service');
      await cloudSyncService.setAuthToken(authToken);
      await cloudSyncDiagnostics.append('info', 'Cloud sync auth token set');

      // Check if user is already authenticated with Google
      if (user.isGoogleUser) {
        console.log('📱 Google user detected, enabling sync directly');
        // For Google users, enable sync directly since they're already authenticated
        await cloudSyncService.enableSync();

        // Store Google sync enabled flag
        await AsyncStorage.setItem('cloud_sync_enabled', 'true');
        console.log('✅ Cloud sync enabled for Google user');
        await cloudSyncDiagnostics.append('info', 'Cloud sync enabled');
        return { success: true };
      } else {
        console.log('📧 Email user detected, enabling sync with credentials');
        // For email/password users, use their existing credentials to enable sync
        await cloudSyncService.enableSync();

        // Store sync enabled flag
        await AsyncStorage.setItem('cloud_sync_enabled', 'true');
        console.log('✅ Cloud sync enabled for email user');
        await cloudSyncDiagnostics.append('info', 'Cloud sync enabled');
        return { success: true };
      }
    } catch (error) {
      console.error('❌ Error enabling cloud sync for existing user:', error);
      await cloudSyncDiagnostics.append('error', 'Enable cloud sync crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable sync'
      };
    }
  }

  async disableCloudSync(): Promise<void> {
    try {
      const { cloudSyncService } = await import('./cloudSyncService');
      await cloudSyncService.disableSync();
    } catch (error) {
      console.error('Error disabling cloud sync:', error);
    }
  }

  // Helper Methods
  private convertWalletToHybrid(wallet: LocalWallet): HybridWallet {
    const syncStatus = wallet.lastSynced
      ? 'synced'
      : wallet.isDirty
        ? 'pending_sync'
        : 'local_only';

    const { isDirty, ...walletData } = wallet;
    return {
      ...walletData,
      syncStatus: syncStatus as any,
    };
  }

  private async seedSampleTransactions(): Promise<void> {
    try {
      // Get the wallets first
      const wallets = await localStorageService.getWallets();
      if (wallets.length === 0) return;

      // Get categories for more realistic transactions
      const categories = await localStorageService.getCategories();
      const foodCategory = categories.find(c => c.name.includes('Food') || c.name.includes('Dining'));
      const shoppingCategory = categories.find(c => c.name.includes('Shopping'));
      const salaryCategory = categories.find(c => c.name.includes('Salary'));

      const bankWallet = wallets.find(w => w.type === 'BANK');
      const cashWallet = wallets.find(w => w.type === 'CASH');

      if (!bankWallet || !cashWallet) return;

      const sampleTransactions = [
        {
          amount: 3500,
          description: 'Monthly Salary',
          type: 'INCOME' as const,
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          walletId: bankWallet.id,
          categoryId: salaryCategory?.id,
        },
        {
          amount: 85.50,
          description: 'Grocery Shopping',
          type: 'EXPENSE' as const,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          walletId: bankWallet.id,
          categoryId: foodCategory?.id,
        },
        {
          amount: 15.75,
          description: 'Coffee & Pastry',
          type: 'EXPENSE' as const,
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          walletId: cashWallet.id,
          categoryId: foodCategory?.id,
        },
        {
          amount: 120.00,
          description: 'Online Shopping',
          type: 'EXPENSE' as const,
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          walletId: bankWallet.id,
          categoryId: shoppingCategory?.id,
        },
        {
          amount: 200.00,
          description: 'Transfer from Bank to Cash',
          type: 'TRANSFER' as const,
          date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
          walletId: cashWallet.id,
        },
      ];

      for (const transactionData of sampleTransactions) {
        await localStorageService.createTransaction(transactionData);
      }

      console.log('✅ Sample transactions seeded');
    } catch (error) {
      console.error('Error seeding sample transactions:', error);
      throw error;
    }
  }

  private async seedDefaultWallets(): Promise<void> {
    const defaultWallets = [
      {
        name: 'Pocket Money',
        type: 'CASH' as const,
        balance: 100,
        color: '#7ED321',
        icon: 'wallet',
        isActive: true,
      },
      {
        name: 'Bank Account',
        type: 'BANK' as const,
        balance: 2500,
        color: '#4A90E2',
        icon: 'card',
        isActive: true,
      },
      {
        name: 'Savings',
        type: 'SAVINGS' as const,
        balance: 1000,
        color: '#9013FE',
        icon: 'shield-checkmark',
        isActive: true,
      },
    ];

    try {
      for (const walletData of defaultWallets) {
        await localStorageService.createWallet(walletData);
      }
      console.log('✅ Default wallets seeded');
    } catch (error) {
      console.error('Error seeding default wallets:', error);
      throw error;
    }
  }

  private convertTransactionToHybrid(transaction: LocalTransaction): HybridTransaction {
    const syncStatus = transaction.lastSynced
      ? 'synced'
      : transaction.isDirty
        ? 'pending_sync'
        : 'local_only';

    const { isDirty, ...transactionData } = transaction;
    return {
      ...transactionData,
      syncStatus: syncStatus as any,
    };
  }

  // Data Export/Import for backup
  async exportAllData(): Promise<{
    wallets: HybridWallet[];
    transactions: HybridTransaction[];
    categories: LocalCategory[];
    exportDate: string;
  }> {
    const [wallets, transactions, categories] = await Promise.all([
      this.getWallets(),
      this.getTransactions(),
      this.getCategories(),
    ]);

    return {
      wallets,
      transactions,
      categories,
      exportDate: new Date().toISOString(),
    };
  }

  // Quick stats for dashboard
  async getDashboardStats(): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    recentTransactions: HybridTransaction[];
    syncStatus: {
      enabled: boolean;
      pendingItems: number;
      lastSync: Date | null;
    };
  }> {
    const [totalBalance, monthlyData, recentTransactions, syncStatus] = await Promise.all([
      this.getWalletBalance(),
      this.getMonthlySpending(),
      this.getRecentTransactions(5),
      this.getSyncStatus(),
    ]);

    return {
      totalBalance,
      monthlyIncome: monthlyData.totalIncome,
      monthlyExpenses: monthlyData.totalExpenses,
      recentTransactions,
      syncStatus: {
        enabled: syncStatus.enabled,
        pendingItems: syncStatus.unsyncedItems,
        lastSync: syncStatus.lastSync,
      },
    };
  }

  // Notification methods
  async registerPushToken(tokenData: {
    token: string;
    deviceId?: string;
    platform?: string;
    appVersion?: string;
  }): Promise<void> {
    try {
      // Try to register with backend if online
      const { cloudSyncService } = await import('./cloudSyncService');
      await cloudSyncService.registerPushToken(tokenData);
    } catch (error) {
      console.log('Could not register push token with backend:', error);
      // Store locally for later sync
      // You could implement local storage for push tokens here
    }
  }

  async getNotifications(): Promise<any[]> {
    try {
      // Try to get from backend first
      const { cloudSyncService } = await import('./cloudSyncService');
      return await cloudSyncService.getNotifications();
    } catch (error) {
      console.log('Could not fetch notifications from backend:', error);
      // Return empty array or local notifications if stored
      return [];
    }
  }

  async getNotificationPreferences(): Promise<any> {
    try {
      // Try to get from backend first
      const { cloudSyncService } = await import('./cloudSyncService');
      return await cloudSyncService.getNotificationPreferences();
    } catch (error) {
      console.log('Could not fetch notification preferences from backend:', error);
      // Return null to use defaults
      return null;
    }
  }

  async updateNotificationPreferences(preferences: any): Promise<void> {
    try {
      // Try to update on backend
      const { cloudSyncService } = await import('./cloudSyncService');
      await cloudSyncService.updateNotificationPreferences(preferences);
    } catch (error) {
      console.log('Could not update notification preferences on backend:', error);
      // Store locally for later sync
      // You could implement local storage for preferences here
    }
  }

  // Clear all user data (for account deletion)
  async clearAllData(): Promise<void> {
    try {
      console.log('🗑️ Clearing all user data...');

      // Clear local database (wallets, transactions, categories)
      await localStorageService.clearAllData();

      // Clear bills data
      try {
        const { billsService } = await import('./billsService');
        await billsService.clearAllBills();
        console.log('✅ Bills data cleared');
      } catch (error) {
        console.log('⚠️ Error clearing bills data:', error);
      }

      // Clear goals data
      try {
        const { GoalsService } = await import('./goalsService');
        await GoalsService.clearAllGoals();
        console.log('✅ Goals data cleared');
      } catch (error) {
        console.log('⚠️ Error clearing goals data:', error);
      }

      // Clear budget data
      try {
        const { budgetService } = await import('./budgetService');
        await budgetService.clearAllBudgets();
        console.log('✅ Budget data cleared');
      } catch (error) {
        console.log('⚠️ Error clearing budget data:', error);
      }

      // Clear sync status
      try {
        const { cloudSyncService } = await import('./cloudSyncService');
        await cloudSyncService.clearSyncData();
      } catch (error) {
        console.log('Could not clear sync data:', error);
      }

      // Reset initialization state
      this.isInitialized = false;

      console.log('✅ All user data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
      throw error;
    }
  }

  // Enable demo mode - seeds sample data for users who want to try the app
  async enableDemoMode(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🎭 Enabling demo mode...');

      // Set demo flag
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.default.setItem('is_demo_account', 'true');
      await AsyncStorage.default.setItem('seed_demo_data', 'true');

      // Clear existing data first
      await this.clearAllData();

      // Re-initialize with demo data
      await this.initializeApp();

      // Import and seed demo goals
      const { GoalsService } = await import('./goalsService');
      await GoalsService.seedDemoGoals();

      // Import and seed demo reminders, bills, budgets
      const { dataInitializationService } = await import('./dataInitializationService');
      await dataInitializationService.initializeSampleData();

      console.log('✅ Demo mode enabled successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error enabling demo mode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable demo mode'
      };
    }
  }

  // Disable demo mode - clears all data and resets to fresh state
  async disableDemoMode(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚫 Disabling demo mode...');

      // Clear demo flags
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.default.removeItem('is_demo_account');
      await AsyncStorage.default.removeItem('seed_demo_data');

      // Clear all data
      await this.clearAllData();

      // Re-initialize as fresh app
      await this.initializeApp();

      console.log('✅ Demo mode disabled successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error disabling demo mode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable demo mode'
      };
    }
  }

  // Check if demo mode is enabled
  async isDemoModeEnabled(): Promise<boolean> {
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const isDemoAccount = await AsyncStorage.default.getItem('is_demo_account');
      return isDemoAccount === 'true';
    } catch (error) {
      return false;
    }
  }

  // Restore methods that preserve original IDs (for sync purposes)
  async restoreWallet(walletData: HybridWallet | LocalWallet): Promise<HybridWallet> {
    await this.waitForInitialization();

    // Convert to LocalWallet format if needed
    const localWallet: LocalWallet = {
      id: walletData.id,
      name: walletData.name,
      type: walletData.type,
      balance: walletData.balance,
      color: walletData.color,
      icon: walletData.icon,
      isActive: walletData.isActive,
      createdAt: walletData.createdAt,
      updatedAt: walletData.updatedAt,
      lastSynced: walletData.lastSynced,
      isDirty: false,
    };

    const restoredWallet = await localStorageService.restoreWallet(localWallet);
    return this.convertWalletToHybrid(restoredWallet);
  }

  async restoreTransaction(transactionData: HybridTransaction | LocalTransaction): Promise<HybridTransaction> {
    await this.waitForInitialization();

    // Convert to LocalTransaction format if needed
    const localTransaction: LocalTransaction = {
      id: transactionData.id,
      amount: transactionData.amount,
      description: transactionData.description,
      type: transactionData.type,
      date: transactionData.date,
      notes: transactionData.notes,
      walletId: transactionData.walletId,
      categoryId: transactionData.categoryId,
      createdAt: transactionData.createdAt,
      updatedAt: transactionData.updatedAt,
      lastSynced: transactionData.lastSynced,
      isDirty: false,
    };

    const restoredTransaction = await localStorageService.restoreTransaction(localTransaction);
    return this.convertTransactionToHybrid(restoredTransaction);
  }
}

export const hybridDataService = new HybridDataService();
export type { HybridWallet, HybridTransaction, AppInitResult };