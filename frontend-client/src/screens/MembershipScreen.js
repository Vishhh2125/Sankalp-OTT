import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../constants/theme';
import { api } from '../services/api';

const BENEFITS = [
  {
    icon: 'play-circle-outline',
    title: 'Unlimited access to 8,000+ series',
    sub: '55+ fresh dramas every week',
  },
  { icon: 'download-outline', title: 'Download', sub: null },
  { icon: 'time-outline', title: 'Daily member points', sub: null },
  { icon: 'star-outline', title: 'Members-only dramas', sub: null },
  { icon: 'videocam-outline', title: '1080p quality', sub: null },
  {
    icon: 'gift-outline',
    title: 'Gift dramas to friends',
    sub: '3 times weekly',
  },
  {
    icon: 'people-outline',
    title: 'Gift a membership',
    sub: 'Once weekly',
  },
];

function useCountdown() {
  const [seconds, setSeconds] = useState(74097); // ~20:34:57

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function MembershipScreen() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const countdown = useCountdown();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/membership/plans');
      
      if (response.data?.success) {
        const fetchedPlans = response.data.data || [];
        setPlans(fetchedPlans);
        // Auto-select first plan
        if (fetchedPlans.length > 0) {
          setSelectedPlan(fetchedPlans[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
      setError('Failed to load membership plans');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price, currency) => {
    if (currency === 'INR') {
      return `₹${parseFloat(price).toFixed(2)}`;
    } else if (currency === 'USD') {
      return `$${parseFloat(price).toFixed(2)}`;
    }
    return `${price}`;
  };

  const getDurationLabel = (duration) => {
    const labels = {
      week: 'week',
      month: 'month',
      year: 'year',
    };
    return labels[duration] || duration;
  };

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.crimson} />
      </View>
    );
  }

  if (error || plans.length === 0) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.gray} />
        <Text style={{ color: theme.white, fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {error || 'No membership plans available'}
        </Text>
        <Pressable
          style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 30, backgroundColor: theme.crimson, borderRadius: 8 }}
          onPress={fetchPlans}
        >
          <Text style={{ color: theme.white, fontWeight: '600' }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
      >
        {/* Header Image Area */}
        <View style={styles.heroArea}>
          <View style={styles.heroGradient} />
          <Text style={styles.heroTitle}>Join Membership</Text>
        </View>

        {/* Plan Cards */}
        <View style={styles.plansSection}>
          {plans.map((plan) => (
            <Pressable
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardActive,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              <View style={styles.planLeft}>
                <View
                  style={[
                    styles.planRadio,
                    selectedPlan === plan.id && styles.planRadioActive,
                  ]}
                >
                  {selectedPlan === plan.id && (
                    <Ionicons name="checkmark" size={16} color={theme.white} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name} Membership</Text>
                  <Text style={styles.planPrice}>
                    {formatPrice(plan.price, plan.currency)} /{getDurationLabel(plan.duration)}
                  </Text>
                  {plan.duration === 'week' && (
                    <Text style={styles.planDetail}>
                      {formatPrice(plan.price, plan.currency)}/week for the first 3 weeks
                    </Text>
                  )}
                </View>
              </View>
              {selectedPlan === plan.id && plan.duration === 'week' && (
                <View style={styles.discountTag}>
                  <Text style={styles.discountTagText}>
                    Discount {countdown}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Why Join */}
        <Text style={styles.whyTitle}>Why Join?</Text>
        <View style={styles.benefitsList}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitItem}>
              <Ionicons
                name={b.icon}
                size={24}
                color={theme.crimson}
                style={styles.benefitIcon}
              />
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                {b.sub && (
                  <Text style={styles.benefitSub}>{b.sub}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Join Now Button (floating) */}
      <View style={styles.floatingBtnWrap}>
        <Pressable
          style={({ pressed }) => [
            styles.joinBtn,
            pressed && styles.joinBtnPressed,
          ]}
        >
          <Text style={styles.joinBtnText}>Join Now</Text>
          <Text style={styles.joinBtnSub}>
            Auto-renew · Cancel anytime
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.deepBlack,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingBottom: 20,
  },
  heroArea: {
    height: 160,
    backgroundColor: theme.border,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 0, 16, 0.6)',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.white,
    zIndex: 1,
  },
  plansSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  planCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardActive: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  planRadio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  planRadioActive: {
    borderColor: theme.crimson,
    backgroundColor: theme.crimson,
  },
  planName: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planPrice: {
    color: theme.white,
    fontSize: 18,
    fontWeight: '800',
  },
  planOldPrice: {
    color: theme.darkGray,
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  planDetail: {
    color: theme.gray,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  discountTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.crimson,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomLeftRadius: 10,
  },
  discountTagText: {
    color: theme.white,
    fontSize: 11,
    fontWeight: '700',
  },
  whyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.white,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 16,
  },
  benefitsList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  benefitIcon: {
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '600',
  },
  benefitSub: {
    color: theme.gray,
    fontSize: 13,
    marginTop: 2,
  },
  floatingBtnWrap: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  joinBtn: {
    backgroundColor: theme.crimson,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  joinBtnPressed: {
    opacity: 0.85,
  },
  joinBtnText: {
    color: theme.white,
    fontSize: 17,
    fontWeight: '800',
  },
  joinBtnSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
});
