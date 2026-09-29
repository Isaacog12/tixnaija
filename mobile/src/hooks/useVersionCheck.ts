import { useState, useEffect } from 'react';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);

  const checkVersion = async (manual = false) => {
    try {
      if (__DEV__) {
        if (manual) Alert.alert("Dev Mode", "OTA updates don't run in development mode.");
        return;
      }

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setHasUpdate(true);
        if (manual) {
          Alert.alert(
            "Update Available", 
            "A new version of the app is available. Would you like to install it now?",
            [
              { text: "Later", style: "cancel" },
              { 
                text: "Install & Restart", 
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (e) {
                    Alert.alert("Error", "Failed to install update.");
                  }
                } 
              }
            ]
          );
        }
      } else {
        if (manual) {
          Alert.alert("Up to Date", "You are using the latest version.");
        }
      }
    } catch (err) {
      console.error("Update check failed:", err);
      if (manual) {
        Alert.alert("Error", "Could not check for updates right now.");
      }
    }
  };

  useEffect(() => {
    // Silently check for updates on startup
    checkVersion(false);
  }, []);

  return { hasUpdate, checkVersion };
}
