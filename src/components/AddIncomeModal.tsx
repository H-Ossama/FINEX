import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { hybridDataService, HybridWallet, HybridTransaction } from '../services/hybridDataService';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useWalletVisibility } from '../hooks/useWalletVisibility';

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
  onAddIncome?: (income: {
    title: string;
    amount: number;
    category: string;
    walletId: string;
    date: string;
    description?: string;
  }) => void;
  editTransaction?: HybridTransaction | null;
  onUpdateIncome?: (id: string, updates: any) => void;
}

const { width } = Dimensions.get('window');

const incomeCategories = [
  { id: 'salary', name: 'Salary', icon: '💼', color: '#4A90E2' },
  { id: 'freelance', name: 'Freelance', icon: '💻', color: '#7ED321' },
  { id: 'business', name: 'Business', icon: '🏢', color: '#9013FE' },
  { id: 'investment', name: 'Investment', icon: '📈', color: '#F5A623' },
  { id: 'rental', name: 'Rental', icon: '🏠', color: '#D0021B' },
  { id: 'bonus', name: 'Bonus', icon: '🎁', color: '#BD10E0' },
  { id: 'refund', name: 'Refund', icon: '↩️', color: '#50E3C2' },
  { id: 'other', name: 'Other', icon: '💰', color: '#8E8E93' },
];

const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  visible,
  onClose,
  onAddIncome,
  editTransaction,
  onUpdateIncome,
}) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const { formatWalletBalance } = useWalletVisibility();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(incomeCategories[0]);
  const [selectedWallet, setSelectedWallet] = useState<HybridWallet | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [wallets, setWallets] = useState<HybridWallet[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (visible) {
      loadWallets().then(() => {
        if (editTransaction) {
          setTitle(editTransaction.description || '');
          setAmount(editTransaction.amount.toString());
          const category = incomeCategories.find(c => c.name === editTransaction.categoryId) || incomeCategories[0];
          setSelectedCategory(category);
          setDescription(editTransaction.notes || '');
          setDate(new Date(editTransaction.date));
        } else {
          resetForm();
        }
      });
    }
  }, [visible, editTransaction]);

  const loadWallets = async () => {
    try {
      const walletsData = await hybridDataService.getWallets();
      setWallets(walletsData);
      if (walletsData.length > 0 && !selectedWallet) {
        setSelectedWallet(walletsData[0]);
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setSelectedCategory(incomeCategories[0]);
    setDescription('');
    setDate(new Date());
    setErrors({});
    if (wallets.length > 0) {
      setSelectedWallet(wallets[0]);
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm() && selectedWallet) {
      const incomeData = {
        title: title.trim(),
        amount: parseFloat(amount),
        category: selectedCategory.name,
        categoryId: selectedCategory.id,
        walletId: selectedWallet.id,
        date: date.toISOString().split('T')[0],
        description: description.trim() || undefined,
      };

      if (editTransaction) {
        onUpdateIncome?.(editTransaction.id, {
          amount: incomeData.amount,
          description: incomeData.title,
          notes: incomeData.description,
          walletId: incomeData.walletId,
          categoryId: incomeData.categoryId,
          date: incomeData.date,
        });
      } else {
        onAddIncome?.(incomeData);
      }

      resetForm();
      onClose();
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
        <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" />

        {/* Dark Header */}
        <View style={[styles.darkHeader, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editTransaction ? t('edit_income_title') : t('add_income_title')}</Text>
            <TouchableOpacity onPress={handleSubmit} style={styles.headerButton}>
              <Text style={styles.saveButtonText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Container with rounded top */}
        <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>

          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Amount Input */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Amount</Text>
                <View style={[styles.amountContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, errors.amount && styles.inputError]}>
                  <Text style={[styles.currencySymbol, { color: theme.colors.success }]}>$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: theme.colors.success }]}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>
                {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
              </View>

              {/* Title Input */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Title</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }, errors.title && styles.inputError]}
                  placeholder="What income did you receive?"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={title}
                  onChangeText={setTitle}
                />
                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
              </View>

              {/* Category Selection */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoriesScroll}
                >
                  {incomeCategories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryItem,
                        selectedCategory.id === category.id && { backgroundColor: theme.isDark ? theme.colors.card : '#E8F5E8' },
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <View
                        style={[
                          styles.categoryIcon,
                          { backgroundColor: category.color },
                          selectedCategory.id === category.id && styles.categoryIconSelected,
                        ]}
                      >
                        <Text style={styles.categoryEmoji}>{category.icon}</Text>
                      </View>
                      <Text
                        style={[
                          styles.categoryName,
                          { color: theme.colors.textSecondary },
                          selectedCategory.id === category.id && { color: theme.colors.success, fontWeight: '600' },
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Wallet Selection */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Add To</Text>
                <View style={[styles.walletsContainer, { backgroundColor: theme.colors.surface }]}>
                  {wallets.map((wallet: HybridWallet) => (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[
                        styles.walletItem,
                        { borderBottomColor: theme.colors.border },
                        selectedWallet?.id === wallet.id && { backgroundColor: theme.isDark ? theme.colors.card : '#E8F5E8' },
                      ]}
                      onPress={() => setSelectedWallet(wallet)}
                    >
                      <View style={styles.walletLeft}>
                        <View style={[styles.walletIcon, { backgroundColor: wallet.color }]}>
                          <Ionicons
                            name={
                              wallet.type === 'BANK'
                                ? 'card'
                                : wallet.type === 'CASH'
                                  ? 'cash'
                                  : 'wallet'
                            }
                            size={16}
                            color="white"
                          />
                        </View>
                        <View>
                          <Text style={[styles.walletName, { color: theme.colors.text }]}>{wallet.name}</Text>
                          <Text style={[styles.walletBalance, { color: theme.colors.textSecondary }]}>
                            {formatWalletBalance(wallet.balance, wallet.id)}
                          </Text>
                        </View>
                      </View>
                      {selectedWallet?.id === wallet.id && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Selection */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Date</Text>
                <TouchableOpacity style={[styles.dateButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
                  <Text style={[styles.dateText, { color: theme.colors.text }]}>{formatDate(date)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Description Input */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Add a note..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  darkHeader: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  headerButton: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -1,
    overflow: 'hidden',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7ED321',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7ED321',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  categoriesScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIconSelected: {
    borderWidth: 2,
    borderColor: '#7ED321',
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryName: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  walletsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  walletBalance: {
    fontSize: 12,
    color: '#8E8E93',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});

export default React.memo(AddIncomeModal);