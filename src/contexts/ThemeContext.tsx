import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import { lightThemes, darkThemes } from '../theme';
import type { ThemeMode } from '../theme';
import { GlobalStyle } from '../GlobalStyle';

interface ThemeContextType {
    mode: ThemeMode;
    themeName: string;
    toggleTheme: () => void;
    setTheme: (name: string) => void;
    fontSize: number;
    increaseFontSize: () => void;
    decreaseFontSize: () => void;
    theme: DefaultTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('themeMode');
        return (saved as ThemeMode) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    });

    const [lightThemeName, setLightThemeName] = useState<string>(() => {
        return localStorage.getItem('lightThemeName') || 'Classic';
    });

    const [darkThemeName, setDarkThemeName] = useState<string>(() => {
        return localStorage.getItem('darkThemeName') || 'Dark';
    });

    const [fontSize, setFontSize] = useState<number>(() => {
        const saved = localStorage.getItem('fontSize');
        return saved ? Number(saved) : 16;
    });

    useEffect(() => {
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    useEffect(() => {
        localStorage.setItem('lightThemeName', lightThemeName);
    }, [lightThemeName]);

    useEffect(() => {
        localStorage.setItem('darkThemeName', darkThemeName);
    }, [darkThemeName]);

    useEffect(() => {
        localStorage.setItem('fontSize', fontSize.toString());
    }, [fontSize]);

    const toggleTheme = () => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const setTheme = (name: string) => {
        if (mode === 'light') {
            setLightThemeName(name);
        } else {
            setDarkThemeName(name);
        }
    };

    const increaseFontSize = () => {
        setFontSize(prev => Math.min(prev + 1, 24));
    };

    const decreaseFontSize = () => {
        setFontSize(prev => Math.max(prev - 1, 12));
    };

    const themeName = mode === 'light' ? lightThemeName : darkThemeName;
    const baseTheme = mode === 'light' ? lightThemes[lightThemeName] || lightThemes.Classic : darkThemes[darkThemeName] || darkThemes.Dark;

    const currentTheme = {
        ...baseTheme,
        fontSize
    };

    return (
        <ThemeContext.Provider value={{
            mode,
            themeName,
            toggleTheme,
            setTheme,
            fontSize,
            increaseFontSize,
            decreaseFontSize,
            theme: currentTheme
        }}>
            <StyledThemeProvider theme={currentTheme}>
                <GlobalStyle />
                {children}
            </StyledThemeProvider>
        </ThemeContext.Provider>
    );
};

