import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { theme } from '../constants/theme';

const CustomAlertContext = createContext({
  showAlert: () => {},
  hideAlert: () => {},
});

let globalShowAlert = null;

/**
 * Global function to show custom alert anywhere in the app
 * Usage: customAlert("Title", "Message", [{ text: "OK", onPress: () => {} }])
 */
export const customAlert = (title, message, buttons) => {
  if (globalShowAlert) {
    globalShowAlert({ title, message, buttons });
  }
};

export const CustomAlertProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    buttons: [],
  });

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const showAlert = useCallback(({ title, message, buttons }) => {
    const formattedButtons =
      Array.isArray(buttons) && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' }];

    setAlertConfig({
      title: title || '',
      message: message || '',
      buttons: formattedButtons,
    });
    setVisible(true);
  }, []);

  globalShowAlert = showAlert;

  const handleButtonPress = (btn) => {
    hideAlert();
    if (typeof btn.onPress === 'function') {
      // Delay callback slightly so modal dismisses smoothly
      setTimeout(() => {
        btn.onPress();
      }, 100);
    }
  };

  return (
    <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <TouchableWithoutFeedback onPress={hideAlert}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.card}>
                {alertConfig.title ? (
                  <Text style={styles.title}>{alertConfig.title}</Text>
                ) : null}
                {alertConfig.message ? (
                  <Text style={styles.message}>{alertConfig.message}</Text>
                ) : null}

                <View style={styles.buttonRow}>
                  {alertConfig.buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    return (
                      <TouchableOpacity
                        key={index}
                        activeOpacity={0.8}
                        style={[
                          styles.button,
                          isCancel ? styles.buttonCancel : styles.buttonPrimary,
                        ]}
                        onPress={() => handleButtonPress(btn)}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isCancel ? styles.buttonTextCancel : styles.buttonTextPrimary,
                          ]}
                        >
                          {btn.text || 'OK'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </CustomAlertContext.Provider>
  );
};

export const useCustomAlert = () => useContext(CustomAlertContext);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1b1424',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    color: theme.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    color: '#b0a8ba',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  buttonPrimary: {
    backgroundColor: theme.crimson,
  },
  buttonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: theme.white,
  },
  buttonTextCancel: {
    color: theme.gray,
  },
});
