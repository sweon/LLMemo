import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import { lightTheme, darkTheme } from '../theme';
import { GlobalStyle } from '../GlobalStyle';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
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
        const saved = localStorage.getItem('theme');
        return (saved as ThemeMode) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    });

    const [fontSize, setFontSize] = useState<number>(() => {
        const saved = localStorage.getItem('fontSize');
        return saved ? Number(saved) : 16;
    });

    useEffect(() => {
        localStorage.setItem('theme', mode);
    }, [mode]);

    useEffect(() => {
        localStorage.setItem('fontSize', fontSize.toString());
    }, [fontSize]);

    const toggleTheme = () => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const increaseFontSize = () => {
        setFontSize(prev => Math.min(prev + 1, 24));
    };

    const decreaseFontSize = () => {
        setFontSize(prev => Math.max(prev - 1, 12));
    };

    const currentTheme = {
        ...(mode === 'light' ? lightTheme : darkTheme),
        fontSize
    };

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme, fontSize, increaseFontSize, decreaseFontSize, theme: currentTheme }}>
            <StyledThemeProvider theme={currentTheme}>
                <GlobalStyle />
                {children}
            </StyledThemeProvider>
        </ThemeContext.Provider>
    );
};
