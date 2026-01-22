import { useAuth } from '@/features/auth/context/AuthContext';

export const useGenderTheme = () => {
    const { profile } = useAuth();
    const isFemale = profile?.gender === 'female';

    // Colors
    const femaleColors = {
        background: '#F5D7E8', // User defined pink
        primary: '#89CFF0', // Pastel Blue (Baby Blue) - darker than previous to be visible as button
        card: '#FFFFFF', // White
        text: '#000000',
    };

    return {
        isFemale,
        colors: {
            background: isFemale ? femaleColors.background : undefined,
            card: isFemale ? femaleColors.card : undefined,
            text: isFemale ? femaleColors.text : undefined,
            primary: isFemale ? femaleColors.primary : '#C9A66B', // Default Ochre
            // For navigation theme
            navBackground: isFemale ? '#FFFFFF' : '#FAF9F6', // Navbar is now White
        },
        // Helper classes for NativeWind (Note: colors.primary needs inline style usually as Custom Class isn't generated dynamically easily)
        classes: {
            background: isFemale ? 'bg-[#F5D7E8]' : 'bg-background-light dark:bg-background-dark',
            card: isFemale ? 'bg-white' : 'bg-white dark:bg-[#1A1A1A]', // Unselected cards are white
            text: isFemale ? 'text-black' : 'text-charcoal dark:text-white',
            border: isFemale ? 'border-gray-200' : 'border-gray-200 dark:border-white/10',
            tabBar: isFemale ? 'bg-white' : 'bg-background-light dark:bg-background-dark', // TabBar is White
        }
    };
};

