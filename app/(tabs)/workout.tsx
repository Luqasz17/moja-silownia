import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemeContext } from '../ThemeContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


export default function WorkoutScreen() {
  const router = useRouter();
  
  const { colors, isDark } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  
  const [barbells, setBarbells] = useState([]);
  const [plates, setPlates] = useState([]);
  const [selectedBarbell, setSelectedBarbell] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [restTime, setRestTime] = useState(90);
  const [restExercisesTime, setRestExercisesTime] = useState(120);
  
  const [workoutPlan, setWorkoutPlan] = useState([]);
  
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [viewIndex, setViewIndex] = useState(0);
  
  const [activePlanName, setActivePlanName] = useState("");
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);

  const [timeLeft, setTimeLeft] = useState(0);
  const [timerEndTime, setTimerEndTime] = useState(null);
  
  const [activeTimerIndex, setActiveTimerIndex] = useState(null);
  const [activeTimerExerciseIndex, setActiveTimerExerciseIndex] = useState(null);
  const [isExerciseResting, setIsExerciseResting] = useState(false);

  const [pendingSpeech, setPendingSpeech] = useState(false);

  const [isWorkoutFinished, setIsWorkoutFinished] = useState(false);
  const [workoutResults, setWorkoutResults] = useState([]);

  const [altComboIndex, setAltComboIndex] = useState(0);
  const [ignoredPlates, setIgnoredPlates] = useState([]);

  useEffect(() => {
    const setupSystem = async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1, 
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.log("Błąd audio", e);
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      await Notifications.requestPermissionsAsync();
    };
    setupSystem();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadEquipmentAndPlan = async () => {
        try {
          const savedBarbells = await AsyncStorage.getItem('barbells');
          const savedPlates = await AsyncStorage.getItem('plates');
          const savedRestSets = await AsyncStorage.getItem('restSets');
          const savedRestExercises = await AsyncStorage.getItem('restExercises');
          
          const savedPlans = await AsyncStorage.getItem('workoutPlans');
          const activePlanId = await AsyncStorage.getItem('activeWorkoutId');
          const savedOngoingState = await AsyncStorage.getItem('ongoingWorkoutState');
          
          let parsedBarbells = [];
          if (savedBarbells) parsedBarbells = JSON.parse(savedBarbells);
          
          const virtualEquipment = [
            { id: 'machine_double', name: 'Obustronnie (0 kg)', weight: '0' },
            { id: 'machine_single', name: 'Jednostronnie (0 kg)', weight: '0' }
          ];
          
          const allEquipment = [...parsedBarbells, ...virtualEquipment];
          setBarbells(allEquipment);
          
          setSelectedBarbell(prev => {
            if (prev && allEquipment.find(b => b.id === prev.id)) return prev;
            return parsedBarbells.length > 0 ? parsedBarbells[0] : allEquipment[0];
          });
          
          if (savedPlates) setPlates(JSON.parse(savedPlates));
          if (savedRestSets) setRestTime(parseInt(savedRestSets, 10));
          if (savedRestExercises) setRestExercisesTime(parseInt(savedRestExercises, 10));

          if (savedPlans && activePlanId) {
            const parsedPlans = JSON.parse(savedPlans);
            const activePlan = parsedPlans.find(p => p.id === activePlanId);
            
            if (activePlan && activePlan.exercises) {
              setHasActiveWorkout(true);
              setActivePlanName(activePlan.name);
              setWorkoutPlan(activePlan.exercises);

              
              let restored = false;
              if (savedOngoingState) {
                 const parsedState = JSON.parse(savedOngoingState);
                 if (parsedState.planId === activePlanId && parsedState.workoutResults && parsedState.workoutResults.length === activePlan.exercises.length) {
                    setWorkoutResults(parsedState.workoutResults);
                    setActiveExerciseIndex(parsedState.activeExerciseIndex || 0);
                    setViewIndex(parsedState.activeExerciseIndex || 0);
                    restored = true;
                 }
              }

              
              if (!restored) {
                 const initialResults = activePlan.exercises.map(ex => ({
                    name: ex.name,
                    notes: '',
                    targetSets: ex.sets,
                    targetReps: ex.reps,
                    targetWeight: ex.targetWeight,
                    sets: Array.from({ length: ex.sets }).map(() => ({
                      reps: ex.reps.toString(),
                      weight: ex.targetWeight.toString(),
                      isCompleted: false 
                    }))
                 }));
                 setWorkoutResults(initialResults);
                 setActiveExerciseIndex(0);
                 setViewIndex(0);
                 setIsWorkoutFinished(false);
                 setAltComboIndex(0);
                 clearTimerCore();
                 setIsExerciseResting(false);
                 setPendingSpeech(false);
                 
                 await AsyncStorage.setItem('ongoingWorkoutState', JSON.stringify({
                    planId: activePlanId,
                    activeExerciseIndex: 0,
                    workoutResults: initialResults
                 }));
              }
            } else {
              await AsyncStorage.removeItem('activeWorkoutId');
              await AsyncStorage.removeItem('ongoingWorkoutState');
              setHasActiveWorkout(false);
              setWorkoutPlan([]);
            }
          } else {
            setHasActiveWorkout(false);
            setWorkoutPlan([]);
          }
          setIsLoaded(true);
        } catch (error) {
          console.log("Błąd wczytywania", error);
        }
      };
      loadEquipmentAndPlan();
    }, [])
  );

  
  useEffect(() => {
     if (hasActiveWorkout && workoutResults.length > 0) {
        const saveState = async () => {
           const activePlanId = await AsyncStorage.getItem('activeWorkoutId');
           if (activePlanId) {
              await AsyncStorage.setItem('ongoingWorkoutState', JSON.stringify({
                 planId: activePlanId,
                 activeExerciseIndex: activeExerciseIndex,
                 workoutResults: workoutResults
              }));
           }
        };
        saveState();
     }
  }, [workoutResults, activeExerciseIndex, hasActiveWorkout]);

  const clearTimerCore = async () => {
    setTimerEndTime(null);
    setActiveTimerIndex(null);
    setActiveTimerExerciseIndex(null);
    setTimeLeft(0);
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const notifyUser = async () => {
    try {
      Speech.speak('Koniec przerwy! Wracaj do ćwiczeń.', { language: 'pl-PL', pitch: 0.1, rate: 1.1 });
    } catch (e) {}
  };

  const skipTimer = async () => {
    await clearTimerCore();
    if (isExerciseResting) setIsExerciseResting(false);
    await Notifications.scheduleNotificationAsync({
      content: { title: "Pominięto ⏱️", body: "Czas na ciężary!", sound: true },
      trigger: null, 
    });
    setTimeout(() => { notifyUser(); }, 400);
  };

  const startBackgroundTimer = async (seconds, type, setIndex = null, exerciseIndex = null) => {
    setTimerEndTime(Date.now() + seconds * 1000);
    setTimeLeft(seconds);
    setPendingSpeech(false); 

    if (type === 'set') {
      setActiveTimerIndex(setIndex);
      setActiveTimerExerciseIndex(exerciseIndex);
      setIsExerciseResting(false);
    } else {
      setActiveTimerIndex(null);
      setActiveTimerExerciseIndex(null);
      setIsExerciseResting(true);
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Koniec przerwy! ⏱️",
        body: type === 'set' ? "Wracaj do ciężarów!" : "Zaczynamy nowe ćwiczenie!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: seconds,
        channelId: 'default',
      },
    });
  };

  useEffect(() => {
    let interval;
    if (timerEndTime) {
      interval = setInterval(() => {
        const remaining = Math.ceil((timerEndTime - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(interval);
          clearTimerCore();
          if (isExerciseResting) setIsExerciseResting(false);
          
          if (AppState.currentState === 'active') {
            notifyUser();
          } else {
            setPendingSpeech(true);
          }
        } else {
          setTimeLeft(remaining);
        }
      }, 500);
    } else {
      setTimeLeft(0);
    }
    return () => clearInterval(interval);
  }, [timerEndTime, isExerciseResting]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        if (pendingSpeech) {
          setPendingSpeech(false);
          setTimeout(() => { notifyUser(); }, 500);
        } else if (timerEndTime) {
          const remaining = Math.ceil((timerEndTime - Date.now()) / 1000);
          if (remaining <= 0) {
            clearTimerCore();
            if (isExerciseResting) setIsExerciseResting(false);
            setTimeout(() => { notifyUser(); }, 500);
          } else {
            setTimeLeft(remaining);
          }
        }
      }
    });
    return () => subscription.remove();
  }, [timerEndTime, pendingSpeech, isExerciseResting]);

  const currentExercise = workoutPlan[viewIndex];
  const currentResult = workoutResults[viewIndex];

  const getActiveSetWeight = () => {
    if (!currentResult) return currentExercise?.targetWeight || 0;
    const firstUncompletedIndex = currentResult.sets.findIndex(set => set.isCompleted === false);
    const activeSetIndex = firstUncompletedIndex !== -1 ? firstUncompletedIndex : currentResult.sets.length - 1;
    return currentResult.sets[activeSetIndex]?.weight || currentExercise?.targetWeight || 0;
  };

  const handleFinishSet = (index) => {
    const updatedResults = [...workoutResults];
    updatedResults[viewIndex].sets[index].isCompleted = true;
    setWorkoutResults(updatedResults);

    if (viewIndex === activeExerciseIndex) {
      const allDone = updatedResults[viewIndex].sets.every(s => s.isCompleted);
      if (!allDone) {
        startBackgroundTimer(restTime, 'set', index, viewIndex);
      }
    }
  };

  const handleAdvanceExercise = () => {
    if (viewIndex === workoutPlan.length - 1) {
      clearTimerCore();
      setIsWorkoutFinished(true);
    } else {
      clearTimerCore();
      setActiveExerciseIndex(viewIndex + 1);
      setViewIndex(viewIndex + 1);
      setAltComboIndex(0);
      startBackgroundTimer(restExercisesTime, 'exercise');
    }
  };

  const updateSetResult = (exerciseIndex, setIndex, field, value) => {
    const updated = [...workoutResults];
    updated[exerciseIndex].sets[setIndex][field] = value;
    setWorkoutResults(updated);
    if (field === 'weight') setAltComboIndex(0);
  };

  const updateNote = (exerciseIndex, value) => {
    const updated = [...workoutResults];
    updated[exerciseIndex].notes = value;
    setWorkoutResults(updated);
  };

  const handleAddExtraSet = () => {
    const updatedResults = [...workoutResults];
    const currentSets = updatedResults[viewIndex].sets;
    const lastSet = currentSets[currentSets.length - 1];
    currentSets.push({ reps: lastSet ? lastSet.reps : '0', weight: lastSet ? lastSet.weight : '0', isCompleted: false });
    setWorkoutResults(updatedResults);
  };

  const handleRemoveLastSet = () => {
    if (currentResult.sets.length > 1) {
      Alert.alert("Usuń serię", "Czy na pewno chcesz usunąć ostatnią serię z tego ćwiczenia?", [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: () => {
            clearTimerCore();
            const updatedResults = [...workoutResults];
            updatedResults[viewIndex].sets.pop();
            setWorkoutResults(updatedResults);
          }
        }
      ]);
    } else {
      Alert.alert("Błąd", "Nie możesz usunąć jedynej serii w ćwiczeniu!");
    }
  };

  const saveToHistory = async () => {
    try {
      const now = new Date();
      const dateString = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth()+1).toString().padStart(2, '0')}.${now.getFullYear()}`;

      const newHistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        date: dateString,
        planName: activePlanName,
        exercises: workoutResults 
      };

      const savedHistory = await AsyncStorage.getItem('workoutHistory');
      const historyArray = savedHistory ? JSON.parse(savedHistory) : [];
      historyArray.push(newHistoryItem);

      await AsyncStorage.setItem('workoutHistory', JSON.stringify(historyArray));
      await AsyncStorage.removeItem('activeWorkoutId');
      await AsyncStorage.removeItem('ongoingWorkoutState'); 
      setHasActiveWorkout(false);
      setWorkoutPlan([]); 
      router.push('/history');
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się zapisać historii treningu.");
    }
  };

  const handleResetCurrentExercise = () => {
    Alert.alert("Reset ćwiczenia", "Wybierz rodzaj resetu:", [
      { text: "Anuluj", style: "cancel" },
      { text: "Tylko odznacz serie", onPress: () => {
          clearTimerCore();
          setIsExerciseResting(false);
          const updatedResults = [...workoutResults];
          updatedResults[viewIndex].sets.forEach(s => s.isCompleted = false);
          setWorkoutResults(updatedResults);
          if (viewIndex <= activeExerciseIndex) setActiveExerciseIndex(viewIndex);
        }
      },
      { text: "Przywróć dane z planu", style: "destructive", onPress: () => {
          clearTimerCore();
          setIsExerciseResting(false);
          const originalEx = workoutPlan[viewIndex];
          const updatedResults = [...workoutResults];
          updatedResults[viewIndex] = {
             ...updatedResults[viewIndex],
             notes: '',
             sets: Array.from({ length: originalEx.sets }).map(() => ({ reps: originalEx.reps.toString(), weight: originalEx.targetWeight.toString(), isCompleted: false }))
          };
          setWorkoutResults(updatedResults);
          setAltComboIndex(0);
          if (viewIndex <= activeExerciseIndex) setActiveExerciseIndex(viewIndex);
        }
      }
    ]);
  };

  const handleAbortWorkout = () => {
    Alert.alert("Przerwij trening", "Czy na pewno chcesz całkowicie zresetować dzisiejszy trening i wrócić do głównego menu?", [
      { text: "Wracam do ćwiczeń", style: "cancel" },
      { text: "Przerwij", style: "destructive", onPress: async () => {
        clearTimerCore(); 
        setIsExerciseResting(false);
          await AsyncStorage.removeItem('activeWorkoutId');
          await AsyncStorage.removeItem('ongoingWorkoutState'); 
          setHasActiveWorkout(false);
          setWorkoutPlan([]);
          router.push('/');
        }
      }
    ]);
  };

  const calculatePlates = () => {
    if (!selectedBarbell || !currentExercise) return null;
    if (selectedBarbell.id === 'bw') {
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.successText}>Trening bez sztangi / Hantle</Text>
          <Text style={{color: colors.textMuted, fontSize: 13, marginTop: 5}}>Kalkulator talerzy na strony został ukryty.</Text>
        </View>
      );
    }
    
    const isSingleSided = selectedBarbell.id === 'machine_single';
    const barbellWeight = parseFloat(String(selectedBarbell.weight).replace(',', '.')) || 0;
    const target = parseFloat(String(getActiveSetWeight()).replace(',', '.')) || 0;
    let remainingWeight = target - barbellWeight;

    if (remainingWeight < 0) return <Text style={styles.errorText}>Wybrany sprzęt ({barbellWeight}kg) jest cięższy niż cel ({target}kg)!</Text>;
    if (remainingWeight === 0 && barbellWeight > 0) return <Text style={styles.successText}>Podnosisz sam sprzęt!</Text>;
    if (remainingWeight === 0 && barbellWeight === 0) return <Text style={styles.successText}>Brak ciężaru docelowego!</Text>;

    let weightToFill = isSingleSided ? remainingWeight : remainingWeight / 2;

    const usablePlates = plates
      .map(p => ({ weight: parseFloat(String(p.weight).replace(',', '.')), count: parseInt(p.count) }))
      .filter(p => !isNaN(p.weight) && !isNaN(p.count) && p.count > 0)
      .map(p => ({ weight: p.weight, count: isSingleSided ? p.count : Math.floor(p.count / 2) }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.weight - a.weight);

    const combinations = [];
    const findCombinations = (index, currentSum, currentCombo) => {
      if (combinations.length >= 30) return;
      if (Math.abs(currentSum - weightToFill) < 0.01) {
        combinations.push(currentCombo.filter(c => c.count > 0));
        return;
      }
      if (currentSum > weightToFill + 0.01 || index >= usablePlates.length) return;
      const plate = usablePlates[index];
      for (let i = plate.count; i >= 0; i--) {
        currentCombo.push({ weight: plate.weight, count: i });
        findCombinations(index + 1, currentSum + i * plate.weight, currentCombo);
        currentCombo.pop();
      }
    };

    findCombinations(0, 0, []);

    if (combinations.length === 0) {
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.errorText}>Nie masz odpowiednich talerzy, aby złożyć ten ciężar!</Text>
          <Text style={[styles.errorText, { marginTop: 5, fontSize: 14, color: colors.warning }]}>
            Z obecnym arsenałem nie złożysz {isSingleSided ? weightToFill : weightToFill * 2} kg idealnie.
          </Text>
        </View>
      );
    }

    const safeIndex = altComboIndex % combinations.length;
    const selectedCombination = combinations[safeIndex];

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>
          {isSingleSided ? "Załóż ŁĄCZNIE (jednostronnie):" : "Załóż na JEDNĄ STRONĘ:"}
        </Text>
        <View style={styles.platesRow}>
          {selectedCombination.map((plate, index) => (
            <View key={index} style={styles.plateCircle}>
              <Text style={styles.plateText}>{plate.weight} kg</Text>
              {plate.count > 1 && <View style={styles.plateBadge}><Text style={styles.plateBadgeText}>x{plate.count}</Text></View>}
            </View>
          ))}
        </View>
        <View style={{flexDirection: 'row', marginTop: 10}}>
          {combinations.length > 1 && (
            <TouchableOpacity onPress={() => setAltComboIndex(prev => prev + 1)} style={{marginRight: 15}}>
              <Text style={{color: colors.primary, fontSize: 13, fontWeight: 'bold'}}>
                Inne ułożenie 🔄 ({safeIndex + 1}/{combinations.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!isLoaded) return <View style={styles.container}><Text style={{color: colors.text}}>Przygotowuję trening...</Text></View>;
  
  if (!hasActiveWorkout || !currentExercise) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={styles.noWorkoutEmoji}>😴</Text>
      <Text style={styles.noWorkoutTitle}>Brak aktywnego treningu</Text>
      <Text style={styles.noWorkoutSubtitle}>Wybierz swój plan treningowy z zakładki "Moje plany" i rozpocznij go, aby się tutaj pojawił.</Text>
      <TouchableOpacity style={[styles.nextButton, {marginTop: 30, paddingHorizontal: 40}]} onPress={() => router.push('/')}>
        <Text style={styles.nextButtonText}>Przejdź do planów</Text>
      </TouchableOpacity>
    </View>
  );

  if (isWorkoutFinished) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
          <View style={styles.summaryHeaderBox}>
            <Text style={styles.summaryEmoji}>🏆</Text>
            <Text style={styles.summaryTitle}>Trening Zakończony!</Text>
            <Text style={styles.summarySubtitle}>Sprawdź wyniki i zapisz do historii.</Text>
          </View>
          {workoutResults.map((exResult, exIndex) => (
            <View key={exIndex} style={styles.summaryCard}>
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
                    <TextInput style={styles.summaryInput} keyboardType="numeric" value={setObj.reps} onChangeText={(val) => updateSetResult(exIndex, setIndex, 'reps', val)} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 5 }}>
                    <TextInput style={styles.summaryInput} keyboardType="numeric" value={setObj.weight} onChangeText={(val) => updateSetResult(exIndex, setIndex, 'weight', val)} />
                  </View>
                </View>
              ))}
              <TextInput style={styles.summaryNoteInput} placeholder="Notatka..." placeholderTextColor={colors.textMuted} value={exResult.notes} onChangeText={(val) => updateNote(exIndex, val)} />
            </View>
          ))}
          <TouchableOpacity style={styles.saveHistoryBtn} onPress={saveToHistory}>
            <Text style={styles.saveHistoryBtnText}>Zapisz do historii </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const activeWeight = getActiveSetWeight();
  const allCurrentSetsCompleted = currentResult?.sets.every(s => s.isCompleted);
  const isViewingRestingExercise = isExerciseResting && viewIndex === activeExerciseIndex;
  
  
  const isAnyTimerRunning = timerEndTime !== null && timeLeft > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        
        {viewIndex > activeExerciseIndex && (
           <View style={styles.previewBanner}>
              <Text style={styles.previewBannerText}>⚠️ PODGLĄD - Wróć do aktualnego ćwiczenia</Text>
           </View>
        )}
        {viewIndex < activeExerciseIndex && (
           <View style={styles.editBanner}>
              <Text style={styles.editBannerText}>📝 EDYCJA - Trening trwa w kolejnych etapach</Text>
           </View>
        )}

        <View style={styles.activePlanBadge}>
          <Text style={styles.activePlanBadgeText}>PLAN: {activePlanName.toUpperCase()}</Text>
        </View>

        <Text style={styles.progressText}>
          Ćwiczenie {viewIndex + 1} z {workoutPlan.length}
        </Text>

        <View style={styles.header}>
          <Text style={styles.exerciseName}>{currentExercise.name}</Text>
          <Text style={styles.targetWeight}>Bieżący ciężar: {activeWeight} kg</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sprzęt:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barbellList}>
            {barbells.map((barbell) => (
              <TouchableOpacity key={barbell.id} style={[styles.barbellButton, selectedBarbell?.id === barbell.id && styles.barbellButtonSelected]} onPress={() => setSelectedBarbell(barbell)}>
                <Text style={[styles.barbellButtonText, selectedBarbell?.id === barbell.id && styles.barbellButtonTextSelected]}>
                  {barbell.name} {barbell.weight !== '0' && `(${barbell.weight} kg)`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.calculatorBox}>
          {calculatePlates()}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Twoje serie:</Text>
            <TouchableOpacity onPress={handleResetCurrentExercise}>
              <Text style={styles.resetText}>↺ Resetuj</Text>
            </TouchableOpacity>
          </View>
          
          {currentResult && currentResult.sets.map((setObj, index) => {
            const isThisTimerActive = activeTimerIndex === index && activeTimerExerciseIndex === viewIndex;
            
            
            const isDisabled = viewIndex > activeExerciseIndex || isAnyTimerRunning;

            return (
              <View key={index} style={styles.setRow}>
                <View style={styles.setInfoBox}>
                  <Text style={[styles.setText, setObj.isCompleted && styles.setTextCompleted]}>
                    Seria {index + 1}
                  </Text>
                </View>

                <View style={styles.setInputsBox}>
                  <TextInput style={[styles.inlineInput, setObj.isCompleted && styles.inlineInputCompleted]} value={setObj.reps} onChangeText={(val) => updateSetResult(viewIndex, index, 'reps', val)} keyboardType="numeric" />
                  <Text style={styles.inlineText}>x</Text>
                  <TextInput style={[styles.inlineInput, setObj.isCompleted && styles.inlineInputCompleted]} value={setObj.weight} onChangeText={(val) => updateSetResult(viewIndex, index, 'weight', val)} keyboardType="numeric" />
                  <Text style={styles.inlineText}>kg</Text>
                </View>

                <View style={styles.setActionBox}>
                  {isThisTimerActive ? (
                    <TouchableOpacity style={styles.timerButton} onPress={skipTimer}>
                      <Text style={styles.timerButtonText}>{timeLeft}s ⏭️</Text>
                    </TouchableOpacity>
                  ) : setObj.isCompleted ? (
                    <View style={styles.completedButton}>
                      <Text style={styles.completedButtonText}>✓</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.finishButton, isDisabled && styles.disabledButton]} onPress={() => handleFinishSet(index)} disabled={isDisabled}>
                      <Text style={styles.finishButtonText}>Zakończ</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {currentResult && (
            <>
              <View style={styles.setButtonsRow}>
                <TouchableOpacity style={styles.addSetButton} onPress={handleAddExtraSet}>
                  <Text style={styles.addSetButtonText}>+ Dodaj serię</Text>
                </TouchableOpacity>
                {currentResult.sets.length > 1 && (
                  <TouchableOpacity style={styles.removeSetButton} onPress={handleRemoveLastSet}>
                    <Text style={styles.removeSetButtonText}>- Usuń ostatnią</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput style={styles.activeNoteInput} placeholder="Notatka z tego ćwiczenia..." placeholderTextColor={colors.textMuted} value={currentResult.notes} onChangeText={(val) => updateNote(viewIndex, val)} />
            </>
          )}
        </View>

        {/* --- KWADRACIKI NAWIGACJI --- */}
        <View style={styles.navGrid}>
          {workoutPlan.map((ex, idx) => {
            const isViewing = idx === viewIndex;
            const isDone = workoutResults[idx]?.sets.every(s => s.isCompleted);
            return (
              <TouchableOpacity 
                key={idx} 
                onPress={() => setViewIndex(idx)}
                style={[
                  styles.navSquare, 
                  isDone && { backgroundColor: colors.success, borderColor: colors.success },
                  isViewing && { borderColor: colors.primary, borderWidth: 2 }
                ]}
              >
                <Text style={[styles.navSquareText, isDone && {color: '#fff'}, isViewing && !isDone && {color: colors.primary}]}>
                  {isDone ? "✓" : idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.bottomNavRow}>
           <TouchableOpacity 
              style={[styles.navHalfButton, viewIndex === 0 && styles.navHalfButtonDisabled]} 
              disabled={viewIndex === 0}
              onPress={() => setViewIndex(viewIndex - 1)}
           >
              <Text style={styles.navHalfButtonText}>❮ Poprzednie</Text>
           </TouchableOpacity>

           {(() => {
              if (viewIndex < activeExerciseIndex) {
                 return (
                    <TouchableOpacity style={styles.navHalfButton} onPress={() => setViewIndex(viewIndex + 1)}>
                       <Text style={styles.navHalfButtonText}>Następne ❯</Text>
                    </TouchableOpacity>
                 );
              } else if (viewIndex === activeExerciseIndex) {
                 if (allCurrentSetsCompleted) {
                    const isLast = viewIndex === workoutPlan.length - 1;
                    return (
                       <TouchableOpacity style={styles.navHalfButtonPrimary} onPress={handleAdvanceExercise}>
                          <Text style={styles.navHalfButtonPrimaryText}>{isLast ? "ZAKOŃCZ 🏆" : "NAST. ĆWICZ. ➡️"}</Text>
                       </TouchableOpacity>
                    );
                 } else {
                    const isLast = viewIndex === workoutPlan.length - 1;
                    return (
                       <TouchableOpacity 
                          style={[styles.navHalfButton, isLast && styles.navHalfButtonDisabled]} 
                          disabled={isLast}
                          onPress={() => setViewIndex(viewIndex + 1)}
                       >
                          <Text style={styles.navHalfButtonText}>Podgląd ❯</Text>
                       </TouchableOpacity>
                    );
                 }
              } else {
                 const isLast = viewIndex === workoutPlan.length - 1;
                 return (
                    <TouchableOpacity 
                       style={[styles.navHalfButton, isLast && styles.navHalfButtonDisabled]} 
                       disabled={isLast}
                       onPress={() => setViewIndex(viewIndex + 1)}
                    >
                       <Text style={styles.navHalfButtonText}>Podgląd ❯</Text>
                    </TouchableOpacity>
                 );
              }
           })()}
        </View>

        {isViewingRestingExercise && timeLeft > 0 && (
          <TouchableOpacity style={styles.bigYellowTimerBtn} onPress={skipTimer}>
             <Text style={styles.bigYellowTimerText}>PRZERWA: {timeLeft}s (POMIŃ ⏭️)</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleAbortWorkout} style={styles.abortWorkoutButton}>
          <Text style={styles.abortWorkoutText}>Zakończ awaryjnie (Resetuj plan)</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 15, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  previewBanner: { backgroundColor: colors.warning, padding: 10, alignItems: 'center', borderRadius: 8, marginBottom: 10 },
  previewBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  editBanner: { backgroundColor: colors.primary, padding: 10, alignItems: 'center', borderRadius: 8, marginBottom: 10 },
  editBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  activePlanBadge: { backgroundColor: colors.cardSecondary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, alignSelf: 'center', marginTop: 10, marginBottom: 5 },
  activePlanBadgeText: { color: colors.primary, fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  progressText: { textAlign: 'center', color: colors.textMuted, fontWeight: 'bold', fontSize: 12 },
  header: { alignItems: 'center', marginVertical: 10 },
  exerciseName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, color: colors.text },
  targetWeight: { fontSize: 18, color: colors.primary, fontWeight: '800' },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 8, color: colors.text },
  barbellList: { flexDirection: 'row', marginBottom: 5 },
  barbellButton: { backgroundColor: colors.card, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 15, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  barbellButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  barbellButtonText: { color: colors.text, fontSize: 13 },
  barbellButtonTextSelected: { color: '#fff', fontWeight: 'bold' },
  calculatorBox: { backgroundColor: colors.card, padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  resultContainer: { alignItems: 'center' },
  resultTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  platesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  plateCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: isDark ? '#444' : '#333', justifyContent: 'center', alignItems: 'center', margin: 4, position: 'relative' },
  plateText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  plateBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: colors.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  plateBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  errorText: { color: colors.danger, fontWeight: 'bold', textAlign: 'center', fontSize: 14 },
  successText: { color: colors.success, fontWeight: 'bold', textAlign: 'center', fontSize: 14 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8 },
  setInfoBox: { width: 60 },
  setText: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  setTextCompleted: { textDecorationLine: 'line-through', color: colors.textMuted },
  setInputsBox: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  inlineInput: { backgroundColor: colors.background, color: colors.text, fontWeight: 'bold', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 2, borderRadius: 6, borderWidth: 1, borderColor: colors.border, minWidth: 40, fontSize: 14 },
  inlineInputCompleted: { opacity: 0.5 },
  inlineText: { color: colors.textMuted, fontSize: 12, marginHorizontal: 4, fontWeight: 'bold' },
  setActionBox: { width: 85, alignItems: 'flex-end' },
  finishButton: { backgroundColor: colors.success, paddingVertical: 8, width: '100%', alignItems: 'center', borderRadius: 6 },
  finishButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  disabledButton: { backgroundColor: colors.cardSecondary, opacity: 0.7 },
  timerButton: { backgroundColor: colors.warning, paddingVertical: 8, width: '100%', alignItems: 'center', borderRadius: 6 },
  timerButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  completedButton: { backgroundColor: colors.cardSecondary, paddingVertical: 8, width: '100%', alignItems: 'center', borderRadius: 6 },
  completedButtonText: { color: colors.textMuted, fontWeight: 'bold', fontSize: 14 },
  setButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  addSetButton: { flex: 1, backgroundColor: colors.cardSecondary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 5, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginRight: 5 },
  removeSetButton: { flex: 1, backgroundColor: 'rgba(255, 59, 48, 0.1)', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 5, borderWidth: 1, borderColor: colors.danger, borderStyle: 'dashed', marginLeft: 5 },
  addSetButtonText: { color: colors.primary, fontWeight: 'bold', fontSize: 13 },
  removeSetButtonText: { color: colors.danger, fontWeight: 'bold', fontSize: 13 },
  activeNoteInput: { backgroundColor: colors.card, color: colors.text, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, fontSize: 14, marginBottom: 10 },
  bottomNavRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  navHalfButton: { flex: 1, backgroundColor: colors.cardSecondary, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, borderColor: colors.border },
  navHalfButtonText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
  navHalfButtonDisabled: { opacity: 0.3 },
  navHalfButtonPrimary: { flex: 1, backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  navHalfButtonPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  bigYellowTimerBtn: { backgroundColor: colors.warning, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, shadowColor: colors.warning, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4 },
  bigYellowTimerText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resetText: { color: colors.danger, fontSize: 12, fontWeight: 'bold' },
  abortWorkoutButton: { marginTop: 25, alignItems: 'center', padding: 10 },
  abortWorkoutText: { color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline' },
  summaryHeaderBox: { alignItems: 'center', marginBottom: 25 },
  summaryEmoji: { fontSize: 60, marginBottom: 10 },
  summaryTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
  summarySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 10 },
  summaryCard: { backgroundColor: colors.card, padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
  summaryExerciseName: { fontSize: 16, fontWeight: 'bold', color: colors.primary, marginBottom: 15 },
  summarySetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: 'bold' },
  summarySetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  summarySetNumberBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  summarySetNumberText: { color: colors.text, fontWeight: 'bold', fontSize: 12 },
  summaryInput: { backgroundColor: colors.cardSecondary, color: colors.text, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  summaryNoteInput: { backgroundColor: colors.cardSecondary, color: colors.text, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, fontSize: 14, marginTop: 5 },
  saveHistoryBtn: { backgroundColor: colors.success, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: colors.success, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  saveHistoryBtnText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  cancelHistoryBtn: { marginTop: 20, alignItems: 'center', padding: 10 },
  cancelHistoryBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: 'bold' },
  noWorkoutEmoji: { fontSize: 60, marginBottom: 15 },
  noWorkoutTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  noWorkoutSubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },
  nextButton: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 5, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  nextButtonText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 15 },
  navSquare: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.cardSecondary, justifyContent: 'center', alignItems: 'center', margin: 5, borderWidth: 1, borderColor: colors.border },
  navSquareText: { fontWeight: 'bold', color: colors.textMuted, fontSize: 16 }
});