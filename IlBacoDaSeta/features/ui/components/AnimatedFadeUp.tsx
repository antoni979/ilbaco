import React, { useEffect } from 'react';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing
} from 'react-native-reanimated';
import { ViewStyle } from 'react-native';

interface AnimatedFadeUpProps {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    style?: ViewStyle;
    className?: string;
}

export const AnimatedFadeUp: React.FC<AnimatedFadeUpProps> = ({
    children,
    delay = 0,
    duration = 800,
    style,
    className
}) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
        translateY.value = withDelay(delay, withTiming(0, { duration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
    }, [delay, duration]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <Animated.View style={[style, animatedStyle]} className={className}>
            {children}
        </Animated.View>
    );
};
