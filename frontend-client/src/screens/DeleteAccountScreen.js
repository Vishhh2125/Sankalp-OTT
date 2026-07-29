import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { useTheme } from '../context/ThemeContext';
import { deleteAccountUser } from '../redux/slices/authSlice';
import { showAlert } from '../services/alertService';

const REASON_OPTIONS = [
  'Not using the platform enough',
  'Found a better alternative',
  'Too expensive / membership cost',
  'Privacy or data concerns',
  'Course or content not relevant to me',
  'Technical issues / bugs',
  'Creating a new account',
  'Other',
];

export default function DeleteAccountScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme: appTheme } = useTheme();
  const styles = useStyles(appTheme);
  const dispatch = useDispatch();

  const plan = useSelector((state) => state.auth?.plan);
  const coins = useSelector((state) => state.auth?.coins);
  const memberships = useSelector((state) => state.auth?.memberships) || [];
  
  const isPaid = (plan && plan !== 'FREE') || memberships.length > 0;
  const hasCoins = coins && coins > 0;

  const [selectedReason, setSelectedReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const resultAction = await dispatch(
        deleteAccountUser({
          reason: selectedReason,
          feedback: feedback.trim() || undefined,
        })
      );

      if (deleteAccountUser.fulfilled.match(resultAction)) {
        showAlert(
          'Account Deleted',
          'Your account has been deleted successfully.',
          [{ text: 'OK' }]
        );
      } else {
        const errorMsg = resultAction.payload || 'Failed to delete account. Please try again.';
        showAlert('Error', errorMsg);
      }
    } catch (err) {
      showAlert('Error', err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: 16, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Warning Box */}
      <View style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <Ionicons name="warning-outline" size={24} color="#FF3B30" />
          <Text style={styles.warningTitle}>Delete Account Notice</Text>
        </View>
        <Text style={styles.warningText}>
          Deleting your account is permanent. All your personal profile information, watch history, bookmarks, and progress will be permanently erased.
        </Text>
        {(isPaid || hasCoins) && (
          <View style={styles.forfeitureCard}>
            <Ionicons name="alert-circle" size={18} color="#FF9500" />
            <Text style={styles.forfeitureText}>
              You currently have an active membership or unused coin balance ({coins ?? 0} coins). Deleting your account will permanently forfeit these items.
            </Text>
          </View>
        )}
      </View>

      {/* Mandatory Reason Dropdown / Radio Options */}
      <Text style={styles.sectionTitle}>
        Why are you deleting your account? <Text style={styles.requiredAsterisk}>*</Text>
      </Text>
      <View style={styles.reasonsContainer}>
        {REASON_OPTIONS.map((item) => {
          const isSelected = selectedReason === item;
          return (
            <Pressable
              key={item}
              style={[styles.reasonItem, isSelected && styles.reasonItemSelected]}
              onPress={() => setSelectedReason(item)}
            >
              <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                {isSelected && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Optional Feedback TextInput */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        Suggestions or Feedback <Text style={styles.optionalText}>(Optional)</Text>
      </Text>
      <TextInput
        style={styles.feedbackInput}
        placeholder="How can we improve? (Optional)"
        placeholderTextColor={appTheme.textMuted || '#777'}
        multiline
        numberOfLines={4}
        value={feedback}
        onChangeText={setFeedback}
      />

      {/* Action Button */}
      <Pressable
        style={({ pressed }) => [
          styles.deleteButton,
          !selectedReason && styles.deleteButtonDisabled,
          pressed && selectedReason && { opacity: 0.8 },
        ]}
        disabled={!selectedReason || isSubmitting}
        onPress={() => setShowConfirmModal(true)}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.deleteButtonText}>Delete My Account</Text>
        )}
      </Pressable>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBox}>
              <Ionicons name="trash" size={32} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete your account? This action cannot be undone.
            </Text>

            {(isPaid || hasCoins) && (
              <Text style={styles.modalWarningText}>
                ⚠️ Your active membership or unused coin balance will be permanently forfeited.
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.modalConfirmText}>Delete Account</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const useStyles = (appTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: appTheme.deepBlack,
    },
    container: {
      paddingHorizontal: 20,
    },
    warningCard: {
      backgroundColor: 'rgba(255, 59, 48, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 59, 48, 0.3)',
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
    },
    warningHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FF3B30',
    },
    warningText: {
      fontSize: 13,
      color: appTheme.text || '#eee',
      lineHeight: 18,
    },
    forfeitureCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: 'rgba(255, 149, 0, 0.12)',
      borderRadius: 8,
      padding: 10,
      marginTop: 12,
    },
    forfeitureText: {
      flex: 1,
      fontSize: 12,
      color: '#FF9500',
      lineHeight: 16,
      fontWeight: '500',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: appTheme.white,
      marginBottom: 12,
    },
    requiredAsterisk: {
      color: '#FF3B30',
    },
    optionalText: {
      fontSize: 12,
      color: appTheme.textMuted || '#888',
      fontWeight: '400',
    },
    reasonsContainer: {
      gap: 10,
    },
    reasonItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: appTheme.surface,
      borderWidth: 1,
      borderColor: appTheme.border || '#333',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    reasonItemSelected: {
      borderColor: '#FF3B30',
      backgroundColor: 'rgba(255, 59, 48, 0.06)',
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: appTheme.textMuted || '#777',
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioButtonSelected: {
      borderColor: '#FF3B30',
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#FF3B30',
    },
    reasonText: {
      fontSize: 14,
      color: appTheme.text,
      flex: 1,
    },
    reasonTextSelected: {
      color: '#FF3B30',
      fontWeight: '600',
    },
    feedbackInput: {
      backgroundColor: appTheme.surface,
      borderWidth: 1,
      borderColor: appTheme.border || '#333',
      borderRadius: 12,
      padding: 14,
      color: appTheme.text,
      fontSize: 14,
      textAlignVertical: 'top',
      minHeight: 100,
    },
    deleteButton: {
      backgroundColor: '#FF3B30',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
    },
    deleteButtonDisabled: {
      opacity: 0.45,
    },
    deleteButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    modalContent: {
      width: '100%',
      backgroundColor: appTheme.surface || '#1E1E24',
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: appTheme.border || '#333',
    },
    modalIconBox: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255, 59, 48, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: appTheme.white,
      marginBottom: 10,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 14,
      color: appTheme.textMuted || '#ccc',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 16,
    },
    modalWarningText: {
      fontSize: 12,
      color: '#FF9500',
      textAlign: 'center',
      marginBottom: 20,
      fontWeight: '500',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
    },
    modalCancelText: {
      color: appTheme.white,
      fontWeight: '600',
      fontSize: 15,
    },
    modalConfirmBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
    },
    modalConfirmText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 15,
    },
  });
