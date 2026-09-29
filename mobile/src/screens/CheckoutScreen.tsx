import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../supabase/client';

export default function CheckoutScreen({ route, navigation }: any) {
  const { eventId, tickets, promoCodeId, totalAmount = 0 } = route.params || {};

  const [formVisible, setFormVisible] = useState(true);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  const [loadingText, setLoadingText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  
  const [orderId, setOrderId] = useState<string | null>(null);

  // Promo code states
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  
  const calculatedTotal = appliedPromo ? Math.max(0, totalAmount * (1 - (appliedPromo.discount_value / 100))) : totalAmount;

  // Prevent multiple verification loops
  const verifyStarted = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setBuyerEmail(session.user.email || '');
        setBuyerName(session.user.user_metadata?.full_name || '');
      }
    });
  }, []);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setIsApplyingPromo(true);
    
    try {
      const { data, error } = await (supabase
        .from('promo_codes' as any)
        .select('id, discount_value, expires_at') as any)
        .eq('event_id', eventId)
        .ilike('code', promoCodeInput.trim())
        .single();
        
      if (error || !data) {
        throw new Error('Invalid promo code');
      }
      
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error('Promo code expired');
      }
      
      setAppliedPromo(data);
      Alert.alert('Success', `Promo code applied! ${data.discount_value}% off.`);
    } catch (err: any) {
      Alert.alert('Invalid Code', err.message);
      setAppliedPromo(null);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleProceed = async () => {
    if (!buyerName || !buyerEmail) {
      Alert.alert('Validation Error', 'Please enter your full name and email address.');
      return;
    }
    
    setIsProcessing(true);
    setFormVisible(false);
    
    // Prepare the tickets payload with attendee data
    const enrichedTickets = tickets.map((t: any) => ({
       ...t,
       attendee_names: Array(t.count).fill(buyerName),
       attendee_emails: Array(t.count).fill(buyerEmail),
    }));

    if (totalAmount === 0) {
       // Free checkout
       try {
         setLoadingText('Securing free tickets...');
         const { data: { session } } = await supabase.auth.getSession();
         const userId = session?.user?.id || null;
         
         const { data, error } = await supabase.rpc('process_checkout', {
            p_event_id: eventId,
            p_user_id: (userId || null) as string,
            p_buyer_name: buyerName,
            p_buyer_email: buyerEmail,
            p_buyer_phone: (buyerPhone || null) as string,
            p_tickets: enrichedTickets,
            p_amount_paid: 0,
            p_payment_reference: `FREE_${Date.now()}_${Math.random().toString(36).substring(7)}`
         });
         
         if (error) throw error;
         
         // Trigger confirmation email silently
         supabase.functions.invoke('send-ticket-confirmation', { body: { orderId: data } }).catch(console.error);
         
         setOrderId(data as string);
       } catch (error: any) {
         setFailureReason(error.message);
         setPaymentFailed(true);
       } finally {
         setIsProcessing(false);
       }
       return;
    }
    
    // Paid checkout
    try {
      setLoadingText('Initializing payment...');
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        email: buyerEmail,
        amount: totalAmount / 100, // edge fn multiplies by 100
        metadata: {
          eventId,
          tickets: enrichedTickets,
          promoCodeId: appliedPromo ? appliedPromo.id : promoCodeId,
          userId: session?.user?.id || null,
          buyerName,
          buyerEmail,
          buyerPhone: buyerPhone || null
        }
      };

      const { data, error } = await supabase.functions.invoke('initialize-payment', {
        body: payload
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (!data?.authorization_url || !data?.reference) {
         throw new Error('Invalid response from payment server');
      }

      setReference(data.reference);
      setAuthorizationUrl(data.authorization_url);
    } catch (error: any) {
       setFailureReason(error.message);
       setPaymentFailed(true);
    } finally {
       setIsProcessing(false);
    }
  };

  const handleWebViewNavigation = (navState: any) => {
    const { url } = navState;
    if (url.includes('/checkout/verify') || url.includes('paystack.co/transaction/verify')) {
      if (!verifyStarted.current) {
        verifyStarted.current = true;
        setAuthorizationUrl(null); // Close WebView
        startVerificationPolling();
      }
    }
  };

  const startVerificationPolling = async () => {
    setIsVerifying(true);
    setLoadingText('Confirming payment...');
    
    let attempts = 0;
    const maxAttempts = 15;
    const delayMs = 3000;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { reference }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Success!
        if (data?.success && data?.order_id) {
          setOrderId(data.order_id);
          setIsVerifying(false);
          return;
        }
      } catch (error: any) {
        const msg = error.message?.toLowerCase() || "";
        
        if (attempts >= maxAttempts) {
           setFailureReason('Payment verification timed out. If you were charged, please contact support.');
           setPaymentFailed(true);
           setIsVerifying(false);
           return;
        }
        if (msg.includes('cancelled') || msg.includes('ended')) {
           setFailureReason(error.message);
           setPaymentFailed(true);
           setIsVerifying(false);
           return;
        }
      }
      await new Promise(res => setTimeout(res, delayMs));
    }
  };

  const cancelCheckout = () => {
    navigation.goBack();
  };

  if (orderId) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.successTitle}>Success!</Text>
        <Text style={styles.successText}>Your tickets have been secured.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('MyTickets')}>
          <Text style={styles.primaryBtnText}>View My Tickets</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (paymentFailed) {
    return (
      <View style={styles.containerCenter}>
        <Text style={[styles.successTitle, { color: '#e55a5a' }]}>Payment Failed</Text>
        <Text style={styles.successText}>{failureReason || 'We could not confirm your payment.'}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => {
           setPaymentFailed(false);
           setFailureReason(null);
           setFormVisible(true);
        }}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (authorizationUrl && !isVerifying) {
    return (
      <View style={{ flex: 1, backgroundColor: '#22201e', paddingTop: 100 }}>
        <WebView 
          source={{ uri: authorizationUrl }} 
          onNavigationStateChange={handleWebViewNavigation}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.absoluteLoading}>
               <ActivityIndicator size="large" color="#f2611e" />
            </View>
          )}
        />
      </View>
    );
  }

  if (formVisible) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Checkout Details</Text>
          <Text style={styles.subtitle}>Who are these tickets for?</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Nneka Okafor"
              placeholderTextColor="#767069"
              value={buyerName}
              onChangeText={setBuyerName}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. nneka@company.com"
              placeholderTextColor="#767069"
              keyboardType="email-address"
              autoCapitalize="none"
              value={buyerEmail}
              onChangeText={setBuyerEmail}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 08012345678"
              placeholderTextColor="#767069"
              keyboardType="phone-pad"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Promo Code</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Enter code"
                placeholderTextColor="#767069"
                autoCapitalize="characters"
                value={promoCodeInput}
                onChangeText={setPromoCodeInput}
                editable={!appliedPromo}
              />
              {!appliedPromo ? (
                <TouchableOpacity style={styles.applyBtn} onPress={handleApplyPromo} disabled={isApplyingPromo}>
                  {isApplyingPromo ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.applyBtnText}>Apply</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.clearBtn} onPress={() => { setAppliedPromo(null); setPromoCodeInput(''); }}>
                  <Text style={styles.applyBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.primaryBtn, { marginTop: 24 }]} 
            onPress={handleProceed}
          >
            <Text style={styles.primaryBtnText}>
              {calculatedTotal === 0 ? 'Claim Free Tickets' : `Proceed to Payment (₦${(calculatedTotal / 100).toLocaleString()})`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.containerCenter}>
      <ActivityIndicator size="large" color="#f2611e" />
      <Text style={styles.loadingText}>{loadingText}</Text>
      {isVerifying && (
        <Text style={styles.subLoadingText}>This may take up to 45 seconds...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
    paddingTop: 100,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  containerCenter: {
    flex: 1,
    backgroundColor: '#22201e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#c2bdb8',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#c2bdb8',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2e2a28',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 14,
    color: '#f4f2f0',
    fontSize: 16,
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  applyBtn: {
    backgroundColor: '#f2611e',
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtn: {
    backgroundColor: '#e55a5a',
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#22201e',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadingText: {
    color: '#c2bdb8',
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
  },
  subLoadingText: {
    color: '#767069',
    marginTop: 8,
    fontSize: 14,
  },
  absoluteLoading: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22201e'
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#c2bdb8',
    marginBottom: 32,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#f2611e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#22201e',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
