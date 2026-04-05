import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useWalletVisibility } from '../hooks/useWalletVisibility';
import { hybridDataService, HybridTransaction } from '../services/hybridDataService';
import { Wallet } from '../types';

interface HybridWallet {
  id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'OTHER';
  balance: number;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'synced' | 'local_only' | 'pending_sync' | 'conflict';
}

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  onTransfer: (transfer: any) => void;
  editTransaction?: HybridTransaction | null;
  onUpdateTransfer?: (id: string, updates: any) => void;
}

const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  onClose,
  onTransfer,
  editTransaction,
  onUpdateTransfer,
}) => {
  const { theme } = useTheme();
  const { formatCurrency, currency, t } = useLocalization();
  const { formatWalletBalance } = useWalletVisibility();
  const insets = useSafeAreaInsets();

  const getCurrencySymbol = () => {
    const symbols = { USD: '$', EUR: '€', MAD: 'MAD' };
    return symbols[currency];
  };

  const [wallets, setWallets] = useState<HybridWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [fromWallet, setFromWallet] = useState<HybridWallet | null>(null);
  const [toWallet, setToWallet] = useState<HybridWallet | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showFromWallets, setShowFromWallets] = useState(false);
  const [showToWallets, setShowToWallets] = useState(false);

  useEffect(() => {
    if (visible) {
      loadWallets().then((fetched) => {
        if (editTransaction && fetched) {
          setAmount(editTransaction.amount.toString());
          setNote(editTransaction.notes || '');

          // For transfers, we need to know the 'other' wallet.
          // In the current schema, we don't store the pair ID directly in the transaction 
          // but we can infer or we might need to fetch the sibling.
          // For now, let's just pre-fill the amount and note.
          const currentWallet = fetched.find(w => w.id === editTransaction.walletId);
          if (currentWallet) {
            setFromWallet(currentWallet);
          }
        } else {
          resetForm();
        }
      });
    }
  }, [visible, editTransaction]);

  // Handle Android back button
  useEffect(() => {
    if (visible) {
      const backAction = () => {
        handleClose();
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [visible]);

  const loadWallets = async () => {
    try {
      setLoading(true);
      const fetchedWallets = await hybridDataService.getWallets();
      setWallets(fetchedWallets);
      return fetchedWallets;
    } catch (error) {
      console.error('Error loading wallets:', error);
      Alert.alert('Error', 'Failed to load wallets');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getWalletIcon = (walletType: string) => {
    switch (walletType.toLowerCase()) {
      case 'bank':
        return 'card';
      case 'cash':
        return 'cash';
      case 'savings':
        return 'wallet';
      case 'credit_card':
        return 'card';
      case 'investment':
        return 'trending-up';
      default:
        return 'wallet';
    }
  };

  const resetForm = () => {
    setFromWallet(null);
    setToWallet(null);
    setAmount('');
    setNote('');
    setShowFromWallets(false);
    setShowToWallets(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTransfer = async () => {
    if (!fromWallet || !toWallet || !amount) {
      Alert.alert('Error', t('transfer_required_fields'));
      return;
    }

    if (fromWallet.id === toWallet.id) {
      Alert.alert('Error', t('same_wallet_error'));
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      Alert.alert('Error', t('valid_amount'));
      return;
    }

    if (transferAmount > fromWallet.balance && fromWallet.type !== 'CREDIT_CARD') {
      Alert.alert('Error', t('insufficient_funds'));
      return;
    }

    try {
      setTransferring(true);

      const transferData = {
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: transferAmount,
        description: note || undefined,
      };

      if (editTransaction) {
        // Note: Updating a transfer is complex because it involve 2 transactions.
        // For now, we'll use the onUpdateTransfer callback which should handle it.
        onUpdateTransfer?.(editTransaction.id, transferData);
      } else {
        await hybridDataService.transferMoney(transferData);
        onTransfer({
          fromWallet: fromWallet.name,
          toWallet: toWallet.name,
          amount: transferAmount,
          note,
        });
      }

      if (!editTransaction) {
        Alert.alert('Success', 'Transfer completed successfully!');
      }
      handleClose();
    } catch (error) {
      console.error('Transfer error:', error);
      Alert.alert('Error', 'Transfer failed. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const availableToWallets = fromWallet
    ? wallets.filter(wallet => wallet.id !== fromWallet.id)
    : wallets;

  const renderWalletSelector = (
    title: string,
    selectedWallet: HybridWallet | null,
    onSelect: (wallet: HybridWallet) => void,
    showList: boolean,
    onToggle: () => void,
    walletOptions: HybridWallet[]
  ) => (
    <View style={styles.selectorContainer}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{title}</Text>
      <TouchableOpacity
        style={[styles.walletSelector, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={onToggle}
      >
        {selectedWallet ? (
          <View style={styles.selectedWallet}>
            <View style={[styles.walletIcon, { backgroundColor: selectedWallet.color }]}>
              <Ionicons
                name={getWalletIcon(selectedWallet.type)}
                size={16}
                color="white"
              />
            </View>
            <View style={styles.walletInfo}>
              <Text style={[styles.walletName, { color: theme.colors.text }]}>{selectedWallet.name}</Text>
              <Text style={[styles.walletBalance, { color: theme.colors.textSecondary }]}>
                {formatWalletBalance(selectedWallet.balance, selectedWallet.id)}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
          </View>
        ) : (
          <View style={styles.placeholderWallet}>
            <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
              {t('select_source')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>

      {showList && (
        <View style={[styles.walletList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {walletOptions.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              style={[styles.walletOption, { borderBottomColor: theme.colors.border }]}
              onPress={() => {
                onSelect(wallet);
                onToggle();
              }}
            >
              <View style={[styles.walletIcon, { backgroundColor: wallet.color }]}>
                <Ionicons
                  name={getWalletIcon(wallet.type)}
                  size={16}
                  color="white"
                />
              </View>
              <View style={styles.walletInfo}>
                <Text style={[styles.walletName, { color: theme.colors.text }]}>{wallet.name}</Text>
                <Text style={[styles.walletBalance, { color: theme.colors.textSecondary }]}>
                  {formatWalletBalance(wallet.balance, wallet.id)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

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
            <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editTransaction ? t('edit_transfer') : t('transfer_title')}</Text>
            <TouchableOpacity style={styles.headerButton} onPress={handleTransfer} disabled={transferring}>
              {transferring ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Text style={styles.saveButton}>{editTransaction ? t('save') : t('confirm_transfer')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Container with rounded top */}
        <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>

          {loading ? (
            <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>{t('loading')}</Text>
            </View>
          ) : (
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
                {/* Transfer Direction Indicator */}
                <View style={styles.transferFlow}>
                  <View style={styles.flowStep}>
                    <View style={[styles.flowIcon, { backgroundColor: fromWallet?.color || theme.colors.primary }]}>
                      <Ionicons
                        name={fromWallet ? getWalletIcon(fromWallet.type) : 'wallet'}
                        size={20}
                        color="white"
                      />
                    </View>
                    <Text style={[styles.flowText, { color: theme.colors.textSecondary }]}>
                      {fromWallet ? fromWallet.name : t('from_wallet')}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={24} color={theme.colors.primary} />
                  <View style={styles.flowStep}>
                    <View style={[styles.flowIcon, { backgroundColor: toWallet?.color || theme.colors.success }]}>
                      <Ionicons
                        name={toWallet ? getWalletIcon(toWallet.type) : 'wallet'}
                        size={20}
                        color="white"
                      />
                    </View>
                    <Text style={[styles.flowText, { color: theme.colors.textSecondary }]}>
                      {toWallet ? toWallet.name : t('to_wallet')}
                    </Text>
                  </View>
                </View>

                {/* From Wallet */}
                {renderWalletSelector(
                  fromWallet ? `${t('from_wallet')}: ${fromWallet.name}` : t('from_wallet'),
                  fromWallet,
                  (wallet) => {
                    setFromWallet(wallet);
                    // Reset toWallet if it's the same as the newly selected fromWallet
                    if (toWallet && toWallet.id === wallet.id) {
                      setToWallet(null);
                    }
                  },
                  showFromWallets,
                  () => {
                    setShowFromWallets(!showFromWallets);
                    setShowToWallets(false);
                  },
                  wallets
                )}

                {/* To Wallet */}
                {renderWalletSelector(
                  toWallet ? `${t('to_wallet')}: ${toWallet.name}` : t('to_wallet'),
                  toWallet,
                  setToWallet,
                  showToWallets,
                  () => {
                    setShowToWallets(!showToWallets);
                    setShowFromWallets(false);
                  },
                  availableToWallets
                )}

                {/* Amount */}
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>{t('transfer_amount')} *</Text>
                  <View style={[styles.amountInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>{getCurrencySymbol()}</Text>
                    <TextInput
                      style={[styles.amountTextInput, { color: theme.colors.text }]}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  {fromWallet && (
                    <Text style={[styles.balanceHint, { color: theme.colors.textSecondary }]}>
                      Available: {formatWalletBalance(fromWallet.balance, fromWallet.id)}
                    </Text>
                  )}
                </View>

                {/* Note */}
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>{t('transfer_note')}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('add_note')}
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Transfer Summary */}
                {fromWallet && toWallet && amount && !isNaN(parseFloat(amount)) && (
                  <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>{t('transfer_title')}</Text>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>{t('from_wallet')}:</Text>
                      <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{fromWallet.name}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>{t('to_wallet')}:</Text>
                      <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{toWallet.name}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                      <Text style={[styles.summaryLabel, styles.totalLabel, { color: theme.colors.text }]}>{t('amount')}:</Text>
                      <Text style={[styles.summaryValue, styles.totalValue, { color: theme.colors.primary }]}>
                        {formatCurrency(parseFloat(amount))}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  cancelButton: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    textAlign: 'right',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  transferFlow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(74, 144, 226, 0.05)',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  flowStep: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  flowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    opacity: 1,
  },
  flowText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectorContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  walletSelector: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    padding: 16,
  },
  selectedWallet: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  walletIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  walletBalance: {
    fontSize: 14,
    color: '#8E8E93',
  },
  walletList: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    marginTop: 8,
    maxHeight: 200,
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  inputContainer: {
    marginBottom: 20,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '500',
    marginRight: 8,
    color: '#8E8E93',
  },
  amountTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  balanceHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    padding: 16,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
});

export default TransferModal;