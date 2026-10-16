import { Alert, Platform, Share } from 'react-native';

// react-native-web's Alert is a no-op, so web falls back to the browser's dialogs.

export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmText: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title));
  }
  return new Promise((resolve) =>
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: opts.confirmText, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

/** Native share sheet; on web, the Web Share API where available, otherwise copy to clipboard. */
export async function shareText(message: string) {
  if (Platform.OS !== 'web') {
    await Share.share({ message }).catch(() => {});
    return;
  }
  if (navigator.share) {
    await navigator.share({ text: message }).catch(() => {});
    return;
  }
  try {
    await navigator.clipboard.writeText(message);
    showMessage('Invite copied', message);
  } catch {
    showMessage('Share this invite', message);
  }
}
