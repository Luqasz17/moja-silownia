import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';


export const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  
  const systemTheme = useColorScheme(); 

  const [themeMode, setThemeMode] = useState('system'); 

 
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        if (savedTheme) {
          setThemeMode(savedTheme);
        }
      } catch (error) {
        console.log("Błąd ładowania motywu", error);
      }
    };
    loadTheme();
  }, []);

  
  const updateTheme = async (newTheme: string) => {
    setThemeMode(newTheme);
    await AsyncStorage.setItem('appTheme', newTheme);
  };

 
  const isDark = themeMode === 'system' ? systemTheme === 'dark' : themeMode === 'dark';

  
  const colors = {
    background: isDark ? '#121212' : '#f5f5f5', 
    card: isDark ? '#1E1E1E' : '#fff',          
    text: isDark ? '#FFFFFF' : '#333333',       
    textMuted: isDark ? '#A0A0A5' : '#666666',  
    border: isDark ? '#333333' : '#cccccc',     
    cardSecondary: isDark ? '#2C2C2E' : '#E5E5EA', 
    
  
    primary: isDark ? '#0A84FF' : '#007AFF',    
    success: isDark ? '#30D158' : '#34C759',    
    danger:  isDark ? '#FF453A' : '#FF3B30',    
    warning: isDark ? '#FF9F0A' : '#FF9500',    
  };

  return (
    <ThemeContext.Provider value={{ themeMode, updateTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};