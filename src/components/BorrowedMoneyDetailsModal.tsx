import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorrowedMoney } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';

interface BorrowedMoneyDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  borrowedMoney: BorrowedMoney | null;
  onMarkAsPaid: (id: string) => void;
  onEdit: (borrowedMoney: BorrowedMoney) => void;
  onDelete: (id: string) => void;
}

const BorrowedMoneyDetailsModal: React.FC<BorrowedMoneyDetailsModalProps> = ({
  visible,
  onClose,
  borrowedMoney,
  onMarkAsPaid,
  onEdit,
  onDelete,
}) => {
  const { theme } = useTheme();
  const { formatCurrency, t } = useLocalization();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<BorrowedMoney | null>(null);

  React.useEffect(() => {
    if (borrowedMoney) {
      setEditedData({ ...borrowedMoney });
    }
  }, [borrowedMoney]);

  if (!borrowedMoney || !editedData) return null;

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editedData) {
      onEdit(editedData);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedData({ ...borrowedMoney });
    setIsEditing(false);
  };

  const handleMarkAsPaid = () => {
    const isLent = borrowedMoney.type === 'lent';
    Alert.alert(
      isLent ? t('mark_as_received') : t('mark_as_paid'),
      isLent
        ? t('mark_received_confirmation') || `Are you sure you want to mark the payment from ${borrowedMoney.personName} as received?`
        : t('mark_paid_confirmation').replace('{name}', borrowedMoney.personName),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: isLent ? t('mark_as_received') : t('mark_as_paid'),
          style: 'default',
          onPress: () => onMarkAsPaid(borrowedMoney.id)
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t('delete_record'),
      t('delete_record_confirmation').replace('{name}', borrowedMoney.personName),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            onDelete(borrowedMoney.id);
            onClose();
          }
        },
      ]
    );
  };

  const handleCall = () => {
    if (borrowedMoney.phoneNumber) {
      Linking.openURL(`tel:${borrowedMoney.phoneNumber}`);
    }
  };

  const handleEmail = () => {
    if (borrowedMoney.email) {
      Linking.openURL(`mailto:${borrowedMoney.email}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = new Date(borrowedMoney.dueDate) < new Date() && !borrowedMoney.isPaid;

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
              {t('borrowed_money_details')}
            </Text>
            <TouchableOpacity
              onPress={isEditing ? handleSaveEdit : handleEdit}
              style={styles.editButton}
            >
              <Ionicons
                name={isEditing ? "checkmark" : "pencil"}
                size={24}
                color="#4A90E2"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Container */}
        <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>

          <ScrollView style={styles.content}>
            {/* Status Badge */}
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusBadge,
                {
                  backgroundColor: borrowedMoney.isPaid
                    ? theme.colors.success
                    : isOverdue
                      ? '#FF3B30'
                      : theme.colors.warning
                }
              ]}>
                <Text style={styles.statusText}>
                  {borrowedMoney.isPaid ? t('paid') : isOverdue ? t('overdue') : t('pending')}
                </Text>
              </View>
            </View>

            {/* Amount */}
            <View style={[styles.amountCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
                {borrowedMoney.type === 'lent' ? t('amount_lent') : t('amount_borrowed')}
              </Text>
              <Text style={[styles.amountValue, { color: theme.colors.text }]}>
                {formatCurrency(borrowedMoney.amount)}
              </Text>
            </View>

            {/* Person Details */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('person_details')}
              </Text>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  {t('person_name')}
                </Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={editedData.personName}
                    onChangeText={(text) => setEditedData({ ...editedData, personName: text })}
                    placeholder={t('name_placeholder')}
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                ) : (
                  <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                    {borrowedMoney.personName}
                  </Text>
                )}
              </View>

              {(borrowedMoney.phoneNumber || isEditing) && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    {t('phone_number')}
                  </Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      value={editedData.phoneNumber || ''}
                      onChangeText={(text) => setEditedData({ ...editedData, phoneNumber: text })}
                      placeholder={t('phone_placeholder')}
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <TouchableOpacity onPress={handleCall} style={styles.contactRow}>
                      <Text style={[styles.detailValue, { color: theme.colors.primary }]}>
                        {borrowedMoney.phoneNumber}
                      </Text>
                      <Ionicons name="call" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {(borrowedMoney.email || isEditing) && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    {t('email')}
                  </Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      value={editedData.email || ''}
                      onChangeText={(text) => setEditedData({ ...editedData, email: text })}
                      placeholder={t('email_placeholder')}
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  ) : (
                    <TouchableOpacity onPress={handleEmail} style={styles.contactRow}>
                      <Text style={[styles.detailValue, { color: theme.colors.primary }]}>
                        {borrowedMoney.email}
                      </Text>
                      <Ionicons name="mail" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Loan Details */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('loan_details')}
              </Text>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  {t('reason')}
                </Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={editedData.reason}
                    onChangeText={(text) => setEditedData({ ...editedData, reason: text })}
                    placeholder={t('reason_placeholder')}
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                ) : (
                  <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                    {borrowedMoney.reason}
                  </Text>
                )}
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  {borrowedMoney.type === 'lent' ? t('lent_date_label') : t('borrowed_date_label')}
                </Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {formatDate(borrowedMoney.borrowedDate)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  {t('due_date')}
                </Text>
                <Text style={[
                  styles.detailValue,
                  { color: isOverdue ? '#FF3B30' : theme.colors.text }
                ]}>
                  {formatDate(borrowedMoney.dueDate)}
                  {isOverdue && ` (${t('overdue')})`}
                </Text>
              </View>

              {(borrowedMoney.notes || isEditing) && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    {t('notes')}
                  </Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.textArea, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      value={editedData.notes || ''}
                      onChangeText={(text) => setEditedData({ ...editedData, notes: text })}
                      placeholder={t('notes_placeholder')}
                      placeholderTextColor={theme.colors.textSecondary}
                      multiline
                      numberOfLines={3}
                    />
                  ) : (
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {borrowedMoney.notes}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          {!isEditing && (
            <View style={[styles.actionButtons, { borderTopColor: theme.colors.border }]}>
              {!borrowedMoney.isPaid && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                  onPress={handleMarkAsPaid}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.actionButtonText}>
                    {borrowedMoney.type === 'lent' ? t('mark_as_received') : t('mark_as_paid')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleDelete}
              >
                <Ionicons name="trash" size={20} color="white" />
                <Text style={styles.actionButtonText}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {isEditing && (
            <View style={[styles.actionButtons, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.textSecondary }]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.actionButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.actionButtonText}>{t('save_changes')}</Text>
              </TouchableOpacity>
            </View>
          )}
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  amountCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
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
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 4,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 4,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BorrowedMoneyDetailsModal;