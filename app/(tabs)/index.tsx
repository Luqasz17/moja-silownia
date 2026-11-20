import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemeContext } from '../../context/ThemeContext';
import { SyncEvents } from '../../hooks/SyncEvents';

interface Exercise {
  id: string;
  name: string;
  targetWeight: string | number;
  sets: number;
  reps: number;
}

interface Plan {
  id: string;
  name: string;
  exercises: Exercise[];
  isHidden?: boolean;
}

export default function HomeScreen() {
  const { colors } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [currentActiveWorkoutId, setCurrentActiveWorkoutId] = useState<string | null>(null);

  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  const [newPlanName, setNewPlanName] = useState('');
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newSets, setNewSets] = useState('');
  const [newReps, setNewReps] = useState('');

  const [reminderNote, setReminderNote] = useState("");

  const [showHiddenPlans, setShowHiddenPlans] = useState(false);
  
  const [lastDeletedPlan, setLastDeletedPlan] = useState<Plan | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(0);

  // Szybka edycja & Zmiana kolejności
  const [quickEditExercise, setQuickEditExercise] = useState<Exercise | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [highlightedExerciseId, setHighlightedExerciseId] = useState<string | null>(null);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);

  const plansRef = useRef(plans);
  plansRef.current = plans;

  const activePlanIdRef = useRef(activePlanId);
  activePlanIdRef.current = activePlanId;

  const containerRef = useRef<any>(null);
  const containerPageYRef = useRef<number>(0);
  const itemLayouts = useRef<{ y: number; height: number }[]>([]);
  const startYRef = useRef<number>(0);
  const activeDragIndexRef = useRef<number | null>(null);

  const updateContainerPageY = () => {
    containerRef.current?.measureInWindow((x: number, y: number) => {
      if (typeof y === 'number' && y > 0) {
        containerPageYRef.current = y;
      }
    });
  };

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
              const firstVisible = parsed.find((p: Plan) => !p.isHidden);
              setActivePlanId(firstVisible ? firstVisible.id : parsed[0].id);
            }
          }
        } catch (error) { console.log(error); }
      };
      loadPlansAndActiveWorkout();
    }, [activePlanId])
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (undoSeconds > 0) {
      interval = setInterval(() => {
        setUndoSeconds(prev => prev - 1);
      }, 1000);
    } else {
      setLastDeletedPlan(null);
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [undoSeconds]);

  const savePlans = async (updatedPlans: Plan[]) => {
    setPlans(updatedPlans);
    await AsyncStorage.setItem('workoutPlans', JSON.stringify(updatedPlans));
    SyncEvents.emitDataChanged();
  };

  const addPlan = () => {
    if (newPlanName.trim() === '') {
      Alert.alert("Błąd", "Podaj nazwę nowego planu!");
      return;
    }
    let updatedPlans: Plan[];
    if (editingPlanId) {
      updatedPlans = plans.map(p => p.id === editingPlanId ? { ...p, name: newPlanName } : p);
    } else {
      const newPlan: Plan = { id: Date.now().toString(), name: newPlanName, exercises: [], isHidden: false };
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

  const movePlan = (dir: 'left' | 'right', plan: Plan) => {
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

  const toggleHidePlan = (plan: Plan) => {
    const updated = plans.map(p => p.id === plan.id ? { ...p, isHidden: !p.isHidden } : p);
    savePlans(updated);
  };

  const confirmDeletePlan = (plan: Plan) => {
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

  
  const handleLongPressPlan = (plan: Plan) => {
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

  const editExercise = (exercise: Exercise) => {
    setEditingExerciseId(exercise.id);
    setNewName(exercise.name);
    setNewWeight(exercise.targetWeight.toString());
    setNewSets(exercise.sets.toString());
    setNewReps(exercise.reps.toString());
    setIsCreatingExercise(true);
  };

  const removeExercise = async (exerciseId: string) => {
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

  const findIndexAtY = (y: number, count: number) => {
    if (count <= 1) return 0;
    for (let i = 0; i < count; i++) {
      const l = itemLayouts.current[i];
      if (l) {
        const top = l.y;
        const bottom = l.y + l.height + 8;
        if (y >= top && y <= bottom) {
          return i;
        }
      }
    }
    const last = itemLayouts.current[count - 1];
    if (last && y >= last.y + last.height) {
      return count - 1;
    }
    if (y <= 0) return 0;
    const rowH = itemLayouts.current[0]?.height ? itemLayouts.current[0].height + 8 : 64;
    const approx = Math.floor(y / rowH);
    return Math.min(Math.max(0, approx), count - 1);
  };

  const reorderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          let currentY = evt.nativeEvent.locationY;
          if (containerPageYRef.current > 0 && evt.nativeEvent.pageY > 0) {
            const calcY = evt.nativeEvent.pageY - containerPageYRef.current;
            if (calcY >= 0) {
              currentY = calcY;
            }
          }
          startYRef.current = currentY;

          const currentPlan = plansRef.current.find(p => p.id === activePlanIdRef.current);
          const count = currentPlan?.exercises.length || 0;
          const idx = findIndexAtY(currentY, count);
          activeDragIndexRef.current = idx;
          setActiveDragIndex(idx);

          if (currentPlan && currentPlan.exercises[idx]) {
            setHighlightedExerciseId(currentPlan.exercises[idx].id);
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
        onPanResponderMove: (evt, gestureState) => {
          const curIdx = activeDragIndexRef.current;
          if (curIdx === null) return;

          let currentY = startYRef.current + gestureState.dy;
          if (containerPageYRef.current > 0 && evt.nativeEvent.pageY > 0) {
            currentY = evt.nativeEvent.pageY - containerPageYRef.current;
          }

          const currentPlan = plansRef.current.find(p => p.id === activePlanIdRef.current);
          if (!currentPlan) return;
          const count = currentPlan.exercises.length;
          const targetIdx = findIndexAtY(currentY, count);

          if (targetIdx !== curIdx && targetIdx >= 0 && targetIdx < count) {
            const newExs = [...currentPlan.exercises];
            const [movedItem] = newExs.splice(curIdx, 1);
            newExs.splice(targetIdx, 0, movedItem);
            activeDragIndexRef.current = targetIdx;
            setActiveDragIndex(targetIdx);

            const updatedPlans = plansRef.current.map(p =>
              p.id === activePlanIdRef.current ? { ...p, exercises: newExs } : p
            );
            setPlans(updatedPlans);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        onPanResponderRelease: () => {
          activeDragIndexRef.current = null;
          setActiveDragIndex(null);
          savePlans(plansRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(updateContainerPageY, 80);
        },
        onPanResponderTerminate: () => {
          activeDragIndexRef.current = null;
          setActiveDragIndex(null);
        },
      }),
    []
  );

  const adjustQuickEdit = async (field: 'sets' | 'reps' | 'targetWeight', delta: number) => {
    if (!quickEditExercise || !activePlanId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let updatedEx: Exercise | null = null;
    const updatedPlans = plans.map(p => {
      if (p.id !== activePlanId) return p;
      return {
        ...p,
        exercises: p.exercises.map(e => {
          if (e.id !== quickEditExercise.id) return e;
          if (field === 'sets') {
            const newVal = Math.max(1, (Number(e.sets) || 1) + delta);
            updatedEx = { ...e, sets: newVal };
          } else if (field === 'reps') {
            const newVal = Math.max(1, (Number(e.reps) || 1) + delta);
            updatedEx = { ...e, reps: newVal };
          } else {
            const cur = parseFloat(String(e.targetWeight).replace(',', '.')) || 0;
            const newVal = Math.max(0, parseFloat((cur + delta).toFixed(2)));
            updatedEx = { ...e, targetWeight: newVal };
          }
          return updatedEx;
        }),
      };
    });

    if (updatedEx) {
      setQuickEditExercise(updatedEx);
      savePlans(updatedPlans);
      if (activePlanId === currentActiveWorkoutId) {
        await AsyncStorage.removeItem('ongoingWorkoutState');
      }
    }
  };

  const startWorkout = async () => {
    if (!activePlanId) return;
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
        <ScrollView style={styles.container} scrollEnabled={!isReorderMode} keyboardShouldPersistTaps="handled">
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

                {isReorderMode && (
                  <View style={styles.reorderBar}>
                    <Text style={styles.reorderBarTitle}>Przeciągnij ćwiczenie w górę lub w dół</Text>
                    <TouchableOpacity
                      style={styles.reorderDoneBtn}
                      onPress={() => {
                        setIsReorderMode(false);
                        setHighlightedExerciseId(null);
                        setActiveDragIndex(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.reorderDoneBtnText}>Gotowe</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {activePlan.exercises.length === 0 ? (
                  <Text style={styles.emptyText}>Brak ćwiczeń. Dodaj coś poniżej!</Text>
                ) : (
                  <View
                    ref={containerRef}
                    pointerEvents={isReorderMode ? "box-only" : "auto"}
                    onLayout={updateContainerPageY}
                    {...(isReorderMode ? reorderPanResponder.panHandlers : {})}
                  >
                    {activePlan.exercises.map((exercise, index) => (
                      <View
                        key={exercise.id}
                        onLayout={(e) => {
                          itemLayouts.current[index] = e.nativeEvent.layout;
                        }}
                        style={[
                          styles.exerciseRow,
                          isReorderMode && styles.exerciseRowReorder,
                          activeDragIndex === index && styles.exerciseRowDragging,
                          highlightedExerciseId === exercise.id && !activeDragIndex && styles.exerciseRowHighlighted,
                        ]}
                      >
                        <TouchableOpacity
                          activeOpacity={isReorderMode ? 1 : 0.7}
                          onLongPress={() => {
                            if (!isReorderMode) {
                              setQuickEditExercise(exercise);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                          }}
                          delayLongPress={300}
                          style={{ flex: 1 }}
                        >
                          <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseName}>{index + 1}. {exercise.name}</Text>
                            <Text style={styles.exerciseDetails}>{exercise.sets} serie × {exercise.reps} powt. | {exercise.targetWeight} kg</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
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

      {/* Minimalistyczny Quick Edit Modal w stylu iOS */}
      <Modal
        visible={!!quickEditExercise}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickEditExercise(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => setQuickEditExercise(null)}
          />
          <View style={styles.modalContent}>
            {/* Nagłówek: nazwa i na żywo aktualizowane parametry */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {quickEditExercise?.name}
              </Text>
              <Text style={styles.modalSubtitle}>
                {quickEditExercise?.sets} serie · {quickEditExercise?.reps} powt. · {quickEditExercise?.targetWeight} kg
              </Text>
            </View>

            <View style={styles.modalSeparator} />

            {/* Przyciski szybkiej regulacji */}
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Serie</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustQuickEdit('sets', -1)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stepperBtnText}>–</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustQuickEdit('sets', 1)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Powtórzenia</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustQuickEdit('reps', -1)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stepperBtnText}>–</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustQuickEdit('reps', 1)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Ciężar</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={styles.stepperBtnWide}
                  onPress={() => adjustQuickEdit('targetWeight', -0.5)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stepperBtnWideText}>– 0.5 kg</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepperBtnWide}
                  onPress={() => adjustQuickEdit('targetWeight', 0.5)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stepperBtnWideText}>+ 0.5 kg</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalSeparator} />

            {/* Opcje */}
            <TouchableOpacity
              style={styles.modalActionRow}
              onPress={() => {
                const ex = quickEditExercise;
                setQuickEditExercise(null);
                if (ex) {
                  setIsReorderMode(true);
                  setHighlightedExerciseId(ex.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTimeout(updateContainerPageY, 60);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalActionText}>Zmień kolejność</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalActionRow}
              onPress={() => {
                const ex = quickEditExercise;
                setQuickEditExercise(null);
                if (ex) editExercise(ex);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalActionText}>Pełna edycja</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalActionRow}
              onPress={() => {
                const ex = quickEditExercise;
                setQuickEditExercise(null);
                if (ex) {
                  setTimeout(() => {
                    Alert.alert('Usuń ćwiczenie', `Czy na pewno chcesz usunąć „${ex.name}"?`, [
                      { text: 'Anuluj', style: 'cancel' },
                      { text: 'Usuń', style: 'destructive', onPress: () => removeExercise(ex.id) },
                    ]);
                  }, 200);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalActionText, { color: colors.danger }]}>Usuń ćwiczenie</Text>
            </TouchableOpacity>

            <View style={styles.modalSeparator} />

            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setQuickEditExercise(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalDoneButtonText}>Gotowe</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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

  reorderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardSecondary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reorderBarTitle: { fontSize: 13, color: colors.text, fontWeight: '500' },
  reorderDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  reorderDoneBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  exerciseRowReorder: {
    borderColor: colors.border,
  },
  exerciseRowDragging: {
    backgroundColor: colors.cardSecondary,
    borderColor: colors.primary,
    borderWidth: 1.5,
    transform: [{ scale: 1.02 }],
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  exerciseRowHighlighted: {
    borderColor: colors.primary,
  },
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
  undoBar: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#222', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 5, zIndex: 100 },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  modalSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  stepperLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    backgroundColor: colors.cardSecondary,
    width: 44,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperBtnText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
    lineHeight: 20,
  },
  stepperBtnWide: {
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperBtnWideText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  modalActionRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalActionText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
  modalDoneButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  modalDoneButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});