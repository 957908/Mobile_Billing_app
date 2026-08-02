import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Linking, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme/theme';

type Props = { visible: boolean; onClose: () => void; onScan: (code: string) => void };

export function BarcodeScannerModal({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => { if (visible) setScanned(false); }, [visible]);

  const handleScanned = useCallback((r: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(r.data);
  }, [scanned, onScan]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        {permission?.granted ? (
          <>
            {Platform.OS === 'web' ? (
              <View style={styles.web}>
                <Ionicons name="qr-code" size={64} color={theme.color.muted} />
                <Text style={styles.title}>Scanner works on mobile devices</Text>
                <Text style={styles.subtitle}>Open in Expo Go or a deployed build to scan barcodes.</Text>
              </View>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={scanned ? undefined : handleScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'itf14'] }}
              />
            )}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>Align barcode within the frame</Text>
            </View>
          </>
        ) : (
          <View style={styles.web}>
            <Ionicons name="camera-outline" size={64} color={theme.color.muted} />
            <Text style={styles.title}>Camera permission needed</Text>
            <Text style={styles.subtitle}>Grant camera access to scan barcodes.</Text>
            {!permission?.canAskAgain ? (
              <Pressable style={styles.btn} onPress={() => Linking.openSettings()} testID="scanner-open-settings">
                <Text style={styles.btnText}>Open Settings</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.btn} onPress={requestPermission} testID="scanner-grant-permission">
                <Text style={styles.btnText}>Grant Permission</Text>
              </Pressable>
            )}
          </View>
        )}
        <Pressable style={styles.close} onPress={onClose} testID="close-scanner">
          <Ionicons name="close" size={28} color="#FFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 260, borderWidth: 3, borderColor: theme.color.brand, borderRadius: 20 },
  hint: { color: '#FFF', marginTop: 20, fontSize: 14 },
  close: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: '#111' },
  title: { color: '#FFF', fontSize: 18, fontWeight: '500', marginTop: 12 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  btn: { backgroundColor: theme.color.brand, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  btnText: { color: '#FFF', fontWeight: '500' },
});
