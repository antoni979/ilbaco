import React from 'react';
import { TouchableOpacity, Text, View, GestureResponderEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ButtonProps {
    onPress?: (event: GestureResponderEvent) => void;
    title: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
    variant?: 'primary' | 'secondary' | 'outline';
    className?: string;
    textClassName?: string;
    disabled?: boolean;
    center?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    onPress,
    title,
    icon,
    variant = 'primary',
    className = '',
    textClassName = '',
    disabled = false,
    center = false
}) => {
    const baseClasses = "flex-row items-center justify-between h-14 w-full rounded-full overflow-hidden transition-all active:scale-[0.98]";

    const variants = {
        primary: "bg-surface-light dark:bg-surface-light shadow-lg pr-1",
        secondary: "bg-charcoal dark:bg-white",
        outline: "border border-gray-200 dark:border-white/10 bg-transparent",
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            className={`${baseClasses} ${variants[variant]} ${className}`}
            disabled={disabled}
        >
            <View className={`flex-1 ${center ? 'items-center justify-center' : 'pl-8'}`}>
                <Text className={`text-charcoal font-bold tracking-wide text-[15px] font-display ${textClassName} ${center ? 'text-center' : ''}`}>
                    {title}
                </Text>
            </View>

            {icon && (
                <View className="h-12 w-12 items-center justify-center rounded-full bg-charcoal dark:bg-deep-black">
                    <MaterialIcons name={icon} size={20} color="#C9A66B" />
                </View>
            )}
        </TouchableOpacity>
    );
};
