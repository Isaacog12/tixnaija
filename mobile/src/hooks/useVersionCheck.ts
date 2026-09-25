import { useState, useEffect } from 'react';
import * as Application from 'expo-application';
import { supabase } from '../../supabase/client';
import { Alert, Linking } from 'react-native';

export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);

  const checkVersion = async (manual = false) => {
    try {
      const currentVersion = Application.nativeApplicationVersion; // e.g. "1.0.0"
      if (!currentVersion) return;

      const { data, error } = await supabase
        .from('app_version')
        .select('version, apk_url')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        if (manual) Alert.alert("Error", "Could not check for updates.");
        return;
      }

      const remoteVersion = data.version;
      const currentParts = currentVersion.split('.').map(Number);
      const remoteParts = remoteVersion.split('.').map(Number);

      let isNewer = false;
      for (let i = 0; i < 3; i++) {
        const r = remoteParts[i] || 0;
        const c = currentParts[i] || 0;
        if (r > c) {
          isNewer = true;
          break;
        } else if (r < c) {
          break;
        }
      }

      if (isNewer) {
        setHasUpdate(true);
        setUpdateUrl(data.apk_url);
        if (manual) {
          Alert.alert(
            "Update Available", 
            `A new version (${remoteVersion}) is available.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Download", onPress: () => Linking.openURL(data.apk_url) }
            ]
          );
        }
      } else {
        if (manual) Alert.alert("Up to Date", "You are using the latest version.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkVersion();
  }, []);

  return { hasUpdate, updateUrl, checkVersion };
}
