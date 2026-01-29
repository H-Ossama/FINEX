import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../contexts/LocalizationContext';
import {
  useSubscription,
  SUBSCRIPTION_PRICING,
  BillingPeriod
} from '../contexts/SubscriptionContext';
import { useDialog } from '../contexts/DialogContext';

type Props = {
  navigation: any;
};

const SubscriptionScreen: React.FC<Props> = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const {
    planId,
    isPro,
    isLoading,
    setPlan,
    limits,
    billingPeriod,
    setBillingPeriod,
  } = useSubscription();

  const [saving, setSaving] = useState(false);

  const planLabel = isPro ? (t('subscription_pro') || 'Pro') : (t('subscription_free') || 'Free');

  const proFeatures = [
    { icon: 'infinite-outline' as const, text: t('subscription_pro_unlimited') || 'Unlimited wallets and transactions' },
    { icon: 'cloud-upload-outline' as const, text: t('subscription_pro_backup') || 'Cloud backup and sync across devices' },
    { icon: 'download-outline' as const, text: t('subscription_pro_export') || 'Export your data (CSV/PDF)' },
    { icon: 'analytics-outline' as const, text: t('subscription_pro_insights') || 'Advanced insights and analytics' },
    { icon: 'pricetags-outline' as const, text: t('subscription_custom_categories') || 'Create custom categories' },
    { icon: 'headset-outline' as const, text: t('subscription_priority_support') || 'Priority support' },
    { icon: 'close-circle-outline' as const, text: t('subscription_no_ads') || 'Ad-free experience' },
  ];

  const handleUpgrade = async () => {
    if (isPro) return;

    const selectedPrice = billingPeriod === 'yearly'
      ? SUBSCRIPTION_PRICING.yearly.displayPrice
      : SUBSCRIPTION_PRICING.monthly.displayPrice;

    dialog.confirm({
      title: t('subscription_upgrade_title') || 'Start Pro subscription',
      message:
        t('subscription_upgrade_confirm', { price: selectedPrice }) ||
        `Pro • ${selectedPrice}\n\nCancel anytime in Google Play. Renews automatically unless canceled.\n\nNote: Purchases are simulated in this build.`,
      confirmText: t('subscription_upgrade_button') || 'Continue',
      cancelText: t('cancel') || 'Cancel',
      onConfirm: () => {
        void (async () => {
          try {
            setSaving(true);
            // In production, this would trigger Google Play Billing
            await setPlan('pro');
            dialog.success(
              t('subscription_welcome_pro') || 'Welcome to Pro',
              t('subscription_welcome_pro_message') || 'Pro features are now unlocked on this device.'
            );
          } catch {
            dialog.error(
              t('error') || 'Error',
              t('subscription_change_failed') || 'Failed to upgrade. Please try again.'
            );
          } finally {
            setSaving(false);
          }
        })();
      },
    });
  };

  const handleRestorePurchases = async () => {
    setSaving(true);
    // Simulate restore process
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSaving(false);

    dialog.alert(
      t('subscription_restore_title') || 'Restore purchases',
      t('subscription_restore_message') ||
      'No active subscription was found for this Google account. If you just purchased, wait a minute and try again.'
    );
  };

  const handleManageSubscription = () => {
    // Open Google Play subscriptions
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  const styles = createStyles(theme, isDark);

  // If user is already Pro, show management screen
  if (isPro && !isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.headerBackground }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.headerBackground} />

        <View style={[styles.darkHeader, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('subscription_title') || 'Subscription'}</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Pro Status Card */}
            <LinearGradient
              colors={['#F59E0B', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proStatusCard}
            >
              <View style={styles.proStatusIcon}>
                <Ionicons name="diamond" size={40} color="#FFFFFF" />
              </View>
              <Text style={styles.proStatusTitle}>
                {t('subscription_you_are_on_pro') || 'Pro is active'}
              </Text>
              <Text style={styles.proStatusSubtitle}>
                {t('subscription_all_features_unlocked') || 'Enjoy unlimited access to premium features'}
              </Text>
            </LinearGradient>

            {/* Subscription Details */}
            <View style={[styles.detailsCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.detailsTitle, { color: theme.colors.text }]}>
                {t('subscription_details') || 'Subscription Details'}
              </Text>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  {t('subscription_plan') || 'Plan'}
                </Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  Pro
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  {t('subscription_status') || 'Status'}
                </Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    {t('subscription_active') || 'Active'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.manageButton}
                onPress={handleManageSubscription}
              >
                <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.manageButtonText, { color: theme.colors.primary }]}>
                  {t('subscription_manage_google') || 'Manage subscription in Google Play'}
                </Text>
                <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={[styles.actionsCard, { backgroundColor: theme.colors.surface }]}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleRestorePurchases}
                disabled={saving}
              >
                <Ionicons name="refresh" size={18} color={theme.colors.primary} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}
                >
                  {t('subscription_restore') || 'Restore Purchases'}
                </Text>
              </TouchableOpacity>

              {__DEV__ ? (
                <TouchableOpacity
                  style={[styles.actionRow, styles.actionRowDanger]}
                  onPress={async () => {
                    try {
                      setSaving(true);
                      await setPlan('free');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                >
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>
                    Reset to Free (dev)
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Features List */}
            <View style={[styles.featuresCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.featuresTitle, { color: theme.colors.text }]}>
                {t('subscription_your_features') || 'Your Pro Features'}
              </Text>
              {proFeatures.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <View style={styles.featureCheck}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.featureText, { color: theme.colors.text }]}>
                    {feature.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Demo Mode Notice */}
            {__DEV__ ? (
              <View style={[styles.demoNotice, { backgroundColor: isDark ? '#2D2D30' : '#FEF3C7' }]}>
                <Ionicons name="information-circle" size={20} color="#D97706" />
                <Text style={[styles.demoNoticeText, { color: '#92400E' }]}>
                  {t('subscription_demo_notice') || 'Development build: subscriptions are simulated.'}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Free user - show upgrade screen
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.headerBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.headerBackground} />

      <View style={[styles.darkHeader, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {t('subscription_upgrade_to_pro') || 'Upgrade to Pro'}
            </Text>
          </View>
          <View style={styles.currentPlanBadge}>
            <Ionicons name="leaf-outline" size={12} color="#93C5FD" />
            <Text style={styles.currentPlanText}>{planLabel}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              {t('loading') || 'Loading…'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <LinearGradient
                colors={['#F59E0B', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroIcon}
              >
                <Ionicons name="diamond" size={48} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
                {t('subscription_unlock_potential') || 'Unlock Your Full Potential'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
                {t('subscription_pro_description') || 'Get unlimited access to all premium features'}
              </Text>
            </View>

            {/* Features List */}
            <View style={[styles.featuresCard, { backgroundColor: theme.colors.surface }]}>
              {proFeatures.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <View style={styles.featureCheck}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.featureText, { color: theme.colors.text }]}>
                    {feature.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Billing Period Toggle */}
            <View style={styles.billingToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.billingOption,
                  billingPeriod === 'yearly' && styles.billingOptionSelected,
                  {
                    backgroundColor: billingPeriod === 'yearly'
                      ? (isDark ? '#1F1F23' : '#FFFFFF')
                      : 'transparent',
                    borderColor: billingPeriod === 'yearly' ? '#F59E0B' : theme.colors.border,
                  }
                ]}
                onPress={() => setBillingPeriod('yearly')}
              >
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>
                    {t('subscription_best_value') || 'Best value'}
                  </Text>
                </View>
                <Text style={[styles.billingPeriodLabel, { color: theme.colors.text }]}>
                  {t('subscription_yearly') || 'Yearly'}
                </Text>
                <Text style={[styles.billingPrice, { color: theme.colors.text }]}>
                  {SUBSCRIPTION_PRICING.yearly.displayPrice}
                </Text>
                <Text style={[styles.billingEquivalent, { color: theme.colors.textSecondary }]}>
                  {SUBSCRIPTION_PRICING.yearly.monthlyEquivalent} · {t('billed_yearly')}
                </Text>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>
                    {t('subscription_save') || 'Save'} {SUBSCRIPTION_PRICING.yearly.savings}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.billingOption,
                  billingPeriod === 'monthly' && styles.billingOptionSelected,
                  {
                    backgroundColor: billingPeriod === 'monthly'
                      ? (isDark ? '#1F1F23' : '#FFFFFF')
                      : 'transparent',
                    borderColor: billingPeriod === 'monthly' ? '#F59E0B' : theme.colors.border,
                  }
                ]}
                onPress={() => setBillingPeriod('monthly')}
              >
                <Text style={[styles.billingPeriodLabel, { color: theme.colors.text, marginTop: 24 }]}>
                  {t('subscription_monthly') || 'Monthly'}
                </Text>
                <Text style={[styles.billingPrice, { color: theme.colors.text }]}>
                  {SUBSCRIPTION_PRICING.monthly.displayPrice}
                </Text>
                <Text style={[styles.billingEquivalent, { color: theme.colors.textSecondary }]}>
                  {t('subscription_billed_monthly') || 'Billed monthly'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Upgrade Button */}
            <TouchableOpacity
              style={styles.upgradeButtonContainer}
              onPress={handleUpgrade}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#F59E0B', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeButton}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="diamond" size={22} color="#FFFFFF" />
                    <Text style={styles.upgradeButtonText}>
                      {t('subscription_upgrade_button')}
                      {billingPeriod === 'yearly' ? ` • ${t('subscription_yearly')}` : ` • ${t('subscription_monthly')}`}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Trust Signals */}
            <View style={styles.trustSection}>
              <Text style={[styles.trustText, { color: theme.colors.textSecondary }]}>
                {t('subscription_cancel_anytime')} · {t('subscription_managed_google')} · {t('subscription_renews_automatically') || 'Renews automatically'}
              </Text>
            </View>

            {/* Restore Purchases */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestorePurchases}
              disabled={saving}
            >
              <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}>
                {t('subscription_restore') || 'Restore Purchases'}
              </Text>
            </TouchableOpacity>

            {/* Manage Subscription */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleManageSubscription}
              disabled={saving}
            >
              <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}
              >
                {t('subscription_manage_google') || 'Manage subscription in Google Play'}
              </Text>
            </TouchableOpacity>

            {/* Legal Links */}
            <View style={styles.legalSection}>
              <TouchableOpacity onPress={() => navigation.navigate('TermsOfUse')}>
                <Text style={[styles.legalLink, { color: theme.colors.textSecondary }]}>
                  {t('terms_of_use') || 'Terms of Use'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.legalDot, { color: theme.colors.textSecondary }]}>·</Text>
              <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                <Text style={[styles.legalLink, { color: theme.colors.textSecondary }]}>
                  {t('privacy_policy') || 'Privacy Policy'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    darkHeader: {
      backgroundColor: '#1C1C1E',
      paddingHorizontal: 20,
      paddingBottom: 18,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      alignItems: 'center',
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    currentPlanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 12,
    },
    currentPlanText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    contentContainer: {
      flex: 1,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 32,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Hero Section
    heroSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    heroIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
    },
    heroSubtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },

    // Features Card
    featuresCard: {
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    featuresTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 16,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 12,
    },
    featureCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#10B981',
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      fontSize: 14,
      flex: 1,
      lineHeight: 20,
    },

    // Billing Toggle
    billingToggleContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    billingOption: {
      flex: 1,
      borderRadius: 16,
      padding: 16,
      borderWidth: 2,
      alignItems: 'center',
      position: 'relative',
    },
    billingOptionSelected: {
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    bestValueBadge: {
      position: 'absolute',
      top: -10,
      backgroundColor: '#10B981',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    bestValueText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    billingPeriodLabel: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    billingPrice: {
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 4,
    },
    billingEquivalent: {
      fontSize: 12,
      marginBottom: 8,
    },
    savingsBadge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    savingsText: {
      color: '#B45309',
      fontSize: 11,
      fontWeight: '700',
    },

    // Upgrade Button
    upgradeButtonContainer: {
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
      marginBottom: 16,
    },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      gap: 10,
    },
    upgradeButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
    },

    // Trust Section
    trustSection: {
      alignItems: 'center',
      marginBottom: 16,
    },
    trustText: {
      fontSize: 13,
      textAlign: 'center',
    },

    // Restore Button
    restoreButton: {
      alignItems: 'center',
      paddingVertical: 12,
      marginBottom: 16,
    },
    restoreButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Legal Section
    legalSection: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    legalLink: {
      fontSize: 13,
      textDecorationLine: 'underline',
    },
    legalDot: {
      fontSize: 13,
    },

    // Pro Status Card (for Pro users)
    proStatusCard: {
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    },
    proStatusIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    proStatusTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 8,
    },
    proStatusSubtitle: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.8)',
    },

    // Details Card
    detailsCard: {
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    detailsTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 16,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    detailLabel: {
      fontSize: 14,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    activeBadge: {
      backgroundColor: '#D1FAE5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    activeBadgeText: {
      color: '#059669',
      fontSize: 12,
      fontWeight: '700',
    },
    manageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    manageButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Actions Card
    actionsCard: {
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    actionRowDanger: {
      marginTop: 2,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Demo Notice
    demoNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
    },
    demoNoticeText: {
      fontSize: 13,
      flex: 1,
    },
  });

export default SubscriptionScreen;
