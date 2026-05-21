import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemeContext } from '../ThemeContext';

export default function SettingsScreen() {
  const { themeMode, updateTheme, colors } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [barbells, setBarbells] = useState([]);
  const [plates, setPlates] = useState([]);
  
  const [restSets, setRestSets] = useState('90');
  const [restExercises, setRestExercises] = useState('120');

  const [isCreatingBarbell, setIsCreatingBarbell] = useState(false);
  const [editingBarbellId, setEditingBarbellId] = useState(null);
  const [barbellName, setBarbellName] = useState('');
  const [barbellWeight, setBarbellWeight] = useState('');

  const [isCreatingPlate, setIsCreatingPlate] = useState(false);
  const [editingPlateId, setEditingPlateId] = useState(null);
  const [plateWeight, setPlateWeight] = useState('');
  const [plateCount, setPlateCount] = useState('');

  const [reminderNote, setReminderNote] = useState("");


  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');

  const defaultNote = "Kalorie: 2500 kcal dziennie.\nBiałko: 160 g (klucz do budowy klatki i ramion).\nTłuszcze: 70 g\nWęglowodany: ok. 300 g (z priorytetem w posiłkach okołotreningowych)\n\nSuplementy:\nKreatyna (5 g dziennie), tran, rutinoscorbin oraz odżywka białkowa według potrzeb\n\n1.5h przed treningiem:\nok. 60-80 g węglowodanów (np. 80 g ryżu/makaronu + chude mięso).\n\n30 min po treningu:\nOdżywka białkowa + banan.\n\nKolacja po treningu:\n100 g węglowodanów (np. solidna porcja ziemniaków lub kaszy) i 40-50 g białka.\n\nSen: 6.5-7 godzin";

  useFocusEffect(
    useCallback(() => {
      const loadNote = async () => {
        const savedNote = await AsyncStorage.getItem('reminderNote');
        if (savedNote) {
          setReminderNote(savedNote);
        } else {
          setReminderNote(defaultNote);
        }
      };
      loadNote();
    }, [])
  );

  const saveReminderNote = async () => {
    await AsyncStorage.setItem('reminderNote', reminderNote);
    Alert.alert("Zapisano", "Twoja przypominajka została zaktualizowana!");
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const b = await AsyncStorage.getItem('barbells');
      const p = await AsyncStorage.getItem('plates');
      const rs = await AsyncStorage.getItem('restSets');
      const re = await AsyncStorage.getItem('restExercises');
      
      if (b) setBarbells(JSON.parse(b));
      if (p) setPlates(JSON.parse(p));
      if (rs) setRestSets(rs);
      if (re) setRestExercises(re);
    } catch (error) {
      console.log("Błąd ładowania ustawień", error);
    }
  };

  const saveSettings = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (error) {
      console.log("Błąd zapisu ustawień", error);
    }
  };

  const handleSaveTimes = () => {
    saveSettings('restSets', restSets);
    saveSettings('restExercises', restExercises);
    Alert.alert("Zapisano", "Czasy przerw zostały zaktualizowane!");
  };

  
  const saveBarbell = () => {
    if (barbellName.trim() === '' || barbellWeight.trim() === '') {
      Alert.alert("Błąd", "Wprowadź nazwę i wagę sztangi!");
      return;
    }
    const newBarbell = {
      id: editingBarbellId ? editingBarbellId : Date.now().toString(),
      name: barbellName,
      weight: barbellWeight.replace(',', '.')
    };

    let updatedBarbells;
    if (editingBarbellId) {
      updatedBarbells = barbells.map(b => b.id === editingBarbellId ? newBarbell : b);
    } else {
      updatedBarbells = [...barbells, newBarbell];
    }

    setBarbells(updatedBarbells);
    saveSettings('barbells', updatedBarbells);
    cancelBarbellForm();
  };

  const editBarbell = (b) => {
    setEditingBarbellId(b.id);
    setBarbellName(b.name);
    setBarbellWeight(b.weight.toString());
    setIsCreatingBarbell(true);
  };

  const deleteBarbell = (id) => {
    Alert.alert("Usuń", "Na pewno chcesz usunąć tę sztangę?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: () => {
        const updated = barbells.filter(b => b.id !== id);
        setBarbells(updated);
        saveSettings('barbells', updated);
      }}
    ]);
  };

  const cancelBarbellForm = () => {
    setIsCreatingBarbell(false);
    setEditingBarbellId(null);
    setBarbellName('');
    setBarbellWeight('');
  };

  const savePlate = () => {
    if (plateWeight.trim() === '' || plateCount.trim() === '') {
      Alert.alert("Błąd", "Wprowadź wagę i ilość sztuk!");
      return;
    }
    const newPlate = {
      id: editingPlateId ? editingPlateId : Date.now().toString(),
      weight: plateWeight.replace(',', '.'),
      count: plateCount
    };

    let updatedPlates;
    if (editingPlateId) {
      updatedPlates = plates.map(p => p.id === editingPlateId ? newPlate : p);
    } else {
      updatedPlates = [...plates, newPlate];
    }

    updatedPlates.sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight));

    setPlates(updatedPlates);
    saveSettings('plates', updatedPlates);
    cancelPlateForm();
  };

  const editPlate = (p) => {
    setEditingPlateId(p.id);
    setPlateWeight(p.weight.toString());
    setPlateCount(p.count.toString());
    setIsCreatingPlate(true);
  };

  const deletePlate = (id) => {
    Alert.alert("Usuń", "Na pewno chcesz usunąć te talerze?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: () => {
        const updated = plates.filter(p => p.id !== id);
        setPlates(updated);
        saveSettings('plates', updated);
      }}
    ]);
  };

  const cancelPlateForm = () => {
    setIsCreatingPlate(false);
    setEditingPlateId(null);
    setPlateWeight('');
    setPlateCount('');
  };

  
  const handleExportBackup = async () => {
    try {
      
      const keys = ['workoutPlans', 'barbells', 'plates', 'restSets', 'restExercises', 'reminderNote', 'workoutHistory', 'measurements'];
      const stores = await AsyncStorage.multiGet(keys);
      
      const backupData = {};
      stores.forEach(([key, value]) => {
        if (value) {
      
          try {
            backupData[key] = JSON.parse(value);
          } catch (e) {
            backupData[key] = value;
          }
        }
      });

      const backupString = JSON.stringify(backupData);

      await Share.share({
        message: backupString,
        title: 'Pełna Kopia Aplikacji Treningowej'
      });
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się wygenerować kopii zapasowej.");
    }
  };

  const handleImportBackup = async () => {
    if (!importText.trim()) {
      Alert.alert("Błąd", "Wklej kod kopii zapasowej!");
      return;
    }

    try {
      const parsedData = JSON.parse(importText);
      const keysToSet = [];

      for (const key in parsedData) {
        const value = parsedData[key];
        
        keysToSet.push([key, typeof value === 'string' ? value : JSON.stringify(value)]);
      }

      await AsyncStorage.multiSet(keysToSet);
      
      Alert.alert("Sukces! 🎉", "Pomyślnie wczytano kopię zapasową. Uruchom aplikację ponownie, aby odświeżyć wszystkie dane.");
      setIsImportModalVisible(false);
      setImportText('');
      
      
      loadSettings();
      
    } catch (error) {
      Alert.alert("Błąd", "Nieprawidłowy format kodu kopii zapasowej. Upewnij się, że skopiowałeś cały tekst.");
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.headerTitle}>Ustawienia</Text>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Wygląd aplikacji</Text>
          <View style={styles.themeSelector}>
            <TouchableOpacity style={[styles.themeBtn, themeMode === 'system' && styles.themeBtnActive]} onPress={() => updateTheme('system')}>
              <Text style={[styles.themeBtnText, themeMode === 'system' && styles.themeBtnTextActive]}>System</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.themeBtn, themeMode === 'light' && styles.themeBtnActive]} onPress={() => updateTheme('light')}>
              <Text style={[styles.themeBtnText, themeMode === 'light' && styles.themeBtnTextActive]}>Jasny</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.themeBtn, themeMode === 'dark' && styles.themeBtnActive]} onPress={() => updateTheme('dark')}>
              <Text style={[styles.themeBtnText, themeMode === 'dark' && styles.themeBtnTextActive]}>Ciemny</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Moje sztangi</Text>
          {barbells.map(b => (
            <View key={b.id} style={styles.itemRow}>
              <Text style={styles.itemText}>{b.name} ({b.weight} kg)</Text>
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity onPress={() => editBarbell(b)} style={styles.editBtnSmall}>
                  <Text style={styles.editBtnSmallText}>Edytuj</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteBarbell(b.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>Usuń</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {isCreatingBarbell ? (
            <View style={styles.formBox}>
              <View style={styles.formHeader}><Text style={styles.formTitle}>{editingBarbellId ? "Edytuj sztangę" : "Nowa sztanga"}</Text></View>
              <TextInput style={styles.inputFull} placeholder="Nazwa (np. Olimpijska)" placeholderTextColor={colors.textMuted} value={barbellName} onChangeText={setBarbellName} autoFocus />
              <TextInput style={styles.inputFull} placeholder="Waga w kg (np. 20)" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={barbellWeight} onChangeText={setBarbellWeight} />
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.saveFormBtn} onPress={saveBarbell}><Text style={styles.saveFormBtnText}>Zapisz</Text></TouchableOpacity>
                <TouchableOpacity style={styles.cancelFormBtn} onPress={cancelBarbellForm}><Text style={styles.cancelFormBtnText}>Anuluj</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.showCreateBtn} onPress={() => setIsCreatingBarbell(true)}>
               <Text style={styles.showCreateBtnText}>+ Dodaj sztangę</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Moje talerze</Text>
          <Text style={styles.helperText}>Wpisz łączną ilość sztuk danego ciężaru na siłowni.</Text>

          {plates.map(p => (
            <View key={p.id} style={styles.itemRow}>
              <Text style={styles.itemText}>{p.weight} kg <Text style={styles.mutedText}>(x{p.count} szt.)</Text></Text>
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity onPress={() => editPlate(p)} style={styles.editBtnSmall}>
                  <Text style={styles.editBtnSmallText}>Edytuj</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deletePlate(p.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>Usuń</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {isCreatingPlate ? (
            <View style={styles.formBox}>
              <View style={styles.formHeader}><Text style={styles.formTitle}>{editingPlateId ? "Edytuj talerze" : "Dodaj talerze"}</Text></View>
              <TextInput style={styles.inputFull} placeholder="Waga pojedynczego talerza" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={plateWeight} onChangeText={setPlateWeight} autoFocus />
              <TextInput style={styles.inputFull} placeholder="Ilość sztuk na siłowni" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={plateCount} onChangeText={setPlateCount} />
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.saveFormBtn} onPress={savePlate}><Text style={styles.saveFormBtnText}>Zapisz</Text></TouchableOpacity>
                <TouchableOpacity style={styles.cancelFormBtn} onPress={cancelPlateForm}><Text style={styles.cancelFormBtnText}>Anuluj</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.showCreateBtn} onPress={() => setIsCreatingPlate(true)}>
               <Text style={styles.showCreateBtnText}>+ Dodaj talerze</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Czasy przerw (sekundy)</Text>
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Między seriami:</Text>
              <TextInput style={styles.inputFull} keyboardType="numeric" value={restSets} onChangeText={setRestSets} placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Między ćwiczeniami:</Text>
              <TextInput style={styles.inputFull} keyboardType="numeric" value={restExercises} onChangeText={setRestExercises} placeholderTextColor={colors.textMuted} />
            </View>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTimes}>
            <Text style={styles.saveBtnText}>Zapisz czasy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}> Przypominajka</Text>
          <TextInput
            style={{
              backgroundColor: colors.card,
              color: colors.text,
              padding: 15,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 200,
              textAlignVertical: 'top',
              fontSize: 14
            }}
            multiline={true}
            value={reminderNote}
            onChangeText={setReminderNote}
          />
          <TouchableOpacity style={[styles.saveBtn, { marginTop: 15 }]} onPress={saveReminderNote}>
            <Text style={styles.saveBtnText}>Zapisz notatkę</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* --- NOWA SEKCJA: KOPIA ZAPASOWA --- */}
        <View style={{ marginBottom: 30 }}>
          <Text style={styles.sectionTitle}> Pełna kopia zapasowa</Text>
          <Text style={styles.helperText}>Zabezpiecz swoje plany, ustawienia, pomiary i historię na wypadek reinstalacji aplikacji.</Text>
          
          <View style={styles.row}>
             <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginRight: 5, backgroundColor: colors.primary }]} onPress={handleExportBackup}>
               <Text style={styles.saveBtnText}>Eksportuj kod</Text>
             </TouchableOpacity>
             
             <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginLeft: 5, backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border }]} onPress={() => setIsImportModalVisible(true)}>
               <Text style={[styles.saveBtnText, { color: colors.text }]}>Wczytaj kod</Text>
             </TouchableOpacity>
          </View>
        </View>

        <View style={{height: 100}} />
      </ScrollView>

      {/* --- MODAL IMPORTU --- */}
      <Modal visible={isImportModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import kopii zapasowej</Text>
            </View>
            
            <Text style={styles.helperText}>Wklej poniżej kod wygenerowany wcześniej przy eksporcie. Zastąpi on obecne dane aplikacji.</Text>
            
            <TextInput 
              style={[styles.inputFull, { minHeight: 150, textAlignVertical: 'top' }]} 
              multiline 
              placeholder="Wklej ciąg znaków tutaj..." 
              placeholderTextColor={colors.textMuted}
              value={importText}
              onChangeText={setImportText}
            />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelFormBtn} onPress={() => { setIsImportModalVisible(false); setImportText(''); }}>
                <Text style={styles.cancelFormBtnText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveFormBtn} onPress={handleImportBackup}>
                <Text style={styles.saveFormBtnText}>Przywróć dane</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, padding: 15, paddingTop: 60, backgroundColor: colors.background },
  headerTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 15, color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  helperText: { fontSize: 13, color: colors.textMuted, marginBottom: 10, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },

  themeSelector: { flexDirection: 'row', backgroundColor: colors.cardSecondary, borderRadius: 10, padding: 4 },
  themeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  themeBtnActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  themeBtnText: { color: colors.textMuted, fontWeight: 'bold', fontSize: 14 },
  themeBtnTextActive: { color: colors.text },

  card: { backgroundColor: colors.card, padding: 15, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  halfCol: { width: '48%' },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 5, fontWeight: 'bold' },
  
  inputFull: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: colors.card, color: colors.text, marginBottom: 10 },
  
  saveBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  listSection: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, padding: 12, borderRadius: 10, marginBottom: 8 },
  itemText: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  mutedText: { fontSize: 14, color: colors.textMuted, fontWeight: 'normal' },

  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { backgroundColor: colors.danger, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8 },
  deleteBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  editBtnSmall: { backgroundColor: colors.cardSecondary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8, borderWidth: 1, borderColor: colors.border },
  editBtnSmallText: { color: colors.text, fontSize: 12, fontWeight: 'bold' },

  showCreateBtn: { backgroundColor: colors.cardSecondary, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: 5 },
  showCreateBtnText: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },

  formBox: { backgroundColor: colors.card, padding: 15, borderRadius: 12, marginTop: 5, borderWidth: 1, borderColor: colors.border },
  formHeader: { marginBottom: 10 },
  formTitle: { fontSize: 15, fontWeight: 'bold', color: colors.primary },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  saveFormBtn: { backgroundColor: colors.success, padding: 10, borderRadius: 8, flex: 1, marginLeft: 10, alignItems: 'center' },
  saveFormBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  cancelFormBtn: { backgroundColor: colors.cardSecondary, padding: 10, borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelFormBtnText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%', paddingBottom: 40 },
  modalHeader: { marginBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text }
});