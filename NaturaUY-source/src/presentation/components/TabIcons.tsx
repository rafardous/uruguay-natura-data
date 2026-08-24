/**
 * App-wide icon set, backed by lucide-react-native.
 *
 * Kept behind these semantic names (not imported directly at call sites) so
 * swapping the underlying icon library — as happened once already, replacing
 * a hand-drawn SVG set that had a broken path in GameIcon — stays a one-file
 * change instead of touching every screen.
 */
import {
  Check,
  ArrowLeft,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Gamepad2,
  GitFork,
  Heart,
  House,
  Info,
  Leaf,
  LogIn,
  Map,
  Menu,
  Newspaper,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trophy,
  Users,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react-native';

export interface IconProps {
  color: string;
  size?: number;
}

export const HomeIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <House color={color} size={size} strokeWidth={1.75} />
);

export const CompassIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Compass color={color} size={size} strokeWidth={1.75} />
);

export const GameIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Gamepad2 color={color} size={size} strokeWidth={1.75} />
);

export const HeartIcon = ({
  color,
  size = 22,
  filled = false,
}: IconProps & { filled?: boolean }): React.JSX.Element => (
  <Heart color={color} size={size} strokeWidth={1.75} fill={filled ? color : 'none'} />
);

export const MenuIcon = ({ color, size = 24 }: IconProps): React.JSX.Element => (
  <Menu color={color} size={size} strokeWidth={1.75} />
);

export const CloseIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <X color={color} size={size} strokeWidth={1.75} />
);

export const SlidersIcon = ({ color, size = 18 }: IconProps): React.JSX.Element => (
  <SlidersHorizontal color={color} size={size} strokeWidth={1.75} />
);

export const ShieldIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <ShieldCheck color={color} size={size} strokeWidth={1.75} />
);

export const InfoIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Info color={color} size={size} strokeWidth={1.75} />
);

export const SettingsIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Settings color={color} size={size} strokeWidth={1.75} />
);

export const LeafIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Leaf color={color} size={size} strokeWidth={1.75} />
);

export const ChevronRightIcon = ({ color, size = 18 }: IconProps): React.JSX.Element => (
  <ChevronRight color={color} size={size} strokeWidth={1.75} />
);

export const BackIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <ArrowLeft color={color} size={size} strokeWidth={1.75} />
);

export const TaxonomyIcon = ({ color, size = 20 }: IconProps): React.JSX.Element => (
  <GitFork color={color} size={size} strokeWidth={1.75} />
);

export const LoginIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <LogIn color={color} size={size} strokeWidth={1.75} />
);

export const CollaborateIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Users color={color} size={size} strokeWidth={1.75} />
);

export const InterestSitesIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Map color={color} size={size} strokeWidth={1.75} />
);

export const NewsIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Newspaper color={color} size={size} strokeWidth={1.75} />
);

export const ZoomInIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <ZoomIn color={color} size={size} strokeWidth={1.75} />
);

export const ZoomOutIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <ZoomOut color={color} size={size} strokeWidth={1.75} />
);

export const ResetIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <RotateCcw color={color} size={size} strokeWidth={1.75} />
);

export const TrophyIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Trophy color={color} size={size} strokeWidth={1.75} />
);

export const FlameIcon = ({ color, size = 18 }: IconProps): React.JSX.Element => (
  <Flame color={color} size={size} strokeWidth={1.75} />
);

export const CheckIcon = ({ color, size = 18 }: IconProps): React.JSX.Element => (
  <Check color={color} size={size} strokeWidth={2.5} />
);

export const ClockIcon = ({ color, size = 18 }: IconProps): React.JSX.Element => (
  <Clock color={color} size={size} strokeWidth={1.75} />
);

export const StarIcon = ({ color, size = 22, filled = false }: IconProps & { filled?: boolean }): React.JSX.Element => (
  <Star color={color} size={size} strokeWidth={1.75} fill={filled ? color : 'none'} />
);

export const ZapIcon = ({ color, size = 22 }: IconProps): React.JSX.Element => (
  <Zap color={color} size={size} strokeWidth={1.75} />
);
