import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
  Dimensions,
} from 'react-native';
import {
  FlatList as GestureFlatList,
  ScrollView as GestureScrollView,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BorrowedMoney } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';
import BorrowedMoneyDetailsModal from '../components/BorrowedMoneyDetailsModal';
import { localStorageService } from '../services/localStorageService';
import borrowedMoneyService from '../services/borrowedMoneyService';
import { useDialog } from '../contexts/DialogContext';

const { width } = Dimensions.get('window');

const BorrowedMoneyHistoryScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { formatCurrency, t } = useLocalization();
  const dialog = useDialog();
  const [borrowedMoneyList, setBorrowedMoneyList] = useState<BorrowedMoney[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBorrowedMoney, setSelectedBorrowedMoney] = useState<BorrowedMoney | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBorrowedMoneyForPayment, setSelectedBorrowedMoneyForPayment] = useState<BorrowedMoney | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [paymentWallets, setPaymentWallets] = useState<any[]>([]);

  const loadBorrowedMoneyData = useCallback(async () => {
    try {
      setLoading(true);
      const allBorrowedMoney = await borrowedMoneyService.getAllBorrowedMoney();
      setBorrowedMoneyList(allBorrowedMoney);
    } catch (error) {
      console.error('Error loading borrowed money data:', error);
      setBorrowedMoneyList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh whenever the screen gains focus (e.g., after adding from a different screen)
  useFocusEffect(
    useCallback(() => {
      void loadBorrowedMoneyData();
    }, [loadBorrowedMoneyData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBorrowedMoneyData().then(() => {
      setRefreshing(false);
    }).catch((error) => {
      console.error('Error refreshing data:', error);
      setRefreshing(false);
    });
  }, [loadBorrowedMoneyData]);

  const handleItemPress = (item: BorrowedMoney) => {
    setSelectedBorrowedMoney(item);
    setShowDetailsModal(true);
  };

  const processPayment = async () => {
    if (!selectedBorrowedMoneyForPayment || !selectedWallet) return;

    try {
      setShowPaymentModal(false);
      await borrowedMoneyService.markAsPaid(selectedBorrowedMoneyForPayment.id, selectedWallet, t);
      await loadBorrowedMoneyData();
      setShowDetailsModal(false);
      setSelectedBorrowedMoneyForPayment(null);
      dialog.success(
        t('success') || 'Success',
        `${formatCurrency(selectedBorrowedMoneyForPayment.amount)} • ${selectedBorrowedMoneyForPayment.personName}`
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      dialog.error(t('error') || 'Error', t('bills.paymentFailed') || 'Failed to process payment');
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      const borrowedMoney = await borrowedMoneyService.getBorrowedMoneyById(id);
      if (!borrowedMoney) {
        dialog.error(t('error') || 'Error', 'Borrowed money record not found');
        return;
      }

      // Load wallets to select from
      const wallets = await localStorageService.getWallets();
      if (wallets.length === 0) {
        dialog.warning(
          t('wallet_screen_no_wallets') || 'No Wallets',
          t('bills.noWallets') || 'Please add a wallet first to make payments.'
        );
        return;
      }

      // If only one wallet, use it automatically
      if (wallets.length === 1) {
        await borrowedMoneyService.markAsPaid(id, wallets[0].id, t);
        await loadBorrowedMoneyData();
        setShowDetailsModal(false);
        dialog.success(
          t('success') || 'Success',
          `${formatCurrency(borrowedMoney.amount)} • ${borrowedMoney.personName}`
        );
        return;
      }

      // Multiple wallets - show styled modal
      setSelectedBorrowedMoneyForPayment(borrowedMoney);
      setPaymentWallets(wallets);
      setSelectedWallet(wallets[0].id); // Default to first wallet
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error marking borrowed money as paid:', error);
      dialog.error(t('error') || 'Error', 'Failed to mark as paid');
    }
  };

  const handleEdit = async (editedItem: BorrowedMoney) => {
    try {
      await borrowedMoneyService.updateBorrowedMoney(editedItem.id, editedItem);
      await loadBorrowedMoneyData(); // Reload data
    } catch (error) {
      console.error('Error updating borrowed money:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await borrowedMoneyService.deleteBorrowedMoney(id);
      await loadBorrowedMoneyData(); // Reload data
    } catch (error) {
      console.error('Error deleting borrowed money:', error);
    }
  };


  const filteredList = borrowedMoneyList.filter(item => {
    if (filter === 'pending') return !item.isPaid;
    if (filter === 'paid') return item.isPaid;
    return true;
  });

  const totalBorrowedPending = borrowedMoneyList
    .filter(item => !item.isPaid && item.type === 'borrowed')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalLentPending = borrowedMoneyList
    .filter(item => !item.isPaid && item.type === 'lent')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalCompleted = borrowedMoneyList
    .filter(item => item.isPaid)
    .reduce((sum, item) => sum + item.amount, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (dueDate: string, isPaid: boolean) => {
    return new Date(dueDate) < new Date() && !isPaid;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const renderBorrowedMoneyItem = ({ item }: { item: BorrowedMoney }) => {
    const overdue = isOverdue(item.dueDate, item.isPaid);
    const statusColor = item.isPaid
      ? theme.colors.success
      : overdue
        ? '#FF3B30'
        : '#FF9500';

    return (
      <TouchableOpacity
        style={[
          styles.borrowedMoneyCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            shadowColor: theme.isDark ? '#000' : '#0F172A',
          },
        ]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        {/* Left colored indicator */}
        <View style={[styles.cardIndicator, { backgroundColor: statusColor }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.personRow}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: item.isPaid
                      ? theme.isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)'
                      : overdue
                        ? theme.isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(239, 68, 68, 0.1)'
                        : theme.isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                  },
                ]}
              >
                <Text style={[styles.avatarText, { color: statusColor }]}>
                  {getInitials(item.personName)}
                </Text>
              </View>
              <View style={styles.personInfo}>
                <View style={styles.personHeaderRow}>
                  <Text style={[styles.personName, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.personName}
                  </Text>
                  <View style={[
                    styles.typeBadge,
                    { backgroundColor: item.type === 'lent' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                  ]}>
                    <Text style={[
                      styles.typeBadgeText,
                      { color: item.type === 'lent' ? theme.colors.success : '#EF4444' }
                    ]}>
                      {item.type === 'lent' ? t('lent_label') : t('borrowed_label')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.reason, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {item.reason}
                </Text>
              </View>
            </View>

            <View style={styles.amountColumn}>
              <Text style={[styles.amount, { color: theme.colors.text }]}>
                {formatCurrency(item.amount)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.isPaid ? t('paid') : overdue ? t('overdue') : t('pending')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]}>
                  {formatDate(item.borrowedDate)}
                </Text>
              </View>
              <View style={styles.dateDivider} />
              <View style={styles.dateItem}>
                <Ionicons
                  name="alarm-outline"
                  size={14}
                  color={overdue ? '#FF3B30' : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.dateLabel,
                  { color: overdue ? '#FF3B30' : theme.colors.textSecondary }
                ]}>
                  {formatDate(item.dueDate)}
                </Text>
              </View>
            </View>

            <View style={[
              styles.cardChevron,
              { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }
            ]}>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textSecondary}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <>
      {/* Stats Overview */}
      <GestureScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsSection}
        contentContainerStyle={styles.statsContent}
        directionalLockEnabled
        nestedScrollEnabled
      >
        <LinearGradient
          colors={
            theme.isDark
              ? ['rgba(255, 149, 0, 0.15)', 'rgba(255, 149, 0, 0.05)']
              : ['#FFF7ED', '#FFEDD5']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCard}
        >
          <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
            <Ionicons name="arrow-down-circle-outline" size={22} color="#EF4444" />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {t('total_borrowed_pending')}
            </Text>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              {formatCurrency(totalBorrowedPending)}
            </Text>
            <Text style={[styles.statCount, { color: theme.colors.textSecondary }]}>
              {borrowedMoneyList.filter(i => !i.isPaid && i.type === 'borrowed').length} {t('active')}
            </Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={
            theme.isDark
              ? ['rgba(52, 211, 153, 0.15)', 'rgba(52, 211, 153, 0.05)']
              : ['#ECFDF5', '#D1FAE5']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCard}
        >
          <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <Ionicons name="arrow-up-circle-outline" size={22} color={theme.colors.success} />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {t('total_lent_pending')}
            </Text>
            <Text style={[styles.statValue, { color: theme.colors.success }]}>
              {formatCurrency(totalLentPending)}
            </Text>
            <Text style={[styles.statCount, { color: theme.colors.textSecondary }]}>
              {borrowedMoneyList.filter(i => !i.isPaid && i.type === 'lent').length} {t('active')}
            </Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={
            theme.isDark
              ? ['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)']
              : ['#F5F3FF', '#EDE9FE']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCard}
        >
          <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {t('total_paid')}
            </Text>
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>
              {formatCurrency(totalCompleted)}
            </Text>
            <Text style={[styles.statCount, { color: theme.colors.textSecondary }]}>
              {borrowedMoneyList.filter(i => i.isPaid).length} {t('completed')}
            </Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={
            theme.isDark
              ? ['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)']
              : ['#EEF2FF', '#E0E7FF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCard}
        >
          <View
            style={[
              styles.statIcon,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(99, 102, 241, 0.2)'
                  : 'rgba(79, 70, 229, 0.15)',
              },
            ]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={22}
              color={theme.isDark ? '#818CF8' : '#6366F1'}
            />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {t('total_records')}
            </Text>
            <Text style={[styles.statValue, { color: theme.isDark ? '#818CF8' : '#6366F1' }]}>
              {borrowedMoneyList.length}
            </Text>
            <Text style={[styles.statCount, { color: theme.colors.textSecondary }]}>
              {t('all_time')}
            </Text>
          </View>
        </LinearGradient>
      </GestureScrollView>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <View
          style={[
            styles.filterTabs,
            {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            },
          ]}
        >
          {(['all', 'pending', 'paid'] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterTab,
                {
                  backgroundColor: filter === filterOption ? theme.colors.primary : 'transparent',
                },
              ]}
              onPress={() => setFilter(filterOption)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  {
                    color: filter === filterOption ? '#FFFFFF' : theme.colors.textSecondary,
                    fontWeight: filter === filterOption ? '600' : '500',
                  },
                ]}
              >
                {t(filterOption)}
              </Text>
              {filter === filterOption && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {filterOption === 'pending' && borrowedMoneyList.filter(i => !i.isPaid).length}
                    {filterOption === 'paid' && borrowedMoneyList.filter(i => i.isPaid).length}
                    {filterOption === 'all' && borrowedMoneyList.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={
          theme.isDark
            ? ['rgba(99, 102, 241, 0.1)', 'rgba(99, 102, 241, 0.03)']
            : ['#F5F3FF', '#EDE9FE']
        }
        style={styles.emptyIconContainer}
      >
        <Ionicons
          name="people-outline"
          size={48}
          color={theme.isDark ? '#818CF8' : '#8B5CF6'}
        />
      </LinearGradient>
      <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
        {filter === 'all' ? t('no_borrowed_money_history') : `No ${filter} records`}
      </Text>
      <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textSecondary }]}>
        {filter === 'all'
          ? t('add_first_borrowed_record')
          : t('no_filtered_records').replace('{filter}', t(filter))}
      </Text>
      {filter === 'all' && (
        <TouchableOpacity
          style={[styles.emptyActionButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => (navigation as any).navigate('AddBorrowedMoney')}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.emptyActionText}>Add First Record</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPaymentModal = () => {
    if (!selectedBorrowedMoneyForPayment) return null;

    return (
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.paymentModalContent,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.paymentModalHeader}>
              <Text style={[styles.paymentModalTitle, { color: theme.colors.text }]}>
                Repay Debt
              </Text>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentDetails}>
              <Text style={[styles.paymentBillTitle, { color: theme.colors.text }]}>
                Repay to {selectedBorrowedMoneyForPayment.personName}
              </Text>
              <Text style={[styles.paymentAmount, { color: theme.colors.primary }]}>
                {formatCurrency(selectedBorrowedMoneyForPayment.amount)}
              </Text>
            </View>

            <View style={styles.walletSelection}>
              <Text style={[styles.walletSelectionLabel, { color: theme.colors.text }]}>
                {t('add_money_select_wallet') || 'Select Wallet'}
              </Text>
              <GestureScrollView style={styles.walletsList}>
                {paymentWallets.map((wallet: any) => {
                  const isSelected = wallet.id === selectedWallet;

                  return (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[
                        styles.walletRow,
                        {
                          backgroundColor: isSelected ? 'rgba(10,132,255,0.10)' : theme.colors.surface,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => setSelectedWallet(wallet.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.walletRowLeft}>
                        <View style={[styles.walletDot, { backgroundColor: wallet.color || theme.colors.primary }]} />
                        <View style={styles.walletRowText}>
                          <Text style={[styles.walletName, { color: theme.colors.text }]} numberOfLines={1}>
                            {wallet.name}
                          </Text>
                          <Text style={[styles.walletBalance, { color: theme.colors.textSecondary }]}>
                            {t('payment.balance', { balance: formatCurrency(wallet.balance || 0) }) ||
                              `Balance: ${formatCurrency(wallet.balance || 0)}`}
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </GestureScrollView>
            </View>

            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>{t('cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payButton, { backgroundColor: theme.colors.primary }]}
                onPress={processPayment}
              >
                <Text style={styles.payButtonText}>Repay Debt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: 'transparent' }]} edges={['top']}>
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Modern Header */}
      <LinearGradient
        colors={
          theme.isDark
            ? ['#1a1a2e', '#16213e']
            : ['#FFFFFF', '#F8FAFC']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.modernHeader}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                styles.backButton,
                {
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                }
              ]}
            >
              <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                {t('borrowed_money_history')}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                {borrowedMoneyList.length} {borrowedMoneyList.length === 1 ? 'record' : 'records'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => (navigation as any).navigate('AddBorrowedMoney')}
              style={[
                styles.addButton,
                { backgroundColor: theme.colors.primary }
              ]}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Content Container */}
      <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              {t('loading_borrowed_money')}
            </Text>
          </View>
        ) : (
          <GestureFlatList
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            data={filteredList}
            keyExtractor={(item) => item.id}
            renderItem={renderBorrowedMoneyItem}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={
              filteredList.length > 0
                ? () => (
                  <View style={styles.listFooter}>
                    <Text style={[styles.listFooterText, { color: theme.colors.textSecondary }]}>
                      {filteredList.length} {filteredList.length === 1 ? 'record' : 'records'}
                    </Text>
                  </View>
                )
                : null
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Details Modal */}
        <BorrowedMoneyDetailsModal
          visible={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          borrowedMoney={selectedBorrowedMoney}
          onMarkAsPaid={handleMarkAsPaid}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Payment Modal */}
        {renderPaymentModal()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modernHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentContainer: {
    flex: 1,
    marginTop: -8,
  },
  statsSection: {
    paddingTop: 16,
    maxHeight: 140,
  },
  statsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    minWidth: width * 0.7,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  filterTabs: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterTabText: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  borrowedMoneyCard: {
    marginBottom: 12,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardContent: {
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  personInfo: {
    flex: 1,
    gap: 3,
  },
  personHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  reason: {
    fontSize: 13,
    fontWeight: '500',
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  cardChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 8,
    gap: 8,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  listFooter: {
    paddingVertical: 16,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  listFooterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Payment Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    padding: 20,
  },
  paymentModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 20,
    maxHeight: '80%',
    alignSelf: 'center',
    borderWidth: 1,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentModalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  paymentDetails: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  paymentBillTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  walletSelection: {
    marginBottom: 24,
  },
  walletSelectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  walletsList: {
    maxHeight: 200,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  walletRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  walletRowText: {
    flex: 1,
  },
  walletName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  walletBalance: {
    fontSize: 12,
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  payButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BorrowedMoneyHistoryScreen;