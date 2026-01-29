export interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  type: 'expense' | 'income';
  walletId: string;
}

export interface Wallet {
  id: string;
  name: string;
  balance: number;
  type: 'bank' | 'cash' | 'savings';
  color: string;
  isPreferred?: boolean;
  icon?: string;
}

export interface SpendingCategory {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
}

export interface Reminder {
  id: string;
  title: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDue: string;
  isPaid: boolean;
}

export interface BorrowedMoney {
  id: string;
  personName: string;
  amount: number;
  reason: string;
  borrowedDate: string;
  dueDate: string;
  isPaid: boolean;
  walletId: string;
  type: 'borrowed' | 'lent';
  notes?: string;
  phoneNumber?: string;
  email?: string;
}

export interface Bill {
  id: string;
  title: string;
  description?: string;
  amount: number;
  dueDate: string;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'one-time';
  category: string;
  categoryId: string;
  isRecurring: boolean;
  isAutoPay: boolean;
  status: 'pending' | 'paid' | 'overdue' | 'upcoming';
  walletId?: string;
  reminderDays: number; // Days before due date to remind
  remindersPerDay: number; // Number of reminders per day
  createdAt: string;
  lastPaidDate?: string;
  nextDueDate: string;
  paidHistory: BillPayment[];
  tags?: string[];
  notes?: string;
}

export interface BillPayment {
  id: string;
  billId: string;
  amount: number;
  paidDate: string;
  walletId: string;
  notes?: string;
  isLate: boolean;
}

export interface BillCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  monthYear: string; // Format: 'YYYY-MM'
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  status: 'on-track' | 'warning' | 'exceeded';
  warningThreshold: number; // Percentage (e.g., 80 for 80%)
  createdAt: string;
  transactions: Transaction[];
  notes?: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  parentId?: string; // For subcategories
}

export interface MonthlyBudgetSummary {
  monthYear: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  categories: Budget[];
  status: 'on-track' | 'warning' | 'exceeded';
  savingsGoal?: number;
  actualSavings: number;
}

export interface BillNotification {
  id: string;
  billId: string;
  title: string;
  message: string;
  dueDate: string;
  type: 'reminder' | 'overdue' | 'paid';
  isRead: boolean;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}