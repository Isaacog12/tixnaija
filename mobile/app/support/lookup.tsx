import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
  Search,
  Mail,
  Phone,
  ShoppingBag,
  Ticket,
  Send,
  User,
  CheckCircle2,
  AlertCircle,
  Copy,
  Calendar,
  ExternalLink,
  Edit2,
  Clock,
  ShieldCheck,
  ChevronRight,
  BookOpen,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { formatNairaKobo } from '../../src/utils/currency';

interface CustomerRecord {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  created_at: string;
}

interface OrderRecord {
  id: string;
  event_id: string;
  event_title?: string;
  payment_reference: string;
  buyer_name: string;
  buyer_email: string;
  total_kobo: number;
  status: string;
  created_at: string;
}

interface TicketRecord {
  id: string;
  event_title?: string;
  masked_code: string;
  status: string;
  attendee_name: string;
  attendee_email: string;
  order_id: string;
}

interface LookupResult {
  customers: CustomerRecord[];
  orders: OrderRecord[];
  tickets: TicketRecord[];
}

export default function SupportLookupScreen() {
  const router = useRouter();
  const { isStaff, isAdmin } = useAuth();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<LookupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Resend Email State
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  // Edit Attendee Modal State
  const [editingTicket, setEditingTicket] = useState<TicketRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingAttendee, setIsSavingAttendee] = useState(false);

  // Canned Macros Modal State
  const [isMacrosOpen, setIsMacrosOpen] = useState(false);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      Alert.alert('Query Too Short', 'Please enter at least 3 characters to search.');
      return;
    }

    setIsSearching(true);
    setErrorMsg('');
    try {
      const { data, error } = await (supabase.rpc as any)('support_lookup_customer', {
        p_query: trimmed,
      });

      if (error) throw error;
      setResults(data as LookupResult);
    } catch (err: any) {
      console.warn('[SupportLookup] Error:', err);
      setErrorMsg(err.message || 'Lookup failed. Please check rate limits.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  // Trigger Ticket Resend
  const handleResendTickets = (order: OrderRecord) => {
    Alert.alert(
      'Resend Tickets',
      `Dispatch fresh confirmation email with QR codes to ${order.buyer_email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            setResendingOrderId(order.id);
            try {
              // 1. Record support resend in database
              try {
                await (supabase.rpc as any)('support_resend_ticket_email', {
                  p_order_id: order.id,
                });
              } catch (rpcErr) {
                console.warn('[SupportLookup] support_resend_ticket_email note:', rpcErr);
              }

              // 2. Invoke Edge Function to trigger ZeptoMail
              const { error: invokeErr } = await supabase.functions.invoke(
                'send-ticket-confirmation',
                {
                  body: { orderId: order.id },
                }
              );

              if (invokeErr) throw invokeErr;

              Alert.alert('Dispatched', `Tickets sent successfully to ${order.buyer_email}.`);
            } catch (err: any) {
              Alert.alert('Resend Failed', err.message || 'Could not send confirmation email.');
            } finally {
              setResendingOrderId(null);
            }
          },
        },
      ]
    );
  };

  // Open Edit Attendee Modal
  const handleOpenEditAttendee = (ticket: TicketRecord) => {
    setEditingTicket(ticket);
    setEditName(ticket.attendee_name || '');
    setEditEmail(ticket.attendee_email || '');
  };

  // Save Attendee Corrections
  const handleSaveAttendeeCorrection = async () => {
    if (!editingTicket) return;
    setIsSavingAttendee(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          attendee_name: editName.trim() || editingTicket.attendee_name,
          attendee_email: editEmail.trim() || editingTicket.attendee_email,
        })
        .eq('id', editingTicket.id);

      if (error) {
        // Fallback to update_ticket_attendee RPC if direct update fails
        const { error: rpcError } = await (supabase.rpc as any)('update_ticket_attendee', {
          p_ticket_id: editingTicket.id,
          p_attendee_name: editName.trim(),
          p_attendee_email: editEmail.trim(),
        });
        if (rpcError) throw rpcError;
      }

      Alert.alert('Updated', 'Attendee details corrected successfully.');
      setEditingTicket(null);
      handleSearch(); // Refresh search results
    } catch (err: any) {
      Alert.alert('Correction Failed', err.message || 'Could not update attendee info.');
    } finally {
      setIsSavingAttendee(false);
    }
  };

  if (!isStaff && !isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Restricted" showBack />
        <View style={styles.centered}>
          <AlertCircle size={48} color={colors.error} />
          <Text style={styles.emptyTitle}>Support Authorization Required</Text>
          <Text style={styles.emptySubtitle}>
            Only customer care personnel and platform admins can access this lookup tool.
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const hasResults =
    results &&
    (results.orders?.length > 0 ||
      results.tickets?.length > 0 ||
      results.customers?.length > 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Customer Care Lookup"
        showBack
        rightAction={
          <TouchableOpacity
            style={styles.macrosBtn}
            onPress={() => setIsMacrosOpen(true)}
            activeOpacity={0.8}
          >
            <BookOpen size={16} color="#38bdf8" />
            <Text style={styles.macrosBtnText}>Macros</Text>
          </TouchableOpacity>
        }
      />

      {/* Search Input Box */}
      <View style={styles.searchCard}>
        <Text style={styles.searchInstructions}>
          Search buyer email, phone number (+234...), Paystack reference, or ticket UUID.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. buyer@gmail.com, 08012345678, TIX-..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={isSearching}
            activeOpacity={0.8}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Search size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Empty Search Prompt */}
        {!results && !isSearching && (
          <View style={styles.emptyContainer}>
            <Search size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Universal Staff Directory</Text>
            <Text style={styles.emptySubtitle}>
              Quickly resolve customer inquiries, verify ticket legitimacy, or re-dispatch emails to attendees.
            </Text>
          </View>
        )}

        {/* No Results Found */}
        {results && !hasResults && !isSearching && (
          <View style={styles.emptyContainer}>
            <AlertCircle size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No matching records found</Text>
            <Text style={styles.emptySubtitle}>
              No orders, tickets, or user profiles matched "{query}".
            </Text>
          </View>
        )}

        {/* Matching Orders */}
        {results?.orders && results.orders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <ShoppingBag size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>
                Matching Orders ({results.orders.length})
              </Text>
            </View>

            {results.orders.map((order) => {
              const isPaid = order.status === 'paid';
              const isResending = resendingOrderId === order.id;

              return (
                <View key={order.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{order.event_title || 'TixNaija Event'}</Text>
                      <TouchableOpacity
                        onPress={() => handleCopy(order.payment_reference, 'Payment Reference')}
                        style={styles.refRow}
                      >
                        <Text style={styles.refText}>{order.payment_reference}</Text>
                        <Copy size={12} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        isPaid ? styles.statusPillPaid : styles.statusPillPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isPaid ? styles.statusPillTextPaid : styles.statusPillTextPending,
                        ]}
                      >
                        {order.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoRow}>
                      <User size={14} color={colors.textMuted} />
                      <Text style={styles.infoLabel}>Buyer:</Text>
                      <Text style={styles.infoValue}>{order.buyer_name}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Mail size={14} color={colors.textMuted} />
                      <Text style={styles.infoLabel}>Email:</Text>
                      <Text style={styles.infoValue}>{order.buyer_email}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Calendar size={14} color={colors.textMuted} />
                      <Text style={styles.infoLabel}>Amount:</Text>
                      <Text style={[styles.infoValue, { fontWeight: 'bold' }]}>
                        {formatNairaKobo(order.total_kobo)}
                      </Text>
                    </View>
                  </View>

                  {/* Actions for this order */}
                  <View style={styles.orderActions}>
                    <TouchableOpacity
                      style={styles.resendBtn}
                      onPress={() => handleResendTickets(order)}
                      disabled={isResending}
                      activeOpacity={0.8}
                    >
                      {isResending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Send size={14} color="#fff" />
                          <Text style={styles.resendBtnText}>Resend Ticket Confirmation</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Matching Tickets */}
        {results?.tickets && results.tickets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ticket size={18} color="#38bdf8" />
              <Text style={styles.sectionTitle}>
                Matching Tickets ({results.tickets.length})
              </Text>
            </View>

            {results.tickets.map((t) => {
              const isCheckedIn = t.status === 'checked_in';
              const isValid = t.status === 'valid';

              return (
                <View key={t.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{t.event_title || 'TixNaija Event'}</Text>
                      <Text style={styles.codeText}>{t.masked_code}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        isCheckedIn
                          ? styles.statusPillChecked
                          : isValid
                          ? styles.statusPillValid
                          : styles.statusPillPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isCheckedIn
                            ? styles.statusPillTextChecked
                            : isValid
                            ? styles.statusPillTextValid
                            : styles.statusPillTextPending,
                        ]}
                      >
                        {t.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoRow}>
                      <User size={14} color={colors.textMuted} />
                      <Text style={styles.infoLabel}>Attendee:</Text>
                      <Text style={styles.infoValue}>{t.attendee_name || 'Unassigned'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Mail size={14} color={colors.textMuted} />
                      <Text style={styles.infoLabel}>Email:</Text>
                      <Text style={styles.infoValue}>{t.attendee_email || 'Unassigned'}</Text>
                    </View>
                  </View>

                  <View style={styles.ticketActions}>
                    <TouchableOpacity
                      style={styles.editAttendeeBtn}
                      onPress={() => handleOpenEditAttendee(t)}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={13} color={colors.primary} />
                      <Text style={styles.editAttendeeBtnText}>Correct Misspelled Info</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Matching Customers */}
        {results?.customers && results.customers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <User size={18} color="#a855f7" />
              <Text style={styles.sectionTitle}>
                Matching Customers ({results.customers.length})
              </Text>
            </View>

            {results.customers.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>{c.full_name || 'TixNaija Member'}</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoRow}>
                    <Mail size={14} color={colors.textMuted} />
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>{c.email}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Phone size={14} color={colors.textMuted} />
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{c.phone_number || 'None provided'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Attendee Modal */}
      <Modal
        visible={Boolean(editingTicket)}
        animationType="fade"
        transparent
        onRequestClose={() => setEditingTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Correct Attendee Info</Text>
            <Text style={styles.modalSubtitle}>
              Update attendee name or email for ticket {editingTicket?.masked_code}
            </Text>

            <Text style={styles.modalInputLabel}>Attendee Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Oluwaseun Adeleke"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.modalInputLabel}>Attendee Email</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="e.g. seun@gmail.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalButtonRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEditingTicket(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Changes"
                variant="primary"
                loading={isSavingAttendee}
                onPress={handleSaveAttendeeCorrection}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Canned Macros Sheet */}
      <Modal
        visible={isMacrosOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsMacrosOpen(false)}
      >
        <View style={styles.macrosOverlay}>
          <View style={styles.macrosSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.macrosTitle}>Canned Customer Care Responses</Text>
            <Text style={styles.macrosSubtitle}>
              Tap to copy standard Nigerian ticketing templates to clipboard.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Macro 1 */}
              <TouchableOpacity
                style={styles.macroCard}
                onPress={() =>
                  handleCopy(
                    `Hello,\n\nWe have re-dispatched your ticket confirmation with the QR codes directly to your registered email address. Please allow 1 to 2 minutes for delivery and be sure to check your Spam or Promotions folder.\n\nBest regards,\nTixNaija Support Team`,
                    'Resend confirmation template'
                  )
                }
              >
                <Text style={styles.macroCardTitle}>Ticket Resend & Spam Folder</Text>
                <Text style={styles.macroCardBody} numberOfLines={2}>
                  Hello, We have re-dispatched your ticket confirmation with the QR codes directly to your registered email...
                </Text>
              </TouchableOpacity>

              {/* Macro 2 */}
              <TouchableOpacity
                style={styles.macroCard}
                onPress={() =>
                  handleCopy(
                    `Hello,\n\nBank transfer transactions on Paystack can occasionally experience a 2 to 10 minute settlement delay between your financial institution and the payment gateway. Once Paystack validates payment completion, your tickets are generated immediately.\n\nIf the amount was debited and more than 15 minutes have passed, please reply with your bank transfer transaction session ID so we can reconcile your order.\n\nBest regards,\nTixNaija Support Team`,
                    'Bank transfer clearing template'
                  )
                }
              >
                <Text style={styles.macroCardTitle}>Paystack Bank Transfer Delay</Text>
                <Text style={styles.macroCardBody} numberOfLines={2}>
                  Bank transfer transactions on Paystack can occasionally experience a 2 to 10 minute settlement delay...
                </Text>
              </TouchableOpacity>

              {/* Macro 3 */}
              <TouchableOpacity
                style={styles.macroCard}
                onPress={() =>
                  handleCopy(
                    `Hello,\n\nTickets purchased on TixNaija are subject to the event organizer's stated refund policy. If an event has been postponed or cancelled by the organizer, automated refunds are issued back to your original source of payment within 3-5 business days.\n\nBest regards,\nTixNaija Support Team`,
                    'Refund policy template'
                  )
                }
              >
                <Text style={styles.macroCardTitle}>Event Postponement & Refunds</Text>
                <Text style={styles.macroCardBody} numberOfLines={2}>
                  Tickets purchased on TixNaija are subject to the event organizer's stated refund policy...
                </Text>
              </TouchableOpacity>

              <Button
                title="Close"
                variant="outline"
                onPress={() => setIsMacrosOpen(false)}
                style={{ marginTop: 12, marginBottom: 20 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  macrosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  macrosBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  searchCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInstructions: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
  },
  searchButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 90, 90, 0.15)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  refText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  codeText: {
    fontSize: 12,
    color: '#38bdf8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillPaid: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
  },
  statusPillPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillValid: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
  },
  statusPillChecked: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  statusPillTextPaid: {
    color: colors.success,
  },
  statusPillTextPending: {
    color: '#f59e0b',
  },
  statusPillTextValid: {
    color: colors.success,
  },
  statusPillTextChecked: {
    color: '#38bdf8',
  },
  infoGrid: {
    gap: 6,
    marginVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    width: 60,
  },
  infoValue: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  orderActions: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    gap: 6,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  ticketActions: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editAttendeeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 97, 30, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  editAttendeeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: colors.text,
    fontSize: 13,
    marginBottom: 14,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  // Macros
  macrosOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  macrosSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  macrosTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  macrosSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  macroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  macroCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: 4,
  },
  macroCardBody: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
});
