// ============================================================
// Feature: Sistema de Recomendación de Tallas
// ============================================================

// Servicios
export * from './services/sizing_analysis';
export { default as sizingService } from './services/sizing_analysis';

// Componentes
export { SizeRecommendationCard } from './components/SizeRecommendationCard';
export { SizingOnboardingModal } from './components/SizingOnboardingModal';
export {
    SizeRecommendationBadge,
    SizeRecommendationInline,
} from './components/SizeRecommendationBadge';
export { SizeCalculatorModal } from './components/SizeCalculatorModal';
