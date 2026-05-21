import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';


import { ThemeContext } from '../ThemeContext';

export default function HomeScreen() {
  const { colors } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [currentActiveWorkoutId, setCurrentActiveWorkoutId] = useState(null);

  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);

  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState(null);

  const [newPlanName, setNewPlanName] = useState('');
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newSets, setNewSets] = useState('');
  const [newReps, setNewReps] = useState('');

  const [reminderNote, setReminderNote] = useState("");

  const [showHiddenPlans, setShowHiddenPlans] = useState(false);
  
  const [lastDeletedPlan, setLastDeletedPlan] = useState(null);
  const [undoSeconds, setUndoSeconds] = useState(0);

  const defaultNote = "Kalorie: 2500 kcal dziennie.\nBiałko: 160 g (klucz do budowy klatki i ramion).\nTłuszcze: 70 g\nWęglowodany: ok. 300 g (z priorytetem w posiłkach okołotreningowych)\n\nSuplementy:\nKreatyna (5 g dziennie), tran, rutinoscorbin oraz odżywka białkowa według potrzeb\n\n1.5h przed treningiem:\nok. 60-80 g węglowodanów (np. 80 g ryżu/makaronu + chude mięso).\n\n30 min po treningu:\nOdżywka białkowa + banan.\n\nKolacja po treningu:\n100 g węglowodanów (np. solidna porcja ziemniaków lub kaszy) i 40-50 g białka.\n\nSen: 6.5-7 godzin";

  useFocusEffect(
    useCallback(() => {
      const loadNote = async () => {
        const savedNote = await AsyncStorage.getItem('reminderNote');
        if (savedNote) setReminderNote(savedNote);
        else setReminderNote(defaultNote);
      };
      loadNote();
    }, [])
  );

  const showReminder = () => {
    Alert.alert(" \nMoja przypominajka \n", reminderNote, [{ text: "Dzięki", style: "default" }]);
  };

  useFocusEffect(
    useCallback(() => {
      const loadPlansAndActiveWorkout = async () => {
        try {
          const savedPlans = await AsyncStorage.getItem('workoutPlans');
          const activeWorkout = await AsyncStorage.getItem('activeWorkoutId');
          setCurrentActiveWorkoutId(activeWorkout);

          if (savedPlans) {
            const parsed = JSON.parse(savedPlans);
            setPlans(parsed);
            if (parsed.length > 0 && !activePlanId) {
              const firstVisible = parsed.find(p => !p.isHidden);
              setActivePlanId(firstVisible ? firstVisible.id : parsed[0].id);
            }
          }
        } catch (error) { console.log(error); }
      };
      loadPlansAndActiveWorkout();
    }, [activePlanId])
  );

  useEffect(() => {
    let interval = null;
    if (undoSeconds > 0) {
      interval = setInterval(() => {
        setUndoSeconds(prev => prev - 1);
      }, 1000);
    } else {
      setLastDeletedPlan(null);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [undoSeconds]);

  const savePlans = async (updatedPlans) => {
    setPlans(updatedPlans);
    await AsyncStorage.setItem('workoutPlans', JSON.stringify(updatedPlans));
  };

  const addPlan = () => {
    if (newPlanName.trim() === '') {
      Alert.alert("Błąd", "Podaj nazwę nowego planu!");
      return;
    }
    let updatedPlans;
    if (editingPlanId) {
      updatedPlans = plans.map(p => p.id === editingPlanId ? { ...p, name: newPlanName } : p);
    } else {
      const newPlan = { id: Date.now().toString(), name: newPlanName, exercises: [], isHidden: false };
      updatedPlans = [...plans, newPlan];
      setActivePlanId(newPlan.id);
    }
    savePlans(updatedPlans);
    setNewPlanName('');
    setIsCreatingPlan(false);
    setEditingPlanId(null);
  };

  const visiblePlans = plans.filter(p => !p.isHidden);
  const hiddenPlans = plans.filter(p => p.isHidden);

  const movePlan = (dir, plan) => {
    const isHidden = plan.isHidden;
    const targetArray = isHidden ? [...hiddenPlans] : [...visiblePlans];
    const idx = targetArray.findIndex(p => p.id === plan.id);
    
    if (dir === 'left' && idx > 0) {
      [targetArray[idx - 1], targetArray[idx]] = [targetArray[idx], targetArray[idx - 1]];
    } else if (dir === 'right' && idx < targetArray.length - 1) {
      [targetArray[idx + 1], targetArray[idx]] = [targetArray[idx], targetArray[idx + 1]];
    }
    
    const newPlans = isHidden ? [...visiblePlans, ...targetArray] : [...targetArray, ...hiddenPlans];
    savePlans(newPlans);
  };

  const toggleHidePlan = (plan) => {
    const updated = plans.map(p => p.id === plan.id ? { ...p, isHidden: !p.isHidden } : p);
    savePlans(updated);
  };

  const confirmDeletePlan = (plan) => {
    setTimeout(() => {
      Alert.alert("Usuń plan", "Czy na pewno chcesz usunąć ten plan i wszystkie jego ćwiczenia?", [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: () => {
            const updated = plans.filter(p => p.id !== plan.id);
            setLastDeletedPlan(plan);
            setUndoSeconds(30);
            savePlans(updated);
            if (activePlanId === plan.id) {
              const next = updated.find(p => !p.isHidden);
              setActivePlanId(next ? next.id : (updated.length > 0 ? updated[0].id : null));
            }
        }}
      ]);
    }, 300);
  };

  
  const handleLongPressPlan = (plan) => {
    if (Platform.OS === 'ios') {
      const targetList = plan.isHidden ? hiddenPlans : visiblePlans;
      const currentListIndex = targetList.findIndex(p => p.id === plan.id);
      const canMoveLeft = currentListIndex > 0;
      const canMoveRight = currentListIndex < targetList.length - 1 && currentListIndex !== -1;

   
      const options = ['Anuluj', 'Edytuj nazwę'];
      if (canMoveLeft) options.push('Przenieś w lewo');
      if (canMoveRight) options.push('Przenieś w prawo');
      options.push(plan.isHidden ? 'Odkryj' : 'Ukryj');
      options.push('Usuń');

      const cancelButtonIndex = 0;
      const destructiveButtonIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
          title: `Opcje planu: ${plan.name}`,
        },
        (buttonIndex) => {
          const action = options[buttonIndex];
          if (action === 'Edytuj nazwę') {
            setEditingPlanId(plan.id);
            setNewPlanName(plan.name);
            setIsCreatingPlan(true);
          } else if (action === 'Przenieś w lewo') {
            movePlan('left', plan);
          } else if (action === 'Przenieś w prawo') {
            movePlan('right', plan);
          } else if (action === 'Ukryj' || action === 'Odkryj') {
            toggleHidePlan(plan);
          } else if (action === 'Usuń') {
            confirmDeletePlan(plan);
          }
        }
      );
    }
  };

  const undoDelete = () => {
    if (lastDeletedPlan) {
      savePlans([...plans, lastDeletedPlan]);
      setLastDeletedPlan(null);
      setUndoSeconds(0);
    }
  };

  const saveExercise = async () => {
    if (!activePlanId) return;
    if (newName.trim() === '' || newWeight.trim() === '' || newSets.trim() === '' || newReps.trim() === '') {
      Alert.alert("Błąd", "Wypełnij wszystkie pola!");
      return;
    }

    const exerciseData = {
      id: editingExerciseId ? editingExerciseId : Date.now().toString(),
      name: newName,
      targetWeight: newWeight,
      sets: parseInt(newSets, 10),
      reps: parseInt(newReps, 10)
    };

    const updatedPlans = plans.map(p => {
      if (p.id === activePlanId) {
        if (editingExerciseId) {
          return { ...p, exercises: p.exercises.map(e => e.id === editingExerciseId ? exerciseData : e) };
        } else {
          return { ...p, exercises: [...p.exercises, exerciseData] };
        }
      }
      return p;
    });

    savePlans(updatedPlans);
    
    if (activePlanId === currentActiveWorkoutId) {
      await AsyncStorage.removeItem('ongoingWorkoutState');
    }
    
    cancelExerciseForm();
  };

  const editExercise = (exercise) => {
    setEditingExerciseId(exercise.id);
    setNewName(exercise.name);
    setNewWeight(exercise.targetWeight.toString());
    setNewSets(exercise.sets.toString());
    setNewReps(exercise.reps.toString());
    setIsCreatingExercise(true);
  };

  const removeExercise = async (exerciseId) => {
    const updatedPlans = plans.map(p => {
      if (p.id === activePlanId) {
        return { ...p, exercises: p.exercises.filter(e => e.id !== exerciseId) };
      }
      return p;
    });
    savePlans(updatedPlans);

    if (activePlanId === currentActiveWorkoutId) {
      await AsyncStorage.removeItem('ongoingWorkoutState');
    }
  };

  const cancelExerciseForm = () => {
    setIsCreatingExercise(false);
    setEditingExerciseId(null);
    setNewName(''); setNewWeight(''); setNewSets(''); setNewReps('');
  };

  const startWorkout = async () => {
    if (currentActiveWorkoutId && currentActiveWorkoutId !== activePlanId) {
      const currentlyRunningPlan = plans.find(p => p.id === currentActiveWorkoutId);
      const currentPlanName = currentlyRunningPlan ? currentlyRunningPlan.name : "Nieznany plan";
      const newPlanName = activePlan ? activePlan.name : "Nowy plan";

      Alert.alert(
        "Trwa inny trening!",
        `Masz już włączony plan: "${currentPlanName}"\n\nPróbujesz uruchomić: "${newPlanName}"\n\nJeśli rozpoczniesz nowy, stracisz obecny postęp. Czy na pewno chcesz to zrobić?`,
        [
          { text: "Anuluj", style: "cancel" },
          { 
            text: "Rozpocznij nowy", 
            style: "destructive", 
            onPress: async () => {
              await AsyncStorage.setItem('activeWorkoutId', activePlanId);
              setCurrentActiveWorkoutId(activePlanId);
              router.push('/workout');
            }
          }
        ]
      );
    } else {
      await AsyncStorage.setItem('activeWorkoutId', activePlanId);
      setCurrentActiveWorkoutId(activePlanId);
      router.push('/workout');
    }
  };

  const cancelActiveWorkout = () => {
    Alert.alert(
      "Anuluj trening",
      "Czy na pewno chcesz przerwać aktualnie trwający trening? Twój niezapisany postęp zostanie utracony.",
      [
        { text: "Wróć", style: "cancel" },
        { text: "Przerwij", style: "destructive", onPress: async () => {
            await AsyncStorage.removeItem('activeWorkoutId');
            setCurrentActiveWorkoutId(null);
          }
        }
      ]
    );
  };

  const activePlan = plans.find(p => p.id === activePlanId);
  const isCurrentlyWorkedOut = currentActiveWorkoutId === activePlanId;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={styles.headerTitle}>Moje plany</Text>
            <TouchableOpacity onPress={showReminder} style={{ backgroundColor: colors.cardSecondary, padding: 10, borderRadius: 20 }}>
              <Text style={{ fontSize: 24 }}>💬</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.planSelector}>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                {visiblePlans.map(plan => (
                  <TouchableOpacity 
                    key={plan.id} 
                    style={[styles.planTab, activePlanId === plan.id && styles.planTabActive]}
                    onPress={() => setActivePlanId(plan.id)}
                    onLongPress={() => handleLongPressPlan(plan)}
                  >
                    <Text style={[styles.planTabText, activePlanId === plan.id && styles.planTabTextActive]}>
                      {plan.name}
                    </Text>
                  </TouchableOpacity>
                ))}

                {hiddenPlans.length > 0 && (
                  <TouchableOpacity style={[styles.planTab, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowHiddenPlans(!showHiddenPlans)}>
                    <Text style={{ color: colors.textMuted, fontWeight: 'bold', fontSize: 14 }}>
                      {showHiddenPlans ? "Ukryj" : `Ukryte (${hiddenPlans.length})`}
                    </Text>
                  </TouchableOpacity>
                )}

                {showHiddenPlans && hiddenPlans.map(plan => (
                  <TouchableOpacity 
                    key={plan.id} 
                    style={[styles.planTab, { opacity: 0.5 }, activePlanId === plan.id && styles.planTabActive]}
                    onPress={() => setActivePlanId(plan.id)}
                    onLongPress={() => handleLongPressPlan(plan)}
                  >
                    <Text style={[styles.planTabText, activePlanId === plan.id && styles.planTabTextActive]}>
                      {plan.name}
                    </Text>
                  </TouchableOpacity>
                ))}
             </ScrollView>
             
             {isCreatingPlan ? (
               <View style={styles.addPlanRow}>
                  <TextInput style={styles.planInput} placeholder="Nazwa (np. Push)" placeholderTextColor={colors.textMuted} value={newPlanName} onChangeText={setNewPlanName} autoFocus={true} />
                  <TouchableOpacity style={styles.addPlanBtn} onPress={addPlan}><Text style={styles.addPlanBtnText}>Zapisz</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.cancelPlanBtn} onPress={() => { setIsCreatingPlan(false); setNewPlanName(''); setEditingPlanId(null); }}><Text style={styles.cancelPlanBtnText}>X</Text></TouchableOpacity>
               </View>
             ) : (
               <TouchableOpacity style={styles.showCreateBtn} onPress={() => setIsCreatingPlan(true)}>
                 <Text style={styles.showCreateBtnText}>+ Stwórz nowy plan</Text>
               </TouchableOpacity>
             )}
          </View>

          <View style={styles.divider} />

          {activePlan ? (
            <>
              <View style={styles.listSection}>
                <View style={styles.planTitleRow}>
                  <Text style={styles.sectionTitle}>Plan: {activePlan.name}</Text>
                  {isCurrentlyWorkedOut && <View style={styles.activeBadgeSmall}><Text style={styles.activeBadgeSmallText}>AKTYWNY</Text></View>}
                </View>

                {activePlan.exercises.length === 0 ? (
                  <Text style={styles.emptyText}>Brak ćwiczeń. Dodaj coś poniżej!</Text>
                ) : (
                  activePlan.exercises.map((exercise, index) => (
                    <View key={exercise.id} style={styles.exerciseRow}>
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{index + 1}. {exercise.name}</Text>
                        <Text style={styles.exerciseDetails}>{exercise.sets} serie x {exercise.reps} powt. | {exercise.targetWeight} kg</Text>
                      </View>
                      
                      <View style={styles.actionButtons}>
                        <TouchableOpacity onPress={() => editExercise(exercise)} style={styles.editButton}>
                          <Text style={styles.editButtonText}>Edytuj</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeExercise(exercise.id)} style={styles.deleteButton}>
                          <Text style={styles.deleteButtonText}>Usuń</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {isCreatingExercise ? (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{editingExerciseId ? "Edytuj ćwiczenie" : "Nowe ćwiczenie"}</Text>
                    <TouchableOpacity onPress={cancelExerciseForm}><Text style={styles.closeCardText}>X</Text></TouchableOpacity>
                  </View>
                  
                  <TextInput style={styles.inputFull} placeholder="Nazwa (np. Przysiad)" placeholderTextColor={colors.textMuted} value={newName} onChangeText={setNewName} autoFocus={true} />
                  
                  <View style={styles.row}>
                    <TextInput style={[styles.inputThird, { marginRight: 10 }]} placeholder="Cel (kg)" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={newWeight} onChangeText={setNewWeight} />
                    <TextInput style={[styles.inputThird, { marginRight: 10 }]} placeholder="Serie" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={newSets} onChangeText={setNewSets} />
                    <TextInput style={styles.inputThird} placeholder="Powt." placeholderTextColor={colors.textMuted} keyboardType="numeric" value={newReps} onChangeText={setNewReps} />
                  </View>

                  <TouchableOpacity style={styles.addButton} onPress={saveExercise}>
                    <Text style={styles.addButtonText}>{editingExerciseId ? "Zapisz zmiany" : "Zapisz ćwiczenie"}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.showCreateBtn, { marginBottom: 30 }]} onPress={() => setIsCreatingExercise(true)}>
                  <Text style={styles.showCreateBtnText}>+ Dodaj ćwiczenie</Text>
                </TouchableOpacity>
              )}

              {activePlan.exercises.length > 0 && (
                <View style={{ marginBottom: 40 }}>
                  <TouchableOpacity style={[styles.startButton, isCurrentlyWorkedOut && styles.resumeButton, { marginBottom: isCurrentlyWorkedOut ? 10 : 0 }]} onPress={startWorkout}>
                    <Text style={styles.startButtonText}>{isCurrentlyWorkedOut ? "WRÓĆ DO TRENINGU 🏋️" : "ZACZNIJ TEN TRENING"}</Text>
                  </TouchableOpacity>

                  {isCurrentlyWorkedOut && (
                    <TouchableOpacity onPress={cancelActiveWorkout} style={styles.cancelActiveBtn}>
                      <Text style={styles.cancelActiveBtnText}>Anuluj ten trening ✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>Nie masz żadnych planów. Stwórz swój pierwszy plan powyżej!</Text>
          )}

          <View style={{height: 100}} />
        </ScrollView>
      </KeyboardAvoidingView>

      {lastDeletedPlan && (
        <View style={styles.undoBar}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Usunięto plan ({undoSeconds}s)</Text>
          <TouchableOpacity onPress={undoDelete}>
            <Text style={{ color: '#4da6ff', fontWeight: '900', fontSize: 16 }}>Cofnij</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, padding: 15, paddingTop: 55, backgroundColor: colors.background },
  headerTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 15, color: colors.text },
  planSelector: { marginBottom: 10 },
  planTab: { backgroundColor: colors.cardSecondary, padding: 12, paddingHorizontal: 15, borderRadius: 20, marginRight: 8 },
  planTabActive: { backgroundColor: colors.primary },
  planTabText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
  planTabTextActive: { color: '#fff' },
  showCreateBtn: { backgroundColor: colors.cardSecondary, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  showCreateBtnText: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },
  addPlanRow: { flexDirection: 'row', alignItems: 'center' },
  planInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, backgroundColor: colors.card, color: colors.text, marginRight: 10, fontSize: 14 },
  addPlanBtn: { backgroundColor: colors.success, padding: 10, borderRadius: 8, marginRight: 10 },
  addPlanBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  cancelPlanBtn: { backgroundColor: colors.danger, padding: 10, borderRadius: 8, width: 40, alignItems: 'center' },
  cancelPlanBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  card: { backgroundColor: colors.card, padding: 15, borderRadius: 12, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.primary },
  closeCardText: { color: colors.danger, fontWeight: 'bold', fontSize: 18, paddingHorizontal: 5 },
  inputFull: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputThird: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, fontSize: 14 },
  addButton: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  listSection: { marginBottom: 15 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginRight: 10 },
  activeBadgeSmall: { backgroundColor: colors.success, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  activeBadgeSmallText: { color: '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  emptyText: { fontStyle: 'italic', color: colors.textMuted, textAlign: 'center', marginTop: 10, fontSize: 14, marginBottom: 15 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, padding: 12, borderRadius: 10, marginBottom: 8 },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 2 },
  exerciseDetails: { fontSize: 13, color: colors.textMuted },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  editButton: { backgroundColor: colors.cardSecondary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8, borderWidth: 1, borderColor: colors.border },
  editButtonText: { color: colors.text, fontSize: 12, fontWeight: 'bold' },
  deleteButton: { backgroundColor: colors.danger, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8 },
  deleteButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  startButton: { backgroundColor: colors.success, padding: 15, borderRadius: 12, alignItems: 'center', shadowColor: colors.success, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  resumeButton: { backgroundColor: colors.primary, shadowColor: colors.primary },
  startButtonText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  cancelActiveBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelActiveBtnText: { color: colors.danger, fontWeight: 'bold', fontSize: 14 },
  undoBar: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#222', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 5, zIndex: 100 }
});