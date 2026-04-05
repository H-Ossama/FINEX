import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useDialog } from '../contexts/DialogContext';
import { HybridTransaction } from '../services/hybridDataService';

interface TransactionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: HybridTransaction | null;
  onEdit?: (transaction: HybridTransaction) => void;
  onDuplicate?: (transaction: HybridTransaction) => void;
  onDelete?: (id: string) => void;
}

const { width, height } = Dimensions.get('window');

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  visible,
  onClose,
  transaction,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const { theme } = useTheme();
  const { formatCurrency, t, language } = useLocalization();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();

  if (!transaction) return null;

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

  const formatTransactionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      full: date.toLocaleDateString(language === 'ar' ? 'ar-SA' : language, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : language, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      relative: (() => {
        const today = new Date();
        const diffTime = today.getTime() - date.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return t('today');
        if (diffDays === 1) return t('yesterday');
        if (diffDays <= 7) return `${diffDays} ${t('days_ago')}`;
        return null;
      })(),
    };
  };

  const handleEdit = () => {
    onEdit?.(transaction);
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicate?.(transaction);
    onClose();
  };

  const handleDelete = () => {
    dialog.confirm({
      title: t('delete_transaction'),
      message: t('delete_transaction_confirmation'),
      destructive: true,
      confirmText: t('delete'),
      cancelText: t('cancel'),
      onConfirm: () => {
        onDelete?.(transaction.id);
        onClose();
      },
    });
  };

  const icon = getTransactionIcon(transaction.type, transaction.description);
  const dateInfo = formatTransactionDate(transaction.date);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
        <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" />

        {/* Dark Header */}
        <View style={[styles.darkHeader, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {t('transaction_details')}
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        {/* Content Container */}
        <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Transaction Icon & Amount */}
            <View style={[styles.heroSection, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
                <Ionicons name={icon.name as any} size={32} color={icon.color} />
              </View>
              <Text style={[
                styles.amount,
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
              <Text style={[styles.description, { color: theme.colors.text }]}>
                {transaction.description || t('transaction_without_description')}
              </Text>
              <View style={[styles.typeBadge, { backgroundColor: `${icon.color}20` }]}>
                <Text style={[styles.typeText, { color: icon.color }]}>
                  {t(transaction.type.toLowerCase())}
                </Text>
              </View>
            </View>

            {/* Details Section */}
            <View style={[styles.detailsSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('transaction_details_info')}
              </Text>

              {/* Date & Time */}
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="calendar" size={20} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    {t('date_time')}
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                    {dateInfo.full}
                  </Text>
                  <Text style={[styles.detailSubValue, { color: theme.colors.textSecondary }]}>
                    {dateInfo.time} {dateInfo.relative && `• ${dateInfo.relative}`}
                  </Text>
                </View>
              </View>

              {/* Transaction ID */}
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <MaterialCommunityIcons name="identifier" size={20} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    {t('transaction_id')}
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={1}>
                    {transaction.id}
                  </Text>
                </View>
              </View>

              {/* Wallet */}
              {transaction.walletId && (
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="wallet" size={20} color={theme.colors.textSecondary} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                      {t('wallet')}
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {transaction.walletId}
                    </Text>
                  </View>
                </View>
              )}

              {/* Notes */}
              {transaction.notes && (
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="document-text" size={20} color={theme.colors.textSecondary} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                      {t('transaction_notes')}
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {transaction.notes}
                    </Text>
                  </View>
                </View>
              )}

              {/* Sync Status */}
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons
                    name={transaction.syncStatus === 'synced' ? 'cloud-done' : 'cloud-upload'}
                    size={20}
                    color={transaction.syncStatus === 'synced' ? theme.colors.success : theme.colors.warning}
                  />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    {t('sync_status')}
                  </Text>
                  <Text style={[
                    styles.detailValue,
                    { color: transaction.syncStatus === 'synced' ? theme.colors.success : theme.colors.warning }
                  ]}>
                    {t(transaction.syncStatus || 'unknown')}
                  </Text>
                </View>
              </View>

              {/* Creation Date */}
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="time" size={20} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    {t('created_at')}
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                    {new Date(transaction.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : language)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsSection}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleEdit}
              >
                <Ionicons name="create" size={20} color="white" />
                <Text style={styles.actionButtonText}>{t('edit')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
                onPress={handleDuplicate}
              >
                <Ionicons name="copy" size={20} color={theme.colors.text} />
                <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>{t('duplicate')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleDelete}
              >
                <Ionicons name="trash" size={20} color="white" />
                <Text style={styles.actionButtonText}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  darkHeader: {
    backgroundColor: '#1C1C1E',
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsSection: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  detailIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailSubValue: {
    fontSize: 14,
    fontWeight: '400',
  },
  actionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TransactionDetailsModal;