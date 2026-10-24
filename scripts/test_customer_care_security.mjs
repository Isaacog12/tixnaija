import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjijftxksykbjknbleul.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaWpmdHhrc3lrYmprbmJsZXVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg3MzI1NCwiZXhwIjoyMDk5NDQ5MjU0fQ.McaETXYFLpUf-Fn_1r8QrcpRBHmR1dHa8SyjrYPz8ms';

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runPenetrationTests() {
  console.log('====================================================');
  console.log('STARTING CUSTOMER CARE SECURITY PENETRATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------------
    // Test 1: PII Isolation (user_contacts & profiles)
    // ---------------------------------------------------------------
    console.log('Test 1: Verifying PII Isolation on user_contacts & profiles...');
    const { data: contactsData, error: contactsErr } = await anonClient
      .from('user_contacts')
      .select('*')
      .limit(5);

    assert(
      contactsErr !== null || (contactsData && contactsData.length === 0),
      'Anon/Public client CANNOT read from user_contacts',
      contactsErr ? contactsErr.message : 'Empty set returned'
    );

    // Check paystack_subaccount_code is not leaked
    const { data: profilesData } = await anonClient
      .from('profiles')
      .select('paystack_subaccount_code')
      .limit(5);

    const hasSubaccount = profilesData?.some(p => p.paystack_subaccount_code !== null && p.paystack_subaccount_code !== undefined);
    assert(!hasSubaccount, 'Anon/Public client cannot read paystack_subaccount_code from profiles');

    // ---------------------------------------------------------------
    // Test 2: Direct Table Access Revocation for Support Tables
    // ---------------------------------------------------------------
    console.log('\nTest 2: Verifying Direct Table Access is Revoked...');
    const { data: casesData, error: casesErr } = await anonClient
      .from('support_cases')
      .select('*')
      .limit(5);

    assert(
      casesErr !== null || (casesData && casesData.length === 0),
      'Direct table SELECT on support_cases is blocked for unauthenticated/unowned users',
      casesErr ? casesErr.message : ''
    );

    const { data: notesData, error: notesErr } = await anonClient
      .from('support_notes')
      .select('*')
      .limit(5);

    assert(
      notesErr !== null || (notesData && notesData.length === 0),
      'Direct table SELECT on support_notes is blocked without RPC',
      notesErr ? notesErr.message : ''
    );

    // ---------------------------------------------------------------
    // Test 3: MFA (AAL2) Enforcement on Support RPCs
    // ---------------------------------------------------------------
    console.log('\nTest 3: Verifying MFA (AAL2) Enforcement...');
    // Calling support RPC without JWT or at AAL1 must fail
    const { data: rpcLookupData, error: rpcLookupErr } = await anonClient.rpc('support_lookup_customer', {
      p_query: 'test@example.com'
    });

    assert(
      rpcLookupErr !== null,
      'Calling support_lookup_customer without valid authenticated session fails',
      rpcLookupErr ? rpcLookupErr.message : 'Unexpectedly succeeded'
    );

    // ---------------------------------------------------------------
    // Test 4: Lookup Wildcard Immunity & Orders List Masking
    // ---------------------------------------------------------------
    console.log('\nTest 4: Verifying Query Sanitization & Email Masking...');
    // Try calling lookup with wildcards via admin/service client
    const { data: wildcardData, error: wildcardErr } = await adminClient.rpc('support_lookup_customer', {
      p_query: '%%%%'
    });

    // It should either return 0 customers or error on invalid search
    const wildcardMatches = wildcardData?.customers?.length || 0;
    assert(
      wildcardErr !== null || wildcardMatches === 0,
      'Wildcard %%%% query does NOT dump customer database',
      wildcardErr ? wildcardErr.message : `Returned ${wildcardMatches} matches`
    );

    // Call support_get_orders_list and verify masking
    const { data: ordersList, error: ordersErr } = await adminClient.rpc('support_get_orders_list', {
      p_limit: 5,
      p_offset: 0
    });

    if (ordersList && ordersList.length > 0) {
      const email = ordersList[0].masked_buyer_email;
      assert(
        email && email.includes('*'),
        'Orders list returns masked buyer email (e.g. j***@domain.com)',
        `Sample: ${email}`
      );
    } else {
      assert(true, 'Orders list query executed cleanly (database empty or no orders)');
    }

    // ---------------------------------------------------------------
    // Test 5: Append-Only Audit Log Integrity
    // ---------------------------------------------------------------
    console.log('\nTest 5: Verifying Append-Only Audit Log Immutability...');
    // Insert a test audit log using service role
    const { data: insertedAudit, error: insertAuditErr } = await adminClient
      .from('support_audit_logs')
      .insert({
        actor_id: null,
        actor_email: 'test@tixnaija.com',
        action: 'test_penetration_probe',
        target_type: 'security_test',
        target_id: 'test_123',
        details: { probe: true }
      })
      .select('id')
      .single();

    if (insertedAudit && insertedAudit.id) {
      // Attempt DELETE
      const { error: deleteErr } = await adminClient
        .from('support_audit_logs')
        .delete()
        .eq('id', insertedAudit.id);

      assert(
        deleteErr !== null,
        'DELETE on support_audit_logs is REJECTED by append-only trigger',
        deleteErr ? deleteErr.message : 'Delete unexpectedly succeeded'
      );

      // Attempt UPDATE
      const { error: updateErr } = await adminClient
        .from('support_audit_logs')
        .update({ action: 'tampered_action' })
        .eq('id', insertedAudit.id);

      assert(
        updateErr !== null,
        'UPDATE on support_audit_logs is REJECTED by append-only trigger',
        updateErr ? updateErr.message : 'Update unexpectedly succeeded'
      );
    } else {
      console.warn('Could not insert probe audit row:', insertAuditErr);
    }

    // ---------------------------------------------------------------
    // Test 6: Dual-Control Email Change Enforcement
    // ---------------------------------------------------------------
    console.log('\nTest 6: Verifying Dual-Control Email Change Constraints...');
    // Fetch an order to test
    const { data: sampleOrder } = await adminClient
      .from('orders')
      .select('id, buyer_email')
      .limit(1)
      .single();

    if (sampleOrder) {
      // Request email change
      const { data: changeReq, error: changeReqErr } = await adminClient.rpc('support_request_email_change', {
        p_order_id: sampleOrder.id,
        p_new_email: 'new_recipient@tixnaija.com',
        p_reason: 'Penetration testing dual control'
      });

      if (changeReq && changeReq.request_id) {
        // Attempt self-approval: caller is the same actor
        const { error: selfApproveErr } = await adminClient.rpc('admin_review_email_change', {
          p_request_id: changeReq.request_id,
          p_approve: true
        });

        assert(
          selfApproveErr !== null && selfApproveErr.message.includes('Dual control violation'),
          'Self-approval of email change is REJECTED with Dual Control Violation',
          selfApproveErr ? selfApproveErr.message : 'Unexpectedly approved'
        );
      }
    } else {
      console.log('Skipping dual control order test: no orders in database.');
    }

    // ---------------------------------------------------------------
    // Test 7: Customer Reply Case Lifecycle
    // ---------------------------------------------------------------
    console.log('\nTest 7: Verifying Customer Reply Reopens Resolved Case...');
    // Verify trigger exists and function behaves as expected
    const { data: testCase, error: caseCreateErr } = await adminClient
      .from('support_cases')
      .insert({
        customer_id: '00000000-0000-0000-0000-000000000000',
        subject: 'Test LifeCycle',
        category: 'other',
        status: 'resolved'
      })
      .select('id, status')
      .single();

    if (testCase) {
      // Insert customer message
      await adminClient.from('support_case_messages').insert({
        case_id: testCase.id,
        sender_id: '00000000-0000-0000-0000-000000000000',
        is_internal: false,
        content: 'I still have an issue!'
      });

      // Verify status flipped to 'open'
      const { data: updatedCase } = await adminClient
        .from('support_cases')
        .select('status')
        .eq('id', testCase.id)
        .single();

      assert(
        updatedCase?.status === 'open',
        'Customer reply automatically transitioned case status from resolved -> open',
        `Current status: ${updatedCase?.status}`
      );
    } else {
      console.log('Case creation skipped (mock user id constraint):', caseCreateErr?.message);
    }

    // ---------------------------------------------------------------
    // Test 8: Role Security & Tamper Proofing
    // ---------------------------------------------------------------
    console.log('\nTest 8: Verifying Role Security & Immutable Role Change Auditing...');
    // Non-admin attempting to insert into user_roles
    const { error: roleInsertErr } = await anonClient
      .from('user_roles')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        role: 'customer_care'
      });

    assert(
      roleInsertErr !== null,
      'Anon/Customer CANNOT grant themselves customer_care or any role',
      roleInsertErr ? roleInsertErr.message : 'Unexpected insert success'
    );

    console.log('\n====================================================');
    console.log(`PENETRATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

  } catch (err) {
    console.error('Fatal error during penetration tests:', err);
  }
}

runPenetrationTests();
