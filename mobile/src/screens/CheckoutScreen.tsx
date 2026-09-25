import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../supabase/client';

export default function CheckoutScreen({ route, navigation }: any) {
  const { eventId, tickets, promoCodeId } = route.params || {};

  const [loadingText, setLoadingText] = useState('Initializing checkout...');
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  
  const [orderId, setOrderId] = useState<string | null>(null);

  // Prevent multiple verification loops
  const verifyStarted = useRef(false);

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const payload = {
        email: session.user.email,
        metadata: {
          eventId,
          tickets,
          promoCodeId,
          userId: session.user.id,
          buyerName: session.user.user_metadata?.full_name || 'Guest',
          buyerEmail: session.user.email,
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
      Alert.alert('Checkout Error', error.message, [
        { text: 'Go Back', onPress: () => navigation.goBack() }
      ]);
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
    const maxAttempts = 15; // 15 attempts * 3 seconds = 45 seconds total
    const delayMs = 3000;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { reference }
        });

        if (error) throw error;
        
        // Edge function returns { error: ... } if verification logic failed
        if (data?.error) {
           throw new Error(data.error);
        }

        // Success!
        if (data?.success && data?.order_id) {
          setOrderId(data.order_id);
          setIsVerifying(false);
          return;
        }

      } catch (error: any) {
        // If it throws "Payment verification failed" (meaning Paystack hasn't marked it success yet),
        // we swallow it and try again unless we've hit max attempts.
        const msg = error.message?.toLowerCase() || "";
        
        if (attempts >= maxAttempts) {
           setFailureReason('Payment verification timed out. If you were charged, please contact support.');
           setPaymentFailed(true);
           setIsVerifying(false);
           return;
        }

        // If it's a fatal error (like event cancelled), we don't need to retry
        if (msg.includes('cancelled') || msg.includes('ended')) {
           setFailureReason(error.message);
           setPaymentFailed(true);
           setIsVerifying(false);
           return;
        }
      }
      
      // Wait before next attempt
      await new Promise(res => setTimeout(res, delayMs));
    }
  };

  const cancelCheckout = () => {
    // If the user clicks close on the WebView manually
    navigation.goBack();
  };

  if (orderId) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.successTitle}>Payment Successful!</Text>
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
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (authorizationUrl && !isVerifying) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#22201e' }}>
        <View style={styles.webviewHeader}>
          <TouchableOpacity onPress={cancelCheckout} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel Checkout</Text>
          </TouchableOpacity>
        </View>
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
      </SafeAreaView>
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
  containerCenter: {
    flex: 1,
    backgroundColor: '#22201e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    backgroundColor: '#22201e',
    borderBottomWidth: 1,
    borderBottomColor: '#403b38',
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    color: '#e55a5a',
    fontWeight: 'bold',
    fontSize: 16,
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
