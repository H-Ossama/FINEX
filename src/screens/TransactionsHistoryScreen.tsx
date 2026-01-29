import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
  Animated,
  Dimensions,
  Vibration,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { hybridDataService, HybridTransaction } from '../services/hybridDataService';
import TransactionDetailsModal from '../components/TransactionDetailsModal';
import { useInterstitialAd } from '../components/InterstitialAd';
import { useAds } from '../contexts/AdContext';
import { useDialog } from '../contexts/DialogContext';

const { width } = Dimensions.get('window');

interface GroupedTransaction {
  date: string;
  transactions: HybridTransaction[];
  totalIncome: number;
  totalExpense: number;
}

interface FilterState {
  type: 'all' | 'income' | 'expense' | 'transfer';
  dateRange: 'all' | 'week' | 'month' | 'year';
  search: string;
  minAmount?: number;
  maxAmount?: number;
}

const TransactionsHistoryScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { formatCurrency, t, language } = useLocalization();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { adsEnabled } = useAds();
  const { showInterstitialIfNeeded, InterstitialComponent } = useInterstitialAd('TransactionsHistory');
  const dialog = useDialog();

  const [transactions, setTransactions] = useState<HybridTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<HybridTransaction | null>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [animatedValues] = useState(() => ({
    searchHeight: new Animated.Value(0),
    filterScroll: new Animated.Value(0),
  }));

  // Enhanced filter state
  const [filter, setFilter] = useState<FilterState>({
    type: 'all',
    dateRange: 'all',
    search: '',
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    if (adsEnabled) {
      showInterstitialIfNeeded();
    }
  }, [adsEnabled, showInterstitialIfNeeded]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const allTransactions = await hybridDataService.getTransactions(undefined, 100);
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      dialog.error(t('error'), t('failed_to_load_transactions'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  // Enhanced filtering logic
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by type
    if (filter.type !== 'all') {
      const filterType = filter.type.toUpperCase();
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Filter by search
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(searchLower) ||
        t.notes?.toLowerCase().includes(searchLower) ||
        t.amount.toString().includes(searchLower)
      );
    }

    // Filter by date range
    if (filter.dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (filter.dateRange) {
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(t => new Date(t.date) >= filterDate);
    }

    // Filter by amount range
    if (filter.minAmount !== undefined) {
      filtered = filtered.filter(t => t.amount >= filter.minAmount!);
    }
    if (filter.maxAmount !== undefined) {
      filtered = filtered.filter(t => t.amount <= filter.maxAmount!);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filter]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: GroupedTransaction } = {};

    filteredTransactions.forEach(transaction => {
      const dateKey = new Date(transaction.date).toDateString();

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          transactions: [],
          totalIncome: 0,
          totalExpense: 0,
        };
      }

      groups[dateKey].transactions.push(transaction);

      if (transaction.type === 'INCOME') {
        groups[dateKey].totalIncome += transaction.amount;
      } else if (transaction.type === 'EXPENSE') {
        groups[dateKey].totalExpense += transaction.amount;
      }
    });

    return Object.values(groups).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredTransactions]);

  // Enhanced statistics
  const statistics = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = filteredTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfers = filteredTransactions.filter(t => t.type === 'TRANSFER').length;
    const avgTransaction = filteredTransactions.length > 0
      ? (income + expense) / filteredTransactions.length
      : 0;

    return {
      income,
      expense,
      transfers,
      total: filteredTransactions.length,
      avgTransaction,
      netIncome: income - expense,
    };
  }, [filteredTransactions]);

  const toggleSearch = () => {
    const newVisible = !searchVisible;
    setSearchVisible(newVisible);

    Animated.timing(animatedValues.searchHeight, {
      toValue: newVisible ? 60 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (!newVisible) {
      setFilter(prev => ({ ...prev, search: '' }));
    }
  };

  const getTransactionIcon = (type: string, description?: string) => {
    if (type === 'INCOME') return { name: 'trending-up', color: theme.colors.success };
    if (type === 'TRANSFER') return { name: 'swap-horizontal', color: theme.colors.primary };

    // Smart categorization for expenses
    const desc = description?.toLowerCase() || '';

    if (desc.includes('food') || desc.includes('restaurant') || desc.includes('grocery'))
      return { name: 'restaurant', color: '#FF6B6B' };
    if (desc.includes('gas') || desc.includes('fuel') || desc.includes('electricity') || desc.includes('utility'))
      return { name: 'flash', color: '#F39C12' };
    if (desc.includes('netflix') || desc.includes('subscription') || desc.includes('spotify'))
      return { name: 'play-circle', color: '#9B59B6' };
    if (desc.includes('transport') || desc.includes('uber') || desc.includes('taxi'))
      return { name: 'car', color: '#3498DB' };
    if (desc.includes('shopping') || desc.includes('clothes') || desc.includes('store'))
      return { name: 'bag', color: '#E67E22' };
    if (desc.includes('health') || desc.includes('medical') || desc.includes('doctor'))
      return { name: 'medical', color: '#E74C3C' };
    if (desc.includes('entertainment') || desc.includes('movie') || desc.includes('game'))
      return { name: 'game-controller', color: '#8E44AD' };

    return { name: 'card', color: theme.colors.textSecondary };
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('today');
    if (diffDays === 1) return t('yesterday');
    if (diffDays <= 7) return `${diffDays} ${t('days_ago')}`;

    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleTransactionPress = (transaction: HybridTransaction) => {
    Vibration.vibrate(50);
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  const handleTransactionLongPress = (transaction: HybridTransaction) => {
    Vibration.vibrate([50, 50, 50]);
    dialog.show({
      title: t('transaction_options'),
      message: t('choose_action'),
      icon: 'ellipsis-horizontal',
      iconColor: theme.colors.primary,
      buttons: [
        { text: t('edit'), onPress: () => handleEditTransaction(transaction), style: 'default' },
        { text: t('duplicate'), onPress: () => handleDuplicateTransaction(transaction), style: 'default' },
        { text: t('delete'), style: 'destructive', onPress: () => void handleDeleteTransaction(transaction.id) },
        { text: t('cancel'), style: 'cancel' },
      ],
    });
  };

  const handleEditTransaction = (transaction: HybridTransaction) => {
    // TODO: Navigate to edit transaction screen
    console.log('Edit transaction:', transaction.id);
  };

  const handleDuplicateTransaction = (transaction: HybridTransaction) => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate transaction:', transaction.id);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      // TODO: Implement delete functionality with hybridDataService
      console.log('Delete transaction:', transactionId);
      // Refresh the list after deletion
      await loadTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      dialog.error(t('error'), t('failed_to_delete_transaction'));
    }
  };

  const renderTransactionItem = ({ item: transaction }: { item: HybridTransaction }) => {
    const icon = getTransactionIcon(transaction.type, transaction.description);

    return (
      <TouchableOpacity
        style={[styles.transactionItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => handleTransactionPress(transaction)}
        onLongPress={() => handleTransactionLongPress(transaction)}
        activeOpacity={0.7}
      >
        <View style={styles.transactionLeft}>
          <View style={[styles.transactionIconContainer, { backgroundColor: `${icon.color}15` }]}>
            <Ionicons name={icon.name as any} size={20} color={icon.color} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={[styles.transactionTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {transaction.description || `${transaction.type.toLowerCase()} transaction`}
            </Text>
            <View style={styles.transactionMeta}>
              <Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}>
                {transaction.type.toLowerCase()}
              </Text>
              {transaction.notes && (
                <>
                  <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
                  <Text style={[styles.transactionNotes, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {transaction.notes}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[
            styles.transactionAmount,
            {
              color: transaction.type === 'INCOME'
                ? theme.colors.success
                : transaction.type === 'TRANSFER'
                  ? theme.colors.primary
                  : '#FF3B30'
            }
          ]}>
            {transaction.type === 'INCOME' ? '+' : transaction.type === 'TRANSFER' ? '↔' : ''}
            {formatCurrency(transaction.amount)}
          </Text>
          <Text style={[styles.transactionTime, { color: theme.colors.textSecondary }]}>
            {new Date(transaction.date).toLocaleTimeString(language === 'ar' ? 'ar-SA' : language, {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDateGroup = ({ item: group }: { item: GroupedTransaction }) => (
    <View style={[styles.dateGroup, { backgroundColor: theme.colors.background }]}>
      {/* Date Header */}
      <View style={[styles.dateHeader, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.dateHeaderLeft}>
          <Text style={[styles.dateHeaderTitle, { color: theme.colors.text }]}>
            {formatRelativeDate(group.date)}
          </Text>
          <Text style={[styles.dateHeaderSubtitle, { color: theme.colors.textSecondary }]}>
            {group.transactions.length} {group.transactions.length === 1 ? t('transaction_singular') : t('transaction_plural')}
          </Text>
        </View>
        <View style={styles.dateHeaderRight}>
          {group.totalIncome > 0 && (
            <Text style={[styles.dateHeaderAmount, { color: theme.colors.success }]}>
              +{formatCurrency(group.totalIncome)}
            </Text>
          )}
          {group.totalExpense > 0 && (
            <Text style={[styles.dateHeaderAmount, { color: '#FF3B30' }]}>
              -{formatCurrency(group.totalExpense)}
            </Text>
          )}
        </View>
      </View>

      {/* Transactions */}
      <View style={styles.transactionsContainer}>
        {group.transactions.map((transaction, index) => (
          <View key={transaction.id}>
            {renderTransactionItem({ item: transaction })}
            {index < group.transactions.length - 1 && (
              <View style={[styles.transactionSeparator, { backgroundColor: theme.colors.border }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const renderFilterChip = (
    type: FilterState['type'],
    label: string,
    icon?: string,
    count?: number
  ) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.filterChip,
        {
          backgroundColor: filter.type === type ? theme.colors.primary : theme.colors.surface,
          borderColor: filter.type === type ? theme.colors.primary : theme.colors.border,
        }
      ]}
      onPress={() => setFilter(prev => ({ ...prev, type }))}
    >
      {icon && (
        <Ionicons
          name={icon as any}
          size={16}
          color={filter.type === type ? 'white' : theme.colors.textSecondary}
          style={styles.filterChipIcon}
        />
      )}
      <Text style={[
        styles.filterChipText,
        {
          color: filter.type === type ? 'white' : theme.colors.text
        }
      ]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[
          styles.filterChipBadge,
          { backgroundColor: filter.type === type ? 'rgba(255,255,255,0.2)' : theme.colors.primary }
        ]}>
          <Text style={[
            styles.filterChipBadgeText,
            { color: filter.type === type ? 'white' : 'white' }
          ]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDateRangeChip = (
    range: FilterState['dateRange'],
    label: string
  ) => (
    <TouchableOpacity
      key={range}
      style={[
        styles.dateRangeChip,
        {
          backgroundColor: filter.dateRange === range ? theme.colors.primary : 'transparent',
          borderColor: filter.dateRange === range ? theme.colors.primary : theme.colors.border,
        }
      ]}
      onPress={() => setFilter(prev => ({ ...prev, dateRange: range }))}
    >
      <Text style={[
        styles.dateRangeChipText,
        {
          color: filter.dateRange === range ? 'white' : theme.colors.textSecondary
        }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient
        colors={[`${theme.colors.primary}20`, `${theme.colors.primary}05`]}
        style={styles.emptyIconContainer}
      >
        <MaterialCommunityIcons
          name="receipt-text-outline"
          size={48}
          color={theme.colors.primary}
        />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        {filter.search ? t('no_search_results') : t('no_transactions')}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        {filter.search
          ? t('try_different_search_terms')
          : filter.type === 'all'
            ? t('start_tracking_expenses')
            : t('no_transactions_for_filter').replace('{filter}', t(filter.type))
        }
      </Text>
      {!filter.search && filter.type === 'all' && (
        <TouchableOpacity
          style={[styles.emptyAction, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.emptyActionText}>{t('add_first_transaction')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.headerBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.headerBackground} />

      {/* Dark Header Section */}
      <View style={[styles.darkHeader, { backgroundColor: theme.colors.headerBackground, paddingTop: insets.top }]}>
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.headerText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => (navigation as any).navigate('UserProfile')}
            activeOpacity={0.7}
          >
            <View style={styles.avatarContainer}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.headerSurface }]}>
                  <Text style={[styles.avatarInitial, { color: theme.colors.headerText }]}>
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleSearch} style={[styles.headerIconButton, { backgroundColor: theme.colors.headerSurface }]}>
              <Ionicons
                name={searchVisible ? "close" : "search"}
                size={22}
                color={theme.colors.headerText}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.headerTitleSection}>
          <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>
            {t('transactions_history')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.headerTextSecondary }]}>
            {statistics.total} {t('transaction_plural')}
          </Text>
        </View>

        {/* Search Bar in Header */}
        <Animated.View style={[
          styles.searchContainer,
          { height: animatedValues.searchHeight }
        ]}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.headerSurface }]}>
            <Ionicons name="search" size={20} color={theme.colors.headerTextSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.headerText }]}
              placeholder={t('search_transactions')}
              placeholderTextColor={theme.colors.headerTextSecondary}
              value={filter.search}
              onChangeText={(text) => setFilter(prev => ({ ...prev, search: text }))}
              autoFocus={searchVisible}
            />
            {filter.search.length > 0 && (
              <TouchableOpacity onPress={() => setFilter(prev => ({ ...prev, search: '' }))}>
                <Ionicons name="close-circle" size={20} color={theme.colors.headerTextSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>

      {/* White Content Section */}
      <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
        {/* Enhanced Statistics */}
        <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statHeader}>
                <Ionicons name="trending-up" size={16} color={theme.colors.success} />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  {t('income')}
                </Text>
              </View>
              <Text style={[styles.statValue, { color: theme.colors.success }]}>
                {formatCurrency(statistics.income)}
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.statItem}>
              <View style={styles.statHeader}>
                <Ionicons name="trending-down" size={16} color="#FF3B30" />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  {t('expenses')}
                </Text>
              </View>
              <Text style={[styles.statValue, { color: '#FF3B30' }]}>
                {formatCurrency(statistics.expense)}
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.statItem}>
              <View style={styles.statHeader}>
                <Ionicons name="analytics" size={16} color={theme.colors.primary} />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  {t('net')}
                </Text>
              </View>
              <Text style={[
                styles.statValue,
                { color: statistics.netIncome >= 0 ? theme.colors.success : '#FF3B30' }
              ]}>
                {statistics.netIncome >= 0 ? '+' : ''}{formatCurrency(statistics.netIncome)}
              </Text>
            </View>
          </View>
        </View>

        {/* Enhanced Filter Chips */}
        <View style={styles.filtersSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterScrollContent}
          >
            {renderFilterChip('all', t('all'), 'list', statistics.total)}
            {renderFilterChip('income', t('income'), 'trending-up',
              transactions.filter(t => t.type === 'INCOME').length)}
            {renderFilterChip('expense', t('expenses'), 'trending-down',
              transactions.filter(t => t.type === 'EXPENSE').length)}
            {renderFilterChip('transfer', t('transfers'), 'swap-horizontal',
              transactions.filter(t => t.type === 'TRANSFER').length)}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.filterScrollView, { marginTop: 12 }]}
            contentContainerStyle={styles.filterScrollContent}
          >
            {renderDateRangeChip('all', t('all_time'))}
            {renderDateRangeChip('week', t('this_week'))}
            {renderDateRangeChip('month', t('this_month'))}
            {renderDateRangeChip('year', t('this_year'))}
          </ScrollView>
        </View>

        {/* Transactions List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              {t('loading_transactions')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={groupedTransactions}
            renderItem={renderDateGroup}
            keyExtractor={(item) => item.date}
            style={styles.transactionsList}
            contentContainerStyle={styles.transactionsListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            ListEmptyComponent={renderEmpty}
            ItemSeparatorComponent={() => <View style={styles.groupSeparator} />}
          />
        )}
      </View>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        visible={showTransactionDetails}
        onClose={() => setShowTransactionDetails(false)}
        transaction={selectedTransaction}
        onEdit={handleEditTransaction}
        onDuplicate={handleDuplicateTransaction}
        onDelete={handleDeleteTransaction}
      />

      {/* Banner Ad for free users */}

      {/* Interstitial Ad Modal */}
      <InterstitialComponent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleSection: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // Search
  searchContainer: {
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    marginRight: 8,
  },

  // Enhanced Statistics
  statsContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 12,
  },

  // Enhanced Filters
  filtersSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterScrollContent: {
    paddingRight: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
  },
  filterChipIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateRangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1,
  },
  dateRangeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Transactions List
  transactionsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  transactionsListContent: {
    paddingBottom: 100,
  },
  groupSeparator: {
    height: 14,
  },

  // Date Groups
  dateGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dateHeaderLeft: {
    flex: 1,
  },
  dateHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateHeaderRight: {
    alignItems: 'flex-end',
  },
  dateHeaderAmount: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionsContainer: {
    backgroundColor: 'transparent',
  },

  // Transaction Items
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
    lineHeight: 20,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionCategory: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  metaSeparator: {
    fontSize: 12,
    marginHorizontal: 6,
  },
  transactionNotes: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  transactionTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  transactionSeparator: {
    height: 1,
    marginHorizontal: 16,
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },

  // Empty States
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAction: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TransactionsHistoryScreen;