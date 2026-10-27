import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Tag, Gift, Check, ShieldCheck, X } from 'lucide-react-native';
import { supabase } from '../../src/supabase/client';
import { useAuth } from '../../src/context/AuthContext';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { LoadingState } from '../../src/components/LoadingState';
import { colors } from '../../src/theme/colors';
import { formatNaira } from '../../src/utils/currency';

interface SelectedTicket {
  ticketTypeId: string;
  count: number;
  name: string;
  price_kobo: number;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { eventId, ticketsPayload, totalAmountKobo, promoterLinkId } = useLocalSearchParams<{
    eventId: string;
    ticketsPayload: string;
    totalAmountKobo: string;
    promoterLinkId?: string;
  }>();

  const { user, profile } = useAuth();

  // Custom Questions State
  const [checkoutQuestions, setCheckoutQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Fetch checkout questions for the event
  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('checkout_questions')
      .select('*')
      .eq('event_id', eventId)
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (data) setCheckoutQuestions(data);
      });
  }, [eventId]);

  // Parse tickets
  const selectedTickets: SelectedTicket[] = useMemo(() => {
    try {
      return ticketsPayload ? JSON.parse(ticketsPayload) : [];
    } catch {
      return [];
    }
  }, [ticketsPayload]);

  const initialTotalKobo = parseInt(totalAmountKobo || '0', 10);

  // Buyer details
  const [buyerName, setBuyerName] = useState(
    profile?.full_name || user?.user_metadata?.full_name || ''
  );
  const [buyerEmail, setBuyerEmail] = useState(user?.email || '');
  const [buyerPhone, setBuyerPhone] = useState(
    profile?.phone || user?.user_metadata?.phone || ''
  );

  // Gift options
  const [isGift, setIsGift] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [giftMessage, setGiftMessage] = useState('');

  // Promo code
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    discount_value: number;
  } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  // Payment states
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [paystackUrl, setPaystackUrl] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyLock = useRef(false);

  // Enforce authentication
  useEffect(() => {
    if (!user) {
      Alert.alert('Sign In Required', 'You must be signed in to complete checkout.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  }, [user]);

  // Recalculate total with promo discount
  const finalTotalKobo = useMemo(() => {
    if (!appliedPromo) return initialTotalKobo;
    const discount = Math.round((initialTotalKobo * appliedPromo.discount_value) / 100);
    return Math.max(0, initialTotalKobo - discount);
  }, [initialTotalKobo, appliedPromo]);

  // Promo code validation
  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim() || !eventId) return;
    setApplyingPromo(true);

    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('id, code, discount_value, expires_at, max_uses, uses_count')
        .eq('event_id', eventId)
        .ilike('code', promoCodeInput.trim())
        .maybeSingle();

      if (error || !data) {
        throw new Error('Invalid promo code.');
      }

      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        throw new Error('This promo code has expired.');
      }

      if (data.max_uses && data.uses_count >= data.max_uses) {
        throw new Error('This promo code has reached its usage limit.');
      }

      setAppliedPromo({
        id: data.id,
        code: data.code,
        discount_value: data.discount_value,
      });

      Alert.alert(
        'Promo Applied',
        `Promo code "${data.code}" applied! You get ${data.discount_value}% discount.`
      );
    } catch (err: any) {
      Alert.alert('Promo Code Error', err.message || 'Could not validate promo code.');
      setAppliedPromo(null);
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleClearPromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
  };

  // Payment Verification Handler
  const verifyPaymentAndFinish = async (reference: string) => {
    if (verifyLock.current) return;
    verifyLock.current = true;
    setPaystackUrl(null);
    setIsVerifying(true);
    setLoadingMessage('Verifying transaction with Paystack...');

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { reference },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const orderId = data?.order_id;
      if (orderId) {
        router.replace({
          pathname: '/order/[orderId]' as any,
          params: { orderId },
        });
      } else {
        router.replace('/(tabs)/tickets');
      }
    } catch (err: any) {
      Alert.alert(
        'Payment Verification',
        err.message ||
          'Payment verification could not be completed. If you were debited, your tickets will appear under My Tickets shortly.',
        [{ text: 'View Tickets', onPress: () => router.replace('/(tabs)/tickets') }]
      );
    } finally {
      setIsVerifying(false);
      setIsProcessing(false);
    }
  };

  // Submit Checkout
  const handleProceed = async () => {
    if (!buyerName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }
    if (!buyerEmail.trim() || !buyerEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (isGift && (!recipientEmail.trim() || !recipientEmail.includes('@'))) {
      Alert.alert('Validation Error', 'Please provide a valid recipient email for the gift.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User authentication session expired. Please sign in again.');
      router.push('/(auth)/login');
      return;
    }

    // Validate required custom checkout questions
    for (const q of checkoutQuestions) {
      if (q.required) {
        const ans = answers[q.id];
        if (ans === undefined || ans === null || String(ans).trim() === '') {
          Alert.alert('Required Question', `Please answer: "${q.question_text}"`);
          return;
        }
      }
    }

    // Prepare tickets array for backend RPC / Edge Function
    const enrichedTickets = selectedTickets.map((t) => ({
      ticketTypeId: t.ticketTypeId,
      count: t.count,
      attendee_names: Array(t.count).fill(buyerName.trim()),
      attendee_emails: Array(t.count).fill(buyerEmail.trim()),
    }));

    setIsProcessing(true);

    // ----------------------------------------------------
    // FLOW A: Free Order (Total == 0)
    // ----------------------------------------------------
    if (finalTotalKobo === 0) {
      setLoadingMessage('Securing free tickets...');
      try {
        const { data: orderId, error } = await supabase.rpc('process_free_checkout', {
          p_event_id: eventId,
          p_user_id: user.id,
          p_buyer_name: buyerName.trim(),
          p_buyer_email: buyerEmail.trim().toLowerCase(),
          p_buyer_phone: buyerPhone.trim() || null,
          p_tickets: enrichedTickets as any,
          p_promo_code_id: appliedPromo?.id || null,
          p_is_gift: isGift,
          p_recipient_name: isGift ? recipientName.trim() || null : null,
          p_recipient_email: isGift ? recipientEmail.trim().toLowerCase() || null : null,
          p_gift_message: isGift ? giftMessage.trim() || null : null,
          p_promoter_link_id: promoterLinkId || null,
          p_checkout_answers: answers,
        });

        if (error) throw error;

        // Trigger confirmation email
        supabase.functions
          .invoke('send-ticket-confirmation', { body: { orderId } })
          .catch(console.warn);

        router.replace({
          pathname: '/order/[orderId]' as any,
          params: { orderId: orderId as string },
        });
      } catch (err: any) {
        Alert.alert('Checkout Failed', err.message || 'Failed to claim free tickets.');
        setIsProcessing(false);
      }
      return;
    }

    // ----------------------------------------------------
    // FLOW B: Paid Order (Paystack initialize-payment)
    // ----------------------------------------------------
    setLoadingMessage('Initializing Paystack payment...');
    try {
      const payload = {
        email: buyerEmail.trim().toLowerCase(),
        amount: finalTotalKobo / 100, // Edge function multiplies by 100 for kobo
        metadata: {
          eventId,
          tickets: enrichedTickets,
          promoCodeId: appliedPromo ? appliedPromo.id : null,
          userId: user.id,
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim() || null,
          isGift,
          recipientName: isGift ? recipientName.trim() : null,
          recipientEmail: isGift ? recipientEmail.trim().toLowerCase() : null,
          giftMessage: isGift ? giftMessage.trim() : null,
          promoterLinkId: promoterLinkId || null,
          checkoutAnswers: answers,
        },
      };

      const { data: initData, error: initError } = await supabase.functions.invoke(
        'initialize-payment',
        { body: payload }
      );

      if (initError) throw initError;
      if (initData?.error) throw new Error(initData.error);

      if (!initData?.authorization_url || !initData?.reference) {
        throw new Error('Invalid response from payment gateway.');
      }

      setPaymentReference(initData.reference);
      setPaystackUrl(initData.authorization_url);
    } catch (err: any) {
      Alert.alert('Payment Initialization Failed', err.message || 'Could not start payment.');
      setIsProcessing(false);
    }
  };

  if (isVerifying) {
    return <LoadingState message={loadingMessage || 'Verifying transaction with Paystack...'} />;
  }

  return (
    <View style={styles.root}>
      <Header title="Checkout" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Order Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Summary</Text>
            {selectedTickets.map((t) => (
              <View key={t.ticketTypeId} style={styles.summaryRow}>
                <Text style={styles.summaryTierName}>
                  {t.count}x {t.name}
                </Text>
                <Text style={styles.summaryTierPrice}>
                  {t.price_kobo === 0 ? 'FREE' : formatNaira(t.count * t.price_kobo)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Subtotal</Text>
              <Text style={styles.summaryTotalValue}>{formatNaira(initialTotalKobo)}</Text>
            </View>

            {appliedPromo ? (
              <View style={styles.summaryRow}>
                <Text style={styles.discountLabel}>Discount ({appliedPromo.discount_value}%)</Text>
                <Text style={styles.discountValue}>
                  -{formatNaira(initialTotalKobo - finalTotalKobo)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.finalTotalLabel}>Total Amount</Text>
              <Text style={styles.finalTotalValue}>
                {finalTotalKobo === 0 ? 'FREE' : formatNaira(finalTotalKobo)}
              </Text>
            </View>
          </View>

          {/* Attendee Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendee Information</Text>

            <Input
              label="Full Name"
              placeholder="e.g. Dapo Adeleke"
              value={buyerName}
              onChangeText={setBuyerName}
              autoCapitalize="words"
            />

            <Input
              label="Email Address"
              placeholder="dapo@example.com"
              value={buyerEmail}
              onChangeText={setBuyerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Phone Number"
              placeholder="0801 234 5678"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Promo Code Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Promo Code</Text>
            <View style={styles.promoInputRow}>
              <Input
                placeholder="Enter discount code"
                value={promoCodeInput}
                onChangeText={setPromoCodeInput}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!appliedPromo}
                style={styles.promoField}
              />
              {appliedPromo ? (
                <Button
                  title="Remove"
                  variant="destructive"
                  size="md"
                  onPress={handleClearPromo}
                  style={styles.promoBtn}
                />
              ) : (
                <Button
                  title="Apply"
                  variant="secondary"
                  size="md"
                  loading={applyingPromo}
                  onPress={handleApplyPromo}
                  style={styles.promoBtn}
                />
              )}
            </View>
          </View>

          {/* Gift Option Card */}
          <View style={styles.card}>
            <View style={styles.giftSwitchRow}>
              <View style={styles.giftLabelCol}>
                <Text style={styles.cardTitle}>Send as a Gift</Text>
                <Text style={styles.giftSubtitle}>
                  Deliver ticket confirmation directly to another person
                </Text>
              </View>
              <Switch
                value={isGift}
                onValueChange={setIsGift}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text}
              />
            </View>

            {isGift ? (
              <View style={styles.giftFields}>
                <Input
                  label="Recipient Full Name"
                  placeholder="e.g. Fatima Bello"
                  value={recipientName}
                  onChangeText={setRecipientName}
                  autoCapitalize="words"
                />
                <Input
                  label="Recipient Email Address"
                  placeholder="fatima@example.com"
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Input
                  label="Gift Message (Optional)"
                  placeholder="Have an amazing time at the event!"
                  value={giftMessage}
                  onChangeText={setGiftMessage}
                  multiline
                  numberOfLines={3}
                />
              </View>
            ) : null}
          </View>

          {/* Custom Event Questions */}
          {checkoutQuestions.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Additional Information</Text>
              <Text style={styles.cardSubtitle}>
                The organizer has requested the following information for this event:
              </Text>
              {checkoutQuestions.map((q) => {
                const isRequired = q.required;
                const label = `${q.question_text}${isRequired ? ' *' : ''}`;
                const val = answers[q.id] || '';

                if (q.type === 'checkbox') {
                  const checked = Boolean(answers[q.id]);
                  return (
                    <View key={q.id} style={styles.questionCheckboxRow}>
                      <Switch
                        value={checked}
                        onValueChange={(newVal) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: newVal }))
                        }
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.text}
                      />
                      <Text style={styles.questionCheckboxLabel}>{label}</Text>
                    </View>
                  );
                }

                return (
                  <Input
                    key={q.id}
                    label={label}
                    placeholder={q.type === 'long_text' ? 'Type your response...' : 'Your answer'}
                    value={val}
                    onChangeText={(newVal) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: newVal }))
                    }
                    multiline={q.type === 'long_text'}
                    numberOfLines={q.type === 'long_text' ? 3 : 1}
                  />
                );
              })}
            </View>
          )}

          {/* Pay Button */}
          <Button
            title={
              finalTotalKobo === 0
                ? 'Claim Free Tickets'
                : `Pay with Paystack (${formatNaira(finalTotalKobo)})`
            }
            variant="primary"
            size="lg"
            loading={isProcessing}
            onPress={handleProceed}
            style={styles.payBtn}
          />

          <View style={styles.securityNote}>
            <ShieldCheck size={16} color={colors.textMuted} />
            <Text style={styles.securityText}>
              Payments processed securely via Paystack. Your ticket QR codes are delivered immediately.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Paystack In-App WebView Modal */}
      {paystackUrl ? (
        <Modal
          visible={Boolean(paystackUrl)}
          animationType="slide"
          onRequestClose={() => {
            Alert.alert(
              'Cancel Payment?',
              'Are you sure you want to cancel the checkout process?',
              [
                { text: 'Continue Payment', style: 'cancel' },
                {
                  text: 'Cancel',
                  style: 'destructive',
                  onPress: () => {
                    setPaystackUrl(null);
                    setIsProcessing(false);
                  },
                },
              ]
            );
          }}
        >
          <SafeAreaView style={styles.webViewHeader}>
            <TouchableOpacity
              style={styles.webViewCloseBtn}
              onPress={() => {
                setPaystackUrl(null);
                setIsProcessing(false);
              }}
            >
              <X size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.webViewHeaderTitle}>Paystack Secure Checkout</Text>
            <View style={{ width: 40 }} />
          </SafeAreaView>

          <WebView
            source={{ uri: paystackUrl }}
            onNavigationStateChange={(navState) => {
              const url = navState.url;
              // Intercept Paystack callbacks
              if (
                url.includes('checkout/verify') ||
                url.includes('trxref=') ||
                url.includes('reference=')
              ) {
                if (paymentReference) {
                  verifyPaymentAndFinish(paymentReference);
                }
              }
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.webViewLoadingText}>Loading Paystack Gateway...</Text>
              </View>
            )}
          />
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 12,
  },
  questionCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  questionCheckboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTierName: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryTierPrice: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  summaryTotalLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  summaryTotalValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  discountLabel: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '700',
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  finalTotalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  finalTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoField: {
    flex: 1,
    marginBottom: 0,
  },
  promoBtn: {
    height: 50,
    minWidth: 90,
  },
  giftSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftLabelCol: {
    flex: 1,
    marginRight: 12,
  },
  giftSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: -8,
  },
  giftFields: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payBtn: {
    marginTop: 8,
    marginBottom: 16,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  securityText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    flex: 1,
  },
  webViewHeader: {
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  webViewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewLoadingText: {
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
});
