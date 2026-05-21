import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useContext } from 'react';
import { ThemeContext } from '../ThemeContext';

export default function TabLayout() {
  const { colors } = useContext(ThemeContext);

  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: colors.primary, 
        tabBarInactiveTintColor: colors.textMuted, 
        headerShown: false, 
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60, 
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Moje plany',
          tabBarIcon: ({ color }) => <Ionicons name="clipboard-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Trening',
          tabBarIcon: ({ color }) => <Ionicons name="barbell-outline" size={28} color={color} />,
        }}
      />
      {}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historia',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore" 
        options={{
          title: 'Ustawienia',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}