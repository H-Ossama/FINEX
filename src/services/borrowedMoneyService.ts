import { BorrowedMoney } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hybridDataService } from './hybridDataService';

const BORROWED_MONEY_KEY = 'borrowed_money';

export class BorrowedMoneyService {
  private static instance: BorrowedMoneyService;
  private borrowedMoneyList: BorrowedMoney[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): BorrowedMoneyService {
    if (!BorrowedMoneyService.instance) {
      BorrowedMoneyService.instance = new BorrowedMoneyService();
    }
    return BorrowedMoneyService.instance;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(BORROWED_MONEY_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Migrating existing data to have a type
        this.borrowedMoneyList = parsed.map((item: any) => ({
          ...item,
          type: item.type || 'borrowed',
        }));
      }
    } catch (error) {
      console.error('Error loading borrowed money from storage:', error);
      this.borrowedMoneyList = [];
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(BORROWED_MONEY_KEY, JSON.stringify(this.borrowedMoneyList));
    } catch (error) {
      console.error('Error saving borrowed money to storage:', error);
    }
  }

  public async getAllBorrowedMoney(): Promise<BorrowedMoney[]> {
    await this.loadFromStorage();
    return [...this.borrowedMoneyList].sort((a, b) =>
      new Date(b.borrowedDate).getTime() - new Date(a.borrowedDate).getTime()
    );
  }

  public async getUnpaidBorrowedMoney(): Promise<BorrowedMoney[]> {
    await this.loadFromStorage();
    return this.borrowedMoneyList
      .filter(item => !item.isPaid)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  public async getPaidBorrowedMoney(): Promise<BorrowedMoney[]> {
    await this.loadFromStorage();
    return this.borrowedMoneyList
      .filter(item => item.isPaid)
      .sort((a, b) => new Date(b.borrowedDate).getTime() - new Date(a.borrowedDate).getTime());
  }

  public async getOverdueBorrowedMoney(): Promise<BorrowedMoney[]> {
    await this.loadFromStorage();
    const now = new Date();
    return this.borrowedMoneyList
      .filter(item => !item.isPaid && new Date(item.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  public async getTotalBorrowedAmount(): Promise<number> {
    await this.loadFromStorage();
    return this.borrowedMoneyList
      .filter(item => !item.isPaid && item.type === 'borrowed')
      .reduce((total, item) => total + item.amount, 0);
  }

  public async getTotalLentAmount(): Promise<number> {
    await this.loadFromStorage();
    return this.borrowedMoneyList
      .filter(item => !item.isPaid && item.type === 'lent')
      .reduce((total, item) => total + item.amount, 0);
  }

  public async getTotalPaidBorrowedAmount(): Promise<number> {
    await this.loadFromStorage();
    return this.borrowedMoneyList
      .filter(item => item.isPaid && item.type === 'borrowed')
      .reduce((total, item) => total + item.amount, 0);
  }

  public async getTotalPaidLentAmount(): Promise<number> {
    await this.loadFromStorage();
    return this.borrowedMoneyList
      .filter(item => item.isPaid && item.type === 'lent')
      .reduce((total, item) => total + item.amount, 0);
  }

  public async addBorrowedMoney(borrowedMoney: Omit<BorrowedMoney, 'id'>, t?: any): Promise<BorrowedMoney> {
    const newBorrowedMoney: BorrowedMoney = {
      ...borrowedMoney,
      id: Date.now().toString(),
    };

    const isLent = borrowedMoney.type === 'lent';

    // Create a transaction
    await hybridDataService.createTransaction({
      amount: borrowedMoney.amount,
      description: isLent
        ? (t ? t('lent_money_to', { name: borrowedMoney.personName }) : `Lent money to ${borrowedMoney.personName}`)
        : (t ? t('borrowed_money_from', { name: borrowedMoney.personName }) : `Borrowed money from ${borrowedMoney.personName}`),
      type: isLent ? 'EXPENSE' : 'INCOME',
      walletId: borrowedMoney.walletId,
      date: new Date().toISOString(),
      notes: t
        ? t(isLent ? 'lent_for' : 'borrowed_for', { reason: borrowedMoney.reason })
        : `${isLent ? 'Lent' : 'Borrowed'} for: ${borrowedMoney.reason}`,
    });

    this.borrowedMoneyList.push(newBorrowedMoney);
    await this.saveToStorage();
    return newBorrowedMoney;
  }

  public async updateBorrowedMoney(id: string, updates: Partial<BorrowedMoney>): Promise<BorrowedMoney | null> {
    const index = this.borrowedMoneyList.findIndex(item => item.id === id);
    if (index === -1) {
      return null;
    }

    this.borrowedMoneyList[index] = { ...this.borrowedMoneyList[index], ...updates };
    await this.saveToStorage();
    return this.borrowedMoneyList[index];
  }

  public async markAsPaid(id: string, walletId: string, t?: any): Promise<BorrowedMoney | null> {
    const borrowedMoney = await this.getBorrowedMoneyById(id);
    if (!borrowedMoney) {
      throw new Error('Borrowed money record not found');
    }

    if (borrowedMoney.isPaid) {
      throw new Error('This record is already marked as paid');
    }

    const isLent = borrowedMoney.type === 'lent';

    // Create a transaction
    await hybridDataService.createTransaction({
      amount: borrowedMoney.amount,
      description: isLent
        ? (t ? t('recovered_loan_from', { name: borrowedMoney.personName }) : `Recovered loan from ${borrowedMoney.personName}`)
        : (t ? t('repaid_debt_to', { name: borrowedMoney.personName }) : `Repaid debt to ${borrowedMoney.personName}`),
      type: isLent ? 'INCOME' : 'EXPENSE',
      walletId: walletId,
      date: new Date().toISOString(),
      notes: t
        ? `${t(isLent ? 'loan_recovery' : 'debt_repayment')} - ${borrowedMoney.reason}`
        : `${isLent ? 'Loan recovery' : 'Debt repayment'} - ${borrowedMoney.reason}`,
    });

    // Mark as paid
    return this.updateBorrowedMoney(id, { isPaid: true });
  }

  public async markAsUnpaid(id: string): Promise<BorrowedMoney | null> {
    return this.updateBorrowedMoney(id, { isPaid: false });
  }

  public async deleteBorrowedMoney(id: string): Promise<boolean> {
    const index = this.borrowedMoneyList.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }

    this.borrowedMoneyList.splice(index, 1);
    await this.saveToStorage();
    return true;
  }

  public async getBorrowedMoneyById(id: string): Promise<BorrowedMoney | null> {
    await this.loadFromStorage();
    return this.borrowedMoneyList.find(item => item.id === id) || null;
  }

  public async getBorrowedMoneyByPerson(personName: string): Promise<BorrowedMoney[]> {
    await this.loadFromStorage();
    return this.borrowedMoneyList
      .filter(item => item.personName.toLowerCase().includes(personName.toLowerCase()))
      .sort((a, b) => new Date(b.borrowedDate).getTime() - new Date(a.borrowedDate).getTime());
  }

  public async getStatistics(): Promise<{
    totalBorrowed: number;
    totalLent: number;
    totalBorrowedPaid: number;
    totalLentPaid: number;
    totalBorrowedPending: number;
    totalLentPending: number;
    totalOverdueBorrowed: number;
    totalOverdueLent: number;
    totalRecords: number;
  }> {
    await this.loadFromStorage();

    const now = new Date();
    const borrowedItems = this.borrowedMoneyList.filter(item => item.type === 'borrowed');
    const lentItems = this.borrowedMoneyList.filter(item => item.type === 'lent');

    const totalBorrowed = borrowedItems.reduce((sum, item) => sum + item.amount, 0);
    const totalLent = lentItems.reduce((sum, item) => sum + item.amount, 0);

    const totalBorrowedPaid = borrowedItems.filter(i => i.isPaid).reduce((sum, item) => sum + item.amount, 0);
    const totalLentPaid = lentItems.filter(i => i.isPaid).reduce((sum, item) => sum + item.amount, 0);

    const totalBorrowedPending = borrowedItems.filter(i => !i.isPaid).reduce((sum, item) => sum + item.amount, 0);
    const totalLentPending = lentItems.filter(i => !i.isPaid).reduce((sum, item) => sum + item.amount, 0);

    const totalOverdueBorrowed = borrowedItems.filter(i => !i.isPaid && new Date(i.dueDate) < now).reduce((sum, item) => sum + item.amount, 0);
    const totalOverdueLent = lentItems.filter(i => !i.isPaid && new Date(i.dueDate) < now).reduce((sum, item) => sum + item.amount, 0);

    return {
      totalBorrowed,
      totalLent,
      totalBorrowedPaid,
      totalLentPaid,
      totalBorrowedPending,
      totalLentPending,
      totalOverdueBorrowed,
      totalOverdueLent,
      totalRecords: this.borrowedMoneyList.length,
    };
  }

  public async searchBorrowedMoney(query: string): Promise<BorrowedMoney[]> {
    await this.loadFromStorage();
    const lowerQuery = query.toLowerCase();

    return this.borrowedMoneyList
      .filter(item =>
        item.personName.toLowerCase().includes(lowerQuery) ||
        item.reason.toLowerCase().includes(lowerQuery) ||
        (item.notes && item.notes.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => new Date(b.borrowedDate).getTime() - new Date(a.borrowedDate).getTime());
  }

  public async clearAllData(): Promise<void> {
    this.borrowedMoneyList = [];
    await this.saveToStorage();
  }

  public async importData(data: BorrowedMoney[]): Promise<void> {
    this.borrowedMoneyList = data;
    await this.saveToStorage();
  }

  public async exportData(): Promise<BorrowedMoney[]> {
    await this.loadFromStorage();
    return [...this.borrowedMoneyList];
  }
}

export default BorrowedMoneyService.getInstance();