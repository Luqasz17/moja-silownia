import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemeContext } from '../ThemeContext';

export default function HistoryScreen() {
  const { colors, isDark } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState('workouts');

  
  const [history, setHistory] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  
  
  const [isCreatingMeasurement, setIsCreatingMeasurement] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState(null);
  
  const [measureDate, setMeasureDate] = useState('');
  const [measureWeight, setMeasureWeight] = useState('');
  const [measureWaist, setMeasureWaist] = useState('');
  const [measureChest, setMeasureChest] = useState('');
  const [measureBiceps, setMeasureBiceps] = useState('');

  
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);
  const [selectedMeasurements, setSelectedMeasurements] = useState([]);

  
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [editableWorkout, setEditableWorkout] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadMeasurements();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem('workoutHistory');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        parsed.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(parsed);
      }
    } catch (error) {
      console.log("Błąd wczytywania historii", error);
    }
  };

  const loadMeasurements = async () => {
    try {
      const savedMeasurements = await AsyncStorage.getItem('measurements');
      if (savedMeasurements) {
        const parsed = JSON.parse(savedMeasurements);
        parsed.sort((a, b) => parseInt(b.id) - parseInt(a.id));
        setMeasurements(parsed);
      }
    } catch (error) {
      console.log("Błąd wczytywania pomiarów", error);
    }
  };

  
  const openExportModal = () => {
    setSelectedWorkouts([]);
    setSelectedMeasurements([]);
    setIsExportModalVisible(true);
  };

  const toggleWorkoutSelection = (id) => {
    if (selectedWorkouts.includes(id)) setSelectedWorkouts(selectedWorkouts.filter(wId => wId !== id));
    else setSelectedWorkouts([...selectedWorkouts, id]);
  };

  const toggleMeasurementSelection = (id) => {
    if (selectedMeasurements.includes(id)) setSelectedMeasurements(selectedMeasurements.filter(mId => mId !== id));
    else setSelectedMeasurements([...selectedMeasurements, id]);
  };

  const toggleSelectAll = () => {
    if (activeTab === 'workouts') {
      if (selectedWorkouts.length === history.length) setSelectedWorkouts([]);
      else setSelectedWorkouts(history.map(h => h.id));
    } else {
      if (selectedMeasurements.length === measurements.length) setSelectedMeasurements([]);
      else setSelectedMeasurements(measurements.map(m => m.id));
    }
  };

  const isAllSelected = activeTab === 'workouts' 
    ? (history.length > 0 && selectedWorkouts.length === history.length)
    : (measurements.length > 0 && selectedMeasurements.length === measurements.length);

  const handleExportData = async () => {
    let exportString = "";

    if (activeTab === 'measurements' && selectedMeasurements.length > 0) {
      exportString += "Data\tWaga\tObwód pasa (na wysokości pępka)\tObwód klatki piersiowej\tObwód napiętego bicepsa\n";
      const filteredM = measurements.filter(m => selectedMeasurements.includes(m.id)).reverse();
      filteredM.forEach(m => {
        exportString += `${m.date}\t${m.weight || ''}\t${m.waist || ''}\t${m.chest || ''}\t${m.biceps || ''}\n`;
      });
      exportString += "\n\n";
    }

    if (activeTab === 'workouts' && selectedWorkouts.length > 0) {
      const filteredW = history.filter(w => selectedWorkouts.includes(w.id)).reverse();
      filteredW.forEach(w => {
         const cleanDate = w.date.split(',')[0];
         let row1 = `${cleanDate}\t`;
         let row2 = `Powtórzeń\t`;

         w.exercises.forEach(ex => {
            row1 += `${ex.name}\t`;
            row2 += `${formatExerciseDetails(ex.sets)}\t`;
         });
         exportString += row1 + "\n" + row2 + "\n\n";
      });
    }

    if (exportString === "") {
      Alert.alert("Uwaga", "Wybierz przynajmniej jeden wpis do wyeksportowania.");
      return;
    }

    try {
      await Share.share({ message: exportString, title: activeTab === 'workouts' ? 'Kopia Treningów' : 'Kopia Pomiarów' });
      setIsExportModalVisible(false);
    } catch (error) {
      console.log("Błąd udostępniania", error);
    }
  };

  
  const startEditingWorkout = (workout) => {
    setEditingWorkoutId(workout.id);
    
    setEditableWorkout(JSON.parse(JSON.stringify(workout)));
  };

  const cancelEditingWorkout = () => {
    setEditingWorkoutId(null);
    setEditableWorkout(null);
  };

  const updateEditedSet = (exIndex, setIndex, field, value) => {
    const updated = { ...editableWorkout };
    updated.exercises[exIndex].sets[setIndex][field] = value;
    setEditableWorkout(updated);
  };

  const updateEditedNote = (exIndex, value) => {
    const updated = { ...editableWorkout };
    updated.exercises[exIndex].notes = value;
    setEditableWorkout(updated);
  };

  const saveEditedWorkout = async () => {
    const updatedHistory = history.map(w => w.id === editingWorkoutId ? editableWorkout : w);
    setHistory(updatedHistory);
    await AsyncStorage.setItem('workoutHistory', JSON.stringify(updatedHistory));
    setEditingWorkoutId(null);
    setEditableWorkout(null);
  };

  
  const deleteHistoryEntry = (id) => {
    Alert.alert("Usuń wpis", "Czy na pewno chcesz usunąć ten trening z historii?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: async () => {
          const updatedHistory = history.filter(item => item.id !== id);
          setHistory(updatedHistory);
          await AsyncStorage.setItem('workoutHistory', JSON.stringify(updatedHistory));
        }
      }
    ]);
  };

  const clearAllHistory = () => {
    Alert.alert("Wyczyść całą historię", "Czy na pewno chcesz usunąć WSZYSTKIE zapisane treningi?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyczyść wszystko", style: "destructive", onPress: async () => {
          setHistory([]);
          await AsyncStorage.removeItem('workoutHistory');
        }
      }
    ]);
  };

  const formatExerciseDetails = (sets) => {
    if (!sets || sets.length === 0) return "Brak wyników";
    const isWeightConstant = sets.every(s => s.weight === sets[0].weight);
    const groups = [];
    let currentGroup = { ...sets[0], count: 1 };
    
    for (let i = 1; i < sets.length; i++) {
      if (sets[i].reps === currentGroup.reps && sets[i].weight === currentGroup.weight) {
        currentGroup.count++;
      } else {
        groups.push(currentGroup);
        currentGroup = { ...sets[i], count: 1 };
      }
    }
    groups.push(currentGroup);

    if (isWeightConstant) {
      const repsString = groups.map(g => `${g.count}x${g.reps}`).join(' i '); 
      return `${repsString} (${sets[0].weight}kg)`;
    } else {
      return groups.map(g => `${g.count}x${g.reps}(${g.weight}kg)`).join(' + ');
    }
  };

  const getPerformanceBadge = (ex) => {
    if (!ex.targetSets || !ex.targetReps || !ex.targetWeight) return null;
    const tSets = parseInt(ex.targetSets);
    const tReps = parseInt(ex.targetReps);
    const tWeight = parseFloat(String(ex.targetWeight).replace(',', '.')) || 1;

    let exactMatch = true;
    let actualVolume = 0;
    const targetVolume = tSets * tReps * tWeight;

    if (ex.sets.length !== tSets) exactMatch = false;

    ex.sets.forEach(s => {
      const r = parseInt(s.reps) || 0;
      const w = parseFloat(String(s.weight).replace(',', '.')) || 1;
      actualVolume += r * w;
      if (r !== tReps || w !== tWeight) exactMatch = false;
    });

    if (exactMatch) return <View style={styles.badgePerfect}><Text style={styles.badgeTextPerfect}>🎯 Idealnie</Text></View>;
    else if (actualVolume > targetVolume) return <View style={styles.badgeAbove}><Text style={styles.badgeTextAbove}>🔥 Ponad cel</Text></View>;
    else return <View style={styles.badgeBelow}><Text style={styles.badgeTextBelow}>📉 Poniżej</Text></View>;
  };

  
  const clearAllMeasurements = () => {
    Alert.alert("Wyczyść pomiary", "Czy na pewno chcesz usunąć WSZYSTKIE zapisane pomiary ciała?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyczyść", style: "destructive", onPress: async () => {
          setMeasurements([]);
          await AsyncStorage.removeItem('measurements');
        }
      }
    ]);
  };

  const handleAddNewMeasurement = () => {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth()+1).toString().padStart(2, '0')}.${today.getFullYear()}`;
    
    setMeasureDate(formattedDate);
    setMeasureWeight('');
    setMeasureWaist('');
    setMeasureChest('');
    setMeasureBiceps('');
    
    setEditingMeasurementId(null);
    setIsCreatingMeasurement(true);
  };

  const saveMeasurement = async () => {
    if (!measureDate.trim() || !measureWeight.trim()) {
      Alert.alert("Błąd", "Data pomiaru i Waga to pola wymagane!");
      return;
    }
    const newMeasurement = {
      id: editingMeasurementId ? editingMeasurementId : Date.now().toString(),
      date: measureDate,
      weight: measureWeight.replace(',', '.'),
      waist: measureWaist.replace(',', '.'),
      chest: measureChest.replace(',', '.'),
      biceps: measureBiceps.replace(',', '.')
    };

    let updatedList;
    if (editingMeasurementId) {
      updatedList = measurements.map(m => m.id === editingMeasurementId ? newMeasurement : m);
    } else {
      updatedList = [newMeasurement, ...measurements];
    }
    
    updatedList.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    setMeasurements(updatedList);
    await AsyncStorage.setItem('measurements', JSON.stringify(updatedList));
    setIsCreatingMeasurement(false);
  };

  const editMeasurement = (m) => {
    setEditingMeasurementId(m.id);
    setMeasureDate(m.date);
    setMeasureWeight(m.weight || '');
    setMeasureWaist(m.waist || '');
    setMeasureChest(m.chest || '');
    setMeasureBiceps(m.biceps || '');
    setIsCreatingMeasurement(true);
  };

  const deleteMeasurement = (id) => {
    Alert.alert("Usuń pomiar", "Na pewno chcesz usunąć ten pomiar ciała?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: async () => {
         const updated = measurements.filter(m => m.id !== id);
         setMeasurements(updated);
         await AsyncStorage.setItem('measurements', JSON.stringify(updated));
      }}
    ]);
  };

  const renderMeasurementRow = (label, value, unit) => {
    if (!value) return null;
    return (
      <View style={styles.measurementRow}>
        <Text style={styles.measurementLabel}>{label}</Text>
        <Text style={styles.measurementValue}>{value} {unit}</Text>
      </View>
    );
  };

  const canExport = activeTab === 'workouts' ? history.length > 0 : measurements.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      
      {/* Pływający Przycisk Eksportu */}
      {canExport && (
        <TouchableOpacity style={styles.floatingExportBtn} onPress={openExportModal}>
          <Text style={styles.floatingExportIcon}>🗒️</Text>
        </TouchableOpacity>
      )}

      {/* Modal Wyboru Eksportu */}
      <Modal visible={isExportModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsExportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Eksportuj zapisane {activeTab === 'workouts' ? 'treningi' : 'pomiary'} 
            </Text>
            <Text style={styles.modalDescription}>
              Wybierz wpisy do eksportu. Po zaznaczeniu użyj opcji "Eksportuj" i wklej do arkusza.
            </Text>

            <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
              <Text style={styles.selectAllBtnText}>
                {isAllSelected ? "Odznacz wszystko" : "Zaznacz wszystko"}
              </Text>
            </TouchableOpacity>

            <ScrollView style={{ maxHeight: Platform.OS === 'ios' ? 400 : 350, width: '100%', marginBottom: 15 }}>
               {activeTab === 'workouts' && history.map(w => {
                  const isSelected = selectedWorkouts.includes(w.id);
                  const cleanDate = w.date.split(',')[0];
                  return (
                     <TouchableOpacity key={w.id} style={styles.checkboxRow} onPress={() => toggleWorkoutSelection(w.id)}>
                        <View style={[styles.roundCheckbox, isSelected && styles.roundCheckboxActive]}>
                          {isSelected && <View style={styles.roundCheckboxInner} />}
                        </View>
                        <Text style={styles.checkboxLabel}>{cleanDate} - {w.planName}</Text>
                     </TouchableOpacity>
                  )
               })}

               {activeTab === 'measurements' && measurements.map(m => {
                  const isSelected = selectedMeasurements.includes(m.id);
                  return (
                     <TouchableOpacity key={m.id} style={styles.checkboxRow} onPress={() => toggleMeasurementSelection(m.id)}>
                        <View style={[styles.roundCheckbox, isSelected && styles.roundCheckboxActive]}>
                          {isSelected && <View style={styles.roundCheckboxInner} />}
                        </View>
                        <Text style={styles.checkboxLabel}>{m.date} - Waga: {m.weight}kg</Text>
                     </TouchableOpacity>
                  )
               })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsExportModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalExportBtn} onPress={handleExportData}>
                <Text style={styles.modalExportBtnText}>Eksportuj</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Historia</Text>
            {activeTab === 'workouts' && history.length > 0 && (
              <TouchableOpacity onPress={clearAllHistory}><Text style={styles.clearAllText}>Wyczyść treningi</Text></TouchableOpacity>
            )}
            {activeTab === 'measurements' && measurements.length > 0 && !isCreatingMeasurement && (
              <TouchableOpacity onPress={clearAllMeasurements}><Text style={styles.clearAllText}>Wyczyść pomiary</Text></TouchableOpacity>
            )}
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'workouts' && styles.tabButtonActive]} onPress={() => { setActiveTab('workouts'); setIsCreatingMeasurement(false); cancelEditingWorkout(); }}>
              <Text style={[styles.tabButtonText, activeTab === 'workouts' && styles.tabButtonTextActive]}> Treningi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'measurements' && styles.tabButtonActive]} onPress={() => { setActiveTab('measurements'); cancelEditingWorkout(); }}>
              <Text style={[styles.tabButtonText, activeTab === 'measurements' && styles.tabButtonTextActive]}> Pomiary ciała</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'workouts' && (
            <>
              {history.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📓</Text>
                  <Text style={styles.emptyTitle}>Brak wpisów</Text>
                  <Text style={styles.emptySubtitle}>Zrób swój pierwszy trening i zapisz go, aby pojawił się tutaj.</Text>
                </View>
              ) : (
                history.map((workout) => {
                  const isEditing = editingWorkoutId === workout.id;

                  return (
                    <View key={workout.id} style={styles.historyCard}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={styles.dateText}>{workout.date}</Text>
                          <Text style={styles.planNameText}>Plan: {workout.planName}</Text>
                        </View>
                        
                        {!isEditing && (
                          <View style={styles.actionButtonsContainer}>
                             <TouchableOpacity onPress={() => startEditingWorkout(workout)} style={styles.editBtnSmall}>
                               <Text style={styles.editBtnSmallText}>Edytuj</Text>
                             </TouchableOpacity>
                             <TouchableOpacity onPress={() => deleteHistoryEntry(workout.id)} style={styles.deleteBtn}>
                               <Text style={styles.deleteBtnText}>Usuń</Text>
                             </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      <View style={styles.divider} />
                      
                      {isEditing && editableWorkout ? (
                        /* --- TRYB EDYCJI KARTY TRENINGU --- */
                        <View>
                           {editableWorkout.exercises.map((exResult, exIndex) => (
                             <View key={exIndex} style={{ marginBottom: 15 }}>
                               <Text style={styles.summaryExerciseName}>{exIndex + 1}. {exResult.name}</Text>
                               <View style={styles.summarySetHeader}>
                                 <Text style={[styles.summaryLabel, { width: 40 }]}></Text>
                                 <Text style={[styles.summaryLabel, { flex: 1, textAlign: 'center' }]}>Powtórzenia</Text>
                                 <Text style={[styles.summaryLabel, { flex: 1, textAlign: 'center' }]}>Ciężar (kg)</Text>
                               </View>
                               {exResult.sets.map((setObj, setIndex) => (
                                 <View key={setIndex} style={styles.summarySetRow}>
                                   <View style={styles.summarySetNumberBadge}><Text style={styles.summarySetNumberText}>{setIndex + 1}</Text></View>
                                   <View style={{ flex: 1, paddingHorizontal: 5 }}>
                                     <TextInput style={styles.summaryInput} keyboardType="numeric" value={String(setObj.reps)} onChangeText={(val) => updateEditedSet(exIndex, setIndex, 'reps', val)} />
                                   </View>
                                   <View style={{ flex: 1, paddingHorizontal: 5 }}>
                                     <TextInput style={styles.summaryInput} keyboardType="numeric" value={String(setObj.weight)} onChangeText={(val) => updateEditedSet(exIndex, setIndex, 'weight', val)} />
                                   </View>
                                 </View>
                               ))}
                               <TextInput style={styles.summaryNoteInput} placeholder="Notatka..." placeholderTextColor={colors.textMuted} value={exResult.notes} onChangeText={(val) => updateEditedNote(exIndex, val)} />
                             </View>
                           ))}
                           <View style={styles.formActions}>
                             <TouchableOpacity style={styles.saveFormBtn} onPress={saveEditedWorkout}><Text style={styles.saveFormBtnText}>Zapisz zmiany</Text></TouchableOpacity>
                             <TouchableOpacity style={styles.cancelFormBtn} onPress={cancelEditingWorkout}><Text style={styles.cancelFormBtnText}>Anuluj</Text></TouchableOpacity>
                           </View>
                        </View>
                      ) : (
                        /* --- TRYB TYLKO DO ODCZYTU --- */
                        <View>
                          {workout.exercises.map((ex, i) => (
                            <View key={i} style={styles.exerciseRow}>
                              <View style={styles.exerciseNameRow}>
                                <Text style={styles.exerciseName}>{i + 1}. {ex.name}</Text>
                                {getPerformanceBadge(ex)}
                              </View>
                              {ex.targetSets && ex.targetReps && ex.targetWeight && (
                                 <Text style={styles.targetMutedText}>Cel: {ex.targetSets}x{ex.targetReps} | {ex.targetWeight} kg</Text>
                              )}
                              <Text style={styles.exerciseDetails}>{formatExerciseDetails(ex.sets || [])}</Text>
                              {ex.notes ? <Text style={styles.exerciseNotes}>Notatka: {ex.notes}</Text> : null}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'measurements' && (
            <>
              {isCreatingMeasurement ? (
                <View style={styles.formBox}>
                  <View style={styles.formHeader}><Text style={styles.formTitle}>{editingMeasurementId ? "Edytuj pomiar" : "Nowy pomiar"}</Text></View>
                  <Text style={styles.inputLabel}>Data pomiaru: *</Text>
                  <TextInput style={styles.inputFull} value={measureDate} onChangeText={setMeasureDate} placeholder="DD.MM.YYYY" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Waga (kg): *</Text>
                  <TextInput style={styles.inputFull} keyboardType="numeric" value={measureWeight} onChangeText={setMeasureWeight} placeholder="np. 80.5" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Obwód pasa (na wysokości pępka) (cm):</Text>
                  <TextInput style={styles.inputFull} keyboardType="numeric" value={measureWaist} onChangeText={setMeasureWaist} placeholder="np. 85" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Obwód klatki piersiowej (cm):</Text>
                  <TextInput style={styles.inputFull} keyboardType="numeric" value={measureChest} onChangeText={setMeasureChest} placeholder="np. 105" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Obwód napiętego bicepsa (cm):</Text>
                  <TextInput style={styles.inputFull} keyboardType="numeric" value={measureBiceps} onChangeText={setMeasureBiceps} placeholder="np. 38" placeholderTextColor={colors.textMuted} />
                  <View style={styles.formActions}>
                    <TouchableOpacity style={styles.saveFormBtn} onPress={saveMeasurement}><Text style={styles.saveFormBtnText}>Zapisz</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.cancelFormBtn} onPress={() => setIsCreatingMeasurement(false)}><Text style={styles.cancelFormBtnText}>Anuluj</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.addMeasurementBtn} onPress={handleAddNewMeasurement}>
                  <Text style={styles.addMeasurementBtnText}>+ Dodaj nowy pomiar</Text>
                </TouchableOpacity>
              )}

              {!isCreatingMeasurement && measurements.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📏</Text>
                  <Text style={styles.emptyTitle}>Brak pomiarów</Text>
                  <Text style={styles.emptySubtitle}>Dodaj swój pierwszy pomiar ciała, aby śledzić progres z dala od Google Docs.</Text>
                </View>
              ) : (
                !isCreatingMeasurement && measurements.map(m => (
                  <View key={m.id} style={styles.historyCard}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.dateText}>{m.date}</Text>
                        <Text style={styles.planNameText}>Pomiary ciała</Text>
                      </View>
                      <View style={styles.actionButtonsContainer}>
                         <TouchableOpacity onPress={() => editMeasurement(m)} style={styles.editBtnSmall}><Text style={styles.editBtnSmallText}>Edytuj</Text></TouchableOpacity>
                         <TouchableOpacity onPress={() => deleteMeasurement(m.id)} style={styles.deleteBtn}><Text style={styles.deleteBtnText}>Usuń</Text></TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.measurementsListContainer}>
                       {renderMeasurementRow("Waga", m.weight, "kg")}
                       {renderMeasurementRow("Obwód pasa (na wysokości pępka)", m.waist, "cm")}
                       {renderMeasurementRow("Obwód klatki piersiowej", m.chest, "cm")}
                       {renderMeasurementRow("Obwód napiętego bicepsa", m.biceps, "cm")}
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  scrollContainer: { padding: 15, paddingTop: Platform.OS === 'ios' ? 60 : 60, paddingBottom: 150 },
  
  floatingExportBtn: { position: 'absolute', bottom: 30, right: 20, zIndex: 1000, backgroundColor: colors.cardSecondary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, borderWidth: 1, borderColor: colors.border },
  floatingExportIcon: { fontSize: 24 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.card, width: '100%', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 10, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 10, textAlign: 'center' },
  modalDescription: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 15 },
  
  selectAllBtn: { alignSelf: 'flex-end', marginBottom: 10, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.cardSecondary, borderRadius: 8 },
  selectAllBtnText: { color: colors.primary, fontWeight: 'bold', fontSize: 13 },
  
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: colors.background, padding: 10, borderRadius: 8 },
  roundCheckbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.textMuted, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  roundCheckboxActive: { borderColor: colors.primary },
  roundCheckboxInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  checkboxLabel: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalCancelBtn: { flex: 1, backgroundColor: colors.cardSecondary, padding: 14, borderRadius: 10, marginRight: 8, alignItems: 'center' },
  modalCancelBtnText: { color: colors.text, fontWeight: 'bold', fontSize: 15 },
  modalExportBtn: { flex: 1, backgroundColor: colors.primary, padding: 14, borderRadius: 10, marginLeft: 8, alignItems: 'center' },
  modalExportBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, 
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: colors.text },
  clearAllText: { color: colors.danger, fontWeight: 'bold', fontSize: 14 },
  
  tabsContainer: { flexDirection: 'row', backgroundColor: colors.cardSecondary, borderRadius: 10, padding: 4, marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  tabButtonText: { color: colors.textMuted, fontWeight: 'bold', fontSize: 14 },
  tabButtonTextActive: { color: colors.text },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyEmoji: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },

  historyCard: { backgroundColor: colors.card, borderRadius: 12, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateText: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  planNameText: { fontSize: 14, color: colors.primary, fontWeight: 'bold' },
  
  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { backgroundColor: colors.danger, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  deleteBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  editBtnSmall: { backgroundColor: colors.cardSecondary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  editBtnSmallText: { color: colors.text, fontSize: 12, fontWeight: 'bold' },
  
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  
  exerciseRow: { marginBottom: 15 },
  exerciseNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  exerciseName: { fontSize: 15, fontWeight: 'bold', color: colors.text, flex: 1 },
  
  targetMutedText: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  exerciseDetails: { fontSize: 14, color: colors.success, fontWeight: 'bold' },
  exerciseNotes: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },

  badgePerfect: { backgroundColor: 'rgba(52, 199, 89, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTextPerfect: { color: colors.success, fontSize: 10, fontWeight: 'bold' },
  badgeAbove: { backgroundColor: 'rgba(255, 149, 0, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTextAbove: { color: colors.warning, fontSize: 10, fontWeight: 'bold' },
  badgeBelow: { backgroundColor: 'rgba(255, 59, 48, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTextBelow: { color: colors.danger, fontSize: 10, fontWeight: 'bold' },

  addMeasurementBtn: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  addMeasurementBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

  formBox: { backgroundColor: colors.card, padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  formHeader: { marginBottom: 15 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  inputLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 5, fontWeight: 'bold' },
  inputFull: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: colors.background, color: colors.text, marginBottom: 15 },
  
  formActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  saveFormBtn: { backgroundColor: colors.success, padding: 12, borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center' },
  saveFormBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelFormBtn: { backgroundColor: colors.danger, padding: 12, borderRadius: 8, flex: 1, marginLeft: 10, alignItems: 'center' },
  cancelFormBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  measurementsListContainer: { marginTop: 5 },
  measurementRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  measurementLabel: { fontSize: 15, fontWeight: 'bold', color: colors.text, flex: 1, paddingRight: 10 },
  measurementValue: { fontSize: 15, color: colors.success, fontWeight: 'bold' },

 
  summaryExerciseName: { fontSize: 16, fontWeight: 'bold', color: colors.primary, marginBottom: 10, marginTop: 10 },
  summarySetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: 'bold' },
  summarySetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  summarySetNumberBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  summarySetNumberText: { color: colors.text, fontWeight: 'bold', fontSize: 12 },
  summaryInput: { backgroundColor: colors.cardSecondary, color: colors.text, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  summaryNoteInput: { backgroundColor: colors.cardSecondary, color: colors.text, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, fontSize: 14, marginTop: 5 }
});