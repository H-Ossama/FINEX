import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { BorrowedMoney } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { localStorageService, LocalWallet } from '../services/localStorageService';
import borrowedMoneyService from '../services/borrowedMoneyService';
import { useDialog } from '../contexts/DialogContext';

const AddBorrowedMoneyScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { t, language } = useLocalization();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();

  const [formData, setFormData] = useState({
    personName: '',
    amount: '',
    reason: '',
    dueDate: new Date(),
    notes: '',
    phoneNumber: '',
    email: '',
    walletId: '',
    type: 'borrowed' as 'borrowed' | 'lent',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addToReminders, setAddToReminders] = useState(true);
  const [wallets, setWallets] = useState<LocalWallet[]>([]);

  const getWalletIoniconName = (wallet: Partial<LocalWallet> | undefined) => {
    const rawIcon = (wallet?.icon ?? '').toString();
    const normalizedIcon = rawIcon.trim().toLowerCase();
    const normalizedType = (wallet?.type ?? '').toString().trim().toUpperCase();

    if (normalizedIcon === 'bank' || normalizedType === 'BANK') return 'card-outline';
    if (normalizedIcon === 'cash' || normalizedType === 'CASH') return 'cash-outline';
    if (normalizedIcon === 'credit' || normalizedType === 'CREDIT_CARD') return 'card-outline';
    if (normalizedIcon === 'savings' || normalizedType === 'SAVINGS') return 'wallet-outline';
    if (normalizedIcon === 'investment' || normalizedType === 'INVESTMENT') return 'stats-chart-outline';

    return rawIcon || 'wallet-outline';
  };

  const defaultWalletId = useMemo(() => wallets[0]?.id ?? '', [wallets]);

  useEffect(() => {
    let mounted = true;

    const loadWallets = async () => {
      try {
        const loadedWallets = await localStorageService.getWallets();
        if (!mounted) return;
        setWallets(loadedWallets);

        if (loadedWallets.length > 0 && !formData.walletId) {
          setFormData((prev) => ({ ...prev, walletId: loadedWallets[0].id }));
        }
      } catch (error) {
        console.error('Error loading wallets:', error);
      }
    };

    void loadWallets();
    return () => {
      mounted = false;
    };
  }, [formData.walletId]);

  const resetForm = () => {
    setFormData({
      personName: '',
      amount: '',
      reason: '',
      dueDate: new Date(),
      notes: '',
      phoneNumber: '',
      email: '',
      walletId: defaultWalletId,
      type: 'borrowed',
    });
    setAddToReminders(true);
  };

  const handleClose = () => {
    resetForm();
    navigation.goBack();
  };

  const handleAdd = async () => {
    if (!formData.personName.trim()) {
      dialog.error(t('error') || 'Error', t('person_name_required'));
      return;
    }

    if (!formData.amount.trim() || Number.isNaN(Number(formData.amount))) {
      dialog.error(t('error') || 'Error', t('valid_amount'));
      return;
    }

    if (!formData.reason.trim()) {
      dialog.error(t('error') || 'Error', t('reason_required'));
      return;
    }

    if (!formData.walletId) {
      dialog.error(t('error') || 'Error', t('add_money_select_wallet') || 'Please select a wallet');
      return;
    }

    const borrowedMoney: Omit<BorrowedMoney, 'id'> = {
      personName: formData.personName.trim(),
      amount: Number(formData.amount),
      reason: formData.reason.trim(),
      borrowedDate: new Date().toISOString().split('T')[0],
      dueDate: formData.dueDate.toISOString().split('T')[0],
      isPaid: false,
      notes: formData.notes.trim() || undefined,
      phoneNumber: formData.phoneNumber.trim() || undefined,
      email: formData.email.trim() || undefined,
      walletId: formData.walletId,
      type: formData.type,
    };

    try {
      await borrowedMoneyService.addBorrowedMoney(borrowedMoney, t);

      // The current app doesn't implement reminder creation in BorrowedMoneyService.
      // Keep the toggle for UI consistency.
      if (addToReminders) {
        console.log('Add to reminders requested (not implemented in service).');
      }

      dialog.success(t('success') || 'Success', t('added_successfully') || 'Added successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error adding borrowed money:', error);
      dialog.error(t('error') || 'Error', t('something_went_wrong') || 'Something went wrong');
    }
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      setFormData({ ...formData, dueDate: selectedDate });
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.headerBackground }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.headerBackground} />

      {/* Dark Header */}
      <View style={[styles.darkHeader, { paddingTop: insets.top, backgroundColor: theme.colors.headerBackground }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerIconButton, { backgroundColor: theme.colors.headerSurface, borderColor: theme.colors.headerBorder }]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>
            {t('add_borrowed_money_title')}
          </Text>
          <TouchableOpacity
            onPress={handleAdd}
            activeOpacity={0.9}
            style={[styles.headerPrimaryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.headerPrimaryButtonText}>{t('add_new')}</Text>
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
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Transaction Type Section */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('transaction_type')}</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    formData.type === 'borrowed' && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setFormData({ ...formData, type: 'borrowed' })}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={20}
                    color={formData.type === 'borrowed' ? '#FFF' : theme.colors.textSecondary}
                  />
                  <Text style={[
                    styles.typeButtonText,
                    { color: formData.type === 'borrowed' ? '#FFF' : theme.colors.textSecondary }
                  ]}>
                    {t('i_borrowed')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    formData.type === 'lent' && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setFormData({ ...formData, type: 'lent' })}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={20}
                    color={formData.type === 'lent' ? '#FFF' : theme.colors.textSecondary}
                  />
                  <Text style={[
                    styles.typeButtonText,
                    { color: formData.type === 'lent' ? '#FFF' : theme.colors.textSecondary }
                  ]}>
                    {t('i_lent')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Person Details Section */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('person_details')}</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {t('person_name')} *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  value={formData.personName}
                  onChangeText={(text) => setFormData({ ...formData, personName: text })}
                  placeholder={t('name_placeholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t('phone_number')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  value={formData.phoneNumber}
                  onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                  placeholder={t('phone_placeholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t('email')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder={t('email_placeholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Loan Details Section */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('loan_details')}</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {t('amount')} *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  value={formData.amount}
                  onChangeText={(text) => setFormData({ ...formData, amount: text })}
                  placeholder={t('amount_placeholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Add Borrowed Money To *</Text>
                  <Ionicons name="wallet" size={16} color={theme.colors.textSecondary} />
                </View>

                {wallets.length === 0 ? (
                  <View
                    style={[
                      styles.emptyWalletState,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons name="wallet-outline" size={32} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyWalletText, { color: theme.colors.textSecondary }]}>No wallets available</Text>
                    <Text style={[styles.emptyWalletSubtext, { color: theme.colors.textSecondary }]}>Please create a wallet in the Wallet tab first</Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.walletSelector}
                    contentContainerStyle={styles.walletSelectorContent}
                    nestedScrollEnabled
                    directionalLockEnabled
                  >
                    {wallets.map((wallet) => (
                      <TouchableOpacity
                        key={wallet.id}
                        style={[
                          styles.walletOption,
                          {
                            backgroundColor: formData.walletId === wallet.id ? theme.colors.primary : theme.colors.background,
                            borderColor: formData.walletId === wallet.id ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                        onPress={() => setFormData({ ...formData, walletId: wallet.id })}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.walletIconCircle,
                            {
                              backgroundColor: formData.walletId === wallet.id ? 'rgba(255,255,255,0.2)' : theme.colors.surface,
                            },
                          ]}
                        >
                          <Ionicons
                            name={getWalletIoniconName(wallet) as any}
                            size={22}
                            color={formData.walletId === wallet.id ? 'white' : theme.colors.text}
                          />
                        </View>
                        <View style={styles.walletInfo}>
                          <Text
                            style={[
                              styles.walletOptionText,
                              {
                                color: formData.walletId === wallet.id ? 'white' : theme.colors.text,
                                fontWeight: formData.walletId === wallet.id ? '600' : '500',
                              },
                            ]}
                          >
                            {wallet.name}
                          </Text>
                          {formData.walletId === wallet.id && <Ionicons name="checkmark-circle" size={16} color="white" />}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}> {t('reason')} *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  value={formData.reason}
                  onChangeText={(text) => setFormData({ ...formData, reason: text })}
                  placeholder={t('reason_placeholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}> {t('due_date')} *</Text>
                <TouchableOpacity
                  style={[
                    styles.datePickerButton,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.datePickerText, { color: theme.colors.text }]}>{formatDateForDisplay(formData.dueDate)}</Text>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={formData.dueDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t('notes')}</Text>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  placeholder={t('notes_placeholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.disclaimer}>
              <Text style={[styles.disclaimerText, { color: theme.colors.textSecondary }]}>{t('required_fields')}</Text>
            </View>

            {/* Add to Reminders Toggle */}
            <View style={[styles.reminderSection, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.reminderHeader}>
                <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>{t('add_reminder')}</Text>
              </View>
              <Text style={[styles.reminderSubtitle, { color: theme.colors.textSecondary }]}>{t('reminder_subtitle')}</Text>
              <TouchableOpacity
                style={[styles.reminderToggle, { backgroundColor: addToReminders ? theme.colors.primary : theme.colors.border }]}
                onPress={() => setAddToReminders(!addToReminders)}
              >
                <View
                  style={[
                    styles.reminderToggleKnob,
                    {
                      transform: [{ translateX: addToReminders ? 20 : 0 }],
                      backgroundColor: 'white',
                    },
                  ]}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  darkHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerPrimaryButton: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    padding: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 100,
  },
  disclaimer: {
    padding: 16,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  datePickerText: {
    fontSize: 16,
  },
  reminderSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  reminderSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  reminderToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  reminderToggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginHorizontal: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletSelector: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  walletSelectorContent: {
    paddingVertical: 4,
  },
  walletOption: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginRight: 12,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  walletIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyWalletState: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  emptyWalletText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyWalletSubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AddBorrowedMoneyScreen;
